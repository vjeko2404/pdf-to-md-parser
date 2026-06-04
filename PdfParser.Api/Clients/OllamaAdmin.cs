using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.SignalR;
using PdfParser.Api.Data;
using PdfParser.Api.Hubs;

namespace PdfParser.Api.Clients;

/// <summary>
/// API-level management of the host Ollama (no service lifecycle control): status,
/// model list / pull / delete, and currently-loaded models. Pull streams progress
/// over SignalR ("ollamaPull"). Base URL comes from live settings.
/// </summary>
public class OllamaAdmin(
    HttpClient http,
    SettingsService settings,
    IHubContext<LiveHub> hub,
    ILogger<OllamaAdmin> logger
)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private string BaseUrl(long userId) => settings.For(userId).OllamaUrl.TrimEnd('/');

    /// <summary>
    /// Ping the server's /api/version. Pass <paramref name="urlOverride"/> to test an
    /// arbitrary URL (e.g. an unsaved value typed in Settings) instead of the saved one.
    /// </summary>
    public async Task<OllamaStatus> StatusAsync(
        long userId,
        CancellationToken ct,
        string? urlOverride = null
    )
    {
        var baseUrl = (
            string.IsNullOrWhiteSpace(urlOverride) ? settings.For(userId).OllamaUrl : urlOverride
        ).TrimEnd('/');
        try
        {
            var v = await http.GetFromJsonAsync<VersionResponse>(
                $"{baseUrl}/api/version",
                Json,
                ct
            );
            return new OllamaStatus(true, v?.Version, null);
        }
        catch (Exception ex)
        {
            return new OllamaStatus(false, null, ex.Message);
        }
    }

    public async Task<IReadOnlyList<OllamaModel>> ListModelsAsync(long userId, CancellationToken ct)
    {
        var tags = await http.GetFromJsonAsync<TagsResponse>(
            $"{BaseUrl(userId)}/api/tags",
            Json,
            ct
        );
        return tags?.Models ?? [];
    }

    public async Task<IReadOnlyList<LoadedModel>> LoadedAsync(long userId, CancellationToken ct)
    {
        var ps = await http.GetFromJsonAsync<PsResponse>($"{BaseUrl(userId)}/api/ps", Json, ct);
        return ps?.Models ?? [];
    }

    public async Task DeleteModelAsync(long userId, string name, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"{BaseUrl(userId)}/api/delete")
        {
            Content = JsonContent.Create(new { name }),
        };
        using var resp = await http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    /// <summary>Pull a model, streaming {status,total,completed} progress over SignalR to
    /// the requesting user only.</summary>
    public async Task PullAsync(long userId, string name, CancellationToken ct)
    {
        var client = hub.Clients.User(userId.ToString());
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl(userId)}/api/pull")
            {
                Content = JsonContent.Create(new { name, stream = true }),
            };
            // ResponseHeadersRead so HttpClient.Timeout doesn't bound the long download.
            using var resp = await http.SendAsync(
                req,
                HttpCompletionOption.ResponseHeadersRead,
                ct
            );
            resp.EnsureSuccessStatusCode();

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var reader = new StreamReader(stream);
            string? line;
            while ((line = await reader.ReadLineAsync(ct)) is not null)
            {
                if (string.IsNullOrWhiteSpace(line))
                    continue;
                var node = JsonSerializer.Deserialize<JsonElement>(line);
                await client.SendAsync(
                    "ollamaPull",
                    new
                    {
                        name,
                        status = Str(node, "status"),
                        total = Num(node, "total"),
                        completed = Num(node, "completed"),
                    },
                    ct
                );
            }
            await client.SendAsync("ollamaPull", new { name, status = "done" }, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Ollama pull failed for {Name}", name);
            await client.SendAsync(
                "ollamaPull",
                new
                {
                    name,
                    status = "error",
                    error = ex.Message,
                },
                CancellationToken.None
            );
        }
    }

    private static string? Str(JsonElement e, string prop) =>
        e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    private static long? Num(JsonElement e, string prop) =>
        e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number
            ? v.GetInt64()
            : null;

    private sealed record VersionResponse([property: JsonPropertyName("version")] string? Version);

    private sealed record TagsResponse(
        [property: JsonPropertyName("models")] List<OllamaModel>? Models
    );

    private sealed record PsResponse(
        [property: JsonPropertyName("models")] List<LoadedModel>? Models
    );
}

public record OllamaStatus(bool Online, string? Version, string? Error);

public class OllamaModel
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("size")]
    public long Size { get; set; }

    [JsonPropertyName("modified_at")]
    public string? ModifiedAt { get; set; }

    [JsonPropertyName("details")]
    public OllamaModelDetails? Details { get; set; }
}

public class OllamaModelDetails
{
    [JsonPropertyName("parameter_size")]
    public string? ParameterSize { get; set; }

    [JsonPropertyName("quantization_level")]
    public string? QuantizationLevel { get; set; }

    [JsonPropertyName("family")]
    public string? Family { get; set; }
}

public class LoadedModel
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("size_vram")]
    public long? SizeVram { get; set; }
}
