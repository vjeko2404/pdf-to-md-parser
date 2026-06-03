using PdfParser.Api.Clients;

namespace PdfParser.Api.Endpoints;

public static class OllamaEndpoints
{
    public static void MapOllamaEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/ollama").WithTags("Ollama");

        // Online? version? — drives the UI's Ollama status indicator.
        g.MapGet(
            "/status",
            async (OllamaAdmin o, CancellationToken ct) => Results.Ok(await o.StatusAsync(ct))
        );

        // Installed models (for the model dropdown).
        g.MapGet(
            "/models",
            async (OllamaAdmin o, CancellationToken ct) =>
            {
                try
                {
                    return Results.Ok(await o.ListModelsAsync(ct));
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
            async (OllamaAdmin o, CancellationToken ct) =>
            {
                try
                {
                    return Results.Ok(await o.LoadedAsync(ct));
                }
                catch (Exception ex)
                {
                    return Results.Problem($"Ollama unreachable: {ex.Message}");
                }
            }
        );

        // Pull a model — returns immediately; progress streams over SignalR "ollamaPull".
        g.MapPost(
            "/pull",
            (PullRequest req, OllamaAdmin o) =>
            {
                if (string.IsNullOrWhiteSpace(req.Name))
                    return Results.BadRequest("name required");
                _ = o.PullAsync(req.Name, CancellationToken.None); // fire-and-forget; UI watches the hub
                return Results.Accepted();
            }
        );

        g.MapDelete(
            "/models/{name}",
            async (string name, OllamaAdmin o, CancellationToken ct) =>
            {
                try
                {
                    await o.DeleteModelAsync(name, ct);
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
