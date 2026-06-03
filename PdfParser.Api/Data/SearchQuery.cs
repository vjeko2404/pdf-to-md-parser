using PdfParser.Api.Models;

namespace PdfParser.Api.Data;

/// <summary>All filters the document search supports.</summary>
public record SearchQuery(
    string? Q = null,
    DocumentStatus? Status = null,
    string[]? Tags = null,
    string? DocType = null,
    string? Language = null,
    string? DateFrom = null,
    string? DateTo = null,
    long? CategoryId = null,
    string? Sort = null
);

/// <summary>A facet value and its document count.</summary>
public class FacetRow
{
    public string Value { get; set; } = "";
    public int Count { get; set; }
}
