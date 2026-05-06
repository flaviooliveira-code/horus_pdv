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
