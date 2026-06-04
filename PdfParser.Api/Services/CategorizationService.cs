using PdfParser.Api.Clients;
using PdfParser.Api.Data;
using PdfParser.Api.Models;
using PdfParser.Api.Util;

namespace PdfParser.Api.Services;

/// <summary>
/// LLM-driven auto-categorization: ask Ollama which existing categories apply to a
/// document and assign them. Only assigns categories that already exist (the model
/// is constrained to the provided list).
/// </summary>
public class CategorizationService(CategoryRepository cats, LlmService llm)
{
    public async Task<string[]> AutoCategorizeAsync(Document d, CancellationToken ct = default)
    {
        if (d.MdPath is null || !File.Exists(d.MdPath))
            return [];

        var uid = d.OwnerUserId ?? 0;
        var categories = (await cats.ListAsync(uid)).ToList();
        if (categories.Count == 0)
            return [];

        var text = Helpers.StripAnchors(await File.ReadAllTextAsync(d.MdPath, ct));
        var chosen = await llm.ClassifyAsync(
            uid,
            text,
            categories.Select(c => c.Name).ToList(),
            ct
        );
        if (chosen is null)
            return [];

        var byName = categories
            .GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var assigned = new List<string>();
        foreach (var name in chosen)
        {
            if (byName.TryGetValue(name, out var cat))
            {
                await cats.AssignAsync(d.Id, cat.Id);
                assigned.Add(cat.Name);
            }
        }
        return assigned.ToArray();
    }
}
