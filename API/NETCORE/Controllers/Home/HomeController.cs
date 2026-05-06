using HORUSPDV_API.Models.Response;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Home;

[ApiController]
[Route("api/[controller]")]
public class HomeController : ControllerBase
{
    [HttpGet]
    public IActionResult Obter()
        => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Dados da home obtidos com sucesso.",
            Data = new
            {
                cards = new[]
                {
                    new { label = "Vendas do dia", value = "42", helper = "Operações registradas hoje", color = "#2563eb", trend = new[] { 24, 27, 29, 31, 35, 38, 42 } },
                    new { label = "Ticket médio", value = "R$ 186,30", helper = "Média das vendas finalizadas", color = "#16a34a", trend = new[] { 162, 168, 171, 174, 178, 182, 186 } },
                    new { label = "Clientes atendidos", value = "31", helper = "Atendimentos no período", color = "#ff6b00", trend = new[] { 18, 20, 22, 24, 26, 29, 31 } },
                    new { label = "Pedidos abertos", value = "6", helper = "Pendências operacionais", color = "#7c3aed", trend = new[] { 2, 3, 4, 4, 5, 6, 6 } }
                }
            }
        });
}
