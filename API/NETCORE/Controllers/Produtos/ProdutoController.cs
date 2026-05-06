using HORUSPDV_API.Models.Produtos;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Services.Produtos;
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
        var data = await produtoService.ListarAsync();
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
        try
        {
            var created = await produtoService.CriarAsync(request);
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
        try
        {
            var updated = await produtoService.AtualizarAsync(id, request);
            if (updated is null)
            {
                return NotFound(new ApiResponse<ProdutoModel> { Success = false, Message = "Produto nao encontrado." });
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
        var removed = await produtoService.ExcluirAsync(id);
        if (!removed)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Produto nao encontrado." });
        }

        return Ok(new ApiResponse<object> { Success = true, Message = "Produto removido com sucesso." });
    }
}
