using HORUSPDV_API.Data;
using HORUSPDV_API.Data.Entities;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Services.Security;
using Microsoft.EntityFrameworkCore;

namespace HORUSPDV_API.Services.Caixa;

public class HorusCaixaService(HorusDbContext db)
{
    private static readonly TimeSpan MaxOpenPeriod = TimeSpan.FromHours(24);

    public CaixaStatusDto GetStatus(DateTimeOffset? reference = null)
        => BuildStatus(reference ?? DateTimeOffset.Now);

    public CaixaStatusDto Abrir(AbrirCaixaRequest request, AuthenticatedUser currentUser)
    {
        var now = DateTimeOffset.Now;
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

        db.CaixaSessoes.Add(new CaixaSessionEntity
        {
            Id = $"cx-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            OpenedAt = now,
            OpeningAmount = NormalizeMoney(request.OpeningAmount),
            OperatorId = currentUser.Id,
            OperatorName = currentUser.Name,
            Note = ""
        });
        db.SaveChanges();
        return BuildStatus(now);
    }

    public CaixaStatusDto Fechar(FecharCaixaRequest request, AuthenticatedUser currentUser)
    {
        var now = DateTimeOffset.Now;
        var openSession = db.CaixaSessoes.FirstOrDefault(item => item.ClosedAt == null);
        if (openSession is null)
        {
            throw new InvalidOperationException("Nao existe caixa aberto para fechamento.");
        }

        openSession.ClosedAt = now;
        openSession.ClosingAmount = NormalizeMoney(request.ClosingAmount);
        openSession.ClosedById = currentUser.Id;
        openSession.ClosedByName = currentUser.Name;
        openSession.Note = request.Note.Trim();
        db.SaveChanges();
        return BuildStatus(now);
    }

    public void EnsureVendaPermitida()
    {
        var status = BuildStatus(DateTimeOffset.Now);
        if (status.CanSell) return;

        throw new InvalidOperationException(status.BlockReason);
    }

    private CaixaSessionEntity? GetOpenSession()
        => db.CaixaSessoes.AsNoTracking().FirstOrDefault(item => item.ClosedAt == null);

    private CaixaStatusDto BuildStatus(DateTimeOffset now)
    {
        var sessions = db.CaixaSessoes.AsNoTracking().OrderByDescending(item => item.OpenedAt).ToList();
        var openSession = sessions.FirstOrDefault(item => item.ClosedAt is null);
        var lastSession = openSession ?? sessions.FirstOrDefault();
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
            History = sessions.Take(12).Select(item => ToDto(item, now)).ToList()
        };
    }

    private static CaixaSessionDto ToDto(CaixaSessionEntity source, DateTimeOffset now)
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
