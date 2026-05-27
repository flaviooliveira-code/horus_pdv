/**
 * Arquivo: API/NETCORE/Controllers/Clientes/ClienteController.cs
 * Objetivo: expõe endpoints HTTP de cadastro e manutenção de clientes e padroniza respostas para o frontend.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
using HORUSPDV_API.Models.Clientes;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Services.Clientes;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Clientes;

[ApiController]
[Route("api/[controller]")]
public class ClienteController(IClienteService clienteService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<ClienteModel>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar()
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<List<ClienteModel>> { Success = false, Message = "Sessão não encontrada." });
        var data = await clienteService.ListarAsync(currentUser.CompanyId);
        return Ok(new ApiResponse<List<ClienteModel>>
        {
            Success = true,
            Message = "Clientes obtidos com sucesso.",
            Data = data
        });
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<ClienteModel>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Criar([FromBody] ClienteRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<ClienteModel> { Success = false, Message = "Sessão não encontrada." });
        try
        {
            var created = await clienteService.CriarAsync(currentUser.CompanyId, request);
            return StatusCode(StatusCodes.Status201Created, new ApiResponse<ClienteModel>
            {
                Success = true,
                Message = "Cliente criado com sucesso.",
                Data = created
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<ClienteModel> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<ClienteModel>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Atualizar(string id, [FromBody] ClienteRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<ClienteModel> { Success = false, Message = "Sessão não encontrada." });
        try
        {
            var updated = await clienteService.AtualizarAsync(currentUser.CompanyId, id, request);
            if (updated is null)
            {
                return NotFound(new ApiResponse<ClienteModel> { Success = false, Message = "Cliente não encontrado." });
            }

            return Ok(new ApiResponse<ClienteModel>
            {
                Success = true,
                Message = "Cliente atualizado com sucesso.",
                Data = updated
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<ClienteModel> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Excluir(string id)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        var removed = await clienteService.ExcluirAsync(currentUser.CompanyId, id);
        if (!removed)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Cliente não encontrado." });
        }

        return Ok(new ApiResponse<object> { Success = true, Message = "Cliente removido com sucesso." });
    }

    private AuthenticatedUser? GetCurrentUser()
        => HttpContext.Items["CurrentUser"] as AuthenticatedUser;
}
