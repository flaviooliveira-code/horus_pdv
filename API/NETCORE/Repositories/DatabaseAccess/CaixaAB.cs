/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/CaixaAB.cs
 * Objetivo: concentra comandos SQL e persistência transacional de sessões, movimentações e auditoria de caixa.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using System.Text;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Services.Caixa;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class CaixaAB(Connection connection) : ICaixaRepository
{
    private const string SelectSessionColumns = """
        Id, OpenedAt, ClosedAt, OpeningAmount, ClosingAmount, OperatorName, ClosedByName, Note,
        ExpectedCashAmount, CountedCashAmount, CashDifference,
        SalesCashTotal, SalesPixTotal, SalesDebitTotal, SalesCreditTotal,
        TotalSuprimentos, TotalSangrias, SalesCount, BlindClosing
        """;

    public async Task<List<CaixaSessionAD>> ListarSessoesAsync(string companyId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            $"""
            SELECT {SelectSessionColumns}
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
            rows.Add(MapSession(reader));
        }

        return rows;
    }

    public async Task<CaixaSessionAD?> ObterSessaoPorIdAsync(string companyId, string sessionId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            $"""
            SELECT {SelectSessionColumns}
            FROM CaixaSessoes
            WHERE CompanyId = @CompanyId AND Id = @Id;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Id", sessionId);
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapSession(reader) : null;
    }

    public async Task<CaixaSessionAD?> ObterSessaoAbertaAsync(string companyId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            $"""
            SELECT TOP 1 {SelectSessionColumns}
            FROM CaixaSessoes
            WHERE CompanyId = @CompanyId AND ClosedAt IS NULL
            ORDER BY OpenedAt DESC;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapSession(reader) : null;
    }

    public async Task AbrirAsync(
        string id,
        string companyId,
        DateTimeOffset openedAt,
        string openingAmount,
        string operatorId,
        string operatorName,
        decimal openingAmountDecimal)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var transaction = (SqlTransaction)await db.BeginTransactionAsync();

        try
        {
            await using (var command = new SqlCommand(
                             """
                             INSERT INTO CaixaSessoes
                                 (Id, CompanyId, OpenedAt, OpeningAmount, ClosingAmount, OperatorId, OperatorName, ClosedById, ClosedByName, Note,
                                  ExpectedCashAmount, CountedCashAmount, CashDifference, SalesCashTotal, SalesPixTotal, SalesDebitTotal, SalesCreditTotal,
                                  TotalSuprimentos, TotalSangrias, SalesCount, BlindClosing)
                             VALUES
                                 (@Id, @CompanyId, @OpenedAt, @OpeningAmount, N'0,00', @OperatorId, @OperatorName, N'', N'', N'',
                                  @ExpectedCashAmount, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1);
                             """,
                             db,
                             transaction))
            {
                command.Parameters.AddWithValue("@Id", id);
                command.Parameters.AddWithValue("@CompanyId", companyId);
                command.Parameters.AddWithValue("@OpenedAt", openedAt);
                command.Parameters.AddWithValue("@OpeningAmount", openingAmount);
                command.Parameters.AddWithValue("@OperatorId", operatorId);
                command.Parameters.AddWithValue("@OperatorName", operatorName);
                command.Parameters.AddWithValue("@ExpectedCashAmount", openingAmountDecimal);
                await command.ExecuteNonQueryAsync();
            }

            await using (var movCommand = new SqlCommand(
                             """
                             INSERT INTO CaixaMovimentacoes
                                 (Id, CompanyId, CaixaSessaoId, Tipo, FormaPagamento, Valor, Descricao, SaleNumber, UsuarioId, UsuarioName, DataHora)
                             VALUES
                                 (@Id, @CompanyId, @CaixaSessaoId, N'ABERTURA', N'dinheiro', @Valor, N'Abertura de caixa', NULL, @UsuarioId, @UsuarioName, @DataHora);
                             """,
                             db,
                             transaction))
            {
                movCommand.Parameters.AddWithValue("@Id", $"mov-{Guid.NewGuid():N}"[..36]);
                movCommand.Parameters.AddWithValue("@CompanyId", companyId);
                movCommand.Parameters.AddWithValue("@CaixaSessaoId", id);
                movCommand.Parameters.AddWithValue("@Valor", openingAmountDecimal);
                movCommand.Parameters.AddWithValue("@UsuarioId", operatorId);
                movCommand.Parameters.AddWithValue("@UsuarioName", operatorName);
                movCommand.Parameters.AddWithValue("@DataHora", openedAt);
                await movCommand.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task RegistrarMovimentacaoAsync(CaixaMovimentacaoAD movimentacao)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            INSERT INTO CaixaMovimentacoes
                (Id, CompanyId, CaixaSessaoId, Tipo, FormaPagamento, Valor, Descricao, SaleNumber, UsuarioId, UsuarioName, DataHora)
            VALUES
                (@Id, @CompanyId, @CaixaSessaoId, @Tipo, @FormaPagamento, @Valor, @Descricao, @SaleNumber, @UsuarioId, @UsuarioName, @DataHora);
            """,
            db);
        command.Parameters.AddWithValue("@Id", movimentacao.Id);
        command.Parameters.AddWithValue("@CompanyId", movimentacao.CompanyId);
        command.Parameters.AddWithValue("@CaixaSessaoId", movimentacao.CaixaSessaoId);
        command.Parameters.AddWithValue("@Tipo", movimentacao.Tipo);
        command.Parameters.AddWithValue("@FormaPagamento", movimentacao.FormaPagamento);
        command.Parameters.AddWithValue("@Valor", movimentacao.Valor);
        command.Parameters.AddWithValue("@Descricao", movimentacao.Descricao);
        command.Parameters.AddWithValue("@SaleNumber", (object?)movimentacao.SaleNumber ?? DBNull.Value);
        command.Parameters.AddWithValue("@UsuarioId", movimentacao.UsuarioId);
        command.Parameters.AddWithValue("@UsuarioName", movimentacao.UsuarioName);
        command.Parameters.AddWithValue("@DataHora", movimentacao.DataHora);
        await command.ExecuteNonQueryAsync();
    }

    public async Task<List<CaixaMovimentacaoAD>> ListarMovimentacoesPorSessaoAsync(string companyId, string caixaSessaoId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            SELECT Id, CompanyId, CaixaSessaoId, Tipo, FormaPagamento, Valor, Descricao, SaleNumber, UsuarioId, UsuarioName, DataHora
            FROM CaixaMovimentacoes
            WHERE CompanyId = @CompanyId AND CaixaSessaoId = @CaixaSessaoId
            ORDER BY DataHora ASC, Id ASC;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@CaixaSessaoId", caixaSessaoId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<CaixaMovimentacaoAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(MapMovimentacao(reader));
        }

        return rows;
    }

    public async Task<List<CaixaMovimentacaoAD>> ListarMovimentacoesPorSessoesAsync(
        string companyId,
        IReadOnlyCollection<string> sessionIds)
    {
        if (sessionIds.Count == 0)
        {
            return [];
        }

        var idList = sessionIds.Distinct().ToList();
        var paramNames = idList.Select((_, index) => $"@S{index}").ToList();
        var sql = new StringBuilder(
            $"""
            SELECT Id, CompanyId, CaixaSessaoId, Tipo, FormaPagamento, Valor, Descricao, SaleNumber, UsuarioId, UsuarioName, DataHora
            FROM CaixaMovimentacoes
            WHERE CompanyId = @CompanyId AND CaixaSessaoId IN ({string.Join(", ", paramNames)})
            ORDER BY DataHora ASC, Id ASC;
            """);

        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(sql.ToString(), db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        for (var index = 0; index < idList.Count; index += 1)
        {
            command.Parameters.AddWithValue(paramNames[index], idList[index]);
        }

        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<CaixaMovimentacaoAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(MapMovimentacao(reader));
        }

        return rows;
    }

    public async Task<CaixaSalesSummaryAD> ObterResumoVendasPorSessaoAsync(string companyId, string caixaSessaoId)
    {
        var summary = new CaixaSalesSummaryAD();
        await using var db = await connection.OpenConnectionAsync();

        await using (var vendasCmd = new SqlCommand(
                         """
                         SELECT PaymentType, TotalAmount
                         FROM Vendas
                         WHERE CompanyId = @CompanyId AND CaixaSessaoId = @CaixaSessaoId;
                         """,
                         db))
        {
            vendasCmd.Parameters.AddWithValue("@CompanyId", companyId);
            vendasCmd.Parameters.AddWithValue("@CaixaSessaoId", caixaSessaoId);
            await using var reader = await vendasCmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var payment = HorusCaixaService.NormalizePaymentMethod(ReadString(reader, "PaymentType"));
                PtBrMoneyParser.TryParse(ReadString(reader, "TotalAmount"), out var amount);
                AccumulateSale(summary, payment, amount);
            }
        }

        // Fallback para movimentações do tipo VENDA caso haja lançamentos registrados sem linha correspondente em Vendas.
        if (summary.SalesCount == 0)
        {
            await using var movCmd = new SqlCommand(
                """
                SELECT FormaPagamento, Valor
                FROM CaixaMovimentacoes
                WHERE CompanyId = @CompanyId AND CaixaSessaoId = @CaixaSessaoId AND Tipo = N'VENDA';
                """,
                db);
            movCmd.Parameters.AddWithValue("@CompanyId", companyId);
            movCmd.Parameters.AddWithValue("@CaixaSessaoId", caixaSessaoId);
            await using var movReader = await movCmd.ExecuteReaderAsync();
            while (await movReader.ReadAsync())
            {
                var payment = HorusCaixaService.NormalizePaymentMethod(ReadString(movReader, "FormaPagamento"));
                var amount = ReadDecimal(movReader, "Valor");
                AccumulateSale(summary, payment, amount);
            }
        }

        return summary;
    }

    public async Task FecharAsync(
        string id,
        string companyId,
        DateTimeOffset closedAt,
        string closingAmount,
        string closedById,
        string closedByName,
        string note,
        CaixaSessionAuditAD audit)
    {
        await using var db = await connection.OpenConnectionAsync();
        await using var command = new SqlCommand(
            """
            UPDATE CaixaSessoes
               SET ClosedAt = @ClosedAt,
                   ClosingAmount = @ClosingAmount,
                   ClosedById = @ClosedById,
                   ClosedByName = @ClosedByName,
                   Note = @Note,
                   ExpectedCashAmount = @ExpectedCashAmount,
                   CountedCashAmount = @CountedCashAmount,
                   CashDifference = @CashDifference,
                   SalesCashTotal = @SalesCashTotal,
                   SalesPixTotal = @SalesPixTotal,
                   SalesDebitTotal = @SalesDebitTotal,
                   SalesCreditTotal = @SalesCreditTotal,
                   TotalSuprimentos = @TotalSuprimentos,
                   TotalSangrias = @TotalSangrias,
                   SalesCount = @SalesCount,
                   BlindClosing = @BlindClosing
             WHERE Id = @Id AND CompanyId = @CompanyId;
            """,
            db);
        command.Parameters.AddWithValue("@ClosedAt", closedAt);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@ClosingAmount", closingAmount);
        command.Parameters.AddWithValue("@ClosedById", closedById);
        command.Parameters.AddWithValue("@ClosedByName", closedByName);
        command.Parameters.AddWithValue("@Note", note);
        command.Parameters.AddWithValue("@ExpectedCashAmount", audit.ExpectedCashAmount);
        command.Parameters.AddWithValue("@CountedCashAmount", audit.CountedCashAmount);
        command.Parameters.AddWithValue("@CashDifference", audit.CashDifference);
        command.Parameters.AddWithValue("@SalesCashTotal", audit.SalesCashTotal);
        command.Parameters.AddWithValue("@SalesPixTotal", audit.SalesPixTotal);
        command.Parameters.AddWithValue("@SalesDebitTotal", audit.SalesDebitTotal);
        command.Parameters.AddWithValue("@SalesCreditTotal", audit.SalesCreditTotal);
        command.Parameters.AddWithValue("@TotalSuprimentos", audit.TotalSuprimentos);
        command.Parameters.AddWithValue("@TotalSangrias", audit.TotalSangrias);
        command.Parameters.AddWithValue("@SalesCount", audit.SalesCount);
        command.Parameters.AddWithValue("@BlindClosing", audit.BlindClosing);
        command.Parameters.AddWithValue("@Id", id);
        await command.ExecuteNonQueryAsync();
    }

    private static void AccumulateSale(CaixaSalesSummaryAD summary, string normalizedPayment, decimal amount)
    {
        summary.SalesCount += 1;
        switch (normalizedPayment)
        {
            case "dinheiro":
                summary.SalesCashTotal += amount;
                break;
            case "pix":
                summary.SalesPixTotal += amount;
                break;
            case "debito":
                summary.SalesDebitTotal += amount;
                break;
            case "credito":
                summary.SalesCreditTotal += amount;
                break;
        }
    }

    private static CaixaSessionAD MapSession(SqlDataReader reader) => new()
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
        Note = ReadString(reader, "Note"),
        ExpectedCashAmount = ReadDecimal(reader, "ExpectedCashAmount"),
        CountedCashAmount = ReadDecimal(reader, "CountedCashAmount"),
        CashDifference = ReadDecimal(reader, "CashDifference"),
        SalesCashTotal = ReadDecimal(reader, "SalesCashTotal"),
        SalesPixTotal = ReadDecimal(reader, "SalesPixTotal"),
        SalesDebitTotal = ReadDecimal(reader, "SalesDebitTotal"),
        SalesCreditTotal = ReadDecimal(reader, "SalesCreditTotal"),
        TotalSuprimentos = ReadDecimal(reader, "TotalSuprimentos"),
        TotalSangrias = ReadDecimal(reader, "TotalSangrias"),
        SalesCount = ReadInt(reader, "SalesCount"),
        BlindClosing = ReadBool(reader, "BlindClosing")
    };

    private static CaixaMovimentacaoAD MapMovimentacao(SqlDataReader reader) => new()
    {
        Id = ReadString(reader, "Id"),
        CompanyId = ReadString(reader, "CompanyId"),
        CaixaSessaoId = ReadString(reader, "CaixaSessaoId"),
        Tipo = ReadString(reader, "Tipo"),
        FormaPagamento = ReadString(reader, "FormaPagamento"),
        Valor = ReadDecimal(reader, "Valor"),
        Descricao = ReadString(reader, "Descricao"),
        SaleNumber = ReadNullableString(reader, "SaleNumber"),
        UsuarioId = ReadString(reader, "UsuarioId"),
        UsuarioName = ReadString(reader, "UsuarioName"),
        DataHora = reader.GetDateTimeOffset(reader.GetOrdinal("DataHora"))
    };

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private static string? ReadNullableString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static decimal ReadDecimal(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? 0m : reader.GetDecimal(ordinal);
    }

    private static int ReadInt(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? 0 : reader.GetInt32(ordinal);
    }

    private static bool ReadBool(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return !reader.IsDBNull(ordinal) && reader.GetBoolean(ordinal);
    }
}
