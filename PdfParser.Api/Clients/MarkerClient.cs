using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PdfParser.Api.Config;
using PdfParser.Api.Models;

namespace PdfParser.Api.Clients;

/// <summary>Talks to the internal marker-server /convert endpoint.</summary>
public class MarkerClient(HttpClient http, IOptions<AppOptions> options)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly string _baseUrl = options.Value.MarkerUrl.TrimEnd('/');

    public async Task<MarkerResult> ConvertAsync(byte[] pdf, string fileName, CancellationToken ct)
    {
        // Retry ONLY on connection-level failures (marker still warming up / restarting),
        // identified by HttpRequestException with no StatusCode. A real HTTP error
        // response (e.g. 500 = bad PDF) has a StatusCode and is NOT retried.
        const int maxAttempts = 30;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await PostConvertAsync(pdf, fileName, ct);
            }
            catch (HttpRequestException ex) when (ex.StatusCode is null && attempt < maxAttempts)
            {
                await Task.Delay(TimeSpan.FromSeconds(5), ct);
            }
        }
    }

    private async Task<MarkerResult> PostConvertAsync(byte[] pdf, string fileName, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(pdf);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", fileName);

        using var resp = await http.PostAsync($"{_baseUrl}/convert", form, ct);
        resp.EnsureSuccessStatusCode();

        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        var result = await JsonSerializer.DeserializeAsync<MarkerResult>(stream, Json, ct);
        return result
            ?? throw new InvalidOperationException("marker-server returned an empty body");
    }
}
