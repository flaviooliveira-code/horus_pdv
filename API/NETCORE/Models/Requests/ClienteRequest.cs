/**
 * Arquivo: API/NETCORE/Models/Requests/ClienteRequest.cs
 * Objetivo: define contrato de entrada para operações de cadastro e manutenção de clientes.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class ClienteRequest
{
    public string CustomerName { get; set; } = string.Empty;
    public string Document { get; set; } = string.Empty;
    public string BirthDate { get; set; } = string.Empty;
    public string Age { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Neighborhood { get; set; } = string.Empty;
    public string StreetComplement { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string ReferencePoint { get; set; } = string.Empty;
    public string Telephone { get; set; } = string.Empty;
    public string Cellphone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
