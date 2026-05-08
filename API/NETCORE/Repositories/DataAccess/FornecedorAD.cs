/**
 * Arquivo: API/NETCORE/Repositories/DataAccess/FornecedorAD.cs
 * Objetivo: representa estrutura de dados de cadastro e manutenção de fornecedores retornada pelo acesso ao banco.
 * Entradas esperadas: recebe valores lidos do SQL Server e alimenta serviços/repositórios superiores.
 */
namespace HORUSPDV_API.Repositories.DataAccess;

public class FornecedorAD
{
    public string Id { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string FantasyName { get; set; } = string.Empty;
    public string Cnpj { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Neighborhood { get; set; } = string.Empty;
    public string StreetComplement { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string ReferencePoint { get; set; } = string.Empty;
    public string Telephone { get; set; } = string.Empty;
    public string Cellphone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
