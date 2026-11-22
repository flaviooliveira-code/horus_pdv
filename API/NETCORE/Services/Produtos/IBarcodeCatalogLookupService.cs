/**
 * Arquivo: API/NETCORE/Services/Produtos/IBarcodeCatalogLookupService.cs
 * Objetivo: contrato do serviço de busca automática de dados e imagem de produtos a partir de códigos de barras.
 * Entradas esperadas: recebe código EAN/GTIN/UPC e token de cancelamento; retorna resultado normalizado sem lançar erro por ausência.
 */
using HORUSPDV_API.Models.Produtos;

namespace HORUSPDV_API.Services.Produtos;

public interface IBarcodeCatalogLookupService
{
    Task<BarcodeLookupResponse> LookupAsync(string barcode, CancellationToken cancellationToken = default);
}
