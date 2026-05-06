using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.AcessoBanco;
using HORUSPDV_API.Services.Caixa;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.HistoricoVendas;

[ApiController]
[Route("api/[controller]")]
public class HistoricoVendasController(HorusMockDatabase database, HorusCaixaService caixaService) : ControllerBase
{
    private static readonly object SyncRoot = new();
    private static int SaleSequence = 15040;
    private static readonly List<VendaHistoricoModel> Vendas =
    [
        new() { SaleNumber = "15039", CustomerName = "Ana Martins", CustomerCpf = "123.456.789-09", ProductCode = "CAF500", ProductName = "Café Tradicional 500g", Quantity = 3, SaleDate = "21/03/2026 14:12:08" },
        new() { SaleNumber = "15038", CustomerName = "Lucas Souza", CustomerCpf = "427.632.180-01", ProductCode = "ACH400", ProductName = "Achocolatado 400g", Quantity = 1, SaleDate = "21/03/2026 13:42:11" },
        new() { SaleNumber = "15037", CustomerName = "Beatriz Lima", CustomerCpf = "064.822.390-16", ProductCode = "ARR5KG", ProductName = "Arroz Tipo 1 5kg", Quantity = 2, SaleDate = "21/03/2026 12:55:46" }
    ];

    [HttpGet]
    public IActionResult Listar()
    {
        lock (SyncRoot)
        {
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Historico de vendas obtido com sucesso.",
                Data = Vendas.Select(CloneSale).ToList()
            });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Registrar([FromBody] VendaRequest request)
    {
        if (request.Items.Count == 0)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Venda sem itens." });
        }

        try
        {
            caixaService.EnsureVendaPermitida();
            await database.BaixarEstoqueAsync(
                request.Items.Select(item => (item.ProductCode, item.Quantity)));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }

        lock (SyncRoot)
        {
            var saleNumber = SaleSequence.ToString();
            SaleSequence += 1;
            var saleDate = DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss");
            var rows = request.Items.Select(item => new VendaHistoricoModel
            {
                SaleNumber = saleNumber,
                CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Consumidor" : request.CustomerName.Trim(),
                CustomerCpf = string.IsNullOrWhiteSpace(request.CustomerCpf) ? "-" : request.CustomerCpf.Trim(),
                ProductCode = item.ProductCode.Trim(),
                ProductName = item.ProductName.Trim(),
                Quantity = item.Quantity,
                SaleDate = saleDate
            }).ToList();

            Vendas.InsertRange(0, rows);
            return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>
            {
                Success = true,
                Message = "Venda registrada com sucesso.",
                Data = new { saleNumber, rows }
            });
        }
    }

    [HttpPost("{saleNumber}/imprimir")]
    public IActionResult Imprimir(string saleNumber)
    {
        lock (SyncRoot)
        {
            var saleRows = Vendas.Where(item => item.SaleNumber == saleNumber).Select(CloneSale).ToList();
            if (saleRows.Count == 0)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "Venda nao encontrada." });
            }

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Impressao enviada para processamento.",
                Data = new { saleNumber, printedAt = DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss"), items = saleRows.Count }
            });
        }
    }

    private static VendaHistoricoModel CloneSale(VendaHistoricoModel source) => new()
    {
        SaleNumber = source.SaleNumber,
        CustomerName = source.CustomerName,
        CustomerCpf = source.CustomerCpf,
        ProductCode = source.ProductCode,
        ProductName = source.ProductName,
        Quantity = source.Quantity,
        SaleDate = source.SaleDate
    };

    private class VendaHistoricoModel
    {
        public string SaleNumber { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerCpf { get; set; } = string.Empty;
        public string ProductCode { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string SaleDate { get; set; } = string.Empty;
    }
}
