/**
 * Arquivo: API/NETCORE/Services/Produtos/ProdutoExpirationHelper.cs
 * Objetivo: centraliza normalização, cálculo de validade (data fixa ou dias a partir da fabricação) e classificação
 *           de produtos vencidos/prestes a vencer para cadastro, importação, home, frente de caixa e relatórios.
 * Entradas esperadas: modo de validade, data de fabricação, dias de validade e data de vencimento.
 */
using System.Globalization;

namespace HORUSPDV_API.Services.Produtos;

public static class ProdutoExpirationHelper
{
    public const int DefaultExpiringAlertDays = 7;
    public const int DefaultManufactureShelfLifeDays = 30;
    public const int MaxShelfLifeDays = 3650;

    public const string ModeNone = "";
    public const string ModeFixedDate = "FIXED_DATE";
    public const string ModeDaysFromManufacture = "DAYS_FROM_MANUFACTURE";

    public const string StatusNone = "NONE";
    public const string StatusOk = "OK";
    public const string StatusExpiringSoon = "EXPIRING_SOON";
    public const string StatusExpired = "EXPIRED";

    private static readonly CultureInfo PtBr = new("pt-BR");

    public sealed record ResolvedExpiration(
        string ExpirationMode,
        string ManufactureDate,
        int? ShelfLifeDays,
        string ExpirationDate);

    public sealed record ExpirationEvaluation(
        string Status,
        int? DaysUntilExpiration);

    public static string NormalizeMode(string? rawMode)
    {
        var normalized = (rawMode ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalized) || normalized is "NONE" or "SEM_VALIDADE" or "NENHUM")
        {
            return ModeNone;
        }

        if (normalized is "FIXED_DATE" or "DATA_FIXA" or "VENCIMENTO" or "DATA_VENCIMENTO")
        {
            return ModeFixedDate;
        }

        if (normalized is "DAYS_FROM_MANUFACTURE" or "MANUFACTURE_30_DAYS" or "30_DAYS" or "30_DIAS" or "FABRICACAO" or "DIAS_FABRICACAO")
        {
            return ModeDaysFromManufacture;
        }

        if (normalized.Contains("30", StringComparison.Ordinal) || normalized.Contains("FABRIC", StringComparison.Ordinal))
        {
            return ModeDaysFromManufacture;
        }

        throw new InvalidOperationException("Modo de validade inválido. Utilize data fixa ou dias a partir da fabricação.");
    }

    public static DateOnly? ParseFlexibleDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var trimmed = raw.Trim();
        var isoCandidate = trimmed.Length >= 10 && trimmed[4] == '-' && trimmed[7] == '-'
            ? trimmed[..10]
            : trimmed;

        string[] formats =
        [
            "yyyy-MM-dd",
            "dd/MM/yyyy",
            "d/M/yyyy",
            "dd-MM-yyyy",
            "d-M-yyyy",
            "yyyy/MM/dd"
        ];

        if (DateOnly.TryParseExact(isoCandidate, formats, PtBr, DateTimeStyles.None, out var exact))
        {
            return exact;
        }

        // Fallback para serial numérico de data do Excel caso venha como número em texto (ex.: 46350).
        if (double.TryParse(trimmed, NumberStyles.Float, CultureInfo.InvariantCulture, out var excelSerial) &&
            excelSerial is >= 25000 and <= 80000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(excelSerial));
        }

        return null;
    }

    /// <summary>
    /// Interpreta indicações de validade em planilhas (ex.: "30", "30 dias", "Sim" -> 30; "Não"/"0"/vazio -> null).
    /// </summary>
    public static int? ParseShelfLifeIndicator(string? raw, out bool isInvalid)
    {
        isInvalid = false;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var trimmed = raw.Trim().ToLowerInvariant();
        if (trimmed is "nao" or "não" or "n" or "no" or "false" or "0" or "-")
        {
            return null;
        }

        if (trimmed is "sim" or "s" or "yes" or "y" or "true" or "x" or "30d" or "30dias" or "30 dias")
        {
            return DefaultManufactureShelfLifeDays;
        }

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (int.TryParse(digits, NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) &&
            parsed > 0 &&
            parsed <= MaxShelfLifeDays)
        {
            return parsed;
        }

        isInvalid = true;
        return null;
    }

    public static ResolvedExpiration NormalizeAndResolve(
        string? expirationMode,
        string? manufactureDate,
        int? shelfLifeDays,
        string? expirationDate,
        DateOnly? referenceToday = null)
    {
        var today = referenceToday ?? DateOnly.FromDateTime(DateTime.Today);
        var mode = NormalizeMode(expirationMode);

        DateOnly? parsedMfg = null;
        if (!string.IsNullOrWhiteSpace(manufactureDate))
        {
            parsedMfg = ParseFlexibleDate(manufactureDate)
                ?? throw new InvalidOperationException("Data de fabricação inválida. Utilize o formato DD/MM/AAAA ou AAAA-MM-AAAA.");
        }

        DateOnly? parsedExp = null;
        if (!string.IsNullOrWhiteSpace(expirationDate))
        {
            parsedExp = ParseFlexibleDate(expirationDate)
                ?? throw new InvalidOperationException("Data de vencimento inválida. Utilize o formato DD/MM/AAAA ou AAAA-MM-AAAA.");
        }

        // Inferência automática quando o chamador informa só os dados sem explicitar o modo.
        if (mode == ModeNone)
        {
            if (shelfLifeDays is > 0)
            {
                mode = ModeDaysFromManufacture;
            }
            else if (parsedExp is not null)
            {
                mode = ModeFixedDate;
            }
            else if (parsedMfg is not null)
            {
                mode = ModeDaysFromManufacture;
            }
            else
            {
                return new ResolvedExpiration(ModeNone, string.Empty, null, string.Empty);
            }
        }

        if (mode == ModeDaysFromManufacture)
        {
            var effectiveDays = shelfLifeDays ?? DefaultManufactureShelfLifeDays;
            if (effectiveDays <= 0 || effectiveDays > MaxShelfLifeDays)
            {
                throw new InvalidOperationException($"Prazo de validade em dias deve estar entre 1 e {MaxShelfLifeDays}.");
            }

            var effectiveMfg = parsedMfg ?? today;
            var computedExp = effectiveMfg.AddDays(effectiveDays);
            return new ResolvedExpiration(
                ModeDaysFromManufacture,
                effectiveMfg.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                effectiveDays,
                computedExp.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        }

        // ModeFixedDate
        if (parsedExp is null)
        {
            throw new InvalidOperationException("Informe a data de vencimento do produto.");
        }

        if (parsedMfg is not null && parsedMfg.Value > parsedExp.Value)
        {
            throw new InvalidOperationException("A data de fabricação não pode ser posterior à data de vencimento.");
        }

        return new ResolvedExpiration(
            ModeFixedDate,
            parsedMfg?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty,
            null,
            parsedExp.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
    }

    public static ExpirationEvaluation Evaluate(
        string? expirationDate,
        DateOnly? referenceToday = null,
        int alertDays = DefaultExpiringAlertDays)
    {
        var parsedExp = ParseFlexibleDate(expirationDate);
        if (parsedExp is null)
        {
            return new ExpirationEvaluation(StatusNone, null);
        }

        var today = referenceToday ?? DateOnly.FromDateTime(DateTime.Today);
        var daysRemaining = parsedExp.Value.DayNumber - today.DayNumber;
        var status = daysRemaining < 0
            ? StatusExpired
            : daysRemaining <= alertDays
                ? StatusExpiringSoon
                : StatusOk;

        return new ExpirationEvaluation(status, daysRemaining);
    }
}
