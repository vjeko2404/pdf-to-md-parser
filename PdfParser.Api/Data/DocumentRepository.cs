using Dapper;
using PdfParser.Api.Models;

namespace PdfParser.Api.Data;

/// <summary>
/// All data access. Dapper + raw SQL — full control over the FTS5 queries that
/// EF Core handles awkwardly. Status is stored as TEXT for sqlite3-CLI legibility;
/// we always pass Status.ToString() so it never round-trips as an int.
/// </summary>
public class DocumentRepository(Database db)
{
    public async Task<Document?> GetByShaAsync(string sha)
    {
        using var c = db.Open();
        return await c.QuerySingleOrDefaultAsync<Document>(
            "SELECT * FROM documents WHERE Sha256 = @sha",
            new { sha }
        );
    }

    public async Task<Document?> GetByIdAsync(long id)
    {
        using var c = db.Open();
        return await c.QuerySingleOrDefaultAsync<Document>(
            "SELECT * FROM documents WHERE Id = @id",
            new { id }
        );
    }

    public async Task<long> InsertQueuedAsync(Document d)
    {
        using var c = db.Open();
        return await c.ExecuteScalarAsync<long>(
            """
            INSERT INTO documents (Sha256, OriginalName, Slug, Status, CreatedAt)
            VALUES (@Sha256, @OriginalName, @Slug, @Status, @CreatedAt);
            SELECT last_insert_rowid();
            """,
            new
            {
                d.Sha256,
                d.OriginalName,
                d.Slug,
                Status = d.Status.ToString(),
                d.CreatedAt,
            }
        );
    }

    /// <summary>Insert a directly-uploaded doc (archive path pre-set, no watcher involved).</summary>
    public async Task<long> InsertUploadedAsync(Document d)
    {
        using var c = db.Open();
        return await c.ExecuteScalarAsync<long>(
            """
            INSERT INTO documents (Sha256, OriginalName, Slug, Status, ArchivedPdfPath, CreatedAt)
            VALUES (@Sha256, @OriginalName, @Slug, @Status, @ArchivedPdfPath, @CreatedAt);
            SELECT last_insert_rowid();
            """,
            new
            {
                d.Sha256,
                d.OriginalName,
                d.Slug,
                Status = d.Status.ToString(),
                d.ArchivedPdfPath,
                d.CreatedAt,
            }
        );
    }

    public async Task SetStatusAsync(long id, DocumentStatus status, string? error = null)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "UPDATE documents SET Status = @status, ErrorReason = @error WHERE Id = @id",
            new
            {
                id,
                status = status.ToString(),
                error,
            }
        );
    }

    /// <summary>Persist a successful conversion + enrichment and refresh the FTS row.</summary>
    public async Task SaveResultAsync(Document d, string ftsContent)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            """
            UPDATE documents SET
                Status = @Status, MdPath = @MdPath, ArchivedPdfPath = @ArchivedPdfPath,
                LayoutJsonPath = @LayoutJsonPath, Pages = @Pages, Language = @Language,
                DocType = @DocType, DocDate = @DocDate, DocNumber = @DocNumber,
                PartiesJson = @PartiesJson, TagsJson = @TagsJson, Summary = @Summary,
                ErrorReason = NULL, DurationMs = @DurationMs, ProcessedAt = @ProcessedAt
            WHERE Id = @Id;
            """,
            new
            {
                d.Id,
                Status = d.Status.ToString(),
                d.MdPath,
                d.ArchivedPdfPath,
                d.LayoutJsonPath,
                d.Pages,
                d.Language,
                d.DocType,
                d.DocDate,
                d.DocNumber,
                d.PartiesJson,
                d.TagsJson,
                d.Summary,
                d.DurationMs,
                d.ProcessedAt,
            }
        );

        // FTS5 has no UPSERT — delete then insert keyed on rowid.
        await c.ExecuteAsync("DELETE FROM documents_fts WHERE rowid = @Id", new { d.Id });
        await c.ExecuteAsync(
            """
            INSERT INTO documents_fts (rowid, title, summary, tags, content)
            VALUES (@Id, @Title, @Summary, @Tags, @Content);
            """,
            new
            {
                d.Id,
                Title = d.OriginalName,
                d.Summary,
                Tags = d.TagsJson,
                Content = ftsContent,
            }
        );
    }

    /// <summary>Search + filter for the dashboard. FTS5 when q is present.</summary>
    public async Task<IEnumerable<Document>> SearchAsync(SearchQuery query)
    {
        using var c = db.Open();
        var filters = new List<string>();
        var joins = new List<string>();
        var p = new DynamicParameters();

        if (query.Status is { } s)
        {
            filters.Add("d.Status = @status");
            p.Add("status", s.ToString());
        }
        if (!string.IsNullOrWhiteSpace(query.DocType))
        {
            filters.Add("d.DocType = @docType");
            p.Add("docType", query.DocType);
        }
        if (!string.IsNullOrWhiteSpace(query.Language))
        {
            filters.Add("d.Language = @language");
            p.Add("language", query.Language);
        }
        if (!string.IsNullOrWhiteSpace(query.DateFrom))
        {
            filters.Add("d.CreatedAt >= @dateFrom");
            p.Add("dateFrom", query.DateFrom);
        }
        if (!string.IsNullOrWhiteSpace(query.DateTo))
        {
            filters.Add("d.CreatedAt <= @dateTo");
            p.Add("dateTo", query.DateTo);
        }
        if (query.CategoryId is { } cat)
        {
            joins.Add("JOIN document_categories dc ON dc.DocumentId = d.Id AND dc.CategoryId = @cat");
            p.Add("cat", cat);
        }
        if (query.Tags is { Length: > 0 } tags)
        {
            for (var i = 0; i < tags.Length; i++)
            {
                filters.Add($"d.TagsJson LIKE @tag{i}");
                p.Add($"tag{i}", $"%\"{tags[i]}\"%");
            }
        }

        var hasQ = !string.IsNullOrWhiteSpace(query.Q);
        if (hasQ)
        {
            joins.Add("JOIN documents_fts f ON f.rowid = d.Id");
            filters.Add("documents_fts MATCH @q");
            p.Add("q", query.Q);
        }

        var order = query.Sort switch
        {
            "name" => "d.OriginalName COLLATE NOCASE",
            "oldest" => "d.CreatedAt ASC",
            "status" => "d.Status",
            _ when hasQ => "rank",
            _ => "d.CreatedAt DESC",
        };

        var where = filters.Count > 0 ? " WHERE " + string.Join(" AND ", filters) : "";
        var sql =
            $"SELECT d.* FROM documents d {string.Join(' ', joins)}{where} ORDER BY {order} LIMIT 300;";
        return await c.QueryAsync<Document>(sql, p);
    }

    /// <summary>Filter facets (value + count) for the search UI.</summary>
    public async Task<object> FacetsAsync()
    {
        using var c = db.Open();
        var docTypes = await c.QueryAsync<FacetRow>(
            "SELECT DocType AS Value, COUNT(*) AS Count FROM documents WHERE DocType IS NOT NULL AND DocType <> '' GROUP BY DocType ORDER BY Count DESC"
        );
        var languages = await c.QueryAsync<FacetRow>(
            "SELECT Language AS Value, COUNT(*) AS Count FROM documents WHERE Language IS NOT NULL AND Language <> '' GROUP BY Language ORDER BY Count DESC"
        );

        // Tags live in a JSON column — aggregate in memory.
        var tagJsons = await c.QueryAsync<string>("SELECT TagsJson FROM documents WHERE TagsJson IS NOT NULL");
        var tagCounts = new Dictionary<string, int>();
        foreach (var j in tagJsons)
        {
            try
            {
                var arr = System.Text.Json.JsonSerializer.Deserialize<string[]>(j);
                if (arr is null)
                    continue;
                foreach (var t in arr)
                    tagCounts[t] = tagCounts.GetValueOrDefault(t) + 1;
            }
            catch
            {
                // ignore malformed tag json
            }
        }
        var tags = tagCounts
            .OrderByDescending(kv => kv.Value)
            .Take(40)
            .Select(kv => new FacetRow { Value = kv.Key, Count = kv.Value });

        return new { docTypes, languages, tags };
    }

    public async Task AddEventAsync(long documentId, string level, string stage, string message)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            """
            INSERT INTO events (DocumentId, Ts, Level, Stage, Message)
            VALUES (@documentId, @ts, @level, @stage, @message);
            """,
            new
            {
                documentId,
                ts = DateTime.UtcNow,
                level,
                stage,
                message,
            }
        );
    }

    public async Task<IEnumerable<EventLog>> GetEventsAsync(long? documentId)
    {
        using var c = db.Open();
        if (documentId is { } id)
        {
            return await c.QueryAsync<EventLog>(
                "SELECT * FROM events WHERE DocumentId = @id ORDER BY Ts DESC LIMIT 500",
                new { id }
            );
        }
        return await c.QueryAsync<EventLog>("SELECT * FROM events ORDER BY Ts DESC LIMIT 500");
    }

    public async Task<IReadOnlyDictionary<string, int>> StatsAsync()
    {
        using var c = db.Open();
        var rows = await c.QueryAsync<(string Status, int Count)>(
            "SELECT Status, COUNT(*) AS Count FROM documents GROUP BY Status"
        );
        return rows.ToDictionary(r => r.Status, r => r.Count);
    }
}
