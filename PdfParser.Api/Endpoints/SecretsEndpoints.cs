using PdfParser.Api.Data;

namespace PdfParser.Api.Endpoints;

public static class SecretsEndpoints
{
    public static void MapSecretsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/secrets").WithTags("Secrets");

        // Masked list (never returns plaintext).
        g.MapGet("/", (SecretsService s) => Results.Ok(s.List()));

        // Explicit reveal of a single secret.
        g.MapGet(
            "/{key}/reveal",
            (string key, SecretsService s) =>
                s.Reveal(key) is { } v ? Results.Ok(new { key, value = v }) : Results.NotFound()
        );

        // Create/update.
        g.MapPut(
            "/",
            (SecretPut body, SecretsService s) =>
            {
                if (string.IsNullOrWhiteSpace(body.Key))
                    return Results.BadRequest("key required");
                s.Set(body.Key, body.Value ?? "");
                return Results.NoContent();
            }
        );

        g.MapDelete(
            "/{key}",
            (string key, SecretsService s) =>
            {
                s.Delete(key);
                return Results.NoContent();
            }
        );
    }
}

public record SecretPut(string Key, string? Value);
