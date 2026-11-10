/**
 * Arquivo: API/NETCORE/Models/Requests/CobrancaPagamentoRequest.cs
 * Objetivo: define contrato de entrada para emitir cobranças PIX ou boleto pelos gateways.
 * Entradas esperadas: valor em centavos e pagador (cliente cadastrado ou nome/documento avulsos).
 */
namespace HORUSPDV_API.Models.Requests;

public class CobrancaPagamentoRequest
{
    /// <summary>PIX ou BOLETO.</summary>
    public string Method { get; set; } = "PIX";
    public long AmountCents { get; set; }
    public string Description { get; set; } = string.Empty;
    /// <summary>Opcional: sem ele, usa o gateway padrão do método.</summary>
    public string GatewayId { get; set; } = string.Empty;
    /// <summary>Opcional: cliente cadastrado, de onde vêm documento, e-mail e endereço.</summary>
    public string CustomerId { get; set; } = string.Empty;
    public string PayerName { get; set; } = string.Empty;
    public string PayerDocument { get; set; } = string.Empty;
    public string PayerEmail { get; set; } = string.Empty;
    /// <summary>Boleto: dias até o vencimento. Sem valor, usa a regra do gateway (ou 3 dias).</summary>
    public int? DueDays { get; set; }
}
