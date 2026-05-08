/**
 * Arquivo: API/NETCORE/Models/Requests/ChangePasswordRequest.cs
 * Objetivo: define contrato de entrada para operações de change password.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NextPassword { get; set; } = string.Empty;
}
