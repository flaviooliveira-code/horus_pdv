using System.Text.Json.Nodes;
using HORUSPDV_API.Models.Produtos;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Fornecedores;
using HORUSPDV_API.Services.Produtos;
using Xunit;

namespace HORUSPDV_API.Tests;

public class CadastroFlexivelTests
{
    [Fact]
    public void FornecedorService_AllowsInformalSupplierWithOnlyFantasyName()
    {
        var request = new FornecedorRequest
        {
            FantasyName = "Zé das Frutas"
        };

        var exception = Record.Exception(() => FornecedorService.Validate(request));
        Assert.Null(exception);

        var mapped = FornecedorService.MapRequest("fr-1", request);
        Assert.Equal("Zé das Frutas", mapped.FantasyName);
        Assert.Equal(string.Empty, mapped.Cnpj);
        Assert.Equal(string.Empty, mapped.Cellphone);
    }

    [Fact]
    public void FornecedorService_UsesCompanyNameAsFantasyNameWhenFantasyNameMissing()
    {
        var request = new FornecedorRequest
        {
            CompanyName = "Distribuidora Central LTDA"
        };

        FornecedorService.Validate(request);
        var mapped = FornecedorService.MapRequest("fr-2", request);

        Assert.Equal("Distribuidora Central LTDA", mapped.CompanyName);
        Assert.Equal("Distribuidora Central LTDA", mapped.FantasyName);
    }

    [Fact]
    public void FornecedorService_RejectsInvalidCnpjOnlyWhenProvided()
    {
        var invalid = new FornecedorRequest
        {
            FantasyName = "Padaria Silva",
            Cnpj = "12345"
        };

        Assert.Throws<InvalidOperationException>(() => FornecedorService.Validate(invalid));
    }

    [Fact]
    public void ProdutoService_AllowsInformalProductWithoutPriceOrSupplier()
    {
        var request = new ProdutoRequest
        {
            ProductName = "Bolo Fatiado",
            ProductCategory = "Padaria"
        };

        var exception = Record.Exception(() => ProdutoService.Validate(request));
        Assert.Null(exception);

        var mapped = ProdutoService.MapRequest("pr-1", request, "INT-0001");
        Assert.Equal("INT-0001", mapped.ProductCode);
        Assert.Equal("Padaria", mapped.ProductCategory);
        Assert.Equal(string.Empty, mapped.ProductSupplier);
        Assert.Equal("0", mapped.ProductQnt);
        Assert.Equal("0,00", mapped.ProductUnitPrice);
        Assert.Equal("0,00", mapped.ProductSalePrice);
    }

    [Fact]
    public void ProdutoService_RejectsNegativeQuantityCostOrSalePrice()
    {
        Assert.Throws<InvalidOperationException>(() => ProdutoService.Validate(new ProdutoRequest
        {
            ProductName = "Café",
            ProductQnt = "-1",
            ProductSalePrice = "10,00"
        }));

        Assert.Throws<InvalidOperationException>(() => ProdutoService.Validate(new ProdutoRequest
        {
            ProductName = "Café",
            ProductUnitPrice = "-5,00",
            ProductSalePrice = "10,00"
        }));

        Assert.Throws<InvalidOperationException>(() => ProdutoService.Validate(new ProdutoRequest
        {
            ProductName = "Café",
            ProductSalePrice = "-2,00"
        }));
    }

    [Fact]
    public void HistoricoVendas_ResolveSaleLinePricing_SupportsCustomPriceAndRequiresPriceWhenUnset()
    {
        // Produto sem preço fixo + preço avulso informado no caixa (ex.: fatia de R$ 13,50)
        var sliced = HistoricoVendasAB.ResolveSaleLinePricing(0m, 1m, 13.50m, null, "Bolo Fatiado");
        Assert.Equal(13.50m, sliced.EffectiveUnitPrice);
        Assert.Equal(13.50m, sliced.FinalItemTotal);

        // 2 fatias de R$ 9,25 cada
        var twoSlices = HistoricoVendasAB.ResolveSaleLinePricing(0m, 2m, 9.25m, null, "Bolo Fatiado");
        Assert.Equal(9.25m, twoSlices.EffectiveUnitPrice);
        Assert.Equal(18.50m, twoSlices.FinalItemTotal);

        // Produto sem preço fixo e sem preço avulso deve ser rejeitado
        Assert.Throws<InvalidOperationException>(() =>
            HistoricoVendasAB.ResolveSaleLinePricing(0m, 1m, null, null, "Bolo Fatiado"));

        // Preço avulso inválido (<= 0 ou > 2 casas decimais)
        Assert.Throws<InvalidOperationException>(() =>
            HistoricoVendasAB.ResolveSaleLinePricing(10m, 1m, 0m, null, "Bolo"));
        Assert.Throws<InvalidOperationException>(() =>
            HistoricoVendasAB.ResolveSaleLinePricing(10m, 1m, 12.345m, null, "Bolo"));
    }

    [Fact]
    public void HistoricoVendas_ResolveSaleLinePricing_OnlySupervisorsOverrideFixedPrice()
    {
        // Operador não pode vender produto com preço cadastrado por outro valor
        var ex = Assert.Throws<InvalidOperationException>(() =>
            HistoricoVendasAB.ResolveSaleLinePricing(10m, 1m, 1.00m, null, "Bolo", canOverrideFixedPrice: false));
        Assert.Contains("administrador ou gerente", ex.Message);

        // Mesmo preço do cadastro é aceito para qualquer perfil
        var same = HistoricoVendasAB.ResolveSaleLinePricing(10m, 2m, 10m, null, "Bolo", canOverrideFixedPrice: false);
        Assert.Equal(20m, same.FinalItemTotal);

        // Administrador/gerente pode alterar
        var supervisor = HistoricoVendasAB.ResolveSaleLinePricing(10m, 1m, 8.50m, null, "Bolo", canOverrideFixedPrice: true);
        Assert.Equal(8.50m, supervisor.EffectiveUnitPrice);
    }

    [Theory]
    [InlineData("administrador", true)]
    [InlineData("Gerente", true)]
    [InlineData("operador", false)]
    [InlineData("financeiro", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void HistoricoVendas_CanOverrideFixedPrice_RequiresAdminOrManager(string? role, bool expected)
        => Assert.Equal(expected, HistoricoVendasAB.CanOverrideFixedPrice(role));

    [Fact]
    public void ProdutoService_GenerateInternalCode_IncrementsBeyondExistingCodes()
    {
        var existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "7891000100103",
            "INT-0001",
            "INT-0004"
        };

        Assert.Equal("INT-0005", ProdutoService.GenerateInternalCode(existing));
        Assert.Equal("INT-0001", ProdutoService.GenerateInternalCode(new HashSet<string>()));
    }

    [Fact]
    public void BarcodeCatalogLookupService_ParsesOpenFoodFactsPayloadInPortuguese()
    {
        var json = JsonNode.Parse("""
            {
              "status": 1,
              "product": {
                "product_name_pt": "Refrigerante Cola",
                "brands": "Marca Exemplo, Outro",
                "quantity": "2 L",
                "generic_name_pt": "Bebida gaseificada",
                "categories_hierarchy": ["en:beverages", "en:sodas"],
                "image_front_url": "https://images.openfoodfacts.org/example.jpg"
              }
            }
            """);

        var parsed = BarcodeCatalogLookupService.ParseOpenFactsJson("7894900011517", "Open Food Facts", json);

        Assert.NotNull(parsed);
        Assert.True(parsed!.Found);
        Assert.Equal("Refrigerante Cola Marca Exemplo 2 L", parsed.ProductName);
        Assert.Equal("Refrigerantes", parsed.ProductCategory);
        Assert.Equal("https://images.openfoodfacts.org/example.jpg", parsed.ProductImageUrl);
        Assert.Contains("Marca: Marca Exemplo", parsed.ProductDescription);
    }

    [Fact]
    public void BarcodeCatalogLookupService_MergesMissingImageFromSecondarySource()
    {
        var primary = new BarcodeLookupResponse
        {
            Barcode = "7891234567890",
            Found = true,
            Source = "Open Food Facts",
            ProductName = "Biscoito Recheado 130g",
            ProductCategory = "Biscoitos e Bolos",
            ProductImageUrl = ""
        };
        var secondary = new BarcodeLookupResponse
        {
            Barcode = "7891234567890",
            Found = true,
            Source = "UPCitemdb",
            ProductName = "Chocolate Cookie",
            ProductImageUrl = "https://cdn.example.com/cookie.png"
        };

        BarcodeCatalogLookupService.MergeInto(primary, secondary);

        Assert.Equal("Biscoito Recheado 130g", primary.ProductName);
        Assert.Equal("Biscoitos e Bolos", primary.ProductCategory);
        Assert.Equal("https://cdn.example.com/cookie.png", primary.ProductImageUrl);
        Assert.Contains("UPCitemdb", primary.Source);
    }
}
