using PdfParser.Api.Data;
using PdfParser.Api.Models;
using PdfParser.Api.Pipeline;
using PdfParser.Api.Services;
using PdfParser.Api.Util;

namespace PdfParser.Api.Endpoints;

public static class DocumentsEndpoints
{
    public static void MapDocumentsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/documents").WithTags("Documents");

        // Search (FTS5 when q present) + detailed filters.
        g.MapGet(
            "/",
            async (
                DocumentRepository repo,
                string? q,
                DocumentStatus? status,
                string? tag,
                string? tags,
                string? docType,
                string? language,
                string? dateFrom,
                string? dateTo,
                long? categoryId,
                string? sort
            ) =>
            {
                var tagList = new List<string>();
                if (!string.IsNullOrWhiteSpace(tag))
                    tagList.Add(tag);
                if (!string.IsNullOrWhiteSpace(tags))
                    tagList.AddRange(
                        tags.Split(
                            ',',
                            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
                        )
                    );

                var query = new SearchQuery(
                    q,
                    status,
                    tagList.Count > 0 ? tagList.ToArray() : null,
                    docType,
                    language,
                    dateFrom,
                    dateTo,
                    categoryId,
                    sort
                );
                return Results.Ok(await repo.SearchAsync(query));
            }
        );

        g.MapGet(
            "/{id:long}",
            async (long id, DocumentRepository repo) =>
                await repo.GetByIdAsync(id) is { } d ? Results.Ok(d) : Results.NotFound()
        );

        g.MapGet(
            "/{id:long}/markdown",
            async (long id, DocumentRepository repo) =>
            {
                var d = await repo.GetByIdAsync(id);
                if (d?.MdPath is null || !File.Exists(d.MdPath))
                    return Results.NotFound();
                return Results.Text(await File.ReadAllTextAsync(d.MdPath), "text/markdown");
            }
        );

        // Block list → the sync-scroll coordinate map for the viewer.
        g.MapGet(
            "/{id:long}/blocks",
            async (long id, DocumentRepository repo) =>
            {
                var d = await repo.GetByIdAsync(id);
                if (d?.LayoutJsonPath is null || !File.Exists(d.LayoutJsonPath))
                    return Results.NotFound();
                return Results.Text(
                    await File.ReadAllTextAsync(d.LayoutJsonPath),
                    "application/json"
                );
            }
        );

        // Stream the archived original for the PDF pane.
        g.MapGet(
            "/{id:long}/pdf",
            async (long id, DocumentRepository repo) =>
            {
                var d = await repo.GetByIdAsync(id);
                if (d?.ArchivedPdfPath is null || !File.Exists(d.ArchivedPdfPath))
                    return Results.NotFound();
                return Results.File(
                    d.ArchivedPdfPath,
                    "application/pdf",
                    Path.GetFileName(d.ArchivedPdfPath)
                );
            }
        );

        g.MapGet(
            "/{id:long}/events",
            async (long id, DocumentRepository repo) => Results.Ok(await repo.GetEventsAsync(id))
        );

        // Direct drag-and-drop upload — stage the PDF into the archive, dedup, enqueue.
        // Bypasses the watcher entirely (written outside the watch dir).
        g.MapPost(
                "/upload",
                async (
                    IFormFile file,
                    DocumentRepository repo,
                    ProcessingQueue queue,
                    SettingsService settings
                ) =>
                {
                    if (file is null || file.Length == 0)
                        return Results.BadRequest("empty file");
                    if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                        return Results.BadRequest("only .pdf files are accepted");

                    using var ms = new MemoryStream();
                    await file.CopyToAsync(ms);
                    var bytes = ms.ToArray();
                    var sha = Helpers.Sha256Hex(bytes);
                    var name = Path.GetFileName(file.FileName);

                    var existing = await repo.GetByShaAsync(sha);
                    if (existing is not null)
                    {
                        if (existing.Status is DocumentStatus.Done or DocumentStatus.Skipped)
                            return Results.Ok(existing); // already have it
                        await repo.SetStatusAsync(existing.Id, DocumentStatus.Queued);
                        await queue.EnqueueAsync(existing.Id);
                        return Results.Ok(existing);
                    }

                    var pdfDir = Path.Combine(settings.VaultDir, "pdf");
                    Directory.CreateDirectory(pdfDir);
                    var dest = Helpers.UniquePath(Path.Combine(pdfDir, name));
                    await File.WriteAllBytesAsync(dest, bytes);

                    var doc = new Document
                    {
                        Sha256 = sha,
                        OriginalName = name,
                        Slug = Helpers.Slugify(name),
                        Status = DocumentStatus.Queued,
                        ArchivedPdfPath = dest, // worker resolves source from here, skips re-archiving
                        CreatedAt = DateTime.UtcNow,
                    };
                    var id = await repo.InsertUploadedAsync(doc);
                    await repo.AddEventAsync(id, "info", "upload", $"Uploaded {name}");
                    await queue.EnqueueAsync(id);
                    return Results.Ok(await repo.GetByIdAsync(id));
                }
            )
            .DisableAntiforgery();

        // Requeue a failed (or any) document.
        g.MapPost(
            "/{id:long}/retry",
            async (long id, DocumentRepository repo, ProcessingQueue queue) =>
            {
                if (await repo.GetByIdAsync(id) is null)
                    return Results.NotFound();
                await repo.SetStatusAsync(id, DocumentStatus.Queued);
                await queue.EnqueueAsync(id);
                return Results.Accepted($"/api/documents/{id}");
            }
        );

        // Enrich ONE document (re-reads saved Markdown, no reconvert). Frontend-triggered.
        g.MapPost(
            "/{id:long}/reenrich",
            async (long id, DocumentRepository repo, EnrichmentService enrich) =>
            {
                var d = await repo.GetByIdAsync(id);
                if (d is null)
                    return Results.NotFound();
                return await enrich.EnrichAsync(d)
                    ? Results.Ok(d)
                    : Results.Problem(
                        detail: "Enrichment unavailable — is Ollama running with a model selected?",
                        statusCode: 503
                    );
            }
        );

        // Batch enrichment — the frontend selects N documents and triggers tagging.
        // Sequential on purpose: enrichment shares one local LLM, no point fanning out.
        g.MapPost(
            "/enrich",
            async (EnrichBatchRequest req, DocumentRepository repo, EnrichmentService enrich) =>
            {
                var results = new List<object>();
                foreach (var id in req.Ids)
                {
                    var d = await repo.GetByIdAsync(id);
                    if (d is null)
                    {
                        results.Add(
                            new
                            {
                                id,
                                ok = false,
                                error = "not found",
                            }
                        );
                        continue;
                    }
                    var ok = await enrich.EnrichAsync(d);
                    results.Add(
                        new
                        {
                            id,
                            ok,
                            error = ok ? null : "no markdown or Ollama failed",
                        }
                    );
                }
                return Results.Ok(results);
            }
        );
    }
}

/// <summary>Request body for POST /api/documents/enrich.</summary>
public record EnrichBatchRequest(long[] Ids);
