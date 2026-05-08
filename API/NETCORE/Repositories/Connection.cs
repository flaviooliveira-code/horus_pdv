/**
 * Arquivo: API/NETCORE/Repositories/Connection.cs
 * Objetivo: centraliza a criação de conexões SQL Server usadas pelos repositórios da API.
 * Entradas esperadas: espera configuração de connection string válida para abrir conexões com o banco.
 */
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories;

public sealed class Connection(IConfiguration configuration)
{
    private const string DefaultConnectionString =
        "Server=localhost,1433;Database=HorusPdv;User Id=sa;Password=Senha@12345;TrustServerCertificate=True;Encrypt=True;MultipleActiveResultSets=True;Pooling=True;Min Pool Size=5;Max Pool Size=100;Connection Timeout=30;";

    public string ConnectionString { get; } = ResolveConnectionString(configuration);

    public async Task<SqlConnection> OpenConnectionAsync(
        CancellationToken cancellationToken = default,
        string? database = null)
    {
        var connectionString = string.IsNullOrWhiteSpace(database)
            ? ConnectionString
            : BuildConnectionString(database);
        var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    public SqlConnection OpenConnection(string? database = null)
    {
        var connectionString = string.IsNullOrWhiteSpace(database)
            ? ConnectionString
            : BuildConnectionString(database);
        var connection = new SqlConnection(connectionString);
        connection.Open();
        return connection;
    }

    private string BuildConnectionString(string database)
    {
        var builder = new SqlConnectionStringBuilder(ConnectionString)
        {
            InitialCatalog = database
        };
        return builder.ConnectionString;
    }

    private static string ResolveConnectionString(IConfiguration configuration)
        => configuration.GetConnectionString("HorusPdv")
           ?? configuration.GetConnectionString("DefaultConnection")
           ?? Environment.GetEnvironmentVariable("SQLCONNSTR_HorusPdv")
           ?? Environment.GetEnvironmentVariable("SQLCONNSTR_DefaultConnection")
           ?? Environment.GetEnvironmentVariable("HORUSPDV_CONNECTION_STRING")
           ?? DefaultConnectionString;
}
