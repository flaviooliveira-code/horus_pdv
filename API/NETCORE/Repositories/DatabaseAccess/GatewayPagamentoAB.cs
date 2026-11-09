/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/GatewayPagamentoAB.cs
 * Objetivo: concentra comandos SQL dos gateways de pagamento, com credenciais criptografadas em repouso.
 * Entradas esperadas: recebe empresa da sessão e dados já validados pelo controller.
 */
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Services.Security;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class GatewayPagamentoAB(Connection connection, HorusSecretProtector secretProtector)
{
    private const string SelectColumns =
        """
        Id, CompanyId, Provider, Name, Environment, Active, DefaultPix, DefaultBoleto, PixOnly,
        GenerateBoletoPix, AccessToken, AccessTokenMask, PublicKey, WebhookSecret, WebhookSecretMask,
        WebhookResponsibleEmail, BoletoDueDays, FinePercent, MonthlyInterestPercent, Status,
        LastValidatedAt, LastValidationMessage, CreatedAt, UpdatedAt
        """;

    public async Task<List<GatewayPagamentoAD>> ListarAsync(string companyId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            $"""
            SELECT {SelectColumns}
            FROM GatewaysPagamento
            WHERE CompanyId = @CompanyId
            ORDER BY Active DESC, UpdatedAt DESC;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();

        var gateways = new List<GatewayPagamentoAD>();
        while (await reader.ReadAsync())
        {
            gateways.Add(Map(reader));
        }

        return gateways;
    }

    public async Task<GatewayPagamentoAD?> ObterAsync(string companyId, string id)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            $"""
            SELECT {SelectColumns}
            FROM GatewaysPagamento
            WHERE CompanyId = @CompanyId AND Id = @Id;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Id", id);
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    /// <summary>
    /// Insere ou atualiza o gateway e, na mesma transação, tira o padrão PIX/boleto
    /// dos outros gateways da empresa para manter um único padrão por modalidade.
    /// </summary>
    public async Task<GatewayPagamentoAD> SalvarAsync(GatewayPagamentoAD gateway, bool isNew)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var transaction = (SqlTransaction)await db.BeginTransactionAsync();

        var sql = isNew
            ? """
              INSERT INTO GatewaysPagamento
                  (Id, CompanyId, Provider, Name, Environment, Active, DefaultPix, DefaultBoleto, PixOnly,
                   GenerateBoletoPix, AccessToken, AccessTokenMask, PublicKey, WebhookSecret, WebhookSecretMask,
                   WebhookResponsibleEmail, BoletoDueDays, FinePercent, MonthlyInterestPercent, Status,
                   LastValidationMessage, CreatedAt, UpdatedAt)
              VALUES
                  (@Id, @CompanyId, @Provider, @Name, @Environment, @Active, @DefaultPix, @DefaultBoleto, @PixOnly,
                   @GenerateBoletoPix, @AccessToken, @AccessTokenMask, @PublicKey, @WebhookSecret, @WebhookSecretMask,
                   @WebhookResponsibleEmail, @BoletoDueDays, @FinePercent, @MonthlyInterestPercent, @Status,
                   @LastValidationMessage, SYSUTCDATETIME(), SYSUTCDATETIME());
              """
            : """
              UPDATE GatewaysPagamento
                 SET Provider = @Provider,
                     Name = @Name,
                     Environment = @Environment,
                     Active = @Active,
                     DefaultPix = @DefaultPix,
                     DefaultBoleto = @DefaultBoleto,
                     PixOnly = @PixOnly,
                     GenerateBoletoPix = @GenerateBoletoPix,
                     AccessToken = @AccessToken,
                     AccessTokenMask = @AccessTokenMask,
                     PublicKey = @PublicKey,
                     WebhookSecret = @WebhookSecret,
                     WebhookSecretMask = @WebhookSecretMask,
                     WebhookResponsibleEmail = @WebhookResponsibleEmail,
                     BoletoDueDays = @BoletoDueDays,
                     FinePercent = @FinePercent,
                     MonthlyInterestPercent = @MonthlyInterestPercent,
                     Status = @Status,
                     LastValidationMessage = @LastValidationMessage,
                     UpdatedAt = SYSUTCDATETIME()
               WHERE CompanyId = @CompanyId AND Id = @Id;
              """;

        await using (var command = new SqlCommand(sql, db, transaction))
        {
            AddParameters(command, gateway);
            await command.ExecuteNonQueryAsync();
        }

        await using (var command = new SqlCommand(
            """
            UPDATE GatewaysPagamento
               SET DefaultPix = CASE WHEN @DefaultPix = 1 THEN 0 ELSE DefaultPix END,
                   DefaultBoleto = CASE WHEN @DefaultBoleto = 1 THEN 0 ELSE DefaultBoleto END
             WHERE CompanyId = @CompanyId
               AND Id <> @Id
               AND ((@DefaultPix = 1 AND DefaultPix = 1) OR (@DefaultBoleto = 1 AND DefaultBoleto = 1));
            """,
            db,
            transaction))
        {
            command.Parameters.AddWithValue("@CompanyId", gateway.CompanyId);
            command.Parameters.AddWithValue("@Id", gateway.Id);
            command.Parameters.AddWithValue("@DefaultPix", gateway.DefaultPix);
            command.Parameters.AddWithValue("@DefaultBoleto", gateway.DefaultBoleto);
            await command.ExecuteNonQueryAsync();
        }

        await transaction.CommitAsync();
        return await ObterAsync(gateway.CompanyId, gateway.Id) ?? gateway;
    }

    public async Task<GatewayPagamentoAD?> RegistrarValidacaoAsync(
        string companyId,
        string id,
        string status,
        string message)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            UPDATE GatewaysPagamento
               SET Status = @Status,
                   LastValidationMessage = @Message,
                   LastValidatedAt = SYSUTCDATETIME()
             WHERE CompanyId = @CompanyId AND Id = @Id;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Id", id);
        command.Parameters.AddWithValue("@Status", status);
        command.Parameters.AddWithValue("@Message", Truncate(message, 500));
        await command.ExecuteNonQueryAsync();
        return await ObterAsync(companyId, id);
    }

    public async Task<bool> ExcluirAsync(string companyId, string id)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            "DELETE FROM GatewaysPagamento WHERE CompanyId = @CompanyId AND Id = @Id;",
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Id", id);
        return await command.ExecuteNonQueryAsync() > 0;
    }

    private void AddParameters(SqlCommand command, GatewayPagamentoAD source)
    {
        command.Parameters.AddWithValue("@Id", source.Id);
        command.Parameters.AddWithValue("@CompanyId", source.CompanyId);
        command.Parameters.AddWithValue("@Provider", source.Provider);
        command.Parameters.AddWithValue("@Name", Truncate(source.Name.Trim(), 120));
        command.Parameters.AddWithValue("@Environment", source.Environment);
        command.Parameters.AddWithValue("@Active", source.Active);
        command.Parameters.AddWithValue("@DefaultPix", source.DefaultPix);
        command.Parameters.AddWithValue("@DefaultBoleto", source.DefaultBoleto);
        command.Parameters.AddWithValue("@PixOnly", source.PixOnly);
        command.Parameters.AddWithValue("@GenerateBoletoPix", source.GenerateBoletoPix);
        command.Parameters.AddWithValue("@AccessToken", secretProtector.Protect(source.AccessToken));
        command.Parameters.AddWithValue("@AccessTokenMask", source.AccessTokenMask);
        command.Parameters.AddWithValue("@PublicKey", Truncate(source.PublicKey.Trim(), 200));
        command.Parameters.AddWithValue("@WebhookSecret", secretProtector.Protect(source.WebhookSecret));
        command.Parameters.AddWithValue("@WebhookSecretMask", source.WebhookSecretMask);
        command.Parameters.AddWithValue("@WebhookResponsibleEmail", Truncate(source.WebhookResponsibleEmail.Trim(), 180));
        command.Parameters.AddWithValue("@BoletoDueDays", (object?)source.BoletoDueDays ?? DBNull.Value);
        command.Parameters.AddWithValue("@FinePercent", (object?)source.FinePercent ?? DBNull.Value);
        command.Parameters.AddWithValue("@MonthlyInterestPercent", (object?)source.MonthlyInterestPercent ?? DBNull.Value);
        command.Parameters.AddWithValue("@Status", source.Status);
        command.Parameters.AddWithValue("@LastValidationMessage", Truncate(source.LastValidationMessage, 500));
    }

    private GatewayPagamentoAD Map(SqlDataReader source) => new()
    {
        Id = ReadString(source, "Id"),
        CompanyId = ReadString(source, "CompanyId"),
        Provider = ReadString(source, "Provider"),
        Name = ReadString(source, "Name"),
        Environment = ReadString(source, "Environment"),
        Active = ReadBool(source, "Active"),
        DefaultPix = ReadBool(source, "DefaultPix"),
        DefaultBoleto = ReadBool(source, "DefaultBoleto"),
        PixOnly = ReadBool(source, "PixOnly"),
        GenerateBoletoPix = ReadBool(source, "GenerateBoletoPix"),
        AccessToken = UnprotectSecret(ReadString(source, "AccessToken")),
        AccessTokenMask = ReadString(source, "AccessTokenMask"),
        PublicKey = ReadString(source, "PublicKey"),
        WebhookSecret = UnprotectSecret(ReadString(source, "WebhookSecret")),
        WebhookSecretMask = ReadString(source, "WebhookSecretMask"),
        WebhookResponsibleEmail = ReadString(source, "WebhookResponsibleEmail"),
        BoletoDueDays = ReadNullableInt(source, "BoletoDueDays"),
        FinePercent = ReadNullableDecimal(source, "FinePercent"),
        MonthlyInterestPercent = ReadNullableDecimal(source, "MonthlyInterestPercent"),
        Status = ReadString(source, "Status"),
        LastValidatedAt = ReadNullableDate(source, "LastValidatedAt"),
        LastValidationMessage = ReadString(source, "LastValidationMessage"),
        CreatedAt = ReadNullableDate(source, "CreatedAt") ?? DateTime.UtcNow,
        UpdatedAt = ReadNullableDate(source, "UpdatedAt") ?? DateTime.UtcNow
    };

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength];

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private static bool ReadBool(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return !reader.IsDBNull(ordinal) && reader.GetBoolean(ordinal);
    }

    private static int? ReadNullableInt(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetInt32(ordinal);
    }

    private static decimal? ReadNullableDecimal(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetDecimal(ordinal);
    }

    private static DateTime? ReadNullableDate(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal)
            ? null
            : DateTime.SpecifyKind(reader.GetDateTime(ordinal), DateTimeKind.Utc);
    }

    private string UnprotectSecret(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        try
        {
            return secretProtector.Unprotect(value);
        }
        catch
        {
            return string.Empty;
        }
    }
}
