namespace PdfParser.Api.Models;

public enum DocumentStatus
{
    Queued,
    Processing,
    Done,
    Failed,
    Skipped, // byte-identical duplicate of an already-processed PDF
}

/// <summary>One row in the ledger — the backbone of both pipeline and dashboard.</summary>
public class Document
{
    public long Id { get; set; }

    /// <summary>The tenant that owns this document. Null only transiently for pre-auth
    /// rows before the first admin claims them.</summary>
    public long? OwnerUserId { get; set; }

    public string Sha256 { get; set; } = "";
    public string OriginalName { get; set; } = "";
    public string Slug { get; set; } = "";
    public DocumentStatus Status { get; set; }

    // Artifact locations under the vault.
    public string? MdPath { get; set; }
    public string? ArchivedPdfPath { get; set; }
    public string? LayoutJsonPath { get; set; } // block list → sync-scroll map

    // Extracted / enriched metadata.
    public int Pages { get; set; }
    public string? Language { get; set; }
    public string? DocType { get; set; }
    public string? DocDate { get; set; }
    public string? DocNumber { get; set; }
    public string? PartiesJson { get; set; }
    public string? TagsJson { get; set; }
    public string? Summary { get; set; }

    public string? ErrorReason { get; set; }
    public long DurationMs { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}

/// <summary>Per-document timeline entry — drives the dashboard's live log.</summary>
public class EventLog
{
    public long Id { get; set; }
    public long DocumentId { get; set; }
    public DateTime Ts { get; set; }
    public string Level { get; set; } = "info"; // info | warn | error
    public string Stage { get; set; } = "";
    public string Message { get; set; } = "";
}
