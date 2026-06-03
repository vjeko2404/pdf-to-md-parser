using PdfParser.Api.Clients;
using PdfParser.Api.Data;
using PdfParser.Api.Models;

namespace PdfParser.Api.Services;

/// <summary>
/// Routes enrichment/classification/summarization to the active LLM provider —
/// local Ollama or any OpenAI-compatible API — based on the live `llmProvider`
/// setting. Callers (EnrichmentService, CategorizationService) depend on this and
/// never need to know which provider is in play. Switching is instant: the next
/// call reads the current setting.
/// </summary>
public class LlmService(
    OllamaClient ollama,
    OpenAiClient openai,
    OllamaAdmin admin,
    SettingsService settings
)
{
    private bool UseOpenAi => settings.UseOpenAi;

    public Task<EnrichResult?> EnrichAsync(string text, CancellationToken ct) =>
        UseOpenAi ? openai.EnrichAsync(text, ct) : ollama.EnrichAsync(text, ct);

    public Task<string[]?> ClassifyAsync(
        string text,
        IReadOnlyList<string> categories,
        CancellationToken ct
    ) => UseOpenAi ? openai.ClassifyAsync(text, categories, ct) : ollama.ClassifyAsync(text, categories, ct);

    public Task<string?> SummarizeAsync(string text, CancellationToken ct) =>
        UseOpenAi ? openai.SummarizeAsync(text, ct) : ollama.SummarizeAsync(text, ct);

    /// <summary>Test the currently-selected provider (for the Settings "Test" button).</summary>
    public async Task<LlmTestResult> TestAsync(CancellationToken ct)
    {
        if (UseOpenAi)
            return await openai.TestAsync(ct);
        var s = await admin.StatusAsync(ct);
        return new LlmTestResult(s.Online, s.Online ? $"Ollama {s.Version}" : s.Error);
    }
}
