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
public class UsuarioController(HorusSecurityStore securityStore) : ControllerBase
{
    [HttpGet]
    public IActionResult Listar()
        => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Usuarios obtidos com sucesso.",
            Data = securityStore.ListUsers()
        });

    [HttpPost]
    public IActionResult Criar([FromBody] UsuarioRequest request)
    {
        try
        {
            var user = securityStore.CreateUser(request);
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
        try
        {
            var user = securityStore.UpdateUser(id, request);
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
        var user = securityStore.UpdateStatus(id, request.Status);
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
        var result = securityStore.ResetPassword(id);
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
}
