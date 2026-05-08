/**
 * Arquivo: API/NETCORE/Services/Security/HorusRecaptchaService.cs
 * Objetivo: valida tokens do Google reCAPTCHA antes de ações públicas sensíveis.
 * Entradas esperadas: recebe token, ação esperada e IP do cliente para validar risco no Google reCAPTCHA.
 */
using System.Text.Json;

namespace HORUSPDV_API.Services.Security;

public class HorusRecaptchaService(HttpClient httpClient, HorusSecurityOptions securityOptions)
{
    public async Task<RecaptchaValidationResult> VerifyAsync(
        string token,
        string action,
        string remoteIp,
        CancellationToken cancellationToken = default)
    {
        if (!securityOptions.RecaptchaEnabled)
        {
            return RecaptchaValidationResult.Ok(skipped: true);
        }

        if (string.IsNullOrWhiteSpace(securityOptions.RecaptchaSecretKey))
        {
            return RecaptchaValidationResult.Fail(
                StatusCodes.Status500InternalServerError,
                "Validação de segurança indisponível. Configure Recaptcha:SecretKey na API.");
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            return RecaptchaValidationResult.Fail(
                StatusCodes.Status400BadRequest,
                "Validação de segurança obrigatória. Atualize e tente novamente.");
        }

        var fields = new Dictionary<string, string>
        {
            ["secret"] = securityOptions.RecaptchaSecretKey,
            ["response"] = token.Trim()
        };
        if (!string.IsNullOrWhiteSpace(remoteIp))
        {
            fields["remoteip"] = remoteIp.Split(',')[0].Trim();
        }

        using var content = new FormUrlEncodedContent(fields);
        using var response = await httpClient.PostAsync(
            "https://www.google.com/recaptcha/api/siteverify",
            content,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            return RecaptchaValidationResult.Fail(
                StatusCodes.Status503ServiceUnavailable,
                "Não foi possível validar o reCAPTCHA no momento.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var root = document.RootElement;

        if (!ReadBoolean(root, "success"))
        {
            var errorCodes = ReadErrorCodes(root);
            var retryable = errorCodes.Contains("timeout-or-duplicate") ||
                            errorCodes.Contains("invalid-input-response");
            return RecaptchaValidationResult.Fail(
                retryable ? StatusCodes.Status409Conflict : StatusCodes.Status400BadRequest,
                retryable
                    ? "Validação de segurança expirou. Tente novamente."
                    : "Falha na validação de segurança. Tente novamente.",
                retryable
                    ? "RECAPTCHA_TOKEN_EXPIRED"
                    : "RECAPTCHA_VALIDATION_FAILED");
        }

        var recaptchaAction = ReadString(root, "action");
        if (!string.IsNullOrWhiteSpace(action) &&
            !string.IsNullOrWhiteSpace(recaptchaAction) &&
            !string.Equals(recaptchaAction, action, StringComparison.Ordinal))
        {
            return RecaptchaValidationResult.Fail(
                StatusCodes.Status400BadRequest,
                "Validação de segurança inválida para esta operação.",
                "RECAPTCHA_ACTION_MISMATCH");
        }

        var score = ReadDouble(root, "score");
        if (score is not null && score < securityOptions.RecaptchaMinScore)
        {
            return RecaptchaValidationResult.Fail(
                StatusCodes.Status400BadRequest,
                "Validação de segurança reprovada. Tente novamente.",
                "RECAPTCHA_SCORE_REJECTED");
        }

        return RecaptchaValidationResult.Ok();
    }

    private static bool ReadBoolean(JsonElement root, string property)
        => root.TryGetProperty(property, out var element) &&
           element.ValueKind == JsonValueKind.True;

    private static string ReadString(JsonElement root, string property)
        => root.TryGetProperty(property, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString() ?? ""
            : "";

    private static double? ReadDouble(JsonElement root, string property)
    {
        if (!root.TryGetProperty(property, out var element)) return null;
        return element.TryGetDouble(out var value) ? value : null;
    }

    private static HashSet<string> ReadErrorCodes(JsonElement root)
    {
        if (!root.TryGetProperty("error-codes", out var element) ||
            element.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return element
            .EnumerateArray()
            .Select(item => item.GetString() ?? "")
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }
}

public record RecaptchaValidationResult(
    bool Success,
    int StatusCode,
    string Message,
    string Details = "",
    bool Skipped = false)
{
    public static RecaptchaValidationResult Ok(bool skipped = false)
        => new(true, StatusCodes.Status200OK, "", "", skipped);

    public static RecaptchaValidationResult Fail(int statusCode, string message, string details = "")
        => new(false, statusCode, message, details);
}
