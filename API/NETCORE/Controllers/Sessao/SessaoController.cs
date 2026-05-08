/**
 * Arquivo: API/NETCORE/Controllers/Sessao/SessaoController.cs
 * Objetivo: expõe endpoints HTTP de sessões autenticadas e padroniza respostas para o frontend.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Sessao;

[ApiController]
[Route("api/[controller]")]
public class SessaoController(HorusSecurityStore securityStore) : ControllerBase
{
    [HttpGet]
    public IActionResult Listar()
    {
        var currentSessionId = GetCurrentSessionId();
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Sessoes obtidas com sucesso.",
            Data = securityStore.ListSessions(currentSessionId)
        });
    }

    [HttpDelete("{id}")]
    public IActionResult Encerrar(string id)
    {
        var currentSessionId = GetCurrentSessionId();
        if (id == currentSessionId)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "A sessão atual não pode ser encerrada por esta ação."
            });
        }

        if (!securityStore.TerminateSession(id, currentSessionId))
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Sessao encerrada com sucesso.",
            Data = securityStore.ListSessions(currentSessionId)
        });
    }

    [HttpDelete("outras")]
    public IActionResult EncerrarOutras()
    {
        var currentSessionId = GetCurrentSessionId();
        securityStore.TerminateOtherSessions(currentSessionId);
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Outras sessoes encerradas com sucesso.",
            Data = securityStore.ListSessions(currentSessionId)
        });
    }

    private string GetCurrentSessionId()
        => HttpContext.Items["CurrentUser"] is AuthenticatedUser currentUser
            ? currentUser.SessionId
            : "";
}
