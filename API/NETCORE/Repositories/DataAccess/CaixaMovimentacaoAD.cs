/**
 * Arquivo: API/NETCORE/Repositories/DataAccess/CaixaMovimentacaoAD.cs
 * Objetivo: representa uma movimentação financeira vinculada a uma sessão de caixa (ABERTURA, SANGRIA, SUPRIMENTO, VENDA, DEVOLUCAO).
 * Entradas esperadas: recebe registros da tabela CaixaMovimentacoes ou novos lançamentos validados pelo serviço de caixa.
 */
namespace HORUSPDV_API.Repositories.DataAccess;

public class CaixaMovimentacaoAD
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string CaixaSessaoId { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string FormaPagamento { get; set; } = "dinheiro";
    public decimal Valor { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string? SaleNumber { get; set; }
    public string UsuarioId { get; set; } = string.Empty;
    public string UsuarioName { get; set; } = string.Empty;
    public DateTimeOffset DataHora { get; set; }
}
