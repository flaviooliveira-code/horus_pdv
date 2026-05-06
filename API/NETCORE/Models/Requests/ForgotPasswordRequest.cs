namespace HORUSPDV_API.Models.Requests;

public class ForgotPasswordRequest
{
    public string Cnpj { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string RecaptchaToken { get; set; } = string.Empty;
}
