using Dapper;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;
using PdfParser.Api.Config;

namespace PdfParser.Api.Data;

/// <summary>
/// Live, frontend-editable settings — now PER USER. The settings table is keyed
/// (UserId, Key); env/compose seeds each user's defaults the first time they're touched.
/// UserId 0 holds GLOBAL app settings (currently only <c>registrationEnabled</c>).
///
/// Components read a user's effective values through <see cref="For"/>, which returns a
/// lightweight <see cref="UserSettings"/> accessor. Container-shape values (VaultDir,
/// MarkerUrl, WatchRoot) stay global and immutable at runtime.
/// </summary>
public class SettingsService(Database db, IOptions<AppOptions> options)
{
    public const long GlobalUserId = 0;

    private readonly AppOptions _opt = options.Value;
    private readonly Lock _lock = new();
    private Dictionary<(long UserId, string Key), string> _cache = new();

    /// <summary>Raised after settings change; carries the affected user id (or
    /// <see cref="GlobalUserId"/>) so the watcher can repoint just that tenant.</summary>
    public event Action<long>? Changed;

    // Container-shape values (not editable at runtime).
    public string VaultDir => _opt.VaultDir;
    public string MarkerUrl => _opt.MarkerUrl;
    public string WatchRoot => _opt.WatchRoot;

    /// <summary>Per-user defaults seeded from env on first touch.</summary>
    internal Dictionary<string, string> UserDefaults() =>
        new()
        {
            ["watchSubdir"] = _opt.WatchSubdir,
            ["watchEnabled"] = "false",
            ["ollamaUrl"] = _opt.OllamaUrl,
            ["ollamaModel"] = _opt.OllamaModel,
            ["enrichPrompt"] = _opt.EnrichPrompt,
            ["summaryPrompt"] = _opt.SummaryPrompt,
            ["debounceSeconds"] = _opt.DebounceSeconds.ToString(),
            ["autoEnrich"] = "false",
            ["enrichmentEnabled"] = "true",
            ["autoCategorize"] = "false",
            ["llmProvider"] = "ollama",
            ["openaiBaseUrl"] = "",
            ["openaiModel"] = "",
            ["openaiApiKeyName"] = "LLM_API_KEY",
            ["conversionEngine"] = _opt.ConversionEngine,
            ["markerRemoteUrl"] = _opt.MarkerRemoteUrl,
        };

    /// <summary>Load the whole table into cache and ensure global defaults exist.</summary>
    public void Load()
    {
        using var c = db.Open();
        var cache = c.Query<(long UserId, string Key, string Value)>(
                "SELECT UserId, Key, Value FROM settings"
            )
            .ToDictionary(r => (r.UserId, r.Key), r => r.Value);

        // Global app defaults.
        if (!cache.ContainsKey((GlobalUserId, "registrationEnabled")))
        {
            Persist(c, GlobalUserId, "registrationEnabled", "true");
            cache[(GlobalUserId, "registrationEnabled")] = "true";
        }

        lock (_lock)
            _cache = cache;
    }

    /// <summary>Seed a freshly-created user's per-user settings (fills only missing keys).</summary>
    public void SeedUserDefaults(long userId)
    {
        using var c = db.Open();
        lock (_lock)
        {
            foreach (var (k, v) in UserDefaults())
            {
                if (!_cache.ContainsKey((userId, k)))
                {
                    Persist(c, userId, k, v);
                    _cache[(userId, k)] = v;
                }
            }
        }
    }

    public string Get(long userId, string key, string fallback = "")
    {
        lock (_lock)
            return _cache.TryGetValue((userId, key), out var v) ? v : fallback;
    }

    /// <summary>A user's effective settings (defaults overlaid with their stored values).
    /// Excludes global keys. Drives GET /api/settings.</summary>
    public IReadOnlyDictionary<string, string> All(long userId)
    {
        var result = UserDefaults();
        lock (_lock)
            foreach (var ((uid, key), value) in _cache)
                if (uid == userId)
                    result[key] = value;
        return result;
    }

    public void Update(long userId, IDictionary<string, string> updates)
    {
        using var c = db.Open();
        foreach (var (k, v) in updates)
            Persist(c, userId, k, v);
        lock (_lock)
        {
            foreach (var (k, v) in updates)
                _cache[(userId, k)] = v;
        }
        Changed?.Invoke(userId);
    }

    // ── Global app settings (UserId 0) ───────────────────────────────────────
    public bool RegistrationEnabled => Get(GlobalUserId, "registrationEnabled", "true") == "true";

    public void SetRegistrationEnabled(bool enabled) =>
        Update(GlobalUserId, new Dictionary<string, string> { ["registrationEnabled"] = enabled ? "true" : "false" });

    /// <summary>Per-user category-seed guard (so user-deleted defaults don't reappear).</summary>
    public bool CategoriesSeeded(long userId) => Get(userId, "categoriesSeeded", "false") == "true";

    public void MarkCategoriesSeeded(long userId) =>
        Update(userId, new Dictionary<string, string> { ["categoriesSeeded"] = "true" });

    /// <summary>Effective per-user accessor.</summary>
    public UserSettings For(long userId) => new(this, userId, _opt);

    private static void Persist(SqliteConnection c, long userId, string key, string value) =>
        c.Execute(
            """
            INSERT INTO settings (UserId, Key, Value, UpdatedAt) VALUES (@userId, @key, @value, @ts)
            ON CONFLICT(UserId, Key) DO UPDATE SET Value = @value, UpdatedAt = @ts;
            """,
            new
            {
                userId,
                key,
                value,
                ts = DateTime.UtcNow,
            }
        );
}

/// <summary>
/// A single user's effective settings — the per-user equivalent of the old global
/// accessor properties. Resolves each value from the (userId, key) cache with the
/// env-seeded fallback, so it stays correct even before <c>SeedUserDefaults</c> runs.
/// </summary>
public sealed class UserSettings(SettingsService s, long userId, AppOptions opt)
{
    public long UserId => userId;

    public string WatchSubdir => s.Get(userId, "watchSubdir", opt.WatchSubdir);
    public string WatchDir => Path.Combine(opt.WatchRoot, WatchSubdir);
    public bool WatchEnabled => s.Get(userId, "watchEnabled", "false") == "true";

    public string OllamaUrl => s.Get(userId, "ollamaUrl", opt.OllamaUrl);
    public string OllamaModel => s.Get(userId, "ollamaModel", opt.OllamaModel);
    public string EnrichPrompt => s.Get(userId, "enrichPrompt", opt.EnrichPrompt);
    public string SummaryPrompt => s.Get(userId, "summaryPrompt", opt.SummaryPrompt);
    public bool AutoEnrich => s.Get(userId, "autoEnrich", "false") == "true";

    public string LlmProvider => s.Get(userId, "llmProvider", "ollama");
    public string OpenAiBaseUrl => s.Get(userId, "openaiBaseUrl", "");
    public string OpenAiModel => s.Get(userId, "openaiModel", "");
    public string OpenAiApiKeyName => s.Get(userId, "openaiApiKeyName", "LLM_API_KEY");

    public bool UseOpenAi =>
        LlmProvider.Equals("openai", StringComparison.OrdinalIgnoreCase)
        && !string.IsNullOrWhiteSpace(OpenAiBaseUrl);

    public bool EnrichmentEnabled => s.Get(userId, "enrichmentEnabled", "true") == "true";
    public bool AutoCategorize => s.Get(userId, "autoCategorize", "false") == "true";

    // ── Conversion engine ─────────────────────────────────────────────────────
    /// <summary>off | marker-host | marker-remote | pdfplumber. Default OFF.</summary>
    public string ConversionEngine => s.Get(userId, "conversionEngine", opt.ConversionEngine);

    /// <summary>The off-VPS marker base URL (only meaningful for marker-remote).</summary>
    public string MarkerRemoteUrl => s.Get(userId, "markerRemoteUrl", opt.MarkerRemoteUrl);

    /// <summary>True when no conversion engine is selected — ingest is rejected.</summary>
    public bool ConversionOff =>
        ConversionEngine.Equals("off", StringComparison.OrdinalIgnoreCase)
        || string.IsNullOrWhiteSpace(ConversionEngine);

    /// <summary>True for the two marker modes (need a reachable marker server).</summary>
    public bool UsesMarker =>
        ConversionEngine is "marker-host" or "marker-remote";

    /// <summary>The marker base URL this user's engine targets: the local container for
    /// marker-host and pdfplumber (its /extract lives there), the user URL for marker-remote.
    /// Empty when conversion is OFF.</summary>
    public string ResolvedMarkerUrl =>
        ConversionEngine switch
        {
            "marker-remote" => MarkerRemoteUrl.Trim(),
            "marker-host" or "pdfplumber" => opt.MarkerUrl,
            _ => "",
        };

    public int DebounceSeconds =>
        int.TryParse(s.Get(userId, "debounceSeconds", opt.DebounceSeconds.ToString()), out var n)
            ? n
            : opt.DebounceSeconds;
}
