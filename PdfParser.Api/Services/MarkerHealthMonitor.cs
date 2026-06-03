using System.Collections.Concurrent;

namespace PdfParser.Api.Services;

/// <summary>
/// Caches the reachability of marker servers (keyed by base URL) so the pipeline can
/// health-gate conversions without hammering /health on every document. A probe result
/// is trusted for <see cref="Ttl"/>; after that the next <see cref="IsHealthyAsync"/>
/// re-probes. Used to PAUSE/RESUME processing (re-queue, never fail) when an off-VPS
/// marker is down and to resume automatically when it returns.
/// </summary>
public sealed class MarkerHealthMonitor(IHttpClientFactory httpFactory)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(10);

    private readonly ConcurrentDictionary<string, (bool Healthy, DateTime At)> _cache = new();

    /// <summary>Last known health for a URL without probing (for the status endpoint).
    /// Null = never probed yet.</summary>
    public bool? LastKnown(string baseUrl) =>
        _cache.TryGetValue(Normalize(baseUrl), out var e) ? e.Healthy : null;

    public async Task<bool> IsHealthyAsync(string baseUrl, CancellationToken ct)
    {
        var url = Normalize(baseUrl);
        if (string.IsNullOrEmpty(url))
            return false;

        if (_cache.TryGetValue(url, out var cached) && DateTime.UtcNow - cached.At < Ttl)
            return cached.Healthy;

        var healthy = await ProbeAsync(url, ct);
        _cache[url] = (healthy, DateTime.UtcNow);
        return healthy;
    }

    private async Task<bool> ProbeAsync(string url, CancellationToken ct)
    {
        try
        {
            using var client = httpFactory.CreateClient("marker-health");
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(5));
            using var resp = await client.GetAsync($"{url}/health", cts.Token);
            return resp.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static string Normalize(string? baseUrl) =>
        string.IsNullOrWhiteSpace(baseUrl) ? "" : baseUrl.Trim().TrimEnd('/');
}
