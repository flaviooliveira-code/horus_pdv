/**
 * Arquivo: API/NETCORE/Models/Response/GatewayPagamentoResponse.cs
 * Objetivo: define o retorno de gateways de pagamento sem expor credenciais em texto puro.
 * Entradas esperadas: montado pelo controller a partir do registro salvo; segredos saem apenas mascarados.
 */
namespace HORUSPDV_API.Models.Response;

public class GatewayPagamentoResponse
{
    public string Id { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Environment { get; set; } = "PRODUCTION";
    public bool Active { get; set; }
    public bool DefaultPix { get; set; }
    public bool DefaultBoleto { get; set; }
    public bool PixOnly { get; set; }
    public bool GenerateBoletoPix { get; set; }
    public string AccessTokenMask { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public string WebhookSecretMask { get; set; } = string.Empty;
    public string WebhookResponsibleEmail { get; set; } = string.Empty;
    public int? BoletoDueDays { get; set; }
    public decimal? FinePercent { get; set; }
    public decimal? MonthlyInterestPercent { get; set; }
    public string Status { get; set; } = "PENDING";
    public string? LastValidatedAt { get; set; }
    public string LastValidationMessage { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public string? WebhookLastEventAt { get; set; }
}
