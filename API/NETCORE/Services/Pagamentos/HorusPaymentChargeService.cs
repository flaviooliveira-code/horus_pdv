/**
 * Arquivo: API/NETCORE/Services/Pagamentos/HorusPaymentChargeService.cs
 * Objetivo: orquestra a emissão, a sincronização e o cancelamento de cobranças PIX/boleto.
 * Entradas esperadas: empresa da sessão, pedido de cobrança validado e gateways cadastrados.
 */
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;

namespace HORUSPDV_API.Services.Pagamentos;

public class HorusPaymentChargeService(
    GatewayPagamentoAB gatewayAB,
    CobrancaPagamentoAB chargeAB,
    ClienteAB clienteAB,
    EmpresaAB empresaAB,
    HorusPaymentProviderClient providerClient,
    IConfiguration configuration)
{
    public const int PixExpirationMinutes = 30;
    private const long MinimumAmountCents = 100;
    private const long MaximumAmountCents = 10_000_000_00;

    public static string ProviderKey(string provider) => provider.ToLowerInvariant().Replace('_', '-');

    /// <summary>URL pública do webhook, ou null quando <c>Payments:WebhookPublicBaseUrl</c> não está configurado.</summary>
    public string? WebhookUrl(GatewayPagamentoAD gateway)
    {
        var baseUrl = configuration["Payments:WebhookPublicBaseUrl"]?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl) ||
            !Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps)
        {
            return null;
        }

        return $"{baseUrl}/api/Webhooks/{ProviderKey(gateway.Provider)}/{Uri.EscapeDataString(gateway.Id)}";
    }

    public async Task<(CobrancaPagamentoAD Charge, GatewayPagamentoAD Gateway)> CreateAsync(
        string companyId,
        string createdBy,
        CobrancaPagamentoRequest request,
        CancellationToken ct)
    {
        var method = (request.Method ?? string.Empty).Trim().ToUpperInvariant();
        if (method is not ("PIX" or "BOLETO"))
        {
            throw new PaymentProviderException("Informe o método da cobrança: PIX ou BOLETO.");
        }

        if (request.AmountCents < MinimumAmountCents || request.AmountCents > MaximumAmountCents)
        {
            throw new PaymentProviderException("O valor da cobrança deve ser de pelo menos R$ 1,00.");
        }

        var gateway = string.IsNullOrWhiteSpace(request.GatewayId)
            ? await gatewayAB.ObterPadraoAsync(companyId, method)
            : await gatewayAB.ObterAsync(companyId, request.GatewayId.Trim());
        if (gateway is null)
        {
            throw new PaymentProviderException(method == "PIX"
                ? "Nenhum gateway padrão para PIX. Configure em Pagamentos Integrados."
                : "Nenhum gateway padrão para boleto. Configure em Pagamentos Integrados.");
        }

        if (!gateway.Active)
        {
            throw new PaymentProviderException($"O gateway {gateway.Name} está inativo.");
        }

        if (method == "BOLETO" && gateway.PixOnly)
        {
            throw new PaymentProviderException($"O gateway {gateway.Name} está configurado como Somente PIX.");
        }

        var payer = await ResolvePayerAsync(companyId, request, ct);
        ValidatePayer(gateway, method, payer);

        var dueDays = Math.Clamp(request.DueDays ?? gateway.BoletoDueDays ?? 3, 1, 60);
        var charge = new CobrancaPagamentoAD
        {
            Id = $"cob-{Guid.NewGuid():N}",
            CompanyId = companyId,
            GatewayId = gateway.Id,
            Provider = gateway.Provider,
            Method = method,
            AmountCents = request.AmountCents,
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? (method == "PIX" ? "Venda Hórus PDV" : "Cobrança Hórus PDV")
                : request.Description.Trim(),
            Status = "PENDING",
            PayerName = payer.Name,
            PayerDocument = payer.Document,
            PayerEmail = payer.Email,
            CustomerId = request.CustomerId?.Trim() ?? string.Empty,
            CreatedBy = createdBy
        };

        // Grava antes de chamar o provedor: se a resposta se perder, a cobrança fica rastreável.
        await chargeAB.InserirAsync(charge);
        try
        {
            var state = await providerClient.CreateAsync(
                gateway,
                new ChargeCreation(
                    charge.Id,
                    method,
                    charge.AmountCents,
                    charge.Description,
                    payer,
                    DateTime.Today.AddDays(dueDays),
                    DateTimeOffset.UtcNow.AddMinutes(PixExpirationMinutes),
                    WebhookUrl(gateway)),
                ct);
            Apply(charge, state);
            if (string.IsNullOrWhiteSpace(charge.ProviderChargeId))
            {
                throw new PaymentProviderException("O provedor não devolveu o identificador da cobrança.");
            }

            if (method == "PIX" && string.IsNullOrWhiteSpace(charge.PixCopyPaste))
            {
                throw new PaymentProviderException("O provedor não devolveu o código PIX copia e cola.");
            }
        }
        catch (PaymentProviderException exception)
        {
            charge.Status = "FAILED";
            charge.LastError = exception.Message;
            await chargeAB.AtualizarDoProvedorAsync(charge);
            throw;
        }

        await chargeAB.AtualizarDoProvedorAsync(charge);
        return ((await chargeAB.ObterAsync(companyId, charge.Id)) ?? charge, gateway);
    }

    /// <summary>Consulta o provedor e grava o status atual. Cobranças finalizadas não são consultadas de novo.</summary>
    public async Task<CobrancaPagamentoAD> SyncAsync(CobrancaPagamentoAD charge, CancellationToken ct)
    {
        if (charge.Status != "PENDING" || string.IsNullOrWhiteSpace(charge.ProviderChargeId))
        {
            return charge;
        }

        var gateway = await gatewayAB.ObterParaWebhookAsync(charge.GatewayId);
        if (gateway is null)
        {
            return charge;
        }

        try
        {
            Apply(charge, await providerClient.GetAsync(gateway, charge, ct));
            charge.LastError = string.Empty;
        }
        catch (PaymentProviderException exception)
        {
            charge.LastError = exception.Message;
        }

        await chargeAB.AtualizarDoProvedorAsync(charge);
        return (await chargeAB.ObterAsync(charge.CompanyId, charge.Id)) ?? charge;
    }

    public async Task<(CobrancaPagamentoAD Charge, string Message)> CancelAsync(CobrancaPagamentoAD charge, CancellationToken ct)
    {
        if (charge.Status == "PAID")
        {
            throw new PaymentProviderException("Cobrança já paga não pode ser cancelada aqui. Faça o estorno no painel do provedor.");
        }

        if (charge.Status != "PENDING")
        {
            return (charge, "A cobrança já estava encerrada.");
        }

        // Confere antes de cancelar: o cliente pode ter pago enquanto o operador decidia.
        charge = await SyncAsync(charge, ct);
        if (charge.Status == "PAID")
        {
            throw new PaymentProviderException("O pagamento acabou de ser confirmado. A cobrança não foi cancelada.");
        }

        if (charge.Status != "PENDING")
        {
            return (charge, "A cobrança já estava encerrada.");
        }

        var gateway = await gatewayAB.ObterParaWebhookAsync(charge.GatewayId);
        var cancelledAtProvider = gateway is not null &&
                                  !string.IsNullOrWhiteSpace(charge.ProviderChargeId) &&
                                  await providerClient.CancelAsync(gateway, charge, ct);
        charge.Status = "CANCELLED";
        charge.ProviderStatus = cancelledAtProvider ? "CANCELLED" : charge.ProviderStatus;
        charge.LastError = string.Empty;
        await chargeAB.AtualizarDoProvedorAsync(charge);
        var message = cancelledAtProvider
            ? "Cobrança cancelada."
            : "Cobrança cancelada no Hórus PDV. No PagBank ela expira sozinha no vencimento.";
        return ((await chargeAB.ObterAsync(charge.CompanyId, charge.Id)) ?? charge, message);
    }

    private static void Apply(CobrancaPagamentoAD charge, ProviderChargeState state)
    {
        charge.Status = state.Status;
        charge.ProviderStatus = state.ProviderStatus;
        if (!string.IsNullOrWhiteSpace(state.ProviderChargeId)) charge.ProviderChargeId = state.ProviderChargeId;
        if (!string.IsNullOrWhiteSpace(state.PixCopyPaste)) charge.PixCopyPaste = state.PixCopyPaste;
        if (!string.IsNullOrWhiteSpace(state.PixQrCodeImage)) charge.PixQrCodeImage = state.PixQrCodeImage;
        if (!string.IsNullOrWhiteSpace(state.BoletoUrl)) charge.BoletoUrl = state.BoletoUrl;
        if (!string.IsNullOrWhiteSpace(state.BoletoLine)) charge.BoletoLine = state.BoletoLine;
        charge.ExpiresAt = state.ExpiresAt ?? charge.ExpiresAt;
        charge.PaidAt = state.PaidAt ?? charge.PaidAt;
    }

    private async Task<ChargePayer> ResolvePayerAsync(string companyId, CobrancaPagamentoRequest request, CancellationToken ct)
    {
        var company = await empresaAB.ObterAsync(companyId);
        // Mercado Pago e PagBank exigem e-mail do pagador; no balcão o cliente raramente informa.
        var fallbackEmail = company?.Email?.Trim() ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(request.CustomerId))
        {
            var customer = await clienteAB.ObterAsync(companyId, request.CustomerId.Trim())
                           ?? throw new PaymentProviderException("Cliente não encontrado.");
            return new ChargePayer(
                customer.CustomerName.Trim(),
                OnlyDigits(customer.Document),
                FirstNonEmpty(customer.Email, fallbackEmail),
                customer.Cep,
                customer.Address,
                customer.Number,
                customer.Neighborhood,
                customer.City,
                customer.State,
                customer.StreetComplement);
        }

        return new ChargePayer(
            string.IsNullOrWhiteSpace(request.PayerName) ? "Consumidor" : request.PayerName.Trim(),
            OnlyDigits(request.PayerDocument),
            FirstNonEmpty(request.PayerEmail, fallbackEmail));
    }

    private static void ValidatePayer(GatewayPagamentoAD gateway, string method, ChargePayer payer)
    {
        var label = HorusPaymentGatewayService.GetProviderLabel(gateway.Provider);
        var hasDocument = payer.Document.Length is 11 or 14;
        if (payer.Document.Length > 0 && !hasDocument)
        {
            throw new PaymentProviderException("CPF/CNPJ do pagador inválido.");
        }

        // Asaas e PagBank só emitem com CPF/CNPJ; boleto sempre exige.
        if (!hasDocument && (method == "BOLETO" || gateway.Provider != HorusPaymentGatewayService.MercadoPago))
        {
            throw new PaymentProviderException(method == "PIX"
                ? $"O {label} exige o CPF/CNPJ do cliente para gerar o PIX. Informe o CPF na nota."
                : "Informe o CPF/CNPJ do pagador para emitir o boleto.");
        }

        if (gateway.Provider != HorusPaymentGatewayService.Asaas && !payer.Email.Contains('@'))
        {
            throw new PaymentProviderException($"O {label} exige um e-mail do pagador. Cadastre o e-mail da empresa em Minha Empresa.");
        }

        var needsAddress = method == "BOLETO" && gateway.Provider != HorusPaymentGatewayService.Asaas;
        if (needsAddress &&
            (OnlyDigits(payer.Cep).Length != 8 || string.IsNullOrWhiteSpace(payer.Street) ||
             string.IsNullOrWhiteSpace(payer.Number) || string.IsNullOrWhiteSpace(payer.Neighborhood) ||
             string.IsNullOrWhiteSpace(payer.City) || payer.Uf.Trim().Length != 2))
        {
            throw new PaymentProviderException($"O boleto do {label} exige o endereço completo do cliente (CEP, rua, número, bairro, cidade e UF).");
        }
    }

    private static string OnlyDigits(string? value) => new((value ?? string.Empty).Where(char.IsDigit).ToArray());

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim() ?? string.Empty;
}
