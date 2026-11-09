/**
 * Arquivo: API/NETCORE/Models/Requests/GatewayPagamentoRequest.cs
 * Objetivo: define contrato de entrada para cadastrar ou atualizar gateways de pagamento.
 * Entradas esperadas: recebe dados do drawer de gateways; credencial em branco mantém a já salva.
 */
namespace HORUSPDV_API.Models.Requests;

public class GatewayPagamentoRequest
{
    public string Provider { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Environment { get; set; } = "PRODUCTION";
    public bool Active { get; set; } = true;
    public bool DefaultPix { get; set; }
    public bool DefaultBoleto { get; set; }
    public bool PixOnly { get; set; }
    public bool GenerateBoletoPix { get; set; } = true;
    public string AccessToken { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string WebhookResponsibleEmail { get; set; } = string.Empty;
    public int? BoletoDueDays { get; set; }
    public decimal? FinePercent { get; set; }
    public decimal? MonthlyInterestPercent { get; set; }
}
