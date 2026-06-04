using System.Security.Claims;
using PdfParser.Api.Auth;
using PdfParser.Api.Clients;
using PdfParser.Api.Data;
using PdfParser.Api.Services;

namespace PdfParser.Api.Endpoints;

public static class SettingsEndpoints
{
    // Keys the settings endpoint must never let a client write directly: global app
    // settings and internal bookkeeping flags live outside the per-user editable surface.
    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "registrationEnabled",
        "categoriesSeeded",
    };

    public static void MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet(
                "/api/settings",
                (ClaimsPrincipal user, SettingsService s) => Results.Ok(s.All(user.GetUserId()))
            )
            .WithTags("Settings");

        // Test the caller's currently-selected LLM provider (Ollama or OpenAI-compatible API).
        app.MapGet(
                "/api/settings/llm-test",
                async (ClaimsPrincipal user, LlmService llm, CancellationToken ct) =>
                    Results.Ok(await llm.TestAsync(user.GetUserId(), ct))
            )
            .WithTags("Settings");

        // Model ids for the caller's active provider — feeds the model picker in Settings.
        app.MapGet(
                "/api/settings/llm-models",
                async (ClaimsPrincipal user, LlmService llm, CancellationToken ct) =>
                    Results.Ok(await llm.ListModelsAsync(user.GetUserId(), ct))
            )
            .WithTags("Settings");

        // Probe a marker server's /health (DRAFT url from the field, like the Ollama test) —
        // powers the "Test connection" button for the off-VPS marker engine.
        app.MapGet(
                "/api/settings/marker-test",
                async (string? url, MarkerClient marker, CancellationToken ct) =>
                {
                    var target = (url ?? "").Trim();
                    if (string.IsNullOrEmpty(target))
                        return Results.Ok(new MarkerTestResult(false, "no URL provided"));
                    var ok = await marker.IsHealthyAsync(target, ct);
                    return Results.Ok(new MarkerTestResult(ok, ok ? "reachable" : "unreachable"));
                }
            )
            .WithTags("Settings");

        // Partial update — body is a {key: value} map. Triggers a live reload (e.g. the
        // watcher repoints if watchSubdir/watchEnabled changed). Reserved keys are dropped.
        app.MapPatch(
                "/api/settings",
                (Dictionary<string, string> updates, ClaimsPrincipal user, SettingsService s) =>
                {
                    var userId = user.GetUserId();
                    var clean = updates
                        .Where(kv => !Reserved.Contains(kv.Key))
                        .ToDictionary(kv => kv.Key, kv => kv.Value);
                    if (clean.Count > 0)
                        s.Update(userId, clean);
                    return Results.Ok(s.All(userId));
                }
            )
            .WithTags("Settings");
    }
}

/// <summary>Result of GET /api/settings/marker-test.</summary>
public record MarkerTestResult(bool Ok, string Detail);
