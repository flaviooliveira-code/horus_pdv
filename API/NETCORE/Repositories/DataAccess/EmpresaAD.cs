/**
 * Arquivo: API/NETCORE/Repositories/DataAccess/EmpresaAD.cs
 * Objetivo: representa estrutura de dados de dados cadastrais e configurações da empresa retornada pelo acesso ao banco.
 * Entradas esperadas: recebe valores lidos do SQL Server e alimenta serviços/repositórios superiores.
 */
namespace HORUSPDV_API.Repositories.DataAccess;

public class EmpresaAD
{
    public string FantasyName { get; set; } = string.Empty;
    public string CorporateName { get; set; } = string.Empty;
    public string Cnpj { get; set; } = string.Empty;
    public string StateRegistration { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string SacPhone { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string Neighborhood { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Uf { get; set; } = string.Empty;
    public string Complement { get; set; } = string.Empty;
    public bool EmailSmtpEnabled { get; set; }
    public string EmailSmtpHost { get; set; } = string.Empty;
    public int EmailSmtpPort { get; set; } = 587;
    public bool EmailSmtpEnableSsl { get; set; } = true;
    public string EmailSmtpUser { get; set; } = string.Empty;
    public string EmailSmtpPassword { get; set; } = string.Empty;
    public string EmailSmtpFromEmail { get; set; } = string.Empty;
    public string EmailSmtpFromName { get; set; } = string.Empty;
    public string EmailSmtpReplyTo { get; set; } = string.Empty;
}
