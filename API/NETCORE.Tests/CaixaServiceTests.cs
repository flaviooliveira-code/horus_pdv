/**
 * Arquivo: API/NETCORE.Tests/CaixaServiceTests.cs
 * Objetivo: testa regras de negócio de HorusCaixaService, fechamento cego, sangria/suprimento, quebra de caixa, balanço diário e parsing pt-BR.
 */
using System.Text.Json;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Caixa;
using HORUSPDV_API.Services.Security;
using Xunit;

namespace HORUSPDV_API.Tests;

public class CaixaServiceTests
{
    private const string CompanyId = "empresa-principal";

    private static AuthenticatedUser CreateUser(string role = "administrador", string id = "usr-001", string name = "Operador Teste")
        => new()
        {
            Id = id,
            CompanyId = CompanyId,
            SessionId = "sess-001",
            Name = name,
            Email = "teste@hpdv.com.br",
            Role = role
        };

    [Fact]
    public async Task ExpectedCashFormula_ComputesOpeningPlusCashSalesPlusSuprimentosMinusSangriasMinusCashReturns()
    {
        var repo = new InMemoryCaixaRepository();
        var service = new HorusCaixaService(repo);
        var manager = CreateUser("gerente");

        await service.AbrirAsync(new AbrirCaixaRequest { OpeningAmount = 100.00m }, manager);
        var statusAfterOpen = await service.GetStatusAsync(CompanyId, manager.Role);
        var sessionId = statusAfterOpen.CurrentSession!.Id;

        await service.RegistrarSuprimentoAsync(new CaixaMovimentacaoRequest { Amount = 50.00m, Description = "Reforço de troco" }, manager);
        await service.RegistrarSangriaAsync(new CaixaMovimentacaoRequest { Amount = 20.00m, Description = "Pagamento motoboy" }, manager);

        // Vendas vinculadas à sessão (apenas Dinheiro entra na gaveta física)
        repo.AddSale(CompanyId, sessionId, "Dinheiro", 150.00m, "15001");
        repo.AddSale(CompanyId, sessionId, "PIX", 80.00m, "15002");
        repo.AddSale(CompanyId, sessionId, "Cartão de Débito", 40.00m, "15003");
        repo.AddSale(CompanyId, sessionId, "Cartão de Crédito", 60.00m, "15004");

        // Devolução em dinheiro reduz a gaveta; devolução em PIX não reduz a gaveta física
        await repo.RegistrarMovimentacaoAsync(new CaixaMovimentacaoAD
        {
            Id = "mov-dev-cash",
            CompanyId = CompanyId,
            CaixaSessaoId = sessionId,
            Tipo = "DEVOLUCAO",
            FormaPagamento = "dinheiro",
            Valor = 10.00m,
            Descricao = "Devolução parcial",
            UsuarioId = manager.Id,
            UsuarioName = manager.Name,
            DataHora = DateTimeOffset.Now
        });
        await repo.RegistrarMovimentacaoAsync(new CaixaMovimentacaoAD
        {
            Id = "mov-dev-pix",
            CompanyId = CompanyId,
            CaixaSessaoId = sessionId,
            Tipo = "DEVOLUCAO",
            FormaPagamento = "pix",
            Valor = 15.00m,
            Descricao = "Estorno PIX",
            UsuarioId = manager.Id,
            UsuarioName = manager.Name,
            DataHora = DateTimeOffset.Now
        });

        // Esperado em gaveta: 100 + 150 + 50 - 20 - 10 = 270,00
        var summary = await service.FecharAsync(new FecharCaixaRequest
        {
            ClosingAmount = 270.00m,
            BlindClosing = true,
            Note = "Conferido"
        }, manager);

        Assert.Equal(270.00m, summary.ExpectedCashAmount);
        Assert.Equal(270.00m, summary.CountedCashAmount);
        Assert.Equal(0.00m, summary.CashDifference);
        Assert.Equal("EXATO", summary.DifferenceStatus);
        Assert.Equal(150.00m, summary.SalesCashTotal);
        Assert.Equal(80.00m, summary.SalesPixTotal);
        Assert.Equal(40.00m, summary.SalesDebitTotal);
        Assert.Equal(60.00m, summary.SalesCreditTotal);
        Assert.Equal(50.00m, summary.TotalSuprimentos);
        Assert.Equal(20.00m, summary.TotalSangrias);
        Assert.Equal(10.00m, summary.CashReturns);
        Assert.Equal(4, summary.SalesCount);
        Assert.Equal(330.00m, summary.TotalSalesAmount);
        Assert.Equal(82.50m, summary.TicketMedio);
    }

    [Fact]
    public async Task Sangria_ValidatesAmountDescriptionAndDrawerBalanceLimit()
    {
        var repo = new InMemoryCaixaRepository();
        var service = new HorusCaixaService(repo);
        var atendente = CreateUser("atendente");

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RegistrarSangriaAsync(new CaixaMovimentacaoRequest { Amount = 10m, Description = "Sem caixa" }, atendente));

        await service.AbrirAsync(new AbrirCaixaRequest { OpeningAmount = 100.00m }, atendente);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RegistrarSangriaAsync(new CaixaMovimentacaoRequest { Amount = 0m, Description = "Valor zero" }, atendente));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RegistrarSangriaAsync(new CaixaMovimentacaoRequest { Amount = -5m, Description = "Negativo" }, atendente));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RegistrarSangriaAsync(new CaixaMovimentacaoRequest { Amount = 10m, Description = "ab" }, atendente));

        // Limite atual em gaveta = 100,00 -> sangria de 100,01 deve falhar
        var limitEx = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RegistrarSangriaAsync(new CaixaMovimentacaoRequest { Amount = 100.01m, Description = "Acima do saldo" }, atendente));
        Assert.Contains("insuficiente", limitEx.Message, StringComparison.OrdinalIgnoreCase);

        var mov = await service.RegistrarSangriaAsync(new CaixaMovimentacaoRequest
        {
            Amount = 40.00m,
            Description = "Sangria de segurança"
        }, atendente);

        Assert.Equal("SANGRIA", mov.Tipo);
        Assert.Equal(40.00m, mov.Valor);
        Assert.Equal("Sangria de segurança", mov.Descricao);

        // Restam 60,00 em gaveta -> sangria de 70,00 deve falhar
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RegistrarSangriaAsync(new CaixaMovimentacaoRequest { Amount = 70.00m, Description = "Segunda sangria" }, atendente));
    }

    [Fact]
    public async Task Suprimento_ValidatesPositiveAmountAndIncreasesDrawerExpectedCash()
    {
        var repo = new InMemoryCaixaRepository();
        var service = new HorusCaixaService(repo);
        var manager = CreateUser("gerente");

        await service.AbrirAsync(new AbrirCaixaRequest { OpeningAmount = 50.00m }, manager);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RegistrarSuprimentoAsync(new CaixaMovimentacaoRequest { Amount = 0m, Description = "Zero" }, manager));

        var mov = await service.RegistrarSuprimentoAsync(new CaixaMovimentacaoRequest
        {
            Amount = 75.50m,
            Description = "   "
        }, manager);

        Assert.Equal("SUPRIMENTO", mov.Tipo);
        Assert.Equal(75.50m, mov.Valor);
        Assert.Equal("Suprimento de caixa", mov.Descricao);

        var status = await service.GetStatusAsync(CompanyId, "administrador");
        Assert.Equal(125.50m, status.CurrentSession!.ExpectedCashAmount);
        Assert.Equal(75.50m, status.CurrentSession.TotalSuprimentos);
    }

    [Theory]
    [InlineData("atendente")]
    [InlineData("Atendente")]
    public async Task BlindClosing_HidesExpectedCashAndOpenSummaryFromAttendantUntilClosed(string attendantRole)
    {
        var repo = new InMemoryCaixaRepository();
        var service = new HorusCaixaService(repo);
        var attendant = CreateUser(attendantRole, "usr-att", "Maria Atendente");
        var manager = CreateUser("gerente", "usr-mgr", "Carlos Gerente");

        await service.AbrirAsync(new AbrirCaixaRequest { OpeningAmount = 100.00m }, attendant);
        var managerStatus = await service.GetStatusAsync(CompanyId, manager.Role);
        var sessionId = managerStatus.CurrentSession!.Id;
        repo.AddSale(CompanyId, sessionId, "Dinheiro", 85.00m, "15010");
        await service.RegistrarSuprimentoAsync(new CaixaMovimentacaoRequest { Amount = 15.00m, Description = "Troco" }, attendant);

        // Atendente NÃO pode ver saldo esperado nem vendas enquanto aberto
        var attendantStatus = await service.GetStatusAsync(CompanyId, attendantRole);
        Assert.NotNull(attendantStatus.CurrentSession);
        Assert.Null(attendantStatus.CurrentSession!.ExpectedCashAmount);
        Assert.Null(attendantStatus.CurrentSession.SalesCashTotal);
        Assert.Null(attendantStatus.CurrentSession.SalesPixTotal);
        Assert.Null(attendantStatus.CurrentSession.SalesCount);
        Assert.DoesNotContain(attendantStatus.CurrentMovements, m => m.Tipo == "VENDA");

        // Atendente recebe UnauthorizedAccessException (403) ao tentar abrir Espelho Z de sessão aberta
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.GetSessionSummaryAsync(CompanyId, sessionId, attendantRole));

        // Gerente/Administrador/Financeiro visualizam saldo esperado ao vivo
        var adminStatus = await service.GetStatusAsync(CompanyId, "administrador");
        Assert.Equal(200.00m, adminStatus.CurrentSession!.ExpectedCashAmount);
        Assert.Equal(85.00m, adminStatus.CurrentSession.SalesCashTotal);

        var financeiroSummary = await service.GetSessionSummaryAsync(CompanyId, sessionId, "financeiro");
        Assert.Equal(200.00m, financeiroSummary.ExpectedCashAmount);
        Assert.Equal(1, financeiroSummary.SalesCount);

        // Após fechar, o resumo da sessão fechada e o histórico ficam visíveis
        var closedSummary = await service.FecharAsync(new FecharCaixaRequest { ClosingAmount = 200.00m, BlindClosing = true }, attendant);
        Assert.Equal(200.00m, closedSummary.ExpectedCashAmount);

        var postCloseSummaryForAttendant = await service.GetSessionSummaryAsync(CompanyId, sessionId, attendantRole);
        Assert.Equal(200.00m, postCloseSummaryForAttendant.ExpectedCashAmount);
        Assert.Equal(0.00m, postCloseSummaryForAttendant.CashDifference);

        var postCloseStatusForAttendant = await service.GetStatusAsync(CompanyId, attendantRole);
        Assert.Equal(200.00m, postCloseStatusForAttendant.LastSession!.ExpectedCashAmount);
    }

    [Theory]
    [InlineData(100.00, 90.00, -10.00, "QUEBRA")]
    [InlineData(100.00, 112.50, 12.50, "SOBRA")]
    [InlineData(100.00, 100.00, 0.00, "EXATO")]
    public async Task Discrepancy_ComputesQuebraSobraAndExatoCorrectly(
        decimal openingAndExpected,
        decimal counted,
        decimal expectedDiff,
        string expectedStatus)
    {
        var repo = new InMemoryCaixaRepository();
        var service = new HorusCaixaService(repo);
        var manager = CreateUser("administrador");

        await service.AbrirAsync(new AbrirCaixaRequest { OpeningAmount = openingAndExpected }, manager);
        var summary = await service.FecharAsync(new FecharCaixaRequest
        {
            ClosingAmount = counted,
            CountedPixAmount = 50.00m,
            CountedDebitAmount = 30.00m,
            CountedCreditAmount = 20.00m
        }, manager);

        Assert.Equal(openingAndExpected, summary.ExpectedCashAmount);
        Assert.Equal(counted, summary.CountedCashAmount);
        Assert.Equal(expectedDiff, summary.CashDifference);
        Assert.Equal(expectedStatus, summary.DifferenceStatus);
        Assert.Equal(50.00m, summary.CountedPixAmount);
        Assert.Equal(30.00m, summary.CountedDebitAmount);
        Assert.Equal(20.00m, summary.CountedCreditAmount);
        Assert.Equal(0m, summary.TicketMedio);
    }

    [Fact]
    public async Task PaymentBreakdownAndDailyBalance_AggregatesMultipleSessionsForTargetDate()
    {
        var repo = new InMemoryCaixaRepository();
        var service = new HorusCaixaService(repo);
        var manager = CreateUser("gerente");
        var targetDate = new DateOnly(2026, 11, 15);
        var otherDate = new DateTimeOffset(2026, 11, 14, 10, 0, 0, TimeSpan.Zero);

        // Sessão de ontem (não deve entrar no balanço de 2026-11-15)
        repo.SeedClosedSession(CompanyId, "cx-yesterday", otherDate, 50m, 50m, salesCash: 20m, salesCount: 1);

        // Turno manhã no dia alvo (fechado com quebra de -5,00)
        var morningStart = new DateTimeOffset(2026, 11, 15, 8, 0, 0, TimeSpan.Zero);
        repo.SeedClosedSession(
            CompanyId,
            "cx-morning",
            morningStart,
            opening: 100m,
            counted: 195m,
            salesCash: 100m,
            salesPix: 60m,
            salesDebit: 40m,
            salesCredit: 0m,
            suprimentos: 10m,
            sangrias: 10m,
            salesCount: 3);

        // Turno tarde no dia alvo (fechado com sobra de +5,00)
        var afternoonStart = new DateTimeOffset(2026, 11, 15, 14, 0, 0, TimeSpan.Zero);
        repo.SeedClosedSession(
            CompanyId,
            "cx-afternoon",
            afternoonStart,
            opening: 100m,
            counted: 155m,
            salesCash: 50m,
            salesPix: 40m,
            salesDebit: 0m,
            salesCredit: 110m,
            suprimentos: 0m,
            sangrias: 0m,
            salesCount: 2);

        // Também valida fallback de CaixaMovimentacoes VENDA quando Vendas está vazio
        await repo.RegistrarMovimentacaoAsync(new CaixaMovimentacaoAD
        {
            Id = "mov-extra-1",
            CompanyId = CompanyId,
            CaixaSessaoId = "cx-open-fallback",
            Tipo = "VENDA",
            FormaPagamento = "Cartão de Crédito",
            Valor = 50m,
            Descricao = "Venda #999",
            UsuarioId = manager.Id,
            UsuarioName = manager.Name,
            DataHora = afternoonStart
        });

        var balance = await service.GetDailyBalanceAsync(CompanyId, targetDate);

        Assert.Equal("2026-11-15", balance.Date);
        Assert.Equal(2, balance.SessionsCount);
        Assert.Equal(2, balance.ClosedSessionsCount);
        Assert.Equal(0, balance.OpenSessionsCount);
        Assert.Equal(200.00m, balance.TotalOpeningAmount);
        Assert.Equal(350.00m, balance.TotalExpectedCashAmount);
        Assert.Equal(350.00m, balance.TotalCountedCashAmount);
        Assert.Equal(0.00m, balance.TotalCashDifference);
        Assert.Equal(10.00m, balance.TotalSuprimentos);
        Assert.Equal(10.00m, balance.TotalSangrias);
        Assert.Equal(150.00m, balance.SalesCashTotal);
        Assert.Equal(100.00m, balance.SalesPixTotal);
        Assert.Equal(40.00m, balance.SalesDebitTotal);
        Assert.Equal(110.00m, balance.SalesCreditTotal);
        Assert.Equal(400.00m, balance.TotalSalesAmount);
        Assert.Equal(5, balance.SalesCount);
        Assert.Equal(80.00m, balance.TicketMedio);
    }

    [Fact]
    public void PtBrFlexibleDecimalConverter_ParsesPtBrInvariantAndNumericJson()
    {
        var req1 = JsonSerializer.Deserialize<FecharCaixaRequest>(
            """{"closingAmount":"1.250,50","countedPixAmount":"100,00","countedDebitAmount":"100.50","countedCreditAmount":75.25}""",
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(req1);
        Assert.Equal(1250.50m, req1!.ClosingAmount);
        Assert.Equal(100.00m, req1.CountedPixAmount);
        Assert.Equal(100.50m, req1.CountedDebitAmount);
        Assert.Equal(75.25m, req1.CountedCreditAmount);

        var req2 = JsonSerializer.Deserialize<AbrirCaixaRequest>(
            """{"openingAmount": 250}""",
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(req2);
        Assert.Equal(250m, req2!.OpeningAmount);

        var req3 = JsonSerializer.Deserialize<FecharCaixaRequest>(
            """{"closingAmount":"","countedPixAmount":""}""",
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(req3);
        Assert.Equal(0m, req3!.ClosingAmount);
        Assert.Null(req3.CountedPixAmount);

        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<AbrirCaixaRequest>(
                """{"openingAmount":"invalido"}""",
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }));
    }

    [Fact]
    public async Task EnsureVendaPermitidaAsync_BlocksWhenClosedOrExpired()
    {
        var repo = new InMemoryCaixaRepository();
        var service = new HorusCaixaService(repo);
        var manager = CreateUser("administrador");

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.EnsureVendaPermitidaAsync(CompanyId));

        await service.AbrirAsync(new AbrirCaixaRequest { OpeningAmount = 50m }, manager);
        await service.EnsureVendaPermitidaAsync(CompanyId);

        // Simula caixa aberto ontem -> deve bloquear vendas
        var session = await repo.ObterSessaoAbertaAsync(CompanyId);
        session!.OpenedAt = DateTimeOffset.Now.AddDays(-1);
        var expiredEx = await Assert.ThrowsAsync<InvalidOperationException>(() => service.EnsureVendaPermitidaAsync(CompanyId));
        Assert.Contains("outro dia", expiredEx.Message, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class InMemoryCaixaRepository : ICaixaRepository
    {
        private readonly List<(string CompanyId, CaixaSessionAD Session)> _sessions = [];
        private readonly List<CaixaMovimentacaoAD> _movements = [];
        private readonly List<(string CompanyId, string SessionId, string PaymentType, decimal Amount, string SaleNumber)> _sales = [];

        public void AddSale(string companyId, string sessionId, string paymentType, decimal amount, string saleNumber)
        {
            _sales.Add((companyId, sessionId, paymentType, amount, saleNumber));
            _movements.Add(new CaixaMovimentacaoAD
            {
                Id = $"mov-{Guid.NewGuid():N}"[..36],
                CompanyId = companyId,
                CaixaSessaoId = sessionId,
                Tipo = "VENDA",
                FormaPagamento = HorusCaixaService.NormalizePaymentMethod(paymentType),
                Valor = amount,
                Descricao = $"Venda #{saleNumber}",
                SaleNumber = saleNumber,
                UsuarioId = "usr-001",
                UsuarioName = "Operador Teste",
                DataHora = DateTimeOffset.Now
            });
        }

        public void SeedClosedSession(
            string companyId,
            string id,
            DateTimeOffset openedAt,
            decimal opening,
            decimal counted,
            decimal salesCash = 0m,
            decimal salesPix = 0m,
            decimal salesDebit = 0m,
            decimal salesCredit = 0m,
            decimal suprimentos = 0m,
            decimal sangrias = 0m,
            int salesCount = 0)
        {
            var expected = opening + salesCash + suprimentos - sangrias;
            _sessions.Add((companyId, new CaixaSessionAD
            {
                Id = id,
                OpenedAt = openedAt,
                ClosedAt = openedAt.AddHours(4),
                OpeningAmount = PtBrMoneyParser.FormatPtBr(opening),
                ClosingAmount = PtBrMoneyParser.FormatPtBr(counted),
                OperatorName = "Operador Seed",
                ClosedByName = "Operador Seed",
                ExpectedCashAmount = expected,
                CountedCashAmount = counted,
                CashDifference = counted - expected,
                SalesCashTotal = salesCash,
                SalesPixTotal = salesPix,
                SalesDebitTotal = salesDebit,
                SalesCreditTotal = salesCredit,
                TotalSuprimentos = suprimentos,
                TotalSangrias = sangrias,
                SalesCount = salesCount,
                BlindClosing = true
            }));
        }

        public Task<List<CaixaSessionAD>> ListarSessoesAsync(string companyId)
            => Task.FromResult(_sessions
                .Where(x => x.CompanyId == companyId)
                .Select(x => x.Session)
                .OrderByDescending(x => x.OpenedAt)
                .ToList());

        public Task<CaixaSessionAD?> ObterSessaoPorIdAsync(string companyId, string sessionId)
        {
            var found = _sessions
                .FirstOrDefault(x => x.CompanyId == companyId && x.Session.Id == sessionId)
                .Session;
            return Task.FromResult<CaixaSessionAD?>(found);
        }

        public Task<CaixaSessionAD?> ObterSessaoAbertaAsync(string companyId)
            => Task.FromResult(_sessions
                .Where(x => x.CompanyId == companyId && x.Session.ClosedAt is null)
                .Select(x => x.Session)
                .OrderByDescending(x => x.OpenedAt)
                .FirstOrDefault());

        public Task AbrirAsync(
            string id,
            string companyId,
            DateTimeOffset openedAt,
            string openingAmount,
            string operatorId,
            string operatorName,
            decimal openingAmountDecimal)
        {
            _sessions.Add((companyId, new CaixaSessionAD
            {
                Id = id,
                OpenedAt = openedAt,
                OpeningAmount = openingAmount,
                ClosingAmount = "0,00",
                OperatorName = operatorName,
                ExpectedCashAmount = openingAmountDecimal,
                BlindClosing = true
            }));

            _movements.Add(new CaixaMovimentacaoAD
            {
                Id = $"mov-{Guid.NewGuid():N}"[..36],
                CompanyId = companyId,
                CaixaSessaoId = id,
                Tipo = "ABERTURA",
                FormaPagamento = "dinheiro",
                Valor = openingAmountDecimal,
                Descricao = "Abertura de caixa",
                UsuarioId = operatorId,
                UsuarioName = operatorName,
                DataHora = openedAt
            });

            return Task.CompletedTask;
        }

        public Task RegistrarMovimentacaoAsync(CaixaMovimentacaoAD movimentacao)
        {
            _movements.Add(movimentacao);
            return Task.CompletedTask;
        }

        public Task<List<CaixaMovimentacaoAD>> ListarMovimentacoesPorSessaoAsync(string companyId, string caixaSessaoId)
            => Task.FromResult(_movements
                .Where(m => m.CompanyId == companyId && m.CaixaSessaoId == caixaSessaoId)
                .OrderBy(m => m.DataHora)
                .ToList());

        public Task<List<CaixaMovimentacaoAD>> ListarMovimentacoesPorSessoesAsync(string companyId, IReadOnlyCollection<string> sessionIds)
            => Task.FromResult(_movements
                .Where(m => m.CompanyId == companyId && sessionIds.Contains(m.CaixaSessaoId))
                .OrderBy(m => m.DataHora)
                .ToList());

        public Task<CaixaSalesSummaryAD> ObterResumoVendasPorSessaoAsync(string companyId, string caixaSessaoId)
        {
            var summary = new CaixaSalesSummaryAD();
            var matchingSales = _sales.Where(s => s.CompanyId == companyId && s.SessionId == caixaSessaoId).ToList();
            if (matchingSales.Count > 0)
            {
                foreach (var sale in matchingSales)
                {
                    Accumulate(summary, HorusCaixaService.NormalizePaymentMethod(sale.PaymentType), sale.Amount);
                }
            }
            else
            {
                foreach (var mov in _movements.Where(m => m.CompanyId == companyId && m.CaixaSessaoId == caixaSessaoId && m.Tipo == "VENDA"))
                {
                    Accumulate(summary, HorusCaixaService.NormalizePaymentMethod(mov.FormaPagamento), mov.Valor);
                }
            }

            return Task.FromResult(summary);
        }

        public Task FecharAsync(
            string id,
            string companyId,
            DateTimeOffset closedAt,
            string closingAmount,
            string closedById,
            string closedByName,
            string note,
            CaixaSessionAuditAD audit)
        {
            var session = _sessions.First(x => x.CompanyId == companyId && x.Session.Id == id).Session;
            session.ClosedAt = closedAt;
            session.ClosingAmount = closingAmount;
            session.ClosedByName = closedByName;
            session.Note = note;
            session.ExpectedCashAmount = audit.ExpectedCashAmount;
            session.CountedCashAmount = audit.CountedCashAmount;
            session.CashDifference = audit.CashDifference;
            session.SalesCashTotal = audit.SalesCashTotal;
            session.SalesPixTotal = audit.SalesPixTotal;
            session.SalesDebitTotal = audit.SalesDebitTotal;
            session.SalesCreditTotal = audit.SalesCreditTotal;
            session.TotalSuprimentos = audit.TotalSuprimentos;
            session.TotalSangrias = audit.TotalSangrias;
            session.SalesCount = audit.SalesCount;
            session.BlindClosing = audit.BlindClosing;
            return Task.CompletedTask;
        }

        private static void Accumulate(CaixaSalesSummaryAD summary, string method, decimal amount)
        {
            summary.SalesCount += 1;
            switch (method)
            {
                case "dinheiro": summary.SalesCashTotal += amount; break;
                case "pix": summary.SalesPixTotal += amount; break;
                case "debito": summary.SalesDebitTotal += amount; break;
                case "credito": summary.SalesCreditTotal += amount; break;
            }
        }
    }
}
