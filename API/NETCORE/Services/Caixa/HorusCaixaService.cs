using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Services.Security;

namespace HORUSPDV_API.Services.Caixa;

public class HorusCaixaService
{
    private static readonly TimeSpan MaxOpenPeriod = TimeSpan.FromHours(24);
    private readonly object _syncRoot = new();
    private readonly List<CaixaSession> _sessions =
    [
        new()
        {
            Id = "cx-001",
            OpenedAt = DateTimeOffset.Now.AddDays(-1).Date.AddHours(8),
            ClosedAt = DateTimeOffset.Now.AddDays(-1).Date.AddHours(18),
            OpeningAmount = "250,00",
            ClosingAmount = "3.418,90",
            OperatorId = "usr-001",
            OperatorName = "Flávio Oliveira",
            Note = "Fechamento do período anterior."
        }
    ];

    public CaixaStatusDto GetStatus(DateTimeOffset? reference = null)
    {
        lock (_syncRoot)
        {
            return BuildStatus(reference ?? DateTimeOffset.Now);
        }
    }

    public CaixaStatusDto Abrir(AbrirCaixaRequest request, AuthenticatedUser currentUser)
    {
        var now = DateTimeOffset.Now;
        lock (_syncRoot)
        {
            var openSession = GetOpenSession();
            if (openSession is not null)
            {
                var status = BuildStatus(now);
                if (status.CanSell)
                {
                    throw new InvalidOperationException("Ja existe um caixa aberto para venda.");
                }

                throw new InvalidOperationException(
                    "Existe um caixa aberto fora do periodo permitido. Feche o caixa atual antes de abrir um novo.");
            }

            _sessions.Insert(0, new CaixaSession
            {
                Id = $"cx-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                OpenedAt = now,
                OpeningAmount = NormalizeMoney(request.OpeningAmount),
                OperatorId = currentUser.Id,
                OperatorName = currentUser.Name,
                Note = ""
            });

            return BuildStatus(now);
        }
    }

    public CaixaStatusDto Fechar(FecharCaixaRequest request, AuthenticatedUser currentUser)
    {
        var now = DateTimeOffset.Now;
        lock (_syncRoot)
        {
            var openSession = GetOpenSession();
            if (openSession is null)
            {
                throw new InvalidOperationException("Nao existe caixa aberto para fechamento.");
            }

            openSession.ClosedAt = now;
            openSession.ClosingAmount = NormalizeMoney(request.ClosingAmount);
            openSession.ClosedById = currentUser.Id;
            openSession.ClosedByName = currentUser.Name;
            openSession.Note = request.Note.Trim();

            return BuildStatus(now);
        }
    }

    public void EnsureVendaPermitida()
    {
        lock (_syncRoot)
        {
            var status = BuildStatus(DateTimeOffset.Now);
            if (status.CanSell) return;

            throw new InvalidOperationException(status.BlockReason);
        }
    }

    private CaixaSession? GetOpenSession()
        => _sessions.FirstOrDefault(item => item.ClosedAt is null);

    private CaixaStatusDto BuildStatus(DateTimeOffset now)
    {
        var openSession = GetOpenSession();
        var lastSession = openSession ?? _sessions.OrderByDescending(item => item.OpenedAt).FirstOrDefault();
        var canSell = false;
        var blockReason = "Abra o caixa do dia antes de iniciar vendas.";
        var state = "fechado";

        if (openSession is not null)
        {
            var openedToday = openSession.OpenedAt.Date == now.Date;
            var withinPeriod = now - openSession.OpenedAt <= MaxOpenPeriod;

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

        return new CaixaStatusDto
        {
            State = state,
            CanSell = canSell,
            BlockReason = blockReason,
            ServerNow = now.ToString("o"),
            CurrentSession = openSession is null ? null : ToDto(openSession, now),
            LastSession = lastSession is null ? null : ToDto(lastSession, now),
            History = _sessions.Take(12).Select(item => ToDto(item, now)).ToList()
        };
    }

    private static CaixaSessionDto ToDto(CaixaSession source, DateTimeOffset now)
    {
        var closedAt = source.ClosedAt;
        var elapsed = (closedAt ?? now) - source.OpenedAt;

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
            ElapsedMinutes = Math.Max(0, (int)Math.Floor(elapsed.TotalMinutes))
        };
    }

    private static string NormalizeMoney(string value)
    {
        var trimmed = value.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? "0,00" : trimmed;
    }
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
}

internal class CaixaSession
{
    public string Id { get; set; } = "";
    public DateTimeOffset OpenedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public string OpeningAmount { get; set; } = "0,00";
    public string ClosingAmount { get; set; } = "0,00";
    public string OperatorId { get; set; } = "";
    public string OperatorName { get; set; } = "";
    public string ClosedById { get; set; } = "";
    public string ClosedByName { get; set; } = "";
    public string Note { get; set; } = "";
}
