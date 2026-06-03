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
    MarkerHealthMonitor health,
    SettingsService settings,
    EnrichmentService enrichment,
    IHubContext<LiveHub> hub,
    ILogger<PipelineWorker> logger
) : BackgroundService
{
    // How long a doc waits before we re-check an unavailable marker. The health probe is
    // TTL-cached, so many waiting docs don't translate into a probe storm.
    private static readonly TimeSpan RequeueDelay = TimeSpan.FromSeconds(15);

    private CancellationToken _stopping;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _stopping = stoppingToken;
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
        var doc = await repo.GetByIdInternalAsync(id);
        if (doc is null)
            return;

        var owner = doc.OwnerUserId ?? 0;
        var us = settings.For(owner);
        // A fresh ingest sits in the OWNER's watched folder.
        var watchDir = us.WatchDir;
        var vaultDir = settings.VaultDir;

        // ── Engine gate ────────────────────────────────────────────────────
        // OFF: defensive only — ingest is rejected upstream, but a setting flipped to OFF
        // after a doc was already queued lands here. Mark Failed (retryable once re-enabled).
        if (us.ConversionOff)
        {
            await repo.SetStatusAsync(id, DocumentStatus.Failed, "No conversion engine selected");
            await repo.AddEventAsync(id, "error", "convert", "Conversion is disabled — pick an engine in Settings.");
            await Broadcast(owner, id, DocumentStatus.Failed, doc.OriginalName, ct);
            return;
        }

        var markerUrl = us.ResolvedMarkerUrl;

        // Health-gate the marker engines: if the server is unreachable, DON'T fail — leave the
        // doc Queued, re-enqueue after a delay, and it converts automatically once marker returns.
        if (us.UsesMarker && !await health.IsHealthyAsync(markerUrl, ct))
        {
            await repo.SetStatusAsync(id, DocumentStatus.Queued);
            await repo.AddEventAsync(id, "warn", "convert", $"Marker unavailable ({markerUrl}) — waiting…");
            await Broadcast(owner, id, DocumentStatus.Queued, doc.OriginalName, ct);
            ScheduleRequeue(id);
            return;
        }

        // On a fresh ingest the file is in the watch dir; on a retry it's the archive.
        var watchPath = Path.Combine(watchDir, doc.OriginalName);
        var sourcePath = File.Exists(watchPath)
            ? watchPath
            : doc.ArchivedPdfPath is { } a && File.Exists(a) ? a : watchPath;

        var sw = Stopwatch.StartNew();
        await repo.SetStatusAsync(id, DocumentStatus.Processing);
        await repo.AddEventAsync(id, "info", "convert", $"Processing {doc.OriginalName} ({us.ConversionEngine})");
        await Broadcast(owner, id, DocumentStatus.Processing, doc.OriginalName, ct);

        try
        {
            if (!File.Exists(sourcePath))
                throw new FileNotFoundException($"source PDF not found: {sourcePath}");

            var bytes = await File.ReadAllBytesAsync(sourcePath, ct);

            // 1. Convert ----------------------------------------------------
            // pdfplumber → lightweight /extract; marker-host / marker-remote → full /convert.
            var result = us.ConversionEngine == "pdfplumber"
                ? await marker.ExtractAsync(markerUrl, bytes, doc.OriginalName, ct)
                : await marker.ConvertAsync(markerUrl, bytes, doc.OriginalName, ct);

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
            await Broadcast(owner, id, DocumentStatus.Done, doc.OriginalName, ct);
            logger.LogInformation(
                "Converted {Name} (#{Id}) in {Ms} ms",
                doc.OriginalName,
                id,
                sw.ElapsedMilliseconds
            );

            // 5. Optional best-effort auto-enrich ---------------------------
            if (settings.For(owner).AutoEnrich)
            {
                if (await enrichment.EnrichAsync(doc, ct))
                {
                    await repo.AddEventAsync(id, "info", "enrich", "Auto-enriched");
                    await Broadcast(owner, id, DocumentStatus.Done, doc.OriginalName, ct);
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
            await Broadcast(owner, id, DocumentStatus.Failed, doc.OriginalName, ct);
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

    /// <summary>Re-enqueue a doc after a delay (used when its marker engine is offline) so it
    /// retries — and auto-resumes — without burning the worker on a hot loop. Uses the worker's
    /// stop token so pending re-queues drain cleanly on shutdown.</summary>
    private void ScheduleRequeue(long id) =>
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(RequeueDelay, _stopping);
                await queue.EnqueueAsync(id, _stopping);
            }
            catch (OperationCanceledException) { /* shutting down */ }
        });

    private Task Broadcast(long ownerUserId, long id, DocumentStatus status, string name, CancellationToken ct) =>
        hub.Clients.User(ownerUserId.ToString()).SendAsync(
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
