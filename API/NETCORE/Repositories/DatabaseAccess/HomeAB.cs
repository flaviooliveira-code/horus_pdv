/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/HomeAB.cs
 * Objetivo: consolidar indicadores reais da home a partir das tabelas operacionais.
 * Entradas esperadas: recebe conexão configurada e retorna dados agregados para o dashboard.
 */
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
            }
        };
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
            SELECT ProductQnt
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
            rows.Add(new HomeProductRow(ParseInt(ReadString(reader, "ProductQnt"))));
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

    private static int ParseInt(string value)
        => int.TryParse(value, out var parsed) ? parsed : 0;

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
    private sealed record HomeProductRow(int Quantity);
}
