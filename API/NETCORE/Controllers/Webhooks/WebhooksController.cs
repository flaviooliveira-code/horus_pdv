/**
 * Arquivo: API/NETCORE/Controllers/Webhooks/WebhooksController.cs
 * Objetivo: recebe avisos de pagamento do Asaas, do Mercado Pago e do PagBank e atualiza a cobrança.
 * Entradas esperadas: POST público dos provedores; autentica pela assinatura de cada um e nunca confia
 * no status enviado no corpo: usa só o id e consulta o provedor.
 */
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Pagamentos;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Webhooks;

[ApiController]
[Route("api/[controller]")]
public class WebhooksController(
    GatewayPagamentoAB gatewayAB,
    CobrancaPagamentoAB chargeAB,
    HorusPaymentChargeService chargeService,
    ILogger<WebhooksController> logger) : ControllerBase
{
    private const int MaxBodyBytes = 65_536;
    private static readonly TimeSpan MercadoPagoSignatureTolerance = TimeSpan.FromMinutes(5);

    [HttpPost("{provider}/{gatewayId}")]
    public async Task<IActionResult> Receber(string provider, string gatewayId, CancellationToken cancellationToken)
    {
        var gateway = await gatewayAB.ObterParaWebhookAsync(gatewayId);
        if (gateway is null || HorusPaymentChargeService.ProviderKey(gateway.Provider) != provider.ToLowerInvariant())
        {
            return NotFound(Fail("Webhook de gateway não encontrado."));
        }

        var body = await ReadBodyAsync(cancellationToken);
        if (body is null)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, Fail("Notificação muito grande."));
        }

        var json = ParseJson(body);
        var (authorized, providerChargeId, reference) = gateway.Provider switch
        {
            HorusPaymentGatewayService.Asaas => AuthenticateAsaas(gateway, json),
            HorusPaymentGatewayService.MercadoPago => AuthenticateMercadoPago(gateway, json),
            HorusPaymentGatewayService.PagBank => AuthenticatePagBank(gateway, body, json),
            _ => (false, string.Empty, string.Empty)
        };

        if (!authorized)
        {
            logger.LogWarning("Webhook recusado: assinatura inválida para o gateway {GatewayId}.", gateway.Id);
            return Unauthorized(Fail("Webhook não autorizado."));
        }

        await gatewayAB.MarcarEventoWebhookAsync(gateway.Id);

        var charge = await FindChargeAsync(gateway, providerChargeId, reference);
        if (charge is null)
        {
            // Eventos de cobranças criadas fora do Hórus PDV: confirma o recebimento para o provedor não reenviar.
            return Ok(new ApiResponse<object> { Success = true, Message = "Evento sem cobrança correspondente." });
        }

        await chargeService.SyncAsync(charge, cancellationToken);
        return Ok(new ApiResponse<object> { Success = true, Message = "Evento processado." });
    }

    private async Task<CobrancaPagamentoAD?> FindChargeAsync(GatewayPagamentoAD gateway, string providerChargeId, string reference)
    {
        if (!string.IsNullOrWhiteSpace(providerChargeId))
        {
            var byProvider = await chargeAB.ObterPorProvedorAsync(gateway.Id, providerChargeId);
            if (byProvider is not null) return byProvider;
        }

        return reference.StartsWith("cob-", StringComparison.Ordinal)
            ? await chargeAB.ObterPorIdNoGatewayAsync(gateway.Id, reference)
            : null;
    }

    // Asaas envia o authToken cadastrado no webhook da conta no header asaas-access-token.
    private (bool, string, string) AuthenticateAsaas(GatewayPagamentoAD gateway, JsonNode? json)
    {
        var received = Request.Headers["asaas-access-token"].ToString();
        var authorized = !string.IsNullOrWhiteSpace(gateway.WebhookSecret) && SecretEquals(gateway.WebhookSecret, received);
        var payment = json?["payment"];
        return (authorized, Str(payment, "id"), Str(payment, "externalReference"));
    }

    // Mercado Pago: HMAC-SHA256 de "id:{data.id};request-id:{x-request-id};ts:{ts};" com a assinatura secreta.
    // Sem assinatura configurada, aceita o aviso: o status vem sempre da consulta autenticada à API.
    private (bool, string, string) AuthenticateMercadoPago(GatewayPagamentoAD gateway, JsonNode? json)
    {
        var type = FirstNonEmpty(Str(json, "type"), Request.Query["type"].ToString(), Request.Query["topic"].ToString());
        var dataId = FirstNonEmpty(Request.Query["data.id"].ToString(), Str(json?["data"], "id"), Request.Query["id"].ToString());
        if (!string.IsNullOrWhiteSpace(type) && type != "payment")
        {
            return (true, string.Empty, string.Empty);
        }

        if (string.IsNullOrWhiteSpace(gateway.WebhookSecret))
        {
            return (true, dataId, string.Empty);
        }

        var signature = Request.Headers["x-signature"].ToString();
        var requestId = Request.Headers["x-request-id"].ToString();
        var parts = signature.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(part => part.Split('=', 2))
            .Where(pair => pair.Length == 2)
            .ToDictionary(pair => pair[0].Trim(), pair => pair[1].Trim(), StringComparer.OrdinalIgnoreCase);
        if (!parts.TryGetValue("ts", out var ts) || !parts.TryGetValue("v1", out var hash) ||
            string.IsNullOrWhiteSpace(requestId) || string.IsNullOrWhiteSpace(dataId) ||
            !long.TryParse(ts, out var tsValue))
        {
            return (false, string.Empty, string.Empty);
        }

        var timestamp = ts.Length > 10
            ? DateTimeOffset.FromUnixTimeMilliseconds(tsValue)
            : DateTimeOffset.FromUnixTimeSeconds(tsValue);
        if ((DateTimeOffset.UtcNow - timestamp).Duration() > MercadoPagoSignatureTolerance)
        {
            return (false, string.Empty, string.Empty);
        }

        // A documentação usa o id em minúsculas no manifesto; o simulador às vezes assina o original.
        var authorized = new[] { dataId.ToLowerInvariant(), dataId }.Distinct().Any(id =>
            SecretEquals(HmacHex(gateway.WebhookSecret, $"id:{id};request-id:{requestId};ts:{ts};"), hash.ToLowerInvariant()));
        return (authorized, dataId, string.Empty);
    }

    // PagBank assina com sha256(token + "-" + corpo bruto) no header x-authenticity-token.
    private (bool, string, string) AuthenticatePagBank(GatewayPagamentoAD gateway, string body, JsonNode? json)
    {
        var token = HorusPaymentGatewayService.NormalizeToken(gateway.AccessToken);
        var received = Request.Headers["x-authenticity-token"].ToString().Trim().ToLowerInvariant();
        if (token.Length == 0 || received.Length != 64)
        {
            return (false, string.Empty, string.Empty);
        }

        var expected = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{token}-{body}"))).ToLowerInvariant();
        return (SecretEquals(expected, received), Str(json, "id"), Str(json, "reference_id"));
    }

    private async Task<string?> ReadBodyAsync(CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[8192];
        int read;
        while ((read = await Request.Body.ReadAsync(chunk, cancellationToken)) > 0)
        {
            if (buffer.Length + read > MaxBodyBytes) return null;
            buffer.Write(chunk, 0, read);
        }

        return Encoding.UTF8.GetString(buffer.ToArray());
    }

    private static JsonNode? ParseJson(string body)
    {
        try
        {
            return string.IsNullOrWhiteSpace(body) ? null : JsonNode.Parse(body);
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    private static string HmacHex(string secret, string manifest)
        => Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(manifest))).ToLowerInvariant();

    /// <summary>Compara pelos hashes, em tempo constante, para não vazar o tamanho nem o conteúdo do segredo.</summary>
    private static bool SecretEquals(string expected, string received)
        => !string.IsNullOrEmpty(received) &&
           CryptographicOperations.FixedTimeEquals(
               SHA256.HashData(Encoding.UTF8.GetBytes(expected.Trim())),
               SHA256.HashData(Encoding.UTF8.GetBytes(received.Trim())));

    private static string Str(JsonNode? node, string property)
    {
        try
        {
            var value = node?[property];
            return value is JsonValue jsonValue ? jsonValue.ToString() : string.Empty;
        }
        catch (InvalidOperationException)
        {
            return string.Empty;
        }
    }

    private static string FirstNonEmpty(params string[] values)
        => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static ApiResponse<object> Fail(string message) => new() { Success = false, Message = message };
}
