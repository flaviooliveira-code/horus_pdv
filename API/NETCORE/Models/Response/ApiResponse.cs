namespace HORUSPDV_API.Models.Response;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Details { get; set; }
    public T? Data { get; set; }
}
