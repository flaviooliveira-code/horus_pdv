/**
 * Arquivo: API/NETCORE/Models/ModuloMercado/ModuloMercadoRegistroModel.cs
 * Objetivo: representa dados de módulos de gestão avançada do mercado trafegados entre banco, serviços e API.
 * Entradas esperadas: recebe valores persistidos ou calculados para serialização nas respostas.
 */
namespace HORUSPDV_API.Models.ModuloMercado;

public class ModuloMercadoRegistroModel
{
    public string Id { get; set; } = string.Empty;
    public string ModuleId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Meta { get; set; } = string.Empty;
}
