namespace HORUSPDV_API.Models.Requests;

public class ProdutoRequest
{
    public string ProductImageUrl { get; set; } = string.Empty;
    public string ProductImageName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductSupplier { get; set; } = string.Empty;
    public string ProductDescription { get; set; } = string.Empty;
    public string ProductQnt { get; set; } = string.Empty;
    public string ProductUnitPrice { get; set; } = string.Empty;
    public string ProductSalePrice { get; set; } = string.Empty;
    public string TotalPriceOnProduct { get; set; } = string.Empty;
}
