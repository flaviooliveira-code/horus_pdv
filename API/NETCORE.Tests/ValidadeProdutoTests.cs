using HORUSPDV_API.Controllers.Produtos;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Produtos;
using Xunit;

namespace HORUSPDV_API.Tests;

public class ValidadeProdutoTests
{
    [Fact]
    public void ExpirationHelper_Calculates30DaysFromManufactureDate()
    {
        var today = new DateOnly(2026, 11, 22);
        var resolved = ProdutoExpirationHelper.NormalizeAndResolve(
            "DAYS_FROM_MANUFACTURE",
            "2026-11-01",
            30,
            null,
            today);

        Assert.Equal("DAYS_FROM_MANUFACTURE", resolved.ExpirationMode);
        Assert.Equal("2026-11-01", resolved.ManufactureDate);
        Assert.Equal(30, resolved.ShelfLifeDays);
        Assert.Equal("2026-12-01", resolved.ExpirationDate);
    }

    [Fact]
    public void ExpirationHelper_DefaultsManufactureDateToTodayAnd30DaysWhenOmitted()
    {
        var today = new DateOnly(2026, 11, 22);
        var resolved = ProdutoExpirationHelper.NormalizeAndResolve(
            "MANUFACTURE_30_DAYS",
            null,
            null,
            null,
            today);

        Assert.Equal("DAYS_FROM_MANUFACTURE", resolved.ExpirationMode);
        Assert.Equal("2026-11-22", resolved.ManufactureDate);
        Assert.Equal(30, resolved.ShelfLifeDays);
        Assert.Equal("2026-12-22", resolved.ExpirationDate);
    }

    [Fact]
    public void ExpirationHelper_ParsesFixedBrazilianDateAndRejectsManufactureAfterExpiration()
    {
        var resolved = ProdutoExpirationHelper.NormalizeAndResolve(
            "FIXED_DATE",
            "10/11/2026",
            null,
            "28/11/2026");

        Assert.Equal("FIXED_DATE", resolved.ExpirationMode);
        Assert.Equal("2026-11-10", resolved.ManufactureDate);
        Assert.Equal("2026-11-28", resolved.ExpirationDate);
        Assert.Null(resolved.ShelfLifeDays);

        Assert.Throws<InvalidOperationException>(() =>
            ProdutoExpirationHelper.NormalizeAndResolve("FIXED_DATE", "2026-12-01", null, "2026-11-20"));
    }

    [Fact]
    public void ExpirationHelper_EvaluatesAlertStatusesCorrectly()
    {
        var today = new DateOnly(2026, 11, 22);

        var expired = ProdutoExpirationHelper.Evaluate("2026-11-21", today);
        Assert.Equal(ProdutoExpirationHelper.StatusExpired, expired.Status);
        Assert.Equal(-1, expired.DaysUntilExpiration);

        var dueToday = ProdutoExpirationHelper.Evaluate("2026-11-22", today);
        Assert.Equal(ProdutoExpirationHelper.StatusExpiringSoon, dueToday.Status);
        Assert.Equal(0, dueToday.DaysUntilExpiration);

        var inFiveDays = ProdutoExpirationHelper.Evaluate("2026-11-27", today);
        Assert.Equal(ProdutoExpirationHelper.StatusExpiringSoon, inFiveDays.Status);
        Assert.Equal(5, inFiveDays.DaysUntilExpiration);

        var ok = ProdutoExpirationHelper.Evaluate("2026-12-15", today);
        Assert.Equal(ProdutoExpirationHelper.StatusOk, ok.Status);
        Assert.Equal(23, ok.DaysUntilExpiration);

        var none = ProdutoExpirationHelper.Evaluate(null, today);
        Assert.Equal(ProdutoExpirationHelper.StatusNone, none.Status);
        Assert.Null(none.DaysUntilExpiration);
    }

    [Fact]
    public void ProdutoImportacaoService_ImportsFixedExpirationAnd30DaysFromManufacture()
    {
        var existingCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var items = new List<ProdutoImportacaoItemRequest>
        {
            new()
            {
                ProductCode = "IMP-001",
                ProductName = "Iogurte Natural 170g",
                ProductCategory = "Laticínios",
                ProductQnt = "12",
                ProductUnitPrice = "3,20",
                ProductSalePrice = "5,50",
                ExpirationDate = "28/11/2026"
            },
            new()
            {
                ProductCode = "IMP-002",
                ProductName = "Bolo Caseiro Laranja",
                ProductCategory = "Padaria",
                ProductQnt = "4",
                ProductUnitPrice = "8,00",
                ProductSalePrice = "15,00",
                ManufactureDate = "01/11/2026",
                ShelfLifeDays = "Sim"
            },
            new()
            {
                ProductCode = "IMP-003",
                ProductName = "Pão de Forma",
                ProductQnt = "5",
                ProductUnitPrice = "4,00",
                ProductSalePrice = "7,50",
                ExpirationDate = "99/99/2026"
            }
        };

        var result = ProdutoImportacaoService.ValidateBatch(items, existingCodes, "atualizar");

        Assert.Equal(3, result.TotalRows);
        Assert.Equal(2, result.ValidRows);
        Assert.Equal(1, result.InvalidRows);

        Assert.True(result.Rows[0].IsValid);
        Assert.Equal("FIXED_DATE", result.Rows[0].ExpirationMode);
        Assert.Equal("2026-11-28", result.Rows[0].ExpirationDate);
        Assert.Equal("Laticínios", result.Rows[0].ProductCategory);

        Assert.True(result.Rows[1].IsValid);
        Assert.Equal("DAYS_FROM_MANUFACTURE", result.Rows[1].ExpirationMode);
        Assert.Equal("2026-11-01", result.Rows[1].ManufactureDate);
        Assert.Equal(30, result.Rows[1].ShelfLifeDays);
        Assert.Equal("2026-12-01", result.Rows[1].ExpirationDate);

        Assert.False(result.Rows[2].IsValid);
        Assert.Contains(result.Rows[2].Errors, err => err.Contains("Data de vencimento inválida", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void HomeAB_BuildExpiringProductsAlert_OrdersByUrgencyAndIgnoresZeroStockOrFarDates()
    {
        var today = new DateOnly(2026, 11, 22);
        var products = new List<HomeAB.HomeProductRow>
        {
            new("p1", "C1", "Leite Integral", 10m, "UN", 3.50m, 5.90m, "FIXED_DATE", "2026-11-25"), // 3 dias
            new("p2", "C2", "Queijo Fresco", 0m, "UN", 12.00m, 20.00m, "FIXED_DATE", "2026-11-23"), // sem estoque -> ignorar
            new("p3", "C3", "Arroz 5kg", 20m, "UN", 18.00m, 25.00m, "FIXED_DATE", "2027-06-01"), // longe -> ignorar
            new("p4", "C4", "Presunto Fatiado", 5m, "UN", 8.00m, 14.00m, "FIXED_DATE", "2026-11-20") // vencido (-2d)
        };

        var alerts = HomeAB.BuildExpiringProductsAlert(products, today);

        Assert.Equal(2, alerts.Count);
        var firstJson = System.Text.Json.JsonSerializer.Serialize(alerts[0]);
        var secondJson = System.Text.Json.JsonSerializer.Serialize(alerts[1]);
        Assert.Contains("Presunto Fatiado", firstJson);
        Assert.Contains("Leite Integral", secondJson);
    }
}
