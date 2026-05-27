/**
 * Arquivo: API/NETCORE/Controllers/Usuario/UsuarioController.cs
 * Objetivo: expõe endpoints HTTP de contas de usuários e permissões e padroniza respostas para o frontend.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Usuario;

[ApiController]
[Route("api/[controller]")]
[HorusAuthorizeRoles("administrador", "gerente")]
public class UsuarioController(HorusSecurityStore securityStore) : ControllerBase
{
    [HttpGet]
    public IActionResult Listar()
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Usuarios obtidos com sucesso.",
            Data = securityStore.ListUsers(currentUser.CompanyId)
        });
    }

    [HttpPost]
    public IActionResult Criar([FromBody] UsuarioRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var user = securityStore.CreateUser(request, currentUser.CompanyId);
            return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>
            {
                Success = true,
                Message = "Usuario criado com sucesso.",
                Data = user
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public IActionResult Atualizar(string id, [FromBody] UsuarioRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var user = securityStore.UpdateUser(id, request, currentUser.CompanyId);
            if (user is null)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "Usuário não encontrado." });
            }

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Usuario atualizado com sucesso.",
                Data = user
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPatch("{id}/status")]
    public IActionResult AlterarStatus(string id, [FromBody] UsuarioStatusRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        var user = securityStore.UpdateStatus(id, request.Status, currentUser.CompanyId);
        if (user is null)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Usuário não encontrado." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Status atualizado com sucesso.",
            Data = user
        });
    }

    [HttpPost("{id}/resetar-senha")]
    public IActionResult ResetarSenha(string id)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        var result = securityStore.ResetPassword(id, currentUser.CompanyId);
        if (result is null)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Usuário não encontrado." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Senha resetada com sucesso.",
            Data = new { user = result.User, password = result.Password }
        });
    }

    public class UsuarioStatusRequest
    {
        public string Status { get; set; } = "ativo";
    }

    private AuthenticatedUser? GetCurrentUser()
        => HttpContext.Items["CurrentUser"] as AuthenticatedUser;
}
