namespace HORUSPDV_API.Models.Requests;

public class ResetPasswordWithTokenRequest
{
    public string Token { get; set; } = string.Empty;
    public string NextPassword { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
    public string RecaptchaToken { get; set; } = string.Empty;
}
