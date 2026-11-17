/**
 * Arquivo: API/NETCORE/Models/Requests/CaixaRequest.cs
 * Objetivo: define contratos de entrada e conversores flexíveis pt-BR/numéricos para abertura, movimentações e fechamento cego de caixa.
 * Entradas esperadas: recebe dados JSON do frontend (strings formatadas em pt-BR ou números) nas ações da API.
 */
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HORUSPDV_API.Models.Requests;

public static class PtBrMoneyParser
{
    private static readonly CultureInfo PtBrCulture = new("pt-BR");

    public static decimal Parse(string? raw, decimal defaultOnEmpty = 0m)
    {
        if (!TryParse(raw, out var parsed, defaultOnEmpty))
        {
            throw new FormatException($"Valor monetário inválido: '{raw}'.");
        }

        return parsed;
    }

    public static bool TryParse(string? raw, out decimal result, decimal defaultOnEmpty = 0m)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            result = defaultOnEmpty;
            return true;
        }

        var cleaned = raw
            .Trim()
            .Replace("R$", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("\u00A0", string.Empty)
            .Replace(" ", string.Empty);

        if (string.IsNullOrWhiteSpace(cleaned))
        {
            result = defaultOnEmpty;
            return true;
        }

        var lastComma = cleaned.LastIndexOf(',');
        var lastDot = cleaned.LastIndexOf('.');
        string normalized;

        if (lastComma >= 0 && lastDot >= 0)
        {
            // Usa o último separador como decimal e remove o outro como milhar.
            normalized = lastComma > lastDot
                ? cleaned.Replace(".", string.Empty).Replace(',', '.')
                : cleaned.Replace(",", string.Empty);
        }
        else if (lastComma >= 0)
        {
            var commaCount = cleaned.Count(ch => ch == ',');
            if (commaCount > 1)
            {
                result = 0m;
                return false;
            }

            normalized = cleaned.Replace(',', '.');
        }
        else if (lastDot >= 0)
        {
            var dotCount = cleaned.Count(ch => ch == '.');
            normalized = dotCount > 1
                ? cleaned.Replace(".", string.Empty)
                : cleaned;
        }
        else
        {
            normalized = cleaned;
        }

        return decimal.TryParse(
            normalized,
            NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
            CultureInfo.InvariantCulture,
            out result);
    }

    public static string FormatPtBr(decimal value)
        => value.ToString("N2", PtBrCulture);
}

public sealed class PtBrFlexibleDecimalConverter : JsonConverter<decimal>
{
    public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.Number => reader.GetDecimal(),
            JsonTokenType.String => ParseStringOrThrow(reader.GetString()),
            JsonTokenType.Null => 0m,
            _ => throw new JsonException("Valor monetário deve ser número ou texto numérico.")
        };
    }

    public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options)
        => writer.WriteNumberValue(value);

    private static decimal ParseStringOrThrow(string? value)
    {
        if (PtBrMoneyParser.TryParse(value, out var parsed, 0m))
        {
            return parsed;
        }

        throw new JsonException($"Valor monetário inválido: '{value}'.");
    }
}

public sealed class PtBrFlexibleNullableDecimalConverter : JsonConverter<decimal?>
{
    public override decimal? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            return null;
        }

        if (reader.TokenType == JsonTokenType.Number)
        {
            return reader.GetDecimal();
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            var raw = reader.GetString();
            if (string.IsNullOrWhiteSpace(raw))
            {
                return null;
            }

            if (PtBrMoneyParser.TryParse(raw, out var parsed, 0m))
            {
                return parsed;
            }

            throw new JsonException($"Valor monetário inválido: '{raw}'.");
        }

        throw new JsonException("Valor monetário deve ser número, texto numérico ou nulo.");
    }

    public override void Write(Utf8JsonWriter writer, decimal? value, JsonSerializerOptions options)
    {
        if (value.HasValue)
        {
            writer.WriteNumberValue(value.Value);
        }
        else
        {
            writer.WriteNullValue();
        }
    }
}

public class AbrirCaixaRequest
{
    [JsonConverter(typeof(PtBrFlexibleDecimalConverter))]
    public decimal OpeningAmount { get; set; } = 0m;
}

public class CaixaMovimentacaoRequest
{
    [JsonConverter(typeof(PtBrFlexibleDecimalConverter))]
    public decimal Amount { get; set; }

    public string Description { get; set; } = string.Empty;
}

public class FecharCaixaRequest
{
    [JsonConverter(typeof(PtBrFlexibleDecimalConverter))]
    public decimal ClosingAmount { get; set; }

    [JsonConverter(typeof(PtBrFlexibleNullableDecimalConverter))]
    public decimal? CountedPixAmount { get; set; }

    [JsonConverter(typeof(PtBrFlexibleNullableDecimalConverter))]
    public decimal? CountedDebitAmount { get; set; }

    [JsonConverter(typeof(PtBrFlexibleNullableDecimalConverter))]
    public decimal? CountedCreditAmount { get; set; }

    public bool BlindClosing { get; set; } = true;

    public string Note { get; set; } = string.Empty;
}
