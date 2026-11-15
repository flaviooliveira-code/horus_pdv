/**
 * Arquivo: API/NETCORE/Models/Requests/CaixaRequest.cs
 * Objetivo: define contrato de entrada para operações de abertura, fechamento, sangria, suprimento e status de caixa.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class AbrirCaixaRequest
{
    public string OpeningAmount { get; set; } = "0,00";
}

public class FecharCaixaRequest
{
    public string ClosingAmount { get; set; } = "0,00";
    public string Note { get; set; } = "";
}

public class CaixaMovimentacaoRequest
{
    public string Tipo { get; set; } = ""; // SANGRIA | SUPRIMENTO
    public string Valor { get; set; } = "0,00";
    public string Descricao { get; set; } = "";
    public string FormaPagamento { get; set; } = "Dinheiro";
}

public class SangriaCaixaRequest
{
    public string Amount { get; set; } = "0,00";
    public string Reason { get; set; } = "";
}

public class SuprimentoCaixaRequest
{
    public string Amount { get; set; } = "0,00";
    public string Reason { get; set; } = "";
}

