/**
 * Arquivo: API/NETCORE/Repositories/HorusDatabaseInitializer.cs
 * Objetivo: executa a inicialização controlada do banco a partir dos scripts SQL do projeto.
 * Entradas esperadas: espera provedor de serviços configurado e SQL Server disponível no ambiente.
 */
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories;

public static class HorusDatabaseInitializer
{
    private static readonly Regex BatchSeparator = new(
        @"^\s*GO\s*;?\s*$",
        RegexOptions.IgnoreCase | RegexOptions.Multiline | RegexOptions.Compiled);

    public static async Task InitializeAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var connection = scope.ServiceProvider.GetRequiredService<Connection>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("HorusDatabaseInitializer");
        var scriptPath = Path.Combine(AppContext.BaseDirectory, "DataBase", "Resumo.sql");

        if (!File.Exists(scriptPath))
        {
            scriptPath = Path.Combine(Directory.GetCurrentDirectory(), "DataBase", "Resumo.sql");
        }

        if (!File.Exists(scriptPath))
        {
            logger.LogWarning("Script SQL não encontrado em DataBase/Resumo.sql. Inicialização do banco ignorada.");
            return;
        }

        var script = await File.ReadAllTextAsync(scriptPath);
        var batches = BatchSeparator.Split(script)
            .Select(batch => batch.Trim())
            .Where(batch => !string.IsNullOrWhiteSpace(batch))
            .ToList();

        await using var sqlConnection = await connection.OpenConnectionAsync(database: "master");
        foreach (var batch in batches)
        {
            await using var command = new SqlCommand(batch, sqlConnection)
            {
                CommandTimeout = 180
            };
            await command.ExecuteNonQueryAsync();
        }

        logger.LogInformation("Script SQL DataBase/Resumo.sql executado com sucesso.");
    }
}
