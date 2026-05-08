/**
 * Arquivo: API/NETCORE/Models/Requests/ResetPasswordWithTokenRequest.cs
 * Objetivo: define contrato de entrada para operações de reset password with token.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class ResetPasswordWithTokenRequest
{
    public string Token { get; set; } = string.Empty;
    public string NextPassword { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
    public string RecaptchaToken { get; set; } = string.Empty;
}
