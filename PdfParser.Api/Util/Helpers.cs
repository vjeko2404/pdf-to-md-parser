using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace PdfParser.Api.Util;

public static partial class Helpers
{
    public static string Sha256Hex(byte[] data) =>
        Convert.ToHexString(SHA256.HashData(data)).ToLowerInvariant();

    public static string Slugify(string name)
    {
        var stem = Path.GetFileNameWithoutExtension(name).ToLowerInvariant();
        var slug = MultiDash().Replace(NonAlnum().Replace(stem, "-"), "-").Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "document" : slug;
    }

    /// <summary>Drop the invisible sync-scroll anchors so FTS/LLM see clean text.</summary>
    public static string StripAnchors(string markdown) => AnchorTag().Replace(markdown, "");

    /// <summary>Collision-safe path: foo.pdf → foo-2.pdf → foo-3.pdf …</summary>
    public static string UniquePath(string path)
    {
        if (!File.Exists(path))
            return path;
        var dir = Path.GetDirectoryName(path)!;
        var stem = Path.GetFileNameWithoutExtension(path);
        var ext = Path.GetExtension(path);
        for (var i = 2; ; i++)
        {
            var candidate = Path.Combine(dir, $"{stem}-{i}{ext}");
            if (!File.Exists(candidate))
                return candidate;
        }
    }

    /// <summary>True if <paramref name="path"/> lives inside <paramref name="dir"/>.</summary>
    public static bool IsInside(string path, string dir)
    {
        var full = Path.GetFullPath(path);
        var root =
            Path.GetFullPath(dir).TrimEnd(Path.DirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        return full.StartsWith(root, StringComparison.Ordinal);
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlnum();

    [GeneratedRegex("-{2,}")]
    private static partial Regex MultiDash();

    [GeneratedRegex("""<a class="blk"[^>]*></a>""")]
    private static partial Regex AnchorTag();
}
