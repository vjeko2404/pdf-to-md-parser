using Dapper;
using PdfParser.Api.Models;

namespace PdfParser.Api.Data;

public class CategoryRepository(Database db)
{
    public async Task<IEnumerable<CategoryWithCount>> ListAsync()
    {
        using var c = db.Open();
        return await c.QueryAsync<CategoryWithCount>(
            """
            SELECT c.Id, c.Name, c.Color, c.CreatedAt, COUNT(dc.DocumentId) AS Count
            FROM categories c
            LEFT JOIN document_categories dc ON dc.CategoryId = c.Id
            GROUP BY c.Id
            ORDER BY c.Name COLLATE NOCASE;
            """
        );
    }

    public async Task<long> CreateAsync(string name, string? color)
    {
        using var c = db.Open();
        return await c.ExecuteScalarAsync<long>(
            """
            INSERT INTO categories (Name, Color, CreatedAt) VALUES (@name, @color, @ts);
            SELECT last_insert_rowid();
            """,
            new { name, color, ts = DateTime.UtcNow }
        );
    }

    public async Task UpdateAsync(long id, string name, string? color)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "UPDATE categories SET Name = @name, Color = @color WHERE Id = @id",
            new { id, name, color }
        );
    }

    public async Task DeleteAsync(long id)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "DELETE FROM document_categories WHERE CategoryId = @id; DELETE FROM categories WHERE Id = @id;",
            new { id }
        );
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
