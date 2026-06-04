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
    private bool UseOpenAi(long userId) => settings.For(userId).UseOpenAi;

    public Task<EnrichResult?> EnrichAsync(long userId, string text, CancellationToken ct) =>
        UseOpenAi(userId)
            ? openai.EnrichAsync(userId, text, ct)
            : ollama.EnrichAsync(userId, text, ct);

    public Task<string[]?> ClassifyAsync(
        long userId,
        string text,
        IReadOnlyList<string> categories,
        CancellationToken ct
    ) =>
        UseOpenAi(userId)
            ? openai.ClassifyAsync(userId, text, categories, ct)
            : ollama.ClassifyAsync(userId, text, categories, ct);

    public Task<string?> SummarizeAsync(long userId, string text, CancellationToken ct) =>
        UseOpenAi(userId)
            ? openai.SummarizeAsync(userId, text, ct)
            : ollama.SummarizeAsync(userId, text, ct);

    /// <summary>Test the user's currently-selected provider (for the Settings "Test" button).</summary>
    public async Task<LlmTestResult> TestAsync(long userId, CancellationToken ct)
    {
        if (UseOpenAi(userId))
            return await openai.TestAsync(userId, ct);
        var s = await admin.StatusAsync(userId, ct);
        return new LlmTestResult(s.Online, s.Online ? $"Ollama {s.Version}" : s.Error);
    }

    /// <summary>Model ids for the user's active provider (for the Settings model picker). [] on failure.</summary>
    public async Task<IReadOnlyList<string>> ListModelsAsync(long userId, CancellationToken ct)
    {
        try
        {
            if (UseOpenAi(userId))
                return await openai.ListModelsAsync(userId, ct);
            var models = await admin.ListModelsAsync(userId, ct);
            return models.Select(m => m.Name).ToList();
        }
        catch
        {
            return [];
        }
    }
}
