namespace HORUSPDV_API.Models.Requests;

public class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
    public string RecaptchaToken { get; set; } = string.Empty;
}
