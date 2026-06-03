using Dapper;
using PdfParser.Api.Models;

namespace PdfParser.Api.Data;

/// <summary>
/// All document data access. Dapper + raw SQL — full control over the FTS5 queries that
/// EF Core handles awkwardly. Status is stored as TEXT for sqlite3-CLI legibility; we
/// always pass Status.ToString() so it never round-trips as an int.
///
/// Methods that serve HTTP requests take a <c>userId</c> and scope on OwnerUserId so a
/// user only ever touches their own documents. The pipeline/watcher operate in a system
/// context and use the *Internal/by-id variants (ownership is fixed at insert time).
/// </summary>
public class DocumentRepository(Database db)
{
    /// <summary>Dedup lookup scoped to the owner — each user dedups within their own library.</summary>
    public async Task<Document?> GetByShaAsync(string sha, long userId)
    {
        using var c = db.Open();
        return await c.QuerySingleOrDefaultAsync<Document>(
            "SELECT * FROM documents WHERE Sha256 = @sha AND OwnerUserId = @userId",
            new { sha, userId }
        );
    }

    /// <summary>Owner-scoped fetch (returns null if the doc isn't the user's).</summary>
    public async Task<Document?> GetByIdAsync(long id, long userId)
    {
        using var c = db.Open();
        var doc = await c.QuerySingleOrDefaultAsync<Document>(
            "SELECT * FROM documents WHERE Id = @id AND OwnerUserId = @userId",
            new { id, userId }
        );
        if (doc is not null)
            await AttachCategoriesAsync(c, [doc]);
        return doc;
    }

    /// <summary>Unscoped fetch for the pipeline (system context).</summary>
    public async Task<Document?> GetByIdInternalAsync(long id)
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
            INSERT INTO documents (OwnerUserId, Sha256, OriginalName, Slug, Status, CreatedAt)
            VALUES (@OwnerUserId, @Sha256, @OriginalName, @Slug, @Status, @CreatedAt);
            SELECT last_insert_rowid();
            """,
            new
            {
                d.OwnerUserId,
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
            INSERT INTO documents (OwnerUserId, Sha256, OriginalName, Slug, Status, ArchivedPdfPath, CreatedAt)
            VALUES (@OwnerUserId, @Sha256, @OriginalName, @Slug, @Status, @ArchivedPdfPath, @CreatedAt);
            SELECT last_insert_rowid();
            """,
            new
            {
                d.OwnerUserId,
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

    /// <summary>
    /// Replace a document's tags (manual editing from the detail page). Updates the
    /// JSON column AND the FTS tags column so search-by-tag stays consistent. The caller
    /// has already verified ownership.
    /// </summary>
    public async Task UpdateTagsAsync(long id, IEnumerable<string> tags)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(tags);
        using var c = db.Open();
        await c.ExecuteAsync("UPDATE documents SET TagsJson = @json WHERE Id = @id", new { id, json });
        await c.ExecuteAsync("UPDATE documents_fts SET tags = @json WHERE rowid = @id", new { id, json });
    }

    /// <summary>Search + filter for the dashboard, scoped to the user. FTS5 when q is present.</summary>
    public async Task<IEnumerable<Document>> SearchAsync(SearchQuery query, long userId)
    {
        using var c = db.Open();
        var filters = new List<string> { "d.OwnerUserId = @userId" };
        var joins = new List<string>();
        var p = new DynamicParameters();
        p.Add("userId", userId);

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
            // Match the full-text index (title/summary/tags/content) OR the tag/name
            // columns directly, so typing a tag or a filename fragment always works —
            // even as a prefix. FTS terms are quoted + suffixed with * to stay
            // syntax-safe and search-as-you-type friendly.
            filters.Add(
                "(d.Id IN (SELECT rowid FROM documents_fts WHERE documents_fts MATCH @q) "
                    + "OR d.TagsJson LIKE @qLike OR d.OriginalName LIKE @qLike)"
            );
            p.Add("q", ToFtsPrefixQuery(query.Q!));
            p.Add("qLike", "%" + query.Q!.Trim() + "%");
        }

        var order = query.Sort switch
        {
            "name" => "d.OriginalName COLLATE NOCASE",
            "oldest" => "d.CreatedAt ASC",
            "status" => "d.Status",
            _ => "d.CreatedAt DESC",
        };

        var where = " WHERE " + string.Join(" AND ", filters);
        var sql =
            $"SELECT d.* FROM documents d {string.Join(' ', joins)}{where} ORDER BY {order} LIMIT 300;";
        var docs = (await c.QueryAsync<Document>(sql, p)).ToList();
        await AttachCategoriesAsync(c, docs);
        return docs;
    }

    private sealed class DocCategoryRow
    {
        public long DocumentId { get; set; }
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public string? Color { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    /// <summary>One grouped query to hang each doc's categories off the result set — keeps
    /// the list/detail JSON self-contained (drives the Library category column + edit modal).</summary>
    private static async Task AttachCategoriesAsync(
        Microsoft.Data.Sqlite.SqliteConnection c,
        IReadOnlyList<Document> docs
    )
    {
        if (docs.Count == 0)
            return;
        var ids = docs.Select(d => d.Id).ToArray();
        var rows = await c.QueryAsync<DocCategoryRow>(
            """
            SELECT dc.DocumentId, c.Id, c.Name, c.Color, c.CreatedAt
            FROM document_categories dc
            JOIN categories c ON c.Id = dc.CategoryId
            WHERE dc.DocumentId IN @ids
            ORDER BY c.Name COLLATE NOCASE;
            """,
            new { ids }
        );
        var byDoc = rows.GroupBy(r => r.DocumentId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<Category>)
                    g.Select(r => new Category
                        {
                            Id = r.Id,
                            Name = r.Name,
                            Color = r.Color,
                            CreatedAt = r.CreatedAt,
                        })
                        .ToList()
            );
        foreach (var d in docs)
            if (byDoc.TryGetValue(d.Id, out var cs))
                d.Categories = cs;
    }

    /// <summary>Rename the display name (and FTS title) only — the slug and on-disk artifact
    /// paths are left untouched, so there are no file moves and no race with the converter.</summary>
    public async Task UpdateNameAsync(long id, string name)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            "UPDATE documents SET OriginalName = @name WHERE Id = @id",
            new { id, name }
        );
        // FTS row only exists once a doc has been converted; this no-ops before then.
        await c.ExecuteAsync(
            "UPDATE documents_fts SET title = @name WHERE rowid = @id",
            new { id, name }
        );
    }

    /// <summary>Wipe a doc's conversion outputs so it re-runs the whole pipeline from the
    /// archived PDF: clears artifact paths + extracted/enriched metadata, drops the FTS row,
    /// and sets the doc back to Queued. Keeps ArchivedPdfPath — that's the reconversion source.</summary>
    public async Task ResetForReconvertAsync(long id)
    {
        using var c = db.Open();
        await c.ExecuteAsync(
            """
            UPDATE documents SET
                Status = 'Queued', MdPath = NULL, LayoutJsonPath = NULL, Pages = 0,
                Language = NULL, DocType = NULL, DocDate = NULL, DocNumber = NULL,
                PartiesJson = NULL, TagsJson = NULL, Summary = NULL, ErrorReason = NULL,
                DurationMs = 0, ProcessedAt = NULL
            WHERE Id = @id;
            DELETE FROM documents_fts WHERE rowid = @id;
            """,
            new { id }
        );
    }

    /// <summary>Filter facets (value + count) for the search UI, scoped to the user.</summary>
    public async Task<object> FacetsAsync(long userId)
    {
        using var c = db.Open();
        var docTypes = await c.QueryAsync<FacetRow>(
            "SELECT DocType AS Value, COUNT(*) AS Count FROM documents WHERE OwnerUserId = @userId AND DocType IS NOT NULL AND DocType <> '' GROUP BY DocType ORDER BY Count DESC",
            new { userId }
        );
        var languages = await c.QueryAsync<FacetRow>(
            "SELECT Language AS Value, COUNT(*) AS Count FROM documents WHERE OwnerUserId = @userId AND Language IS NOT NULL AND Language <> '' GROUP BY Language ORDER BY Count DESC",
            new { userId }
        );

        // Tags live in a JSON column — aggregate in memory.
        var tagJsons = await c.QueryAsync<string>(
            "SELECT TagsJson FROM documents WHERE OwnerUserId = @userId AND TagsJson IS NOT NULL",
            new { userId }
        );
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

    /// <summary>Events for the user — either one of their docs, or all of them. Scoped via join.</summary>
    public async Task<IEnumerable<EventLog>> GetEventsAsync(long? documentId, long userId)
    {
        using var c = db.Open();
        if (documentId is { } id)
        {
            return await c.QueryAsync<EventLog>(
                """
                SELECT e.* FROM events e
                JOIN documents d ON d.Id = e.DocumentId
                WHERE e.DocumentId = @id AND d.OwnerUserId = @userId
                ORDER BY e.Ts DESC LIMIT 500
                """,
                new { id, userId }
            );
        }
        return await c.QueryAsync<EventLog>(
            """
            SELECT e.* FROM events e
            JOIN documents d ON d.Id = e.DocumentId
            WHERE d.OwnerUserId = @userId
            ORDER BY e.Ts DESC LIMIT 500
            """,
            new { userId }
        );
    }

    public async Task<IReadOnlyDictionary<string, int>> StatsAsync(long userId)
    {
        using var c = db.Open();
        var rows = await c.QueryAsync<(string Status, int Count)>(
            "SELECT Status, COUNT(*) AS Count FROM documents WHERE OwnerUserId = @userId GROUP BY Status",
            new { userId }
        );
        return rows.ToDictionary(r => r.Status, r => r.Count);
    }

    /// <summary>
    /// Delete a document and every trace of it: DB row, FTS entry, events, category
    /// links, and all on-disk artifacts (the markdown dir incl. images, the blocks.json,
    /// the archived PDF). Scoped to the owner — returns false if the id isn't the user's.
    /// On-disk cleanup is best-effort — a missing/locked file never fails the delete.
    /// </summary>
    public async Task<bool> DeleteAsync(long id, long userId)
    {
        var doc = await GetByIdAsync(id, userId);
        if (doc is null)
            return false;

        using (var c = db.Open())
        {
            await c.ExecuteAsync(
                """
                DELETE FROM events WHERE DocumentId = @id;
                DELETE FROM document_categories WHERE DocumentId = @id;
                DELETE FROM documents_fts WHERE rowid = @id;
                DELETE FROM documents WHERE Id = @id;
                """,
                new { id }
            );
        }

        TryDeleteFile(doc.LayoutJsonPath);
        TryDeleteFile(doc.ArchivedPdfPath);

        // The markdown dir (…/markdown/{slug}/) holds the .md + the images/ folder.
        var mdDir = doc.MdPath is null ? null : Path.GetDirectoryName(doc.MdPath);
        if (mdDir is not null && Directory.Exists(mdDir))
        {
            try
            {
                Directory.Delete(mdDir, recursive: true);
            }
            catch
            {
                // leave orphaned files rather than fail the delete
            }
        }
        else
        {
            TryDeleteFile(doc.MdPath);
        }

        return true;
    }

    static void TryDeleteFile(string? path)
    {
        if (string.IsNullOrEmpty(path))
            return;
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch
        {
            // best-effort
        }
    }

    /// <summary>
    /// Turn raw user input into a safe FTS5 prefix query: each whitespace-separated
    /// token is quoted (so punctuation can't break MATCH syntax) and suffixed with *
    /// for search-as-you-type. e.g. "inv 2024" → "inv"* "2024"*.
    /// </summary>
    static string ToFtsPrefixQuery(string raw)
    {
        var tokens = raw.Split(
            (char[]?)null,
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
        );
        if (tokens.Length == 0)
            return "\"\"";
        return string.Join(' ', tokens.Select(t => "\"" + t.Replace("\"", "\"\"") + "\"*"));
    }
}
