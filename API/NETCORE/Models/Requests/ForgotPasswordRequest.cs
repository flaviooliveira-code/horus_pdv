/**
 * Arquivo: API/NETCORE/Models/Requests/ForgotPasswordRequest.cs
 * Objetivo: define contrato de entrada para operações de forgot password.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class ForgotPasswordRequest
{
    public string Cnpj { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string RecaptchaToken { get; set; } = string.Empty;
}
