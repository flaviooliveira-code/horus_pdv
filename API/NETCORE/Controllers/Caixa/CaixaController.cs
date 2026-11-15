/**
 * Arquivo: API/NETCORE/Controllers/Caixa/CaixaController.cs
 * Objetivo: expõe endpoints HTTP de abertura, fechamento, sangria, suprimento, movimentações e balanço diário de caixa.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
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
    public IActionResult Status()
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Status do caixa obtido com sucesso.",
            Data = caixaService.GetStatus(currentUser.CompanyId)
        });
    }

    [HttpGet("balanco")]
    public IActionResult Balanco([FromQuery] string? sessaoId = null)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Balanço do caixa obtido com sucesso.",
            Data = caixaService.ObterBalancoSessao(currentUser.CompanyId, sessaoId)
        });
    }

    [HttpGet("movimentacoes")]
    public IActionResult Movimentacoes([FromQuery] string? sessaoId = null)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Movimentações do caixa obtidas com sucesso.",
            Data = caixaService.ListarMovimentacoes(currentUser.CompanyId, sessaoId)
        });
    }

    [HttpPost("abrir")]
    public IActionResult Abrir([FromBody] AbrirCaixaRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Caixa aberto com sucesso.",
                Data = caixaService.Abrir(request, currentUser)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("sangria")]
    public IActionResult Sangria([FromBody] SangriaCaixaRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Sangria registrada com sucesso.",
                Data = caixaService.RegistrarSangria(request, currentUser)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("suprimento")]
    public IActionResult Suprimento([FromBody] SuprimentoCaixaRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Suprimento registrado com sucesso.",
                Data = caixaService.RegistrarSuprimento(request, currentUser)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("movimentacao")]
    public IActionResult Movimentacao([FromBody] CaixaMovimentacaoRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Movimentação registrada com sucesso.",
                Data = caixaService.RegistrarMovimentacao(request, currentUser)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("fechar")]
    public IActionResult Fechar([FromBody] FecharCaixaRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Caixa fechado com sucesso.",
                Data = caixaService.Fechar(request, currentUser)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}

