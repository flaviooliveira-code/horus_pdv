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
    private static readonly CultureInfo PtBr = new("pt-BR");

    public async Task<List<ProdutoModel>> ListarAsync(string companyId)
        => (await produtosAB.ListarAsync(companyId)).Select(ToModel).ToList();

    public async Task<ProdutoModel> CriarAsync(string companyId, ProdutoRequest request)
    {
        Validate(request);
        var resolvedCode = await ValidateBusinessRulesAndResolveCodeAsync(companyId, request, null);
        var product = MapRequest($"pr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request, resolvedCode);
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

        var resolvedCode = await ValidateBusinessRulesAndResolveCodeAsync(companyId, request, id, current.ProductCode);
        return ToModel(await produtosAB.SalvarAsync(companyId, MapRequest(id, request, resolvedCode)));
    }

    public async Task<ProdutoModel?> AplicarPrecoDeCustoAsync(string companyId, string id)
    {
        var current = await produtosAB.ObterAsync(companyId, id);
        if (current is null)
        {
            return null;
        }

        var unitCost = ParseDecimal(current.ProductUnitPrice);
        if (unitCost <= 0m)
        {
            throw new InvalidOperationException("Produto não possui preço de custo cadastrado maior que zero.");
        }

        current.ProductSalePrice = unitCost.ToString("N2", PtBr);
        return ToModel(await produtosAB.SalvarAsync(companyId, current));
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

    internal static void Validate(ProdutoRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ProductName) || request.ProductName.Trim().Length < 2)
        {
            throw new InvalidOperationException("Nome do produto deve ter no mínimo 2 caracteres.");
        }

        if (!string.IsNullOrWhiteSpace(request.ProductCategory) && request.ProductCategory.Trim().Length > 100)
        {
            throw new InvalidOperationException("Categoria do produto deve ter no máximo 100 caracteres.");
        }

        if (!string.IsNullOrWhiteSpace(request.ProductQnt))
        {
            if (!TryParseDecimal(request.ProductQnt, out var quantity) || quantity < 0m)
            {
                throw new InvalidOperationException("Quantidade do produto não pode ser negativa.");
            }

            if (decimal.Round(quantity, 3) != quantity)
            {
                throw new InvalidOperationException("Quantidade do produto deve ter no máximo 3 casas decimais.");
            }
        }

        NormalizeUnitType(request.UnitType);

        if (!string.IsNullOrWhiteSpace(request.ProductUnitPrice))
        {
            if (!TryParseDecimal(request.ProductUnitPrice, out var unitPrice) || unitPrice < 0m)
            {
                throw new InvalidOperationException("Preço de custo não pode ser negativo.");
            }
        }

        if (!string.IsNullOrWhiteSpace(request.ProductSalePrice))
        {
            if (!TryParseDecimal(request.ProductSalePrice, out var salePrice) || salePrice < 0m)
            {
                throw new InvalidOperationException("Preço de venda não pode ser negativo.");
            }
        }

        ProdutoExpirationHelper.NormalizeAndResolve(
            request.ExpirationMode,
            request.ManufactureDate,
            request.ShelfLifeDays,
            request.ExpirationDate);
    }

    private async Task<string> ValidateBusinessRulesAndResolveCodeAsync(
        string companyId,
        ProdutoRequest request,
        string? currentId,
        string? existingCode = null)
    {
        var products = await produtosAB.ListarAsync(companyId);
        var existingCodes = products
            .Where(item => item.Id != currentId && !string.IsNullOrWhiteSpace(item.ProductCode))
            .Select(item => item.ProductCode.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var requestedCode = (request.ProductCode ?? string.Empty).Trim();
        string resolvedCode;
        if (string.IsNullOrWhiteSpace(requestedCode))
        {
            resolvedCode = !string.IsNullOrWhiteSpace(existingCode) && !existingCodes.Contains(existingCode.Trim())
                ? existingCode.Trim()
                : GenerateInternalCode(existingCodes);
        }
        else
        {
            if (existingCodes.Contains(requestedCode))
            {
                throw new InvalidOperationException("Já existe produto com este código.");
            }

            resolvedCode = requestedCode;
        }

        var supplierName = (request.ProductSupplier ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(supplierName))
        {
            var suppliers = await fornecedoresAB.ListarAsync(companyId);
            if (!suppliers.Any(item =>
                    (!string.IsNullOrWhiteSpace(item.FantasyName) &&
                     item.FantasyName.Equals(supplierName, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrWhiteSpace(item.CompanyName) &&
                     item.CompanyName.Equals(supplierName, StringComparison.OrdinalIgnoreCase))))
            {
                throw new InvalidOperationException("Fornecedor informado não está cadastrado.");
            }
        }

        return resolvedCode;
    }

    internal static string GenerateInternalCode(ISet<string> existingCodes)
    {
        var maxNumber = 0;
        foreach (var code in existingCodes)
        {
            if (code.StartsWith("INT-", StringComparison.OrdinalIgnoreCase) &&
                int.TryParse(code[4..], NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) &&
                parsed > maxNumber)
            {
                maxNumber = parsed;
            }
        }

        var candidate = maxNumber + 1;
        while (existingCodes.Contains($"INT-{candidate:D4}"))
        {
            candidate += 1;
        }

        return $"INT-{candidate:D4}";
    }

    internal static ProdutoAD MapRequest(string id, ProdutoRequest request, string resolvedCode)
    {
        var quantity = string.IsNullOrWhiteSpace(request.ProductQnt)
            ? 0m
            : ParseDecimal(request.ProductQnt);
        var normalizedQnt = decimal.Round(Math.Max(0m, quantity), 3, MidpointRounding.AwayFromZero)
            .ToString("0.###", CultureInfo.InvariantCulture);

        var unitPrice = string.IsNullOrWhiteSpace(request.ProductUnitPrice)
            ? 0m
            : Math.Max(0m, ParseDecimal(request.ProductUnitPrice));
        var salePrice = Math.Max(0m, ParseDecimal(request.ProductSalePrice));
        var formattedUnitPrice = string.IsNullOrWhiteSpace(request.ProductUnitPrice)
            ? "0,00"
            : unitPrice.ToString("N2", PtBr);
        var formattedSalePrice = salePrice.ToString("N2", PtBr);
        var totalPrice = string.IsNullOrWhiteSpace(request.TotalPriceOnProduct)
            ? (quantity * unitPrice).ToString("N2", PtBr)
            : request.TotalPriceOnProduct.Trim();

        var expiration = ProdutoExpirationHelper.NormalizeAndResolve(
            request.ExpirationMode,
            request.ManufactureDate,
            request.ShelfLifeDays,
            request.ExpirationDate);

        return new ProdutoAD
        {
            Id = id,
            ProductImageUrl = (request.ProductImageUrl ?? string.Empty).Trim(),
            ProductImageName = (request.ProductImageName ?? string.Empty).Trim(),
            ProductName = request.ProductName.Trim(),
            ProductCode = resolvedCode,
            ProductSupplier = (request.ProductSupplier ?? string.Empty).Trim(),
            ProductCategory = (request.ProductCategory ?? string.Empty).Trim(),
            ProductDescription = (request.ProductDescription ?? string.Empty).Trim(),
            ProductQnt = normalizedQnt,
            ProductUnitPrice = formattedUnitPrice,
            ProductSalePrice = formattedSalePrice,
            TotalPriceOnProduct = totalPrice,
            UnitType = NormalizeUnitType(request.UnitType),
            ExpirationMode = expiration.ExpirationMode,
            ManufactureDate = expiration.ManufactureDate,
            ShelfLifeDays = expiration.ShelfLifeDays,
            ExpirationDate = expiration.ExpirationDate
        };
    }

    private static ProdutoModel ToModel(ProdutoAD source)
    {
        var evaluation = ProdutoExpirationHelper.Evaluate(source.ExpirationDate);
        return new ProdutoModel
        {
            Id = source.Id,
            ProductImageUrl = source.ProductImageUrl,
            ProductImageName = source.ProductImageName,
            ProductName = source.ProductName,
            ProductCode = source.ProductCode,
            ProductSupplier = source.ProductSupplier,
            ProductCategory = source.ProductCategory,
            ProductDescription = source.ProductDescription,
            ProductQnt = source.ProductQnt,
            ProductUnitPrice = source.ProductUnitPrice,
            ProductSalePrice = source.ProductSalePrice,
            TotalPriceOnProduct = source.TotalPriceOnProduct,
            UnitType = string.IsNullOrWhiteSpace(source.UnitType) ? "UN" : source.UnitType.Trim().ToUpperInvariant(),
            ExpirationMode = source.ExpirationMode,
            ManufactureDate = source.ManufactureDate,
            ShelfLifeDays = source.ShelfLifeDays,
            ExpirationDate = source.ExpirationDate,
            ExpirationStatus = evaluation.Status,
            DaysUntilExpiration = evaluation.DaysUntilExpiration
        };
    }

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
