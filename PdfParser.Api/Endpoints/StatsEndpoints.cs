using System.Security.Claims;
using PdfParser.Api.Auth;
using PdfParser.Api.Data;

namespace PdfParser.Api.Endpoints;

public static class StatsEndpoints
{
    public static void MapStatsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet(
                "/api/stats",
                async (ClaimsPrincipal user, DocumentRepository repo) =>
                    Results.Ok(await repo.StatsAsync(user.GetUserId()))
            )
            .WithTags("Dashboard");

        app.MapGet(
                "/api/events",
                async (ClaimsPrincipal user, DocumentRepository repo) =>
                    Results.Ok(await repo.GetEventsAsync(null, user.GetUserId()))
            )
            .WithTags("Dashboard");

        app.MapGet(
                "/api/facets",
                async (ClaimsPrincipal user, DocumentRepository repo) =>
                    Results.Ok(await repo.FacetsAsync(user.GetUserId()))
            )
            .WithTags("Dashboard");

        // Health is public (used by container probes / uptime checks).
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }))
            .AllowAnonymous()
            .WithTags("Dashboard");
    }
}
