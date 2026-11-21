/**
 * Arquivo: API/NETCORE/Controllers/Caixa/CaixaController.cs
 * Objetivo: expõe endpoints HTTP assíncronos de status, abertura, sangria, suprimento, fechamento, espelho Z e balanço diário.
 * Entradas esperadas: recebe requisições REST, valida sessão/perfil e delega regras para HorusCaixaService.
 */
using System.Globalization;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Services.Caixa;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Caixa;

[ApiController]
[Route("api/[controller]")]
public class CaixaController(HorusCaixaService caixaService) : ControllerBase
{
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        var status = await caixaService.GetStatusAsync(currentUser.CompanyId, currentUser.Role);
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Status do caixa obtido com sucesso.",
            Data = status
        });
    }

    [HttpPost("abrir")]
    public async Task<IActionResult> Abrir([FromBody] AbrirCaixaRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var status = await caixaService.AbrirAsync(request, currentUser);
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Caixa aberto com sucesso.",
                Data = status
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("sangria")]
    public async Task<IActionResult> Sangria([FromBody] CaixaMovimentacaoRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var movement = await caixaService.RegistrarSangriaAsync(request, currentUser);
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Sangria registrada com sucesso.",
                Data = movement
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("suprimento")]
    public async Task<IActionResult> Suprimento([FromBody] CaixaMovimentacaoRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var movement = await caixaService.RegistrarSuprimentoAsync(request, currentUser);
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Suprimento registrado com sucesso.",
                Data = movement
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("fechar")]
    public async Task<IActionResult> Fechar([FromBody] FecharCaixaRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var summary = await caixaService.FecharAsync(request, currentUser);
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Caixa fechado com sucesso.",
                Data = summary
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("sessao/{id}/resumo")]
    public async Task<IActionResult> SessaoResumo(string id)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var summary = await caixaService.GetSessionSummaryAsync(currentUser.CompanyId, id, currentUser.Role);
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Resumo da sessão de caixa obtido com sucesso.",
                Data = summary
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HorusAuthorizeRoles("administrador", "gerente", "financeiro")]
    [HttpGet("balanco-diario")]
    public async Task<IActionResult> BalancoDiario([FromQuery] string? date = null)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        DateOnly parsedDate;
        if (string.IsNullOrWhiteSpace(date))
        {
            parsedDate = DateOnly.FromDateTime(DateTime.Now);
        }
        else if (!DateOnly.TryParseExact(date.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out parsedDate))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Data inválida. Utilize o formato YYYY-MM-DD."
            });
        }

        var balance = await caixaService.GetDailyBalanceAsync(currentUser.CompanyId, parsedDate);
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Balanço diário obtido com sucesso.",
            Data = balance
        });
    }
}
