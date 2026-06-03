using System.Security.Cryptography;
using System.Text;
using Dapper;
using Microsoft.Extensions.Options;
using PdfParser.Api.Config;

namespace PdfParser.Api.Data;

public record SecretInfo(string Key, string Masked, string UpdatedAt);

/// <summary>
/// Encrypted-at-rest secret store. Values are AES-GCM encrypted with a master key
/// (from App:SecretKey, or a generated vault/.secretkey) — the DB file alone never
/// reveals them. The list view returns masked previews; full reveal is explicit.
/// </summary>
public class SecretsService
{
    private readonly Database _db;
    private readonly byte[] _key;

    public SecretsService(Database db, IOptions<AppOptions> options)
    {
        _db = db;
        _key = ResolveKey(options.Value);
    }

    private static byte[] ResolveKey(AppOptions opt)
    {
        if (!string.IsNullOrWhiteSpace(opt.SecretKey))
            return SHA256.HashData(Encoding.UTF8.GetBytes(opt.SecretKey));

        Directory.CreateDirectory(opt.VaultDir);
        var keyPath = Path.Combine(opt.VaultDir, ".secretkey");
        if (File.Exists(keyPath))
            return Convert.FromBase64String(File.ReadAllText(keyPath).Trim());

        var key = RandomNumberGenerator.GetBytes(32);
        File.WriteAllText(keyPath, Convert.ToBase64String(key));
        return key;
    }

    public IReadOnlyList<SecretInfo> List()
    {
        using var c = _db.Open();
        var rows = c.Query<(string Key, string ValueEnc, string UpdatedAt)>(
            "SELECT Key, ValueEnc, UpdatedAt FROM secrets ORDER BY Key"
        );
        return rows.Select(r => new SecretInfo(r.Key, Mask(Decrypt(r.ValueEnc)), r.UpdatedAt)).ToList();
    }

    public string? Reveal(string key)
    {
        using var c = _db.Open();
        var enc = c.QuerySingleOrDefault<string>(
            "SELECT ValueEnc FROM secrets WHERE Key = @key",
            new { key }
        );
        return enc is null ? null : Decrypt(enc);
    }

    public void Set(string key, string value)
    {
        using var c = _db.Open();
        c.Execute(
            """
            INSERT INTO secrets (Key, ValueEnc, UpdatedAt) VALUES (@key, @enc, @ts)
            ON CONFLICT(Key) DO UPDATE SET ValueEnc = @enc, UpdatedAt = @ts;
            """,
            new { key, enc = Encrypt(value), ts = DateTime.UtcNow.ToString("o") }
        );
    }

    public void Delete(string key)
    {
        using var c = _db.Open();
        c.Execute("DELETE FROM secrets WHERE Key = @key", new { key });
    }

    private string Encrypt(string plain)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plainBytes = Encoding.UTF8.GetBytes(plain);
        var cipher = new byte[plainBytes.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(_key, tag.Length);
        aes.Encrypt(nonce, plainBytes, cipher, tag);

        var combined = new byte[nonce.Length + tag.Length + cipher.Length];
        Buffer.BlockCopy(nonce, 0, combined, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, combined, nonce.Length, tag.Length);
        Buffer.BlockCopy(cipher, 0, combined, nonce.Length + tag.Length, cipher.Length);
        return Convert.ToBase64String(combined);
    }

    private string Decrypt(string enc)
    {
        try
        {
            var combined = Convert.FromBase64String(enc);
            var nonce = combined[..12];
            var tag = combined[12..28];
            var cipher = combined[28..];
            var plain = new byte[cipher.Length];
            using var aes = new AesGcm(_key, tag.Length);
            aes.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch
        {
            return "";
        }
    }

    private static string Mask(string v)
    {
        if (v.Length <= 4)
            return new string('•', v.Length);
        return v[..2] + new string('•', Math.Min(8, v.Length - 4)) + v[^2..];
    }
}
