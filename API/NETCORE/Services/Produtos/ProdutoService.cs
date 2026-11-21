/**
 * Arquivo: API/NETCORE/Services/Produtos/ProdutoService.cs
 * Objetivo: centraliza regras de negócio de cadastro, estoque e manutenção de produtos antes do acesso ao banco ou resposta HTTP.
 * Entradas esperadas: recebe requisições já validadas pelos controladores e aplica consistência operacional do domínio.
 */
using System.Globalization;
using HORUSPDV_API.Models.Produtos;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;

namespace HORUSPDV_API.Services.Produtos;

public class ProdutoService(
    ProdutoAB produtosAB,
    FornecedorAB fornecedoresAB,
    ScaleBarcodeParser scaleBarcodeParser) : IProdutoService
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

    public async Task<ScaleBarcodeDecodeResponse?> DecodificarBalancaAsync(string companyId, string barcode, string? mode = null)
    {
        ScaleBarcodeParser.NormalizeMode(mode);
        var parsed = scaleBarcodeParser.ParseBarcode(barcode);
        var matchingProducts = await produtosAB.ObterPorCodigoOuBalancaAsync(companyId, parsed.AllCandidateCodes);
        if (matchingProducts.Count == 0)
        {
            return null;
        }

        return scaleBarcodeParser.DecodeForProducts(barcode, matchingProducts, mode);
    }

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

        if (!TryParseDecimal(request.ProductQnt, out var quantity) || quantity <= 0m)
        {
            throw new InvalidOperationException("Quantidade do produto deve ser maior que zero.");
        }

        if (decimal.Round(quantity, 3) != quantity)
        {
            throw new InvalidOperationException("Quantidade do produto deve ter no maximo 3 casas decimais.");
        }

        NormalizeUnitType(request.UnitType);

        if (ParseDecimal(request.ProductUnitPrice) <= 0m)
        {
            throw new InvalidOperationException("Preco de custo deve ser maior que zero.");
        }

        if (ParseDecimal(request.ProductSalePrice) <= 0m)
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

    private static ProdutoAD MapRequest(string id, ProdutoRequest request)
    {
        TryParseDecimal(request.ProductQnt, out var quantity);
        var normalizedQnt = decimal.Round(quantity, 3, MidpointRounding.AwayFromZero)
            .ToString("0.###", CultureInfo.InvariantCulture);

        return new ProdutoAD
        {
            Id = id,
            ProductImageUrl = request.ProductImageUrl,
            ProductImageName = request.ProductImageName,
            ProductName = request.ProductName.Trim(),
            ProductCode = request.ProductCode.Trim(),
            ProductSupplier = request.ProductSupplier.Trim(),
            ProductDescription = request.ProductDescription.Trim(),
            ProductQnt = normalizedQnt,
            ProductUnitPrice = request.ProductUnitPrice,
            ProductSalePrice = request.ProductSalePrice,
            TotalPriceOnProduct = request.TotalPriceOnProduct,
            UnitType = NormalizeUnitType(request.UnitType)
        };
    }

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
        TotalPriceOnProduct = source.TotalPriceOnProduct,
        UnitType = string.IsNullOrWhiteSpace(source.UnitType) ? "UN" : source.UnitType.Trim().ToUpperInvariant()
    };

    internal static string NormalizeUnitType(string? unitType)
    {
        if (string.IsNullOrWhiteSpace(unitType))
        {
            return "UN";
        }

        var normalized = unitType.Trim().ToUpperInvariant();
        return normalized is "UN" or "KG"
            ? normalized
            : throw new InvalidOperationException("Unidade de medida invalida. Utilize UN ou KG.");
    }

    internal static bool TryParseDecimal(string? value, out decimal parsed)
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

    internal static decimal ParseDecimal(string? value)
        => TryParseDecimal(value, out var parsed) ? parsed : 0m;
}
