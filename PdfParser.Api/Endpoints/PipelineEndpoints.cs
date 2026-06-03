using Microsoft.AspNetCore.SignalR;
using PdfParser.Api.Hubs;
using PdfParser.Api.Pipeline;

namespace PdfParser.Api.Endpoints;

/// <summary>Controls the shared processing pipeline. Pause/resume is process-wide
/// (single-user-first) and broadcast over SignalR so every open tab reflects it.</summary>
public static class PipelineEndpoints
{
    public static void MapPipelineEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/pipeline").WithTags("Pipeline");

        g.MapGet("/status", (ProcessingQueue queue) => Results.Ok(new { paused = queue.IsPaused }));

        g.MapPost(
            "/pause",
            async (ProcessingQueue queue, IHubContext<LiveHub> hub) =>
            {
                queue.Pause();
                await hub.Clients.All.SendAsync("pipelineState", new { paused = true });
                return Results.Ok(new { paused = true });
            }
        );

        g.MapPost(
            "/resume",
            async (ProcessingQueue queue, IHubContext<LiveHub> hub) =>
            {
                queue.Resume();
                await hub.Clients.All.SendAsync("pipelineState", new { paused = false });
                return Results.Ok(new { paused = false });
            }
        );
    }
}
