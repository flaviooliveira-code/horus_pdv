/**
 * Arquivo: API/NETCORE/Repositories/DataAccess/CobrancaPagamentoAD.cs
 * Objetivo: representa uma cobrança PIX ou boleto emitida por um gateway de pagamento.
 * Entradas esperadas: preenchido pelo repositório e pelos clientes dos provedores.
 */
namespace HORUSPDV_API.Repositories.DataAccess;

public class CobrancaPagamentoAD
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string GatewayId { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string Method { get; set; } = "PIX";
    public long AmountCents { get; set; }
    public string Description { get; set; } = string.Empty;
    /// <summary>PENDING, PAID, CANCELLED, EXPIRED ou FAILED.</summary>
    public string Status { get; set; } = "PENDING";
    public string ProviderStatus { get; set; } = string.Empty;
    public string ProviderChargeId { get; set; } = string.Empty;
    public string PixCopyPaste { get; set; } = string.Empty;
    /// <summary>Imagem do QR Code em Base64 (PNG), quando o provedor devolve.</summary>
    public string PixQrCodeImage { get; set; } = string.Empty;
    public string BoletoUrl { get; set; } = string.Empty;
    public string BoletoLine { get; set; } = string.Empty;
    public string PayerName { get; set; } = string.Empty;
    public string PayerDocument { get; set; } = string.Empty;
    public string PayerEmail { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string? SaleNumber { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public string LastError { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
