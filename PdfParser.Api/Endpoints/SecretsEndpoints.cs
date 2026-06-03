using System.Security.Claims;
using PdfParser.Api.Auth;
using PdfParser.Api.Data;

namespace PdfParser.Api.Endpoints;

public static class SecretsEndpoints
{
    public static void MapSecretsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/secrets").WithTags("Secrets");

        // Masked list (never returns plaintext) — only the caller's own secrets.
        g.MapGet("/", (ClaimsPrincipal user, SecretsService s) => Results.Ok(s.List(user.GetUserId())));

        // Explicit reveal of a single secret.
        g.MapGet(
            "/{key}/reveal",
            (string key, ClaimsPrincipal user, SecretsService s) =>
                s.Reveal(user.GetUserId(), key) is { } v
                    ? Results.Ok(new { key, value = v })
                    : Results.NotFound()
        );

        // Create/update.
        g.MapPut(
            "/",
            (SecretPut body, ClaimsPrincipal user, SecretsService s) =>
            {
                if (string.IsNullOrWhiteSpace(body.Key))
                    return Results.BadRequest("key required");
                s.Set(user.GetUserId(), body.Key, body.Value ?? "");
                return Results.NoContent();
            }
        );

        g.MapDelete(
            "/{key}",
            (string key, ClaimsPrincipal user, SecretsService s) =>
            {
                s.Delete(user.GetUserId(), key);
                return Results.NoContent();
            }
        );
    }
}

public record SecretPut(string Key, string? Value);
