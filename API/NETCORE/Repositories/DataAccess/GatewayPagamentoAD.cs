/**
 * Arquivo: API/NETCORE/Repositories/DataAccess/GatewayPagamentoAD.cs
 * Objetivo: representa uma conta de gateway de pagamento (Asaas, Mercado Pago ou PagBank) da empresa.
 * Entradas esperadas: preenchido pelo repositório; credenciais chegam aqui já descriptografadas.
 */
namespace HORUSPDV_API.Repositories.DataAccess;

public class GatewayPagamentoAD
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Environment { get; set; } = "PRODUCTION";
    public bool Active { get; set; } = true;
    public bool DefaultPix { get; set; }
    public bool DefaultBoleto { get; set; }
    public bool PixOnly { get; set; }
    public bool GenerateBoletoPix { get; set; } = true;
    public string AccessToken { get; set; } = string.Empty;
    public string AccessTokenMask { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string WebhookSecretMask { get; set; } = string.Empty;
    public string WebhookResponsibleEmail { get; set; } = string.Empty;
    public int? BoletoDueDays { get; set; }
    public decimal? FinePercent { get; set; }
    public decimal? MonthlyInterestPercent { get; set; }
    public string Status { get; set; } = "PENDING";
    public DateTime? LastValidatedAt { get; set; }
    public string LastValidationMessage { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string WebhookProviderId { get; set; } = string.Empty;
    public DateTime? WebhookLastEventAt { get; set; }
}
