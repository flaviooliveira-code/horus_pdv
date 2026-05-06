using HORUSPDV_API.Data;
using HORUSPDV_API.Data.Entities;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.AcessoBanco;
using HORUSPDV_API.Services.Caixa;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HORUSPDV_API.Controllers.HistoricoVendas;

[ApiController]
[Route("api/[controller]")]
public class HistoricoVendasController(HorusMockDatabase database, HorusCaixaService caixaService, HorusDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var rows = await db.VendaItens
            .AsNoTracking()
            .Include(item => item.Venda)
            .OrderByDescending(item => item.Venda!.SaleDate)
            .Select(item => ToHistoryRow(item))
            .ToListAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Historico de vendas obtido com sucesso.",
            Data = rows
        });
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

        var saleNumber = await NextSaleNumberAsync();
        var now = DateTimeOffset.Now;
        var sale = new VendaEntity
        {
            Id = $"sale-{saleNumber}",
            SaleNumber = saleNumber,
            CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Consumidor" : request.CustomerName.Trim(),
            CustomerCpf = string.IsNullOrWhiteSpace(request.CustomerCpf) ? "-" : request.CustomerCpf.Trim(),
            SaleDate = now,
            Items = request.Items.Select((item, index) => new VendaItemEntity
            {
                Id = $"sale-{saleNumber}-item-{index + 1:000}",
                ProductCode = item.ProductCode.Trim(),
                ProductName = item.ProductName.Trim(),
                Quantity = item.Quantity
            }).ToList()
        };
        db.Vendas.Add(sale);
        await db.SaveChangesAsync();

        var rows = sale.Items.Select(item => ToHistoryRow(item, sale)).ToList();
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>
        {
            Success = true,
            Message = "Venda registrada com sucesso.",
            Data = new { saleNumber, rows }
        });
    }

    [HttpPost("{saleNumber}/imprimir")]
    public async Task<IActionResult> Imprimir(string saleNumber)
    {
        var saleRows = await db.VendaItens
            .AsNoTracking()
            .Include(item => item.Venda)
            .Where(item => item.Venda!.SaleNumber == saleNumber)
            .Select(item => ToHistoryRow(item))
            .ToListAsync();
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

    private async Task<string> NextSaleNumberAsync()
    {
        var numbers = await db.Vendas.AsNoTracking().Select(item => item.SaleNumber).ToListAsync();
        var max = numbers
            .Select(item => int.TryParse(item, out var parsed) ? parsed : 0)
            .DefaultIfEmpty(15039)
            .Max();
        return (max + 1).ToString();
    }

    private static VendaHistoricoModel ToHistoryRow(VendaItemEntity item)
        => ToHistoryRow(item, item.Venda ?? new VendaEntity());

    private static VendaHistoricoModel ToHistoryRow(VendaItemEntity item, VendaEntity sale) => new()
    {
        SaleNumber = sale.SaleNumber,
        CustomerName = sale.CustomerName,
        CustomerCpf = sale.CustomerCpf,
        ProductCode = item.ProductCode,
        ProductName = item.ProductName,
        Quantity = item.Quantity,
        SaleDate = sale.SaleDate.LocalDateTime.ToString("dd/MM/yyyy HH:mm:ss")
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
