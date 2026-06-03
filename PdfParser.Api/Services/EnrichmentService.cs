using System.Text.Json;
using PdfParser.Api.Clients;
using PdfParser.Api.Data;
using PdfParser.Api.Models;
using PdfParser.Api.Util;

namespace PdfParser.Api.Services;

/// <summary>
/// Shared, on-demand enrichment: read a document's saved Markdown, ask Ollama for
/// structured metadata, persist it. Used by the manual endpoints (/reenrich, /enrich)
/// and optionally by the pipeline when the autoEnrich setting is on.
/// </summary>
public class EnrichmentService(
    DocumentRepository repo,
    OllamaClient ollama,
    SettingsService settings,
    CategorizationService categorization
)
{
    /// <summary>
    /// Returns false if enrichment is disabled, the doc has no Markdown yet, or
    /// Ollama is unavailable.
    /// </summary>
    public async Task<bool> EnrichAsync(Document d, CancellationToken ct = default)
    {
        if (!settings.EnrichmentEnabled)
            return false;
        if (d.MdPath is null || !File.Exists(d.MdPath))
            return false;

        var plain = Helpers.StripAnchors(await File.ReadAllTextAsync(d.MdPath, ct));
        var enrich = await ollama.EnrichAsync(plain, ct);
        if (enrich is null)
            return false;

        d.DocType = enrich.DocType;
        d.Language = enrich.Language;
        d.DocDate = enrich.DocDate;
        d.DocNumber = enrich.DocNumber;
        d.Summary = enrich.Summary;
        d.TagsJson = JsonSerializer.Serialize(enrich.Tags);
        d.PartiesJson = JsonSerializer.Serialize(enrich.Parties);
        await repo.SaveResultAsync(d, plain);

        if (settings.AutoCategorize)
            await categorization.AutoCategorizeAsync(d, ct);
        return true;
    }
}
