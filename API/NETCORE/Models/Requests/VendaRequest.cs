/**
 * Arquivo: API/NETCORE/Models/Requests/VendaRequest.cs
 * Objetivo: define contrato de entrada para operações de registro de vendas e itens do carrinho.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class VendaRequest
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerCpf { get; set; } = string.Empty;
    public string PaymentType { get; set; } = string.Empty;
    public string TotalAmount { get; set; } = string.Empty;
    public string OperatorName { get; set; } = string.Empty;
    public List<VendaItemRequest> Items { get; set; } = [];
}

public class VendaItemRequest
{
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
}
