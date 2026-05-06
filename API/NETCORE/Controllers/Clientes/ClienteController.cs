using HORUSPDV_API.Models.Clientes;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Services.Clientes;
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
        var data = await clienteService.ListarAsync();
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
        try
        {
            var created = await clienteService.CriarAsync(request);
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
        try
        {
            var updated = await clienteService.AtualizarAsync(id, request);
            if (updated is null)
            {
                return NotFound(new ApiResponse<ClienteModel> { Success = false, Message = "Cliente nao encontrado." });
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
        var removed = await clienteService.ExcluirAsync(id);
        if (!removed)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Cliente nao encontrado." });
        }

        return Ok(new ApiResponse<object> { Success = true, Message = "Cliente removido com sucesso." });
    }
}
