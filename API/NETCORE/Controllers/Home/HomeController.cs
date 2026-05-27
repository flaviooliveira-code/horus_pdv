/**
 * Arquivo: API/NETCORE/Controllers/Home/HomeController.cs
 * Objetivo: expõe endpoints HTTP de indicadores e atalhos da página inicial e padroniza respostas para o frontend.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Home;

[ApiController]
[Route("api/[controller]")]
public class HomeController(HomeAB homeAB) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Obter()
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Dados da home obtidos com sucesso.",
            Data = await homeAB.ObterAsync(currentUser.CompanyId)
        });
    }
}
