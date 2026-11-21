/**
 * Arquivo: API/NETCORE/Services/Produtos/ScaleBarcodeParser.cs
 * Objetivo: decodificar etiquetas EAN-13 de balança (prefixo 2) nos padrões de preço e peso.
 * Entradas esperadas: código EAN-13 com 13 dígitos numéricos, produtos cadastrados e modo (price|weight).
 */
using System.Globalization;
using HORUSPDV_API.Models.Produtos;
using HORUSPDV_API.Repositories.DataAccess;

namespace HORUSPDV_API.Services.Produtos;

public sealed record ScaleBarcodeLayoutCandidate(
    string Layout,
    string RawCode,
    string TrimmedCode,
    long RawMeasure);

public sealed record ScaleBarcodeParseResult(
    string Barcode,
    IReadOnlyList<ScaleBarcodeLayoutCandidate> Layouts,
    IReadOnlyList<string> AllCandidateCodes);

public sealed class ScaleBarcodeDecodeResponse
{
    public string Barcode { get; set; } = string.Empty;
    public string Mode { get; set; } = "price";
    public string Layout { get; set; } = string.Empty;
    public string MatchedCode { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string UnitType { get; set; } = "KG";
    public decimal UnitPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal TotalValue { get; set; }
    public ProdutoModel Product { get; set; } = new();
}

public class ScaleBarcodeParser
{
    public static bool IsValidEan13CheckDigit(string? barcode)
    {
        if (string.IsNullOrWhiteSpace(barcode))
        {
            return false;
        }

        var trimmed = barcode.Trim();
        if (trimmed.Length != 13)
        {
            return false;
        }

        var sum = 0;
        for (var i = 0; i < 12; i += 1)
        {
            var ch = trimmed[i];
            if (ch < '0' || ch > '9')
            {
                return false;
            }

            var digit = ch - '0';
            sum += (i % 2 == 0) ? digit : digit * 3;
        }

        var lastChar = trimmed[12];
        if (lastChar < '0' || lastChar > '9')
        {
            return false;
        }

        var expected = (10 - (sum % 10)) % 10;
        return expected == (lastChar - '0');
    }

    public static string NormalizeMode(string? mode)
    {
        if (string.IsNullOrWhiteSpace(mode))
        {
            return "price";
        }

        var normalized = mode.Trim().ToLowerInvariant();
        return normalized is "price" or "weight"
            ? normalized
            : throw new InvalidOperationException("Modo de decodificação inválido. Utilize 'price' ou 'weight'.");
    }

    public ScaleBarcodeParseResult ParseBarcode(string? barcode)
    {
        if (string.IsNullOrWhiteSpace(barcode))
        {
            throw new InvalidOperationException("Código de barras da balança é obrigatório.");
        }

        var trimmed = barcode.Trim();
        if (trimmed.Length != 13 || !trimmed.All(ch => ch >= '0' && ch <= '9'))
        {
            throw new InvalidOperationException("Código de balança deve conter exatamente 13 dígitos numéricos.");
        }

        if (trimmed[0] != '2')
        {
            throw new InvalidOperationException("Código de balança EAN-13 deve iniciar com o prefixo 2.");
        }

        if (!IsValidEan13CheckDigit(trimmed))
        {
            throw new InvalidOperationException("Dígito verificador EAN-13 inválido.");
        }

        var layouts = new List<ScaleBarcodeLayoutCandidate>();

        var code5 = trimmed.Substring(1, 5);
        var measure6 = long.Parse(trimmed.Substring(6, 6), CultureInfo.InvariantCulture);
        layouts.Add(new ScaleBarcodeLayoutCandidate("5x6", code5, TrimLeadingZeros(code5), measure6));

        if (trimmed[1] == '0')
        {
            var code4 = trimmed.Substring(2, 4);
            layouts.Add(new ScaleBarcodeLayoutCandidate("4x6", code4, TrimLeadingZeros(code4), measure6));
        }

        var code6 = trimmed.Substring(1, 6);
        var measure5 = long.Parse(trimmed.Substring(7, 5), CultureInfo.InvariantCulture);
        layouts.Add(new ScaleBarcodeLayoutCandidate("6x5", code6, TrimLeadingZeros(code6), measure5));

        var candidates = layouts
            .SelectMany(layout => new[] { layout.RawCode, layout.TrimmedCode })
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new ScaleBarcodeParseResult(trimmed, layouts, candidates);
    }

    public ScaleBarcodeDecodeResponse? DecodeForProducts(
        string? barcode,
        IEnumerable<ProdutoAD> products,
        string? mode = "price")
    {
        var normalizedMode = NormalizeMode(mode);
        var parsed = ParseBarcode(barcode);
        var productList = products.ToList();

        foreach (var layout in parsed.Layouts)
        {
            var matched =
                productList.FirstOrDefault(p => p.ProductCode.Trim().Equals(layout.RawCode, StringComparison.OrdinalIgnoreCase)) ??
                productList.FirstOrDefault(p => p.ProductCode.Trim().Equals(layout.TrimmedCode, StringComparison.OrdinalIgnoreCase));

            if (matched is null)
            {
                continue;
            }

            var salePrice = ParseDecimal(matched.ProductSalePrice);
            if (salePrice <= 0)
            {
                throw new InvalidOperationException("Produto sem preço de venda válido para cálculo da etiqueta de balança.");
            }

            decimal quantity;
            decimal totalValue;
            if (normalizedMode == "price")
            {
                totalValue = Math.Round(layout.RawMeasure / 100m, 2, MidpointRounding.AwayFromZero);
                quantity = Math.Round(totalValue / salePrice, 3, MidpointRounding.AwayFromZero);
            }
            else
            {
                quantity = Math.Round(layout.RawMeasure / 1000m, 3, MidpointRounding.AwayFromZero);
                totalValue = Math.Round(quantity * salePrice, 2, MidpointRounding.AwayFromZero);
            }

            if (quantity <= 0 || totalValue <= 0)
            {
                throw new InvalidOperationException("Valor ou peso da etiqueta de balança deve ser maior que zero.");
            }

            return new ScaleBarcodeDecodeResponse
            {
                Barcode = parsed.Barcode,
                Mode = normalizedMode,
                Layout = layout.Layout,
                MatchedCode = matched.ProductCode.Trim(),
                ProductId = matched.Id,
                ProductCode = matched.ProductCode,
                ProductName = matched.ProductName,
                UnitType = string.IsNullOrWhiteSpace(matched.UnitType) ? "UN" : matched.UnitType.Trim().ToUpperInvariant(),
                UnitPrice = salePrice,
                Quantity = quantity,
                TotalValue = totalValue,
                Product = new ProdutoModel
                {
                    Id = matched.Id,
                    ProductImageUrl = matched.ProductImageUrl,
                    ProductImageName = matched.ProductImageName,
                    ProductName = matched.ProductName,
                    ProductCode = matched.ProductCode,
                    ProductSupplier = matched.ProductSupplier,
                    ProductDescription = matched.ProductDescription,
                    ProductQnt = matched.ProductQnt,
                    ProductUnitPrice = matched.ProductUnitPrice,
                    ProductSalePrice = matched.ProductSalePrice,
                    TotalPriceOnProduct = matched.TotalPriceOnProduct,
                    UnitType = string.IsNullOrWhiteSpace(matched.UnitType) ? "UN" : matched.UnitType.Trim().ToUpperInvariant()
                }
            };
        }

        return null;
    }

    public static decimal ParseDecimal(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return 0m;
        }

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

    private static string TrimLeadingZeros(string code)
    {
        var trimmed = code.TrimStart('0');
        return trimmed.Length == 0 ? "0" : trimmed;
    }
}
