/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/RelatorioAB.cs
 * Objetivo: gerar relatórios operacionais reais a partir das tabelas atuais do PDV.
 * Entradas esperadas: recebe identificador do relatório, filtros serializados e retorna colunas/linhas para o frontend.
 */
using Microsoft.Data.SqlClient;
using System.Globalization;
using System.Text;
using System.Text.Json;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class RelatorioAB(Connection connection)
{
    private static readonly CultureInfo PtBr = new("pt-BR");

    public async Task<object> GerarAsync(string companyId, string reportId, Dictionary<string, JsonElement> filters)
        => reportId switch
        {
            "vendas-periodo" => await GerarVendasPeriodoAsync(companyId, filters),
            "historico-vendas" => await GerarHistoricoVendasAsync(companyId, filters),
            "produtos-mais-vendidos" => await GerarProdutosMaisVendidosAsync(companyId, filters),
            "clientes-frequentes" => await GerarClientesFrequentesAsync(companyId, filters),
            "estoque-critico" => await GerarEstoqueCriticoAsync(companyId, filters),
            "compras-fornecedor" => await GerarComprasFornecedorAsync(companyId),
            "movimento-estoque" => await GerarMovimentoEstoqueAsync(companyId),
            "desempenho-caixa" => await GerarDesempenhoCaixaAsync(companyId, filters),
            _ => throw new InvalidOperationException("Relatório não encontrado.")
        };

    private async Task<object> GerarVendasPeriodoAsync(string companyId, Dictionary<string, JsonElement> filters)
    {
        var rows = FilterSales(await ListarVendasAsync(companyId), filters, includeItems: false);
        var groupBy = GetString(filters, "groupBy", "daily");
        var reportRows = rows
            .GroupBy(row => BuildPeriodKey(row.SaleDate, groupBy))
            .OrderBy(group => group.Key.Sort)
            .Select(group =>
            {
                var total = group.Sum(item => item.TotalAmount);
                var count = group.Select(item => item.SaleNumber).Distinct().Count();
                return Row(
                    ("periodo", group.Key.Label),
                    ("vendas", count),
                    ("faturamento", FormatMoney(total)),
                    ("ticketMedio", FormatMoney(count == 0 ? 0 : total / count)));
            })
            .ToList();

        return Result(
            Columns(("periodo", "Período"), ("vendas", "Vendas"), ("faturamento", "Faturamento"), ("ticketMedio", "Ticket médio")),
            reportRows);
    }

    private async Task<object> GerarHistoricoVendasAsync(string companyId, Dictionary<string, JsonElement> filters)
    {
        var rows = FilterSales(await ListarVendasAsync(companyId), filters, includeItems: true)
            .OrderByDescending(item => item.SaleDate)
            .Select(item => Row(
                ("saleNumber", item.SaleNumber),
                ("data", item.SaleDate.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss")),
                ("cliente", item.CustomerName),
                ("pagamento", item.PaymentType),
                ("produto", item.ProductName),
                ("quantidade", item.Quantity),
                ("total", FormatMoney(item.ItemTotal))))
            .ToList();

        return Result(
            Columns(("saleNumber", "Venda"), ("data", "Data"), ("cliente", "Cliente"), ("pagamento", "Pagamento"), ("produto", "Produto"), ("quantidade", "Qtd."), ("total", "Total")),
            rows);
    }

    private async Task<object> GerarProdutosMaisVendidosAsync(string companyId, Dictionary<string, JsonElement> filters)
    {
        var rows = FilterSales(await ListarVendasAsync(companyId), filters, includeItems: true)
            .GroupBy(item => new { item.ProductCode, item.ProductName })
            .Select(group => Row(
                ("codigo", group.Key.ProductCode),
                ("produto", group.Key.ProductName),
                ("quantidade", group.Sum(item => item.Quantity)),
                ("faturamento", FormatMoney(group.Sum(item => item.ItemTotal)))))
            .OrderByDescending(row => Convert.ToInt32(row["quantidade"]))
            .ToList();

        return Result(
            Columns(("codigo", "Código"), ("produto", "Produto"), ("quantidade", "Qtd. vendida"), ("faturamento", "Faturamento")),
            rows);
    }

    private async Task<object> GerarClientesFrequentesAsync(string companyId, Dictionary<string, JsonElement> filters)
    {
        var rows = FilterSales(await ListarVendasAsync(companyId), filters, includeItems: false)
            .Where(item => IsWithinTimeRange(item.SaleDate, filters))
            .GroupBy(item => string.IsNullOrWhiteSpace(item.CustomerCpf) || item.CustomerCpf == "-"
                ? item.CustomerName
                : $"{item.CustomerName} ({item.CustomerCpf})")
            .Select(group =>
            {
                var total = group.Sum(item => item.TotalAmount);
                var count = group.Select(item => item.SaleNumber).Distinct().Count();
                return Row(
                    ("cliente", group.Key),
                    ("compras", count),
                    ("gastoTotal", FormatMoney(total)),
                    ("ticketMedio", FormatMoney(count == 0 ? 0 : total / count)));
            })
            .OrderByDescending(row => Convert.ToInt32(row["compras"]))
            .ToList();

        return Result(
            Columns(("cliente", "Cliente"), ("compras", "Compras"), ("gastoTotal", "Gasto total"), ("ticketMedio", "Ticket médio")),
            rows);
    }

    private async Task<object> GerarEstoqueCriticoAsync(string companyId, Dictionary<string, JsonElement> filters)
    {
        var onlyOutOfStock = GetBool(filters, "onlyOutOfStock");
        var rows = (await ListarProdutosAsync(companyId))
            .Where(item => onlyOutOfStock ? item.Quantity <= 0 : item.Quantity <= 5)
            .Select(item => Row(
                ("codigo", item.Code),
                ("produto", item.Name),
                ("estoque", item.Quantity),
                ("valorVenda", FormatMoney(item.SalePrice)),
                ("status", item.Quantity <= 0 ? "Sem estoque" : "Crítico")))
            .OrderBy(row => Convert.ToInt32(row["estoque"]))
            .ToList();

        return Result(
            Columns(("codigo", "Código"), ("produto", "Produto"), ("estoque", "Estoque"), ("valorVenda", "Preço venda"), ("status", "Status")),
            rows);
    }

    private async Task<object> GerarComprasFornecedorAsync(string companyId)
    {
        var rows = (await ListarProdutosAsync(companyId))
            .GroupBy(item => string.IsNullOrWhiteSpace(item.Supplier) ? "Sem fornecedor" : item.Supplier)
            .Select(group => Row(
                ("fornecedor", group.Key),
                ("produtos", group.Count()),
                ("unidades", group.Sum(item => item.Quantity)),
                ("custoEstoque", FormatMoney(group.Sum(item => item.UnitPrice * item.Quantity)))))
            .OrderBy(row => Convert.ToString(row["fornecedor"]))
            .ToList();

        return Result(
            Columns(("fornecedor", "Fornecedor"), ("produtos", "Produtos"), ("unidades", "Unidades"), ("custoEstoque", "Custo em estoque")),
            rows);
    }

    private async Task<object> GerarMovimentoEstoqueAsync(string companyId)
    {
        var rows = (await ListarProdutosAsync(companyId))
            .Select(item => Row(
                ("codigo", item.Code),
                ("produto", item.Name),
                ("estoqueAtual", item.Quantity),
                ("custoUnitario", FormatMoney(item.UnitPrice)),
                ("valorEstoque", FormatMoney(item.UnitPrice * item.Quantity))))
            .OrderBy(row => Convert.ToString(row["produto"]))
            .ToList();

        return Result(
            Columns(("codigo", "Código"), ("produto", "Produto"), ("estoqueAtual", "Estoque atual"), ("custoUnitario", "Custo unitário"), ("valorEstoque", "Valor em estoque")),
            rows);
    }

    private async Task<object> GerarDesempenhoCaixaAsync(string companyId, Dictionary<string, JsonElement> filters)
    {
        var startDate = GetDate(filters, "startDate") ?? DateTimeOffset.Now.AddDays(-30).Date;
        var endDate = (GetDate(filters, "endDate") ?? DateTimeOffset.Now.Date).AddDays(1);
        var rows = (await ListarCaixasAsync(companyId))
            .Where(item => item.OpenedAt >= startDate && item.OpenedAt < endDate)
            .Select(item => Row(
                ("abertura", item.OpenedAt.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss")),
                ("fechamento", item.ClosedAt?.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss") ?? "-"),
                ("operador", item.OperatorName),
                ("valorAbertura", FormatMoney(item.OpeningAmount)),
                ("valorFechamento", FormatMoney(item.ClosingAmount)),
                ("status", item.ClosedAt is null ? "Aberto" : "Fechado")))
            .ToList();

        return Result(
            Columns(("abertura", "Abertura"), ("fechamento", "Fechamento"), ("operador", "Operador"), ("valorAbertura", "Valor abertura"), ("valorFechamento", "Valor fechamento"), ("status", "Status")),
            rows);
    }

    private async Task<List<ReportSaleRow>> ListarVendasAsync(string companyId)
    {
        const string sql = """
            SELECT v.SaleNumber, v.CustomerName, v.CustomerCpf, v.PaymentType, v.TotalAmount, v.SaleDate,
                   i.ProductCode, i.ProductName, i.Quantity, i.UnitPrice, i.ItemTotal
            FROM Vendas v
            LEFT JOIN VendaItens i ON i.VendaId = v.Id
            WHERE v.CompanyId = @CompanyId
            ORDER BY v.SaleDate DESC;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<ReportSaleRow>();
        while (await reader.ReadAsync())
        {
            rows.Add(new ReportSaleRow(
                ReadString(reader, "SaleNumber"),
                ReadString(reader, "CustomerName"),
                ReadString(reader, "CustomerCpf"),
                NormalizePaymentType(ReadString(reader, "PaymentType")),
                ParseMoney(ReadString(reader, "TotalAmount")),
                reader.GetDateTimeOffset(reader.GetOrdinal("SaleDate")),
                ReadString(reader, "ProductCode"),
                ReadString(reader, "ProductName"),
                ReadInt(reader, "Quantity"),
                ParseMoney(ReadString(reader, "UnitPrice")),
                ParseMoney(ReadString(reader, "ItemTotal"))));
        }

        return rows;
    }

    private async Task<List<ReportProductRow>> ListarProdutosAsync(string companyId)
    {
        const string sql = """
            SELECT ProductCode, ProductName, ProductSupplier, ProductQnt, ProductUnitPrice, ProductSalePrice
            FROM Produtos
            WHERE CompanyId = @CompanyId
            ORDER BY ProductName;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<ReportProductRow>();
        while (await reader.ReadAsync())
        {
            rows.Add(new ReportProductRow(
                ReadString(reader, "ProductCode"),
                ReadString(reader, "ProductName"),
                ReadString(reader, "ProductSupplier"),
                ParseInt(ReadString(reader, "ProductQnt")),
                ParseMoney(ReadString(reader, "ProductUnitPrice")),
                ParseMoney(ReadString(reader, "ProductSalePrice"))));
        }

        return rows;
    }

    private async Task<List<ReportCashRow>> ListarCaixasAsync(string companyId)
    {
        const string sql = """
            SELECT OpenedAt, ClosedAt, OpeningAmount, ClosingAmount, OperatorName
            FROM CaixaSessoes
            WHERE CompanyId = @CompanyId
            ORDER BY OpenedAt DESC;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<ReportCashRow>();
        while (await reader.ReadAsync())
        {
            rows.Add(new ReportCashRow(
                reader.GetDateTimeOffset(reader.GetOrdinal("OpenedAt")),
                reader.IsDBNull(reader.GetOrdinal("ClosedAt")) ? null : reader.GetDateTimeOffset(reader.GetOrdinal("ClosedAt")),
                ParseMoney(ReadString(reader, "OpeningAmount")),
                ParseMoney(ReadString(reader, "ClosingAmount")),
                ReadString(reader, "OperatorName")));
        }

        return rows;
    }

    private static List<ReportSaleRow> FilterSales(List<ReportSaleRow> rows, Dictionary<string, JsonElement> filters, bool includeItems)
    {
        var startDate = GetDate(filters, "startDate") ?? DateTimeOffset.Now.AddDays(-30).Date;
        var endDate = (GetDate(filters, "endDate") ?? DateTimeOffset.Now.Date).AddDays(1);
        var paymentMethods = GetStringList(filters, "paymentMethod")
            .Where(item => item != "all")
            .Select(NormalizePaymentFilter)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var filtered = rows
            .Where(item => item.SaleDate >= startDate && item.SaleDate < endDate)
            .Where(item => paymentMethods.Count == 0 || paymentMethods.Contains(NormalizePaymentFilter(item.PaymentType)));

        if (!includeItems)
        {
            filtered = filtered
                .GroupBy(item => item.SaleNumber)
                .Select(group => group.First());
        }

        return filtered.ToList();
    }

    private static bool IsWithinTimeRange(DateTimeOffset saleDate, Dictionary<string, JsonElement> filters)
    {
        var startTime = GetTime(filters, "startTime");
        var endTime = GetTime(filters, "endTime");
        var localTime = saleDate.ToLocalTime().TimeOfDay;
        return (startTime is null || localTime >= startTime) &&
               (endTime is null || localTime <= endTime);
    }

    private static (string Label, DateTime Sort) BuildPeriodKey(DateTimeOffset date, string groupBy)
    {
        var local = date.ToLocalTime().Date;
        if (groupBy == "monthly")
        {
            var month = new DateTime(local.Year, local.Month, 1);
            return (month.ToString("MM/yyyy"), month);
        }

        if (groupBy == "weekly")
        {
            var diff = (7 + (local.DayOfWeek - DayOfWeek.Monday)) % 7;
            var monday = local.AddDays(-diff);
            return ($"{monday:dd/MM/yyyy} a {monday.AddDays(6):dd/MM/yyyy}", monday);
        }

        return (local.ToString("dd/MM/yyyy"), local);
    }

    private static object Result(object[] columns, List<Dictionary<string, object>> rows)
        => new { columns, rows };

    private static object[] Columns(params (string Key, string Label)[] columns)
        => columns.Select(column => new { key = column.Key, label = column.Label }).ToArray();

    private static Dictionary<string, object> Row(params (string Key, object Value)[] values)
        => values.ToDictionary(item => item.Key, item => item.Value);

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private static int ReadInt(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? 0 : reader.GetInt32(ordinal);
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

    private static DateTimeOffset? GetDate(Dictionary<string, JsonElement> filters, string key)
    {
        var value = GetString(filters, key);
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateTimeOffset.TryParse(value, out var parsed) ? parsed.Date : null;
    }

    private static TimeSpan? GetTime(Dictionary<string, JsonElement> filters, string key)
    {
        var value = GetString(filters, key);
        if (string.IsNullOrWhiteSpace(value)) return null;
        return TimeSpan.TryParse(value, out var parsed) ? parsed : null;
    }

    private static bool GetBool(Dictionary<string, JsonElement> filters, string key)
        => filters.TryGetValue(key, out var value) && value.ValueKind == JsonValueKind.True;

    private static string GetString(Dictionary<string, JsonElement> filters, string key, string fallback = "")
    {
        if (!filters.TryGetValue(key, out var value)) return fallback;
        return value.ValueKind == JsonValueKind.String ? value.GetString() ?? fallback : fallback;
    }

    private static List<string> GetStringList(Dictionary<string, JsonElement> filters, string key)
    {
        if (!filters.TryGetValue(key, out var value)) return [];
        if (value.ValueKind == JsonValueKind.String) return [value.GetString() ?? ""];
        if (value.ValueKind != JsonValueKind.Array) return [];
        return value.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.String)
            .Select(item => item.GetString() ?? "")
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToList();
    }

    private static string NormalizePaymentType(string value)
        => string.IsNullOrWhiteSpace(value) ? "-" : value.Trim();

    private static string NormalizePaymentFilter(string value)
    {
        var normalized = value
            .Normalize(NormalizationForm.FormD)
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            .Aggregate(string.Empty, (current, ch) => current + ch)
            .ToLowerInvariant();

        if (normalized.Contains("pix")) return "pix";
        if (normalized.Contains("debito") || normalized.Contains("debit")) return "debit";
        if (normalized.Contains("credito") || normalized.Contains("credit")) return "credit";
        if (normalized.Contains("dinheiro") || normalized.Contains("cash")) return "cash";
        return normalized;
    }

    private sealed record ReportSaleRow(
        string SaleNumber,
        string CustomerName,
        string CustomerCpf,
        string PaymentType,
        decimal TotalAmount,
        DateTimeOffset SaleDate,
        string ProductCode,
        string ProductName,
        int Quantity,
        decimal UnitPrice,
        decimal ItemTotal);

    private sealed record ReportProductRow(
        string Code,
        string Name,
        string Supplier,
        int Quantity,
        decimal UnitPrice,
        decimal SalePrice);

    private sealed record ReportCashRow(
        DateTimeOffset OpenedAt,
        DateTimeOffset? ClosedAt,
        decimal OpeningAmount,
        decimal ClosingAmount,
        string OperatorName);
}
