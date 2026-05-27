/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/ModuloMercadoAB.cs
 * Objetivo: concentra comandos SQL e persistência de módulos de gestão avançada do mercado.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using HORUSPDV_API.Repositories.DataAccess;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class ModuloMercadoAB(Connection connection)
{
    public async Task<bool> ExisteAsync(string id)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand("SELECT COUNT(1) FROM ModulosMercado WHERE Id = @Id;", db);
        command.Parameters.AddWithValue("@Id", id);
        return Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
    }

    public async Task GarantirModuloAsync(string id, string title)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            IF NOT EXISTS (SELECT 1 FROM ModulosMercado WHERE Id = @Id)
            BEGIN
                INSERT INTO ModulosMercado (Id, Title)
                VALUES (@Id, @Title);
            END;
            """,
            db);
        command.Parameters.AddWithValue("@Id", id);
        command.Parameters.AddWithValue("@Title", title);
        await command.ExecuteNonQueryAsync();
    }

    public async Task<List<ModuloMercadoRegistroAD>> ListarRegistrosAsync(string companyId, string id)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            SELECT Id, CompanyId, ModuleId, Title, Description, Status, Amount, Meta
            FROM ModuloMercadoRegistros
            WHERE CompanyId = @CompanyId AND ModuleId = @ModuleId
            ORDER BY Id;
            """,
            db);
        command.Parameters.AddWithValue("@ModuleId", id);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<ModuloMercadoRegistroAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(Map(reader));
        }

        return rows;
    }

    public async Task CriarRegistroAsync(ModuloMercadoRegistroAD registro)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            INSERT INTO ModuloMercadoRegistros (Id, CompanyId, ModuleId, Title, Description, Status, Amount, Meta)
            VALUES (@Id, @CompanyId, @ModuleId, @Title, @Description, @Status, @Amount, @Meta);
            """,
            db);
        AddParameters(command, registro);
        await command.ExecuteNonQueryAsync();
    }

    public async Task<bool> AtualizarRegistroAsync(ModuloMercadoRegistroAD registro)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            UPDATE ModuloMercadoRegistros
               SET Title = @Title,
                   Description = @Description,
                   Status = @Status,
                   Amount = @Amount,
                   Meta = @Meta
             WHERE CompanyId = @CompanyId AND ModuleId = @ModuleId AND Id = @Id;
            """,
            db);
        AddParameters(command, registro);
        return await command.ExecuteNonQueryAsync() > 0;
    }

    public async Task<bool> ExcluirRegistroAsync(string companyId, string moduleId, string recordId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            "DELETE FROM ModuloMercadoRegistros WHERE CompanyId = @CompanyId AND ModuleId = @ModuleId AND Id = @Id;",
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@ModuleId", moduleId);
        command.Parameters.AddWithValue("@Id", recordId);
        return await command.ExecuteNonQueryAsync() > 0;
    }

    private static void AddParameters(SqlCommand command, ModuloMercadoRegistroAD registro)
    {
        command.Parameters.AddWithValue("@Id", registro.Id);
        command.Parameters.AddWithValue("@CompanyId", registro.CompanyId);
        command.Parameters.AddWithValue("@ModuleId", registro.ModuleId);
        command.Parameters.AddWithValue("@Title", registro.Title);
        command.Parameters.AddWithValue("@Description", registro.Description);
        command.Parameters.AddWithValue("@Status", registro.Status);
        command.Parameters.AddWithValue("@Amount", registro.Amount);
        command.Parameters.AddWithValue("@Meta", registro.Meta);
    }

    private static ModuloMercadoRegistroAD Map(SqlDataReader reader) => new()
    {
        Id = ReadString(reader, "Id"),
        CompanyId = ReadString(reader, "CompanyId"),
        ModuleId = ReadString(reader, "ModuleId"),
        Title = ReadString(reader, "Title"),
        Description = ReadString(reader, "Description"),
        Status = ReadString(reader, "Status"),
        Amount = ReadString(reader, "Amount"),
        Meta = ReadString(reader, "Meta")
    };

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }
}
