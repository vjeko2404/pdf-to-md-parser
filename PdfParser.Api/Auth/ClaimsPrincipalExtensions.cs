using System.Security.Claims;

namespace PdfParser.Api.Auth;

/// <summary>Pulls the authenticated user's id out of the JWT claims. Endpoints inject
/// <see cref="ClaimsPrincipal"/> and call <c>user.GetUserId()</c> to scope every query.</summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>The current user's id, or 0 when unauthenticated/malformed.</summary>
    public static long GetUserId(this ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return long.TryParse(raw, out var id) ? id : 0;
    }

    public static bool IsAdmin(this ClaimsPrincipal user) => user.IsInRole(nameof(Models.UserRole.Admin));
}
