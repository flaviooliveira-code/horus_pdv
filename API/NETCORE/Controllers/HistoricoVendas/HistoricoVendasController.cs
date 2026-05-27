/**
 * Arquivo: API/NETCORE/Controllers/HistoricoVendas/HistoricoVendasController.cs
 * Objetivo: expõe endpoints HTTP de histórico de vendas e recibos e padroniza respostas para o frontend.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Caixa;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.HistoricoVendas;

[ApiController]
[Route("api/[controller]")]
public class HistoricoVendasController(HistoricoVendasAB historicoVendasAB, HorusCaixaService caixaService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        var rows = await historicoVendasAB.ListarAsync(currentUser.CompanyId);
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Historico de vendas obtido com sucesso.",
            Data = rows
        });
    }

    [HttpPost]
    public async Task<IActionResult> Registrar([FromBody] VendaRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });

        if (request.Items.Count == 0)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Venda sem itens." });
        }

        try
        {
            caixaService.EnsureVendaPermitida(currentUser.CompanyId);
            var result = await historicoVendasAB.RegistrarAsync(currentUser.CompanyId, request);
            return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>
            {
                Success = true,
                Message = "Venda registrada com sucesso.",
                Data = new { saleNumber = result.SaleNumber, rows = result.Rows }
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{saleNumber}/imprimir")]
    public async Task<IActionResult> Imprimir(string saleNumber)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        var saleRows = await historicoVendasAB.ListarAsync(currentUser.CompanyId, saleNumber);
        if (saleRows.Count == 0)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Venda não encontrada." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Impressao enviada para processamento.",
            Data = new
            {
                saleNumber,
                printedAt = DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss"),
                items = saleRows.Count,
                rows = saleRows
            }
        });
    }

    private AuthenticatedUser? GetCurrentUser()
        => HttpContext.Items["CurrentUser"] as AuthenticatedUser;
}
