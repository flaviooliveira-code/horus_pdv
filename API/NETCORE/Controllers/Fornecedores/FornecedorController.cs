/**
 * Arquivo: API/NETCORE/Controllers/Fornecedores/FornecedorController.cs
 * Objetivo: expõe endpoints HTTP de cadastro e manutenção de fornecedores e padroniza respostas para o frontend.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
using HORUSPDV_API.Models.Fornecedores;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Services.Fornecedores;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Fornecedores;

[ApiController]
[Route("api/[controller]")]
public class FornecedorController(IFornecedorService fornecedorService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<FornecedorModel>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar()
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<List<FornecedorModel>> { Success = false, Message = "Sessão não encontrada." });
        var data = await fornecedorService.ListarAsync(currentUser.CompanyId);
        return Ok(new ApiResponse<List<FornecedorModel>>
        {
            Success = true,
            Message = "Fornecedores obtidos com sucesso.",
            Data = data
        });
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<FornecedorModel>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Criar([FromBody] FornecedorRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<FornecedorModel> { Success = false, Message = "Sessão não encontrada." });
        try
        {
            var created = await fornecedorService.CriarAsync(currentUser.CompanyId, request);
            return StatusCode(StatusCodes.Status201Created, new ApiResponse<FornecedorModel>
            {
                Success = true,
                Message = "Fornecedor criado com sucesso.",
                Data = created
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<FornecedorModel> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<FornecedorModel>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Atualizar(string id, [FromBody] FornecedorRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<FornecedorModel> { Success = false, Message = "Sessão não encontrada." });
        try
        {
            var updated = await fornecedorService.AtualizarAsync(currentUser.CompanyId, id, request);
            if (updated is null)
            {
                return NotFound(new ApiResponse<FornecedorModel> { Success = false, Message = "Fornecedor não encontrado." });
            }

            return Ok(new ApiResponse<FornecedorModel>
            {
                Success = true,
                Message = "Fornecedor atualizado com sucesso.",
                Data = updated
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<FornecedorModel> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Excluir(string id)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        try
        {
            var removed = await fornecedorService.ExcluirAsync(currentUser.CompanyId, id);
            if (!removed)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "Fornecedor não encontrado." });
            }

            return Ok(new ApiResponse<object> { Success = true, Message = "Fornecedor removido com sucesso." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    private AuthenticatedUser? GetCurrentUser()
        => HttpContext.Items["CurrentUser"] as AuthenticatedUser;
}
