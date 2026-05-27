/**
 * Arquivo: API/NETCORE/Repositories/DataAccess/ModuloMercadoRegistroAD.cs
 * Objetivo: representa estrutura de dados de módulos de gestão avançada do mercado retornada pelo acesso ao banco.
 * Entradas esperadas: recebe valores lidos do SQL Server e alimenta serviços/repositórios superiores.
 */
namespace HORUSPDV_API.Repositories.DataAccess;

public class ModuloMercadoRegistroAD
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = "empresa-principal";
    public string ModuleId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Meta { get; set; } = string.Empty;
}
