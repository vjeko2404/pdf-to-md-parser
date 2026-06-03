using PdfParser.Api.Data;

namespace PdfParser.Api.Endpoints;

public static class StatsEndpoints
{
    public static void MapStatsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet(
                "/api/stats",
                async (DocumentRepository repo) => Results.Ok(await repo.StatsAsync())
            )
            .WithTags("Dashboard");

        app.MapGet(
                "/api/events",
                async (DocumentRepository repo) => Results.Ok(await repo.GetEventsAsync(null))
            )
            .WithTags("Dashboard");

        app.MapGet("/api/facets", async (DocumentRepository repo) => Results.Ok(await repo.FacetsAsync()))
            .WithTags("Dashboard");

        app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).WithTags("Dashboard");
    }
}
