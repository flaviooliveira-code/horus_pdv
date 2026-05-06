using HORUSPDV_API.Models.Response;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Relatorio;

[ApiController]
[Route("api/[controller]")]
public class RelatorioController : ControllerBase
{
    [HttpPost("Gerar")]
    public IActionResult Gerar([FromBody] RelatorioGerarRequest request)
        => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Relatorio gerado com sucesso.",
            Data = new
            {
                columns = new[]
                {
                    new { key = "indicador", label = "Indicador" },
                    new { key = "valor", label = "Valor" },
                    new { key = "status", label = "Status" }
                },
                rows = new[]
                {
                    new Dictionary<string, object> { ["indicador"] = request.ReportId, ["valor"] = "R$ 18.420,00", ["status"] = "Consolidado" },
                    new Dictionary<string, object> { ["indicador"] = "Filtros aplicados", ["valor"] = request.Filters.Count, ["status"] = "Processado" }
                }
            }
        });
}

public class RelatorioGerarRequest
{
    public string ReportId { get; set; } = string.Empty;
    public Dictionary<string, object> Filters { get; set; } = [];
}
