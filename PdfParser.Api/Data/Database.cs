using Dapper;
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
        // 1. Create tables (target shape) for a fresh DB; legacy tables are skipped by
        //    IF NOT EXISTS and fixed up in step 2.
        Exec(conn, Schema);
        // 2. Upgrade any legacy (single-user) tables in place.
        Migrate(conn);
        // 3. Owner-dependent indexes — created only now, after every table is guaranteed
        //    to have the OwnerUserId/UserId columns (legacy tables get them in step 2).
        Exec(conn, OwnerIndexes);
    }

    private static void Exec(SqliteConnection conn, string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }

    /// <summary>
    /// In-place upgrade of a pre-auth (single-user) database to the multi-tenant shape.
    /// Idempotent: each step checks the current shape first, so a fresh DB (already built
    /// to the target shape by <see cref="Schema"/>) is a no-op. Existing rows are left
    /// owner-less (OwnerUserId NULL / UserId 0) until the first admin claims them — see
    /// <c>UserRepository.AssignOrphansToAdmin</c>.
    /// </summary>
    private static void Migrate(SqliteConnection conn)
    {
        // documents: a legacy table both lacks OwnerUserId AND carries a GLOBAL UNIQUE on
        // Sha256 (which would stop two users owning the same file). A plain ADD COLUMN can't
        // drop that constraint, so rebuild the table to the target shape (per-owner dedup).
        if (!HasColumn(conn, "documents", "OwnerUserId"))
        {
            conn.Execute(
                """
                ALTER TABLE documents RENAME TO documents_old;
                CREATE TABLE documents (
                    Id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    OwnerUserId     INTEGER,
                    Sha256          TEXT NOT NULL,
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
                INSERT INTO documents (Id, OwnerUserId, Sha256, OriginalName, Slug, Status, MdPath,
                    ArchivedPdfPath, LayoutJsonPath, Pages, Language, DocType, DocDate, DocNumber,
                    PartiesJson, TagsJson, Summary, ErrorReason, DurationMs, CreatedAt, ProcessedAt)
                    SELECT Id, NULL, Sha256, OriginalName, Slug, Status, MdPath,
                    ArchivedPdfPath, LayoutJsonPath, Pages, Language, DocType, DocDate, DocNumber,
                    PartiesJson, TagsJson, Summary, ErrorReason, DurationMs, CreatedAt, ProcessedAt
                    FROM documents_old;
                DROP TABLE documents_old;
                CREATE INDEX IF NOT EXISTS ix_documents_owner ON documents(OwnerUserId);
                CREATE UNIQUE INDEX IF NOT EXISTS ux_documents_owner_sha ON documents(OwnerUserId, Sha256);
                """
            );
        }

        // categories' uniqueness moved from global Name to (OwnerUserId, Name); a plain
        // ADD COLUMN can't change that, so rebuild the table when the owner column is absent.
        if (!HasColumn(conn, "categories", "OwnerUserId"))
        {
            conn.Execute(
                """
                ALTER TABLE categories RENAME TO categories_old;
                CREATE TABLE categories (
                    Id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    OwnerUserId INTEGER,
                    Name        TEXT NOT NULL,
                    Color       TEXT,
                    CreatedAt   TEXT NOT NULL
                );
                INSERT INTO categories (Id, OwnerUserId, Name, Color, CreatedAt)
                    SELECT Id, NULL, Name, Color, CreatedAt FROM categories_old;
                DROP TABLE categories_old;
                CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_owner_name ON categories(OwnerUserId, Name);
                CREATE INDEX IF NOT EXISTS ix_categories_owner ON categories(OwnerUserId);
                """
            );
        }

        // settings / secrets: composite (UserId, Key). Legacy tables keyed on Key alone
        // lack the UserId column — rebuild, parking old rows under UserId 0 (claimed later).
        if (!HasColumn(conn, "settings", "UserId"))
        {
            conn.Execute(
                """
                ALTER TABLE settings RENAME TO settings_old;
                CREATE TABLE settings (
                    UserId    INTEGER NOT NULL,
                    Key       TEXT NOT NULL,
                    Value     TEXT NOT NULL,
                    UpdatedAt TEXT NOT NULL,
                    PRIMARY KEY (UserId, Key)
                );
                INSERT INTO settings (UserId, Key, Value, UpdatedAt)
                    SELECT 0, Key, Value, UpdatedAt FROM settings_old;
                DROP TABLE settings_old;
                """
            );
        }

        if (!HasColumn(conn, "secrets", "UserId"))
        {
            conn.Execute(
                """
                ALTER TABLE secrets RENAME TO secrets_old;
                CREATE TABLE secrets (
                    UserId    INTEGER NOT NULL,
                    Key       TEXT NOT NULL,
                    ValueEnc  TEXT NOT NULL,
                    UpdatedAt TEXT NOT NULL,
                    PRIMARY KEY (UserId, Key)
                );
                INSERT INTO secrets (UserId, Key, ValueEnc, UpdatedAt)
                    SELECT 0, Key, ValueEnc, UpdatedAt FROM secrets_old;
                DROP TABLE secrets_old;
                """
            );
        }

        // Manual-edit marker for the Markdown — added after launch. Plain nullable ADD COLUMN
        // (no constraint change), so existing rows simply start out NULL = never edited.
        if (!HasColumn(conn, "documents", "MarkdownEditedAt"))
            conn.Execute("ALTER TABLE documents ADD COLUMN MarkdownEditedAt TEXT;");
    }

    /// <summary>True if <paramref name="table"/> has a column named <paramref name="column"/>.</summary>
    private static bool HasColumn(SqliteConnection conn, string table, string column)
    {
        // PRAGMA table_info isn't parameterizable; table names here are constants.
        var cols = conn.Query<string>($"SELECT name FROM pragma_table_info('{table}')");
        return cols.Any(c => string.Equals(c, column, StringComparison.OrdinalIgnoreCase));
    }

    private const string Schema = """
        PRAGMA journal_mode=WAL;

        -- App users. The first to register becomes Admin; everyone is otherwise equal
        -- (own settings, secrets, categories, documents). Password is a PHC-style string.
        CREATE TABLE IF NOT EXISTS users (
            Id           INTEGER PRIMARY KEY AUTOINCREMENT,
            Username     TEXT NOT NULL UNIQUE COLLATE NOCASE,
            PasswordHash TEXT NOT NULL,
            Role         TEXT NOT NULL,
            IsActive     INTEGER NOT NULL DEFAULT 1,
            CreatedAt    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            Id              INTEGER PRIMARY KEY AUTOINCREMENT,
            OwnerUserId     INTEGER,
            Sha256          TEXT NOT NULL,
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
            ProcessedAt     TEXT,
            MarkdownEditedAt TEXT
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

        -- Per-user, frontend-editable settings. UserId 0 holds GLOBAL app settings
        -- (currently only registrationEnabled).
        CREATE TABLE IF NOT EXISTS settings (
            UserId    INTEGER NOT NULL,
            Key       TEXT NOT NULL,
            Value     TEXT NOT NULL,
            UpdatedAt TEXT NOT NULL,
            PRIMARY KEY (UserId, Key)
        );

        -- Per-user encrypted-at-rest secrets (AES-GCM; values never stored in plaintext).
        CREATE TABLE IF NOT EXISTS secrets (
            UserId    INTEGER NOT NULL,
            Key       TEXT NOT NULL,
            ValueEnc  TEXT NOT NULL,
            UpdatedAt TEXT NOT NULL,
            PRIMARY KEY (UserId, Key)
        );

        -- Per-user category taxonomy (separate from LLM tags). Names are unique per owner.
        CREATE TABLE IF NOT EXISTS categories (
            Id          INTEGER PRIMARY KEY AUTOINCREMENT,
            OwnerUserId INTEGER,
            Name        TEXT NOT NULL,
            Color       TEXT,
            CreatedAt   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS document_categories (
            DocumentId INTEGER NOT NULL,
            CategoryId INTEGER NOT NULL,
            PRIMARY KEY (DocumentId, CategoryId)
        );
        CREATE INDEX IF NOT EXISTS ix_doccat_cat ON document_categories(CategoryId);

        -- Standalone FTS5 index; rowid == documents.Id (kept in sync by the repo).
        -- Owner scoping is applied on the documents join, not here.
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
            title, summary, tags, content
        );
        """;

    // Created AFTER migration so the columns they reference always exist.
    private const string OwnerIndexes = """
        CREATE INDEX IF NOT EXISTS ix_documents_owner ON documents(OwnerUserId);
        -- Dedup is PER OWNER: each user may hold their own copy of an identical PDF.
        CREATE UNIQUE INDEX IF NOT EXISTS ux_documents_owner_sha ON documents(OwnerUserId, Sha256);
        CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_owner_name ON categories(OwnerUserId, Name);
        CREATE INDEX IF NOT EXISTS ix_categories_owner ON categories(OwnerUserId);
        """;
}
