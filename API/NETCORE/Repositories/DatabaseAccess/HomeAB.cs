/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/HomeAB.cs
 * Objetivo: consolidar indicadores reais da home a partir das tabelas operacionais.
 * Entradas esperadas: recebe conexão configurada e retorna dados agregados para o dashboard.
 */
using HORUSPDV_API.Services.Produtos;
using Microsoft.Data.SqlClient;
using System.Globalization;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class HomeAB(Connection connection)
{
    private static readonly CultureInfo PtBr = new("pt-BR");

    public async Task<object> ObterAsync(string companyId)
    {
        var sales = await ListarVendasAsync(companyId);
        var products = await ListarProdutosAsync(companyId);
        var today = DateTimeOffset.Now.Date;
        var todaySales = sales.Where(item => item.SaleDate.Date == today).ToList();
        var todayRevenue = todaySales.Sum(item => item.TotalAmount);
        var todayCustomers = todaySales
            .Where(item => !string.IsNullOrWhiteSpace(item.CustomerCpf) && item.CustomerCpf != "-")
            .Select(item => item.CustomerCpf)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();
        var criticalStock = products.Count(item => item.Quantity <= 5);
        var expiringProducts = BuildExpiringProductsAlert(products);

        return new
        {
            cards = new[]
            {
                new
                {
                    label = "Vendas do dia",
                    value = todaySales.Count.ToString(PtBr),
                    helper = "Operações registradas hoje",
                    color = "#2563eb",
                    trend = BuildDailyTrend(sales, item => item.Count)
                },
                new
                {
                    label = "Faturamento do dia",
                    value = FormatMoney(todayRevenue),
                    helper = "Total vendido no período",
                    color = "#16a34a",
                    trend = BuildDailyTrend(sales, item => (double)item.Sum(row => row.TotalAmount))
                },
                new
                {
                    label = "Clientes atendidos",
                    value = todayCustomers.ToString(PtBr),
                    helper = "Clientes identificados hoje",
                    color = "#ff6b00",
                    trend = BuildDailyTrend(sales, item => item
                        .Where(row => !string.IsNullOrWhiteSpace(row.CustomerCpf) && row.CustomerCpf != "-")
                        .Select(row => row.CustomerCpf)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .Count())
                },
                new
                {
                    label = "Estoque crítico",
                    value = criticalStock.ToString(PtBr),
                    helper = "Produtos com 5 unidades ou menos",
                    color = "#7c3aed",
                    trend = Enumerable.Repeat(criticalStock, 7).ToArray()
                }
            },
            expiringProducts
        };
    }

    internal static List<object> BuildExpiringProductsAlert(IEnumerable<HomeProductRow> products, DateOnly? referenceToday = null)
    {
        var list = new List<(int Days, decimal Quantity, object Payload)>();
        foreach (var item in products)
        {
            if (item.Quantity <= 0m || string.IsNullOrWhiteSpace(item.ExpirationDate))
            {
                continue;
            }

            var eval = ProdutoExpirationHelper.Evaluate(item.ExpirationDate, referenceToday);
            if (eval.Status is not (ProdutoExpirationHelper.StatusExpired or ProdutoExpirationHelper.StatusExpiringSoon) ||
                eval.DaysUntilExpiration is null)
            {
                continue;
            }

            var days = eval.DaysUntilExpiration.Value;
            list.Add((
                days,
                item.Quantity,
                new
                {
                    id = item.Id,
                    productCode = item.Code,
                    productName = item.Name,
                    quantity = item.Quantity,
                    unitType = item.UnitType,
                    unitCostPrice = item.UnitPrice,
                    salePrice = item.SalePrice,
                    unitCostFormatted = FormatMoney(item.UnitPrice),
                    salePriceFormatted = FormatMoney(item.SalePrice),
                    expirationDate = item.ExpirationDate,
                    expirationMode = item.ExpirationMode,
                    expirationStatus = eval.Status,
                    daysUntilExpiration = days,
                    canApplyCostPrice = item.UnitPrice > 0m && item.SalePrice > item.UnitPrice,
                    alreadyAtCostPrice = item.UnitPrice > 0m && item.SalePrice <= item.UnitPrice
                }));
        }

        return list
            .OrderBy(entry => entry.Days)
            .ThenByDescending(entry => entry.Quantity)
            .Select(entry => entry.Payload)
            .ToList();
    }

    private async Task<List<HomeSaleRow>> ListarVendasAsync(string companyId)
    {
        const string sql = """
            SELECT SaleDate, CustomerCpf, TotalAmount
            FROM Vendas
            WHERE CompanyId = @CompanyId;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<HomeSaleRow>();
        while (await reader.ReadAsync())
        {
            rows.Add(new HomeSaleRow(
                reader.GetDateTimeOffset(reader.GetOrdinal("SaleDate")),
                ReadString(reader, "CustomerCpf"),
                ParseMoney(ReadString(reader, "TotalAmount"))));
        }

        return rows;
    }

    private async Task<List<HomeProductRow>> ListarProdutosAsync(string companyId)
    {
        const string sql = """
            SELECT Id, ProductCode, ProductName, ProductQnt, UnitType,
                   ProductUnitPrice, ProductSalePrice, ExpirationMode, ExpirationDate
            FROM Produtos
            WHERE CompanyId = @CompanyId;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<HomeProductRow>();
        while (await reader.ReadAsync())
        {
            var expOrdinal = reader.GetOrdinal("ExpirationDate");
            var expirationDate = reader.IsDBNull(expOrdinal)
                ? string.Empty
                : reader.GetDateTime(expOrdinal).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

            rows.Add(new HomeProductRow(
                ReadString(reader, "Id"),
                ReadString(reader, "ProductCode"),
                ReadString(reader, "ProductName"),
                ReadDecimal(reader, "ProductQnt"),
                ReadString(reader, "UnitType") is { Length: > 0 } unit ? unit : "UN",
                ParseMoney(ReadString(reader, "ProductUnitPrice")),
                ParseMoney(ReadString(reader, "ProductSalePrice")),
                ReadString(reader, "ExpirationMode"),
                expirationDate));
        }

        return rows;
    }

    private static int[] BuildDailyTrend(List<HomeSaleRow> sales, Func<List<HomeSaleRow>, double> selector)
    {
        var today = DateTimeOffset.Now.Date;
        return Enumerable.Range(0, 7)
            .Select(index => today.AddDays(index - 6))
            .Select(day => (int)Math.Round(selector(sales.Where(item => item.SaleDate.Date == day).ToList())))
            .ToArray();
    }

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private static decimal ReadDecimal(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        if (reader.IsDBNull(ordinal)) return 0m;
        var raw = reader.GetValue(ordinal);
        return raw is string text
            ? ParseDecimal(text)
            : Convert.ToDecimal(raw, CultureInfo.InvariantCulture);
    }

    private static decimal ParseDecimal(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return 0m;
        var trimmed = value.Trim();
        var normalized = trimmed.Contains(',')
            ? trimmed.Replace(".", string.Empty).Replace(',', '.')
            : trimmed;
        return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0m;
    }

    private static decimal ParseMoney(string value)
    {
        var normalized = value.Trim().Replace("R$", "", StringComparison.OrdinalIgnoreCase).Replace(".", "").Replace(",", ".");
        return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0;
    }

    private static string FormatMoney(decimal value)
        => value.ToString("C", PtBr);

    private sealed record HomeSaleRow(DateTimeOffset SaleDate, string CustomerCpf, decimal TotalAmount);

    public sealed record HomeProductRow(
        string Id,
        string Code,
        string Name,
        decimal Quantity,
        string UnitType,
        decimal UnitPrice,
        decimal SalePrice,
        string ExpirationMode,
        string ExpirationDate);
}
