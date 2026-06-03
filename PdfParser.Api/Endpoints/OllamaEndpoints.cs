using System.Security.Claims;
using PdfParser.Api.Auth;
using PdfParser.Api.Clients;

namespace PdfParser.Api.Endpoints;

public static class OllamaEndpoints
{
    public static void MapOllamaEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/ollama").WithTags("Ollama");

        // Online? version? — drives the UI's status indicator. Optional ?url= tests
        // an arbitrary (unsaved) server, powering the Settings "Test connection" button.
        // Uses the caller's configured Ollama URL.
        g.MapGet(
            "/status",
            async (ClaimsPrincipal user, OllamaAdmin o, string? url, CancellationToken ct) =>
                Results.Ok(await o.StatusAsync(user.GetUserId(), ct, url))
        );

        // Installed models (for the model dropdown).
        g.MapGet(
            "/models",
            async (ClaimsPrincipal user, OllamaAdmin o, CancellationToken ct) =>
            {
                try
                {
                    return Results.Ok(await o.ListModelsAsync(user.GetUserId(), ct));
                }
                catch (Exception ex)
                {
                    return Results.Problem($"Ollama unreachable: {ex.Message}");
                }
            }
        );

        // Currently loaded-in-VRAM models.
        g.MapGet(
            "/ps",
            async (ClaimsPrincipal user, OllamaAdmin o, CancellationToken ct) =>
            {
                try
                {
                    return Results.Ok(await o.LoadedAsync(user.GetUserId(), ct));
                }
                catch (Exception ex)
                {
                    return Results.Problem($"Ollama unreachable: {ex.Message}");
                }
            }
        );

        // Pull a model — returns immediately; progress streams over SignalR "ollamaPull"
        // to the requesting user.
        g.MapPost(
            "/pull",
            (PullRequest req, ClaimsPrincipal user, OllamaAdmin o) =>
            {
                if (string.IsNullOrWhiteSpace(req.Name))
                    return Results.BadRequest("name required");
                _ = o.PullAsync(user.GetUserId(), req.Name, CancellationToken.None); // fire-and-forget
                return Results.Accepted();
            }
        );

        g.MapDelete(
            "/models/{name}",
            async (string name, ClaimsPrincipal user, OllamaAdmin o, CancellationToken ct) =>
            {
                try
                {
                    await o.DeleteModelAsync(user.GetUserId(), name, ct);
                    return Results.NoContent();
                }
                catch (Exception ex)
                {
                    return Results.Problem(ex.Message);
                }
            }
        );
    }
}

public record PullRequest(string Name);
