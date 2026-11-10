/**
 * Arquivo: API/NETCORE/Controllers/CobrancaPagamento/CobrancaPagamentoController.cs
 * Objetivo: expõe emissão, consulta e cancelamento de cobranças PIX/boleto pelos gateways da empresa.
 * Entradas esperadas: requisições autenticadas da frente de caixa e da tela de Pagamentos Integrados.
 */
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Pagamentos;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.CobrancaPagamento;

[ApiController]
[Route("api/[controller]")]
public class CobrancaPagamentoController(
    CobrancaPagamentoAB chargeAB,
    GatewayPagamentoAB gatewayAB,
    HorusPaymentChargeService chargeService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return SessionNotFound();

        var charges = await chargeAB.ListarAsync(currentUser.CompanyId);
        var gatewayNames = await GatewayNamesAsync(currentUser.CompanyId);
        return Ok(new ApiResponse<List<CobrancaPagamentoResponse>>
        {
            Success = true,
            Message = "Cobranças obtidas com sucesso.",
            Data = charges.Select(charge => ToResponse(charge, gatewayNames)).ToList()
        });
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CobrancaPagamentoRequest request, CancellationToken cancellationToken)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return SessionNotFound();

        try
        {
            var (charge, gateway) = await chargeService.CreateAsync(
                currentUser.CompanyId,
                currentUser.Name,
                request,
                cancellationToken);
            return Ok(new ApiResponse<CobrancaPagamentoResponse>
            {
                Success = true,
                Message = charge.Method == "PIX" ? "QR Code PIX gerado." : "Boleto emitido.",
                Data = ToResponse(charge, new Dictionary<string, string> { [gateway.Id] = gateway.Name })
            });
        }
        catch (PaymentProviderException exception)
        {
            return BadRequest(new ApiResponse<CobrancaPagamentoResponse> { Success = false, Message = exception.Message });
        }
    }

    /// <summary>Consulta a cobrança e sincroniza o status no provedor (usado pelo PDV enquanto aguarda o PIX).</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> Obter(string id, CancellationToken cancellationToken)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return SessionNotFound();

        var charge = await chargeAB.ObterAsync(currentUser.CompanyId, id);
        if (charge is null) return ChargeNotFound();

        charge = await chargeService.SyncAsync(charge, cancellationToken);
        return Ok(new ApiResponse<CobrancaPagamentoResponse>
        {
            Success = true,
            Message = "Cobrança consultada.",
            Data = ToResponse(charge, await GatewayNamesAsync(currentUser.CompanyId))
        });
    }

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancelar(string id, CancellationToken cancellationToken)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return SessionNotFound();

        var charge = await chargeAB.ObterAsync(currentUser.CompanyId, id);
        if (charge is null) return ChargeNotFound();

        try
        {
            var (cancelled, message) = await chargeService.CancelAsync(charge, cancellationToken);
            return Ok(new ApiResponse<CobrancaPagamentoResponse>
            {
                Success = true,
                Message = message,
                Data = ToResponse(cancelled, await GatewayNamesAsync(currentUser.CompanyId))
            });
        }
        catch (PaymentProviderException exception)
        {
            return BadRequest(new ApiResponse<CobrancaPagamentoResponse> { Success = false, Message = exception.Message });
        }
    }

    private async Task<Dictionary<string, string>> GatewayNamesAsync(string companyId)
        => (await gatewayAB.ListarAsync(companyId)).ToDictionary(gateway => gateway.Id, gateway => gateway.Name);

    private static CobrancaPagamentoResponse ToResponse(CobrancaPagamentoAD source, IReadOnlyDictionary<string, string> gatewayNames) => new()
    {
        Id = source.Id,
        GatewayId = source.GatewayId,
        GatewayName = gatewayNames.TryGetValue(source.GatewayId, out var name) ? name : "Gateway removido",
        Provider = source.Provider,
        Method = source.Method,
        AmountCents = source.AmountCents,
        Description = source.Description,
        Status = source.Status,
        ProviderStatus = source.ProviderStatus,
        PixCopyPaste = source.PixCopyPaste,
        PixQrCodeImage = source.PixQrCodeImage,
        BoletoUrl = source.BoletoUrl,
        BoletoLine = source.BoletoLine,
        PayerName = source.PayerName,
        PayerDocument = MaskDocument(source.PayerDocument),
        SaleNumber = source.SaleNumber,
        ExpiresAt = source.ExpiresAt?.ToString("O"),
        PaidAt = source.PaidAt?.ToString("O"),
        LastError = source.LastError,
        CreatedBy = source.CreatedBy,
        CreatedAt = source.CreatedAt.ToString("O")
    };

    /// <summary>Mostra só o suficiente para conferência no balcão (***.456.789-**).</summary>
    private static string MaskDocument(string digits) => digits.Length switch
    {
        11 => $"***.{digits[3..6]}.{digits[6..9]}-**",
        14 => $"**.{digits[2..5]}.{digits[5..8]}/{digits[8..12]}-**",
        _ => string.Empty
    };

    private UnauthorizedObjectResult SessionNotFound()
        => Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });

    private NotFoundObjectResult ChargeNotFound()
        => NotFound(new ApiResponse<object> { Success = false, Message = "Cobrança não encontrada." });

    private AuthenticatedUser? GetCurrentUser()
        => HttpContext.Items["CurrentUser"] as AuthenticatedUser;
}
