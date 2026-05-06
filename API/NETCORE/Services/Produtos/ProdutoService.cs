using HORUSPDV_API.Models.Produtos;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.AcessoBanco;

namespace HORUSPDV_API.Services.Produtos;

public class ProdutoService(HorusMockDatabase database) : IProdutoService
{
    public Task<List<ProdutoModel>> ListarAsync()
        => database.ListarProdutosAsync();

    public async Task<ProdutoModel> CriarAsync(ProdutoRequest request)
    {
        Validate(request);
        await ValidateBusinessRulesAsync(request, null);
        var product = MapRequest($"pr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request);
        return await database.SalvarProdutoAsync(product);
    }

    public async Task<ProdutoModel?> AtualizarAsync(string id, ProdutoRequest request)
    {
        Validate(request);
        var current = await database.ObterProdutoAsync(id);
        if (current is null)
        {
            return null;
        }

        await ValidateBusinessRulesAsync(request, id);
        return await database.SalvarProdutoAsync(MapRequest(id, request));
    }

    public Task<bool> ExcluirAsync(string id)
        => database.ExcluirProdutoAsync(id);

    private static void Validate(ProdutoRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ProductName) || request.ProductName.Trim().Length < 3)
        {
            throw new InvalidOperationException("Nome do produto deve ter no minimo 3 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(request.ProductCode))
        {
            throw new InvalidOperationException("Codigo do produto e obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.ProductSupplier))
        {
            throw new InvalidOperationException("Fornecedor do produto e obrigatorio.");
        }

        if (!int.TryParse(request.ProductQnt, out var quantity) || quantity <= 0)
        {
            throw new InvalidOperationException("Quantidade do produto deve ser maior que zero.");
        }

        if (ParseMoney(request.ProductUnitPrice) <= 0)
        {
            throw new InvalidOperationException("Preco de custo deve ser maior que zero.");
        }

        if (ParseMoney(request.ProductSalePrice) <= 0)
        {
            throw new InvalidOperationException("Preco de venda deve ser maior que zero.");
        }
    }

    private async Task ValidateBusinessRulesAsync(ProdutoRequest request, string? currentId)
    {
        var products = await database.ListarProdutosAsync();
        var productCode = request.ProductCode.Trim();
        if (products.Any(item =>
                item.Id != currentId &&
                item.ProductCode.Equals(productCode, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Ja existe produto com este codigo.");
        }

        var suppliers = await database.ListarFornecedoresAsync();
        var supplierName = request.ProductSupplier.Trim();
        if (!suppliers.Any(item =>
                item.FantasyName.Equals(supplierName, StringComparison.OrdinalIgnoreCase) ||
                item.CompanyName.Equals(supplierName, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Fornecedor informado nao esta cadastrado.");
        }
    }

    private static ProdutoModel MapRequest(string id, ProdutoRequest request) => new()
    {
        Id = id,
        ProductImageUrl = request.ProductImageUrl,
        ProductImageName = request.ProductImageName,
        ProductName = request.ProductName.Trim(),
        ProductCode = request.ProductCode.Trim(),
        ProductSupplier = request.ProductSupplier.Trim(),
        ProductDescription = request.ProductDescription.Trim(),
        ProductQnt = request.ProductQnt,
        ProductUnitPrice = request.ProductUnitPrice,
        ProductSalePrice = request.ProductSalePrice,
        TotalPriceOnProduct = request.TotalPriceOnProduct
    };

    private static decimal ParseMoney(string value)
    {
        var normalized = value.Trim().Replace(".", "").Replace(",", ".");
        return decimal.TryParse(
            normalized,
            System.Globalization.NumberStyles.Number,
            System.Globalization.CultureInfo.InvariantCulture,
            out var parsed)
            ? parsed
            : 0;
    }
}
