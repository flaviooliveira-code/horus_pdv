/**
 * Arquivo: API/NETCORE.Tests/PermissaoPrecoProdutoTests.cs
 * Objetivo: garante que só administrador e gerente alteram preço de produto já cadastrado.
 * Entradas esperadas: regras puras de ProdutoService/HorusRoles e metadados de autorização dos controllers.
 */
using System.Reflection;
using HORUSPDV_API.Controllers.Produtos;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Services.Produtos;
using HORUSPDV_API.Services.Security;

namespace HORUSPDV_API.Tests;

public class PermissaoPrecoProdutoTests
{
    [Theory]
    [InlineData("administrador", true)]
    [InlineData("GERENTE", true)]
    [InlineData("atendente", false)]
    [InlineData("financeiro", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void CanManagePrices_RequiresAdminOrManager(string? role, bool expected)
        => Assert.Equal(expected, HorusRoles.CanManagePrices(role));

    [Fact]
    public void ChangesPrice_DetectsSaleOrCostChangeIgnoringFormatting()
    {
        var current = new ProdutoAD { ProductSalePrice = "18,50", ProductUnitPrice = "10,00" };

        Assert.False(ProdutoService.ChangesPrice(current, new ProdutoAD { ProductSalePrice = "18.50", ProductUnitPrice = "10" }));
        Assert.True(ProdutoService.ChangesPrice(current, new ProdutoAD { ProductSalePrice = "9,90", ProductUnitPrice = "10,00" }));
        Assert.True(ProdutoService.ChangesPrice(current, new ProdutoAD { ProductSalePrice = "18,50", ProductUnitPrice = "8,00" }));
    }

    [Fact]
    public void AplicarPrecoDeCusto_AndImport_RequireAdminOrManager()
    {
        var applyCost = typeof(ProdutoController).GetMethod(nameof(ProdutoController.AplicarPrecoDeCusto))!
            .GetCustomAttribute<HorusAuthorizeRolesAttribute>();
        Assert.NotNull(applyCost);
        Assert.Equal(new[] { "administrador", "gerente" }, applyCost!.Roles.OrderBy(role => role));

        var import = typeof(ProdutoImportacaoController).GetCustomAttribute<HorusAuthorizeRolesAttribute>();
        Assert.NotNull(import);
        Assert.Equal(new[] { "administrador", "gerente" }, import!.Roles.OrderBy(role => role));
    }
}
