/**
 * Arquivo: API/NETCORE.Tests/RelatorioPermissoesTests.cs
 * Objetivo: garante que relatórios contábeis e o saldo esperado de caixa aberto respeitam o perfil do usuário.
 */
using System.Text.Json;
using HORUSPDV_API.Repositories;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Security;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HORUSPDV_API.Tests;

public class RelatorioPermissoesTests
{
    [Theory]
    [InlineData("administrador", true)]
    [InlineData("Gerente", true)]
    [InlineData(" financeiro ", true)]
    [InlineData("atendente", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void HorusRoles_IdentificaPerfisDeSupervisao(string? role, bool esperado)
        => Assert.Equal(esperado, HorusRoles.IsSupervisor(role));

    [Theory]
    [InlineData("lucro-real", "atendente", false)]
    [InlineData("dre-simplificado", "atendente", false)]
    [InlineData("DRE-SIMPLIFICADO", "", false)]
    [InlineData("lucro-real", "financeiro", true)]
    [InlineData("dre-simplificado", "gerente", true)]
    [InlineData("vendas-periodo", "atendente", true)]
    [InlineData("desempenho-caixa", "atendente", true)]
    public void PodeGerar_RestringeRelatoriosContabeis(string reportId, string role, bool esperado)
        => Assert.Equal(esperado, RelatorioAB.PodeGerar(reportId, role));

    [Theory]
    [InlineData(true, "atendente", true)]
    [InlineData(true, "", true)]
    [InlineData(true, "gerente", false)]
    [InlineData(true, "financeiro", false)]
    [InlineData(false, "atendente", false)]
    public void DeveOcultarAuditoriaCaixa_SoParaCaixaAbertoESemSupervisao(bool aberta, string role, bool esperado)
        => Assert.Equal(esperado, RelatorioAB.DeveOcultarAuditoriaCaixa(aberta, role));

    [Theory]
    [InlineData("lucro-real")]
    [InlineData("dre-simplificado")]
    public async Task GerarAsync_BloqueiaAtendenteAntesDeConsultarOBanco(string reportId)
    {
        // Connection aponta para um servidor inexistente: se o bloqueio não vier antes, o teste falharia com SqlException.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:HorusPdv"] = "Server=127.0.0.1,1;Database=Nada;User Id=x;Password=x;Connect Timeout=1;TrustServerCertificate=True"
            })
            .Build();
        var relatorio = new RelatorioAB(new Connection(configuration));

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            relatorio.GerarAsync("empresa-principal", reportId, new Dictionary<string, JsonElement>(), "atendente"));
        Assert.Contains("administrador, gerente ou financeiro", ex.Message);
    }
}
