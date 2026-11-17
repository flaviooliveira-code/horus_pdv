/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/ICaixaRepository.cs
 * Objetivo: define o contrato de persistência de sessões, movimentações e resumo de vendas do caixa para desacoplar serviço e testes.
 * Entradas esperadas: implementado por CaixaAB para SQL Server e por repositórios em memória nos testes automatizados.
 */
using HORUSPDV_API.Repositories.DataAccess;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public interface ICaixaRepository
{
    Task<List<CaixaSessionAD>> ListarSessoesAsync(string companyId);
    Task<CaixaSessionAD?> ObterSessaoPorIdAsync(string companyId, string sessionId);
    Task<CaixaSessionAD?> ObterSessaoAbertaAsync(string companyId);
    Task AbrirAsync(
        string id,
        string companyId,
        DateTimeOffset openedAt,
        string openingAmount,
        string operatorId,
        string operatorName,
        decimal openingAmountDecimal);
    Task RegistrarMovimentacaoAsync(CaixaMovimentacaoAD movimentacao);
    Task<List<CaixaMovimentacaoAD>> ListarMovimentacoesPorSessaoAsync(string companyId, string caixaSessaoId);
    Task<List<CaixaMovimentacaoAD>> ListarMovimentacoesPorSessoesAsync(string companyId, IReadOnlyCollection<string> sessionIds);
    Task<CaixaSalesSummaryAD> ObterResumoVendasPorSessaoAsync(string companyId, string caixaSessaoId);
    Task FecharAsync(
        string id,
        string companyId,
        DateTimeOffset closedAt,
        string closingAmount,
        string closedById,
        string closedByName,
        string note,
        CaixaSessionAuditAD audit);
}

public sealed class CaixaSalesSummaryAD
{
    public int SalesCount { get; set; }
    public decimal SalesCashTotal { get; set; }
    public decimal SalesPixTotal { get; set; }
    public decimal SalesDebitTotal { get; set; }
    public decimal SalesCreditTotal { get; set; }
}

public sealed class CaixaSessionAuditAD
{
    public decimal ExpectedCashAmount { get; set; }
    public decimal CountedCashAmount { get; set; }
    public decimal CashDifference { get; set; }
    public decimal SalesCashTotal { get; set; }
    public decimal SalesPixTotal { get; set; }
    public decimal SalesDebitTotal { get; set; }
    public decimal SalesCreditTotal { get; set; }
    public decimal TotalSuprimentos { get; set; }
    public decimal TotalSangrias { get; set; }
    public int SalesCount { get; set; }
    public bool BlindClosing { get; set; } = true;
}
