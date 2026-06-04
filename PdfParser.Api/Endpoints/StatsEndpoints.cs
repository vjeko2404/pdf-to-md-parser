using System.Security.Claims;
using PdfParser.Api.Auth;
using PdfParser.Api.Data;
using PdfParser.Api.Services;

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

        // Current conversion engine + live marker reachability for the caller — drives the
        // Settings panel's status line and any "marker offline" UI.
        app.MapGet(
                "/api/conversion/status",
                async (
                    ClaimsPrincipal user,
                    SettingsService settings,
                    MarkerHealthMonitor health,
                    CancellationToken ct
                ) =>
                {
                    var s = settings.For(user.GetUserId());
                    var url = s.ResolvedMarkerUrl;
                    bool? healthy = string.IsNullOrEmpty(url)
                        ? null
                        : await health.IsHealthyAsync(url, ct);
                    return Results.Ok(
                        new
                        {
                            engine = s.ConversionEngine,
                            markerUrl = url,
                            healthy,
                        }
                    );
                }
            )
            .WithTags("Dashboard");

        // Health is public (used by container probes / uptime checks).
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }))
            .AllowAnonymous()
            .WithTags("Dashboard");
    }
}
