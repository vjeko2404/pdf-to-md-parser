using System.Security.Claims;
using PdfParser.Api.Auth;
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

        // Search (FTS5 when q present) + detailed filters — scoped to the caller.
        g.MapGet(
            "/",
            async (
                ClaimsPrincipal user,
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
                return Results.Ok(await repo.SearchAsync(query, user.GetUserId()));
            }
        );

        g.MapGet(
            "/{id:long}",
            async (long id, ClaimsPrincipal user, DocumentRepository repo) =>
                await repo.GetByIdAsync(id, user.GetUserId()) is { } d ? Results.Ok(d) : Results.NotFound()
        );

        g.MapGet(
            "/{id:long}/markdown",
            async (long id, ClaimsPrincipal user, DocumentRepository repo) =>
            {
                var d = await repo.GetByIdAsync(id, user.GetUserId());
                if (d?.MdPath is null || !File.Exists(d.MdPath))
                    return Results.NotFound();
                return Results.Text(await File.ReadAllTextAsync(d.MdPath), "text/markdown");
            }
        );

        // Block list → the sync-scroll coordinate map for the viewer.
        g.MapGet(
            "/{id:long}/blocks",
            async (long id, ClaimsPrincipal user, DocumentRepository repo) =>
            {
                var d = await repo.GetByIdAsync(id, user.GetUserId());
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
            async (long id, ClaimsPrincipal user, DocumentRepository repo) =>
            {
                var d = await repo.GetByIdAsync(id, user.GetUserId());
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
            async (long id, ClaimsPrincipal user, DocumentRepository repo) =>
                Results.Ok(await repo.GetEventsAsync(id, user.GetUserId()))
        );

        // Direct drag-and-drop upload — stage the PDF into the archive, dedup, enqueue.
        // Bypasses the watcher entirely (written outside the watch dir). Owned by the uploader.
        g.MapPost(
                "/upload",
                async (
                    IFormFile file,
                    ClaimsPrincipal user,
                    DocumentRepository repo,
                    ProcessingQueue queue,
                    SettingsService settings
                ) =>
                {
                    var userId = user.GetUserId();
                    // Reject ingest when no conversion engine is selected (the default).
                    if (settings.For(userId).ConversionOff)
                        return Results.Problem(
                            detail: "No conversion engine selected — enable one in Settings.",
                            statusCode: StatusCodes.Status409Conflict
                        );
                    if (file is null || file.Length == 0)
                        return Results.BadRequest("empty file");
                    if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                        return Results.BadRequest("only .pdf files are accepted");

                    using var ms = new MemoryStream();
                    await file.CopyToAsync(ms);
                    return await IngestPdfAsync(
                        ms.ToArray(),
                        Path.GetFileName(file.FileName),
                        userId,
                        repo,
                        queue,
                        settings
                    );
                }
            )
            .DisableAntiforgery();

        // Mobile "scan with camera": phone uploads ordered (compressed) images, we stitch
        // them into one multi-page PDF and feed it into the normal pipeline. Images arrive
        // already downscaled/JPEG-encoded client-side (keeps payloads small, normalizes HEIC).
        g.MapPost(
                "/upload-photos",
                async (
                    HttpRequest request,
                    ClaimsPrincipal user,
                    DocumentRepository repo,
                    ProcessingQueue queue,
                    SettingsService settings
                ) =>
                {
                    var userId = user.GetUserId();
                    if (settings.For(userId).ConversionOff)
                        return Results.Problem(
                            detail: "No conversion engine selected — enable one in Settings.",
                            statusCode: StatusCodes.Status409Conflict
                        );
                    if (!request.HasFormContentType)
                        return Results.BadRequest("expected a multipart form");

                    var form = await request.ReadFormAsync();
                    var files = form.Files.GetFiles("files");
                    var images = new List<byte[]>();
                    foreach (var f in files)
                    {
                        if (f.Length == 0)
                            continue;
                        if (!(f.ContentType ?? "").StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                            return Results.BadRequest($"not an image: {f.FileName}");
                        using var ms = new MemoryStream();
                        await f.CopyToAsync(ms);
                        images.Add(ms.ToArray());
                    }
                    if (images.Count == 0)
                        return Results.BadRequest("no images");

                    byte[] pdf;
                    try
                    {
                        pdf = ImagePdf.FromImages(images);
                    }
                    catch (Exception ex)
                    {
                        return Results.Problem(
                            detail: $"could not build a PDF from the photos: {ex.Message}",
                            statusCode: StatusCodes.Status422UnprocessableEntity
                        );
                    }

                    var name = $"scan-{DateTime.UtcNow:yyyyMMdd-HHmmss}.pdf";
                    return await IngestPdfAsync(pdf, name, userId, repo, queue, settings);
                }
            )
            .DisableAntiforgery();

        // Delete a document and all its artifacts (scoped to the owner).
        g.MapDelete(
            "/{id:long}",
            async (long id, ClaimsPrincipal user, DocumentRepository repo) =>
                await repo.DeleteAsync(id, user.GetUserId()) ? Results.NoContent() : Results.NotFound()
        );

        // Batch delete — only the caller's own documents are removed.
        g.MapPost(
            "/delete",
            async (DeleteBatchRequest req, ClaimsPrincipal user, DocumentRepository repo) =>
            {
                var userId = user.GetUserId();
                var deleted = 0;
                foreach (var id in req.Ids)
                    if (await repo.DeleteAsync(id, userId))
                        deleted++;
                return Results.Ok(new { deleted });
            }
        );

        // Replace a document's tags (manual tag editing from the detail page).
        g.MapPatch(
            "/{id:long}/tags",
            async (long id, UpdateTagsRequest req, ClaimsPrincipal user, DocumentRepository repo) =>
            {
                var userId = user.GetUserId();
                if (await repo.GetByIdAsync(id, userId) is null)
                    return Results.NotFound();
                var tags = (req.Tags ?? [])
                    .Select(t => t.Trim())
                    .Where(t => t.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                await repo.UpdateTagsAsync(id, tags);
                return Results.Ok(await repo.GetByIdAsync(id, userId));
            }
        );

        // Overwrite a document's Markdown — manual cleanup of marker's occasional bloat
        // (repeated-word runs on scanned pages). The body is the full .md INCLUDING the
        // invisible sync-scroll anchors, so preserving them keeps PDF↔MD scroll aligned.
        // We rewrite the file and refresh the FTS search content with the anchor-stripped text.
        g.MapPatch(
            "/{id:long}/markdown",
            async (long id, UpdateMarkdownRequest req, ClaimsPrincipal user, DocumentRepository repo) =>
            {
                var userId = user.GetUserId();
                var d = await repo.GetByIdAsync(id, userId);
                if (d?.MdPath is null || !File.Exists(d.MdPath))
                    return Results.NotFound();
                if (req.Content is null)
                    return Results.BadRequest("content is required");

                var editedAt = DateTime.UtcNow;
                await File.WriteAllTextAsync(d.MdPath, req.Content);
                await repo.RecordMarkdownEditAsync(id, Helpers.StripAnchors(req.Content), editedAt);
                await repo.AddEventAsync(id, "info", "edit", "Markdown edited");
                d.MarkdownEditedAt = editedAt; // reflect in the returned doc (drives the badge)
                return Results.Ok(d);
            }
        );

        // Requeue a failed (or any) document.
        g.MapPost(
            "/{id:long}/retry",
            async (long id, ClaimsPrincipal user, DocumentRepository repo, ProcessingQueue queue) =>
            {
                if (await repo.GetByIdAsync(id, user.GetUserId()) is null)
                    return Results.NotFound();
                await repo.SetStatusAsync(id, DocumentStatus.Queued);
                await queue.EnqueueAsync(id);
                return Results.Accepted($"/api/documents/{id}");
            }
        );

        // Re-create the parsing from scratch: delete the existing outputs and re-run the
        // full pipeline against the archived PDF. Works on any status (incl. Done), unlike
        // /retry which just requeues whatever's on disk.
        g.MapPost(
            "/{id:long}/reconvert",
            async (long id, ClaimsPrincipal user, DocumentRepository repo, ProcessingQueue queue) =>
            {
                var d = await repo.GetByIdAsync(id, user.GetUserId());
                if (d is null)
                    return Results.NotFound();

                // Best-effort wipe of on-disk outputs; the pipeline rewrites them.
                try
                {
                    if (d.LayoutJsonPath is { } lp && File.Exists(lp))
                        File.Delete(lp);
                }
                catch { /* leave orphan rather than fail */ }
                var mdDir = d.MdPath is { } mp ? Path.GetDirectoryName(mp) : null;
                try
                {
                    if (mdDir is not null && Directory.Exists(mdDir))
                        Directory.Delete(mdDir, recursive: true);
                }
                catch { /* leave orphan rather than fail */ }

                await repo.ResetForReconvertAsync(id);
                await repo.AddEventAsync(id, "info", "convert", "Re-parsing requested");
                await queue.EnqueueAsync(id);
                return Results.Accepted($"/api/documents/{id}");
            }
        );

        // Edit a document: rename the display name and/or replace its category set in one go.
        // Display-name only — the slug and artifacts stay put (see UpdateNameAsync).
        g.MapPatch(
            "/{id:long}",
            async (
                long id,
                UpdateDocumentRequest req,
                ClaimsPrincipal user,
                DocumentRepository repo,
                CategoryRepository cats
            ) =>
            {
                var userId = user.GetUserId();
                if (await repo.GetByIdAsync(id, userId) is null)
                    return Results.NotFound();

                if (!string.IsNullOrWhiteSpace(req.OriginalName))
                    await repo.UpdateNameAsync(id, req.OriginalName.Trim());
                if (req.CategoryIds is not null)
                    await cats.SetForDocumentAsync(id, req.CategoryIds, userId);

                return Results.Ok(await repo.GetByIdAsync(id, userId));
            }
        );

        // Enrich ONE document (re-reads saved Markdown, no reconvert). Frontend-triggered.
        g.MapPost(
            "/{id:long}/reenrich",
            async (long id, ClaimsPrincipal user, DocumentRepository repo, EnrichmentService enrich) =>
            {
                var d = await repo.GetByIdAsync(id, user.GetUserId());
                if (d is null)
                    return Results.NotFound();
                return await enrich.EnrichAsync(d)
                    ? Results.Ok(d)
                    : Results.Problem(
                        detail: "Enrichment failed — check the LLM provider in Settings "
                            + "(Ollama running / API key valid / model set) and the api logs.",
                        statusCode: 503
                    );
            }
        );

        // Batch enrichment — the frontend selects N of the caller's documents and triggers tagging.
        // Sequential on purpose: enrichment shares one LLM, no point fanning out.
        g.MapPost(
            "/enrich",
            async (EnrichBatchRequest req, ClaimsPrincipal user, DocumentRepository repo, EnrichmentService enrich) =>
            {
                var userId = user.GetUserId();
                var results = new List<object>();
                foreach (var id in req.Ids)
                {
                    var d = await repo.GetByIdAsync(id, userId);
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
                            error = ok ? null : "no markdown or LLM failed",
                        }
                    );
                }
                return Results.Ok(results);
            }
        );
    }

    /// <summary>Shared ingest tail for /upload and /upload-photos: sha256 dedup (resume if
    /// incomplete), stage the PDF in the vault archive, insert the row, enqueue.</summary>
    private static async Task<IResult> IngestPdfAsync(
        byte[] bytes,
        string name,
        long userId,
        DocumentRepository repo,
        ProcessingQueue queue,
        SettingsService settings
    )
    {
        var sha = Helpers.Sha256Hex(bytes);
        var existing = await repo.GetByShaAsync(sha, userId);
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
            OwnerUserId = userId,
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
        return Results.Ok(await repo.GetByIdAsync(id, userId));
    }
}

/// <summary>Request body for POST /api/documents/enrich.</summary>
public record EnrichBatchRequest(long[] Ids);

/// <summary>Request body for POST /api/documents/delete.</summary>
public record DeleteBatchRequest(long[] Ids);

/// <summary>Request body for PATCH /api/documents/{id}/tags.</summary>
public record UpdateTagsRequest(string[]? Tags);

/// <summary>Request body for PATCH /api/documents/{id}/markdown — the full edited .md text.</summary>
public record UpdateMarkdownRequest(string? Content);

/// <summary>Request body for PATCH /api/documents/{id} — rename and/or set categories.
/// Both fields optional: null CategoryIds leaves categories untouched; an empty array clears them.</summary>
public record UpdateDocumentRequest(string? OriginalName, long[]? CategoryIds);
