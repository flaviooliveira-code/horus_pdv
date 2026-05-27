/**
 * Arquivo: API/NETCORE/Services/Produtos/ProdutoService.cs
 * Objetivo: centraliza regras de negócio de cadastro, estoque e manutenção de produtos antes do acesso ao banco ou resposta HTTP.
 * Entradas esperadas: recebe requisições já validadas pelos controladores e aplica consistência operacional do domínio.
 */
using HORUSPDV_API.Models.Produtos;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;

namespace HORUSPDV_API.Services.Produtos;

public class ProdutoService(ProdutoAB produtosAB, FornecedorAB fornecedoresAB) : IProdutoService
{
    public async Task<List<ProdutoModel>> ListarAsync(string companyId)
        => (await produtosAB.ListarAsync(companyId)).Select(ToModel).ToList();

    public async Task<ProdutoModel> CriarAsync(string companyId, ProdutoRequest request)
    {
        Validate(request);
        await ValidateBusinessRulesAsync(companyId, request, null);
        var product = MapRequest($"pr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request);
        return ToModel(await produtosAB.SalvarAsync(companyId, product));
    }

    public async Task<ProdutoModel?> AtualizarAsync(string companyId, string id, ProdutoRequest request)
    {
        Validate(request);
        var current = await produtosAB.ObterAsync(companyId, id);
        if (current is null)
        {
            return null;
        }

        await ValidateBusinessRulesAsync(companyId, request, id);
        return ToModel(await produtosAB.SalvarAsync(companyId, MapRequest(id, request)));
    }

    public Task<bool> ExcluirAsync(string companyId, string id)
        => produtosAB.ExcluirAsync(companyId, id);

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

    private async Task ValidateBusinessRulesAsync(string companyId, ProdutoRequest request, string? currentId)
    {
        var products = await produtosAB.ListarAsync(companyId);
        var productCode = request.ProductCode.Trim();
        if (products.Any(item =>
                item.Id != currentId &&
                item.ProductCode.Equals(productCode, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Já existe produto com este código.");
        }

        var suppliers = await fornecedoresAB.ListarAsync(companyId);
        var supplierName = request.ProductSupplier.Trim();
        if (!suppliers.Any(item =>
                item.FantasyName.Equals(supplierName, StringComparison.OrdinalIgnoreCase) ||
                item.CompanyName.Equals(supplierName, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Fornecedor informado não está cadastrado.");
        }
    }

    private static ProdutoAD MapRequest(string id, ProdutoRequest request) => new()
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

    private static ProdutoModel ToModel(ProdutoAD source) => new()
    {
        Id = source.Id,
        ProductImageUrl = source.ProductImageUrl,
        ProductImageName = source.ProductImageName,
        ProductName = source.ProductName,
        ProductCode = source.ProductCode,
        ProductSupplier = source.ProductSupplier,
        ProductDescription = source.ProductDescription,
        ProductQnt = source.ProductQnt,
        ProductUnitPrice = source.ProductUnitPrice,
        ProductSalePrice = source.ProductSalePrice,
        TotalPriceOnProduct = source.TotalPriceOnProduct
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
