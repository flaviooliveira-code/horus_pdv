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
            "lucro-real" => await GerarLucroRealAsync(companyId, filters),
            "dre-simplificado" => await GerarDreSimplificadoAsync(companyId, filters),
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
            .OrderByDescending(row => Convert.ToDecimal(row["quantidade"], CultureInfo.InvariantCulture))
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
            .OrderBy(row => Convert.ToDecimal(row["estoque"], CultureInfo.InvariantCulture))
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
        var paymentMethods = GetStringList(filters, "paymentMethod")
            .Where(item => !string.Equals(item, "all", StringComparison.OrdinalIgnoreCase))
            .Select(NormalizePaymentFilter)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var rows = (await ListarCaixasAsync(companyId))
            .Where(item => item.OpenedAt >= startDate && item.OpenedAt < endDate)
            .Where(item => paymentMethods.Count == 0 || MatchesCashPaymentFilter(item, paymentMethods))
            .Select(item => Row(
                ("abertura", item.OpenedAt.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss")),
                ("fechamento", item.ClosedAt?.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss") ?? "-"),
                ("operador", item.OperatorName),
                ("valorAbertura", FormatMoney(item.OpeningAmount)),
                ("suprimentos", FormatMoney(item.TotalSuprimentos)),
                ("sangrias", FormatMoney(item.TotalSangrias)),
                ("saldoEsperado", FormatMoney(item.ExpectedCashAmount)),
                ("valorFechamento", FormatMoney(item.ClosingAmount)),
                ("quebraCaixa", FormatMoney(item.CashDifference)),
                ("status", item.ClosedAt is null ? "Aberto" : "Fechado")))
            .ToList();

        return Result(
            Columns(
                ("abertura", "Abertura"),
                ("fechamento", "Fechamento"),
                ("operador", "Operador"),
                ("valorAbertura", "Valor abertura"),
                ("suprimentos", "Suprimentos"),
                ("sangrias", "Sangrias"),
                ("saldoEsperado", "Saldo esperado"),
                ("valorFechamento", "Valor fechamento"),
                ("quebraCaixa", "Quebra / Sobra"),
                ("status", "Status")),
            rows);
    }

    private async Task<object> GerarLucroRealAsync(string companyId, Dictionary<string, JsonElement> filters)
    {
        var sales = FilterSales(await ListarVendasAsync(companyId), filters, includeItems: true);
        var viewMode = GetString(filters, "viewMode", "period");
        var groupBy = GetString(filters, "groupBy", "daily");

        var items = sales
            .Where(s => !string.IsNullOrWhiteSpace(s.ProductCode) && s.Quantity > 0)
            .Select(s => new LucroItemInput(
                s.SaleNumber,
                s.SaleDate,
                s.ProductCode,
                s.ProductName,
                s.Quantity,
                s.UnitPrice,
                s.UnitCostPrice,
                s.ItemTotal))
            .ToList();

        var result = CalcularLucroReal(items, viewMode, groupBy);
        return Result(result.Columns, result.Rows);
    }

    private async Task<object> GerarDreSimplificadoAsync(string companyId, Dictionary<string, JsonElement> filters)
    {
        var startDate = GetDate(filters, "startDate") ?? DateTimeOffset.Now.AddDays(-30).Date;
        var endDate = (GetDate(filters, "endDate") ?? DateTimeOffset.Now.Date).AddDays(1);
        var regime = GetString(filters, "regime", "competencia");

        var sales = FilterSales(await ListarVendasAsync(companyId), filters, includeItems: true)
            .Where(s => !string.IsNullOrWhiteSpace(s.ProductCode) && s.Quantity > 0)
            .Select(s => new LucroItemInput(
                s.SaleNumber,
                s.SaleDate,
                s.ProductCode,
                s.ProductName,
                s.Quantity,
                s.UnitPrice,
                s.UnitCostPrice,
                s.ItemTotal))
            .ToList();

        var expenses = await ListarDespesasAsync(companyId);
        var dre = CalcularDreSimplificado(sales, expenses, startDate.DateTime, endDate.DateTime, regime);
        return Result(dre.Columns, dre.Rows);
    }

    public static (object[] Columns, List<Dictionary<string, object>> Rows) CalcularLucroReal(
        IEnumerable<LucroItemInput> items,
        string viewMode = "period",
        string groupBy = "daily")
    {
        var list = items?.ToList() ?? [];
        if (string.Equals(viewMode, "product", StringComparison.OrdinalIgnoreCase))
        {
            var productRows = list
                .GroupBy(i => new { Code = i.ProductCode.Trim(), Name = i.ProductName.Trim() })
                .Select(g =>
                {
                    var qty = g.Sum(x => x.Quantity);
                    var revenue = g.Sum(x => x.ItemTotal > 0m ? x.ItemTotal : x.UnitPrice * x.Quantity);
                    var cmv = g.Sum(x => x.UnitCostPrice * x.Quantity);
                    var grossProfit = revenue - cmv;
                    var margin = revenue > 0m
                        ? Math.Round(grossProfit / revenue * 100m, 2, MidpointRounding.AwayFromZero)
                        : 0m;
                    return (
                        GrossProfitDecimal: grossProfit,
                        RowData: Row(
                            ("codigo", g.Key.Code),
                            ("produto", g.Key.Name),
                            ("quantidade", qty),
                            ("receitaBruta", FormatMoney(revenue)),
                            ("cmv", FormatMoney(cmv)),
                            ("lucroBruto", FormatMoney(grossProfit)),
                            ("margemBruta", $"{margin.ToString("N2", PtBr)}%"))
                    );
                })
                .OrderByDescending(x => x.GrossProfitDecimal)
                .Select(x => x.RowData)
                .ToList();

            return (
                Columns(
                    ("codigo", "Código"),
                    ("produto", "Produto"),
                    ("quantidade", "Qtd. vendida"),
                    ("receitaBruta", "Receita bruta"),
                    ("cmv", "CMV (Custo)"),
                    ("lucroBruto", "Lucro bruto"),
                    ("margemBruta", "Margem bruta")),
                productRows);
        }

        var periodRows = list
            .GroupBy(i => BuildPeriodKey(i.SaleDate, groupBy))
            .OrderBy(g => g.Key.Sort)
            .Select(g =>
            {
                var salesCount = g.Select(x => x.SaleNumber).Distinct().Count();
                var revenue = g.Sum(x => x.ItemTotal > 0m ? x.ItemTotal : x.UnitPrice * x.Quantity);
                var cmv = g.Sum(x => x.UnitCostPrice * x.Quantity);
                var grossProfit = revenue - cmv;
                var margin = revenue > 0m
                    ? Math.Round(grossProfit / revenue * 100m, 2, MidpointRounding.AwayFromZero)
                    : 0m;
                return Row(
                    ("periodo", g.Key.Label),
                    ("vendas", salesCount),
                    ("receitaBruta", FormatMoney(revenue)),
                    ("cmv", FormatMoney(cmv)),
                    ("lucroBruto", FormatMoney(grossProfit)),
                    ("margemBruta", $"{margin.ToString("N2", PtBr)}%"));
            })
            .ToList();

        return (
            Columns(
                ("periodo", "Período"),
                ("vendas", "Vendas"),
                ("receitaBruta", "Receita bruta"),
                ("cmv", "CMV (Custo)"),
                ("lucroBruto", "Lucro bruto"),
                ("margemBruta", "Margem bruta")),
            periodRows);
    }

    public static (object[] Columns, List<Dictionary<string, object>> Rows) CalcularDreSimplificado(
        IEnumerable<LucroItemInput> sales,
        IEnumerable<DespesaDreInput> expenses,
        DateTime startDate,
        DateTime endDateExclusive,
        string regime = "competencia")
    {
        var salesList = sales?.ToList() ?? [];
        var expensesList = expenses?.ToList() ?? [];
        var isCaixa = string.Equals(regime, "caixa", StringComparison.OrdinalIgnoreCase);

        var filteredExpenses = expensesList
            .Where(e =>
            {
                if (isCaixa)
                {
                    return string.Equals(e.Status, "Pago", StringComparison.OrdinalIgnoreCase)
                           && e.PaidDate.HasValue
                           && e.PaidDate.Value.Date >= startDate.Date
                           && e.PaidDate.Value.Date < endDateExclusive.Date;
                }

                return e.CompetenceDate.Date >= startDate.Date && e.CompetenceDate.Date < endDateExclusive.Date;
            })
            .ToList();

        var grossRevenue = salesList.Sum(s => s.ItemTotal > 0m ? s.ItemTotal : s.UnitPrice * s.Quantity);
        var cmv = salesList.Sum(s => s.UnitCostPrice * s.Quantity);
        var grossProfit = grossRevenue - cmv;
        var totalExpenses = filteredExpenses.Sum(e => e.Amount);
        var netProfit = grossProfit - totalExpenses;

        string Pct(decimal value) => grossRevenue > 0m
            ? $"{Math.Round(value / grossRevenue * 100m, 2, MidpointRounding.AwayFromZero).ToString("N2", PtBr)}%"
            : "0,00%";

        var rows = new List<Dictionary<string, object>>
        {
            Row(("conta", "1. Receita Bruta de Vendas"), ("categoria", "Receita Operacional"), ("valor", FormatMoney(grossRevenue)), ("av", grossRevenue > 0m ? "100,00%" : "0,00%"), ("situacao", "Faturamento")),
            Row(("conta", "2. (-) CMV — Custo das Mercadorias Vendidas"), ("categoria", "Custos Diretos"), ("valor", FormatMoney(cmv)), ("av", Pct(cmv)), ("situacao", "Custo")),
            Row(("conta", "3. (=) Resultado Operacional Bruto (Lucro Bruto)"), ("categoria", "Margem Bruta"), ("valor", FormatMoney(grossProfit)), ("av", Pct(grossProfit)), ("situacao", grossProfit >= 0m ? "Superávit Bruto" : "Déficit Bruto")),
            Row(("conta", $"4. (-) Despesas Operacionais ({(isCaixa ? "Regime de Caixa" : "Regime de Competência")})"), ("categoria", "Despesas Gerais"), ("valor", FormatMoney(totalExpenses)), ("av", Pct(totalExpenses)), ("situacao", $"{filteredExpenses.Count} lançamento(s)"))
        };

        foreach (var group in filteredExpenses.GroupBy(e => string.IsNullOrWhiteSpace(e.Category) ? "Operacional" : e.Category).OrderByDescending(g => g.Sum(x => x.Amount)))
        {
            var catSum = group.Sum(x => x.Amount);
            rows.Add(Row(
                ("conta", $"   • {group.Key}"),
                ("categoria", "Detalhamento de Despesa"),
                ("valor", FormatMoney(catSum)),
                ("av", Pct(catSum)),
                ("situacao", $"{group.Count()} item(ns)")));
        }

        rows.Add(Row(
            ("conta", "5. (=) Resultado Líquido do Período (Lucro / Prejuízo Líquido)"),
            ("categoria", "Resultado Final"),
            ("valor", FormatMoney(netProfit)),
            ("av", Pct(netProfit)),
            ("situacao", netProfit > 0m ? "LUCRO LÍQUIDO" : netProfit < 0m ? "PREJUÍZO" : "EQUILÍBRIO")));

        return (
            Columns(
                ("conta", "Conta / Indicador DRE"),
                ("categoria", "Natureza"),
                ("valor", "Valor (R$)"),
                ("av", "Análise Vertical (%)"),
                ("situacao", "Status")),
            rows);
    }

    private async Task<List<ReportSaleRow>> ListarVendasAsync(string companyId)
    {
        const string ensureSql = """
            IF COL_LENGTH(N'VendaItens', N'UnitCostPrice') IS NULL
                ALTER TABLE VendaItens ADD UnitCostPrice NVARCHAR(30) NOT NULL CONSTRAINT DF_VendaItens_UnitCostPrice DEFAULT N'0,00';
            """;

        const string sql = """
            SELECT v.SaleNumber, v.CustomerName, v.CustomerCpf, v.PaymentType, v.TotalAmount, v.SaleDate,
                   i.ProductCode, i.ProductName, i.Quantity, i.UnitPrice,
                   COALESCE(NULLIF(LTRIM(RTRIM(i.UnitCostPrice)), ''), p.ProductUnitPrice, N'0,00') AS EffectiveUnitCostPrice,
                   i.ItemTotal
            FROM Vendas v
            LEFT JOIN VendaItens i ON i.VendaId = v.Id
            LEFT JOIN Produtos p ON p.CompanyId = v.CompanyId AND p.ProductCode = i.ProductCode
            WHERE v.CompanyId = @CompanyId
            ORDER BY v.SaleDate DESC;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using (var ensureCmd = new SqlCommand(ensureSql, db))
        {
            await ensureCmd.ExecuteNonQueryAsync();
        }

        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<ReportSaleRow>();
        while (await reader.ReadAsync())
        {
            var unitCost = ParseMoney(ReadString(reader, "EffectiveUnitCostPrice"));
            rows.Add(new ReportSaleRow(
                ReadString(reader, "SaleNumber"),
                ReadString(reader, "CustomerName"),
                ReadString(reader, "CustomerCpf"),
                NormalizePaymentType(ReadString(reader, "PaymentType")),
                ParseMoney(ReadString(reader, "TotalAmount")),
                reader.GetDateTimeOffset(reader.GetOrdinal("SaleDate")),
                ReadString(reader, "ProductCode"),
                ReadString(reader, "ProductName"),
                ReadDecimal(reader, "Quantity"),
                ParseMoney(ReadString(reader, "UnitPrice")),
                unitCost,
                ParseMoney(ReadString(reader, "ItemTotal"))));
        }

        return rows;
    }

    private async Task<List<DespesaDreInput>> ListarDespesasAsync(string companyId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await Controllers.Despesas.DespesasController.EnsureSchemaAsync(db);

        await using var command = new SqlCommand(
            """
            SELECT Category, Amount, CompetenceDate, DueDate, PaidDate, Status
            FROM DespesasOperacionais
            WHERE CompanyId = @CompanyId;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<DespesaDreInput>();
        while (await reader.ReadAsync())
        {
            rows.Add(new DespesaDreInput(
                ReadString(reader, "Category"),
                ParseMoney(ReadString(reader, "Amount")),
                reader.GetDateTime(reader.GetOrdinal("CompetenceDate")),
                reader.GetDateTime(reader.GetOrdinal("DueDate")),
                reader.IsDBNull(reader.GetOrdinal("PaidDate")) ? null : reader.GetDateTime(reader.GetOrdinal("PaidDate")),
                ReadString(reader, "Status")));
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
                ReadDecimal(reader, "ProductQnt"),
                ParseMoney(ReadString(reader, "ProductUnitPrice")),
                ParseMoney(ReadString(reader, "ProductSalePrice"))));
        }

        return rows;
    }

    private async Task<List<ReportCashRow>> ListarCaixasAsync(string companyId)
    {
        const string sql = """
            SELECT Id, OpenedAt, ClosedAt, OpeningAmount, ClosingAmount, OperatorName,
                   ExpectedCashAmount, CashDifference,
                   SalesCashTotal, SalesPixTotal, SalesDebitTotal, SalesCreditTotal,
                   TotalSuprimentos, TotalSangrias
            FROM CaixaSessoes
            WHERE CompanyId = @CompanyId
            ORDER BY OpenedAt DESC;
            """;

        await using var db = await connection.OpenConnectionAsync();
        var rows = new List<ReportCashRow>();
        await using (var command = new SqlCommand(sql, db))
        {
            command.Parameters.AddWithValue("@CompanyId", companyId);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                rows.Add(new ReportCashRow(
                    ReadString(reader, "Id"),
                    reader.GetDateTimeOffset(reader.GetOrdinal("OpenedAt")),
                    reader.IsDBNull(reader.GetOrdinal("ClosedAt")) ? null : reader.GetDateTimeOffset(reader.GetOrdinal("ClosedAt")),
                    ParseMoney(ReadString(reader, "OpeningAmount")),
                    ParseMoney(ReadString(reader, "ClosingAmount")),
                    ReadString(reader, "OperatorName"),
                    ReadDecimalColumn(reader, "ExpectedCashAmount"),
                    ReadDecimalColumn(reader, "CashDifference"),
                    ReadDecimalColumn(reader, "SalesCashTotal"),
                    ReadDecimalColumn(reader, "SalesPixTotal"),
                    ReadDecimalColumn(reader, "SalesDebitTotal"),
                    ReadDecimalColumn(reader, "SalesCreditTotal"),
                    ReadDecimalColumn(reader, "TotalSuprimentos"),
                    ReadDecimalColumn(reader, "TotalSangrias")));
            }
        }

        // Para sessões ainda abertas, calcula os totais ao vivo a partir de CaixaMovimentacoes e Vendas.
        for (var index = 0; index < rows.Count; index += 1)
        {
            var row = rows[index];
            if (row.ClosedAt is not null) continue;

            var suprimentos = 0m;
            var sangrias = 0m;
            var cashReturns = 0m;
            await using (var movCmd = new SqlCommand(
                             """
                             SELECT Tipo, FormaPagamento, Valor
                             FROM CaixaMovimentacoes
                             WHERE CompanyId = @CompanyId AND CaixaSessaoId = @CaixaSessaoId;
                             """,
                             db))
            {
                movCmd.Parameters.AddWithValue("@CompanyId", companyId);
                movCmd.Parameters.AddWithValue("@CaixaSessaoId", row.Id);
                await using var movReader = await movCmd.ExecuteReaderAsync();
                while (await movReader.ReadAsync())
                {
                    var tipo = ReadString(movReader, "Tipo");
                    var payment = NormalizePaymentFilter(ReadString(movReader, "FormaPagamento"));
                    var valor = ReadDecimalColumn(movReader, "Valor");
                    if (string.Equals(tipo, "SUPRIMENTO", StringComparison.OrdinalIgnoreCase))
                    {
                        suprimentos += valor;
                    }
                    else if (string.Equals(tipo, "SANGRIA", StringComparison.OrdinalIgnoreCase))
                    {
                        sangrias += valor;
                    }
                    else if (string.Equals(tipo, "DEVOLUCAO", StringComparison.OrdinalIgnoreCase) && payment == "cash")
                    {
                        cashReturns += valor;
                    }
                }
            }

            var salesCash = 0m;
            var salesPix = 0m;
            var salesDebit = 0m;
            var salesCredit = 0m;
            await using (var salesCmd = new SqlCommand(
                             """
                             SELECT PaymentType, TotalAmount
                             FROM Vendas
                             WHERE CompanyId = @CompanyId AND CaixaSessaoId = @CaixaSessaoId;
                             """,
                             db))
            {
                salesCmd.Parameters.AddWithValue("@CompanyId", companyId);
                salesCmd.Parameters.AddWithValue("@CaixaSessaoId", row.Id);
                await using var salesReader = await salesCmd.ExecuteReaderAsync();
                while (await salesReader.ReadAsync())
                {
                    var payment = NormalizePaymentFilter(ReadString(salesReader, "PaymentType"));
                    var amount = ParseMoney(ReadString(salesReader, "TotalAmount"));
                    if (payment == "cash") salesCash += amount;
                    else if (payment == "pix") salesPix += amount;
                    else if (payment == "debit") salesDebit += amount;
                    else if (payment == "credit") salesCredit += amount;
                }
            }

            var expectedCash = Math.Round(row.OpeningAmount + salesCash + suprimentos - sangrias - cashReturns, 2, MidpointRounding.AwayFromZero);
            rows[index] = row with
            {
                ExpectedCashAmount = expectedCash,
                SalesCashTotal = salesCash,
                SalesPixTotal = salesPix,
                SalesDebitTotal = salesDebit,
                SalesCreditTotal = salesCredit,
                TotalSuprimentos = suprimentos,
                TotalSangrias = sangrias
            };
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
        decimal Quantity,
        decimal UnitPrice,
        decimal UnitCostPrice,
        decimal ItemTotal);

    private sealed record ReportProductRow(
        string Code,
        string Name,
        string Supplier,
        decimal Quantity,
        decimal UnitPrice,
        decimal SalePrice);

    private static decimal ReadDecimalColumn(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? 0m : reader.GetDecimal(ordinal);
    }

    private static bool MatchesCashPaymentFilter(ReportCashRow row, HashSet<string> paymentMethods)
    {
        if (paymentMethods.Contains("cash") && row.SalesCashTotal > 0m) return true;
        if (paymentMethods.Contains("pix") && row.SalesPixTotal > 0m) return true;
        if (paymentMethods.Contains("debit") && row.SalesDebitTotal > 0m) return true;
        if (paymentMethods.Contains("credit") && row.SalesCreditTotal > 0m) return true;
        return false;
    }

    private sealed record ReportCashRow(
        string Id,
        DateTimeOffset OpenedAt,
        DateTimeOffset? ClosedAt,
        decimal OpeningAmount,
        decimal ClosingAmount,
        string OperatorName,
        decimal ExpectedCashAmount,
        decimal CashDifference,
        decimal SalesCashTotal,
        decimal SalesPixTotal,
        decimal SalesDebitTotal,
        decimal SalesCreditTotal,
        decimal TotalSuprimentos,
        decimal TotalSangrias);

    public sealed record LucroItemInput(
        string SaleNumber,
        DateTimeOffset SaleDate,
        string ProductCode,
        string ProductName,
        decimal Quantity,
        decimal UnitPrice,
        decimal UnitCostPrice,
        decimal ItemTotal);

    public sealed record DespesaDreInput(
        string Category,
        decimal Amount,
        DateTime CompetenceDate,
        DateTime DueDate,
        DateTime? PaidDate,
        string Status);
}
