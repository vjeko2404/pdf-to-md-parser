using PdfParser.Api.Data;
using PdfParser.Api.Services;

namespace PdfParser.Api.Endpoints;

public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/settings", (SettingsService s) => Results.Ok(s.All()))
            .WithTags("Settings");

        // Test the currently-selected LLM provider (Ollama or the OpenAI-compatible API).
        app.MapGet(
                "/api/settings/llm-test",
                async (LlmService llm, CancellationToken ct) => Results.Ok(await llm.TestAsync(ct))
            )
            .WithTags("Settings");

        // Partial update — body is a {key: value} map. Triggers a live reload
        // (e.g. the watcher repoints if watchSubdir changed).
        app.MapPatch(
                "/api/settings",
                (Dictionary<string, string> updates, SettingsService s) =>
                {
                    s.Update(updates);
                    return Results.Ok(s.All());
                }
            )
            .WithTags("Settings");
    }
}
