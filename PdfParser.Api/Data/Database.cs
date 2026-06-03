using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;
using PdfParser.Api.Config;

namespace PdfParser.Api.Data;

/// <summary>Owns the SQLite connection string + idempotent schema (incl. FTS5).</summary>
public class Database
{
    public string ConnectionString { get; }

    public Database(IOptions<AppOptions> options)
    {
        var vault = options.Value.VaultDir;
        Directory.CreateDirectory(vault);
        var dbPath = Path.Combine(vault, "index.sqlite");
        ConnectionString = new SqliteConnectionStringBuilder { DataSource = dbPath }.ToString();
    }

    public SqliteConnection Open()
    {
        var conn = new SqliteConnection(ConnectionString);
        conn.Open();
        return conn;
    }

    public void Initialize()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = Schema;
        cmd.ExecuteNonQuery();
    }

    private const string Schema = """
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS documents (
            Id              INTEGER PRIMARY KEY AUTOINCREMENT,
            Sha256          TEXT NOT NULL UNIQUE,
            OriginalName    TEXT NOT NULL,
            Slug            TEXT NOT NULL,
            Status          TEXT NOT NULL,
            MdPath          TEXT,
            ArchivedPdfPath TEXT,
            LayoutJsonPath  TEXT,
            Pages           INTEGER NOT NULL DEFAULT 0,
            Language        TEXT,
            DocType         TEXT,
            DocDate         TEXT,
            DocNumber       TEXT,
            PartiesJson     TEXT,
            TagsJson        TEXT,
            Summary         TEXT,
            ErrorReason     TEXT,
            DurationMs      INTEGER NOT NULL DEFAULT 0,
            CreatedAt       TEXT NOT NULL,
            ProcessedAt     TEXT
        );

        CREATE TABLE IF NOT EXISTS events (
            Id          INTEGER PRIMARY KEY AUTOINCREMENT,
            DocumentId  INTEGER NOT NULL,
            Ts          TEXT NOT NULL,
            Level       TEXT NOT NULL,
            Stage       TEXT NOT NULL,
            Message     TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_events_doc ON events(DocumentId);

        -- Frontend-editable settings (watched folder, ollama model, etc.).
        CREATE TABLE IF NOT EXISTS settings (
            Key       TEXT PRIMARY KEY,
            Value     TEXT NOT NULL,
            UpdatedAt TEXT NOT NULL
        );

        -- Encrypted-at-rest secrets (AES-GCM; values never stored in plaintext).
        CREATE TABLE IF NOT EXISTS secrets (
            Key       TEXT PRIMARY KEY,
            ValueEnc  TEXT NOT NULL,
            UpdatedAt TEXT NOT NULL
        );

        -- User-managed category taxonomy (separate from LLM tags).
        CREATE TABLE IF NOT EXISTS categories (
            Id        INTEGER PRIMARY KEY AUTOINCREMENT,
            Name      TEXT NOT NULL UNIQUE,
            Color     TEXT,
            CreatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS document_categories (
            DocumentId INTEGER NOT NULL,
            CategoryId INTEGER NOT NULL,
            PRIMARY KEY (DocumentId, CategoryId)
        );
        CREATE INDEX IF NOT EXISTS ix_doccat_cat ON document_categories(CategoryId);

        -- Standalone FTS5 index; rowid == documents.Id (kept in sync by the repo).
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
            title, summary, tags, content
        );
        """;
}
