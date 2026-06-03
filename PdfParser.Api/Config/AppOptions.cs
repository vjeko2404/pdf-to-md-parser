namespace PdfParser.Api.Config;

/// <summary>
/// Bound from the "App" config section (env: App__WatchRoot, ...).
/// WatchRoot, VaultDir and MarkerUrl define the container's PHYSICAL shape and stay
/// here (compose-level). The rest are SEED defaults: copied into the settings table
/// on first run, after which the DB (frontend-editable) is the source of truth.
/// </summary>
public class AppOptions
{
    // Container shape — fixed at compose time, not runtime-editable.
    public string WatchRoot { get; set; } = "/host"; // bind-mounted host root
    public string VaultDir { get; set; } = "/vault";
    public string MarkerUrl { get; set; } = "http://marker-server:8000";

    // Seed defaults for the settings table (live-editable thereafter).
    public string WatchSubdir { get; set; } = "Downloads"; // watched dir = WatchRoot/WatchSubdir
    public string OllamaUrl { get; set; } = "http://host.docker.internal:11434";
    public string OllamaModel { get; set; } = "qwen2.5:7b-instruct";
    public int DebounceSeconds { get; set; } = 2;

    /// <summary>Master key for secret encryption. If empty, a random keyfile is
    /// generated under the vault (vault/.secretkey).</summary>
    public string SecretKey { get; set; } = "";

    /// <summary>Default enrichment system prompt (editable live in settings).</summary>
    public string EnrichPrompt { get; set; } =
        "You extract structured metadata from a document. The text may be in German, "
        + "Croatian, or English. Respond ONLY with JSON matching the provided schema. "
        + "doc_type is one of: invoice, delivery_note, contract, register_extract, "
        + "specification, ticket, report, letter, other. language is an ISO 639-1 code. "
        + "doc_date is ISO yyyy-mm-dd if present, else empty. tags are 3-8 short lowercase "
        + "topical keywords. summary is 2-3 neutral sentences in the document's language.";
}
