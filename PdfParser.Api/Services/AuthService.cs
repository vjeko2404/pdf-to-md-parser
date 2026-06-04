using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PdfParser.Api.Config;
using PdfParser.Api.Data;
using PdfParser.Api.Models;

namespace PdfParser.Api.Services;

/// <summary>Outcome of an auth operation. <c>Ok</c> carries the token+user; otherwise
/// <c>Error</c> + <c>Status</c> describe the failure for the endpoint to return.</summary>
public record AuthOutcome(
    bool Ok,
    AuthResponse? Response = null,
    string? Error = null,
    int Status = 400
)
{
    public static AuthOutcome Success(AuthResponse r) => new(true, r);

    public static AuthOutcome Fail(string error, int status = 400) =>
        new(false, Error: error, Status: status);
}

/// <summary>
/// Registration, login, password changes and JWT issuance. The first user to register
/// becomes the Admin (and claims any pre-auth orphan data); everyone else is a User.
/// Each new user gets their per-user settings + a seeded category set, once.
/// </summary>
public class AuthService
{
    private readonly UserRepository _users;
    private readonly SettingsService _settings;
    private readonly CategoryRepository _categories;
    private readonly SymmetricSecurityKey _signingKey;
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromDays(7);

    public AuthService(
        UserRepository users,
        SettingsService settings,
        CategoryRepository categories,
        IOptions<AppOptions> options
    )
    {
        _users = users;
        _settings = settings;
        _categories = categories;
        _signingKey = ResolveSigningKey(options.Value);
    }

    /// <summary>JWT signing key: the configured App:JwtKey, else a persisted vault keyfile.
    /// Shared by issuance (here) and validation (Program.cs) so both use one key.</summary>
    public SymmetricSecurityKey SigningKey => _signingKey;

    public static SymmetricSecurityKey ResolveSigningKey(AppOptions opt) => new(ResolveKey(opt));

    private static byte[] ResolveKey(AppOptions opt)
    {
        if (!string.IsNullOrWhiteSpace(opt.JwtKey))
            return SHA256.HashData(Encoding.UTF8.GetBytes(opt.JwtKey));

        Directory.CreateDirectory(opt.VaultDir);
        var keyPath = Path.Combine(opt.VaultDir, ".jwtkey");
        if (File.Exists(keyPath))
            return Convert.FromBase64String(File.ReadAllText(keyPath).Trim());

        var key = RandomNumberGenerator.GetBytes(32);
        File.WriteAllText(keyPath, Convert.ToBase64String(key));
        return key;
    }

    // ── Password policy (mirrors the frontend strength meter) ────────────────
    /// <summary>≥8 chars, ≥1 uppercase, ≥1 digit, ≥1 symbol. Returns null if valid.</summary>
    public static string? ValidatePassword(string pw)
    {
        if (string.IsNullOrEmpty(pw) || pw.Length < 8)
            return "Password must be at least 8 characters.";
        if (!pw.Any(char.IsUpper))
            return "Password must contain an uppercase letter.";
        if (!pw.Any(char.IsDigit))
            return "Password must contain a number.";
        if (!pw.Any(c => !char.IsLetterOrDigit(c)))
            return "Password must contain a symbol.";
        return null;
    }

    public async Task<AuthOutcome> RegisterAsync(RegisterRequest req)
    {
        var username = (req.Username ?? "").Trim();
        if (username.Length < 3)
            return AuthOutcome.Fail("Username must be at least 3 characters.");
        if (username.Length > 64)
            return AuthOutcome.Fail("Username is too long.");

        if (ValidatePassword(req.Password ?? "") is { } pwErr)
            return AuthOutcome.Fail(pwErr);

        var existingCount = await _users.CountAsync();
        var isFirst = existingCount == 0;

        // Only the very first registration is allowed when the toggle is off.
        if (!isFirst && !_settings.RegistrationEnabled)
            return AuthOutcome.Fail("Registration is currently disabled.", 403);

        if (await _users.GetByUsernameAsync(username) is not null)
            return AuthOutcome.Fail("That username is already taken.", 409);

        var user = new User
        {
            Username = username,
            PasswordHash = PasswordHasher.Hash(req.Password!),
            Role = isFirst ? nameof(UserRole.Admin) : nameof(UserRole.User),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        user.Id = await _users.InsertAsync(user);

        // The first admin inherits all pre-auth (orphan) data. The claim is a raw SQL
        // UPDATE, so refresh the settings cache before seeding defaults — otherwise
        // SeedUserDefaults would see the cache miss and clobber the just-claimed values.
        if (isFirst)
        {
            await _users.AssignOrphansToAdminAsync(user.Id);
            _settings.Load();
        }

        await BootstrapUserAsync(user.Id);

        return AuthOutcome.Success(new AuthResponse(IssueToken(user), ToInfo(user)));
    }

    public async Task<AuthOutcome> LoginAsync(LoginRequest req)
    {
        var user = await _users.GetByUsernameAsync((req.Username ?? "").Trim());
        // Verify against a real-or-dummy hash either way to blunt user enumeration timing.
        var ok = PasswordHasher.Verify(req.Password ?? "", user?.PasswordHash ?? DummyHash);
        if (user is null || !ok)
            return AuthOutcome.Fail("Invalid username or password.", 401);
        if (!user.IsActive)
            return AuthOutcome.Fail("This account is disabled.", 403);

        return AuthOutcome.Success(new AuthResponse(IssueToken(user), ToInfo(user)));
    }

    /// <summary>Change the caller's own password (after verifying the current one).</summary>
    public async Task<AuthOutcome> ChangePasswordAsync(long userId, ChangePasswordRequest req)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user is null)
            return AuthOutcome.Fail("User not found.", 404);
        if (!PasswordHasher.Verify(req.CurrentPassword ?? "", user.PasswordHash))
            return AuthOutcome.Fail("Current password is incorrect.", 400);
        if (ValidatePassword(req.NewPassword ?? "") is { } pwErr)
            return AuthOutcome.Fail(pwErr);

        await _users.UpdatePasswordHashAsync(userId, PasswordHasher.Hash(req.NewPassword!));
        return AuthOutcome.Success(new AuthResponse(IssueToken(user), ToInfo(user)));
    }

    /// <summary>Seed a new user's per-user settings and default categories (each once).</summary>
    private async Task BootstrapUserAsync(long userId)
    {
        _settings.SeedUserDefaults(userId);
        if (!_settings.CategoriesSeeded(userId))
        {
            await _categories.SeedDefaultsAsync(userId);
            _settings.MarkCategoriesSeeded(userId);
        }
    }

    private string IssueToken(User user)
    {
        var claims = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role),
            ]
        );
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = claims,
            Expires = DateTime.UtcNow.Add(TokenLifetime),
            SigningCredentials = new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256),
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    public static UserInfo ToInfo(User u) => new(u.Id, u.Username, u.Role, u.IsActive);

    // A well-formed PHC string that no password verifies against — used so login does
    // the same PBKDF2 work whether or not the username exists.
    private static readonly string DummyHash = PasswordHasher.Hash(
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(24))
    );
}
