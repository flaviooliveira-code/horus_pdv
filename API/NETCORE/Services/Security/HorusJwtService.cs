using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace HORUSPDV_API.Services.Security;

public class HorusJwtService(IConfiguration configuration)
{
    private readonly string _secret = configuration["Auth:JwtSecret"]
        ?? "horus-pdv-development-secret-change-before-production-2026";
    private readonly int _sessionHours = int.TryParse(configuration["Auth:SessionHours"], out var hours)
        ? hours
        : 8;

    public int SessionHours => _sessionHours;

    public string CreateToken(SecurityUserDto user, SecuritySession session, string ip)
    {
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddHours(_sessionHours);
        var header = new Dictionary<string, object>
        {
            ["alg"] = "HS256",
            ["typ"] = "JWT"
        };
        var payload = new Dictionary<string, object>
        {
            ["sub"] = user.Id,
            ["id"] = user.Id,
            ["name"] = user.Name,
            ["email"] = user.Email,
            ["role"] = user.Role,
            ["tokenType"] = "Bearer",
            ["sessionId"] = session.Id,
            ["sessionTtl"] = $"{_sessionHours}h",
            ["ip"] = ip,
            ["iat"] = now.ToUnixTimeSeconds(),
            ["exp"] = expiresAt.ToUnixTimeSeconds()
        };

        var encodedHeader = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(header));
        var encodedPayload = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload));
        var signature = Sign($"{encodedHeader}.{encodedPayload}");
        return $"{encodedHeader}.{encodedPayload}.{signature}";
    }

    public AuthenticatedUser? ValidateToken(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 3) return null;

        var signature = Sign($"{parts[0]}.{parts[1]}");
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(signature),
                Encoding.UTF8.GetBytes(parts[2])))
        {
            return null;
        }

        using var payload = JsonDocument.Parse(Base64UrlDecode(parts[1]));
        var root = payload.RootElement;
        var exp = root.TryGetProperty("exp", out var expElement) ? expElement.GetInt64() : 0;
        if (exp <= DateTimeOffset.UtcNow.ToUnixTimeSeconds()) return null;

        var userId = root.TryGetProperty("sub", out var subElement) ? subElement.GetString() ?? "" : "";
        var sessionId = root.TryGetProperty("sessionId", out var sessionElement) ? sessionElement.GetString() ?? "" : "";
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(sessionId)) return null;

        return new AuthenticatedUser
        {
            Id = userId,
            SessionId = sessionId,
            Name = root.TryGetProperty("name", out var nameElement) ? nameElement.GetString() ?? "" : "",
            Email = root.TryGetProperty("email", out var emailElement) ? emailElement.GetString() ?? "" : "",
            Role = root.TryGetProperty("role", out var roleElement) ? roleElement.GetString() ?? "" : ""
        };
    }

    private string Sign(string value)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secret));
        return Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(value)));
    }

    private static string Base64UrlEncode(byte[] value)
        => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2:
                padded += "==";
                break;
            case 3:
                padded += "=";
                break;
        }
        return Convert.FromBase64String(padded);
    }
}

public class AuthenticatedUser
{
    public string Id { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}
