/**
 * Arquivo: API/NETCORE/Repositories/DataAccess/CaixaSessionAD.cs
 * Objetivo: representa estrutura de dados de abertura, fechamento e status de caixa retornada pelo acesso ao banco.
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
    public string OperatorName { get; set; } = string.Empty;
    public string ClosedByName { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}
