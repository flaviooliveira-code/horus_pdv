using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Caixa;
using HORUSPDV_API.Services.Security;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HORUSPDV_API.Tests;

public class CaixaServiceTests
{
    private sealed class FakeCaixaAB : CaixaAB
    {
        public List<CaixaSessionAD> Sessions { get; } = [];
        public List<CaixaMovimentacaoAD> Movements { get; } = [];
        public List<CaixaVendaResumoAD> Sales { get; } = [];

        public FakeCaixaAB()
            : base(new Connection(new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:HorusPdv"] = "Server=localhost;Database=HORUSPDV_TEST;Trusted_Connection=True;TrustServerCertificate=True;"
                })
                .Build()))
        {
        }

        public override Task<List<CaixaSessionAD>> ListarSessoesAsync(string companyId)
            => Task.FromResult(Sessions.OrderByDescending(s => s.OpenedAt).ToList());

        public override Task<CaixaSessionAD?> ObterSessaoAbertaAsync(string companyId)
            => Task.FromResult(Sessions.FirstOrDefault(s => s.ClosedAt is null));

        public override Task<CaixaSessionAD?> ObterSessaoPorIdAsync(string companyId, string sessionId)
            => Task.FromResult(Sessions.FirstOrDefault(s => s.Id == sessionId));

        public override Task AbrirAsync(
            string id,
            string companyId,
            DateTimeOffset openedAt,
            string openingAmount,
            string operatorId,
            string operatorName)
        {
            Sessions.Add(new CaixaSessionAD
            {
                Id = id,
                OpenedAt = openedAt,
                OpeningAmount = openingAmount,
                ExpectedAmount = openingAmount,
                OperatorName = operatorName
            });
            return Task.CompletedTask;
        }

        public override Task FecharAsync(
            string id,
            string companyId,
            DateTimeOffset closedAt,
            string closingAmount,
            string closedById,
            string closedByName,
            string note,
            string expectedAmount = "0,00",
            string differenceAmount = "0,00",
            string differenceStatus = "CONFERIDO",
            string totalCashSales = "0,00",
            string totalSupplies = "0,00",
            string totalWithdrawals = "0,00")
        {
            var session = Sessions.First(s => s.Id == id);
            session.ClosedAt = closedAt;
            session.ClosingAmount = closingAmount;
            session.ClosedByName = closedByName;
            session.Note = note;
            session.ExpectedAmount = expectedAmount;
            session.DifferenceAmount = differenceAmount;
            session.DifferenceStatus = differenceStatus;
            session.TotalCashSales = totalCashSales;
            session.TotalSupplies = totalSupplies;
            session.TotalWithdrawals = totalWithdrawals;
            return Task.CompletedTask;
        }

        public override Task RegistrarMovimentacaoAsync(CaixaMovimentacaoAD movement)
        {
            Movements.Insert(0, movement);
            return Task.CompletedTask;
        }

        public override Task<List<CaixaMovimentacaoAD>> ListarMovimentacoesAsync(string companyId, string? caixaSessaoId = null)
        {
            var filtered = string.IsNullOrWhiteSpace(caixaSessaoId)
                ? Movements
                : Movements.Where(m => m.CaixaSessaoId == caixaSessaoId).ToList();
            return Task.FromResult(filtered);
        }

        public override Task<List<CaixaVendaResumoAD>> ListarVendasSessaoAsync(
            string companyId,
            string sessionId,
            DateTimeOffset openedAt,
            DateTimeOffset? closedAt)
            => Task.FromResult(Sales.ToList());
    }

    private static AuthenticatedUser CreateUser() => new()
    {
        Id = "usr-001",
        CompanyId = "empresa-principal",
        Name = "Operador Teste",
        Email = "operador@hpdv.com.br",
        Role = "administrador"
    };

    [Fact]
    public void CalcularBalancoSessao_ComputesExpectedCashFromOpeningSalesSuppliesAndWithdrawals()
    {
        var session = new CaixaSessionAD
        {
            Id = "cx-1",
            OpenedAt = DateTimeOffset.Now.AddHours(-2),
            OpeningAmount = "150,00",
            OperatorName = "Operador Teste"
        };

        var sales = new List<CaixaVendaResumoAD>
        {
            new() { Id = "v1", SaleNumber = "101", PaymentType = "Dinheiro", TotalAmount = "80,50", SaleDate = DateTimeOffset.Now.AddHours(-1) },
            new() { Id = "v2", SaleNumber = "102", PaymentType = "PIX", TotalAmount = "120,00", SaleDate = DateTimeOffset.Now.AddMinutes(-50) },
            new() { Id = "v3", SaleNumber = "103", PaymentType = "Cartão de Débito", TotalAmount = "49,50", SaleDate = DateTimeOffset.Now.AddMinutes(-30) },
            new() { Id = "v4", SaleNumber = "104", PaymentType = "Cartão de Crédito", TotalAmount = "100,00", SaleDate = DateTimeOffset.Now.AddMinutes(-15) }
        };

        var movements = new List<CaixaMovimentacaoAD>
        {
            new() { Id = "m1", CaixaSessaoId = "cx-1", Tipo = "SUPRIMENTO", Valor = "50,00" },
            new() { Id = "m2", CaixaSessaoId = "cx-1", Tipo = "SANGRIA", Valor = "30,50" }
        };

        // Esperado em dinheiro = 150,00 + 80,50 + 50,00 - 30,50 = 250,00
        var balance = HorusCaixaService.CalcularBalancoSessao(session, sales, movements, null);

        Assert.Equal("150,00", balance.OpeningAmount);
        Assert.Equal("80,50", balance.TotalCashSales);
        Assert.Equal("120,00", balance.TotalPixSales);
        Assert.Equal("49,50", balance.TotalDebitSales);
        Assert.Equal("100,00", balance.TotalCreditSales);
        Assert.Equal("350,00", balance.TotalSalesAmount);
        Assert.Equal(4, balance.TotalSalesCount);
        Assert.Equal("87,50", balance.AverageTicket);
        Assert.Equal("50,00", balance.TotalSupplies);
        Assert.Equal("30,50", balance.TotalWithdrawals);
        Assert.Equal("250,00", balance.ExpectedCashAmount);
    }

    [Fact]
    public void CalcularBalancoSessao_BlindClosingExactMatch_ReturnsConferido()
    {
        var session = new CaixaSessionAD
        {
            Id = "cx-2",
            OpenedAt = DateTimeOffset.Now.AddHours(-3),
            OpeningAmount = "100,00"
        };
        var sales = new List<CaixaVendaResumoAD>
        {
            new() { PaymentType = "Dinheiro", TotalAmount = "60,00" }
        };

        var balance = HorusCaixaService.CalcularBalancoSessao(session, sales, [], "160,00");

        Assert.Equal("160,00", balance.ExpectedCashAmount);
        Assert.Equal("160,00", balance.CountedCashAmount);
        Assert.Equal("0,00", balance.DifferenceAmount);
        Assert.Equal("CONFERIDO", balance.DifferenceStatus);
    }

    [Fact]
    public void CalcularBalancoSessao_BlindClosingSurplus_ReturnsSobra()
    {
        var session = new CaixaSessionAD
        {
            Id = "cx-3",
            OpenedAt = DateTimeOffset.Now.AddHours(-3),
            OpeningAmount = "100,00"
        };
        var sales = new List<CaixaVendaResumoAD>
        {
            new() { PaymentType = "Dinheiro", TotalAmount = "50,00" }
        };

        var balance = HorusCaixaService.CalcularBalancoSessao(session, sales, [], "165,00");

        Assert.Equal("150,00", balance.ExpectedCashAmount);
        Assert.Equal("15,00", balance.DifferenceAmount);
        Assert.Equal("SOBRA", balance.DifferenceStatus);
    }

    [Fact]
    public void CalcularBalancoSessao_BlindClosingShortage_ReturnsQuebra()
    {
        var session = new CaixaSessionAD
        {
            Id = "cx-4",
            OpenedAt = DateTimeOffset.Now.AddHours(-3),
            OpeningAmount = "100,00"
        };
        var sales = new List<CaixaVendaResumoAD>
        {
            new() { PaymentType = "Dinheiro", TotalAmount = "50,00" }
        };

        var balance = HorusCaixaService.CalcularBalancoSessao(session, sales, [], "135,00");

        Assert.Equal("150,00", balance.ExpectedCashAmount);
        Assert.Equal("-15,00", balance.DifferenceAmount);
        Assert.Equal("QUEBRA", balance.DifferenceStatus);
    }

    [Fact]
    public void RegistrarSangria_WhenEnoughCashInDrawer_ReducesExpectedCashAndLogsMovement()
    {
        var repo = new FakeCaixaAB();
        var service = new HorusCaixaService(repo);
        var user = CreateUser();

        service.Abrir(new AbrirCaixaRequest { OpeningAmount = "200,00" }, user);
        var status = service.RegistrarSangria(new SangriaCaixaRequest { Amount = "75,00", Reason = "Depósito cofre" }, user);

        Assert.NotNull(status.CurrentBalance);
        Assert.Equal("75,00", status.CurrentBalance!.TotalWithdrawals);
        Assert.Equal("125,00", status.CurrentBalance.ExpectedCashAmount);
        Assert.Contains(status.Movements, m => m.Tipo == "SANGRIA" && m.Valor == "75,00" && m.Descricao == "Depósito cofre");
    }

    [Fact]
    public void RegistrarSangria_WhenAmountExceedsAvailableCash_ThrowsInvalidOperationException()
    {
        var repo = new FakeCaixaAB();
        var service = new HorusCaixaService(repo);
        var user = CreateUser();

        service.Abrir(new AbrirCaixaRequest { OpeningAmount = "100,00" }, user);

        var ex = Assert.Throws<InvalidOperationException>(() =>
            service.RegistrarSangria(new SangriaCaixaRequest { Amount = "150,00", Reason = "Retirada excessiva" }, user));

        Assert.Contains("insuficiente", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RegistrarSuprimento_WhenCashRegisterIsOpen_IncreasesExpectedCash()
    {
        var repo = new FakeCaixaAB();
        var service = new HorusCaixaService(repo);
        var user = CreateUser();

        service.Abrir(new AbrirCaixaRequest { OpeningAmount = "100,00" }, user);
        var status = service.RegistrarSuprimento(new SuprimentoCaixaRequest { Amount = "40,00", Reason = "Reforço de troco" }, user);

        Assert.NotNull(status.CurrentBalance);
        Assert.Equal("40,00", status.CurrentBalance!.TotalSupplies);
        Assert.Equal("140,00", status.CurrentBalance.ExpectedCashAmount);
    }

    [Fact]
    public void Fechar_PersistsExpectedCashAndDifferenceOnSession()
    {
        var repo = new FakeCaixaAB();
        var service = new HorusCaixaService(repo);
        var user = CreateUser();

        service.Abrir(new AbrirCaixaRequest { OpeningAmount = "100,00" }, user);
        repo.Sales.Add(new CaixaVendaResumoAD
        {
            Id = "v1",
            SaleNumber = "15040",
            PaymentType = "Dinheiro",
            TotalAmount = "90,00",
            SaleDate = DateTimeOffset.Now
        });

        var status = service.Fechar(new FecharCaixaRequest { ClosingAmount = "185,00", Note = "Conferência turno noite" }, user);

        Assert.Equal("fechado", status.State);
        Assert.NotNull(status.LastSession);
        Assert.Equal("190,00", status.LastSession!.ExpectedAmount);
        Assert.Equal("185,00", status.LastSession.ClosingAmount);
        Assert.Equal("-5,00", status.LastSession.DifferenceAmount);
        Assert.Equal("QUEBRA", status.LastSession.DifferenceStatus);
    }

    [Fact]
    public void GetStatus_WhenSessionOpenedMoreThan24HoursAgo_MarksAsExpiredAndBlocksSales()
    {
        var repo = new FakeCaixaAB();
        var now = DateTimeOffset.Now;
        repo.Sessions.Add(new CaixaSessionAD
        {
            Id = "cx-exp",
            OpenedAt = now.AddHours(-25),
            OpeningAmount = "100,00",
            OperatorName = "Operador"
        });
        var service = new HorusCaixaService(repo);

        var status = service.GetStatus("empresa-principal", now);

        Assert.False(status.CanSell);
        Assert.Equal("expirado", status.State);
    }

    [Theory]
    [InlineData("R$ 1.234,56", 1234.56)]
    [InlineData("150,00", 150.00)]
    [InlineData("89.90", 89.90)]
    public void ParseMoney_HandlesPtBrAndInvariantFormats(string input, decimal expected)
    {
        Assert.Equal(expected, HorusCaixaService.ParseMoney(input));
    }

    [Theory]
    [InlineData("pix", "PIX")]
    [InlineData("Cartão Débito", "Cartão de Débito")]
    [InlineData("Cartão Crédito", "Cartão de Crédito")]
    [InlineData("Dinheiro", "Dinheiro")]
    public void ClassifyPaymentMethod_MapsKnownMethodsConsistently(string raw, string expected)
    {
        Assert.Equal(expected, HorusCaixaService.ClassifyPaymentMethod(raw));
    }
}
