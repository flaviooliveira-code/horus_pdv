/**
 * Arquivo: API/NETCORE/Services/Pagamentos/HorusPaymentProviderClient.cs
 * Objetivo: cria, consulta e cancela cobranças PIX/boleto no Asaas, no Mercado Pago e no PagBank.
 * Entradas esperadas: recebe gateway com credencial descriptografada e dados já validados da cobrança.
 */
using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using HORUSPDV_API.Repositories.DataAccess;

namespace HORUSPDV_API.Services.Pagamentos;

public sealed class PaymentProviderException(string message) : Exception(message);

public sealed record ChargePayer(
    string Name,
    string Document,
    string Email,
    string Cep = "",
    string Street = "",
    string Number = "",
    string Neighborhood = "",
    string City = "",
    string Uf = "",
    string Complement = "");

public sealed record ChargeCreation(
    string ChargeId,
    string Method,
    long AmountCents,
    string Description,
    ChargePayer Payer,
    DateTime BoletoDueDate,
    DateTimeOffset PixExpiresAt,
    string? NotificationUrl);

/// <summary>Estado da cobrança no provedor, já traduzido para o status interno.</summary>
public sealed record ProviderChargeState(
    string Status,
    string ProviderStatus,
    string ProviderChargeId = "",
    string PixCopyPaste = "",
    string PixQrCodeImage = "",
    string BoletoUrl = "",
    string BoletoLine = "",
    DateTime? ExpiresAt = null,
    DateTime? PaidAt = null);

public class HorusPaymentProviderClient(HttpClient httpClient, IConfiguration configuration)
{
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    public Task<ProviderChargeState> CreateAsync(GatewayPagamentoAD gateway, ChargeCreation charge, CancellationToken ct)
        => gateway.Provider switch
        {
            HorusPaymentGatewayService.Asaas => CreateAsaasAsync(gateway, charge, ct),
            HorusPaymentGatewayService.MercadoPago => CreateMercadoPagoAsync(gateway, charge, ct),
            HorusPaymentGatewayService.PagBank => CreatePagBankAsync(gateway, charge, ct),
            _ => throw new PaymentProviderException("Gateway não suportado.")
        };

    public Task<ProviderChargeState> GetAsync(GatewayPagamentoAD gateway, CobrancaPagamentoAD charge, CancellationToken ct)
        => gateway.Provider switch
        {
            HorusPaymentGatewayService.Asaas => GetAsaasAsync(gateway, charge.ProviderChargeId, ct),
            HorusPaymentGatewayService.MercadoPago => GetMercadoPagoAsync(gateway, charge.ProviderChargeId, ct),
            HorusPaymentGatewayService.PagBank => GetPagBankAsync(gateway, charge, ct),
            _ => throw new PaymentProviderException("Gateway não suportado.")
        };

    /// <summary>Cancela no provedor. Devolve false quando o provedor não permite cancelar (a cobrança só expira).</summary>
    public async Task<bool> CancelAsync(GatewayPagamentoAD gateway, CobrancaPagamentoAD charge, CancellationToken ct)
    {
        switch (gateway.Provider)
        {
            case HorusPaymentGatewayService.Asaas:
            {
                using var response = await SendAsync(gateway, HttpMethod.Delete, $"/v3/payments/{Uri.EscapeDataString(charge.ProviderChargeId)}", null, ct);
                await EnsureSuccessAsync(gateway, response, "cancelar a cobrança", ct);
                return true;
            }
            case HorusPaymentGatewayService.MercadoPago:
            {
                using var response = await SendAsync(gateway, HttpMethod.Put, $"/v1/payments/{Uri.EscapeDataString(charge.ProviderChargeId)}", new JsonObject { ["status"] = "cancelled" }, ct);
                await EnsureSuccessAsync(gateway, response, "cancelar a cobrança", ct);
                return true;
            }
            default:
                // O PagBank não cancela QR Code nem boleto em aberto pela API de pedidos: eles expiram sozinhos.
                return false;
        }
    }

    /// <summary>Cria ou atualiza o webhook de conta do Asaas, que devolve o segredo no header asaas-access-token.</summary>
    public async Task<string> RegisterAsaasWebhookAsync(GatewayPagamentoAD gateway, string url, string secret, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["name"] = $"Hórus PDV - {gateway.Name}"[..Math.Min(120, $"Hórus PDV - {gateway.Name}".Length)],
            ["url"] = url,
            ["email"] = string.IsNullOrWhiteSpace(gateway.WebhookResponsibleEmail) ? null : gateway.WebhookResponsibleEmail,
            ["enabled"] = true,
            ["interrupted"] = false,
            ["apiVersion"] = 3,
            ["authToken"] = secret,
            ["sendType"] = "SEQUENTIALLY",
            ["events"] = new JsonArray("PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED")
        };
        var hasWebhook = !string.IsNullOrWhiteSpace(gateway.WebhookProviderId);
        using var response = await SendAsync(
            gateway,
            hasWebhook ? HttpMethod.Put : HttpMethod.Post,
            hasWebhook ? $"/v3/webhooks/{Uri.EscapeDataString(gateway.WebhookProviderId)}" : "/v3/webhooks",
            body,
            ct);
        var json = await EnsureSuccessAsync(gateway, response, "cadastrar o webhook", ct);
        return Str(json, "id") is { Length: > 0 } id ? id : gateway.WebhookProviderId;
    }

    // ---------------------------------------------------------------- Asaas

    private async Task<ProviderChargeState> CreateAsaasAsync(GatewayPagamentoAD gateway, ChargeCreation charge, CancellationToken ct)
    {
        var customerId = await FindOrCreateAsaasCustomerAsync(gateway, charge.Payer, ct);
        var isBoleto = charge.Method == "BOLETO";
        var body = new JsonObject
        {
            ["customer"] = customerId,
            ["billingType"] = isBoleto ? "BOLETO" : "PIX",
            ["value"] = ToDecimal(charge.AmountCents),
            ["dueDate"] = (isBoleto ? charge.BoletoDueDate : DateTime.Today).ToString("yyyy-MM-dd", Invariant),
            ["description"] = charge.Description,
            ["externalReference"] = charge.ChargeId
        };
        if (isBoleto && gateway.FinePercent is > 0) body["fine"] = new JsonObject { ["value"] = gateway.FinePercent };
        if (isBoleto && gateway.MonthlyInterestPercent is > 0) body["interest"] = new JsonObject { ["value"] = gateway.MonthlyInterestPercent };

        using var response = await SendAsync(gateway, HttpMethod.Post, "/v3/payments", body, ct);
        var payment = await EnsureSuccessAsync(gateway, response, "emitir a cobrança", ct);
        var state = MapAsaasPayment(payment);
        return await CompleteAsaasDetailsAsync(gateway, state, isBoleto, ct);
    }

    private async Task<ProviderChargeState> GetAsaasAsync(GatewayPagamentoAD gateway, string providerChargeId, CancellationToken ct)
    {
        using var response = await SendAsync(gateway, HttpMethod.Get, $"/v3/payments/{Uri.EscapeDataString(providerChargeId)}", null, ct);
        return MapAsaasPayment(await EnsureSuccessAsync(gateway, response, "consultar a cobrança", ct));
    }

    private async Task<ProviderChargeState> CompleteAsaasDetailsAsync(GatewayPagamentoAD gateway, ProviderChargeState state, bool isBoleto, CancellationToken ct)
    {
        var id = Uri.EscapeDataString(state.ProviderChargeId);
        if (isBoleto)
        {
            using var lineResponse = await SendAsync(gateway, HttpMethod.Get, $"/v3/payments/{id}/identificationField", null, ct);
            if (!lineResponse.IsSuccessStatusCode) return state;
            var line = await ReadJsonAsync(lineResponse, ct);
            return state with { BoletoLine = Str(line, "identificationField") };
        }

        using var qrResponse = await SendAsync(gateway, HttpMethod.Get, $"/v3/payments/{id}/pixQrCode", null, ct);
        var qr = await EnsureSuccessAsync(gateway, qrResponse, "gerar o QR Code PIX", ct);
        return state with
        {
            PixCopyPaste = Str(qr, "payload"),
            PixQrCodeImage = Str(qr, "encodedImage"),
            ExpiresAt = ParseDate(Str(qr, "expirationDate")) ?? state.ExpiresAt
        };
    }

    private async Task<string> FindOrCreateAsaasCustomerAsync(GatewayPagamentoAD gateway, ChargePayer payer, CancellationToken ct)
    {
        using (var search = await SendAsync(gateway, HttpMethod.Get, $"/v3/customers?cpfCnpj={Uri.EscapeDataString(payer.Document)}&limit=1", null, ct))
        {
            var found = await EnsureSuccessAsync(gateway, search, "consultar o cliente", ct);
            if (found?["data"] is JsonArray { Count: > 0 } list && Str(list[0], "id") is { Length: > 0 } existingId)
            {
                return existingId;
            }
        }

        var body = new JsonObject
        {
            ["name"] = payer.Name,
            ["cpfCnpj"] = payer.Document,
            ["email"] = string.IsNullOrWhiteSpace(payer.Email) ? null : payer.Email,
            ["postalCode"] = NullIfEmpty(OnlyDigits(payer.Cep)),
            ["address"] = NullIfEmpty(payer.Street),
            ["addressNumber"] = NullIfEmpty(payer.Number),
            ["province"] = NullIfEmpty(payer.Neighborhood),
            ["notificationDisabled"] = true
        };
        using var response = await SendAsync(gateway, HttpMethod.Post, "/v3/customers", body, ct);
        var customer = await EnsureSuccessAsync(gateway, response, "cadastrar o cliente", ct);
        return Str(customer, "id");
    }

    private static ProviderChargeState MapAsaasPayment(JsonNode? payment)
    {
        var providerStatus = Str(payment, "status");
        var deleted = payment?["deleted"]?.GetValue<bool>() == true;
        var status = deleted
            ? "CANCELLED"
            : providerStatus switch
            {
                "RECEIVED" or "CONFIRMED" or "RECEIVED_IN_CASH" => "PAID",
                "REFUNDED" or "REFUND_REQUESTED" or "CHARGEBACK_REQUESTED" => "CANCELLED",
                _ => "PENDING"
            };
        return new ProviderChargeState(
            status,
            deleted ? "DELETED" : providerStatus,
            Str(payment, "id"),
            BoletoUrl: SafeUrl(Str(payment, "bankSlipUrl")),
            ExpiresAt: ParseDate(Str(payment, "dueDate")),
            PaidAt: ParseDate(Str(payment, "clientPaymentDate")) ?? ParseDate(Str(payment, "paymentDate")));
    }

    // ---------------------------------------------------------- Mercado Pago

    private async Task<ProviderChargeState> CreateMercadoPagoAsync(GatewayPagamentoAD gateway, ChargeCreation charge, CancellationToken ct)
    {
        var isBoleto = charge.Method == "BOLETO";
        var (firstName, lastName) = SplitName(charge.Payer.Name);
        var payer = new JsonObject
        {
            ["email"] = charge.Payer.Email,
            ["first_name"] = firstName,
            ["last_name"] = lastName
        };
        if (charge.Payer.Document.Length > 0)
        {
            payer["identification"] = new JsonObject
            {
                ["type"] = charge.Payer.Document.Length == 14 ? "CNPJ" : "CPF",
                ["number"] = charge.Payer.Document
            };
        }

        if (isBoleto)
        {
            payer["address"] = new JsonObject
            {
                ["zip_code"] = OnlyDigits(charge.Payer.Cep),
                ["street_name"] = charge.Payer.Street,
                ["street_number"] = charge.Payer.Number,
                ["neighborhood"] = charge.Payer.Neighborhood,
                ["city"] = charge.Payer.City,
                ["federal_unit"] = charge.Payer.Uf
            };
        }

        var body = new JsonObject
        {
            ["transaction_amount"] = ToDecimal(charge.AmountCents),
            ["description"] = charge.Description,
            ["external_reference"] = charge.ChargeId,
            ["payment_method_id"] = isBoleto ? "bolbradesco" : "pix",
            ["date_of_expiration"] = (isBoleto
                    ? new DateTimeOffset(charge.BoletoDueDate.Date.AddHours(23).AddMinutes(59), TimeSpan.FromHours(-3))
                    : charge.PixExpiresAt.ToOffset(TimeSpan.FromHours(-3)))
                .ToString("yyyy-MM-dd'T'HH:mm:ss.fffzzz", Invariant),
            ["payer"] = payer
        };
        if (!string.IsNullOrWhiteSpace(charge.NotificationUrl)) body["notification_url"] = charge.NotificationUrl;

        using var request = BuildRequest(gateway, HttpMethod.Post, "/v1/payments", body);
        // A chave de idempotência evita duas cobranças se a resposta se perder e o operador tentar de novo.
        request.Headers.Add("X-Idempotency-Key", charge.ChargeId);
        using var response = await httpClient.SendAsync(request, ct);
        return MapMercadoPagoPayment(await EnsureSuccessAsync(gateway, response, "emitir a cobrança", ct));
    }

    private async Task<ProviderChargeState> GetMercadoPagoAsync(GatewayPagamentoAD gateway, string providerChargeId, CancellationToken ct)
    {
        using var response = await SendAsync(gateway, HttpMethod.Get, $"/v1/payments/{Uri.EscapeDataString(providerChargeId)}", null, ct);
        return MapMercadoPagoPayment(await EnsureSuccessAsync(gateway, response, "consultar a cobrança", ct));
    }

    private static ProviderChargeState MapMercadoPagoPayment(JsonNode? payment)
    {
        var providerStatus = Str(payment, "status");
        var status = providerStatus switch
        {
            "approved" or "authorized" => "PAID",
            "cancelled" => Str(payment, "status_detail") == "expired" ? "EXPIRED" : "CANCELLED",
            "rejected" => "FAILED",
            "refunded" or "charged_back" => "CANCELLED",
            _ => "PENDING"
        };
        var transaction = payment?["point_of_interaction"]?["transaction_data"];
        var details = payment?["transaction_details"];
        var image = Str(transaction, "qr_code_base64");
        return new ProviderChargeState(
            status,
            providerStatus,
            Str(payment, "id"),
            PixCopyPaste: Str(transaction, "qr_code"),
            PixQrCodeImage: IsBase64(image) ? image : string.Empty,
            BoletoUrl: SafeUrl(Str(details, "external_resource_url")),
            BoletoLine: Str(details, "digitable_line") is { Length: > 0 } line ? line : Str(payment?["barcode"], "content"),
            ExpiresAt: ParseDate(Str(payment, "date_of_expiration")),
            PaidAt: ParseDate(Str(payment, "date_approved")));
    }

    // --------------------------------------------------------------- PagBank

    private async Task<ProviderChargeState> CreatePagBankAsync(GatewayPagamentoAD gateway, ChargeCreation charge, CancellationToken ct)
    {
        var isBoleto = charge.Method == "BOLETO";
        var body = new JsonObject
        {
            ["reference_id"] = charge.ChargeId,
            ["customer"] = new JsonObject
            {
                ["name"] = charge.Payer.Name,
                ["email"] = charge.Payer.Email,
                ["tax_id"] = charge.Payer.Document
            },
            ["items"] = new JsonArray(new JsonObject
            {
                ["reference_id"] = charge.ChargeId,
                ["name"] = charge.Description,
                ["quantity"] = 1,
                ["unit_amount"] = charge.AmountCents
            })
        };
        if (!string.IsNullOrWhiteSpace(charge.NotificationUrl)) body["notification_urls"] = new JsonArray(charge.NotificationUrl);

        if (isBoleto)
        {
            body["charges"] = new JsonArray(new JsonObject
            {
                ["reference_id"] = charge.ChargeId,
                ["description"] = charge.Description,
                ["amount"] = new JsonObject { ["value"] = charge.AmountCents, ["currency"] = "BRL" },
                ["payment_method"] = new JsonObject
                {
                    ["type"] = "BOLETO",
                    ["boleto"] = new JsonObject
                    {
                        ["due_date"] = charge.BoletoDueDate.ToString("yyyy-MM-dd", Invariant),
                        ["instruction_lines"] = new JsonObject
                        {
                            ["line_1"] = "Pagamento processado pelo Hórus PDV",
                            ["line_2"] = "Não receber após o vencimento"
                        },
                        ["holder"] = new JsonObject
                        {
                            ["name"] = charge.Payer.Name,
                            ["tax_id"] = charge.Payer.Document,
                            ["email"] = charge.Payer.Email,
                            ["address"] = new JsonObject
                            {
                                ["street"] = charge.Payer.Street,
                                ["number"] = charge.Payer.Number,
                                ["locality"] = charge.Payer.Neighborhood,
                                ["city"] = charge.Payer.City,
                                ["region_code"] = charge.Payer.Uf,
                                ["country"] = "BRA",
                                ["postal_code"] = OnlyDigits(charge.Payer.Cep)
                            }
                        }
                    }
                }
            });
        }
        else
        {
            body["qr_codes"] = new JsonArray(new JsonObject
            {
                ["amount"] = new JsonObject { ["value"] = charge.AmountCents },
                ["expiration_date"] = charge.PixExpiresAt.ToOffset(TimeSpan.FromHours(-3)).ToString("yyyy-MM-dd'T'HH:mm:sszzz", Invariant)
            });
        }

        using var response = await SendAsync(gateway, HttpMethod.Post, "/orders", body, ct);
        return MapPagBankOrder(await EnsureSuccessAsync(gateway, response, "emitir a cobrança", ct));
    }

    private async Task<ProviderChargeState> GetPagBankAsync(GatewayPagamentoAD gateway, CobrancaPagamentoAD charge, CancellationToken ct)
    {
        using var response = await SendAsync(gateway, HttpMethod.Get, $"/orders/{Uri.EscapeDataString(charge.ProviderChargeId)}", null, ct);
        var state = MapPagBankOrder(await EnsureSuccessAsync(gateway, response, "consultar a cobrança", ct));
        // O PIX do PagBank não muda de status ao vencer: sem pagamento depois da validade, está expirado.
        if (state.Status == "PENDING" && charge.Method == "PIX" && (state.ExpiresAt ?? charge.ExpiresAt) < DateTime.UtcNow)
        {
            return state with { Status = "EXPIRED", ProviderStatus = "EXPIRED" };
        }

        return state;
    }

    private static ProviderChargeState MapPagBankOrder(JsonNode? order)
    {
        var charge = order?["charges"] is JsonArray { Count: > 0 } charges ? charges[0] : null;
        var qrCode = order?["qr_codes"] is JsonArray { Count: > 0 } codes ? codes[0] : null;
        var providerStatus = charge is null ? "WAITING" : Str(charge, "status");
        var status = providerStatus switch
        {
            "PAID" => "PAID",
            "DECLINED" => "FAILED",
            "CANCELED" => "CANCELLED",
            _ => "PENDING"
        };
        var boleto = charge?["payment_method"]?["boleto"];
        return new ProviderChargeState(
            status,
            providerStatus,
            Str(order, "id"),
            PixCopyPaste: Str(qrCode, "text"),
            PixQrCodeImage: FindLink(qrCode, rel: "QRCODE.PNG"),
            BoletoUrl: FindLink(charge, media: "application/pdf"),
            BoletoLine: Str(boleto, "formatted_barcode"),
            ExpiresAt: ParseDate(Str(qrCode, "expiration_date")) ?? ParseDate(Str(boleto, "due_date")),
            PaidAt: ParseDate(Str(charge, "paid_at")));
    }

    // --------------------------------------------------------------- HTTP

    private string BaseUrl(GatewayPagamentoAD gateway) => gateway.Provider switch
    {
        HorusPaymentGatewayService.Asaas => gateway.Environment == "SANDBOX"
            ? "https://api-sandbox.asaas.com"
            : "https://api.asaas.com",
        HorusPaymentGatewayService.MercadoPago =>
            (configuration["Payments:MercadoPagoApiBaseUrl"] ?? "https://api.mercadopago.com").TrimEnd('/'),
        HorusPaymentGatewayService.PagBank => gateway.Environment == "SANDBOX"
            ? "https://sandbox.api.pagseguro.com"
            : "https://api.pagseguro.com",
        _ => throw new PaymentProviderException("Gateway não suportado.")
    };

    private HttpRequestMessage BuildRequest(GatewayPagamentoAD gateway, HttpMethod method, string path, JsonNode? body)
    {
        var request = new HttpRequestMessage(method, BaseUrl(gateway) + path);
        var token = HorusPaymentGatewayService.NormalizeToken(gateway.AccessToken);
        if (gateway.Provider == HorusPaymentGatewayService.Asaas)
        {
            request.Headers.Add("access_token", token);
        }
        else
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        request.Headers.UserAgent.ParseAdd("HorusPDV/1.0");
        if (body is not null)
        {
            request.Content = new StringContent(
                body.ToJsonString(new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull }),
                Encoding.UTF8,
                "application/json");
        }

        return request;
    }

    private async Task<HttpResponseMessage> SendAsync(GatewayPagamentoAD gateway, HttpMethod method, string path, JsonNode? body, CancellationToken ct)
    {
        using var request = BuildRequest(gateway, method, path, body);
        try
        {
            return await httpClient.SendAsync(request, ct);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            throw new PaymentProviderException(
                $"Não foi possível falar com o {HorusPaymentGatewayService.GetProviderLabel(gateway.Provider)} agora. Tente novamente.");
        }
    }

    private static async Task<JsonNode?> EnsureSuccessAsync(GatewayPagamentoAD gateway, HttpResponseMessage response, string action, CancellationToken ct)
    {
        var json = await ReadJsonAsync(response, ct);
        if (response.IsSuccessStatusCode) return json;

        var label = HorusPaymentGatewayService.GetProviderLabel(gateway.Provider);
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            throw new PaymentProviderException($"{label} recusou a credencial ao {action}. Valide o gateway em Pagamentos Integrados.");
        }

        var detail = ReadProviderError(json);
        throw new PaymentProviderException(string.IsNullOrWhiteSpace(detail)
            ? $"{label} respondeu HTTP {(int)response.StatusCode} ao {action}."
            : $"{label} não conseguiu {action}: {detail}");
    }

    private static async Task<JsonNode?> ReadJsonAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            return string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Extrai a mensagem de erro nos formatos de Asaas (errors[].description), Mercado Pago (message) e PagBank (error_messages[].description).</summary>
    private static string ReadProviderError(JsonNode? json)
    {
        var message =
            (json?["errors"] is JsonArray { Count: > 0 } asaas ? Str(asaas[0], "description") : string.Empty) is { Length: > 0 } a ? a :
            (json?["error_messages"] is JsonArray { Count: > 0 } pagbank ? Str(pagbank[0], "description") : string.Empty) is { Length: > 0 } p ? p :
            Str(json, "message");
        return message.Length > 240 ? message[..240] : message;
    }

    // --------------------------------------------------------------- helpers

    private static string Str(JsonNode? node, string property)
    {
        var value = node?[property];
        if (value is null) return string.Empty;
        return value.GetValueKind() switch
        {
            JsonValueKind.String => value.GetValue<string>() ?? string.Empty,
            JsonValueKind.Number => value.ToJsonString(),
            _ => string.Empty
        };
    }

    private static string FindLink(JsonNode? node, string? rel = null, string? media = null)
    {
        if (node?["links"] is not JsonArray links) return string.Empty;
        foreach (var link in links)
        {
            if ((rel is null || Str(link, "rel").Equals(rel, StringComparison.OrdinalIgnoreCase)) &&
                (media is null || Str(link, "media").Equals(media, StringComparison.OrdinalIgnoreCase)))
            {
                return SafeUrl(Str(link, "href"));
            }
        }

        return string.Empty;
    }

    /// <summary>Só aceita links HTTPS sem usuário/senha, para não exibir URLs arbitrárias vindas da resposta.</summary>
    private static string SafeUrl(string value)
        => Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(uri.UserInfo)
            ? uri.ToString()
            : string.Empty;

    private static bool IsBase64(string value)
        => value.Length is > 0 and < 400_000 && value.All(c => char.IsAsciiLetterOrDigit(c) || c is '+' or '/' or '=');

    private static DateTime? ParseDate(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateTimeOffset.TryParse(value, Invariant, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.UtcDateTime
            : null;
    }

    private static decimal ToDecimal(long cents) => Math.Round(cents / 100m, 2);

    private static string OnlyDigits(string value) => new(value.Where(char.IsDigit).ToArray());

    private static string? NullIfEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static (string First, string Last) SplitName(string name)
    {
        var parts = name.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length switch
        {
            0 => ("Consumidor", "PDV"),
            1 => (parts[0], parts[0]),
            _ => (parts[0], parts[1])
        };
    }
}
