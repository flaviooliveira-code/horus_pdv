/**
 * Arquivo: API/NETCORE/Services/Pagamentos/HorusPaymentGatewayService.cs
 * Objetivo: concentra regras dos gateways de pagamento (Asaas, Mercado Pago e PagBank) e o teste de credencial no provedor.
 * Entradas esperadas: recebe gateway salvo com credencial descriptografada; faz chamadas somente de leitura ao provedor.
 */
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using HORUSPDV_API.Repositories.DataAccess;

namespace HORUSPDV_API.Services.Pagamentos;

public sealed record GatewayValidationResult(string Status, string Message);

public partial class HorusPaymentGatewayService(HttpClient httpClient, IConfiguration configuration)
{
    public const string Asaas = "ASAAS";
    public const string MercadoPago = "MERCADO_PAGO";
    public const string PagBank = "PAGBANK";

    public static readonly IReadOnlySet<string> SupportedProviders =
        new HashSet<string>(StringComparer.Ordinal) { Asaas, MercadoPago, PagBank };

    public static readonly IReadOnlySet<string> SupportedEnvironments =
        new HashSet<string>(StringComparer.Ordinal) { "PRODUCTION", "SANDBOX" };

    public const string MercadoPagoPublicKeyMessage =
        "O valor informado é uma Public Key do Mercado Pago. Informe o Access Token em Suas integrações > Credenciais.";

    /// <summary>Somente Mercado Pago e PagBank permitem operar apenas com PIX.</summary>
    public static bool SupportsPixOnly(string provider)
        => provider is MercadoPago or PagBank;

    public static string GetProviderLabel(string provider) => provider switch
    {
        Asaas => "Asaas",
        MercadoPago => "Mercado Pago",
        PagBank => "PagBank",
        _ => "Gateway"
    };

    /// <summary>Remove o prefixo "Bearer" que o usuário às vezes cola junto do token.</summary>
    public static string NormalizeToken(string? value)
        => BearerPrefix().Replace((value ?? string.Empty).Trim(), string.Empty).Trim();

    public static bool LooksLikeMercadoPagoPublicKey(string? value)
        => MercadoPagoPublicKey().IsMatch(NormalizeToken(value));

    public static string MaskSecret(string value)
    {
        var normalized = value.Trim();
        if (normalized.Length == 0) return string.Empty;
        if (normalized.Length <= 8) return new string('•', normalized.Length);
        return $"{normalized[..4]}••••{normalized[^4..]}";
    }

    public async Task<GatewayValidationResult> ValidateConnectionAsync(
        GatewayPagamentoAD gateway,
        CancellationToken cancellationToken = default)
    {
        if (!gateway.Active)
        {
            return new GatewayValidationResult("DISABLED", "Gateway inativo. Ative para usar em cobranças.");
        }

        var token = NormalizeToken(gateway.AccessToken);
        if (token.Length == 0)
        {
            return Error($"{GetProviderLabel(gateway.Provider)}: informe o Access Token / API Key.");
        }

        try
        {
            return gateway.Provider switch
            {
                Asaas => await ValidateAsaasAsync(gateway, token, cancellationToken),
                MercadoPago => await ValidateMercadoPagoAsync(token, cancellationToken),
                PagBank => ValidatePagBank(gateway, token),
                _ => Error("Gateway não suportado. Use Asaas, Mercado Pago ou PagBank.")
            };
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            return Error($"Não foi possível consultar o {GetProviderLabel(gateway.Provider)} agora.");
        }
    }

    private async Task<GatewayValidationResult> ValidateAsaasAsync(
        GatewayPagamentoAD gateway,
        string token,
        CancellationToken cancellationToken)
    {
        var baseUrl = gateway.Environment == "SANDBOX"
            ? "https://api-sandbox.asaas.com"
            : "https://api.asaas.com";
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/v3/finance/balance");
        request.Headers.Add("access_token", token);
        request.Headers.UserAgent.ParseAdd("HorusPDV/1.0");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Error("API Key do Asaas inválida ou incompatível com o ambiente selecionado (Produção/Sandbox).");
        }

        if (!response.IsSuccessStatusCode)
        {
            return Error($"Asaas respondeu HTTP {(int)response.StatusCode} ao validar a conta.");
        }

        return new GatewayValidationResult("OK", "Asaas conectado.");
    }

    private async Task<GatewayValidationResult> ValidateMercadoPagoAsync(
        string token,
        CancellationToken cancellationToken)
    {
        if (LooksLikeMercadoPagoPublicKey(token))
        {
            return Error(MercadoPagoPublicKeyMessage);
        }

        var baseUrl = (configuration["Payments:MercadoPagoApiBaseUrl"] ?? "https://api.mercadopago.com").TrimEnd('/');
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/users/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            return Error("Access Token do Mercado Pago inválido. A Public Key não autoriza cobranças.");
        }

        if (!response.IsSuccessStatusCode)
        {
            return Error($"Mercado Pago respondeu HTTP {(int)response.StatusCode} ao validar a conta.");
        }

        var nickname = await ReadMercadoPagoNicknameAsync(response, cancellationToken);
        return new GatewayValidationResult(
            "OK",
            string.IsNullOrWhiteSpace(nickname) ? "Mercado Pago conectado." : $"Mercado Pago conectado: {nickname}.");
    }

    // O PagBank não tem leitura de conta que valide o token sem efeito colateral;
    // a credencial é conferida pela API na primeira cobrança.
    private static GatewayValidationResult ValidatePagBank(GatewayPagamentoAD gateway, string token)
    {
        if (token.Length < 20)
        {
            return Error("Access Token do PagBank inválido ou incompatível com o ambiente selecionado.");
        }

        return new GatewayValidationResult(
            "OK",
            gateway.Environment == "SANDBOX"
                ? "PagBank salvo em Sandbox. O token é conferido na primeira cobrança."
                : "PagBank salvo. O token é conferido na primeira cobrança.");
    }

    private static async Task<string> ReadMercadoPagoNicknameAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            return document.RootElement.TryGetProperty("nickname", out var nickname) &&
                   nickname.ValueKind == JsonValueKind.String
                ? nickname.GetString() ?? string.Empty
                : string.Empty;
        }
        catch (JsonException)
        {
            return string.Empty;
        }
    }

    private static GatewayValidationResult Error(string message) => new("ERROR", message);

    [GeneratedRegex(@"^Bearer\s+", RegexOptions.IgnoreCase)]
    private static partial Regex BearerPrefix();

    [GeneratedRegex(@"^(APP_USR|TEST)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOptions.IgnoreCase)]
    private static partial Regex MercadoPagoPublicKey();
}
