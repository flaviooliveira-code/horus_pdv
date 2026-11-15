using HORUSPDV_API.Controllers.Despesas;
using HORUSPDV_API.Controllers.Produtos;
using HORUSPDV_API.Repositories.DatabaseAccess;
using Xunit;

namespace HORUSPDV_API.Tests;

public class LucroImportacaoTests
{
    [Theory]
    [InlineData("R$ 10,50", 10.50)]
    [InlineData("1.234,56", 1234.56)]
    [InlineData("1234.56", 1234.56)]
    [InlineData("1,234.56", 1234.56)]
    [InlineData("0,450", 0.45)]
    [InlineData("10", 10.00)]
    public void ProdutoImportacaoService_ParseFlexibleDecimal_HandlesPtBrAndInvariantFormats(string raw, decimal expected)
    {
        var parsed = ProdutoImportacaoService.ParseFlexibleDecimal(raw);
        Assert.Equal(expected, parsed);
    }

    [Fact]
    public void ProdutoImportacaoService_ValidateBatch_NormalizesValidRowsAndFlagsDuplicatesAndInvalidValues()
    {
        var existingCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "PRD-001" };
        var items = new List<ProdutoImportacaoItemRequest>
        {
            new()
            {
                ProductCode = "PRD-001",
                ProductName = "Arroz Tipo 1 5kg",
                ProductSupplier = "Alimentos Sul",
                ProductQnt = "15",
                ProductUnitPrice = "18,50",
                ProductSalePrice = "25,90"
            },
            new()
            {
                ProductCode = "PRD-002",
                ProductName = "Feijão Carioca 1kg",
                ProductSupplier = "Alimentos Sul",
                ProductQnt = "20",
                ProductUnitPrice = "5,20",
                ProductSalePrice = "8,50"
            },
            new()
            {
                ProductCode = "PRD-002",
                ProductName = "Produto Com Código Duplicado",
                ProductQnt = "5",
                ProductUnitPrice = "4,00",
                ProductSalePrice = "7,00"
            },
            new()
            {
                ProductCode = "PRD-003",
                ProductName = "AB", // inválido (< 3 chars)
                ProductQnt = "-1",
                ProductUnitPrice = "0",
                ProductSalePrice = "10,00"
            }
        };

        var result = ProdutoImportacaoService.ValidateBatch(items, existingCodes, "atualizar");

        Assert.Equal(4, result.TotalRows);
        Assert.Equal(2, result.ValidRows);
        Assert.Equal(2, result.InvalidRows);
        Assert.Equal("ATUALIZAR", result.Rows[0].Action);
        Assert.Equal("277,50", result.Rows[0].TotalPriceOnProduct);
        Assert.Equal("CRIAR", result.Rows[1].Action);
        Assert.False(result.Rows[2].IsValid);
        Assert.False(result.Rows[3].IsValid);
    }

    [Fact]
    public void ProdutoImportacaoService_NormalizeConflictMode_RejectsInvalidMode()
    {
        Assert.Equal("atualizar", ProdutoImportacaoService.NormalizeConflictMode("atualizar"));
        Assert.Equal("ignorar", ProdutoImportacaoService.NormalizeConflictMode("ignorar"));
        Assert.Throws<InvalidOperationException>(() => ProdutoImportacaoService.NormalizeConflictMode("invalido"));
    }

    [Fact]
    public void DespesaValidationService_ValidatesAndNormalizesExpenses()
    {
        var valid = DespesaValidationService.ValidateAndNormalize(new DespesaOperacionalRequest
        {
            Description = "Energia Elétrica Loja",
            Category = "Utilidades",
            Amount = "450,80",
            CompetenceDate = "2026-03-01",
            DueDate = "2026-03-10",
            Status = "Pago",
            PaymentMethod = "PIX"
        });

        Assert.Equal("Energia Elétrica Loja", valid.Description);
        Assert.Equal(450.80m, valid.AmountDecimal);
        Assert.Equal("450,80", valid.AmountFormatted);
        Assert.Equal("Pago", valid.Status);
        Assert.NotNull(valid.PaidDate);

        Assert.Throws<InvalidOperationException>(() =>
            DespesaValidationService.ValidateAndNormalize(new DespesaOperacionalRequest
            {
                Description = "Aluguel",
                Amount = "0,00"
            }));
    }

    [Fact]
    public void CalcularLucroReal_ByPeriod_ComputesCmvGrossProfitAndMarginCorrectly()
    {
        var date = new DateTimeOffset(2026, 3, 15, 14, 0, 0, TimeSpan.Zero);
        var items = new List<RelatorioAB.LucroItemInput>
        {
            new("1001", date, "P1", "Café Torrado 500g", 2, 20.00m, 12.00m, 40.00m),
            new("1002", date, "P2", "Leite Integral 1L", 5, 6.00m, 4.00m, 30.00m)
        };

        // Receita Bruta = 40 + 30 = 70,00
        // CMV = (12*2) + (4*5) = 24 + 20 = 44,00
        // Lucro Bruto = 70 - 44 = 26,00
        // Margem Bruta = 26 / 70 = 37,14%
        var (_, rows) = RelatorioAB.CalcularLucroReal(items, "period", "daily");

        Assert.Single(rows);
        Assert.Equal(2, rows[0]["vendas"]);
        Assert.Equal("R$ 70,00", rows[0]["receitaBruta"]);
        Assert.Equal("R$ 44,00", rows[0]["cmv"]);
        Assert.Equal("R$ 26,00", rows[0]["lucroBruto"]);
        Assert.Equal("37,14%", rows[0]["margemBruta"]);
    }

    [Fact]
    public void CalcularLucroReal_ByProduct_SortsByGrossProfitAndHandlesZeroRevenueSafely()
    {
        var date = DateTimeOffset.Now;
        var items = new List<RelatorioAB.LucroItemInput>
        {
            new("1001", date, "P1", "Produto Menor Lucro", 1, 15.00m, 10.00m, 15.00m),
            new("1002", date, "P2", "Produto Maior Lucro", 3, 30.00m, 15.00m, 90.00m),
            new("1003", date, "P3", "Produto Bonificado Zero", 1, 0.00m, 0.00m, 0.00m)
        };

        var (_, rows) = RelatorioAB.CalcularLucroReal(items, "product", "daily");

        Assert.Equal(3, rows.Count);
        Assert.Equal("P2", rows[0]["codigo"]);
        Assert.Equal("R$ 45,00", rows[0]["lucroBruto"]);
        Assert.Equal("50,00%", rows[0]["margemBruta"]);
        Assert.Equal("0,00%", rows[2]["margemBruta"]);
    }

    [Fact]
    public void CalcularDreSimplificado_RespectsCompetenciaAndCaixaRegimes()
    {
        var start = new DateTime(2026, 3, 1);
        var endExclusive = new DateTime(2026, 4, 1);
        var saleDate = new DateTimeOffset(2026, 3, 10, 10, 0, 0, TimeSpan.Zero);

        var sales = new List<RelatorioAB.LucroItemInput>
        {
            // Receita = 1.000,00 | CMV = 600,00 | Lucro Bruto = 400,00
            new("2001", saleDate, "P1", "Kit Gourmet", 10, 100.00m, 60.00m, 1000.00m)
        };

        var expenses = new List<RelatorioAB.DespesaDreInput>
        {
            new("Aluguel", 150.00m, new DateTime(2026, 3, 5), new DateTime(2026, 3, 10), new DateTime(2026, 3, 10), "Pago"),
            new("Manutenção", 50.00m, new DateTime(2026, 3, 15), new DateTime(2026, 3, 25), null, "Pendente")
        };

        var dreCompetencia = RelatorioAB.CalcularDreSimplificado(sales, expenses, start, endExclusive, "competencia");
        var dreCaixa = RelatorioAB.CalcularDreSimplificado(sales, expenses, start, endExclusive, "caixa");

        var netCompetencia = dreCompetencia.Rows.Last();
        var netCaixa = dreCaixa.Rows.Last();

        // Competência considera 150 + 50 = 200 de despesa -> Lucro Líquido = 400 - 200 = 200,00 (20,00%)
        Assert.Equal("R$ 200,00", netCompetencia["valor"]);
        Assert.Equal("20,00%", netCompetencia["av"]);

        // Caixa considera apenas 150 pagos -> Lucro Líquido = 400 - 150 = 250,00 (25,00%)
        Assert.Equal("R$ 250,00", netCaixa["valor"]);
        Assert.Equal("25,00%", netCaixa["av"]);
    }

    [Fact]
    public void CalcularDreSimplificado_PeriodWithExpensesOnly_ReturnsZeroMarginWithoutDivisionByZero()
    {
        var start = new DateTime(2026, 3, 1);
        var endExclusive = new DateTime(2026, 4, 1);
        var expenses = new List<RelatorioAB.DespesaDreInput>
        {
            new("Internet", 120.00m, new DateTime(2026, 3, 10), new DateTime(2026, 3, 15), new DateTime(2026, 3, 15), "Pago")
        };

        var (_, rows) = RelatorioAB.CalcularDreSimplificado([], expenses, start, endExclusive, "competencia");
        var netRow = rows.Last();

        Assert.Equal("-R$ 120,00", netRow["valor"]);
        Assert.Equal("0,00%", netRow["av"]);
        Assert.Equal("PREJUÍZO", netRow["situacao"]);
    }
}
