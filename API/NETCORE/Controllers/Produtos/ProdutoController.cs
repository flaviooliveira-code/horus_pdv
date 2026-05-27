/**
 * Arquivo: API/NETCORE/Controllers/Produtos/ProdutoController.cs
 * Objetivo: expõe endpoints HTTP de cadastro, estoque e manutenção de produtos e padroniza respostas para o frontend.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
using HORUSPDV_API.Models.Produtos;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Services.Produtos;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Produtos;

[ApiController]
[Route("api/[controller]")]
public class ProdutoController(IProdutoService produtoService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<ProdutoModel>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar()
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<List<ProdutoModel>> { Success = false, Message = "Sessão não encontrada." });
        var data = await produtoService.ListarAsync(currentUser.CompanyId);
        return Ok(new ApiResponse<List<ProdutoModel>>
        {
            Success = true,
            Message = "Produtos obtidos com sucesso.",
            Data = data
        });
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<ProdutoModel>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<ProdutoModel>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Criar([FromBody] ProdutoRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<ProdutoModel> { Success = false, Message = "Sessão não encontrada." });
        try
        {
            var created = await produtoService.CriarAsync(currentUser.CompanyId, request);
            return StatusCode(StatusCodes.Status201Created, new ApiResponse<ProdutoModel>
            {
                Success = true,
                Message = "Produto criado com sucesso.",
                Data = created
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<ProdutoModel> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<ProdutoModel>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<ProdutoModel>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Atualizar(string id, [FromBody] ProdutoRequest request)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<ProdutoModel> { Success = false, Message = "Sessão não encontrada." });
        try
        {
            var updated = await produtoService.AtualizarAsync(currentUser.CompanyId, id, request);
            if (updated is null)
            {
                return NotFound(new ApiResponse<ProdutoModel> { Success = false, Message = "Produto não encontrado." });
            }

            return Ok(new ApiResponse<ProdutoModel>
            {
                Success = true,
                Message = "Produto atualizado com sucesso.",
                Data = updated
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<ProdutoModel> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Excluir(string id)
    {
        var currentUser = GetCurrentUser();
        if (currentUser is null) return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        var removed = await produtoService.ExcluirAsync(currentUser.CompanyId, id);
        if (!removed)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Produto não encontrado." });
        }

        return Ok(new ApiResponse<object> { Success = true, Message = "Produto removido com sucesso." });
    }

    private AuthenticatedUser? GetCurrentUser()
        => HttpContext.Items["CurrentUser"] as AuthenticatedUser;
}
