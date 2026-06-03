using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using PdfParser.Api.Clients;
using PdfParser.Api.Data;
using PdfParser.Api.Hubs;
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
    LlmService llm,
    SettingsService settings,
    CategorizationService categorization,
    IHubContext<LiveHub> hub
)
{
    /// <summary>
    /// Returns false if enrichment is disabled, the doc has no Markdown yet, or
    /// Ollama is unavailable.
    /// </summary>
    public async Task<bool> EnrichAsync(Document d, CancellationToken ct = default)
    {
        var uid = d.OwnerUserId ?? 0;
        var s = settings.For(uid);
        if (!s.EnrichmentEnabled)
            return false;
        if (d.MdPath is null || !File.Exists(d.MdPath))
            return false;

        var plain = Helpers.StripAnchors(await File.ReadAllTextAsync(d.MdPath, ct));
        var enrich = await llm.EnrichAsync(uid, plain, ct);
        if (enrich is null)
            return false;

        d.DocType = enrich.DocType;
        d.Language = enrich.Language;
        d.DocDate = enrich.DocDate;
        d.DocNumber = enrich.DocNumber;
        d.TagsJson = JsonSerializer.Serialize(enrich.Tags);
        d.PartiesJson = JsonSerializer.Serialize(enrich.Parties);

        // Dedicated summary pass with its own editable prompt — a fuller, prose
        // summary than the terse one bundled in the metadata schema. Falls back to
        // the inline summary if the dedicated call yields nothing.
        var summary = await llm.SummarizeAsync(uid, plain, ct);
        d.Summary = !string.IsNullOrWhiteSpace(summary) ? summary : enrich.Summary;

        await repo.SaveResultAsync(d, plain);

        if (s.AutoCategorize)
            await categorization.AutoCategorizeAsync(d, ct);

        // Push a live update so the dashboard refreshes this row the instant its
        // tags/summary land — crucial for batch enrich, where the HTTP call only
        // returns once every doc is done.
        await hub.Clients.User(uid.ToString()).SendAsync(
            "documentUpdated",
            new
            {
                id = d.Id,
                status = d.Status.ToString(),
                name = d.OriginalName,
            },
            ct
        );
        return true;
    }
}
