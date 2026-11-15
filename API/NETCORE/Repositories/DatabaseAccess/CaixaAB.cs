/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/CaixaAB.cs
 * Objetivo: concentra comandos SQL e persistência de abertura, fechamento, sangria, suprimento e balanço de caixa.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using HORUSPDV_API.Repositories.DataAccess;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class CaixaAB(Connection connection)
{
    public virtual async Task<List<CaixaSessionAD>> ListarSessoesAsync(string companyId)
    {
        await using var db = await connection.OpenConnectionAsync();
        await EnsureCaixaSchemaAsync(db);
        await using var command = new SqlCommand(
            """
            SELECT Id, OpenedAt, ClosedAt, OpeningAmount, ClosingAmount,
                   ExpectedAmount, DifferenceAmount, DifferenceStatus,
                   TotalCashSales, TotalSupplies, TotalWithdrawals,
                   OperatorName, ClosedByName, Note
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

    public virtual async Task<CaixaSessionAD?> ObterSessaoAbertaAsync(string companyId)
        => (await ListarSessoesAsync(companyId)).FirstOrDefault(item => item.ClosedAt is null);

    public virtual async Task<CaixaSessionAD?> ObterSessaoPorIdAsync(string companyId, string sessionId)
        => (await ListarSessoesAsync(companyId)).FirstOrDefault(item => string.Equals(item.Id, sessionId, StringComparison.OrdinalIgnoreCase));

    public virtual async Task AbrirAsync(
        string id,
        string companyId,
        DateTimeOffset openedAt,
        string openingAmount,
        string operatorId,
        string operatorName)
    {
        await using var db = await connection.OpenConnectionAsync();
        await EnsureCaixaSchemaAsync(db);
        await using var command = new SqlCommand(
            """
            INSERT INTO CaixaSessoes
                (Id, CompanyId, OpenedAt, OpeningAmount, ClosingAmount, ExpectedAmount, DifferenceAmount, DifferenceStatus,
                 TotalCashSales, TotalSupplies, TotalWithdrawals, OperatorId, OperatorName, ClosedById, ClosedByName, Note)
            VALUES
                (@Id, @CompanyId, @OpenedAt, @OpeningAmount, N'0,00', @OpeningAmount, N'0,00', N'CONFERIDO',
                 N'0,00', N'0,00', N'0,00', @OperatorId, @OperatorName, N'', N'', N'');
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

    public virtual async Task FecharAsync(
        string id,
        string companyId,
        DateTimeOffset closedAt,
        string closingAmount,
        string closedById,
        string closedByName,
        string note,
        string expectedAmount = "0,00",
        string differenceAmount = "0,00",
        string differenceStatus = "CONFERIDO",
        string totalCashSales = "0,00",
        string totalSupplies = "0,00",
        string totalWithdrawals = "0,00")
    {
        await using var db = await connection.OpenConnectionAsync();
        await EnsureCaixaSchemaAsync(db);
        await using var command = new SqlCommand(
            """
            UPDATE CaixaSessoes
               SET ClosedAt = @ClosedAt,
                   ClosingAmount = @ClosingAmount,
                   ExpectedAmount = @ExpectedAmount,
                   DifferenceAmount = @DifferenceAmount,
                   DifferenceStatus = @DifferenceStatus,
                   TotalCashSales = @TotalCashSales,
                   TotalSupplies = @TotalSupplies,
                   TotalWithdrawals = @TotalWithdrawals,
                   ClosedById = @ClosedById,
                   ClosedByName = @ClosedByName,
                   Note = @Note
             WHERE Id = @Id AND CompanyId = @CompanyId;
            """,
            db);
        command.Parameters.AddWithValue("@ClosedAt", closedAt);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@ClosingAmount", closingAmount);
        command.Parameters.AddWithValue("@ExpectedAmount", expectedAmount);
        command.Parameters.AddWithValue("@DifferenceAmount", differenceAmount);
        command.Parameters.AddWithValue("@DifferenceStatus", differenceStatus);
        command.Parameters.AddWithValue("@TotalCashSales", totalCashSales);
        command.Parameters.AddWithValue("@TotalSupplies", totalSupplies);
        command.Parameters.AddWithValue("@TotalWithdrawals", totalWithdrawals);
        command.Parameters.AddWithValue("@ClosedById", closedById);
        command.Parameters.AddWithValue("@ClosedByName", closedByName);
        command.Parameters.AddWithValue("@Note", note);
        command.Parameters.AddWithValue("@Id", id);
        await command.ExecuteNonQueryAsync();
    }

    public virtual async Task RegistrarMovimentacaoAsync(CaixaMovimentacaoAD movement)
    {
        await using var db = await connection.OpenConnectionAsync();
        await EnsureCaixaSchemaAsync(db);
        await using var command = new SqlCommand(
            """
            INSERT INTO CaixaMovimentacoes
                (Id, CompanyId, CaixaSessaoId, Tipo, FormaPagamento, Valor, Descricao, OperatorId, OperatorName, CreatedAt)
            VALUES
                (@Id, @CompanyId, @CaixaSessaoId, @Tipo, @FormaPagamento, @Valor, @Descricao, @OperatorId, @OperatorName, @CreatedAt);
            """,
            db);
        command.Parameters.AddWithValue("@Id", movement.Id);
        command.Parameters.AddWithValue("@CompanyId", movement.CompanyId);
        command.Parameters.AddWithValue("@CaixaSessaoId", movement.CaixaSessaoId);
        command.Parameters.AddWithValue("@Tipo", movement.Tipo);
        command.Parameters.AddWithValue("@FormaPagamento", movement.FormaPagamento);
        command.Parameters.AddWithValue("@Valor", movement.Valor);
        command.Parameters.AddWithValue("@Descricao", movement.Descricao);
        command.Parameters.AddWithValue("@OperatorId", movement.OperatorId);
        command.Parameters.AddWithValue("@OperatorName", movement.OperatorName);
        command.Parameters.AddWithValue("@CreatedAt", movement.CreatedAt);
        await command.ExecuteNonQueryAsync();
    }

    public virtual async Task<List<CaixaMovimentacaoAD>> ListarMovimentacoesAsync(string companyId, string? caixaSessaoId = null)
    {
        await using var db = await connection.OpenConnectionAsync();
        await EnsureCaixaSchemaAsync(db);
        await using var command = new SqlCommand(
            """
            SELECT Id, CompanyId, CaixaSessaoId, Tipo, FormaPagamento, Valor, Descricao, OperatorId, OperatorName, CreatedAt
            FROM CaixaMovimentacoes
            WHERE CompanyId = @CompanyId
              AND (@CaixaSessaoId IS NULL OR CaixaSessaoId = @CaixaSessaoId)
            ORDER BY CreatedAt DESC;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@CaixaSessaoId", string.IsNullOrWhiteSpace(caixaSessaoId) ? DBNull.Value : caixaSessaoId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<CaixaMovimentacaoAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(new CaixaMovimentacaoAD
            {
                Id = ReadString(reader, "Id"),
                CompanyId = ReadString(reader, "CompanyId"),
                CaixaSessaoId = ReadString(reader, "CaixaSessaoId"),
                Tipo = ReadString(reader, "Tipo"),
                FormaPagamento = ReadString(reader, "FormaPagamento"),
                Valor = ReadString(reader, "Valor"),
                Descricao = ReadString(reader, "Descricao"),
                OperatorId = ReadString(reader, "OperatorId"),
                OperatorName = ReadString(reader, "OperatorName"),
                CreatedAt = reader.GetDateTimeOffset(reader.GetOrdinal("CreatedAt"))
            });
        }

        return rows;
    }

    public virtual async Task<List<CaixaVendaResumoAD>> ListarVendasSessaoAsync(
        string companyId,
        string sessionId,
        DateTimeOffset openedAt,
        DateTimeOffset? closedAt)
    {
        await using var db = await connection.OpenConnectionAsync();
        await EnsureCaixaSchemaAsync(db);
        await using var command = new SqlCommand(
            """
            SELECT Id, SaleNumber, PaymentType, TotalAmount, OperatorName, SaleDate
            FROM Vendas
            WHERE CompanyId = @CompanyId
              AND (
                    CaixaSessaoId = @SessionId
                    OR (CaixaSessaoId IS NULL AND SaleDate >= @OpenedAt AND (@ClosedAt IS NULL OR SaleDate <= @ClosedAt))
                  )
            ORDER BY SaleDate DESC;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@SessionId", sessionId);
        command.Parameters.AddWithValue("@OpenedAt", openedAt);
        command.Parameters.AddWithValue("@ClosedAt", closedAt.HasValue ? closedAt.Value : DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<CaixaVendaResumoAD>();
        while (await reader.ReadAsync())
        {
            rows.Add(new CaixaVendaResumoAD
            {
                Id = ReadString(reader, "Id"),
                SaleNumber = ReadString(reader, "SaleNumber"),
                PaymentType = ReadString(reader, "PaymentType"),
                TotalAmount = ReadString(reader, "TotalAmount"),
                OperatorName = ReadString(reader, "OperatorName"),
                SaleDate = reader.GetDateTimeOffset(reader.GetOrdinal("SaleDate"))
            });
        }

        return rows;
    }

    private static async Task EnsureCaixaSchemaAsync(SqlConnection db)
    {
        const string sql = """
            IF COL_LENGTH(N'CaixaSessoes', N'ExpectedAmount') IS NULL
                ALTER TABLE CaixaSessoes ADD ExpectedAmount NVARCHAR(30) NOT NULL CONSTRAINT DF_CaixaSessoes_ExpectedAmount DEFAULT N'0,00';
            IF COL_LENGTH(N'CaixaSessoes', N'DifferenceAmount') IS NULL
                ALTER TABLE CaixaSessoes ADD DifferenceAmount NVARCHAR(30) NOT NULL CONSTRAINT DF_CaixaSessoes_DifferenceAmount DEFAULT N'0,00';
            IF COL_LENGTH(N'CaixaSessoes', N'DifferenceStatus') IS NULL
                ALTER TABLE CaixaSessoes ADD DifferenceStatus NVARCHAR(30) NOT NULL CONSTRAINT DF_CaixaSessoes_DifferenceStatus DEFAULT N'CONFERIDO';
            IF COL_LENGTH(N'CaixaSessoes', N'TotalCashSales') IS NULL
                ALTER TABLE CaixaSessoes ADD TotalCashSales NVARCHAR(30) NOT NULL CONSTRAINT DF_CaixaSessoes_TotalCashSales DEFAULT N'0,00';
            IF COL_LENGTH(N'CaixaSessoes', N'TotalSupplies') IS NULL
                ALTER TABLE CaixaSessoes ADD TotalSupplies NVARCHAR(30) NOT NULL CONSTRAINT DF_CaixaSessoes_TotalSupplies DEFAULT N'0,00';
            IF COL_LENGTH(N'CaixaSessoes', N'TotalWithdrawals') IS NULL
                ALTER TABLE CaixaSessoes ADD TotalWithdrawals NVARCHAR(30) NOT NULL CONSTRAINT DF_CaixaSessoes_TotalWithdrawals DEFAULT N'0,00';

            IF OBJECT_ID(N'CaixaMovimentacoes', N'U') IS NULL
            BEGIN
                CREATE TABLE CaixaMovimentacoes
                (
                    Id NVARCHAR(40) NOT NULL CONSTRAINT PK_CaixaMovimentacoes PRIMARY KEY,
                    CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_CaixaMovimentacoes_CompanyId DEFAULT N'empresa-principal',
                    CaixaSessaoId NVARCHAR(40) NOT NULL,
                    Tipo NVARCHAR(30) NOT NULL,
                    FormaPagamento NVARCHAR(40) NOT NULL CONSTRAINT DF_CaixaMovimentacoes_FormaPagamento DEFAULT N'Dinheiro',
                    Valor NVARCHAR(30) NOT NULL CONSTRAINT DF_CaixaMovimentacoes_Valor DEFAULT N'0,00',
                    Descricao NVARCHAR(500) NOT NULL CONSTRAINT DF_CaixaMovimentacoes_Descricao DEFAULT N'',
                    OperatorId NVARCHAR(40) NOT NULL CONSTRAINT DF_CaixaMovimentacoes_OperatorId DEFAULT N'',
                    OperatorName NVARCHAR(180) NOT NULL CONSTRAINT DF_CaixaMovimentacoes_OperatorName DEFAULT N'',
                    CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_CaixaMovimentacoes_CreatedAt DEFAULT SYSDATETIMEOFFSET()
                );
                CREATE INDEX IX_CaixaMovimentacoes_CaixaSessaoId_CreatedAt ON CaixaMovimentacoes (CaixaSessaoId, CreatedAt DESC);
                CREATE INDEX IX_CaixaMovimentacoes_CompanyId_CreatedAt ON CaixaMovimentacoes (CompanyId, CreatedAt DESC);
            END;

            IF COL_LENGTH(N'Vendas', N'CaixaSessaoId') IS NULL
                ALTER TABLE Vendas ADD CaixaSessaoId NVARCHAR(40) NULL;
            """;

        await using var command = new SqlCommand(sql, db);
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
        ExpectedAmount = ReadString(reader, "ExpectedAmount"),
        DifferenceAmount = ReadString(reader, "DifferenceAmount"),
        DifferenceStatus = ReadString(reader, "DifferenceStatus"),
        TotalCashSales = ReadString(reader, "TotalCashSales"),
        TotalSupplies = ReadString(reader, "TotalSupplies"),
        TotalWithdrawals = ReadString(reader, "TotalWithdrawals"),
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

