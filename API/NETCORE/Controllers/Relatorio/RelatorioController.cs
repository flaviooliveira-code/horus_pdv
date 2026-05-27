/**
 * Arquivo: API/NETCORE/Controllers/Relatorio/RelatorioController.cs
 * Objetivo: expõe endpoints HTTP de relatórios operacionais e padroniza respostas para o frontend.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace HORUSPDV_API.Controllers.Relatorio;

[ApiController]
[Route("api/[controller]")]
public class RelatorioController(RelatorioAB relatorioAB) : ControllerBase
{
    [HttpPost("Gerar")]
    public async Task<IActionResult> Gerar([FromBody] RelatorioGerarRequest request)
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
                Message = "Relatório gerado com sucesso.",
                Data = await relatorioAB.GerarAsync(currentUser.CompanyId, request.ReportId, request.Filters)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}

public class RelatorioGerarRequest
{
    public string ReportId { get; set; } = string.Empty;
    public Dictionary<string, JsonElement> Filters { get; set; } = [];
}
