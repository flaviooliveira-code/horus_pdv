/**
 * Arquivo: API/NETCORE/Models/Response/CobrancaPagamentoResponse.cs
 * Objetivo: define o retorno de cobranças PIX/boleto para a frente de caixa e a tela de pagamentos.
 * Entradas esperadas: montado a partir da cobrança salva; não inclui dados internos do provedor.
 */
namespace HORUSPDV_API.Models.Response;

public class CobrancaPagamentoResponse
{
    public string Id { get; set; } = string.Empty;
    public string GatewayId { get; set; } = string.Empty;
    public string GatewayName { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public long AmountCents { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string ProviderStatus { get; set; } = string.Empty;
    public string PixCopyPaste { get; set; } = string.Empty;
    /// <summary>URL HTTPS ou PNG em Base64 do QR Code.</summary>
    public string PixQrCodeImage { get; set; } = string.Empty;
    public string BoletoUrl { get; set; } = string.Empty;
    public string BoletoLine { get; set; } = string.Empty;
    public string PayerName { get; set; } = string.Empty;
    public string PayerDocument { get; set; } = string.Empty;
    public string? SaleNumber { get; set; }
    public string? ExpiresAt { get; set; }
    public string? PaidAt { get; set; }
    public string LastError { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}
