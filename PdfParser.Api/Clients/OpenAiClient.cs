using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PdfParser.Api.Data;
using PdfParser.Api.Models;

namespace PdfParser.Api.Clients;

/// <summary>
/// Enrichment/classification/summarization via any OpenAI-compatible Chat Completions
/// API (OpenRouter, OpenAI, Google Gemini's OpenAI endpoint, Groq, …). Base URL + model
/// come from live settings; the API key is read from the encrypted secrets store by the
/// name in settings (openaiApiKeyName). Mirrors OllamaClient's contract; best-effort —
/// any failure returns null. Structured output is requested via response_format
/// json_object plus an explicit key list in the system prompt (broadest compatibility).
/// </summary>
public class OpenAiClient(
    HttpClient http,
    SettingsService settings,
    SecretsService secrets,
    ILogger<OpenAiClient> logger
)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private const string EnrichSchemaHint =
        "\n\nReturn a SINGLE JSON object with EXACTLY these keys: "
        + "title (string), doc_type (string), language (string, ISO 639-1), "
        + "parties (array of strings), doc_date (string, yyyy-mm-dd or empty), "
        + "doc_number (string), tags (array of strings), summary (string).";

    public async Task<EnrichResult?> EnrichAsync(string text, CancellationToken ct)
    {
        var content = await ChatAsync(settings.EnrichPrompt + EnrichSchemaHint, text, ct);
        if (string.IsNullOrWhiteSpace(content))
            return null;
        try
        {
            return JsonSerializer.Deserialize<EnrichResult>(ExtractJsonObject(content), Json);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "OpenAI enrich: could not parse JSON response");
            return null;
        }
    }

    public async Task<string[]?> ClassifyAsync(
        string text,
        IReadOnlyList<string> categories,
        CancellationToken ct
    )
    {
        if (categories.Count == 0)
            return [];
        var sys =
            "You assign a document to categories. Choose ONLY from this exact list: "
            + string.Join(", ", categories)
            + ". Respond with JSON {\"categories\": [...]} containing the matching names "
            + "(possibly empty). Never invent names outside the list.";
        var content = await ChatAsync(sys, text, ct);
        if (string.IsNullOrWhiteSpace(content))
            return null;
        try
        {
            return JsonSerializer
                .Deserialize<ClassifyResult>(ExtractJsonObject(content), Json)
                ?.Categories?.ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "OpenAI classify: could not parse JSON response");
            return null;
        }
    }

    public async Task<string?> SummarizeAsync(string text, CancellationToken ct)
    {
        var content = await ChatAsync(settings.SummaryPrompt, text, ct);
        return string.IsNullOrWhiteSpace(content) ? null : content.Trim();
    }

    /// <summary>Connectivity + auth check: GET {base}/models with the configured key.</summary>
    public async Task<LlmTestResult> TestAsync(CancellationToken ct)
    {
        var baseUrl = settings.OpenAiBaseUrl.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            return new LlmTestResult(false, "No API base URL configured.");
        var key = secrets.Reveal(settings.OpenAiApiKeyName);
        if (string.IsNullOrWhiteSpace(key))
            return new LlmTestResult(false, $"No secret named '{settings.OpenAiApiKeyName}' found.");
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/models");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
            using var resp = await http.SendAsync(req, ct);
            return resp.IsSuccessStatusCode
                ? new LlmTestResult(true, $"{settings.OpenAiModel} via {baseUrl}")
                : new LlmTestResult(false, $"HTTP {(int)resp.StatusCode} from {baseUrl}/models");
        }
        catch (Exception ex)
        {
            return new LlmTestResult(false, ex.Message);
        }
    }

    /// <summary>One chat completion. Returns the assistant message content, or null.</summary>
    private async Task<string?> ChatAsync(string system, string text, CancellationToken ct)
    {
        var baseUrl = settings.OpenAiBaseUrl.TrimEnd('/');
        var key = secrets.Reveal(settings.OpenAiApiKeyName);
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(key))
        {
            logger.LogWarning("OpenAI provider not configured (base URL or API key missing)");
            return null;
        }
        try
        {
            var excerpt = text.Length > 6000 ? text[..6000] : text;
            // Deliberately NO response_format: many OpenAI-compatible providers (notably
            // Gemini via OpenRouter) return 400 on {type:"json_object"}. We demand JSON in
            // the prompt and extract it from the reply instead (ExtractJsonObject).
            var payload = new
            {
                model = settings.OpenAiModel,
                temperature = 0,
                messages = new[]
                {
                    new { role = "system", content = system },
                    new { role = "user", content = excerpt },
                },
            };

            using var req = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/chat/completions")
            {
                Content = JsonContent.Create(payload),
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

            using var resp = await http.SendAsync(req, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
            {
                // Surface the provider's actual error message (not just the status code).
                logger.LogWarning(
                    "OpenAI chat {Status}: {Body}",
                    (int)resp.StatusCode,
                    body.Length > 600 ? body[..600] : body
                );
                return null;
            }
            var parsed = JsonSerializer.Deserialize<ChatResponse>(body, Json);
            return parsed?.Choices?.FirstOrDefault()?.Message?.Content;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "OpenAI chat call failed; continuing without it");
            return null;
        }
    }

    /// <summary>
    /// Pull a JSON object out of a model reply that may be wrapped in ```fences``` or
    /// padded with prose — we don't rely on the provider's structured-output mode.
    /// </summary>
    private static string ExtractJsonObject(string content)
    {
        var s = content.Trim();
        if (s.StartsWith("```"))
        {
            var nl = s.IndexOf('\n');
            if (nl >= 0)
                s = s[(nl + 1)..];
            if (s.EndsWith("```"))
                s = s[..^3];
            s = s.Trim();
        }
        var start = s.IndexOf('{');
        var end = s.LastIndexOf('}');
        return start >= 0 && end > start ? s[start..(end + 1)] : s;
    }

    private sealed class ClassifyResult
    {
        [JsonPropertyName("categories")]
        public List<string>? Categories { get; set; }
    }

    private sealed class ChatResponse
    {
        [JsonPropertyName("choices")]
        public List<Choice>? Choices { get; set; }
    }

    private sealed class Choice
    {
        [JsonPropertyName("message")]
        public ChatMessage? Message { get; set; }
    }

    private sealed class ChatMessage
    {
        [JsonPropertyName("content")]
        public string? Content { get; set; }
    }
}

/// <summary>Result of a provider connectivity test.</summary>
public record LlmTestResult(bool Ok, string? Detail);
