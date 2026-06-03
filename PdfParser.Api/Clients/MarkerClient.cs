using System.Net.Http.Headers;
using System.Text.Json;
using PdfParser.Api.Models;

namespace PdfParser.Api.Clients;

/// <summary>
/// Talks to a marker-server. The base URL is passed PER CALL because the target depends
/// on the user's chosen conversion engine: the local container (marker-host / pdfplumber)
/// or an off-VPS URL (marker-remote). /convert runs the heavy marker pipeline; /extract is
/// the lightweight pdfplumber path. Both return the same <see cref="MarkerResult"/> contract.
/// </summary>
public class MarkerClient(HttpClient http)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Run the full marker conversion at <paramref name="baseUrl"/>.</summary>
    public Task<MarkerResult> ConvertAsync(string baseUrl, byte[] pdf, string fileName, CancellationToken ct)
        => PostAsync(baseUrl, "/convert", pdf, fileName, ct);

    /// <summary>Run the lightweight pdfplumber extraction at <paramref name="baseUrl"/>.</summary>
    public Task<MarkerResult> ExtractAsync(string baseUrl, byte[] pdf, string fileName, CancellationToken ct)
        => PostAsync(baseUrl, "/extract", pdf, fileName, ct);

    /// <summary>Quick liveness probe of a marker-server's /health. Never throws.</summary>
    public async Task<bool> IsHealthyAsync(string baseUrl, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
            return false;
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(5));
            using var resp = await http.GetAsync($"{baseUrl.TrimEnd('/')}/health", cts.Token);
            return resp.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private async Task<MarkerResult> PostAsync(
        string baseUrl,
        string route,
        byte[] pdf,
        string fileName,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("no marker URL configured for the selected engine");

        var url = $"{baseUrl.TrimEnd('/')}{route}";
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(pdf);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", fileName);

        using var resp = await http.PostAsync(url, form, ct);
        resp.EnsureSuccessStatusCode();

        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        var result = await JsonSerializer.DeserializeAsync<MarkerResult>(stream, Json, ct);
        return result
            ?? throw new InvalidOperationException("marker-server returned an empty body");
    }
}
