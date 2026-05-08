/**
 * Arquivo: API/NETCORE/Models/Requests/EmpresaRequest.cs
 * Objetivo: define contrato de entrada para operações de dados cadastrais e configurações da empresa.
 * Entradas esperadas: recebe dados serializados do frontend nas ações da API.
 */
namespace HORUSPDV_API.Models.Requests;

public class EmpresaRequest
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
    public bool EmailSmtpHasPassword { get; set; }
    public string EmailSmtpFromEmail { get; set; } = string.Empty;
    public string EmailSmtpFromName { get; set; } = string.Empty;
    public string EmailSmtpReplyTo { get; set; } = string.Empty;
}
