namespace PdfParser.Api.Models;

public enum UserRole
{
    User,
    Admin,
}

/// <summary>One application user / tenant. Owns its own documents, settings, secrets,
/// categories and watched folder. Role differs only in the registration toggle privilege.</summary>
public class User
{
    public long Id { get; set; }
    public string Username { get; set; } = "";

    /// <summary>PHC-style string: <c>pbkdf2$&lt;iter&gt;$&lt;saltB64&gt;$&lt;hashB64&gt;</c>.</summary>
    public string PasswordHash { get; set; } = "";

    public string Role { get; set; } = nameof(UserRole.User);
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public bool IsAdmin =>
        string.Equals(Role, nameof(UserRole.Admin), StringComparison.OrdinalIgnoreCase);
}

// ── Request / response DTOs ──────────────────────────────────────────────────
public record RegisterRequest(string Username, string Password);

public record LoginRequest(string Username, string Password);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

/// <summary>Public-safe view of a user (never includes the hash).</summary>
public record UserInfo(long Id, string Username, string Role, bool IsActive);

/// <summary>Login/register success payload: the bearer token + who you are.</summary>
public record AuthResponse(string Token, UserInfo User);
