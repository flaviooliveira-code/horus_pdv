/**
 * Arquivo: API/NETCORE/Services/Caixa/HorusCaixaService.cs
 * Objetivo: centraliza regras de negócio assíncronas de abertura, sangria, suprimento, fechamento cego, espelho Z e balanço diário.
 * Entradas esperadas: recebe requisições validadas pelos controladores e aplica consistência operacional do domínio.
 */
using System.Globalization;
using System.Text;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Security;

namespace HORUSPDV_API.Services.Caixa;

public class HorusCaixaService(ICaixaRepository caixaRepository)
{
    private static readonly TimeSpan MaxOpenPeriod = TimeSpan.FromHours(24);

    public async Task<CaixaStatusDto> GetStatusAsync(
        string companyId,
        string userRole = "",
        DateTimeOffset? reference = null)
        => await BuildStatusAsync(companyId, userRole, reference ?? DateTimeOffset.Now);

    public async Task<CaixaStatusDto> AbrirAsync(AbrirCaixaRequest request, AuthenticatedUser currentUser)
    {
        if (request.OpeningAmount < 0m)
        {
            throw new InvalidOperationException("Valor inicial do caixa não pode ser negativo.");
        }

        var now = DateTimeOffset.Now;
        var openSession = await caixaRepository.ObterSessaoAbertaAsync(currentUser.CompanyId);
        if (openSession is not null)
        {
            var status = await BuildStatusAsync(currentUser.CompanyId, currentUser.Role, now);
            if (status.CanSell)
            {
                throw new InvalidOperationException("Já existe um caixa aberto para venda.");
            }

            throw new InvalidOperationException(
                "Existe um caixa aberto fora do período permitido. Feche o caixa atual antes de abrir um novo.");
        }

        var openingDecimal = Math.Round(request.OpeningAmount, 2, MidpointRounding.AwayFromZero);
        var sessionId = $"cx-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid().ToString("N")[..6]}";
        await caixaRepository.AbrirAsync(
            sessionId,
            currentUser.CompanyId,
            now,
            PtBrMoneyParser.FormatPtBr(openingDecimal),
            currentUser.Id,
            currentUser.Name,
            openingDecimal);

        return await BuildStatusAsync(currentUser.CompanyId, currentUser.Role, now);
    }

    public async Task<CaixaMovimentacaoDto> RegistrarSangriaAsync(
        CaixaMovimentacaoRequest request,
        AuthenticatedUser currentUser)
    {
        var now = DateTimeOffset.Now;
        var openSession = await RequireActiveValidOpenSessionAsync(
            currentUser.CompanyId,
            now,
            "Não existe caixa aberto para registrar sangria.");

        if (request.Amount <= 0m)
        {
            throw new InvalidOperationException("O valor da sangria deve ser maior que zero.");
        }

        var description = (request.Description ?? string.Empty).Trim();
        if (description.Length < 3)
        {
            throw new InvalidOperationException("Informe uma descrição com pelo menos 3 caracteres para a sangria.");
        }

        var amount = Math.Round(request.Amount, 2, MidpointRounding.AwayFromZero);
        var movements = await caixaRepository.ListarMovimentacoesPorSessaoAsync(currentUser.CompanyId, openSession.Id);
        var salesSummary = await caixaRepository.ObterResumoVendasPorSessaoAsync(currentUser.CompanyId, openSession.Id);
        var metrics = ComputeLiveMetrics(openSession, movements, salesSummary);

        if (amount > metrics.ExpectedCashAmount)
        {
            throw new InvalidOperationException(
                $"Saldo em dinheiro insuficiente para sangria. Disponível na gaveta: R$ {PtBrMoneyParser.FormatPtBr(metrics.ExpectedCashAmount)}.");
        }

        var movement = new CaixaMovimentacaoAD
        {
            Id = $"mov-{Guid.NewGuid():N}"[..36],
            CompanyId = currentUser.CompanyId,
            CaixaSessaoId = openSession.Id,
            Tipo = "SANGRIA",
            FormaPagamento = "dinheiro",
            Valor = amount,
            Descricao = description,
            SaleNumber = null,
            UsuarioId = currentUser.Id,
            UsuarioName = currentUser.Name,
            DataHora = now
        };

        await caixaRepository.RegistrarMovimentacaoAsync(movement);
        return ToMovementDto(movement);
    }

    public async Task<CaixaMovimentacaoDto> RegistrarSuprimentoAsync(
        CaixaMovimentacaoRequest request,
        AuthenticatedUser currentUser)
    {
        var now = DateTimeOffset.Now;
        var openSession = await RequireActiveValidOpenSessionAsync(
            currentUser.CompanyId,
            now,
            "Não existe caixa aberto para registrar suprimento.");

        if (request.Amount <= 0m)
        {
            throw new InvalidOperationException("O valor do suprimento deve ser maior que zero.");
        }

        var description = string.IsNullOrWhiteSpace(request.Description)
            ? "Suprimento de caixa"
            : request.Description.Trim();
        var amount = Math.Round(request.Amount, 2, MidpointRounding.AwayFromZero);

        var movement = new CaixaMovimentacaoAD
        {
            Id = $"mov-{Guid.NewGuid():N}"[..36],
            CompanyId = currentUser.CompanyId,
            CaixaSessaoId = openSession.Id,
            Tipo = "SUPRIMENTO",
            FormaPagamento = "dinheiro",
            Valor = amount,
            Descricao = description,
            SaleNumber = null,
            UsuarioId = currentUser.Id,
            UsuarioName = currentUser.Name,
            DataHora = now
        };

        await caixaRepository.RegistrarMovimentacaoAsync(movement);
        return ToMovementDto(movement);
    }

    public async Task<CaixaSessionSummaryDto> FecharAsync(
        FecharCaixaRequest request,
        AuthenticatedUser currentUser)
    {
        if (request.ClosingAmount < 0m)
        {
            throw new InvalidOperationException("Valor de fechamento não pode ser negativo.");
        }

        if (request.CountedPixAmount < 0m || request.CountedDebitAmount < 0m || request.CountedCreditAmount < 0m)
        {
            throw new InvalidOperationException("Valores conferidos por forma de pagamento não podem ser negativos.");
        }

        var now = DateTimeOffset.Now;
        var openSession = await caixaRepository.ObterSessaoAbertaAsync(currentUser.CompanyId);
        if (openSession is null)
        {
            throw new InvalidOperationException("Não existe caixa aberto para fechamento.");
        }

        var movements = await caixaRepository.ListarMovimentacoesPorSessaoAsync(currentUser.CompanyId, openSession.Id);
        var salesSummary = await caixaRepository.ObterResumoVendasPorSessaoAsync(currentUser.CompanyId, openSession.Id);
        var metrics = ComputeLiveMetrics(openSession, movements, salesSummary);

        var countedCash = Math.Round(request.ClosingAmount, 2, MidpointRounding.AwayFromZero);
        var cashDifference = Math.Round(countedCash - metrics.ExpectedCashAmount, 2, MidpointRounding.AwayFromZero);
        var note = (request.Note ?? string.Empty).Trim();
        var closingFormatted = PtBrMoneyParser.FormatPtBr(countedCash);

        var audit = new CaixaSessionAuditAD
        {
            ExpectedCashAmount = metrics.ExpectedCashAmount,
            CountedCashAmount = countedCash,
            CashDifference = cashDifference,
            SalesCashTotal = metrics.SalesCashTotal,
            SalesPixTotal = metrics.SalesPixTotal,
            SalesDebitTotal = metrics.SalesDebitTotal,
            SalesCreditTotal = metrics.SalesCreditTotal,
            TotalSuprimentos = metrics.TotalSuprimentos,
            TotalSangrias = metrics.TotalSangrias,
            SalesCount = metrics.SalesCount,
            BlindClosing = request.BlindClosing
        };

        await caixaRepository.FecharAsync(
            openSession.Id,
            currentUser.CompanyId,
            now,
            closingFormatted,
            currentUser.Id,
            currentUser.Name,
            note,
            audit);

        openSession.ClosedAt = now;
        openSession.ClosingAmount = closingFormatted;
        openSession.ClosedByName = currentUser.Name;
        openSession.Note = note;
        openSession.ExpectedCashAmount = audit.ExpectedCashAmount;
        openSession.CountedCashAmount = audit.CountedCashAmount;
        openSession.CashDifference = audit.CashDifference;
        openSession.SalesCashTotal = audit.SalesCashTotal;
        openSession.SalesPixTotal = audit.SalesPixTotal;
        openSession.SalesDebitTotal = audit.SalesDebitTotal;
        openSession.SalesCreditTotal = audit.SalesCreditTotal;
        openSession.TotalSuprimentos = audit.TotalSuprimentos;
        openSession.TotalSangrias = audit.TotalSangrias;
        openSession.SalesCount = audit.SalesCount;
        openSession.BlindClosing = audit.BlindClosing;

        return BuildSessionSummaryDto(
            openSession,
            movements,
            metrics.CashReturns,
            now,
            request.CountedPixAmount,
            request.CountedDebitAmount,
            request.CountedCreditAmount);
    }

    public async Task EnsureVendaPermitidaAsync(string companyId)
    {
        var status = await BuildStatusAsync(companyId, "administrador", DateTimeOffset.Now);
        if (status.CanSell)
        {
            return;
        }

        throw new InvalidOperationException(status.BlockReason);
    }

    public async Task<CaixaSessionSummaryDto> GetSessionSummaryAsync(
        string companyId,
        string sessionId,
        string userRole)
    {
        var session = await caixaRepository.ObterSessaoPorIdAsync(companyId, sessionId);
        if (session is null)
        {
            throw new InvalidOperationException("Sessão de caixa não encontrada.");
        }

        if (session.ClosedAt is null && !IsSupervisor(userRole))
        {
            throw new UnauthorizedAccessException(
                "Fechamento cego ativo: o resumo detalhado da sessão aberta é restrito a supervisores.");
        }

        var now = DateTimeOffset.Now;
        var movements = await caixaRepository.ListarMovimentacoesPorSessaoAsync(companyId, session.Id);

        if (session.ClosedAt is null)
        {
            var salesSummary = await caixaRepository.ObterResumoVendasPorSessaoAsync(companyId, session.Id);
            var metrics = ComputeLiveMetrics(session, movements, salesSummary);
            ApplyLiveMetrics(session, metrics);
            return BuildSessionSummaryDto(session, movements, metrics.CashReturns, now);
        }

        var cashReturns = ComputeCashReturns(movements);
        return BuildSessionSummaryDto(session, movements, cashReturns, now);
    }

    public async Task<DailyBalanceDto> GetDailyBalanceAsync(string companyId, DateOnly date)
    {
        var now = DateTimeOffset.Now;
        var allSessions = await caixaRepository.ListarSessoesAsync(companyId);
        var targetDate = date.ToDateTime(TimeOnly.MinValue).Date;
        var daySessions = allSessions
            .Where(session => session.OpenedAt.Date == targetDate)
            .OrderBy(session => session.OpenedAt)
            .ToList();

        var sessionIds = daySessions.Select(session => session.Id).ToList();
        var allMovements = await caixaRepository.ListarMovimentacoesPorSessoesAsync(companyId, sessionIds);
        var movementsBySession = allMovements
            .GroupBy(mov => mov.CaixaSessaoId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var summaries = new List<CaixaSessionSummaryDto>();
        foreach (var session in daySessions)
        {
            var movements = movementsBySession.TryGetValue(session.Id, out var list) ? list : [];
            decimal cashReturns;
            if (session.ClosedAt is null)
            {
                var salesSummary = await caixaRepository.ObterResumoVendasPorSessaoAsync(companyId, session.Id);
                var metrics = ComputeLiveMetrics(session, movements, salesSummary);
                ApplyLiveMetrics(session, metrics);
                cashReturns = metrics.CashReturns;
            }
            else
            {
                cashReturns = ComputeCashReturns(movements);
            }

            summaries.Add(BuildSessionSummaryDto(session, movements, cashReturns, now));
        }

        var totalSalesAmount = Math.Round(summaries.Sum(item => item.TotalSalesAmount), 2, MidpointRounding.AwayFromZero);
        var salesCount = summaries.Sum(item => item.SalesCount);

        return new DailyBalanceDto
        {
            Date = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            SessionsCount = summaries.Count,
            OpenSessionsCount = summaries.Count(item => item.ClosedAt is null),
            ClosedSessionsCount = summaries.Count(item => item.ClosedAt is not null),
            TotalOpeningAmount = Math.Round(summaries.Sum(item => item.OpeningAmountDecimal), 2, MidpointRounding.AwayFromZero),
            TotalExpectedCashAmount = Math.Round(summaries.Sum(item => item.ExpectedCashAmount), 2, MidpointRounding.AwayFromZero),
            TotalCountedCashAmount = Math.Round(summaries.Sum(item => item.CountedCashAmount), 2, MidpointRounding.AwayFromZero),
            TotalCashDifference = Math.Round(summaries.Sum(item => item.CashDifference), 2, MidpointRounding.AwayFromZero),
            TotalSuprimentos = Math.Round(summaries.Sum(item => item.TotalSuprimentos), 2, MidpointRounding.AwayFromZero),
            TotalSangrias = Math.Round(summaries.Sum(item => item.TotalSangrias), 2, MidpointRounding.AwayFromZero),
            TotalCashReturns = Math.Round(summaries.Sum(item => item.CashReturns), 2, MidpointRounding.AwayFromZero),
            SalesCashTotal = Math.Round(summaries.Sum(item => item.SalesCashTotal), 2, MidpointRounding.AwayFromZero),
            SalesPixTotal = Math.Round(summaries.Sum(item => item.SalesPixTotal), 2, MidpointRounding.AwayFromZero),
            SalesDebitTotal = Math.Round(summaries.Sum(item => item.SalesDebitTotal), 2, MidpointRounding.AwayFromZero),
            SalesCreditTotal = Math.Round(summaries.Sum(item => item.SalesCreditTotal), 2, MidpointRounding.AwayFromZero),
            TotalSalesAmount = totalSalesAmount,
            SalesCount = salesCount,
            TicketMedio = salesCount > 0
                ? Math.Round(totalSalesAmount / salesCount, 2, MidpointRounding.AwayFromZero)
                : 0m,
            Sessions = summaries
        };
    }

    public static string NormalizePaymentMethod(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "outros";
        }

        var normalized = value
            .Normalize(NormalizationForm.FormD)
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            .Aggregate(string.Empty, (current, ch) => current + ch)
            .ToLowerInvariant()
            .Trim();

        if (normalized.Contains("pix")) return "pix";
        if (normalized.Contains("debito") || normalized.Contains("debit")) return "debito";
        if (normalized.Contains("credito") || normalized.Contains("credit")) return "credito";
        if (normalized.Contains("dinheiro") || normalized.Contains("cash")) return "dinheiro";
        return "outros";
    }

    private async Task<CaixaStatusDto> BuildStatusAsync(string companyId, string userRole, DateTimeOffset now)
    {
        var sessions = await caixaRepository.ListarSessoesAsync(companyId);
        var openSession = sessions.FirstOrDefault(item => item.ClosedAt is null);
        var lastSession = openSession ?? sessions.FirstOrDefault();
        var canSell = false;
        var blockReason = "Abra o caixa do dia antes de iniciar vendas.";
        var state = "fechado";
        var supervisor = IsSupervisor(userRole);
        List<CaixaMovimentacaoDto> currentMovements = [];

        if (openSession is not null)
        {
            var (valid, reason) = EvaluateOpenSession(openSession, now);
            if (valid)
            {
                canSell = true;
                blockReason = "";
                state = "aberto";
            }
            else
            {
                state = "expirado";
                blockReason = reason;
            }

            var movements = await caixaRepository.ListarMovimentacoesPorSessaoAsync(companyId, openSession.Id);
            if (supervisor)
            {
                var salesSummary = await caixaRepository.ObterResumoVendasPorSessaoAsync(companyId, openSession.Id);
                var metrics = ComputeLiveMetrics(openSession, movements, salesSummary);
                ApplyLiveMetrics(openSession, metrics);
                currentMovements = movements.Select(ToMovementDto).ToList();
            }
            else
            {
                // Fechamento cego: oculta vendas e saldo esperado do atendente enquanto a sessão estiver aberta.
                currentMovements = movements
                    .Where(mov => !string.Equals(mov.Tipo, "VENDA", StringComparison.OrdinalIgnoreCase)
                                  && !string.Equals(mov.Tipo, "DEVOLUCAO", StringComparison.OrdinalIgnoreCase))
                    .Select(ToMovementDto)
                    .ToList();
            }
        }

        return new CaixaStatusDto
        {
            State = state,
            CanSell = canSell,
            BlockReason = blockReason,
            ServerNow = now.ToString("o"),
            CurrentSession = openSession is null ? null : ToSessionDto(openSession, now, supervisor),
            LastSession = lastSession is null ? null : ToSessionDto(lastSession, now, supervisor),
            History = sessions.Take(12).Select(item => ToSessionDto(item, now, supervisor)).ToList(),
            CurrentMovements = currentMovements
        };
    }

    private async Task<CaixaSessionAD> RequireActiveValidOpenSessionAsync(
        string companyId,
        DateTimeOffset now,
        string missingMessage)
    {
        var openSession = await caixaRepository.ObterSessaoAbertaAsync(companyId);
        if (openSession is null)
        {
            throw new InvalidOperationException(missingMessage);
        }

        var (valid, reason) = EvaluateOpenSession(openSession, now);
        if (!valid)
        {
            throw new InvalidOperationException(reason);
        }

        return openSession;
    }

    private static (bool Valid, string Reason) EvaluateOpenSession(CaixaSessionAD openSession, DateTimeOffset now)
    {
        var openedToday = openSession.OpenedAt.Date == now.Date;
        var withinPeriod = now - openSession.OpenedAt <= MaxOpenPeriod;

        if (openedToday && withinPeriod)
        {
            return (true, string.Empty);
        }

        return (false, !openedToday
            ? "O caixa aberto pertence a outro dia. Feche o caixa atual e abra o caixa do dia."
            : "O caixa aberto ultrapassou 24 horas. Feche o caixa atual e abra um novo.");
    }

    private static bool IsSupervisor(string? userRole) => HorusRoles.IsSupervisor(userRole);

    private static decimal ComputeCashReturns(IEnumerable<CaixaMovimentacaoAD> movements)
        => Math.Round(
            movements
                .Where(m => string.Equals(m.Tipo, "DEVOLUCAO", StringComparison.OrdinalIgnoreCase)
                            && NormalizePaymentMethod(m.FormaPagamento) == "dinheiro")
                .Sum(m => m.Valor),
            2,
            MidpointRounding.AwayFromZero);

    private static LiveSessionMetrics ComputeLiveMetrics(
        CaixaSessionAD session,
        IReadOnlyCollection<CaixaMovimentacaoAD> movements,
        CaixaSalesSummaryAD salesSummary)
    {
        PtBrMoneyParser.TryParse(session.OpeningAmount, out var openingAmount);
        var totalSuprimentos = Math.Round(
            movements.Where(m => string.Equals(m.Tipo, "SUPRIMENTO", StringComparison.OrdinalIgnoreCase)).Sum(m => m.Valor),
            2,
            MidpointRounding.AwayFromZero);
        var totalSangrias = Math.Round(
            movements.Where(m => string.Equals(m.Tipo, "SANGRIA", StringComparison.OrdinalIgnoreCase)).Sum(m => m.Valor),
            2,
            MidpointRounding.AwayFromZero);
        var cashReturns = ComputeCashReturns(movements);

        var salesCash = Math.Round(salesSummary.SalesCashTotal, 2, MidpointRounding.AwayFromZero);
        var salesPix = Math.Round(salesSummary.SalesPixTotal, 2, MidpointRounding.AwayFromZero);
        var salesDebit = Math.Round(salesSummary.SalesDebitTotal, 2, MidpointRounding.AwayFromZero);
        var salesCredit = Math.Round(salesSummary.SalesCreditTotal, 2, MidpointRounding.AwayFromZero);

        var expectedCash = Math.Round(
            openingAmount + salesCash + totalSuprimentos - totalSangrias - cashReturns,
            2,
            MidpointRounding.AwayFromZero);

        return new LiveSessionMetrics(
            expectedCash,
            salesCash,
            salesPix,
            salesDebit,
            salesCredit,
            totalSuprimentos,
            totalSangrias,
            cashReturns,
            salesSummary.SalesCount);
    }

    private static void ApplyLiveMetrics(CaixaSessionAD session, LiveSessionMetrics metrics)
    {
        session.ExpectedCashAmount = metrics.ExpectedCashAmount;
        session.SalesCashTotal = metrics.SalesCashTotal;
        session.SalesPixTotal = metrics.SalesPixTotal;
        session.SalesDebitTotal = metrics.SalesDebitTotal;
        session.SalesCreditTotal = metrics.SalesCreditTotal;
        session.TotalSuprimentos = metrics.TotalSuprimentos;
        session.TotalSangrias = metrics.TotalSangrias;
        session.SalesCount = metrics.SalesCount;
    }

    private static CaixaSessionDto ToSessionDto(CaixaSessionAD source, DateTimeOffset now, bool isSupervisor)
    {
        var closedAt = source.ClosedAt;
        var elapsed = (closedAt ?? now) - source.OpenedAt;
        var redactOpenAudit = closedAt is null && !isSupervisor;

        return new CaixaSessionDto
        {
            Id = source.Id,
            Status = closedAt is null ? "Aberto" : "Fechado",
            OpenedAt = source.OpenedAt.ToString("o"),
            ClosedAt = closedAt?.ToString("o"),
            OpeningAmount = source.OpeningAmount,
            ClosingAmount = source.ClosingAmount,
            OperatorName = source.OperatorName,
            ClosedByName = source.ClosedByName,
            Note = source.Note,
            ElapsedMinutes = Math.Max(0, (int)Math.Floor(elapsed.TotalMinutes)),
            ExpectedCashAmount = redactOpenAudit ? null : source.ExpectedCashAmount,
            CountedCashAmount = redactOpenAudit ? null : source.CountedCashAmount,
            CashDifference = redactOpenAudit ? null : source.CashDifference,
            SalesCashTotal = redactOpenAudit ? null : source.SalesCashTotal,
            SalesPixTotal = redactOpenAudit ? null : source.SalesPixTotal,
            SalesDebitTotal = redactOpenAudit ? null : source.SalesDebitTotal,
            SalesCreditTotal = redactOpenAudit ? null : source.SalesCreditTotal,
            TotalSuprimentos = redactOpenAudit ? null : source.TotalSuprimentos,
            TotalSangrias = redactOpenAudit ? null : source.TotalSangrias,
            SalesCount = redactOpenAudit ? null : source.SalesCount,
            BlindClosing = source.BlindClosing
        };
    }

    private static CaixaSessionSummaryDto BuildSessionSummaryDto(
        CaixaSessionAD source,
        IEnumerable<CaixaMovimentacaoAD> movements,
        decimal cashReturns,
        DateTimeOffset now,
        decimal? countedPixAmount = null,
        decimal? countedDebitAmount = null,
        decimal? countedCreditAmount = null)
    {
        PtBrMoneyParser.TryParse(source.OpeningAmount, out var openingDecimal);
        var closedAt = source.ClosedAt;
        var elapsed = (closedAt ?? now) - source.OpenedAt;
        var totalSalesAmount = Math.Round(
            source.SalesCashTotal + source.SalesPixTotal + source.SalesDebitTotal + source.SalesCreditTotal,
            2,
            MidpointRounding.AwayFromZero);
        var ticketMedio = source.SalesCount > 0
            ? Math.Round(totalSalesAmount / source.SalesCount, 2, MidpointRounding.AwayFromZero)
            : 0m;

        var differenceStatus = closedAt is null
            ? "ABERTO"
            : source.CashDifference == 0m
                ? "EXATO"
                : source.CashDifference > 0m
                    ? "SOBRA"
                    : "QUEBRA";

        return new CaixaSessionSummaryDto
        {
            Id = source.Id,
            Status = closedAt is null ? "Aberto" : "Fechado",
            OpenedAt = source.OpenedAt.ToString("o"),
            ClosedAt = closedAt?.ToString("o"),
            OpeningAmount = source.OpeningAmount,
            ClosingAmount = source.ClosingAmount,
            OpeningAmountDecimal = openingDecimal,
            OperatorName = source.OperatorName,
            ClosedByName = source.ClosedByName,
            Note = source.Note,
            ElapsedMinutes = Math.Max(0, (int)Math.Floor(elapsed.TotalMinutes)),
            BlindClosing = source.BlindClosing,
            ExpectedCashAmount = source.ExpectedCashAmount,
            CountedCashAmount = source.CountedCashAmount,
            CashDifference = source.CashDifference,
            DifferenceStatus = differenceStatus,
            SalesCashTotal = source.SalesCashTotal,
            SalesPixTotal = source.SalesPixTotal,
            SalesDebitTotal = source.SalesDebitTotal,
            SalesCreditTotal = source.SalesCreditTotal,
            CountedPixAmount = countedPixAmount.HasValue ? Math.Round(countedPixAmount.Value, 2, MidpointRounding.AwayFromZero) : null,
            CountedDebitAmount = countedDebitAmount.HasValue ? Math.Round(countedDebitAmount.Value, 2, MidpointRounding.AwayFromZero) : null,
            CountedCreditAmount = countedCreditAmount.HasValue ? Math.Round(countedCreditAmount.Value, 2, MidpointRounding.AwayFromZero) : null,
            TotalSalesAmount = totalSalesAmount,
            SalesCount = source.SalesCount,
            TicketMedio = ticketMedio,
            TotalSuprimentos = source.TotalSuprimentos,
            TotalSangrias = source.TotalSangrias,
            CashReturns = cashReturns,
            Movements = movements.Select(ToMovementDto).ToList()
        };
    }

    private static CaixaMovimentacaoDto ToMovementDto(CaixaMovimentacaoAD source) => new()
    {
        Id = source.Id,
        CompanyId = source.CompanyId,
        CaixaSessaoId = source.CaixaSessaoId,
        Tipo = source.Tipo,
        FormaPagamento = source.FormaPagamento,
        Valor = source.Valor,
        Descricao = source.Descricao,
        SaleNumber = source.SaleNumber,
        UsuarioId = source.UsuarioId,
        UsuarioName = source.UsuarioName,
        DataHora = source.DataHora.ToString("o")
    };

    private sealed record LiveSessionMetrics(
        decimal ExpectedCashAmount,
        decimal SalesCashTotal,
        decimal SalesPixTotal,
        decimal SalesDebitTotal,
        decimal SalesCreditTotal,
        decimal TotalSuprimentos,
        decimal TotalSangrias,
        decimal CashReturns,
        int SalesCount);
}

public class CaixaStatusDto
{
    public string State { get; set; } = "fechado";
    public bool CanSell { get; set; }
    public string BlockReason { get; set; } = "";
    public string ServerNow { get; set; } = "";
    public CaixaSessionDto? CurrentSession { get; set; }
    public CaixaSessionDto? LastSession { get; set; }
    public List<CaixaSessionDto> History { get; set; } = [];
    public List<CaixaMovimentacaoDto> CurrentMovements { get; set; } = [];
}

public class CaixaSessionDto
{
    public string Id { get; set; } = "";
    public string Status { get; set; } = "";
    public string OpenedAt { get; set; } = "";
    public string? ClosedAt { get; set; }
    public string OpeningAmount { get; set; } = "0,00";
    public string ClosingAmount { get; set; } = "0,00";
    public string OperatorName { get; set; } = "";
    public string ClosedByName { get; set; } = "";
    public string Note { get; set; } = "";
    public int ElapsedMinutes { get; set; }
    public decimal? ExpectedCashAmount { get; set; }
    public decimal? CountedCashAmount { get; set; }
    public decimal? CashDifference { get; set; }
    public decimal? SalesCashTotal { get; set; }
    public decimal? SalesPixTotal { get; set; }
    public decimal? SalesDebitTotal { get; set; }
    public decimal? SalesCreditTotal { get; set; }
    public decimal? TotalSuprimentos { get; set; }
    public decimal? TotalSangrias { get; set; }
    public int? SalesCount { get; set; }
    public bool BlindClosing { get; set; } = true;
}

public class CaixaMovimentacaoDto
{
    public string Id { get; set; } = "";
    public string CompanyId { get; set; } = "";
    public string CaixaSessaoId { get; set; } = "";
    public string Tipo { get; set; } = "";
    public string FormaPagamento { get; set; } = "";
    public decimal Valor { get; set; }
    public string Descricao { get; set; } = "";
    public string? SaleNumber { get; set; }
    public string UsuarioId { get; set; } = "";
    public string UsuarioName { get; set; } = "";
    public string DataHora { get; set; } = "";
}

public class CaixaSessionSummaryDto
{
    public string Id { get; set; } = "";
    public string Status { get; set; } = "";
    public string OpenedAt { get; set; } = "";
    public string? ClosedAt { get; set; }
    public string OpeningAmount { get; set; } = "0,00";
    public string ClosingAmount { get; set; } = "0,00";
    public decimal OpeningAmountDecimal { get; set; }
    public string OperatorName { get; set; } = "";
    public string ClosedByName { get; set; } = "";
    public string Note { get; set; } = "";
    public int ElapsedMinutes { get; set; }
    public bool BlindClosing { get; set; } = true;
    public decimal ExpectedCashAmount { get; set; }
    public decimal CountedCashAmount { get; set; }
    public decimal CashDifference { get; set; }
    public string DifferenceStatus { get; set; } = "EXATO";
    public decimal SalesCashTotal { get; set; }
    public decimal SalesPixTotal { get; set; }
    public decimal SalesDebitTotal { get; set; }
    public decimal SalesCreditTotal { get; set; }
    public decimal? CountedPixAmount { get; set; }
    public decimal? CountedDebitAmount { get; set; }
    public decimal? CountedCreditAmount { get; set; }
    public decimal TotalSalesAmount { get; set; }
    public int SalesCount { get; set; }
    public decimal TicketMedio { get; set; }
    public decimal TotalSuprimentos { get; set; }
    public decimal TotalSangrias { get; set; }
    public decimal CashReturns { get; set; }
    public List<CaixaMovimentacaoDto> Movements { get; set; } = [];
}

public class DailyBalanceDto
{
    public string Date { get; set; } = "";
    public int SessionsCount { get; set; }
    public int OpenSessionsCount { get; set; }
    public int ClosedSessionsCount { get; set; }
    public decimal TotalOpeningAmount { get; set; }
    public decimal TotalExpectedCashAmount { get; set; }
    public decimal TotalCountedCashAmount { get; set; }
    public decimal TotalCashDifference { get; set; }
    public decimal TotalSuprimentos { get; set; }
    public decimal TotalSangrias { get; set; }
    public decimal TotalCashReturns { get; set; }
    public decimal SalesCashTotal { get; set; }
    public decimal SalesPixTotal { get; set; }
    public decimal SalesDebitTotal { get; set; }
    public decimal SalesCreditTotal { get; set; }
    public decimal TotalSalesAmount { get; set; }
    public int SalesCount { get; set; }
    public decimal TicketMedio { get; set; }
    public List<CaixaSessionSummaryDto> Sessions { get; set; } = [];
}
