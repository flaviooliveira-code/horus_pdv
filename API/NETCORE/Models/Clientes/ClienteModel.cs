/**
 * Arquivo: API/NETCORE/Models/Clientes/ClienteModel.cs
 * Objetivo: representa dados de cadastro e manutenção de clientes trafegados entre banco, serviços e API.
 * Entradas esperadas: recebe valores persistidos ou calculados para serialização nas respostas.
 */
namespace HORUSPDV_API.Models.Clientes;

public class ClienteModel
{
    public string Id { get; set; } = string.Empty;
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
