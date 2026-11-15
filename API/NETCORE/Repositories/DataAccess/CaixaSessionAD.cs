/**
 * Arquivo: API/NETCORE/Repositories/DataAccess/CaixaSessionAD.cs
 * Objetivo: representa estrutura de dados de abertura, fechamento, movimentações e balanço de caixa retornada pelo acesso ao banco.
 * Entradas esperadas: recebe valores lidos do SQL Server e alimenta serviços/repositórios superiores.
 */
namespace HORUSPDV_API.Repositories.DataAccess;

public class CaixaSessionAD
{
    public string Id { get; set; } = string.Empty;
    public DateTimeOffset OpenedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public string OpeningAmount { get; set; } = "0,00";
    public string ClosingAmount { get; set; } = "0,00";
    public string ExpectedAmount { get; set; } = "0,00";
    public string DifferenceAmount { get; set; } = "0,00";
    public string DifferenceStatus { get; set; } = "CONFERIDO";
    public string TotalCashSales { get; set; } = "0,00";
    public string TotalSupplies { get; set; } = "0,00";
    public string TotalWithdrawals { get; set; } = "0,00";
    public string OperatorName { get; set; } = string.Empty;
    public string ClosedByName { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}

public class CaixaMovimentacaoAD
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string CaixaSessaoId { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string FormaPagamento { get; set; } = "Dinheiro";
    public string Valor { get; set; } = "0,00";
    public string Descricao { get; set; } = string.Empty;
    public string OperatorId { get; set; } = string.Empty;
    public string OperatorName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public class CaixaVendaResumoAD
{
    public string Id { get; set; } = string.Empty;
    public string SaleNumber { get; set; } = string.Empty;
    public string PaymentType { get; set; } = "Dinheiro";
    public string TotalAmount { get; set; } = "0,00";
    public string OperatorName { get; set; } = string.Empty;
    public DateTimeOffset SaleDate { get; set; }
}

