/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/ProdutoAB.cs
 * Objetivo: concentra comandos SQL e persistência de cadastro, estoque e manutenção de produtos.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using HORUSPDV_API.Repositories.DataAccess;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class ProdutoAB(Connection connection)
{
    public async Task<List<ProdutoAD>> ListarAsync(string companyId)
    {
        const string sql = """
            SELECT Id, ProductImageUrl, ProductImageName, ProductName, ProductCode, ProductSupplier,
                   ProductDescription, ProductQnt, ProductUnitPrice, ProductSalePrice, TotalPriceOnProduct
            FROM Produtos
            WHERE CompanyId = @CompanyId
            ORDER BY ProductName;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<ProdutoAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(Map(reader));
        }

        return rows;
    }

    public async Task<ProdutoAD?> ObterAsync(string companyId, string id)
    {
        const string sql = """
            SELECT Id, ProductImageUrl, ProductImageName, ProductName, ProductCode, ProductSupplier,
                   ProductDescription, ProductQnt, ProductUnitPrice, ProductSalePrice, TotalPriceOnProduct
            FROM Produtos
            WHERE Id = @Id AND CompanyId = @CompanyId;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Id", id);
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task<ProdutoAD> SalvarAsync(string companyId, ProdutoAD product)
    {
        var supplierId = await ResolveSupplierIdAsync(companyId, product.ProductSupplier);
        const string sql = """
            IF EXISTS (SELECT 1 FROM Produtos WHERE Id = @Id AND CompanyId = @CompanyId)
            BEGIN
                UPDATE Produtos
                   SET ProductImageUrl = @ProductImageUrl,
                       ProductImageName = @ProductImageName,
                       ProductName = @ProductName,
                       ProductCode = @ProductCode,
                       ProductSupplier = @ProductSupplier,
                       SupplierId = @SupplierId,
                       ProductDescription = @ProductDescription,
                       ProductQnt = @ProductQnt,
                       ProductUnitPrice = @ProductUnitPrice,
                       ProductSalePrice = @ProductSalePrice,
                       TotalPriceOnProduct = @TotalPriceOnProduct
                 WHERE Id = @Id AND CompanyId = @CompanyId;
            END
            ELSE
            BEGIN
                INSERT INTO Produtos
                    (Id, CompanyId, ProductImageUrl, ProductImageName, ProductName, ProductCode, ProductSupplier, SupplierId,
                     ProductDescription, ProductQnt, ProductUnitPrice, ProductSalePrice, TotalPriceOnProduct)
                VALUES
                    (@Id, @CompanyId, @ProductImageUrl, @ProductImageName, @ProductName, @ProductCode, @ProductSupplier, @SupplierId,
                     @ProductDescription, @ProductQnt, @ProductUnitPrice, @ProductSalePrice, @TotalPriceOnProduct);
            END;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        AddParameters(command, product, supplierId);
        await command.ExecuteNonQueryAsync();
        return product;
    }

    public async Task<bool> ExcluirAsync(string companyId, string id)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand("DELETE FROM Produtos WHERE Id = @Id AND CompanyId = @CompanyId;", db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Id", id);
        return await command.ExecuteNonQueryAsync() > 0;
    }

    public async Task BaixarEstoqueAsync(IEnumerable<(string ProductCode, int Quantity)> items)
    {
        var groupedItems = items
            .GroupBy(item => item.ProductCode.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(group => new { ProductCode = group.Key, Quantity = group.Sum(item => item.Quantity) })
            .ToList();

        await using var db = await connection.OpenConnectionAsync();
        await using var transaction = (SqlTransaction)await db.BeginTransactionAsync();

        try
        {
            // Agrupa itens repetidos antes do bloqueio pessimista para baixar estoque uma única vez por produto.
            foreach (var item in groupedItems)
            {
                if (item.Quantity <= 0)
                {
                    throw new InvalidOperationException("Quantidade da venda deve ser maior que zero.");
                }

                await using var select = new SqlCommand(
                    """
                    SELECT Id, ProductName, ProductQnt, ProductUnitPrice
                    FROM Produtos WITH (UPDLOCK, ROWLOCK)
                    WHERE ProductCode = @ProductCode;
                    """,
                    db,
                    transaction);
                select.Parameters.AddWithValue("@ProductCode", item.ProductCode);
                await using var reader = await select.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    throw new InvalidOperationException($"Produto {item.ProductCode} não encontrado.");
                }

                var productId = ReadString(reader, "Id");
                var productName = ReadString(reader, "ProductName");
                var currentStock = ParseInt(ReadString(reader, "ProductQnt"));
                var unitPrice = ReadString(reader, "ProductUnitPrice");
                await reader.CloseAsync();

                if (currentStock < item.Quantity)
                {
                    throw new InvalidOperationException(
                        $"Estoque insuficiente para {productName}. Disponível: {currentStock}.");
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

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task<string?> ResolveSupplierIdAsync(string companyId, string supplierName)
    {
        const string sql = """
            SELECT TOP 1 Id
            FROM Fornecedores
            WHERE CompanyId = @CompanyId AND (FantasyName = @Name OR CompanyName = @Name);
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Name", supplierName);
        var result = await command.ExecuteScalarAsync();
        return result as string;
    }

    private static void AddParameters(SqlCommand command, ProdutoAD product, string? supplierId)
    {
        command.Parameters.AddWithValue("@Id", product.Id);
        command.Parameters.AddWithValue("@ProductImageUrl", product.ProductImageUrl);
        command.Parameters.AddWithValue("@ProductImageName", product.ProductImageName);
        command.Parameters.AddWithValue("@ProductName", product.ProductName);
        command.Parameters.AddWithValue("@ProductCode", product.ProductCode);
        command.Parameters.AddWithValue("@ProductSupplier", product.ProductSupplier);
        command.Parameters.AddWithValue("@SupplierId", supplierId is null ? DBNull.Value : supplierId);
        command.Parameters.AddWithValue("@ProductDescription", product.ProductDescription);
        command.Parameters.AddWithValue("@ProductQnt", product.ProductQnt);
        command.Parameters.AddWithValue("@ProductUnitPrice", product.ProductUnitPrice);
        command.Parameters.AddWithValue("@ProductSalePrice", product.ProductSalePrice);
        command.Parameters.AddWithValue("@TotalPriceOnProduct", product.TotalPriceOnProduct);
    }

    private static ProdutoAD Map(SqlDataReader source) => new()
    {
        Id = ReadString(source, "Id"),
        ProductImageUrl = ReadString(source, "ProductImageUrl"),
        ProductImageName = ReadString(source, "ProductImageName"),
        ProductName = ReadString(source, "ProductName"),
        ProductCode = ReadString(source, "ProductCode"),
        ProductSupplier = ReadString(source, "ProductSupplier"),
        ProductDescription = ReadString(source, "ProductDescription"),
        ProductQnt = ReadString(source, "ProductQnt"),
        ProductUnitPrice = ReadString(source, "ProductUnitPrice"),
        ProductSalePrice = ReadString(source, "ProductSalePrice"),
        TotalPriceOnProduct = ReadString(source, "TotalPriceOnProduct")
    };

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
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
}
