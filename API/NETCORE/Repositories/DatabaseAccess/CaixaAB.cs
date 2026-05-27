/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/CaixaAB.cs
 * Objetivo: concentra comandos SQL e persistência de abertura, fechamento e status de caixa.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using HORUSPDV_API.Repositories.DataAccess;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class CaixaAB(Connection connection)
{
    public async Task<List<CaixaSessionAD>> ListarSessoesAsync(string companyId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            SELECT Id, OpenedAt, ClosedAt, OpeningAmount, ClosingAmount, OperatorName, ClosedByName, Note
            FROM CaixaSessoes
            WHERE CompanyId = @CompanyId
            ORDER BY OpenedAt DESC;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<CaixaSessionAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(Map(reader));
        }

        return rows;
    }

    public async Task<CaixaSessionAD?> ObterSessaoAbertaAsync(string companyId)
        => (await ListarSessoesAsync(companyId)).FirstOrDefault(item => item.ClosedAt is null);

    public async Task AbrirAsync(
        string id,
        string companyId,
        DateTimeOffset openedAt,
        string openingAmount,
        string operatorId,
        string operatorName)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            INSERT INTO CaixaSessoes
                (Id, CompanyId, OpenedAt, OpeningAmount, ClosingAmount, OperatorId, OperatorName, ClosedById, ClosedByName, Note)
            VALUES
                (@Id, @CompanyId, @OpenedAt, @OpeningAmount, N'0,00', @OperatorId, @OperatorName, N'', N'', N'');
            """,
            db);
        command.Parameters.AddWithValue("@Id", id);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@OpenedAt", openedAt);
        command.Parameters.AddWithValue("@OpeningAmount", openingAmount);
        command.Parameters.AddWithValue("@OperatorId", operatorId);
        command.Parameters.AddWithValue("@OperatorName", operatorName);
        await command.ExecuteNonQueryAsync();
    }

    public async Task FecharAsync(
        string id,
        string companyId,
        DateTimeOffset closedAt,
        string closingAmount,
        string closedById,
        string closedByName,
        string note)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            UPDATE CaixaSessoes
               SET ClosedAt = @ClosedAt,
                   ClosingAmount = @ClosingAmount,
                   ClosedById = @ClosedById,
                   ClosedByName = @ClosedByName,
                   Note = @Note
             WHERE Id = @Id AND CompanyId = @CompanyId;
            """,
            db);
        command.Parameters.AddWithValue("@ClosedAt", closedAt);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@ClosingAmount", closingAmount);
        command.Parameters.AddWithValue("@ClosedById", closedById);
        command.Parameters.AddWithValue("@ClosedByName", closedByName);
        command.Parameters.AddWithValue("@Note", note);
        command.Parameters.AddWithValue("@Id", id);
        await command.ExecuteNonQueryAsync();
    }

    private static CaixaSessionAD Map(SqlDataReader reader) => new()
    {
        Id = ReadString(reader, "Id"),
        OpenedAt = reader.GetDateTimeOffset(reader.GetOrdinal("OpenedAt")),
        ClosedAt = reader.IsDBNull(reader.GetOrdinal("ClosedAt"))
            ? null
            : reader.GetDateTimeOffset(reader.GetOrdinal("ClosedAt")),
        OpeningAmount = ReadString(reader, "OpeningAmount"),
        ClosingAmount = ReadString(reader, "ClosingAmount"),
        OperatorName = ReadString(reader, "OperatorName"),
        ClosedByName = ReadString(reader, "ClosedByName"),
        Note = ReadString(reader, "Note")
    };

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }
}
