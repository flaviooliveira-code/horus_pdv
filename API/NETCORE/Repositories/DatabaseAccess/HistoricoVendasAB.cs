/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/HistoricoVendasAB.cs
 * Objetivo: concentra comandos SQL e persistência de histórico de vendas e recibos.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class HistoricoVendasAB(Connection connection)
{
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
        await EnsurePrintColumnsAsync(db);
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

    public async Task<VendaRegistroResultadoAD> RegistrarAsync(string companyId, VendaRequest request)
    {
        await using var db = await connection.OpenConnectionAsync();
        await EnsurePrintColumnsAsync(db);
        await using var transaction = (SqlTransaction)await db.BeginTransactionAsync();

        try
        {
            var saleNumber = await NextSaleNumberAsync(db, transaction);
            var now = DateTimeOffset.Now;
            var saleId = $"sale-{saleNumber}";
            var customerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Consumidor" : request.CustomerName.Trim();
            var customerCpf = string.IsNullOrWhiteSpace(request.CustomerCpf) ? "-" : request.CustomerCpf.Trim();
            var paymentType = string.IsNullOrWhiteSpace(request.PaymentType) ? "-" : request.PaymentType.Trim();
            var totalAmount = string.IsNullOrWhiteSpace(request.TotalAmount) ? "0,00" : request.TotalAmount.Trim();
            var operatorName = string.IsNullOrWhiteSpace(request.OperatorName) ? "Operador" : request.OperatorName.Trim();
            // A venda e a baixa de estoque compartilham a mesma transação para evitar histórico sem estoque atualizado.
            var saleItems = await BaixarEstoqueAsync(db, transaction, companyId, request.Items);

            await using (var saleCommand = new SqlCommand(
                             """
                             INSERT INTO Vendas
                                 (Id, CompanyId, SaleNumber, CustomerName, CustomerCpf, PaymentType, TotalAmount, OperatorName, SaleDate)
                             VALUES
                                 (@Id, @CompanyId, @SaleNumber, @CustomerName, @CustomerCpf, @PaymentType, @TotalAmount, @OperatorName, @SaleDate);
                             """,
                             db,
                             transaction))
            {
                saleCommand.Parameters.AddWithValue("@Id", saleId);
                saleCommand.Parameters.AddWithValue("@CompanyId", companyId);
                saleCommand.Parameters.AddWithValue("@SaleNumber", saleNumber);
                saleCommand.Parameters.AddWithValue("@CustomerName", customerName);
                saleCommand.Parameters.AddWithValue("@CustomerCpf", customerCpf);
                saleCommand.Parameters.AddWithValue("@PaymentType", paymentType);
                saleCommand.Parameters.AddWithValue("@TotalAmount", totalAmount);
                saleCommand.Parameters.AddWithValue("@OperatorName", operatorName);
                saleCommand.Parameters.AddWithValue("@SaleDate", now);
                await saleCommand.ExecuteNonQueryAsync();
            }

            var rows = new List<VendaHistoricoAD>();
            for (var index = 0; index < saleItems.Count; index += 1)
            {
                var item = saleItems[index];
                var itemId = $"{saleId}-item-{index + 1:000}";
                await using var itemCommand = new SqlCommand(
                    """
                    INSERT INTO VendaItens
                        (Id, VendaId, ProductCode, ProductName, Quantity, UnitPrice, ItemTotal)
                    VALUES
                        (@Id, @VendaId, @ProductCode, @ProductName, @Quantity, @UnitPrice, @ItemTotal);
                    """,
                    db,
                    transaction);
                itemCommand.Parameters.AddWithValue("@Id", itemId);
                itemCommand.Parameters.AddWithValue("@VendaId", saleId);
                itemCommand.Parameters.AddWithValue("@ProductCode", item.ProductCode);
                itemCommand.Parameters.AddWithValue("@ProductName", item.ProductName);
                itemCommand.Parameters.AddWithValue("@Quantity", item.Quantity);
                itemCommand.Parameters.AddWithValue("@UnitPrice", item.UnitPrice);
                itemCommand.Parameters.AddWithValue("@ItemTotal", CalculateTotal(item.UnitPrice, item.Quantity));
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
                    ItemTotal = CalculateTotal(item.UnitPrice, item.Quantity),
                    SaleDate = now.LocalDateTime.ToString("dd/MM/yyyy HH:mm:ss")
                });
            }

            await transaction.CommitAsync();
            return new VendaRegistroResultadoAD { SaleNumber = saleNumber, Rows = rows };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
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
        IEnumerable<VendaItemRequest> items)
    {
        var groupedItems = items
            .GroupBy(item => item.ProductCode.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(group => new VendaItemRecord
            {
                ProductCode = group.Key,
                ProductName = group.First().ProductName.Trim(),
                Quantity = group.Sum(item => item.Quantity)
            })
            .ToList();

        foreach (var item in groupedItems)
        {
            if (item.Quantity <= 0)
            {
                throw new InvalidOperationException("Quantidade da venda deve ser maior que zero.");
            }

            await using var select = new SqlCommand(
                """
                SELECT Id, ProductName, ProductQnt, ProductUnitPrice, ProductSalePrice
                FROM Produtos WITH (UPDLOCK, ROWLOCK)
                WHERE CompanyId = @CompanyId AND ProductCode = @ProductCode;
                """,
                db,
                transaction);
            select.Parameters.AddWithValue("@ProductCode", item.ProductCode);
            select.Parameters.AddWithValue("@CompanyId", companyId);
            await using var reader = await select.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException($"Produto {item.ProductCode} não encontrado.");
            }

            var productId = ReadString(reader, "Id");
            item.ProductName = ReadString(reader, "ProductName");
            var currentStock = ParseInt(ReadString(reader, "ProductQnt"));
            var unitPrice = ReadString(reader, "ProductUnitPrice");
            var salePrice = ReadString(reader, "ProductSalePrice");
            item.UnitPrice = string.IsNullOrWhiteSpace(salePrice) ? unitPrice : salePrice;
            await reader.CloseAsync();

            if (currentStock < item.Quantity)
            {
                throw new InvalidOperationException(
                    $"Estoque insuficiente para {item.ProductName}. Disponível: {currentStock}.");
            }

            var nextStock = currentStock - item.Quantity;
            await using var update = new SqlCommand(
                """
                UPDATE Produtos
                   SET ProductQnt = @ProductQnt,
                       TotalPriceOnProduct = @TotalPriceOnProduct
                 WHERE Id = @Id;
                """,
                db,
                transaction);
            update.Parameters.AddWithValue("@ProductQnt", nextStock.ToString());
            update.Parameters.AddWithValue("@TotalPriceOnProduct", CalculateTotal(unitPrice, nextStock));
            update.Parameters.AddWithValue("@Id", productId);
            await update.ExecuteNonQueryAsync();
        }

        return groupedItems;
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
        Quantity = reader.GetInt32(reader.GetOrdinal("Quantity")),
        UnitPrice = ReadString(reader, "UnitPrice"),
        ItemTotal = ReadString(reader, "ItemTotal"),
        SaleDate = reader.GetDateTimeOffset(reader.GetOrdinal("SaleDate")).LocalDateTime.ToString("dd/MM/yyyy HH:mm:ss")
    };

    private static async Task EnsurePrintColumnsAsync(SqlConnection db)
    {
        const string schemaSql = """
            IF COL_LENGTH('Vendas', 'PaymentType') IS NULL
                ALTER TABLE Vendas ADD PaymentType NVARCHAR(30) NOT NULL CONSTRAINT DF_Vendas_PaymentType DEFAULT N'-';
            IF COL_LENGTH('Vendas', 'TotalAmount') IS NULL
                ALTER TABLE Vendas ADD TotalAmount NVARCHAR(30) NOT NULL CONSTRAINT DF_Vendas_TotalAmount DEFAULT N'0,00';
            IF COL_LENGTH('Vendas', 'OperatorName') IS NULL
                ALTER TABLE Vendas ADD OperatorName NVARCHAR(180) NOT NULL CONSTRAINT DF_Vendas_OperatorName DEFAULT N'Operador';
            IF COL_LENGTH('VendaItens', 'UnitPrice') IS NULL
                ALTER TABLE VendaItens ADD UnitPrice NVARCHAR(30) NOT NULL CONSTRAINT DF_VendaItens_UnitPrice DEFAULT N'0,00';
            IF COL_LENGTH('VendaItens', 'ItemTotal') IS NULL
                ALTER TABLE VendaItens ADD ItemTotal NVARCHAR(30) NOT NULL CONSTRAINT DF_VendaItens_ItemTotal DEFAULT N'0,00';
            """;

        const string backfillSql = """
            UPDATE i
               SET UnitPrice = COALESCE(NULLIF(LTRIM(RTRIM(p.ProductSalePrice)), ''), NULLIF(LTRIM(RTRIM(p.ProductUnitPrice)), ''), N'0,00')
              FROM VendaItens i
              INNER JOIN Produtos p ON p.ProductCode = i.ProductCode
             WHERE NULLIF(LTRIM(RTRIM(i.UnitPrice)), '') IS NULL
                OR REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(i.UnitPrice)), N'R$', N''), N'.', N''), N',', N'.') IN (N'0', N'0.00');

            UPDATE i
               SET ItemTotal = FORMAT(
                    TRY_CONVERT(
                        DECIMAL(18, 2),
                        REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(i.UnitPrice)), N'R$', N''), N'.', N''), N',', N'.')
                    ) * i.Quantity,
                    N'N2',
                    N'pt-BR'
               )
              FROM VendaItens i
             WHERE (NULLIF(LTRIM(RTRIM(i.ItemTotal)), '') IS NULL
                OR REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(i.ItemTotal)), N'R$', N''), N'.', N''), N',', N'.') IN (N'0', N'0.00'))
               AND TRY_CONVERT(
                    DECIMAL(18, 2),
                    REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(i.UnitPrice)), N'R$', N''), N'.', N''), N',', N'.')
               ) IS NOT NULL;
            """;

        await using (var schemaCommand = new SqlCommand(schemaSql, db))
        {
            await schemaCommand.ExecuteNonQueryAsync();
        }

        await using var backfillCommand = new SqlCommand(backfillSql, db);
        await backfillCommand.ExecuteNonQueryAsync();
    }

    private static int ParseInt(string value)
        => int.TryParse(value, out var parsed) ? parsed : 0;

    private static string CalculateTotal(string unitPrice, int quantity)
    {
        var normalized = unitPrice.Replace(".", "").Replace(",", ".");
        if (!decimal.TryParse(
                normalized,
                System.Globalization.NumberStyles.Number,
                System.Globalization.CultureInfo.InvariantCulture,
                out var parsed))
        {
            return "0,00";
        }

        return (parsed * quantity).ToString("N2", new System.Globalization.CultureInfo("pt-BR"));
    }

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private sealed class VendaItemRecord
    {
        public string ProductCode { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string UnitPrice { get; set; } = string.Empty;
        public int Quantity { get; set; }
    }
}
