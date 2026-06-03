using PdfParser.Api.Data;

namespace PdfParser.Api.Endpoints;

public static class FoldersEndpoints
{
    public static void MapFoldersEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/folders").WithTags("Folders");

        // Browse subfolders under the mounted WatchRoot (sandboxed — can't escape it).
        // The frontend uses this to pick the watched folder (the watchSubdir setting).
        g.MapGet(
            "/browse",
            (string? sub, SettingsService settings) =>
            {
                var root = Path.GetFullPath(settings.WatchRoot);
                var target = Path.GetFullPath(Path.Combine(root, sub ?? ""));
                if (!target.StartsWith(root, StringComparison.Ordinal) || !Directory.Exists(target))
                    return Results.BadRequest("invalid path");

                var dirs = Directory
                    .EnumerateDirectories(target)
                    .Select(d => new { name = Path.GetFileName(d), sub = Path.GetRelativePath(root, d) })
                    .Where(x => !x.name.StartsWith('.'))
                    .OrderBy(x => x.name, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return Results.Ok(
                    new
                    {
                        root,
                        current = Path.GetRelativePath(root, target),
                        parent = target == root ? null : Path.GetRelativePath(root, Path.GetDirectoryName(target)!),
                        dirs,
                    }
                );
            }
        );
    }
}
