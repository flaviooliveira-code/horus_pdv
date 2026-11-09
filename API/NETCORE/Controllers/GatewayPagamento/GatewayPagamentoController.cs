/**
 * Arquivo: API/NETCORE/Controllers/GatewayPagamento/GatewayPagamentoController.cs
 * Objetivo: expõe o cadastro de gateways de pagamento (Asaas, Mercado Pago e PagBank) da empresa e o teste de credencial.
 * Entradas esperadas: recebe requisições REST autenticadas; credenciais entram em texto e saem apenas mascaradas.
 */
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Pagamentos;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.GatewayPagamento;

[ApiController]
[Route("api/[controller]")]
[HorusAuthorizeRoles("administrador", "gerente")]
public class GatewayPagamentoController(
    GatewayPagamentoAB gatewayAB,
    HorusPaymentGatewayService gatewayService,
    HorusPaymentChargeService chargeService,
    HorusPaymentProviderClient providerClient) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return SessionNotFound<List<GatewayPagamentoResponse>>();

        var gateways = await gatewayAB.ListarAsync(currentUser.CompanyId);
        return Ok(new ApiResponse<List<GatewayPagamentoResponse>>
        {
            Success = true,
            Message = "Gateways obtidos com sucesso.",
            Data = gateways.Select(ToResponse).ToList()
        });
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] GatewayPagamentoRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return SessionNotFound<GatewayPagamentoResponse>();

        var validationMessage = Validate(request, current: null);
        if (validationMessage is not null) return BadRequestResponse(validationMessage);

        var gateway = ToDataAccess(request, current: null);
        gateway.Id = $"gtw-{Guid.NewGuid():N}";
        gateway.CompanyId = currentUser.CompanyId;

        var saved = await gatewayAB.SalvarAsync(gateway, isNew: true);
        return Ok(new ApiResponse<GatewayPagamentoResponse>
        {
            Success = true,
            Message = "Gateway cadastrado com sucesso.",
            Data = ToResponse(saved)
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(string id, [FromBody] GatewayPagamentoRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return SessionNotFound<GatewayPagamentoResponse>();

        var current = await gatewayAB.ObterAsync(currentUser.CompanyId, id);
        if (current is null) return GatewayNotFound();

        var validationMessage = Validate(request, current);
        if (validationMessage is not null) return BadRequestResponse(validationMessage);

        var gateway = ToDataAccess(request, current);
        gateway.Id = current.Id;
        gateway.CompanyId = current.CompanyId;

        var saved = await gatewayAB.SalvarAsync(gateway, isNew: false);
        return Ok(new ApiResponse<GatewayPagamentoResponse>
        {
            Success = true,
            Message = "Gateway atualizado com sucesso.",
            Data = ToResponse(saved)
        });
    }

    [HttpPost("{id}/validate")]
    public async Task<IActionResult> Validar(string id, CancellationToken cancellationToken)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return SessionNotFound<GatewayPagamentoResponse>();

        var current = await gatewayAB.ObterAsync(currentUser.CompanyId, id);
        if (current is null) return GatewayNotFound();

        var result = await gatewayService.ValidateConnectionAsync(current, cancellationToken);
        if (result.Status == "OK")
        {
            result = result with { Message = $"{result.Message} {await SyncWebhookAsync(current, cancellationToken)}".Trim() };
        }

        var saved = await gatewayAB.RegistrarValidacaoAsync(
            currentUser.CompanyId,
            current.Id,
            result.Status,
            result.Message);

        return Ok(new ApiResponse<GatewayPagamentoResponse>
        {
            Success = true,
            Message = result.Message,
            Data = ToResponse(saved ?? current)
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Excluir(string id)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return SessionNotFound<object>();

        var removed = await gatewayAB.ExcluirAsync(currentUser.CompanyId, id);
        if (!removed) return GatewayNotFound();

        return Ok(new ApiResponse<object> { Success = true, Message = "Gateway removido com sucesso." });
    }

    /// <summary>
    /// Mercado Pago e PagBank recebem a URL de aviso em cada cobrança; o Asaas usa um webhook de conta,
    /// cadastrado aqui com um segredo gerado pela API. Sem URL pública, o PDV consulta o provedor.
    /// </summary>
    private async Task<string> SyncWebhookAsync(GatewayPagamentoAD gateway, CancellationToken cancellationToken)
    {
        var url = chargeService.WebhookUrl(gateway);
        if (url is null)
        {
            return "Sem URL pública de webhook (Payments:WebhookPublicBaseUrl): o PDV confere os pagamentos consultando o provedor.";
        }

        if (gateway.Provider != HorusPaymentGatewayService.Asaas)
        {
            return "A URL de aviso vai junto de cada cobrança.";
        }

        var secret = string.IsNullOrWhiteSpace(gateway.WebhookSecret)
            ? Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(24)).ToLowerInvariant()
            : gateway.WebhookSecret;
        try
        {
            var webhookId = await providerClient.RegisterAsaasWebhookAsync(gateway, url, secret, cancellationToken);
            await gatewayAB.RegistrarWebhookAsync(gateway.Id, webhookId, secret);
            return "Webhook sincronizado no Asaas.";
        }
        catch (PaymentProviderException exception)
        {
            return $"Webhook não cadastrado: {exception.Message}";
        }
    }

    private static string? Validate(GatewayPagamentoRequest request, GatewayPagamentoAD? current)
    {
        if (!HorusPaymentGatewayService.SupportedProviders.Contains(request.Provider))
        {
            return "Use Asaas, Mercado Pago ou PagBank.";
        }

        if (!HorusPaymentGatewayService.SupportedEnvironments.Contains(request.Environment))
        {
            return "Ambiente inválido. Use Produção ou Sandbox.";
        }

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length < 2)
        {
            return "Informe um nome para o gateway.";
        }

        if (request.Provider == HorusPaymentGatewayService.MercadoPago &&
            HorusPaymentGatewayService.LooksLikeMercadoPagoPublicKey(request.AccessToken))
        {
            return HorusPaymentGatewayService.MercadoPagoPublicKeyMessage;
        }

        var hasNewToken = HorusPaymentGatewayService.NormalizeToken(request.AccessToken).Length > 0;
        var keepsToken = current is not null && current.Provider == request.Provider &&
                         !string.IsNullOrWhiteSpace(current.AccessToken);
        if (!hasNewToken && !keepsToken)
        {
            return request.Provider == HorusPaymentGatewayService.Asaas
                ? "Informe a API Key do Asaas."
                : $"Informe o Access Token do {HorusPaymentGatewayService.GetProviderLabel(request.Provider)}.";
        }

        if (request.BoletoDueDays is < 1 or > 60)
        {
            return "Dias para vencimento do boleto devem ficar entre 1 e 60.";
        }

        if (request.FinePercent is < 0 or > 20)
        {
            return "Multa deve ficar entre 0% e 20%.";
        }

        if (request.MonthlyInterestPercent is < 0 or > 20)
        {
            return "Juros mensais devem ficar entre 0% e 20%.";
        }

        if (!string.IsNullOrWhiteSpace(request.WebhookResponsibleEmail) &&
            !request.WebhookResponsibleEmail.Contains('@'))
        {
            return "Informe um e-mail válido para avisos do webhook.";
        }

        return null;
    }

    private static GatewayPagamentoAD ToDataAccess(GatewayPagamentoRequest source, GatewayPagamentoAD? current)
    {
        var sameProvider = current is not null && current.Provider == source.Provider;
        var newToken = HorusPaymentGatewayService.NormalizeToken(source.AccessToken);
        var accessToken = newToken.Length > 0 ? newToken : sameProvider ? current!.AccessToken : string.Empty;
        var newWebhookSecret = source.WebhookSecret.Trim();
        // Mercado Pago: segredo informado pelo usuário. Asaas: segredo gerado pela API ao cadastrar o
        // webhook da conta (Validar), mantido nas edições. PagBank assina com o próprio token.
        var webhookSecret = source.Provider switch
        {
            HorusPaymentGatewayService.MercadoPago => newWebhookSecret.Length > 0
                ? newWebhookSecret
                : sameProvider ? current!.WebhookSecret : string.Empty,
            HorusPaymentGatewayService.Asaas => sameProvider ? current!.WebhookSecret : string.Empty,
            _ => string.Empty
        };
        var pixOnly = HorusPaymentGatewayService.SupportsPixOnly(source.Provider) && source.PixOnly;

        // Trocar credencial, provedor ou ambiente exige validar de novo.
        var credentialChanged = current is null ||
                                !sameProvider ||
                                current.Environment != source.Environment ||
                                newToken.Length > 0;
        var status = !source.Active
            ? "DISABLED"
            : credentialChanged || current!.Status == "DISABLED" ? "PENDING" : current.Status;
        var message = status switch
        {
            "DISABLED" => "Gateway inativo. Ative para usar em cobranças.",
            "PENDING" => "Clique em Validar para testar a credencial no provedor.",
            _ => current?.LastValidationMessage ?? string.Empty
        };

        return new GatewayPagamentoAD
        {
            Provider = source.Provider,
            Name = source.Name.Trim(),
            Environment = source.Environment,
            Active = source.Active,
            DefaultPix = source.DefaultPix || pixOnly,
            DefaultBoleto = !pixOnly && source.DefaultBoleto,
            PixOnly = pixOnly,
            GenerateBoletoPix = pixOnly || source.GenerateBoletoPix,
            AccessToken = accessToken,
            AccessTokenMask = HorusPaymentGatewayService.MaskSecret(accessToken),
            PublicKey = source.Provider == HorusPaymentGatewayService.MercadoPago ? source.PublicKey.Trim() : string.Empty,
            WebhookSecret = webhookSecret,
            WebhookSecretMask = HorusPaymentGatewayService.MaskSecret(webhookSecret),
            WebhookResponsibleEmail = source.Provider == HorusPaymentGatewayService.Asaas
                ? source.WebhookResponsibleEmail.Trim()
                : string.Empty,
            BoletoDueDays = source.BoletoDueDays,
            FinePercent = source.FinePercent,
            MonthlyInterestPercent = source.MonthlyInterestPercent,
            Status = status,
            LastValidationMessage = message
        };
    }

    private static GatewayPagamentoResponse ToResponse(GatewayPagamentoAD source) => new()
    {
        Id = source.Id,
        Provider = source.Provider,
        Name = source.Name,
        Environment = source.Environment,
        Active = source.Active,
        DefaultPix = source.DefaultPix,
        DefaultBoleto = source.DefaultBoleto,
        PixOnly = source.PixOnly,
        GenerateBoletoPix = source.GenerateBoletoPix,
        AccessTokenMask = source.AccessTokenMask,
        PublicKey = source.PublicKey,
        WebhookSecretMask = source.WebhookSecretMask,
        WebhookResponsibleEmail = source.WebhookResponsibleEmail,
        BoletoDueDays = source.BoletoDueDays,
        FinePercent = source.FinePercent,
        MonthlyInterestPercent = source.MonthlyInterestPercent,
        Status = source.Status,
        LastValidatedAt = source.LastValidatedAt?.ToString("O"),
        LastValidationMessage = source.LastValidationMessage,
        CreatedAt = source.CreatedAt.ToString("O"),
        UpdatedAt = source.UpdatedAt.ToString("O"),
        WebhookLastEventAt = source.WebhookLastEventAt?.ToString("O")
    };

    private UnauthorizedObjectResult SessionNotFound<T>()
        => Unauthorized(new ApiResponse<T> { Success = false, Message = "Sessão não encontrada." });

    private NotFoundObjectResult GatewayNotFound()
        => NotFound(new ApiResponse<GatewayPagamentoResponse> { Success = false, Message = "Gateway não encontrado." });

    private BadRequestObjectResult BadRequestResponse(string message)
        => BadRequest(new ApiResponse<GatewayPagamentoResponse> { Success = false, Message = message });

    private AuthenticatedUser? GetCurrentUser()
        => HttpContext.Items["CurrentUser"] as AuthenticatedUser;
}
