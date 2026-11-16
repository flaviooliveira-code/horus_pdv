/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/ProdutoAB.cs
 * Objetivo: concentra comandos SQL e persistência de cadastro, estoque e manutenção de produtos.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using System.Data;
using System.Globalization;
using HORUSPDV_API.Repositories.DataAccess;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class ProdutoAB(Connection connection)
{
    private static readonly CultureInfo PtBr = new("pt-BR");

    public async Task<List<ProdutoAD>> ListarAsync(string companyId)
    {
        const string sql = """
            SELECT Id, ProductImageUrl, ProductImageName, ProductName, ProductCode, ProductSupplier,
                   ProductDescription, ProductQnt, ProductUnitPrice, ProductSalePrice, TotalPriceOnProduct, UnitType
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
                   ProductDescription, ProductQnt, ProductUnitPrice, ProductSalePrice, TotalPriceOnProduct, UnitType
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

    public async Task<List<ProdutoAD>> ObterPorCodigoOuBalancaAsync(string companyId, IReadOnlyList<string> candidateCodes)
    {
        var normalizedCodes = candidateCodes
            .Select(code => code.Trim())
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedCodes.Count == 0)
        {
            return [];
        }

        var paramNames = normalizedCodes.Select((_, index) => $"@Code{index}").ToList();
        var sql = $"""
            SELECT Id, ProductImageUrl, ProductImageName, ProductName, ProductCode, ProductSupplier,
                   ProductDescription, ProductQnt, ProductUnitPrice, ProductSalePrice, TotalPriceOnProduct, UnitType
            FROM Produtos
            WHERE CompanyId = @CompanyId
              AND ProductCode IN ({string.Join(", ", paramNames)});
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        for (var i = 0; i < normalizedCodes.Count; i += 1)
        {
            command.Parameters.AddWithValue(paramNames[i], normalizedCodes[i]);
        }

        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<ProdutoAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(Map(reader));
        }

        return rows;
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
                       TotalPriceOnProduct = @TotalPriceOnProduct,
                       UnitType = @UnitType
                 WHERE Id = @Id AND CompanyId = @CompanyId;
            END
            ELSE
            BEGIN
                INSERT INTO Produtos
                    (Id, CompanyId, ProductImageUrl, ProductImageName, ProductName, ProductCode, ProductSupplier, SupplierId,
                     ProductDescription, ProductQnt, ProductUnitPrice, ProductSalePrice, TotalPriceOnProduct, UnitType)
                VALUES
                    (@Id, @CompanyId, @ProductImageUrl, @ProductImageName, @ProductName, @ProductCode, @ProductSupplier, @SupplierId,
                     @ProductDescription, @ProductQnt, @ProductUnitPrice, @ProductSalePrice, @TotalPriceOnProduct, @UnitType);
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

    public async Task BaixarEstoqueAsync(string companyId, IEnumerable<(string ProductCode, decimal Quantity)> items)
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
                if (item.Quantity <= 0 || decimal.Round(item.Quantity, 3) != item.Quantity)
                {
                    throw new InvalidOperationException("Quantidade da venda deve ser maior que zero e ter no máximo 3 casas decimais.");
                }

                await using var select = new SqlCommand(
                    """
                    SELECT Id, ProductName, ProductQnt, ProductUnitPrice
                    FROM Produtos WITH (UPDLOCK, ROWLOCK)
                    WHERE CompanyId = @CompanyId AND ProductCode = @ProductCode;
                    """,
                    db,
                    transaction);
                select.Parameters.AddWithValue("@CompanyId", companyId);
                select.Parameters.AddWithValue("@ProductCode", item.ProductCode);
                await using var reader = await select.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    throw new InvalidOperationException($"Produto {item.ProductCode} não encontrado.");
                }

                var productId = ReadString(reader, "Id");
                var productName = ReadString(reader, "ProductName");
                var currentStock = ReadDecimal(reader, "ProductQnt");
                var unitPrice = ReadString(reader, "ProductUnitPrice");
                await reader.CloseAsync();

                if (currentStock < item.Quantity)
                {
                    throw new InvalidOperationException(
                        $"Estoque insuficiente para {productName}. Disponível: {FormatQuantity(currentStock)}.");
                }

                var nextStock = Math.Round(currentStock - item.Quantity, 3, MidpointRounding.AwayFromZero);
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
        var quantity = Math.Round(ParseDecimal(product.ProductQnt), 3, MidpointRounding.AwayFromZero);
        var unitType = string.IsNullOrWhiteSpace(product.UnitType)
            ? "UN"
            : product.UnitType.Trim().ToUpperInvariant();

        command.Parameters.AddWithValue("@Id", product.Id);
        command.Parameters.AddWithValue("@ProductImageUrl", product.ProductImageUrl);
        command.Parameters.AddWithValue("@ProductImageName", product.ProductImageName);
        command.Parameters.AddWithValue("@ProductName", product.ProductName);
        command.Parameters.AddWithValue("@ProductCode", product.ProductCode);
        command.Parameters.AddWithValue("@ProductSupplier", product.ProductSupplier);
        command.Parameters.AddWithValue("@SupplierId", supplierId is null ? DBNull.Value : supplierId);
        command.Parameters.AddWithValue("@ProductDescription", product.ProductDescription);
        var qntParam = command.Parameters.Add("@ProductQnt", SqlDbType.Decimal);
        qntParam.Precision = 12;
        qntParam.Scale = 3;
        qntParam.Value = quantity;
        command.Parameters.AddWithValue("@ProductUnitPrice", product.ProductUnitPrice);
        command.Parameters.AddWithValue("@ProductSalePrice", product.ProductSalePrice);
        command.Parameters.AddWithValue("@TotalPriceOnProduct", product.TotalPriceOnProduct);
        command.Parameters.AddWithValue("@UnitType", unitType);
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
        ProductQnt = FormatQuantity(ReadDecimal(source, "ProductQnt")),
        ProductUnitPrice = ReadString(source, "ProductUnitPrice"),
        ProductSalePrice = ReadString(source, "ProductSalePrice"),
        TotalPriceOnProduct = ReadString(source, "TotalPriceOnProduct"),
        UnitType = ReadUnitType(source)
    };

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : Convert.ToString(reader.GetValue(ordinal), CultureInfo.InvariantCulture) ?? string.Empty;
    }

    private static string ReadUnitType(SqlDataReader reader)
    {
        var ordinal = reader.GetOrdinal("UnitType");
        if (reader.IsDBNull(ordinal)) return "UN";
        var value = reader.GetString(ordinal).Trim().ToUpperInvariant();
        return string.IsNullOrEmpty(value) ? "UN" : value;
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
        var trimmed = value.Trim().Replace("R$", string.Empty, StringComparison.OrdinalIgnoreCase).Trim();
        var normalized = trimmed.Contains(',')
            ? trimmed.Replace(".", string.Empty).Replace(',', '.')
            : trimmed;
        return decimal.TryParse(
            normalized,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out var parsed)
            ? parsed
            : 0m;
    }

    private static string FormatQuantity(decimal quantity)
        => Math.Round(quantity, 3, MidpointRounding.AwayFromZero).ToString("0.###", CultureInfo.InvariantCulture);

    private static string CalculateTotal(string unitPrice, decimal quantity)
    {
        var parsed = ParseDecimal(unitPrice);
        if (parsed <= 0m)
        {
            return "0,00";
        }

        return Math.Round(parsed * quantity, 2, MidpointRounding.AwayFromZero).ToString("N2", PtBr);
    }
}
