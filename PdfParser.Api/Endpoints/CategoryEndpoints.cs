using System.Security.Claims;
using PdfParser.Api.Auth;
using PdfParser.Api.Data;
using PdfParser.Api.Services;

namespace PdfParser.Api.Endpoints;

public static class CategoryEndpoints
{
    public static void MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/categories").WithTags("Categories");

        g.MapGet(
            "/",
            async (ClaimsPrincipal user, CategoryRepository repo) =>
                Results.Ok(await repo.ListAsync(user.GetUserId()))
        );

        g.MapPost(
            "/",
            async (CategoryUpsert body, ClaimsPrincipal user, CategoryRepository repo) =>
            {
                if (string.IsNullOrWhiteSpace(body.Name))
                    return Results.BadRequest("name required");
                var id = await repo.CreateAsync(user.GetUserId(), body.Name.Trim(), body.Color);
                return Results.Created($"/api/categories/{id}", new { id });
            }
        );

        g.MapPatch(
            "/{id:long}",
            async (long id, CategoryUpsert body, ClaimsPrincipal user, CategoryRepository repo) =>
            {
                await repo.UpdateAsync(user.GetUserId(), id, body.Name.Trim(), body.Color);
                return Results.NoContent();
            }
        );

        g.MapDelete(
            "/{id:long}",
            async (long id, ClaimsPrincipal user, CategoryRepository repo) =>
            {
                await repo.DeleteAsync(user.GetUserId(), id);
                return Results.NoContent();
            }
        );

        // Per-document assignment — both the document and the category must be the caller's.
        var d = app.MapGroup("/api/documents/{id:long}/categories").WithTags("Categories");

        d.MapGet(
            "/",
            async (
                long id,
                ClaimsPrincipal user,
                DocumentRepository docs,
                CategoryRepository repo
            ) =>
            {
                if (await docs.GetByIdAsync(id, user.GetUserId()) is null)
                    return Results.NotFound();
                return Results.Ok(await repo.ForDocumentAsync(id));
            }
        );

        d.MapPost(
            "/",
            async (
                long id,
                AssignCategory body,
                ClaimsPrincipal user,
                DocumentRepository docs,
                CategoryRepository repo
            ) =>
            {
                var userId = user.GetUserId();
                if (await docs.GetByIdAsync(id, userId) is null)
                    return Results.NotFound();
                if (!await repo.OwnsAsync(userId, body.CategoryId))
                    return Results.NotFound();
                await repo.AssignAsync(id, body.CategoryId);
                return Results.NoContent();
            }
        );

        d.MapDelete(
            "/{categoryId:long}",
            async (
                long id,
                long categoryId,
                ClaimsPrincipal user,
                DocumentRepository docs,
                CategoryRepository repo
            ) =>
            {
                if (await docs.GetByIdAsync(id, user.GetUserId()) is null)
                    return Results.NotFound();
                await repo.UnassignAsync(id, categoryId);
                return Results.NoContent();
            }
        );

        // LLM auto-categorize — assign existing categories the model deems matching.
        d.MapPost(
            "/auto",
            async (
                long id,
                ClaimsPrincipal user,
                DocumentRepository docs,
                CategorizationService svc
            ) =>
            {
                var doc = await docs.GetByIdAsync(id, user.GetUserId());
                if (doc is null)
                    return Results.NotFound();
                var assigned = await svc.AutoCategorizeAsync(doc);
                return Results.Ok(new { assigned });
            }
        );
    }
}

public record CategoryUpsert(string Name, string? Color);

public record AssignCategory(long CategoryId);
