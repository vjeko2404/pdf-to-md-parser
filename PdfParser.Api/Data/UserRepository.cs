using Dapper;
using PdfParser.Api.Models;

namespace PdfParser.Api.Data;

/// <summary>Data access for app users + the one-time claim of pre-auth orphan rows.</summary>
public class UserRepository(Database db)
{
    public async Task<User?> GetByUsernameAsync(string username)
    {
        using var c = db.Open();
        return await c.QuerySingleOrDefaultAsync<User>(
            "SELECT * FROM users WHERE Username = @username COLLATE NOCASE",
            new { username }
        );
    }

    public async Task<User?> GetByIdAsync(long id)
    {
        using var c = db.Open();
        return await c.QuerySingleOrDefaultAsync<User>(
            "SELECT * FROM users WHERE Id = @id",
            new { id }
        );
    }

    public async Task<int> CountAsync()
    {
        using var c = db.Open();
        return await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM users");
    }

    public async Task<long> InsertAsync(User u)
    {
        using var c = db.Open();
        return await c.ExecuteScalarAsync<long>(
            """
            INSERT INTO users (Username, PasswordHash, Role, IsActive, CreatedAt)
            VALUES (@Username, @PasswordHash, @Role, @IsActive, @CreatedAt);
            SELECT last_insert_rowid();
            """,
            new
            {
                u.Username,
                u.PasswordHash,
                u.Role,
                IsActive = u.IsActive ? 1 : 0,
                u.CreatedAt,
            }
        );
    }

    public async Task<IEnumerable<User>> ListAsync()
    {
        using var c = db.Open();
        return await c.QueryAsync<User>("SELECT * FROM users ORDER BY Id");
    }

    public async Task SetActiveAsync(long id, bool active)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "UPDATE users SET IsActive = @active WHERE Id = @id",
            new { id, active = active ? 1 : 0 }
        );
    }

    public async Task UpdatePasswordHashAsync(long id, string hash)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "UPDATE users SET PasswordHash = @hash WHERE Id = @id",
            new { id, hash }
        );
    }

    /// <summary>
    /// One-time migration helper: assign every pre-auth (owner-less) document, category,
    /// per-user setting and secret to the first admin. Global settings (UserId 0,
    /// registrationEnabled) are deliberately left alone.
    /// </summary>
    public async Task AssignOrphansToAdminAsync(long adminId)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            """
            UPDATE documents  SET OwnerUserId = @adminId WHERE OwnerUserId IS NULL;
            UPDATE categories SET OwnerUserId = @adminId WHERE OwnerUserId IS NULL;
            UPDATE settings   SET UserId = @adminId WHERE UserId = 0 AND Key <> 'registrationEnabled';
            UPDATE secrets    SET UserId = @adminId WHERE UserId = 0;
            """,
            new { adminId }
        );
    }
}
