/**
 * Arquivo: API/NETCORE/Models/Requests/UsuarioRequest.cs
 * Objetivo: define contrato de entrada para operações de contas de usuários e permissões.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class UsuarioRequest
{
    public string CompanyId { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
