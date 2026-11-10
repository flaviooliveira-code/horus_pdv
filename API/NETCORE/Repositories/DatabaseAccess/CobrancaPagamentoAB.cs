/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/CobrancaPagamentoAB.cs
 * Objetivo: concentra comandos SQL das cobranças PIX/boleto emitidas pelos gateways.
 * Entradas esperadas: recebe empresa da sessão (ou gateway, no webhook) e dados vindos dos provedores.
 */
using HORUSPDV_API.Repositories.DataAccess;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class CobrancaPagamentoAB(Connection connection)
{
    private const string SelectColumns =
        """
        Id, CompanyId, GatewayId, Provider, Method, AmountCents, Description, Status, ProviderStatus,
        ProviderChargeId, PixCopyPaste, PixQrCodeImage, BoletoUrl, BoletoLine, PayerName, PayerDocument,
        PayerEmail, CustomerId, SaleNumber, ExpiresAt, PaidAt, LastError, CreatedBy, CreatedAt, UpdatedAt
        """;

    public async Task<List<CobrancaPagamentoAD>> ListarAsync(string companyId, int limit = 200)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            $"""
            SELECT TOP (@Limit) {SelectColumns}
            FROM CobrancasPagamento
            WHERE CompanyId = @CompanyId
            ORDER BY CreatedAt DESC;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Limit", Math.Clamp(limit, 1, 500));
        return await ReadAllAsync(command);
    }

    public async Task<CobrancaPagamentoAD?> ObterAsync(string companyId, string id)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            $"SELECT {SelectColumns} FROM CobrancasPagamento WHERE CompanyId = @CompanyId AND Id = @Id;",
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Id", id);
        return (await ReadAllAsync(command)).FirstOrDefault();
    }

    /// <summary>Usado pelo webhook: localiza a cobrança pelo id do provedor dentro do gateway notificado.</summary>
    public async Task<CobrancaPagamentoAD?> ObterPorProvedorAsync(string gatewayId, string providerChargeId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            $"""
            SELECT TOP 1 {SelectColumns}
            FROM CobrancasPagamento
            WHERE GatewayId = @GatewayId AND ProviderChargeId = @ProviderChargeId;
            """,
            db);
        command.Parameters.AddWithValue("@GatewayId", gatewayId);
        command.Parameters.AddWithValue("@ProviderChargeId", providerChargeId);
        return (await ReadAllAsync(command)).FirstOrDefault();
    }

    /// <summary>Usado pelo webhook: localiza a cobrança pelo id interno enviado como referência externa.</summary>
    public async Task<CobrancaPagamentoAD?> ObterPorIdNoGatewayAsync(string gatewayId, string id)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            $"SELECT {SelectColumns} FROM CobrancasPagamento WHERE GatewayId = @GatewayId AND Id = @Id;",
            db);
        command.Parameters.AddWithValue("@GatewayId", gatewayId);
        command.Parameters.AddWithValue("@Id", id);
        return (await ReadAllAsync(command)).FirstOrDefault();
    }

    public async Task InserirAsync(CobrancaPagamentoAD charge)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            INSERT INTO CobrancasPagamento
                (Id, CompanyId, GatewayId, Provider, Method, AmountCents, Description, Status, ProviderStatus,
                 ProviderChargeId, PixCopyPaste, PixQrCodeImage, BoletoUrl, BoletoLine, PayerName, PayerDocument,
                 PayerEmail, CustomerId, ExpiresAt, LastError, CreatedBy, CreatedAt, UpdatedAt)
            VALUES
                (@Id, @CompanyId, @GatewayId, @Provider, @Method, @AmountCents, @Description, @Status, @ProviderStatus,
                 @ProviderChargeId, @PixCopyPaste, @PixQrCodeImage, @BoletoUrl, @BoletoLine, @PayerName, @PayerDocument,
                 @PayerEmail, @CustomerId, @ExpiresAt, @LastError, @CreatedBy, SYSUTCDATETIME(), SYSUTCDATETIME());
            """,
            db);
        command.Parameters.AddWithValue("@Id", charge.Id);
        command.Parameters.AddWithValue("@CompanyId", charge.CompanyId);
        command.Parameters.AddWithValue("@GatewayId", charge.GatewayId);
        command.Parameters.AddWithValue("@Provider", charge.Provider);
        command.Parameters.AddWithValue("@Method", charge.Method);
        command.Parameters.AddWithValue("@AmountCents", charge.AmountCents);
        command.Parameters.AddWithValue("@Description", Truncate(charge.Description, 200));
        command.Parameters.AddWithValue("@PayerName", Truncate(charge.PayerName, 180));
        command.Parameters.AddWithValue("@PayerDocument", Truncate(charge.PayerDocument, 20));
        command.Parameters.AddWithValue("@PayerEmail", Truncate(charge.PayerEmail, 180));
        command.Parameters.AddWithValue("@CustomerId", Truncate(charge.CustomerId, 40));
        command.Parameters.AddWithValue("@CreatedBy", Truncate(charge.CreatedBy, 180));
        AddProviderParameters(command, charge);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>
    /// Grava o retorno do provedor. Uma cobrança já paga nunca volta para outro status,
    /// mesmo que uma consulta atrasada chegue depois da confirmação.
    /// </summary>
    public async Task AtualizarDoProvedorAsync(CobrancaPagamentoAD charge)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            UPDATE CobrancasPagamento
               SET Status = CASE WHEN Status = N'PAID' THEN Status ELSE @Status END,
                   ProviderStatus = @ProviderStatus,
                   ProviderChargeId = CASE WHEN @ProviderChargeId = N'' THEN ProviderChargeId ELSE @ProviderChargeId END,
                   PixCopyPaste = CASE WHEN @PixCopyPaste = N'' THEN PixCopyPaste ELSE @PixCopyPaste END,
                   PixQrCodeImage = CASE WHEN @PixQrCodeImage = N'' THEN PixQrCodeImage ELSE @PixQrCodeImage END,
                   BoletoUrl = CASE WHEN @BoletoUrl = N'' THEN BoletoUrl ELSE @BoletoUrl END,
                   BoletoLine = CASE WHEN @BoletoLine = N'' THEN BoletoLine ELSE @BoletoLine END,
                   ExpiresAt = COALESCE(@ExpiresAt, ExpiresAt),
                   PaidAt = COALESCE(PaidAt, CASE WHEN @Status = N'PAID' THEN COALESCE(@PaidAt, SYSUTCDATETIME()) END),
                   LastError = @LastError,
                   UpdatedAt = SYSUTCDATETIME()
             WHERE Id = @Id;
            """,
            db);
        command.Parameters.AddWithValue("@Id", charge.Id);
        command.Parameters.AddWithValue("@PaidAt", (object?)charge.PaidAt ?? DBNull.Value);
        AddProviderParameters(command, charge);
        await command.ExecuteNonQueryAsync();
    }

    private static void AddProviderParameters(SqlCommand command, CobrancaPagamentoAD charge)
    {
        command.Parameters.AddWithValue("@Status", charge.Status);
        command.Parameters.AddWithValue("@ProviderStatus", Truncate(charge.ProviderStatus, 60));
        command.Parameters.AddWithValue("@ProviderChargeId", Truncate(charge.ProviderChargeId, 100));
        command.Parameters.AddWithValue("@PixCopyPaste", charge.PixCopyPaste);
        command.Parameters.AddWithValue("@PixQrCodeImage", charge.PixQrCodeImage);
        command.Parameters.AddWithValue("@BoletoUrl", Truncate(charge.BoletoUrl, 500));
        command.Parameters.AddWithValue("@BoletoLine", Truncate(charge.BoletoLine, 120));
        command.Parameters.AddWithValue("@ExpiresAt", (object?)charge.ExpiresAt ?? DBNull.Value);
        command.Parameters.AddWithValue("@LastError", Truncate(charge.LastError, 500));
    }

    private static async Task<List<CobrancaPagamentoAD>> ReadAllAsync(SqlCommand command)
    {
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<CobrancaPagamentoAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(new CobrancaPagamentoAD
            {
                Id = ReadString(reader, "Id"),
                CompanyId = ReadString(reader, "CompanyId"),
                GatewayId = ReadString(reader, "GatewayId"),
                Provider = ReadString(reader, "Provider"),
                Method = ReadString(reader, "Method"),
                AmountCents = reader.GetInt64(reader.GetOrdinal("AmountCents")),
                Description = ReadString(reader, "Description"),
                Status = ReadString(reader, "Status"),
                ProviderStatus = ReadString(reader, "ProviderStatus"),
                ProviderChargeId = ReadString(reader, "ProviderChargeId"),
                PixCopyPaste = ReadString(reader, "PixCopyPaste"),
                PixQrCodeImage = ReadString(reader, "PixQrCodeImage"),
                BoletoUrl = ReadString(reader, "BoletoUrl"),
                BoletoLine = ReadString(reader, "BoletoLine"),
                PayerName = ReadString(reader, "PayerName"),
                PayerDocument = ReadString(reader, "PayerDocument"),
                PayerEmail = ReadString(reader, "PayerEmail"),
                CustomerId = ReadString(reader, "CustomerId"),
                SaleNumber = reader.IsDBNull(reader.GetOrdinal("SaleNumber")) ? null : ReadString(reader, "SaleNumber"),
                ExpiresAt = ReadDate(reader, "ExpiresAt"),
                PaidAt = ReadDate(reader, "PaidAt"),
                LastError = ReadString(reader, "LastError"),
                CreatedBy = ReadString(reader, "CreatedBy"),
                CreatedAt = ReadDate(reader, "CreatedAt") ?? DateTime.UtcNow,
                UpdatedAt = ReadDate(reader, "UpdatedAt") ?? DateTime.UtcNow
            });
        }

        return rows;
    }

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength];

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private static DateTime? ReadDate(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : DateTime.SpecifyKind(reader.GetDateTime(ordinal), DateTimeKind.Utc);
    }
}
