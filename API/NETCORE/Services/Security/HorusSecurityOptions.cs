namespace HORUSPDV_API.Services.Security;

public class HorusSecurityOptions(IConfiguration configuration, IWebHostEnvironment environment)
{
    public string JwtSecret { get; } = configuration["Auth:JwtSecret"]
        ?? "horus-pdv-development-secret-change-before-production-2026";

    public string JwtIssuer { get; } = configuration["Auth:Issuer"] ?? "horus-pdv-api";

    public string JwtAudience { get; } = configuration["Auth:Audience"] ?? "horus-pdv-web";

    public int SessionHours { get; } = int.TryParse(configuration["Auth:SessionHours"], out var hours)
        ? Math.Clamp(hours, 1, 24)
        : 8;

    public bool RecaptchaEnabled { get; } =
        bool.TryParse(configuration["Recaptcha:Enabled"], out var recaptchaEnabled) &&
        recaptchaEnabled;

    public string RecaptchaSecretKey { get; } = configuration["Recaptcha:SecretKey"] ?? "";

    public double RecaptchaMinScore { get; } =
        double.TryParse(configuration["Recaptcha:MinScore"], out var score)
            ? Math.Clamp(score, 0.1d, 1d)
            : 0.5d;

    public int RequestRateLimitWindowSeconds { get; } =
        int.TryParse(configuration["Security:RateLimit:WindowSeconds"], out var windowSeconds)
            ? Math.Clamp(windowSeconds, 10, 3600)
            : 60;

    public int RequestRateLimitMax { get; } =
        int.TryParse(configuration["Security:RateLimit:MaxRequests"], out var maxRequests)
            ? Math.Clamp(maxRequests, 10, 5000)
            : 240;

    public long MaxRequestBodyBytes { get; } =
        long.TryParse(configuration["Security:MaxRequestBodyBytes"], out var maxBodyBytes)
            ? Math.Clamp(maxBodyBytes, 32_768, 25_000_000)
            : 2_000_000;

    public void Validate()
    {
        if (!environment.IsProduction()) return;

        var usingDefault = JwtSecret == "horus-pdv-development-secret-change-before-production-2026";
        if (usingDefault || JwtSecret.Length < 32)
        {
            throw new InvalidOperationException(
                "Auth:JwtSecret invalido em producao. Defina um segredo forte com pelo menos 32 caracteres.");
        }

        if (RecaptchaEnabled && string.IsNullOrWhiteSpace(RecaptchaSecretKey))
        {
            throw new InvalidOperationException(
                "Recaptcha:SecretKey obrigatorio quando Recaptcha:Enabled estiver ativo.");
        }
    }
}
