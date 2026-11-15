/**
 * Arquivo: API/NETCORE/Services/Caixa/HorusCaixaService.cs
 * Objetivo: centraliza regras de negócio de abertura, fechamento cego, sangria, suprimento e balanço diário de caixa.
 * Entradas esperadas: recebe requisições já validadas pelos controladores e aplica consistência operacional do domínio.
 */
using System.Globalization;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Security;

namespace HORUSPDV_API.Services.Caixa;

public class HorusCaixaService(CaixaAB caixaAB)
{
    private static readonly TimeSpan MaxOpenPeriod = TimeSpan.FromHours(24);
    private static readonly CultureInfo PtBr = new("pt-BR");

    public CaixaStatusDto GetStatus(string companyId, DateTimeOffset? reference = null)
        => BuildStatus(companyId, reference ?? DateTimeOffset.Now);

    public CaixaStatusDto Abrir(AbrirCaixaRequest request, AuthenticatedUser currentUser)
    {
        var now = DateTimeOffset.Now;
        var openSession = caixaAB.ObterSessaoAbertaAsync(currentUser.CompanyId).GetAwaiter().GetResult();
        if (openSession is not null)
        {
            var status = BuildStatus(currentUser.CompanyId, now);
            if (status.CanSell)
            {
                throw new InvalidOperationException("Já existe um caixa aberto para venda.");
            }

            throw new InvalidOperationException(
                "Existe um caixa aberto fora do período permitido. Feche o caixa atual antes de abrir um novo.");
        }

        var openingDecimal = ParseMoney(request.OpeningAmount);
        if (openingDecimal < 0m)
        {
            throw new InvalidOperationException("O valor inicial do caixa não pode ser negativo.");
        }

        var normalizedOpening = FormatMoney(openingDecimal);
        var sessionId = $"cx-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        caixaAB.AbrirAsync(
                sessionId,
                currentUser.CompanyId,
                now,
                normalizedOpening,
                currentUser.Id,
                currentUser.Name)
            .GetAwaiter()
            .GetResult();

        caixaAB.RegistrarMovimentacaoAsync(new CaixaMovimentacaoAD
            {
                Id = $"mov-open-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                CompanyId = currentUser.CompanyId,
                CaixaSessaoId = sessionId,
                Tipo = "ABERTURA",
                FormaPagamento = "Dinheiro",
                Valor = normalizedOpening,
                Descricao = "Fundo de troco inicial na abertura do caixa",
                OperatorId = currentUser.Id,
                OperatorName = currentUser.Name,
                CreatedAt = now
            })
            .GetAwaiter()
            .GetResult();

        return BuildStatus(currentUser.CompanyId, now);
    }

    public CaixaStatusDto RegistrarSangria(SangriaCaixaRequest request, AuthenticatedUser currentUser)
        => RegistrarMovimentacao(
            new CaixaMovimentacaoRequest
            {
                Tipo = "SANGRIA",
                Valor = request.Amount,
                Descricao = request.Reason,
                FormaPagamento = "Dinheiro"
            },
            currentUser);

    public CaixaStatusDto RegistrarSuprimento(SuprimentoCaixaRequest request, AuthenticatedUser currentUser)
        => RegistrarMovimentacao(
            new CaixaMovimentacaoRequest
            {
                Tipo = "SUPRIMENTO",
                Valor = request.Amount,
                Descricao = request.Reason,
                FormaPagamento = "Dinheiro"
            },
            currentUser);

    public CaixaStatusDto RegistrarMovimentacao(CaixaMovimentacaoRequest request, AuthenticatedUser currentUser)
    {
        var now = DateTimeOffset.Now;
        var openSession = caixaAB.ObterSessaoAbertaAsync(currentUser.CompanyId).GetAwaiter().GetResult();
        if (openSession is null)
        {
            throw new InvalidOperationException("Não existe caixa aberto para registrar movimentação.");
        }

        var tipo = NormalizeMovementType(request.Tipo);
        var amount = ParseMoney(request.Valor);
        if (amount <= 0m)
        {
            throw new InvalidOperationException("O valor da movimentação deve ser maior que zero.");
        }

        var descricao = (request.Descricao ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(descricao))
        {
            descricao = tipo == "SANGRIA" ? "Sangria de caixa" : "Suprimento de caixa";
        }

        if (tipo == "SANGRIA")
        {
            var sales = caixaAB.ListarVendasSessaoAsync(currentUser.CompanyId, openSession.Id, openSession.OpenedAt, null)
                .GetAwaiter()
                .GetResult();
            var movements = caixaAB.ListarMovimentacoesAsync(currentUser.CompanyId, openSession.Id)
                .GetAwaiter()
                .GetResult();
            var currentBalance = CalcularBalancoSessao(openSession, sales, movements, null);
            var availableCash = ParseMoney(currentBalance.ExpectedCashAmount);
            if (amount > availableCash)
            {
                throw new InvalidOperationException(
                    $"Saldo em dinheiro insuficiente para sangria. Disponível em gaveta: R$ {currentBalance.ExpectedCashAmount}.");
            }
        }

        var normalizedAmount = FormatMoney(amount);
        caixaAB.RegistrarMovimentacaoAsync(new CaixaMovimentacaoAD
            {
                Id = $"mov-{tipo.ToLowerInvariant()}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                CompanyId = currentUser.CompanyId,
                CaixaSessaoId = openSession.Id,
                Tipo = tipo,
                FormaPagamento = "Dinheiro",
                Valor = normalizedAmount,
                Descricao = descricao,
                OperatorId = currentUser.Id,
                OperatorName = currentUser.Name,
                CreatedAt = now
            })
            .GetAwaiter()
            .GetResult();

        return BuildStatus(currentUser.CompanyId, now);
    }

    public CaixaStatusDto Fechar(FecharCaixaRequest request, AuthenticatedUser currentUser)
    {
        var now = DateTimeOffset.Now;
        var openSession = caixaAB.ObterSessaoAbertaAsync(currentUser.CompanyId).GetAwaiter().GetResult();
        if (openSession is null)
        {
            throw new InvalidOperationException("Não existe caixa aberto para fechamento.");
        }

        var closingDecimal = ParseMoney(request.ClosingAmount);
        if (closingDecimal < 0m)
        {
            throw new InvalidOperationException("O valor de fechamento não pode ser negativo.");
        }

        var sales = caixaAB.ListarVendasSessaoAsync(currentUser.CompanyId, openSession.Id, openSession.OpenedAt, now)
            .GetAwaiter()
            .GetResult();
        var movements = caixaAB.ListarMovimentacoesAsync(currentUser.CompanyId, openSession.Id)
            .GetAwaiter()
            .GetResult();

        var normalizedClosing = FormatMoney(closingDecimal);
        var balance = CalcularBalancoSessao(openSession, sales, movements, normalizedClosing);
        var note = (request.Note ?? string.Empty).Trim();

        caixaAB.FecharAsync(
                openSession.Id,
                currentUser.CompanyId,
                now,
                normalizedClosing,
                currentUser.Id,
                currentUser.Name,
                note,
                balance.ExpectedCashAmount,
                balance.DifferenceAmount,
                balance.DifferenceStatus,
                balance.TotalCashSales,
                balance.TotalSupplies,
                balance.TotalWithdrawals)
            .GetAwaiter()
            .GetResult();

        caixaAB.RegistrarMovimentacaoAsync(new CaixaMovimentacaoAD
            {
                Id = $"mov-close-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                CompanyId = currentUser.CompanyId,
                CaixaSessaoId = openSession.Id,
                Tipo = "FECHAMENTO",
                FormaPagamento = "Dinheiro",
                Valor = normalizedClosing,
                Descricao = string.IsNullOrWhiteSpace(note)
                    ? $"Fechamento de caixa ({balance.DifferenceStatus}: dif. R$ {balance.DifferenceAmount})"
                    : $"Fechamento: {note} ({balance.DifferenceStatus}: dif. R$ {balance.DifferenceAmount})",
                OperatorId = currentUser.Id,
                OperatorName = currentUser.Name,
                CreatedAt = now
            })
            .GetAwaiter()
            .GetResult();

        return BuildStatus(currentUser.CompanyId, now);
    }

    public List<CaixaMovimentacaoDto> ListarMovimentacoes(string companyId, string? sessionId = null)
    {
        var targetSessionId = sessionId;
        if (string.IsNullOrWhiteSpace(targetSessionId))
        {
            var sessions = caixaAB.ListarSessoesAsync(companyId).GetAwaiter().GetResult();
            targetSessionId = sessions.FirstOrDefault(s => s.ClosedAt is null)?.Id ?? sessions.FirstOrDefault()?.Id;
        }

        var movements = caixaAB.ListarMovimentacoesAsync(companyId, targetSessionId).GetAwaiter().GetResult();
        return movements.Select(ToMovementDto).ToList();
    }

    public CaixaBalancoDiarioDto? ObterBalancoSessao(string companyId, string? sessionId = null)
    {
        var sessions = caixaAB.ListarSessoesAsync(companyId).GetAwaiter().GetResult();
        var target = string.IsNullOrWhiteSpace(sessionId)
            ? sessions.FirstOrDefault(s => s.ClosedAt is null) ?? sessions.FirstOrDefault()
            : sessions.FirstOrDefault(s => string.Equals(s.Id, sessionId, StringComparison.OrdinalIgnoreCase));

        if (target is null) return null;

        var sales = caixaAB.ListarVendasSessaoAsync(companyId, target.Id, target.OpenedAt, target.ClosedAt)
            .GetAwaiter()
            .GetResult();
        var movements = caixaAB.ListarMovimentacoesAsync(companyId, target.Id)
            .GetAwaiter()
            .GetResult();

        return CalcularBalancoSessao(
            target,
            sales,
            movements,
            target.ClosedAt.HasValue ? target.ClosingAmount : null);
    }

    public void EnsureVendaPermitida(string companyId)
    {
        var status = BuildStatus(companyId, DateTimeOffset.Now);
        if (status.CanSell) return;

        throw new InvalidOperationException(status.BlockReason);
    }

    public static CaixaBalancoDiarioDto CalcularBalancoSessao(
        CaixaSessionAD session,
        IEnumerable<CaixaVendaResumoAD> sales,
        IEnumerable<CaixaMovimentacaoAD> movements,
        string? countedClosingAmount)
    {
        var salesList = sales?.ToList() ?? [];
        var movementsList = movements?.ToList() ?? [];

        var openingDecimal = ParseMoney(session.OpeningAmount);
        var suppliesDecimal = movementsList
            .Where(m => string.Equals(m.Tipo, "SUPRIMENTO", StringComparison.OrdinalIgnoreCase))
            .Sum(m => ParseMoney(m.Valor));
        var withdrawalsDecimal = movementsList
            .Where(m => string.Equals(m.Tipo, "SANGRIA", StringComparison.OrdinalIgnoreCase))
            .Sum(m => ParseMoney(m.Valor));

        var cashSalesDecimal = 0m;
        var pixSalesDecimal = 0m;
        var debitSalesDecimal = 0m;
        var creditSalesDecimal = 0m;
        var otherSalesDecimal = 0m;

        var breakdownMap = new Dictionary<string, (int Count, decimal Total)>(StringComparer.OrdinalIgnoreCase)
        {
            ["Dinheiro"] = (0, 0m),
            ["PIX"] = (0, 0m),
            ["Cartão de Débito"] = (0, 0m),
            ["Cartão de Crédito"] = (0, 0m)
        };

        foreach (var sale in salesList)
        {
            var amount = ParseMoney(sale.TotalAmount);
            var category = ClassifyPaymentMethod(sale.PaymentType);
            switch (category)
            {
                case "Dinheiro":
                    cashSalesDecimal += amount;
                    break;
                case "PIX":
                    pixSalesDecimal += amount;
                    break;
                case "Cartão de Débito":
                    debitSalesDecimal += amount;
                    break;
                case "Cartão de Crédito":
                    creditSalesDecimal += amount;
                    break;
                default:
                    otherSalesDecimal += amount;
                    break;
            }

            if (!breakdownMap.TryGetValue(category, out var current))
            {
                current = (0, 0m);
            }

            breakdownMap[category] = (current.Count + 1, current.Total + amount);
        }

        // Fallback para sessões já fechadas sem linhas detalhadas se houver TotalCashSales salvo
        if (salesList.Count == 0 && ParseMoney(session.TotalCashSales) > 0m)
        {
            cashSalesDecimal = ParseMoney(session.TotalCashSales);
            breakdownMap["Dinheiro"] = (1, cashSalesDecimal);
        }

        if (movementsList.Count == 0)
        {
            if (ParseMoney(session.TotalSupplies) > 0m) suppliesDecimal = ParseMoney(session.TotalSupplies);
            if (ParseMoney(session.TotalWithdrawals) > 0m) withdrawalsDecimal = ParseMoney(session.TotalWithdrawals);
        }

        var totalSalesAmount = cashSalesDecimal + pixSalesDecimal + debitSalesDecimal + creditSalesDecimal + otherSalesDecimal;
        var totalSalesCount = salesList.Count;
        var averageTicket = totalSalesCount > 0
            ? Math.Round(totalSalesAmount / totalSalesCount, 2, MidpointRounding.AwayFromZero)
            : 0m;

        var expectedCash = Math.Max(0m, openingDecimal + cashSalesDecimal + suppliesDecimal - withdrawalsDecimal);

        var hasCounted = !string.IsNullOrWhiteSpace(countedClosingAmount) || session.ClosedAt.HasValue;
        var countedDecimal = hasCounted
            ? ParseMoney(countedClosingAmount ?? session.ClosingAmount)
            : expectedCash;

        var differenceDecimal = hasCounted ? countedDecimal - expectedCash : 0m;
        var differenceStatus = ClassifyDifference(differenceDecimal);

        var paymentBreakdown = breakdownMap
            .Where(kv => kv.Value.Count > 0 || kv.Key is "Dinheiro" or "PIX" or "Cartão de Débito" or "Cartão de Crédito")
            .Select(kv => new CaixaFormaPagamentoResumoDto
            {
                FormaPagamento = kv.Key,
                QuantidadeVendas = kv.Value.Count,
                TotalVendido = FormatMoney(kv.Value.Total),
                Percentual = totalSalesAmount > 0m
                    ? Math.Round(kv.Value.Total / totalSalesAmount * 100m, 2, MidpointRounding.AwayFromZero)
                    : 0m
            })
            .ToList();

        return new CaixaBalancoDiarioDto
        {
            CaixaSessaoId = session.Id,
            Status = session.ClosedAt is null ? "Aberto" : "Fechado",
            OpenedAt = session.OpenedAt.ToString("o"),
            ClosedAt = session.ClosedAt?.ToString("o"),
            OperatorName = session.OperatorName,
            OpeningAmount = FormatMoney(openingDecimal),
            TotalCashSales = FormatMoney(cashSalesDecimal),
            TotalPixSales = FormatMoney(pixSalesDecimal),
            TotalDebitSales = FormatMoney(debitSalesDecimal),
            TotalCreditSales = FormatMoney(creditSalesDecimal),
            TotalOtherSales = FormatMoney(otherSalesDecimal),
            TotalSalesAmount = FormatMoney(totalSalesAmount),
            TotalSalesCount = totalSalesCount,
            AverageTicket = FormatMoney(averageTicket),
            TotalSupplies = FormatMoney(suppliesDecimal),
            TotalWithdrawals = FormatMoney(withdrawalsDecimal),
            ExpectedCashAmount = FormatMoney(expectedCash),
            CountedCashAmount = hasCounted ? FormatMoney(countedDecimal) : null,
            DifferenceAmount = FormatMoney(differenceDecimal),
            DifferenceStatus = differenceStatus,
            PaymentBreakdown = paymentBreakdown
        };
    }

    public static string ClassifyPaymentMethod(string? rawPaymentType)
    {
        var normalized = (rawPaymentType ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized) || normalized == "-" || normalized.Contains("dinheiro") || normalized.Contains("especie") || normalized.Contains("espécie"))
        {
            return "Dinheiro";
        }

        if (normalized.Contains("pix"))
        {
            return "PIX";
        }

        if (normalized.Contains("debito") || normalized.Contains("débito"))
        {
            return "Cartão de Débito";
        }

        if (normalized.Contains("credito") || normalized.Contains("crédito") || normalized.Contains("cartao") || normalized.Contains("cartão"))
        {
            return "Cartão de Crédito";
        }

        return rawPaymentType!.Trim();
    }

    public static string ClassifyDifference(decimal difference)
    {
        var rounded = Math.Round(difference, 2, MidpointRounding.AwayFromZero);
        if (rounded > 0m) return "SOBRA";
        if (rounded < 0m) return "QUEBRA";
        return "CONFERIDO";
    }

    public static string NormalizeMovementType(string? rawType)
    {
        var normalized = (rawType ?? string.Empty).Trim().ToUpperInvariant();
        return normalized switch
        {
            "SANGRIA" => "SANGRIA",
            "SUPRIMENTO" => "SUPRIMENTO",
            _ => throw new InvalidOperationException("Tipo de movimentação inválido. Informe SANGRIA ou SUPRIMENTO.")
        };
    }

    public static decimal ParseMoney(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return 0m;
        var cleaned = value
            .Replace("R$", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Trim();

        if (cleaned.Contains(','))
        {
            cleaned = cleaned.Replace(".", string.Empty).Replace(',', '.');
        }

        return decimal.TryParse(cleaned, NumberStyles.Number | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var parsed)
            ? Math.Round(parsed, 2, MidpointRounding.AwayFromZero)
            : 0m;
    }

    public static string FormatMoney(decimal value)
        => Math.Round(value, 2, MidpointRounding.AwayFromZero).ToString("N2", PtBr);

    private CaixaStatusDto BuildStatus(string companyId, DateTimeOffset now)
    {
        var sessions = caixaAB.ListarSessoesAsync(companyId).GetAwaiter().GetResult();
        var openSession = sessions.FirstOrDefault(item => item.ClosedAt is null);
        var lastSession = openSession ?? sessions.FirstOrDefault();
        var canSell = false;
        var blockReason = "Abra o caixa do dia antes de iniciar vendas.";
        var state = "fechado";

        if (openSession is not null)
        {
            var openedToday = openSession.OpenedAt.Date == now.Date;
            var withinPeriod = now - openSession.OpenedAt <= MaxOpenPeriod;

            // Regra de negócio do PDV: venda só é permitida com caixa aberto no dia atual e por até 24 horas.
            if (openedToday && withinPeriod)
            {
                canSell = true;
                blockReason = "";
                state = "aberto";
            }
            else
            {
                state = "expirado";
                blockReason = !openedToday
                    ? "O caixa aberto pertence a outro dia. Feche o caixa atual e abra o caixa do dia."
                    : "O caixa aberto ultrapassou 24 horas. Feche o caixa atual e abra um novo.";
            }
        }

        var referenceSession = openSession ?? lastSession;
        CaixaBalancoDiarioDto? currentBalance = null;
        List<CaixaMovimentacaoDto> movements = [];

        if (referenceSession is not null)
        {
            var sessionSales = caixaAB.ListarVendasSessaoAsync(
                    companyId,
                    referenceSession.Id,
                    referenceSession.OpenedAt,
                    referenceSession.ClosedAt)
                .GetAwaiter()
                .GetResult();
            var sessionMovements = caixaAB.ListarMovimentacoesAsync(companyId, referenceSession.Id)
                .GetAwaiter()
                .GetResult();

            currentBalance = CalcularBalancoSessao(
                referenceSession,
                sessionSales,
                sessionMovements,
                referenceSession.ClosedAt.HasValue ? referenceSession.ClosingAmount : null);
            movements = sessionMovements.Select(ToMovementDto).ToList();

            if (openSession is not null && ReferenceEquals(referenceSession, openSession))
            {
                openSession.ExpectedAmount = currentBalance.ExpectedCashAmount;
                openSession.TotalCashSales = currentBalance.TotalCashSales;
                openSession.TotalSupplies = currentBalance.TotalSupplies;
                openSession.TotalWithdrawals = currentBalance.TotalWithdrawals;
            }
        }

        return new CaixaStatusDto
        {
            State = state,
            CanSell = canSell,
            BlockReason = blockReason,
            ServerNow = now.ToString("o"),
            CurrentSession = openSession is null ? null : ToDto(openSession, now),
            LastSession = lastSession is null ? null : ToDto(lastSession, now),
            CurrentBalance = currentBalance,
            Movements = movements,
            History = sessions.Take(12).Select(item => ToDto(item, now)).ToList()
        };
    }

    private static CaixaSessionDto ToDto(CaixaSessionAD source, DateTimeOffset now)
    {
        var closedAt = source.ClosedAt;
        var elapsed = (closedAt ?? now) - source.OpenedAt;
        var expected = string.IsNullOrWhiteSpace(source.ExpectedAmount) || source.ExpectedAmount == "0,00"
            ? source.OpeningAmount
            : source.ExpectedAmount;

        return new CaixaSessionDto
        {
            Id = source.Id,
            Status = closedAt is null ? "Aberto" : "Fechado",
            OpenedAt = source.OpenedAt.ToString("o"),
            ClosedAt = closedAt?.ToString("o"),
            OpeningAmount = source.OpeningAmount,
            ClosingAmount = source.ClosingAmount,
            ExpectedAmount = expected,
            DifferenceAmount = string.IsNullOrWhiteSpace(source.DifferenceAmount) ? "0,00" : source.DifferenceAmount,
            DifferenceStatus = string.IsNullOrWhiteSpace(source.DifferenceStatus) ? "CONFERIDO" : source.DifferenceStatus,
            TotalCashSales = string.IsNullOrWhiteSpace(source.TotalCashSales) ? "0,00" : source.TotalCashSales,
            TotalSupplies = string.IsNullOrWhiteSpace(source.TotalSupplies) ? "0,00" : source.TotalSupplies,
            TotalWithdrawals = string.IsNullOrWhiteSpace(source.TotalWithdrawals) ? "0,00" : source.TotalWithdrawals,
            OperatorName = source.OperatorName,
            ClosedByName = source.ClosedByName,
            Note = source.Note,
            ElapsedMinutes = Math.Max(0, (int)Math.Floor(elapsed.TotalMinutes))
        };
    }

    private static CaixaMovimentacaoDto ToMovementDto(CaixaMovimentacaoAD source) => new()
    {
        Id = source.Id,
        CaixaSessaoId = source.CaixaSessaoId,
        Tipo = source.Tipo,
        FormaPagamento = source.FormaPagamento,
        Valor = source.Valor,
        Descricao = source.Descricao,
        OperatorId = source.OperatorId,
        OperatorName = source.OperatorName,
        CreatedAt = source.CreatedAt.ToString("o")
    };
}

public class CaixaStatusDto
{
    public string State { get; set; } = "fechado";
    public bool CanSell { get; set; }
    public string BlockReason { get; set; } = "";
    public string ServerNow { get; set; } = "";
    public CaixaSessionDto? CurrentSession { get; set; }
    public CaixaSessionDto? LastSession { get; set; }
    public CaixaBalancoDiarioDto? CurrentBalance { get; set; }
    public List<CaixaMovimentacaoDto> Movements { get; set; } = [];
    public List<CaixaSessionDto> History { get; set; } = [];
}

public class CaixaSessionDto
{
    public string Id { get; set; } = "";
    public string Status { get; set; } = "";
    public string OpenedAt { get; set; } = "";
    public string? ClosedAt { get; set; }
    public string OpeningAmount { get; set; } = "0,00";
    public string ClosingAmount { get; set; } = "0,00";
    public string ExpectedAmount { get; set; } = "0,00";
    public string DifferenceAmount { get; set; } = "0,00";
    public string DifferenceStatus { get; set; } = "CONFERIDO";
    public string TotalCashSales { get; set; } = "0,00";
    public string TotalSupplies { get; set; } = "0,00";
    public string TotalWithdrawals { get; set; } = "0,00";
    public string OperatorName { get; set; } = "";
    public string ClosedByName { get; set; } = "";
    public string Note { get; set; } = "";
    public int ElapsedMinutes { get; set; }
}

public class CaixaMovimentacaoDto
{
    public string Id { get; set; } = "";
    public string CaixaSessaoId { get; set; } = "";
    public string Tipo { get; set; } = "";
    public string FormaPagamento { get; set; } = "Dinheiro";
    public string Valor { get; set; } = "0,00";
    public string Descricao { get; set; } = "";
    public string OperatorId { get; set; } = "";
    public string OperatorName { get; set; } = "";
    public string CreatedAt { get; set; } = "";
}

public class CaixaFormaPagamentoResumoDto
{
    public string FormaPagamento { get; set; } = "";
    public int QuantidadeVendas { get; set; }
    public string TotalVendido { get; set; } = "0,00";
    public decimal Percentual { get; set; }
}

public class CaixaBalancoDiarioDto
{
    public string CaixaSessaoId { get; set; } = "";
    public string Status { get; set; } = "Fechado";
    public string OpenedAt { get; set; } = "";
    public string? ClosedAt { get; set; }
    public string OperatorName { get; set; } = "";
    public string OpeningAmount { get; set; } = "0,00";
    public string TotalCashSales { get; set; } = "0,00";
    public string TotalPixSales { get; set; } = "0,00";
    public string TotalDebitSales { get; set; } = "0,00";
    public string TotalCreditSales { get; set; } = "0,00";
    public string TotalOtherSales { get; set; } = "0,00";
    public string TotalSalesAmount { get; set; } = "0,00";
    public int TotalSalesCount { get; set; }
    public string AverageTicket { get; set; } = "0,00";
    public string TotalSupplies { get; set; } = "0,00";
    public string TotalWithdrawals { get; set; } = "0,00";
    public string ExpectedCashAmount { get; set; } = "0,00";
    public string? CountedCashAmount { get; set; }
    public string DifferenceAmount { get; set; } = "0,00";
    public string DifferenceStatus { get; set; } = "CONFERIDO";
    public List<CaixaFormaPagamentoResumoDto> PaymentBreakdown { get; set; } = [];
}

