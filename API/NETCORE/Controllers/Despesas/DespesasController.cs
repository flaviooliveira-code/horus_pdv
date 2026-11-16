/**
 * Arquivo: API/NETCORE/Controllers/Despesas/DespesasController.cs
 * Objetivo: gerencia despesas operacionais da empresa para apuração de lucro líquido e DRE simplificado.
 * Entradas esperadas: recebe payloads REST de criação/edição de despesas, valida regras e persiste no SQL Server.
 */
using System.Globalization;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace HORUSPDV_API.Controllers.Despesas;

[ApiController]
[Route("api/[controller]")]
[HorusAuthorizeRoles("administrador", "gerente")]
public class DespesasController(Connection connection) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<List<DespesaOperacionalDto>> { Success = false, Message = "Sessão não encontrada." });
        }

        await using var db = await connection.OpenConnectionAsync();
        await EnsureSchemaAsync(db);

        await using var command = new SqlCommand(
            """
            SELECT Id, Description, Category, Amount, CompetenceDate, DueDate, PaidDate, Status, PaymentMethod, Observation
            FROM DespesasOperacionais
            WHERE CompanyId = @CompanyId
            ORDER BY CompetenceDate DESC, CreatedAt DESC;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", currentUser.CompanyId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<DespesaOperacionalDto>();
        while (await reader.ReadAsync())
        {
            rows.Add(Map(reader));
        }

        return Ok(new ApiResponse<List<DespesaOperacionalDto>>
        {
            Success = true,
            Message = "Despesas operacionais obtidas com sucesso.",
            Data = rows
        });
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] DespesaOperacionalRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<DespesaOperacionalDto> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var normalized = DespesaValidationService.ValidateAndNormalize(request);
            var id = $"desp-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}"[..32];

            await using var db = await connection.OpenConnectionAsync();
            await EnsureSchemaAsync(db);

            await using var command = new SqlCommand(
                """
                INSERT INTO DespesasOperacionais
                    (Id, CompanyId, Description, Category, Amount, CompetenceDate, DueDate, PaidDate, Status, PaymentMethod, Observation, CreatedAt)
                VALUES
                    (@Id, @CompanyId, @Description, @Category, @Amount, @CompetenceDate, @DueDate, @PaidDate, @Status, @PaymentMethod, @Observation, SYSDATETIMEOFFSET());
                """,
                db);
            command.Parameters.AddWithValue("@Id", id);
            command.Parameters.AddWithValue("@CompanyId", currentUser.CompanyId);
            AddParameters(command, normalized);
            await command.ExecuteNonQueryAsync();

            var dto = ToDto(id, normalized);
            return StatusCode(StatusCodes.Status201Created, new ApiResponse<DespesaOperacionalDto>
            {
                Success = true,
                Message = "Despesa operacional cadastrada com sucesso.",
                Data = dto
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<DespesaOperacionalDto> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(string id, [FromBody] DespesaOperacionalRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<DespesaOperacionalDto> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var normalized = DespesaValidationService.ValidateAndNormalize(request);
            await using var db = await connection.OpenConnectionAsync();
            await EnsureSchemaAsync(db);

            await using var command = new SqlCommand(
                """
                UPDATE DespesasOperacionais
                   SET Description = @Description,
                       Category = @Category,
                       Amount = @Amount,
                       CompetenceDate = @CompetenceDate,
                       DueDate = @DueDate,
                       PaidDate = @PaidDate,
                       Status = @Status,
                       PaymentMethod = @PaymentMethod,
                       Observation = @Observation
                 WHERE Id = @Id AND CompanyId = @CompanyId;
                """,
                db);
            command.Parameters.AddWithValue("@Id", id);
            command.Parameters.AddWithValue("@CompanyId", currentUser.CompanyId);
            AddParameters(command, normalized);

            if (await command.ExecuteNonQueryAsync() == 0)
            {
                return NotFound(new ApiResponse<DespesaOperacionalDto> { Success = false, Message = "Despesa operacional não encontrada." });
            }

            return Ok(new ApiResponse<DespesaOperacionalDto>
            {
                Success = true,
                Message = "Despesa operacional atualizada com sucesso.",
                Data = ToDto(id, normalized)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<DespesaOperacionalDto> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Excluir(string id)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        await using var db = await connection.OpenConnectionAsync();
        await EnsureSchemaAsync(db);

        await using var command = new SqlCommand(
            "DELETE FROM DespesasOperacionais WHERE Id = @Id AND CompanyId = @CompanyId;",
            db);
        command.Parameters.AddWithValue("@Id", id);
        command.Parameters.AddWithValue("@CompanyId", currentUser.CompanyId);

        if (await command.ExecuteNonQueryAsync() == 0)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Despesa operacional não encontrada." });
        }

        return Ok(new ApiResponse<object> { Success = true, Message = "Despesa operacional removida com sucesso." });
    }

    internal static async Task EnsureSchemaAsync(SqlConnection db)
    {
        const string sql = """
            IF OBJECT_ID(N'DespesasOperacionais', N'U') IS NULL
            BEGIN
                CREATE TABLE DespesasOperacionais
                (
                    Id NVARCHAR(40) NOT NULL CONSTRAINT PK_DespesasOperacionais PRIMARY KEY,
                    CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_DespesasOperacionais_CompanyId DEFAULT N'empresa-principal',
                    Description NVARCHAR(220) NOT NULL,
                    Category NVARCHAR(80) NOT NULL CONSTRAINT DF_DespesasOperacionais_Category DEFAULT N'Operacional',
                    Amount NVARCHAR(30) NOT NULL CONSTRAINT DF_DespesasOperacionais_Amount DEFAULT N'0,00',
                    CompetenceDate DATE NOT NULL,
                    DueDate DATE NOT NULL,
                    PaidDate DATE NULL,
                    Status NVARCHAR(30) NOT NULL CONSTRAINT DF_DespesasOperacionais_Status DEFAULT N'Pendente',
                    PaymentMethod NVARCHAR(40) NOT NULL CONSTRAINT DF_DespesasOperacionais_PaymentMethod DEFAULT N'PIX',
                    Observation NVARCHAR(500) NOT NULL CONSTRAINT DF_DespesasOperacionais_Observation DEFAULT N'',
                    CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_DespesasOperacionais_CreatedAt DEFAULT SYSDATETIMEOFFSET()
                );
                CREATE INDEX IX_DespesasOperacionais_CompanyId_CompetenceDate ON DespesasOperacionais (CompanyId, CompetenceDate DESC);
            END;
            """;

        await using var command = new SqlCommand(sql, db);
        await command.ExecuteNonQueryAsync();
    }

    private static void AddParameters(SqlCommand command, NormalizedDespesa normalized)
    {
        command.Parameters.AddWithValue("@Description", normalized.Description);
        command.Parameters.AddWithValue("@Category", normalized.Category);
        command.Parameters.AddWithValue("@Amount", normalized.AmountFormatted);
        command.Parameters.AddWithValue("@CompetenceDate", normalized.CompetenceDate);
        command.Parameters.AddWithValue("@DueDate", normalized.DueDate);
        command.Parameters.AddWithValue("@PaidDate", normalized.PaidDate.HasValue ? normalized.PaidDate.Value : DBNull.Value);
        command.Parameters.AddWithValue("@Status", normalized.Status);
        command.Parameters.AddWithValue("@PaymentMethod", normalized.PaymentMethod);
        command.Parameters.AddWithValue("@Observation", normalized.Observation);
    }

    private static DespesaOperacionalDto ToDto(string id, NormalizedDespesa normalized) => new()
    {
        Id = id,
        Description = normalized.Description,
        Category = normalized.Category,
        Amount = normalized.AmountFormatted,
        CompetenceDate = normalized.CompetenceDate.ToString("yyyy-MM-dd"),
        DueDate = normalized.DueDate.ToString("yyyy-MM-dd"),
        PaidDate = normalized.PaidDate?.ToString("yyyy-MM-dd"),
        Status = normalized.Status,
        PaymentMethod = normalized.PaymentMethod,
        Observation = normalized.Observation
    };

    private static DespesaOperacionalDto Map(SqlDataReader reader) => new()
    {
        Id = ReadString(reader, "Id"),
        Description = ReadString(reader, "Description"),
        Category = ReadString(reader, "Category"),
        Amount = ReadString(reader, "Amount"),
        CompetenceDate = reader.GetDateTime(reader.GetOrdinal("CompetenceDate")).ToString("yyyy-MM-dd"),
        DueDate = reader.GetDateTime(reader.GetOrdinal("DueDate")).ToString("yyyy-MM-dd"),
        PaidDate = reader.IsDBNull(reader.GetOrdinal("PaidDate"))
            ? null
            : reader.GetDateTime(reader.GetOrdinal("PaidDate")).ToString("yyyy-MM-dd"),
        Status = ReadString(reader, "Status"),
        PaymentMethod = ReadString(reader, "PaymentMethod"),
        Observation = ReadString(reader, "Observation")
    };

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }
}

public class DespesaOperacionalRequest
{
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "Operacional";
    public string Amount { get; set; } = "0,00";
    public string CompetenceDate { get; set; } = string.Empty;
    public string DueDate { get; set; } = string.Empty;
    public string? PaidDate { get; set; }
    public string Status { get; set; } = "Pendente"; // Pago | Pendente
    public string PaymentMethod { get; set; } = "PIX";
    public string Observation { get; set; } = string.Empty;
}

public class DespesaOperacionalDto
{
    public string Id { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "Operacional";
    public string Amount { get; set; } = "0,00";
    public string CompetenceDate { get; set; } = string.Empty;
    public string DueDate { get; set; } = string.Empty;
    public string? PaidDate { get; set; }
    public string Status { get; set; } = "Pendente";
    public string PaymentMethod { get; set; } = "PIX";
    public string Observation { get; set; } = string.Empty;
}

public record NormalizedDespesa(
    string Description,
    string Category,
    decimal AmountDecimal,
    string AmountFormatted,
    DateTime CompetenceDate,
    DateTime DueDate,
    DateTime? PaidDate,
    string Status,
    string PaymentMethod,
    string Observation);

public static class DespesaValidationService
{
    private static readonly CultureInfo PtBr = new("pt-BR");

    public static NormalizedDespesa ValidateAndNormalize(DespesaOperacionalRequest request)
    {
        var description = (request.Description ?? string.Empty).Trim();
        if (description.Length < 3)
        {
            throw new InvalidOperationException("A descrição da despesa deve ter pelo menos 3 caracteres.");
        }

        var category = string.IsNullOrWhiteSpace(request.Category) ? "Operacional" : request.Category.Trim();
        var amount = ParseMoney(request.Amount);
        if (amount <= 0m)
        {
            throw new InvalidOperationException("O valor da despesa deve ser maior que zero.");
        }

        var dueDate = ParseDate(request.DueDate) ?? DateTime.Today;
        var competenceDate = ParseDate(request.CompetenceDate) ?? dueDate;

        var rawStatus = (request.Status ?? "Pendente").Trim();
        var status = rawStatus.Equals("Pago", StringComparison.OrdinalIgnoreCase) ? "Pago" : "Pendente";

        DateTime? paidDate = ParseDate(request.PaidDate);
        if (status == "Pago" && !paidDate.HasValue)
        {
            paidDate = competenceDate;
        }
        else if (status == "Pendente")
        {
            paidDate = null;
        }

        var paymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "PIX" : request.PaymentMethod.Trim();
        var observation = (request.Observation ?? string.Empty).Trim();

        return new NormalizedDespesa(
            description,
            category,
            amount,
            amount.ToString("N2", PtBr),
            competenceDate.Date,
            dueDate.Date,
            paidDate?.Date,
            status,
            paymentMethod,
            observation);
    }

    public static decimal ParseMoney(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return 0m;
        var cleaned = raw.Replace("R$", string.Empty, StringComparison.OrdinalIgnoreCase).Trim();
        if (cleaned.Contains(','))
        {
            cleaned = cleaned.Replace(".", string.Empty).Replace(',', '.');
        }

        return decimal.TryParse(cleaned, NumberStyles.Number | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var parsed)
            ? Math.Round(parsed, 2, MidpointRounding.AwayFromZero)
            : 0m;
    }

    private static DateTime? ParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return DateTime.TryParse(raw.Trim(), PtBr, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.Date
            : null;
    }
}
