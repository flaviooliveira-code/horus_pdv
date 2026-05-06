namespace HORUSPDV_API.Models.Requests;

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NextPassword { get; set; } = string.Empty;
}
