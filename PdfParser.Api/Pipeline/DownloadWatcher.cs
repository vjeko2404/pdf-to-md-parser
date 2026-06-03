using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using PdfParser.Api.Data;
using PdfParser.Api.Hubs;
using PdfParser.Api.Models;
using PdfParser.Api.Util;

namespace PdfParser.Api.Pipeline;

/// <summary>
/// Watches the configured folder for new *.pdf files. Triggers on rename-into-place
/// (browser .crdownload → .pdf) and direct creation, waits until the file's size is
/// stable, dedups by sha256, then enqueues a Queued document. Backfills on startup
/// and REPOINTS live when the watched folder is changed in settings.
/// </summary>
public class DownloadWatcher(
    ProcessingQueue queue,
    DocumentRepository repo,
    SettingsService settings,
    IHubContext<LiveHub> hub,
    ILogger<DownloadWatcher> logger
) : BackgroundService
{
    private readonly Channel<string> _candidates = Channel.CreateUnbounded<string>();
    private FileSystemWatcher? _fsw;
    private string _currentDir = "";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        settings.Changed += OnSettingsChanged;
        StartWatching();

        await foreach (var path in _candidates.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await IngestAsync(path, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Ingest failed for {Path}", path);
            }
        }
    }

    private void OnSettingsChanged()
    {
        if (settings.WatchDir != _currentDir)
            StartWatching();
    }

    /// <summary>(Re)create the FileSystemWatcher on the current folder + backfill it.</summary>
    private void StartWatching()
    {
        var dir = settings.WatchDir;
        Directory.CreateDirectory(dir);

        _fsw?.Dispose();
        _fsw = new FileSystemWatcher(dir, "*.pdf")
        {
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.Size | NotifyFilters.LastWrite,
            IncludeSubdirectories = false,
            EnableRaisingEvents = true,
        };
        _fsw.Created += (_, e) => _candidates.Writer.TryWrite(e.FullPath);
        _fsw.Renamed += (_, e) => _candidates.Writer.TryWrite(e.FullPath);
        _currentDir = dir;

        foreach (var path in Directory.EnumerateFiles(dir, "*.pdf"))
            _candidates.Writer.TryWrite(path);

        logger.LogInformation("Watching {Dir} for new PDFs", dir);
    }

    private async Task IngestAsync(string path, CancellationToken ct)
    {
        var name = Path.GetFileName(path);
        if (name.StartsWith('.'))
            return;

        if (!await WaitForStableAsync(path, ct))
        {
            logger.LogWarning("File never stabilised, skipping: {Path}", path);
            return;
        }

        byte[] bytes;
        try
        {
            bytes = await File.ReadAllBytesAsync(path, ct);
        }
        catch (IOException)
        {
            return; // gone or still locked
        }

        var sha = Helpers.Sha256Hex(bytes);
        var existing = await repo.GetByShaAsync(sha);
        if (existing is not null)
        {
            // Only a finished doc is a true duplicate; incomplete work is resumed.
            if (existing.Status is DocumentStatus.Done or DocumentStatus.Skipped)
            {
                logger.LogInformation("Already processed, skipping: {Name}", name);
                return;
            }
            await repo.SetStatusAsync(existing.Id, DocumentStatus.Queued);
            await queue.EnqueueAsync(existing.Id, ct);
            logger.LogInformation("Resuming {Name} (#{Id})", name, existing.Id);
            return;
        }

        var doc = new Document
        {
            Sha256 = sha,
            OriginalName = name,
            Slug = Helpers.Slugify(name),
            Status = DocumentStatus.Queued,
            CreatedAt = DateTime.UtcNow,
        };

        var id = await repo.InsertQueuedAsync(doc);
        await repo.AddEventAsync(id, "info", "queue", $"Queued {name}");
        await queue.EnqueueAsync(id, ct);
        await hub.Clients.All.SendAsync("documentUpdated", new { id, status = "Queued", name }, ct);
        logger.LogInformation("Queued {Name} (#{Id})", name, id);
    }

    /// <summary>Wait until the file's size holds steady across the debounce window.</summary>
    private async Task<bool> WaitForStableAsync(string path, CancellationToken ct)
    {
        var window = TimeSpan.FromSeconds(Math.Max(1, settings.DebounceSeconds));
        long last = -1;
        for (var attempt = 0; attempt < 60; attempt++)
        {
            long len;
            try
            {
                if (!File.Exists(path))
                {
                    await Task.Delay(window, ct);
                    continue;
                }
                len = new FileInfo(path).Length;
            }
            catch (IOException)
            {
                await Task.Delay(window, ct);
                continue;
            }

            if (len > 0 && len == last)
                return true;
            last = len;
            await Task.Delay(window, ct);
        }
        return false;
    }

    public override void Dispose()
    {
        settings.Changed -= OnSettingsChanged;
        _fsw?.Dispose();
        base.Dispose();
        GC.SuppressFinalize(this);
    }
}
