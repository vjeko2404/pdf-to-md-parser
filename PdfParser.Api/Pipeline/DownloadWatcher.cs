using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using PdfParser.Api.Data;
using PdfParser.Api.Hubs;
using PdfParser.Api.Models;
using PdfParser.Api.Util;

namespace PdfParser.Api.Pipeline;

/// <summary>
/// Per-user folder watching. Each user can enable a watched subfolder under the mounted
/// host root; this service keeps one <see cref="FileSystemWatcher"/> per such user and
/// attributes every ingested PDF to that owner. It reconciles on startup and whenever any
/// user's settings change (enable/disable/repoint), backfilling newly-watched folders.
///
/// Triggers on rename-into-place (browser .crdownload → .pdf) and direct creation, waits
/// until the file's size is stable, dedups by sha256 (per owner), then enqueues a Queued
/// document owned by that user.
/// </summary>
public class DownloadWatcher(
    ProcessingQueue queue,
    DocumentRepository repo,
    UserRepository users,
    SettingsService settings,
    IHubContext<LiveHub> hub,
    ILogger<DownloadWatcher> logger
) : BackgroundService
{
    private readonly Channel<Candidate> _candidates = Channel.CreateUnbounded<Candidate>();
    private readonly Dictionary<long, WatchEntry> _watchers = new();
    private readonly SemaphoreSlim _reconcileLock = new(1, 1);
    private CancellationToken _stopping;

    private record Candidate(string Path, long UserId);

    private sealed class WatchEntry(FileSystemWatcher fsw, string dir)
    {
        public FileSystemWatcher Fsw { get; } = fsw;
        public string Dir { get; } = dir;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _stopping = stoppingToken;
        settings.Changed += OnSettingsChanged;
        await ReconcileAsync();

        await foreach (var c in _candidates.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await IngestAsync(c.Path, c.UserId, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Ingest failed for {Path}", c.Path);
            }
        }
    }

    // Any settings change may have toggled/repointed a watch — reconcile all users.
    private void OnSettingsChanged(long affectedUserId) => _ = ReconcileAsync();

    /// <summary>(Re)build the set of active watchers to match each user's current settings.</summary>
    private async Task ReconcileAsync()
    {
        await _reconcileLock.WaitAsync();
        try
        {
            // Desired state: userId → watched dir, for every active user with watch enabled.
            var desired = new Dictionary<long, string>();
            foreach (var u in await users.ListAsync())
            {
                if (!u.IsActive)
                    continue;
                var s = settings.For(u.Id);
                if (s.WatchEnabled)
                    desired[u.Id] = s.WatchDir;
            }

            // Drop watchers that are no longer wanted or whose folder changed.
            foreach (var userId in _watchers.Keys.ToList())
            {
                if (!desired.TryGetValue(userId, out var dir) || dir != _watchers[userId].Dir)
                {
                    _watchers[userId].Fsw.Dispose();
                    _watchers.Remove(userId);
                }
            }

            // Add watchers (and backfill) for newly-wanted users/folders.
            foreach (var (userId, dir) in desired)
            {
                if (_watchers.ContainsKey(userId))
                    continue;
                StartWatching(userId, dir);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Watcher reconcile failed");
        }
        finally
        {
            _reconcileLock.Release();
        }
    }

    private void StartWatching(long userId, string dir)
    {
        Directory.CreateDirectory(dir);

        var fsw = new FileSystemWatcher(dir, "*.pdf")
        {
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.Size | NotifyFilters.LastWrite,
            IncludeSubdirectories = false,
            EnableRaisingEvents = true,
        };
        fsw.Created += (_, e) => _candidates.Writer.TryWrite(new Candidate(e.FullPath, userId));
        fsw.Renamed += (_, e) => _candidates.Writer.TryWrite(new Candidate(e.FullPath, userId));
        _watchers[userId] = new WatchEntry(fsw, dir);

        foreach (var path in Directory.EnumerateFiles(dir, "*.pdf"))
            _candidates.Writer.TryWrite(new Candidate(path, userId));

        logger.LogInformation("Watching {Dir} for user {UserId}", dir, userId);
    }

    private async Task IngestAsync(string path, long userId, CancellationToken ct)
    {
        var name = Path.GetFileName(path);
        if (name.StartsWith('.'))
            return;

        // No conversion engine selected → don't ingest watched files (matches the upload
        // rejection). The file is left in place; it gets picked up once an engine is enabled
        // and the folder is re-scanned (re-save the setting, or it backfills on reconcile).
        if (settings.For(userId).ConversionOff)
        {
            logger.LogDebug("Conversion OFF for user {UserId}; ignoring {Name}", userId, name);
            return;
        }

        if (!await WaitForStableAsync(path, userId, ct))
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
        var existing = await repo.GetByShaAsync(sha, userId);
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
            OwnerUserId = userId,
            Sha256 = sha,
            OriginalName = name,
            Slug = Helpers.Slugify(name),
            Status = DocumentStatus.Queued,
            CreatedAt = DateTime.UtcNow,
        };

        var id = await repo.InsertQueuedAsync(doc);
        await repo.AddEventAsync(id, "info", "queue", $"Queued {name}");
        await queue.EnqueueAsync(id, ct);
        await hub
            .Clients.User(userId.ToString())
            .SendAsync(
                "documentUpdated",
                new
                {
                    id,
                    status = "Queued",
                    name,
                },
                ct
            );
        logger.LogInformation("Queued {Name} (#{Id}) for user {UserId}", name, id, userId);
    }

    /// <summary>Wait until the file's size holds steady across the user's debounce window.</summary>
    private async Task<bool> WaitForStableAsync(string path, long userId, CancellationToken ct)
    {
        var window = TimeSpan.FromSeconds(Math.Max(1, settings.For(userId).DebounceSeconds));
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
        foreach (var w in _watchers.Values)
            w.Fsw.Dispose();
        _watchers.Clear();
        base.Dispose();
        GC.SuppressFinalize(this);
    }
}
