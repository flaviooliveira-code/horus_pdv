/**
 * Arquivo: API/NETCORE/Models/Produtos/BarcodeLookupResponse.cs
 * Objetivo: representa dados e imagem obtidos em bases públicas a partir de um código de barras (EAN/GTIN/UPC).
 * Entradas esperadas: preenchido pelo serviço de consulta de catálogo por código de barras para pré-preencher o cadastro.
 */
namespace HORUSPDV_API.Models.Produtos;

public sealed class BarcodeLookupResponse
{
    public string Barcode { get; set; } = string.Empty;
    public bool Found { get; set; }
    public string Source { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string ProductCategory { get; set; } = string.Empty;
    public string ProductDescription { get; set; } = string.Empty;
    public string ProductImageUrl { get; set; } = string.Empty;
    public string SuggestedUnitType { get; set; } = "UN";
    public decimal? SuggestedSalePrice { get; set; }
}
