using System.Security.Claims;
using PdfParser.Api.Auth;
using PdfParser.Api.Data;
using PdfParser.Api.Models;
using PdfParser.Api.Services;

namespace PdfParser.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/auth").WithTags("Auth");

        // ── Public ────────────────────────────────────────────────────────────
        g.MapPost(
                "/register",
                async (RegisterRequest req, AuthService auth) =>
                {
                    var r = await auth.RegisterAsync(req);
                    return r.Ok ? Results.Ok(r.Response) : Results.Problem(r.Error, statusCode: r.Status);
                }
            )
            .AllowAnonymous();

        g.MapPost(
                "/login",
                async (LoginRequest req, AuthService auth) =>
                {
                    var r = await auth.LoginAsync(req);
                    return r.Ok ? Results.Ok(r.Response) : Results.Problem(r.Error, statusCode: r.Status);
                }
            )
            .AllowAnonymous();

        // Whether self-registration is currently open — lets the login screen show/hide
        // the "Register" link without auth.
        g.MapGet(
                "/registration",
                async (SettingsService s, UserRepository users) =>
                    // Always open before the first user exists (bootstraps the admin).
                    Results.Ok(new { enabled = s.RegistrationEnabled || await users.CountAsync() == 0 })
            )
            .AllowAnonymous();

        // ── Authenticated (any user) ────────────────────────────────────────────
        g.MapGet(
            "/me",
            async (ClaimsPrincipal user, UserRepository users) =>
            {
                var u = await users.GetByIdAsync(user.GetUserId());
                return u is null ? Results.Unauthorized() : Results.Ok(AuthService.ToInfo(u));
            }
        );

        g.MapPost(
            "/change-password",
            async (ChangePasswordRequest req, ClaimsPrincipal user, AuthService auth) =>
            {
                var r = await auth.ChangePasswordAsync(user.GetUserId(), req);
                return r.Ok ? Results.Ok(r.Response) : Results.Problem(r.Error, statusCode: r.Status);
            }
        );

        // ── Admin only ────────────────────────────────────────────────────────
        // Toggle self-registration (the admin's one extra privilege).
        g.MapPatch(
                "/registration",
                (RegistrationToggle body, SettingsService s) =>
                {
                    s.SetRegistrationEnabled(body.Enabled);
                    return Results.Ok(new { enabled = s.RegistrationEnabled });
                }
            )
            .RequireAuthorization("Admin");

        g.MapGet(
                "/users",
                async (UserRepository users) =>
                    Results.Ok((await users.ListAsync()).Select(AuthService.ToInfo))
            )
            .RequireAuthorization("Admin");

        // Enable/disable an account (can't disable yourself — avoids locking the admin out).
        g.MapPatch(
                "/users/{id:long}/active",
                async (long id, SetActive body, ClaimsPrincipal user, UserRepository users) =>
                {
                    if (id == user.GetUserId())
                        return Results.BadRequest("You can't change your own active state.");
                    if (await users.GetByIdAsync(id) is null)
                        return Results.NotFound();
                    await users.SetActiveAsync(id, body.Active);
                    return Results.NoContent();
                }
            )
            .RequireAuthorization("Admin");
    }
}

public record RegistrationToggle(bool Enabled);

public record SetActive(bool Active);
