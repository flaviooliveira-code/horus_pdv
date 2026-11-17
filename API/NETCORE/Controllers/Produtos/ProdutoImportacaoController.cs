/**
 * Arquivo: API/NETCORE/Controllers/Produtos/ProdutoImportacaoController.cs
 * Objetivo: gerencia validação prévia e importação em lote de produtos via planilha Excel/CSV.
 * Entradas esperadas: recebe lista de linhas extraídas da planilha e política de conflito ("atualizar" ou "ignorar").
 */
using System.Globalization;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Produtos;

[ApiController]
[Route("api/[controller]")]
public class ProdutoImportacaoController(ProdutoAB produtoAB) : ControllerBase
{
    [HttpPost("validar")]
    public async Task<IActionResult> Validar([FromBody] ProdutoImportacaoBatchRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<ProdutoImportacaoBatchResultDto> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var conflictMode = ProdutoImportacaoService.NormalizeConflictMode(request.ConflictMode);
            var existing = await produtoAB.ListarAsync(currentUser.CompanyId);
            var existingCodes = existing
                .Select(p => p.ProductCode.Trim())
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var validation = ProdutoImportacaoService.ValidateBatch(request.Items ?? [], existingCodes, conflictMode);
            return Ok(new ApiResponse<ProdutoImportacaoBatchResultDto>
            {
                Success = true,
                Message = "Planilha validada com sucesso.",
                Data = validation
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<ProdutoImportacaoBatchResultDto> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("importar")]
    public async Task<IActionResult> Importar([FromBody] ProdutoImportacaoBatchRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<ProdutoImportacaoBatchResultDto> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var conflictMode = ProdutoImportacaoService.NormalizeConflictMode(request.ConflictMode);
            var existingList = await produtoAB.ListarAsync(currentUser.CompanyId);
            var existingByCode = existingList
                .Where(p => !string.IsNullOrWhiteSpace(p.ProductCode))
                .GroupBy(p => p.ProductCode.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            var validation = ProdutoImportacaoService.ValidateBatch(
                request.Items ?? [],
                existingByCode.Keys.ToHashSet(StringComparer.OrdinalIgnoreCase),
                conflictMode);

            var createdCount = 0;
            var updatedCount = 0;
            var ignoredCount = 0;

            foreach (var row in validation.Rows)
            {
                if (!row.IsValid) continue;

                if (existingByCode.TryGetValue(row.ProductCode, out var existingProduct))
                {
                    if (conflictMode == "ignorar")
                    {
                        ignoredCount += 1;
                        continue;
                    }

                    var updatedAd = new ProdutoAD
                    {
                        Id = existingProduct.Id,
                        ProductImageUrl = existingProduct.ProductImageUrl,
                        ProductImageName = existingProduct.ProductImageName,
                        // A planilha não traz unidade: preserva KG/UN do produto existente.
                        UnitType = existingProduct.UnitType,
                        ProductCode = row.ProductCode,
                        ProductName = row.ProductName,
                        ProductSupplier = row.ProductSupplier,
                        ProductDescription = row.ProductDescription,
                        ProductQnt = row.ProductQnt,
                        ProductUnitPrice = row.ProductUnitPrice,
                        ProductSalePrice = row.ProductSalePrice,
                        TotalPriceOnProduct = row.TotalPriceOnProduct
                    };

                    await produtoAB.SalvarAsync(currentUser.CompanyId, updatedAd);
                    updatedCount += 1;
                }
                else
                {
                    var createdAd = new ProdutoAD
                    {
                        Id = $"prd-imp-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}"[..32],
                        ProductImageUrl = string.Empty,
                        ProductImageName = string.Empty,
                        ProductCode = row.ProductCode,
                        ProductName = row.ProductName,
                        ProductSupplier = row.ProductSupplier,
                        ProductDescription = row.ProductDescription,
                        ProductQnt = row.ProductQnt,
                        ProductUnitPrice = row.ProductUnitPrice,
                        ProductSalePrice = row.ProductSalePrice,
                        TotalPriceOnProduct = row.TotalPriceOnProduct
                    };

                    await produtoAB.SalvarAsync(currentUser.CompanyId, createdAd);
                    existingByCode[row.ProductCode] = createdAd;
                    createdCount += 1;
                }
            }

            validation.CreatedCount = createdCount;
            validation.UpdatedCount = updatedCount;
            validation.IgnoredCount = ignoredCount;

            return Ok(new ApiResponse<ProdutoImportacaoBatchResultDto>
            {
                Success = true,
                Message = $"Importação concluída: {createdCount} criado(s), {updatedCount} atualizado(s), {ignoredCount} ignorado(s).",
                Data = validation
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<ProdutoImportacaoBatchResultDto> { Success = false, Message = ex.Message });
        }
    }
}

public class ProdutoImportacaoItemRequest
{
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string ProductSupplier { get; set; } = string.Empty;
    public string ProductDescription { get; set; } = string.Empty;
    public string ProductQnt { get; set; } = "0";
    public string ProductUnitPrice { get; set; } = "0,00";
    public string ProductSalePrice { get; set; } = "0,00";
}

public class ProdutoImportacaoBatchRequest
{
    public string ConflictMode { get; set; } = "atualizar"; // atualizar | ignorar
    public List<ProdutoImportacaoItemRequest> Items { get; set; } = [];
}

public class ProdutoImportacaoRowStatusDto
{
    public int RowNumber { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string ProductSupplier { get; set; } = string.Empty;
    public string ProductDescription { get; set; } = string.Empty;
    public string ProductQnt { get; set; } = "0";
    public string ProductUnitPrice { get; set; } = "0,00";
    public string ProductSalePrice { get; set; } = "0,00";
    public string TotalPriceOnProduct { get; set; } = "0,00";
    public bool IsValid { get; set; }
    public bool ExistsInCatalog { get; set; }
    public string Action { get; set; } = "CRIAR"; // CRIAR | ATUALIZAR | IGNORAR | ERRO
    public List<string> Errors { get; set; } = [];
}

public class ProdutoImportacaoBatchResultDto
{
    public string ConflictMode { get; set; } = "atualizar";
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int InvalidRows { get; set; }
    public int CreatedCount { get; set; }
    public int UpdatedCount { get; set; }
    public int IgnoredCount { get; set; }
    public List<ProdutoImportacaoRowStatusDto> Rows { get; set; } = [];
}

public static class ProdutoImportacaoService
{
    private static readonly CultureInfo PtBr = new("pt-BR");

    public static string NormalizeConflictMode(string? mode)
    {
        var normalized = (mode ?? "atualizar").Trim().ToLowerInvariant();
        return normalized switch
        {
            "atualizar" or "update" => "atualizar",
            "ignorar" or "ignore" or "skip" => "ignorar",
            _ => throw new InvalidOperationException("Modo de conflito inválido. Escolha 'atualizar' ou 'ignorar'.")
        };
    }

    public static decimal ParseFlexibleDecimal(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return 0m;

        var cleaned = raw
            .Replace("R$", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Trim();

        var lastComma = cleaned.LastIndexOf(',');
        var lastDot = cleaned.LastIndexOf('.');

        if (lastComma >= 0 && lastDot >= 0)
        {
            if (lastComma > lastDot)
            {
                // Formato 1.234,56 -> remove ponto de milhar e troca vírgula por ponto
                cleaned = cleaned.Replace(".", string.Empty).Replace(',', '.');
            }
            else
            {
                // Formato 1,234.56 -> remove vírgula de milhar
                cleaned = cleaned.Replace(",", string.Empty);
            }
        }
        else if (lastComma >= 0)
        {
            cleaned = cleaned.Replace(',', '.');
        }

        return decimal.TryParse(cleaned, NumberStyles.Number | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var parsed)
            ? Math.Round(parsed, 2, MidpointRounding.AwayFromZero)
            : -1m;
    }

    public static ProdutoImportacaoBatchResultDto ValidateBatch(
        IEnumerable<ProdutoImportacaoItemRequest> items,
        ISet<string> existingCatalogCodes,
        string conflictMode = "atualizar")
    {
        var normalizedConflict = NormalizeConflictMode(conflictMode);
        var itemList = items?.ToList() ?? [];
        var seenInSheet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var rows = new List<ProdutoImportacaoRowStatusDto>();

        for (var i = 0; i < itemList.Count; i++)
        {
            var raw = itemList[i];
            var errors = new List<string>();
            var code = (raw.ProductCode ?? string.Empty).Trim();
            var name = (raw.ProductName ?? string.Empty).Trim();
            var supplier = string.IsNullOrWhiteSpace(raw.ProductSupplier) ? "Fornecedor Geral" : raw.ProductSupplier.Trim();
            var description = string.IsNullOrWhiteSpace(raw.ProductDescription) ? name : raw.ProductDescription.Trim();

            if (string.IsNullOrWhiteSpace(code))
            {
                errors.Add("Código do produto é obrigatório.");
            }
            else if (!seenInSheet.Add(code))
            {
                errors.Add($"Código '{code}' duplicado na mesma planilha.");
            }

            if (name.Length < 3)
            {
                errors.Add("Nome do produto deve ter no mínimo 3 caracteres.");
            }

            var qntDecimal = ParseFlexibleDecimal(raw.ProductQnt);
            var qntInt = (int)Math.Round(qntDecimal, MidpointRounding.AwayFromZero);
            if (qntDecimal < 0m || string.IsNullOrWhiteSpace(raw.ProductQnt))
            {
                errors.Add("Quantidade inválida (deve ser um inteiro >= 0).");
            }

            var unitPrice = ParseFlexibleDecimal(raw.ProductUnitPrice);
            if (unitPrice <= 0m)
            {
                errors.Add("Preço de custo unitário deve ser maior que zero.");
            }

            var salePrice = ParseFlexibleDecimal(raw.ProductSalePrice);
            if (salePrice <= 0m)
            {
                errors.Add("Preço de venda deve ser maior que zero.");
            }

            var exists = !string.IsNullOrWhiteSpace(code) && existingCatalogCodes.Contains(code);
            var isValid = errors.Count == 0;
            var action = !isValid
                ? "ERRO"
                : exists
                    ? (normalizedConflict == "atualizar" ? "ATUALIZAR" : "IGNORAR")
                    : "CRIAR";

            var safeUnit = Math.Max(0m, unitPrice);
            var safeSale = Math.Max(0m, salePrice);
            var safeQnt = Math.Max(0, qntInt);

            rows.Add(new ProdutoImportacaoRowStatusDto
            {
                RowNumber = i + 1,
                ProductCode = code,
                ProductName = name,
                ProductSupplier = supplier,
                ProductDescription = description,
                ProductQnt = safeQnt.ToString(CultureInfo.InvariantCulture),
                ProductUnitPrice = safeUnit.ToString("N2", PtBr),
                ProductSalePrice = safeSale.ToString("N2", PtBr),
                TotalPriceOnProduct = (safeUnit * safeQnt).ToString("N2", PtBr),
                IsValid = isValid,
                ExistsInCatalog = exists,
                Action = action,
                Errors = errors
            });
        }

        return new ProdutoImportacaoBatchResultDto
        {
            ConflictMode = normalizedConflict,
            TotalRows = rows.Count,
            ValidRows = rows.Count(r => r.IsValid),
            InvalidRows = rows.Count(r => !r.IsValid),
            Rows = rows
        };
    }
}
