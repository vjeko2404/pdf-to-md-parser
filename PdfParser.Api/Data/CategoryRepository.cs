using Dapper;
using PdfParser.Api.Models;

namespace PdfParser.Api.Data;

/// <summary>Per-user category taxonomy. Every query is scoped by OwnerUserId so a user
/// only ever sees/edits their own categories.</summary>
public class CategoryRepository(Database db)
{
    public async Task<IEnumerable<CategoryWithCount>> ListAsync(long userId)
    {
        using var c = db.Open();
        return await c.QueryAsync<CategoryWithCount>(
            """
            SELECT c.Id, c.Name, c.Color, c.CreatedAt, COUNT(dc.DocumentId) AS Count
            FROM categories c
            LEFT JOIN document_categories dc ON dc.CategoryId = c.Id
            WHERE c.OwnerUserId = @userId
            GROUP BY c.Id
            ORDER BY c.Name COLLATE NOCASE;
            """,
            new { userId }
        );
    }

    public async Task<long> CreateAsync(long userId, string name, string? color)
    {
        using var c = db.Open();
        return await c.ExecuteScalarAsync<long>(
            """
            INSERT INTO categories (OwnerUserId, Name, Color, CreatedAt) VALUES (@userId, @name, @color, @ts);
            SELECT last_insert_rowid();
            """,
            new { userId, name, color, ts = DateTime.UtcNow }
        );
    }

    /// <summary>
    /// A starter set of categories. INSERT OR IGNORE keys off the (OwnerUserId, Name)
    /// unique index, so it's idempotent per user; the caller additionally guards it behind
    /// a per-user "seeded once" flag so user-deleted defaults don't reappear on restart.
    /// </summary>
    private static readonly (string Name, string Color)[] Defaults =
    [
        ("Invoices", "#a855f7"),
        ("Contracts", "#6366f1"),
        ("Receipts", "#ec4899"),
        ("Reports", "#0ea5e9"),
        ("Letters", "#14b8a6"),
        ("Manuals", "#f59e0b"),
        ("Legal", "#ef4444"),
        ("Personal", "#22c55e"),
    ];

    public async Task SeedDefaultsAsync(long userId)
    {
        using var c = db.Open();
        foreach (var (name, color) in Defaults)
            await c.ExecuteAsync(
                "INSERT OR IGNORE INTO categories (OwnerUserId, Name, Color, CreatedAt) VALUES (@userId, @name, @color, @ts);",
                new { userId, name, color, ts = DateTime.UtcNow }
            );
    }

    public async Task UpdateAsync(long userId, long id, string name, string? color)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "UPDATE categories SET Name = @name, Color = @color WHERE Id = @id AND OwnerUserId = @userId",
            new { userId, id, name, color }
        );
    }

    public async Task DeleteAsync(long userId, long id)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            """
            DELETE FROM document_categories WHERE CategoryId = @id
                AND CategoryId IN (SELECT Id FROM categories WHERE OwnerUserId = @userId);
            DELETE FROM categories WHERE Id = @id AND OwnerUserId = @userId;
            """,
            new { userId, id }
        );
    }

    /// <summary>True if <paramref name="categoryId"/> belongs to <paramref name="userId"/>.</summary>
    public async Task<bool> OwnsAsync(long userId, long categoryId)
    {
        using var c = db.Open();
        return await c.ExecuteScalarAsync<long>(
            "SELECT COUNT(*) FROM categories WHERE Id = @categoryId AND OwnerUserId = @userId",
            new { userId, categoryId }
        ) > 0;
    }

    public async Task AssignAsync(long documentId, long categoryId)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "INSERT OR IGNORE INTO document_categories (DocumentId, CategoryId) VALUES (@documentId, @categoryId)",
            new { documentId, categoryId }
        );
    }

    public async Task UnassignAsync(long documentId, long categoryId)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "DELETE FROM document_categories WHERE DocumentId = @documentId AND CategoryId = @categoryId",
            new { documentId, categoryId }
        );
    }

    /// <summary>Replace a document's entire category set in one go (used by the edit modal).
    /// Only categories the user owns are assigned; everything else for the doc is cleared.</summary>
    public async Task SetForDocumentAsync(long documentId, IEnumerable<long> categoryIds, long userId)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "DELETE FROM document_categories WHERE DocumentId = @documentId",
            new { documentId }
        );
        foreach (var cid in categoryIds.Distinct())
            await c.ExecuteAsync(
                """
                INSERT OR IGNORE INTO document_categories (DocumentId, CategoryId)
                SELECT @documentId, @cid
                WHERE EXISTS (SELECT 1 FROM categories WHERE Id = @cid AND OwnerUserId = @userId);
                """,
                new { documentId, cid, userId }
            );
    }

    public async Task<IEnumerable<Category>> ForDocumentAsync(long documentId)
    {
        using var c = db.Open();
        return await c.QueryAsync<Category>(
            """
            SELECT c.Id, c.Name, c.Color, c.CreatedAt
            FROM categories c
            JOIN document_categories dc ON dc.CategoryId = c.Id
            WHERE dc.DocumentId = @documentId
            ORDER BY c.Name COLLATE NOCASE;
            """,
            new { documentId }
        );
    }
}
