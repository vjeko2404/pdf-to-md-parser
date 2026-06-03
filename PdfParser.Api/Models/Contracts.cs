using System.Text.Json.Serialization;

namespace PdfParser.Api.Models;

// ── marker-server /convert response ─────────────────────────────────────────

public class MarkerBlock
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("bbox")]
    public double[]? Bbox { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; } = "";
}

public class MarkerResult
{
    [JsonPropertyName("markdown")]
    public string Markdown { get; set; } = "";

    [JsonPropertyName("blocks")]
    public List<MarkerBlock> Blocks { get; set; } = new();

    [JsonPropertyName("images")]
    public Dictionary<string, string> Images { get; set; } = new();

    [JsonPropertyName("page_count")]
    public int PageCount { get; set; }
}

// ── Ollama structured enrichment result ─────────────────────────────────────

public class EnrichResult
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("doc_type")]
    public string? DocType { get; set; }

    [JsonPropertyName("language")]
    public string? Language { get; set; }

    [JsonPropertyName("parties")]
    public List<string> Parties { get; set; } = new();

    [JsonPropertyName("doc_date")]
    public string? DocDate { get; set; }

    [JsonPropertyName("doc_number")]
    public string? DocNumber { get; set; }

    [JsonPropertyName("tags")]
    public List<string> Tags { get; set; } = new();

    [JsonPropertyName("summary")]
    public string? Summary { get; set; }
}
