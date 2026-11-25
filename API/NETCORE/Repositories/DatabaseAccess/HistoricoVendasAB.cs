/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/HistoricoVendasAB.cs
 * Objetivo: concentra comandos SQL e persistência de histórico de vendas e recibos.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using System.Data;
using System.Globalization;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Services.Caixa;
using HORUSPDV_API.Services.Produtos;
using HORUSPDV_API.Services.Security;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class HistoricoVendasAB(Connection connection)
{
    private static readonly CultureInfo PtBr = new("pt-BR");

    public async Task<List<VendaHistoricoAD>> ListarAsync(string companyId, string? saleNumber = null)
    {
        const string sql = """
            SELECT v.SaleNumber, v.CustomerName, v.CustomerCpf, v.PaymentType,
                   v.TotalAmount, v.OperatorName, v.SaleDate,
                   i.ProductCode, i.ProductName, i.Quantity, i.UnitPrice, i.ItemTotal
            FROM VendaItens i
            INNER JOIN Vendas v ON v.Id = i.VendaId
            WHERE v.CompanyId = @CompanyId
              AND (@SaleNumber IS NULL OR v.SaleNumber = @SaleNumber)
            ORDER BY v.SaleDate DESC;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@SaleNumber", string.IsNullOrWhiteSpace(saleNumber) ? DBNull.Value : saleNumber);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<VendaHistoricoAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(Map(reader));
        }

        return rows;
    }

    public async Task<VendaRegistroResultadoAD> RegistrarAsync(
        string companyId,
        VendaRequest request,
        string usuarioId = "",
        string usuarioName = "",
        string usuarioRole = "")
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var transaction = (SqlTransaction)await db.BeginTransactionAsync();

        try
        {
            var now = DateTimeOffset.Now;
            var openSession = await ResolveActiveCaixaSessionAsync(db, transaction, companyId, now);
            var saleNumber = await NextSaleNumberAsync(db, transaction);
            var saleId = $"sale-{saleNumber}";
            var customerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Consumidor" : request.CustomerName.Trim();
            var customerCpf = string.IsNullOrWhiteSpace(request.CustomerCpf) ? "-" : request.CustomerCpf.Trim();
            var paymentType = string.IsNullOrWhiteSpace(request.PaymentType) ? "-" : request.PaymentType.Trim();
            var operatorName = string.IsNullOrWhiteSpace(request.OperatorName) ? "Operador" : request.OperatorName.Trim();

            // A venda e a baixa de estoque compartilham a mesma transação para evitar histórico sem estoque atualizado.
            var saleItems = await BaixarEstoqueAsync(db, transaction, companyId, request.Items, CanOverrideFixedPrice(usuarioRole));
            var serverSaleTotal = Math.Round(saleItems.Sum(item => item.FinalItemTotal), 2, MidpointRounding.AwayFromZero);

            if (!string.IsNullOrWhiteSpace(request.TotalAmount))
            {
                if (!TryParseMoney(request.TotalAmount, out var clientTotal) || clientTotal != serverSaleTotal)
                {
                    throw new InvalidOperationException("Total da venda divergente da soma dos itens.");
                }
            }

            var totalAmount = serverSaleTotal.ToString("N2", PtBr);

            await using (var saleCommand = new SqlCommand(
                             """
                             INSERT INTO Vendas
                                 (Id, CompanyId, CaixaSessaoId, SaleNumber, CustomerName, CustomerCpf, PaymentType, TotalAmount, OperatorName, SaleDate)
                             VALUES
                                 (@Id, @CompanyId, @CaixaSessaoId, @SaleNumber, @CustomerName, @CustomerCpf, @PaymentType, @TotalAmount, @OperatorName, @SaleDate);
                             """,
                             db,
                             transaction))
            {
                saleCommand.Parameters.AddWithValue("@Id", saleId);
                saleCommand.Parameters.AddWithValue("@CompanyId", companyId);
                saleCommand.Parameters.AddWithValue("@CaixaSessaoId", openSession.SessionId);
                saleCommand.Parameters.AddWithValue("@SaleNumber", saleNumber);
                saleCommand.Parameters.AddWithValue("@CustomerName", customerName);
                saleCommand.Parameters.AddWithValue("@CustomerCpf", customerCpf);
                saleCommand.Parameters.AddWithValue("@PaymentType", paymentType);
                saleCommand.Parameters.AddWithValue("@TotalAmount", totalAmount);
                saleCommand.Parameters.AddWithValue("@OperatorName", operatorName);
                saleCommand.Parameters.AddWithValue("@SaleDate", now);
                await saleCommand.ExecuteNonQueryAsync();
            }

            if (!string.IsNullOrWhiteSpace(request.PaymentChargeId))
            {
                await VincularCobrancaAsync(db, transaction, companyId, request.PaymentChargeId.Trim(), saleNumber, totalAmount);
            }

            var rows = new List<VendaHistoricoAD>();
            for (var index = 0; index < saleItems.Count; index += 1)
            {
                var item = saleItems[index];
                var itemId = $"{saleId}-item-{index + 1:000}";
                var itemTotalFormatted = item.FinalItemTotal.ToString("N2", PtBr);

                await using var itemCommand = new SqlCommand(
                    """
                    INSERT INTO VendaItens
                        (Id, VendaId, ProductCode, ProductName, Quantity, UnitPrice, UnitCostPrice, ItemTotal)
                    VALUES
                        (@Id, @VendaId, @ProductCode, @ProductName, @Quantity, @UnitPrice, @UnitCostPrice, @ItemTotal);
                    """,
                    db,
                    transaction);
                itemCommand.Parameters.AddWithValue("@Id", itemId);
                itemCommand.Parameters.AddWithValue("@VendaId", saleId);
                itemCommand.Parameters.AddWithValue("@ProductCode", item.ProductCode);
                itemCommand.Parameters.AddWithValue("@ProductName", item.ProductName);
                var qtyParam = itemCommand.Parameters.Add("@Quantity", SqlDbType.Decimal);
                qtyParam.Precision = 10;
                qtyParam.Scale = 3;
                qtyParam.Value = item.Quantity;
                itemCommand.Parameters.AddWithValue("@UnitPrice", item.UnitPrice);
                itemCommand.Parameters.AddWithValue("@UnitCostPrice", string.IsNullOrWhiteSpace(item.UnitCostPrice) ? "0,00" : item.UnitCostPrice);
                itemCommand.Parameters.AddWithValue("@ItemTotal", itemTotalFormatted);
                await itemCommand.ExecuteNonQueryAsync();

                rows.Add(new VendaHistoricoAD
                {
                    SaleNumber = saleNumber,
                    CustomerName = customerName,
                    CustomerCpf = customerCpf,
                    PaymentType = paymentType,
                    TotalAmount = totalAmount,
                    OperatorName = operatorName,
                    ProductCode = item.ProductCode,
                    ProductName = item.ProductName,
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                    ItemTotal = itemTotalFormatted,
                    SaleDate = now.LocalDateTime.ToString("dd/MM/yyyy HH:mm:ss")
                });
            }

            await RegistrarMovimentoVendaCaixaAsync(
                db,
                transaction,
                companyId,
                openSession.SessionId,
                saleNumber,
                paymentType,
                totalAmount,
                string.IsNullOrWhiteSpace(usuarioId) ? openSession.OperatorId : usuarioId,
                string.IsNullOrWhiteSpace(usuarioName) ? operatorName : usuarioName,
                now);

            await transaction.CommitAsync();
            return new VendaRegistroResultadoAD { SaleNumber = saleNumber, Rows = rows };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Vincula a cobrança PIX à venda na mesma transação. Só aceita cobrança paga, da mesma empresa,
    /// com o mesmo valor e ainda não usada; caso contrário a venda inteira é desfeita.
    /// </summary>
    private static async Task VincularCobrancaAsync(
        SqlConnection db,
        SqlTransaction transaction,
        string companyId,
        string chargeId,
        string saleNumber,
        string totalAmount)
    {
        if (!TryParseMoney(totalAmount, out var total))
        {
            throw new InvalidOperationException("Total da venda inválido para conferir o PIX.");
        }

        await using var command = new SqlCommand(
            """
            UPDATE CobrancasPagamento
               SET SaleNumber = @SaleNumber,
                   UpdatedAt = SYSUTCDATETIME()
             WHERE Id = @Id
               AND CompanyId = @CompanyId
               AND Status = N'PAID'
               AND SaleNumber IS NULL
               AND AmountCents = @AmountCents;
            """,
            db,
            transaction);
        command.Parameters.AddWithValue("@Id", chargeId);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@SaleNumber", saleNumber);
        command.Parameters.AddWithValue("@AmountCents", (long)Math.Round(total * 100m, MidpointRounding.AwayFromZero));
        if (await command.ExecuteNonQueryAsync() == 0)
        {
            throw new InvalidOperationException("O PIX desta venda não está confirmado, tem outro valor ou já foi usado em outra venda.");
        }
    }

    private static async Task<(string SessionId, string OperatorId)> ResolveActiveCaixaSessionAsync(
        SqlConnection db,
        SqlTransaction transaction,
        string companyId,
        DateTimeOffset now)
    {
        await using var command = new SqlCommand(
            """
            SELECT TOP 1 Id, OpenedAt, OperatorId
            FROM CaixaSessoes WITH (UPDLOCK, ROWLOCK)
            WHERE CompanyId = @CompanyId AND ClosedAt IS NULL
            ORDER BY OpenedAt DESC;
            """,
            db,
            transaction);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            throw new InvalidOperationException("Abra o caixa do dia antes de iniciar vendas.");
        }

        var sessionId = ReadString(reader, "Id");
        var openedAt = reader.GetDateTimeOffset(reader.GetOrdinal("OpenedAt"));
        var operatorId = ReadString(reader, "OperatorId");
        await reader.CloseAsync();

        if (openedAt.Date != now.Date)
        {
            throw new InvalidOperationException("O caixa aberto pertence a outro dia. Feche o caixa atual e abra o caixa do dia.");
        }

        if (now - openedAt > TimeSpan.FromHours(24))
        {
            throw new InvalidOperationException("O caixa aberto ultrapassou 24 horas. Feche o caixa atual e abra um novo.");
        }

        return (sessionId, operatorId);
    }

    private static async Task RegistrarMovimentoVendaCaixaAsync(
        SqlConnection db,
        SqlTransaction transaction,
        string companyId,
        string caixaSessaoId,
        string saleNumber,
        string paymentType,
        string totalAmount,
        string usuarioId,
        string usuarioName,
        DateTimeOffset now)
    {
        PtBrMoneyParser.TryParse(totalAmount, out var valor);
        await using var command = new SqlCommand(
            """
            INSERT INTO CaixaMovimentacoes
                (Id, CompanyId, CaixaSessaoId, Tipo, FormaPagamento, Valor, Descricao, SaleNumber, UsuarioId, UsuarioName, DataHora)
            VALUES
                (@Id, @CompanyId, @CaixaSessaoId, N'VENDA', @FormaPagamento, @Valor, @Descricao, @SaleNumber, @UsuarioId, @UsuarioName, @DataHora);
            """,
            db,
            transaction);
        command.Parameters.AddWithValue("@Id", $"mov-{Guid.NewGuid():N}"[..36]);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@CaixaSessaoId", caixaSessaoId);
        command.Parameters.AddWithValue("@FormaPagamento", HorusCaixaService.NormalizePaymentMethod(paymentType));
        command.Parameters.AddWithValue("@Valor", Math.Round(valor, 2, MidpointRounding.AwayFromZero));
        command.Parameters.AddWithValue("@Descricao", $"Venda #{saleNumber}");
        command.Parameters.AddWithValue("@SaleNumber", saleNumber);
        command.Parameters.AddWithValue("@UsuarioId", usuarioId);
        command.Parameters.AddWithValue("@UsuarioName", usuarioName);
        command.Parameters.AddWithValue("@DataHora", now);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<string> NextSaleNumberAsync(SqlConnection db, SqlTransaction transaction)
    {
        await using var command = new SqlCommand(
            "SELECT CONVERT(NVARCHAR(30), ISNULL(MAX(TRY_CONVERT(INT, SaleNumber)), 15039) + 1) FROM Vendas WITH (UPDLOCK, HOLDLOCK);",
            db,
            transaction);
        return Convert.ToString(await command.ExecuteScalarAsync()) ?? "15040";
    }

    private static async Task<List<VendaItemRecord>> BaixarEstoqueAsync(
        SqlConnection db,
        SqlTransaction transaction,
        string companyId,
        IEnumerable<VendaItemRequest> items,
        bool canOverrideFixedPrice)
    {
        var rawItems = items?.ToList() ?? [];
        if (rawItems.Count == 0)
        {
            throw new InvalidOperationException("Informe ao menos um item na venda.");
        }

        foreach (var rawItem in rawItems)
        {
            if (string.IsNullOrWhiteSpace(rawItem.ProductCode))
            {
                throw new InvalidOperationException("Código do produto é obrigatório.");
            }

            if (rawItem.Quantity <= 0m || decimal.Round(rawItem.Quantity, 3) != rawItem.Quantity)
            {
                throw new InvalidOperationException("Quantidade da venda deve ser maior que zero e ter no máximo 3 casas decimais.");
            }

            if (rawItem.UnitPriceOverride is { } unitOverrideVal &&
                (unitOverrideVal <= 0m || decimal.Round(unitOverrideVal, 2) != unitOverrideVal))
            {
                throw new InvalidOperationException("Preço avulso do item inválido.");
            }

            if (rawItem.ItemTotalOverride is { } overrideVal &&
                (overrideVal <= 0m || decimal.Round(overrideVal, 2) != overrideVal))
            {
                throw new InvalidOperationException("Valor total do item inválido.");
            }
        }

        var groupedRequests = rawItems
            .GroupBy(item => item.ProductCode.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToList();

        var records = new List<VendaItemRecord>(rawItems.Count);
        foreach (var group in groupedRequests)
        {
            var productCode = group.Key;
            var totalQuantity = Math.Round(group.Sum(item => item.Quantity), 3, MidpointRounding.AwayFromZero);

            await using var select = new SqlCommand(
                """
                SELECT Id, ProductName, ProductQnt, ProductUnitPrice, ProductSalePrice,
                       CONVERT(NVARCHAR(10), ExpirationDate, 23) AS ExpirationDate
                FROM Produtos WITH (UPDLOCK, ROWLOCK)
                WHERE CompanyId = @CompanyId AND ProductCode = @ProductCode;
                """,
                db,
                transaction);
            select.Parameters.AddWithValue("@ProductCode", productCode);
            select.Parameters.AddWithValue("@CompanyId", companyId);
            await using var reader = await select.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException($"Produto {productCode} não encontrado.");
            }

            var productId = ReadString(reader, "Id");
            var productName = ReadString(reader, "ProductName");
            var currentStock = ReadDecimal(reader, "ProductQnt");
            var unitPrice = ReadString(reader, "ProductUnitPrice");
            var salePrice = ReadString(reader, "ProductSalePrice");
            var effectiveUnitPriceText = string.IsNullOrWhiteSpace(salePrice) ? unitPrice : salePrice;
            var unitCostPriceText = string.IsNullOrWhiteSpace(unitPrice) ? "0,00" : unitPrice;
            var expirationDate = ReadString(reader, "ExpirationDate");
            await reader.CloseAsync();

            var serverUnitPrice = ParseMoney(effectiveUnitPriceText);
            var liquidationCostPrice = ResolveLiquidationCostPrice(unitCostPriceText, expirationDate);
            var resolvedLines = group
                .Select(rawItem =>
                {
                    var pricing = ResolveSaleLinePricing(
                        serverUnitPrice,
                        rawItem.Quantity,
                        rawItem.UnitPriceOverride,
                        rawItem.ItemTotalOverride,
                        productName,
                        canOverrideFixedPrice,
                        liquidationCostPrice);
                    return new
                    {
                        rawItem.Quantity,
                        pricing.EffectiveUnitPrice,
                        pricing.FinalItemTotal
                    };
                })
                .ToList();

            if (currentStock < totalQuantity)
            {
                throw new InvalidOperationException(
                    $"Estoque insuficiente para {productName}. Disponível: {currentStock.ToString("0.###", CultureInfo.InvariantCulture)}.");
            }

            var nextStock = Math.Round(currentStock - totalQuantity, 3, MidpointRounding.AwayFromZero);
            await using var update = new SqlCommand(
                """
                UPDATE Produtos
                   SET ProductQnt = @ProductQnt,
                       TotalPriceOnProduct = @TotalPriceOnProduct
                 WHERE Id = @Id AND CompanyId = @CompanyId;
                """,
                db,
                transaction);
            var qntParam = update.Parameters.Add("@ProductQnt", SqlDbType.Decimal);
            qntParam.Precision = 12;
            qntParam.Scale = 3;
            qntParam.Value = nextStock;
            update.Parameters.AddWithValue("@TotalPriceOnProduct", CalculateTotal(unitPrice, nextStock));
            update.Parameters.AddWithValue("@Id", productId);
            update.Parameters.AddWithValue("@CompanyId", companyId);
            await update.ExecuteNonQueryAsync();

            // Agrupa linhas com o mesmo preço unitário, preservando preços avulsos distintos (ex.: fatias de tamanhos diferentes).
            foreach (var priceGroup in resolvedLines.GroupBy(line => line.EffectiveUnitPrice))
            {
                var lineQuantity = Math.Round(priceGroup.Sum(line => line.Quantity), 3, MidpointRounding.AwayFromZero);
                var lineTotal = Math.Round(priceGroup.Sum(line => line.FinalItemTotal), 2, MidpointRounding.AwayFromZero);
                records.Add(new VendaItemRecord
                {
                    ProductCode = productCode,
                    ProductName = productName,
                    UnitPrice = priceGroup.Key.ToString("N2", PtBr),
                    UnitCostPrice = unitCostPriceText,
                    Quantity = lineQuantity,
                    FinalItemTotal = lineTotal
                });
            }
        }

        return records;
    }

    /// <summary>Preço de custo liberado para venda por qualquer perfil quando o produto está vencido ou vence em até 7 dias.</summary>
    internal static decimal? ResolveLiquidationCostPrice(string? unitCostText, string? expirationDate, DateOnly? today = null)
    {
        var status = ProdutoExpirationHelper.Evaluate(expirationDate, today).Status;
        if (status != ProdutoExpirationHelper.StatusExpired && status != ProdutoExpirationHelper.StatusExpiringSoon)
        {
            return null;
        }

        var unitCost = Math.Round(ParseMoney(unitCostText), 2, MidpointRounding.AwayFromZero);
        return unitCost > 0m ? unitCost : null;
    }

    internal static bool CanOverrideFixedPrice(string? role)
        => HorusRoles.CanManagePrices(role);

    internal static (decimal EffectiveUnitPrice, decimal FinalItemTotal) ResolveSaleLinePricing(
        decimal serverUnitPrice,
        decimal quantity,
        decimal? unitPriceOverride,
        decimal? itemTotalOverride,
        string productName = "",
        bool canOverrideFixedPrice = false,
        decimal? liquidationCostPrice = null)
    {
        decimal effectiveUnitPrice;
        if (unitPriceOverride is { } customPrice)
        {
            if (customPrice <= 0m || decimal.Round(customPrice, 2) != customPrice)
            {
                throw new InvalidOperationException("Preço avulso do item inválido.");
            }

            // Preço avulso é livre para produtos sem preço fixo (fatiados, preço variável).
            // Alterar o preço de um produto com preço cadastrado exige administrador ou gerente.
            // Exceção: produto vencido ou prestes a vencer pode sair pelo preço de custo cadastrado.
            var isLiquidationAtCost = liquidationCostPrice is { } costPrice && customPrice == costPrice;
            if (serverUnitPrice > 0m && customPrice != serverUnitPrice && !canOverrideFixedPrice && !isLiquidationAtCost)
            {
                var label = string.IsNullOrWhiteSpace(productName) ? "este produto" : productName;
                throw new InvalidOperationException(
                    $"Somente administrador ou gerente pode alterar o preço de {label}, que tem preço cadastrado.");
            }

            effectiveUnitPrice = customPrice;
        }
        else
        {
            if (serverUnitPrice <= 0m)
            {
                var label = string.IsNullOrWhiteSpace(productName) ? "Produto" : $"Produto {productName}";
                throw new InvalidOperationException($"{label} está sem preço fixo. Informe o preço avulso no caixa.");
            }

            effectiveUnitPrice = serverUnitPrice;
        }

        var finalTotal = ResolveValidatedItemTotal(effectiveUnitPrice, quantity, itemTotalOverride);
        return (effectiveUnitPrice, finalTotal);
    }

    internal static decimal ResolveValidatedItemTotal(
        decimal serverUnitPrice,
        decimal quantity,
        decimal? itemTotalOverride)
    {
        if (serverUnitPrice <= 0m)
        {
            throw new InvalidOperationException("Produto sem preço de venda válido.");
        }

        if (quantity <= 0m || decimal.Round(quantity, 3) != quantity)
        {
            throw new InvalidOperationException("Quantidade da venda deve ser maior que zero e ter no máximo 3 casas decimais.");
        }

        var computedTotal = Math.Round(serverUnitPrice * quantity, 2, MidpointRounding.AwayFromZero);
        if (itemTotalOverride is null)
        {
            return computedTotal;
        }

        var overrideTotal = itemTotalOverride.Value;
        if (overrideTotal <= 0m || decimal.Round(overrideTotal, 2) != overrideTotal)
        {
            throw new InvalidOperationException("Valor total do item inválido.");
        }

        var tolerance = Math.Min(0.05m, Math.Max(0.01m, Math.Ceiling(serverUnitPrice * 0.0005m * 100m) / 100m));
        if (Math.Abs(overrideTotal - computedTotal) > tolerance ||
            Math.Round(overrideTotal / serverUnitPrice, 3, MidpointRounding.AwayFromZero) != quantity)
        {
            throw new InvalidOperationException("Valor total do item divergente do preço cadastrado.");
        }

        return overrideTotal;
    }

    private static VendaHistoricoAD Map(SqlDataReader reader) => new()
    {
        SaleNumber = ReadString(reader, "SaleNumber"),
        CustomerName = ReadString(reader, "CustomerName"),
        CustomerCpf = ReadString(reader, "CustomerCpf"),
        PaymentType = ReadString(reader, "PaymentType"),
        TotalAmount = ReadString(reader, "TotalAmount"),
        OperatorName = ReadString(reader, "OperatorName"),
        ProductCode = ReadString(reader, "ProductCode"),
        ProductName = ReadString(reader, "ProductName"),
        Quantity = ReadDecimal(reader, "Quantity"),
        UnitPrice = ReadString(reader, "UnitPrice"),
        ItemTotal = ReadString(reader, "ItemTotal"),
        SaleDate = reader.GetDateTimeOffset(reader.GetOrdinal("SaleDate")).LocalDateTime.ToString("dd/MM/yyyy HH:mm:ss")
    };

    internal static bool TryParseMoney(string? value, out decimal parsed)
    {
        parsed = 0m;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var trimmed = value.Trim().Replace("R$", string.Empty, StringComparison.OrdinalIgnoreCase).Trim();
        var normalized = trimmed.Contains(',')
            ? trimmed.Replace(".", string.Empty).Replace(',', '.')
            : trimmed;

        return decimal.TryParse(
            normalized,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out parsed);
    }

    internal static decimal ParseMoney(string? value)
        => TryParseMoney(value, out var parsed) ? parsed : 0m;

    internal static string CalculateTotal(string unitPrice, decimal quantity)
    {
        if (!TryParseMoney(unitPrice, out var parsed))
        {
            return "0,00";
        }

        return Math.Round(parsed * quantity, 2, MidpointRounding.AwayFromZero).ToString("N2", PtBr);
    }

    private static decimal ReadDecimal(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        if (reader.IsDBNull(ordinal)) return 0m;
        var raw = reader.GetValue(ordinal);
        return raw is string text
            ? ParseMoney(text)
            : Convert.ToDecimal(raw, CultureInfo.InvariantCulture);
    }

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : Convert.ToString(reader.GetValue(ordinal), CultureInfo.InvariantCulture) ?? string.Empty;
    }

    private sealed class VendaItemRecord
    {
        public string ProductCode { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string UnitPrice { get; set; } = string.Empty;
        public string UnitCostPrice { get; set; } = "0,00";
        public decimal Quantity { get; set; }
        public decimal FinalItemTotal { get; set; }
    }
}
