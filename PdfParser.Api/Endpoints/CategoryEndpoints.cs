using PdfParser.Api.Data;
using PdfParser.Api.Services;

namespace PdfParser.Api.Endpoints;

public static class CategoryEndpoints
{
    public static void MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/categories").WithTags("Categories");

        g.MapGet("/", async (CategoryRepository repo) => Results.Ok(await repo.ListAsync()));

        g.MapPost(
            "/",
            async (CategoryUpsert body, CategoryRepository repo) =>
            {
                if (string.IsNullOrWhiteSpace(body.Name))
                    return Results.BadRequest("name required");
                var id = await repo.CreateAsync(body.Name.Trim(), body.Color);
                return Results.Created($"/api/categories/{id}", new { id });
            }
        );

        g.MapPatch(
            "/{id:long}",
            async (long id, CategoryUpsert body, CategoryRepository repo) =>
            {
                await repo.UpdateAsync(id, body.Name.Trim(), body.Color);
                return Results.NoContent();
            }
        );

        g.MapDelete(
            "/{id:long}",
            async (long id, CategoryRepository repo) =>
            {
                await repo.DeleteAsync(id);
                return Results.NoContent();
            }
        );

        // Per-document assignment.
        var d = app.MapGroup("/api/documents/{id:long}/categories").WithTags("Categories");

        d.MapGet("/", async (long id, CategoryRepository repo) => Results.Ok(await repo.ForDocumentAsync(id)));

        d.MapPost(
            "/",
            async (long id, AssignCategory body, CategoryRepository repo) =>
            {
                await repo.AssignAsync(id, body.CategoryId);
                return Results.NoContent();
            }
        );

        d.MapDelete(
            "/{categoryId:long}",
            async (long id, long categoryId, CategoryRepository repo) =>
            {
                await repo.UnassignAsync(id, categoryId);
                return Results.NoContent();
            }
        );

        // LLM auto-categorize — assign existing categories the model deems matching.
        d.MapPost(
            "/auto",
            async (long id, DocumentRepository docs, CategorizationService svc) =>
            {
                var doc = await docs.GetByIdAsync(id);
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
