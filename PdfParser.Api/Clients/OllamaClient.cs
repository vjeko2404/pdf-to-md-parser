using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PdfParser.Api.Data;
using PdfParser.Api.Models;

namespace PdfParser.Api.Clients;

/// <summary>
/// Host Ollama (Vulkan) enrichment. URL + model come from live settings. Uses
/// structured outputs — we hand Ollama a JSON schema so it returns a validated
/// object, not prose. Best-effort: any failure returns null.
/// </summary>
public class OllamaClient(HttpClient http, SettingsService settings, ILogger<OllamaClient> logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<EnrichResult?> EnrichAsync(string text, CancellationToken ct)
    {
        try
        {
            var baseUrl = settings.OllamaUrl.TrimEnd('/');
            var excerpt = text.Length > 6000 ? text[..6000] : text;
            var payload = new
            {
                model = settings.OllamaModel,
                stream = false,
                format = Schema,
                messages = new[]
                {
                    new { role = "system", content = settings.EnrichPrompt },
                    new { role = "user", content = excerpt },
                },
            };

            using var resp = await http.PostAsJsonAsync($"{baseUrl}/api/chat", payload, ct);
            resp.EnsureSuccessStatusCode();

            var chat = await resp.Content.ReadFromJsonAsync<OllamaChatResponse>(Json, ct);
            var content = chat?.Message?.Content;
            if (string.IsNullOrWhiteSpace(content))
                return null;

            return JsonSerializer.Deserialize<EnrichResult>(content, Json);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Ollama enrichment failed; continuing without it");
            return null;
        }
    }

    /// <summary>
    /// Ask the model which of the given categories apply to the text. Returns the
    /// chosen names (a subset of <paramref name="categories"/>), or null on failure.
    /// </summary>
    public async Task<string[]?> ClassifyAsync(
        string text,
        IReadOnlyList<string> categories,
        CancellationToken ct
    )
    {
        if (categories.Count == 0)
            return [];
        try
        {
            var baseUrl = settings.OllamaUrl.TrimEnd('/');
            var excerpt = text.Length > 6000 ? text[..6000] : text;
            var sys =
                "You assign a document to categories. Choose ONLY from this exact list: "
                + string.Join(", ", categories)
                + ". Respond with JSON {\"categories\": [...]} containing the matching names "
                + "(possibly empty). Never invent names outside the list.";
            var payload = new
            {
                model = settings.OllamaModel,
                stream = false,
                format = ClassifySchema,
                messages = new[]
                {
                    new { role = "system", content = sys },
                    new { role = "user", content = excerpt },
                },
            };

            using var resp = await http.PostAsJsonAsync($"{baseUrl}/api/chat", payload, ct);
            resp.EnsureSuccessStatusCode();
            var chat = await resp.Content.ReadFromJsonAsync<OllamaChatResponse>(Json, ct);
            var content = chat?.Message?.Content;
            if (string.IsNullOrWhiteSpace(content))
                return null;
            return JsonSerializer.Deserialize<ClassifyResult>(content, Json)?.Categories?.ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Ollama classify failed");
            return null;
        }
    }

    /// <summary>
    /// Generate a prose summary using the (separate, editable) summary prompt.
    /// Plain text out — no JSON schema. Returns null on any failure.
    /// </summary>
    public async Task<string?> SummarizeAsync(string text, CancellationToken ct)
    {
        try
        {
            var baseUrl = settings.OllamaUrl.TrimEnd('/');
            var excerpt = text.Length > 6000 ? text[..6000] : text;
            var payload = new
            {
                model = settings.OllamaModel,
                stream = false,
                messages = new[]
                {
                    new { role = "system", content = settings.SummaryPrompt },
                    new { role = "user", content = excerpt },
                },
            };

            using var resp = await http.PostAsJsonAsync($"{baseUrl}/api/chat", payload, ct);
            resp.EnsureSuccessStatusCode();
            var chat = await resp.Content.ReadFromJsonAsync<OllamaChatResponse>(Json, ct);
            return chat?.Message?.Content?.Trim();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Ollama summarize failed");
            return null;
        }
    }

    private static readonly object ClassifySchema = new
    {
        type = "object",
        properties = new { categories = new { type = "array", items = new { type = "string" } } },
        required = new[] { "categories" },
    };

    private sealed class ClassifyResult
    {
        [JsonPropertyName("categories")]
        public List<string>? Categories { get; set; }
    }

    // JSON schema handed to Ollama's `format` field (structured outputs).
    private static readonly object Schema = new
    {
        type = "object",
        properties = new
        {
            title = new { type = "string" },
            doc_type = new { type = "string" },
            language = new { type = "string" },
            parties = new { type = "array", items = new { type = "string" } },
            doc_date = new { type = "string" },
            doc_number = new { type = "string" },
            tags = new { type = "array", items = new { type = "string" } },
            summary = new { type = "string" },
        },
        required = new[] { "title", "doc_type", "language", "tags", "summary" },
    };

    private sealed class OllamaChatResponse
    {
        [JsonPropertyName("message")]
        public OllamaMessage? Message { get; set; }
    }

    private sealed class OllamaMessage
    {
        [JsonPropertyName("content")]
        public string? Content { get; set; }
    }
}
