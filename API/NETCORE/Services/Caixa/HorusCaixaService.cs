/**
 * Arquivo: API/NETCORE/Services/Caixa/HorusCaixaService.cs
 * Objetivo: centraliza regras de negócio de abertura, fechamento e status de caixa antes do acesso ao banco ou resposta HTTP.
 * Entradas esperadas: recebe requisições já validadas pelos controladores e aplica consistência operacional do domínio.
 */
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Security;

namespace HORUSPDV_API.Services.Caixa;

public class HorusCaixaService(CaixaAB caixaAB)
{
    private static readonly TimeSpan MaxOpenPeriod = TimeSpan.FromHours(24);

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

        caixaAB.AbrirAsync(
                $"cx-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                currentUser.CompanyId,
                now,
                NormalizeMoney(request.OpeningAmount),
                currentUser.Id,
                currentUser.Name)
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

        caixaAB.FecharAsync(
                openSession.Id,
                currentUser.CompanyId,
                now,
                NormalizeMoney(request.ClosingAmount),
                currentUser.Id,
                currentUser.Name,
                request.Note.Trim())
            .GetAwaiter()
            .GetResult();
        return BuildStatus(currentUser.CompanyId, now);
    }

    public void EnsureVendaPermitida(string companyId)
    {
        var status = BuildStatus(companyId, DateTimeOffset.Now);
        if (status.CanSell) return;

        throw new InvalidOperationException(status.BlockReason);
    }

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

    private static CaixaSessionDto ToDto(CaixaSessionAD source, DateTimeOffset now)
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
