/**
 * Arquivo: API/NETCORE/Services/Security/HorusSecretProtector.cs
 * Objetivo: protege e recupera segredos sensíveis armazenados para configuração SMTP.
 * Entradas esperadas: recebe segredo em texto puro ou protegido para criptografia/descriptografia local.
 */
using System.Security.Cryptography;
using System.Text;

namespace HORUSPDV_API.Services.Security;

public class HorusSecretProtector(HorusSecurityOptions securityOptions)
{
    private const string Prefix = "enc:v1:";

    public string Protect(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        if (value.StartsWith(Prefix, StringComparison.Ordinal)) return value;

        var nonce = RandomNumberGenerator.GetBytes(12);
        var plainText = Encoding.UTF8.GetBytes(value);
        var cipherText = new byte[plainText.Length];
        var tag = new byte[16];

        using var aes = new AesGcm(DeriveKey(), 16);
        aes.Encrypt(nonce, plainText, cipherText, tag);

        return $"{Prefix}{Convert.ToBase64String(nonce)}.{Convert.ToBase64String(tag)}.{Convert.ToBase64String(cipherText)}";
    }

    public string Unprotect(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        if (!value.StartsWith(Prefix, StringComparison.Ordinal)) return value;

        var parts = value[Prefix.Length..].Split('.', 3);
        if (parts.Length != 3)
        {
            throw new InvalidOperationException("Segredo protegido invalido.");
        }

        var nonce = Convert.FromBase64String(parts[0]);
        var tag = Convert.FromBase64String(parts[1]);
        var cipherText = Convert.FromBase64String(parts[2]);
        var plainText = new byte[cipherText.Length];

        using var aes = new AesGcm(DeriveKey(), 16);
        aes.Decrypt(nonce, cipherText, tag, plainText);

        return Encoding.UTF8.GetString(plainText);
    }

    private byte[] DeriveKey()
    {
        var source = string.IsNullOrWhiteSpace(securityOptions.EncryptionKey)
            ? securityOptions.JwtSecret
            : securityOptions.EncryptionKey;

        return SHA256.HashData(Encoding.UTF8.GetBytes(source));
    }
}
