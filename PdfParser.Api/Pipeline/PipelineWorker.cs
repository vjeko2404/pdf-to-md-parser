using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using PdfParser.Api.Clients;
using PdfParser.Api.Data;
using PdfParser.Api.Hubs;
using PdfParser.Api.Models;
using PdfParser.Api.Services;
using PdfParser.Api.Util;

namespace PdfParser.Api.Pipeline;

/// <summary>
/// Consumes queued document ids and runs the pipeline serially:
/// convert (marker) → write artifacts → archive original → commit.
/// Enrichment is a SEPARATE on-demand step (POST /reenrich, /enrich) so a slow or
/// broken LLM never blocks a conversion — unless the autoEnrich setting is on, in
/// which case it runs as a best-effort tail step.
/// One bad PDF never kills the worker; it is marked Failed and LEFT IN PLACE so it
/// can be retried (POST /retry) once the cause is fixed.
/// </summary>
public class PipelineWorker(
    ProcessingQueue queue,
    DocumentRepository repo,
    MarkerClient marker,
    SettingsService settings,
    EnrichmentService enrichment,
    IHubContext<LiveHub> hub,
    ILogger<PipelineWorker> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var id in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await ProcessAsync(id, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Unhandled pipeline error for doc {Id}", id);
            }
        }
    }

    private async Task ProcessAsync(long id, CancellationToken ct)
    {
        var doc = await repo.GetByIdAsync(id);
        if (doc is null)
            return;

        var watchDir = settings.WatchDir;
        var vaultDir = settings.VaultDir;

        // On a fresh ingest the file is in the watch dir; on a retry it's the archive.
        var watchPath = Path.Combine(watchDir, doc.OriginalName);
        var sourcePath = File.Exists(watchPath)
            ? watchPath
            : doc.ArchivedPdfPath is { } a && File.Exists(a) ? a : watchPath;

        var sw = Stopwatch.StartNew();
        await repo.SetStatusAsync(id, DocumentStatus.Processing);
        await repo.AddEventAsync(id, "info", "convert", $"Processing {doc.OriginalName}");
        await Broadcast(id, DocumentStatus.Processing, doc.OriginalName, ct);

        try
        {
            if (!File.Exists(sourcePath))
                throw new FileNotFoundException($"source PDF not found: {sourcePath}");

            var bytes = await File.ReadAllBytesAsync(sourcePath, ct);

            // 1. Convert ----------------------------------------------------
            var result = await marker.ConvertAsync(bytes, doc.OriginalName, ct);

            var mdDir = Path.Combine(vaultDir, "markdown", doc.Slug);
            Directory.CreateDirectory(mdDir);
            var mdPath = Path.Combine(mdDir, $"{doc.Slug}.md");
            await File.WriteAllTextAsync(mdPath, result.Markdown, ct);

            await WriteImagesAsync(mdDir, result.Images, ct);

            var metaDir = Path.Combine(vaultDir, "meta");
            Directory.CreateDirectory(metaDir);
            var blocksPath = Path.Combine(metaDir, $"{doc.Slug}.blocks.json");
            await File.WriteAllTextAsync(blocksPath, JsonSerializer.Serialize(result.Blocks), ct);

            doc.MdPath = mdPath;
            doc.LayoutJsonPath = blocksPath;
            doc.Pages = result.PageCount;

            // 2. Plain text for FTS. (Enrichment is a separate on-demand step.)
            var plain = Helpers.StripAnchors(result.Markdown);

            // 3. Archive original out of the watch dir ----------------------
            if (Helpers.IsInside(sourcePath, watchDir))
            {
                var pdfDir = Path.Combine(vaultDir, "pdf");
                Directory.CreateDirectory(pdfDir);
                var archivePath = Helpers.UniquePath(Path.Combine(pdfDir, doc.OriginalName));
                File.Move(sourcePath, archivePath);
                doc.ArchivedPdfPath = archivePath;
            }

            // 4. Commit -----------------------------------------------------
            doc.Status = DocumentStatus.Done;
            doc.ProcessedAt = DateTime.UtcNow;
            doc.DurationMs = sw.ElapsedMilliseconds;
            await repo.SaveResultAsync(doc, plain);

            await repo.AddEventAsync(id, "info", "done", $"Done in {sw.ElapsedMilliseconds} ms");
            await Broadcast(id, DocumentStatus.Done, doc.OriginalName, ct);
            logger.LogInformation(
                "Converted {Name} (#{Id}) in {Ms} ms",
                doc.OriginalName,
                id,
                sw.ElapsedMilliseconds
            );

            // 5. Optional best-effort auto-enrich ---------------------------
            if (settings.AutoEnrich)
            {
                if (await enrichment.EnrichAsync(doc, ct))
                {
                    await repo.AddEventAsync(id, "info", "enrich", "Auto-enriched");
                    await Broadcast(id, DocumentStatus.Done, doc.OriginalName, ct);
                }
                else
                {
                    await repo.AddEventAsync(id, "warn", "enrich", "Auto-enrich skipped/failed");
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Conversion failed for {Name}", doc.OriginalName);
            await repo.SetStatusAsync(id, DocumentStatus.Failed, ex.Message);
            await repo.AddEventAsync(id, "error", "convert", ex.Message);
            // Leave the original in place — keeps it retryable.
            await Broadcast(id, DocumentStatus.Failed, doc.OriginalName, ct);
        }
    }

    private async Task WriteImagesAsync(
        string mdDir,
        Dictionary<string, string> images,
        CancellationToken ct
    )
    {
        if (images.Count == 0)
            return;
        var imgDir = Path.Combine(mdDir, "images");
        Directory.CreateDirectory(imgDir);
        foreach (var (name, b64) in images)
        {
            try
            {
                var safe = Path.GetFileName(name);
                await File.WriteAllBytesAsync(
                    Path.Combine(imgDir, safe),
                    Convert.FromBase64String(b64),
                    ct
                );
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "image {Name} skipped", name);
            }
        }
    }

    private Task Broadcast(long id, DocumentStatus status, string name, CancellationToken ct) =>
        hub.Clients.All.SendAsync(
            "documentUpdated",
            new
            {
                id,
                status = status.ToString(),
                name,
            },
            ct
        );
}
