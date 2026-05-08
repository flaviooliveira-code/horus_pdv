/**
 * Arquivo: API/NETCORE/Models/Requests/ModuloMercadoRegistroRequest.cs
 * Objetivo: define contrato de entrada para operações de módulos de gestão avançada do mercado.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class ModuloMercadoRegistroRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Meta { get; set; } = string.Empty;
}
