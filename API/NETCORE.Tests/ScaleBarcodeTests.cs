using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Produtos;

namespace HORUSPDV_API.Tests;

public class ScaleBarcodeTests
{
    private static string BuildEan13(string twelveDigits)
    {
        Assert.Equal(12, twelveDigits.Length);
        var sum = 0;
        for (var i = 0; i < 12; i += 1)
        {
            var digit = twelveDigits[i] - '0';
            sum += (i % 2 == 0) ? digit : digit * 3;
        }

        var check = (10 - (sum % 10)) % 10;
        return twelveDigits + check.ToString();
    }

    private static ProdutoAD MakeProduct(string code, string salePrice, string unitType = "KG") => new()
    {
        Id = $"pr-{code}",
        ProductCode = code,
        ProductName = $"Produto {code}",
        ProductSalePrice = salePrice,
        ProductUnitPrice = "10,00",
        ProductQnt = "50",
        UnitType = unitType
    };

    [Fact]
    public void IsValidEan13CheckDigit_ValidAndInvalidCases()
    {
        var valid = BuildEan13("200123002450");
        Assert.True(ScaleBarcodeParser.IsValidEan13CheckDigit(valid));

        var tampered = valid[..12] + (((valid[12] - '0') + 1) % 10);
        Assert.False(ScaleBarcodeParser.IsValidEan13CheckDigit(tampered));
        Assert.False(ScaleBarcodeParser.IsValidEan13CheckDigit("200123"));
        Assert.False(ScaleBarcodeParser.IsValidEan13CheckDigit("200123002450A"));
        Assert.False(ScaleBarcodeParser.IsValidEan13CheckDigit(""));
    }

    [Fact]
    public void ParseBarcode_RejectsNonPrefix2OrInvalidFormat()
    {
        var parser = new ScaleBarcodeParser();
        var nonScale = BuildEan13("789123456789");

        Assert.Throws<InvalidOperationException>(() => parser.ParseBarcode(nonScale));
        Assert.Throws<InvalidOperationException>(() => parser.ParseBarcode("2001230024509")); // bad digit or length
        Assert.Throws<InvalidOperationException>(() => parser.ParseBarcode("200123"));
    }

    [Fact]
    public void DecodeForProducts_5DigitPriceMode_WithZeroTrimmedCode_CalculatesFractionalQuantity()
    {
        var parser = new ScaleBarcodeParser();
        // Layout 5x6: prefix '2', code '00123', value '002450' (R$ 24,50)
        var barcode = BuildEan13("200123002450");
        var products = new[] { MakeProduct("123", "49,00") };

        var decoded = parser.DecodeForProducts(barcode, products, "price");

        Assert.NotNull(decoded);
        Assert.Equal("5x6", decoded.Layout);
        Assert.Equal("123", decoded.ProductCode);
        Assert.Equal(24.50m, decoded.TotalValue);
        Assert.Equal(0.500m, decoded.Quantity);
        Assert.Equal(49.00m, decoded.UnitPrice);
    }

    [Fact]
    public void DecodeForProducts_4DigitLayout_MatchesExact4DigitCode()
    {
        var parser = new ScaleBarcodeParser();
        // Layout 4x6: '20' + '0456' + '001500' (R$ 15,00)
        var barcode = BuildEan13("200456001500");
        var products = new[] { MakeProduct("0456", "30,00") };

        var decoded = parser.DecodeForProducts(barcode, products, "price");

        Assert.NotNull(decoded);
        Assert.Equal("4x6", decoded.Layout);
        Assert.Equal("0456", decoded.ProductCode);
        Assert.Equal(15.00m, decoded.TotalValue);
        Assert.Equal(0.500m, decoded.Quantity);
    }

    [Fact]
    public void DecodeForProducts_6DigitLayout_Matches6DigitCode()
    {
        var parser = new ScaleBarcodeParser();
        // Layout 6x5: '2' + '123456' + '01250' (R$ 12,50)
        var barcode = BuildEan13("212345601250");
        var products = new[] { MakeProduct("123456", "25,00") };

        var decoded = parser.DecodeForProducts(barcode, products, "price");

        Assert.NotNull(decoded);
        Assert.Equal("6x5", decoded.Layout);
        Assert.Equal("123456", decoded.ProductCode);
        Assert.Equal(12.50m, decoded.TotalValue);
        Assert.Equal(0.500m, decoded.Quantity);
    }

    [Fact]
    public void DecodeForProducts_WeightMode_CalculatesTotalFromGrams()
    {
        var parser = new ScaleBarcodeParser();
        // Layout 5x6: '2' + '00042' + '000450' (0,450 kg)
        var barcode = BuildEan13("200042000450");
        var products = new[] { MakeProduct("00042", "40,00") };

        var decoded = parser.DecodeForProducts(barcode, products, "weight");

        Assert.NotNull(decoded);
        Assert.Equal("weight", decoded.Mode);
        Assert.Equal(0.450m, decoded.Quantity);
        Assert.Equal(18.00m, decoded.TotalValue);
    }

    [Fact]
    public void DecodeForProducts_RejectsInvalidModeAndZeroPrice()
    {
        var parser = new ScaleBarcodeParser();
        var barcode = BuildEan13("200123002450");

        Assert.Throws<InvalidOperationException>(() =>
            parser.DecodeForProducts(barcode, [MakeProduct("123", "49,00")], "volume"));

        Assert.Throws<InvalidOperationException>(() =>
            parser.DecodeForProducts(barcode, [MakeProduct("123", "0,00")], "price"));
    }

    [Fact]
    public void HistoricoVendas_CalculateTotal_HandlesDecimalAndInvariantPrices()
    {
        Assert.Equal("9,98", HistoricoVendasAB.CalculateTotal("39,90", 0.250m));
        Assert.Equal("5,25", HistoricoVendasAB.CalculateTotal("10.50", 0.500m));
        Assert.Equal("12,35", HistoricoVendasAB.CalculateTotal("R$ 1.234,50", 0.010m));
    }

    [Fact]
    public void ProdutoService_ParseDecimalAndUnitType_AreCommaAware()
    {
        Assert.True(ProdutoService.TryParseDecimal("10.50", out var invariant));
        Assert.Equal(10.50m, invariant);

        Assert.True(ProdutoService.TryParseDecimal("1.234,500", out var ptBr));
        Assert.Equal(1234.500m, ptBr);

        Assert.Equal("UN", ProdutoService.NormalizeUnitType(null));
        Assert.Equal("UN", ProdutoService.NormalizeUnitType("  "));
        Assert.Equal("KG", ProdutoService.NormalizeUnitType("kg"));
        Assert.Throws<InvalidOperationException>(() => ProdutoService.NormalizeUnitType("LT"));
    }

    [Fact]
    public void ResolveValidatedItemTotal_AcceptsLegitScaleRoundingAndBlocksCentShaving()
    {
        // R$ 39,90/kg, etiqueta R$ 10,00 -> 10.00 / 39.90 = 0.251 kg -> 0.251 * 39.90 = 10.01 (1 cent diff)
        var reconciled1 = HistoricoVendasAB.ResolveValidatedItemTotal(39.90m, 0.251m, 10.00m);
        Assert.Equal(10.00m, reconciled1);

        // High-price weighed item: R$ 129,90/kg, etiqueta R$ 10,03 -> 0.077 kg -> 0.077 * 129.90 = 10.00
        var reconciled2 = HistoricoVendasAB.ResolveValidatedItemTotal(129.90m, 0.077m, 10.03m);
        Assert.Equal(10.03m, reconciled2);

        // No override computes normal rounded total
        Assert.Equal(10.01m, HistoricoVendasAB.ResolveValidatedItemTotal(39.90m, 0.251m, null));

        // Cent-shaving attempt: R$ 10,00 unit * 1.000 qty with override 9.99 -> inverse rounding 0.999 != 1.000
        Assert.Throws<InvalidOperationException>(() =>
            HistoricoVendasAB.ResolveValidatedItemTotal(10.00m, 1.000m, 9.99m));

        // Arbitrary underpricing attempt
        Assert.Throws<InvalidOperationException>(() =>
            HistoricoVendasAB.ResolveValidatedItemTotal(39.90m, 0.251m, 9.95m));

        // Too many decimals on quantity or override
        Assert.Throws<InvalidOperationException>(() =>
            HistoricoVendasAB.ResolveValidatedItemTotal(10.00m, 0.1234m, null));
        Assert.Throws<InvalidOperationException>(() =>
            HistoricoVendasAB.ResolveValidatedItemTotal(10.00m, 1.000m, 10.005m));
    }
}
