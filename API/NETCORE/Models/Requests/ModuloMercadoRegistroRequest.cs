namespace HORUSPDV_API.Models.Requests;

public class ModuloMercadoRegistroRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Meta { get; set; } = string.Empty;
}
