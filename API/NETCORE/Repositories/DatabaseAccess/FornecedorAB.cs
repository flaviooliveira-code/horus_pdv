/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/FornecedorAB.cs
 * Objetivo: concentra comandos SQL e persistência de cadastro e manutenção de fornecedores.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using HORUSPDV_API.Repositories.DataAccess;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class FornecedorAB(Connection connection)
{
    public async Task<List<FornecedorAD>> ListarAsync(string companyId)
    {
        const string sql = """
            SELECT Id, CompanyName, FantasyName, Cnpj, Cep, City, State, Address, Neighborhood,
                   StreetComplement, Number, ReferencePoint, Telephone, Cellphone, Email
            FROM Fornecedores
            WHERE CompanyId = @CompanyId
            ORDER BY FantasyName;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<FornecedorAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(Map(reader));
        }

        return rows;
    }

    public async Task<FornecedorAD?> ObterAsync(string companyId, string id)
    {
        const string sql = """
            SELECT Id, CompanyName, FantasyName, Cnpj, Cep, City, State, Address, Neighborhood,
                   StreetComplement, Number, ReferencePoint, Telephone, Cellphone, Email
            FROM Fornecedores
            WHERE Id = @Id AND CompanyId = @CompanyId;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Id", id);
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task<FornecedorAD> SalvarAsync(string companyId, FornecedorAD supplier)
    {
        const string sql = """
            IF EXISTS (SELECT 1 FROM Fornecedores WHERE Id = @Id AND CompanyId = @CompanyId)
            BEGIN
                UPDATE Fornecedores
                   SET CompanyName = @CompanyName,
                       FantasyName = @FantasyName,
                       Cnpj = @Cnpj,
                       Cep = @Cep,
                       City = @City,
                       State = @State,
                       Address = @Address,
                       Neighborhood = @Neighborhood,
                       StreetComplement = @StreetComplement,
                       Number = @Number,
                       ReferencePoint = @ReferencePoint,
                       Telephone = @Telephone,
                       Cellphone = @Cellphone,
                       Email = @Email
                 WHERE Id = @Id AND CompanyId = @CompanyId;
            END
            ELSE
            BEGIN
                INSERT INTO Fornecedores
                    (Id, CompanyId, CompanyName, FantasyName, Cnpj, Cep, City, State, Address, Neighborhood,
                     StreetComplement, Number, ReferencePoint, Telephone, Cellphone, Email)
                VALUES
                    (@Id, @CompanyId, @CompanyName, @FantasyName, @Cnpj, @Cep, @City, @State, @Address, @Neighborhood,
                     @StreetComplement, @Number, @ReferencePoint, @Telephone, @Cellphone, @Email);
            END;
            """;

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql, db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        AddParameters(command, supplier);
        await command.ExecuteNonQueryAsync();
        return supplier;
    }

    public async Task<bool> ExcluirAsync(string companyId, string id)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand("DELETE FROM Fornecedores WHERE Id = @Id AND CompanyId = @CompanyId;", db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Id", id);
        return await command.ExecuteNonQueryAsync() > 0;
    }

    private static void AddParameters(SqlCommand command, FornecedorAD supplier)
    {
        command.Parameters.AddWithValue("@Id", supplier.Id);
        command.Parameters.AddWithValue("@CompanyName", supplier.CompanyName);
        command.Parameters.AddWithValue("@FantasyName", supplier.FantasyName);
        command.Parameters.AddWithValue("@Cnpj", supplier.Cnpj);
        command.Parameters.AddWithValue("@Cep", supplier.Cep);
        command.Parameters.AddWithValue("@City", supplier.City);
        command.Parameters.AddWithValue("@State", supplier.State);
        command.Parameters.AddWithValue("@Address", supplier.Address);
        command.Parameters.AddWithValue("@Neighborhood", supplier.Neighborhood);
        command.Parameters.AddWithValue("@StreetComplement", supplier.StreetComplement);
        command.Parameters.AddWithValue("@Number", supplier.Number);
        command.Parameters.AddWithValue("@ReferencePoint", supplier.ReferencePoint);
        command.Parameters.AddWithValue("@Telephone", supplier.Telephone);
        command.Parameters.AddWithValue("@Cellphone", supplier.Cellphone);
        command.Parameters.AddWithValue("@Email", supplier.Email);
    }

    private static FornecedorAD Map(SqlDataReader source) => new()
    {
        Id = ReadString(source, "Id"),
        CompanyName = ReadString(source, "CompanyName"),
        FantasyName = ReadString(source, "FantasyName"),
        Cnpj = ReadString(source, "Cnpj"),
        Cep = ReadString(source, "Cep"),
        City = ReadString(source, "City"),
        State = ReadString(source, "State"),
        Address = ReadString(source, "Address"),
        Neighborhood = ReadString(source, "Neighborhood"),
        StreetComplement = ReadString(source, "StreetComplement"),
        Number = ReadString(source, "Number"),
        ReferencePoint = ReadString(source, "ReferencePoint"),
        Telephone = ReadString(source, "Telephone"),
        Cellphone = ReadString(source, "Cellphone"),
        Email = ReadString(source, "Email")
    };

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }
}
