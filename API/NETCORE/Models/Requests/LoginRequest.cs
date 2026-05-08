/**
 * Arquivo: API/NETCORE/Models/Requests/LoginRequest.cs
 * Objetivo: define contrato de entrada para operações de login.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool RememberMe { get; set; }
    public string RecaptchaToken { get; set; } = string.Empty;
}
