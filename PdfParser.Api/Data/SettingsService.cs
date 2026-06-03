using Dapper;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;
using PdfParser.Api.Config;

namespace PdfParser.Api.Data;

/// <summary>
/// Live, frontend-editable settings backed by the settings table. Env/compose seeds
/// the defaults on first run; the DB is the source of truth thereafter. Components
/// read effective values from here (not IOptions) so changes take effect at runtime.
/// </summary>
public class SettingsService(Database db, IOptions<AppOptions> options)
{
    private readonly AppOptions _opt = options.Value;
    private readonly Lock _lock = new();
    private Dictionary<string, string> _cache = new();

    /// <summary>Raised after settings change (e.g. so the watcher repoints).</summary>
    public event Action? Changed;

    // Container-shape values (not editable at runtime).
    public string VaultDir => _opt.VaultDir;
    public string MarkerUrl => _opt.MarkerUrl;
    public string WatchRoot => _opt.WatchRoot;

    // Effective, live values.
    public string WatchDir => Path.Combine(_opt.WatchRoot, Get("watchSubdir", _opt.WatchSubdir));
    public string OllamaUrl => Get("ollamaUrl", _opt.OllamaUrl);
    public string OllamaModel => Get("ollamaModel", _opt.OllamaModel);
    public string EnrichPrompt => Get("enrichPrompt", _opt.EnrichPrompt);
    public bool AutoEnrich => Get("autoEnrich", "false") == "true";

    /// <summary>Master switch — when off, the app never calls Ollama at all.</summary>
    public bool EnrichmentEnabled => Get("enrichmentEnabled", "true") == "true";

    /// <summary>Auto-assign existing categories via the LLM after enrichment.</summary>
    public bool AutoCategorize => Get("autoCategorize", "false") == "true";

    public int DebounceSeconds =>
        int.TryParse(Get("debounceSeconds", _opt.DebounceSeconds.ToString()), out var n)
            ? n
            : _opt.DebounceSeconds;

    /// <summary>Load from DB, seeding any missing keys from env defaults.</summary>
    public void Load()
    {
        using var c = db.Open();
        var cache = c.Query<(string Key, string Value)>("SELECT Key, Value FROM settings")
            .ToDictionary(r => r.Key, r => r.Value);

        var defaults = new Dictionary<string, string>
        {
            ["watchSubdir"] = _opt.WatchSubdir,
            ["ollamaUrl"] = _opt.OllamaUrl,
            ["ollamaModel"] = _opt.OllamaModel,
            ["enrichPrompt"] = _opt.EnrichPrompt,
            ["debounceSeconds"] = _opt.DebounceSeconds.ToString(),
            ["autoEnrich"] = "false",
            ["enrichmentEnabled"] = "true",
            ["autoCategorize"] = "false",
        };
        foreach (var (k, v) in defaults)
        {
            if (!cache.ContainsKey(k))
            {
                Persist(c, k, v);
                cache[k] = v;
            }
        }
        lock (_lock)
            _cache = cache;
    }

    public string Get(string key, string fallback = "")
    {
        lock (_lock)
            return _cache.TryGetValue(key, out var v) ? v : fallback;
    }

    public IReadOnlyDictionary<string, string> All()
    {
        lock (_lock)
            return new Dictionary<string, string>(_cache);
    }

    public void Update(IDictionary<string, string> updates)
    {
        using var c = db.Open();
        foreach (var (k, v) in updates)
            Persist(c, k, v);
        lock (_lock)
        {
            foreach (var (k, v) in updates)
                _cache[k] = v;
        }
        Changed?.Invoke();
    }

    private static void Persist(SqliteConnection c, string key, string value) =>
        c.Execute(
            """
            INSERT INTO settings (Key, Value, UpdatedAt) VALUES (@key, @value, @ts)
            ON CONFLICT(Key) DO UPDATE SET Value = @value, UpdatedAt = @ts;
            """,
            new
            {
                key,
                value,
                ts = DateTime.UtcNow,
            }
        );
}
