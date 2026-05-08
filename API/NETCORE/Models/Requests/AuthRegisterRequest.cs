/**
 * Arquivo: API/NETCORE/Models/Requests/AuthRegisterRequest.cs
 * Objetivo: define contrato de entrada para operações de autenticação, cadastro, recuperação de senha e sessões.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class AuthRegisterRequest
{
    public string Cnpj { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
    public string RecaptchaToken { get; set; } = string.Empty;
}
