using HORUSPDV_API.Data;
using HORUSPDV_API.Data.Entities;
using HORUSPDV_API.Models.ModuloMercado;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HORUSPDV_API.Controllers.ModuloMercado;

[ApiController]
[Route("api/[controller]")]
public class ModuloMercadoController(HorusDbContext db) : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<IActionResult> Obter(string id)
    {
        var config = await BuildConfigAsync(id);
        if (config is null)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Modulo nao encontrado." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Modulo obtido com sucesso.",
            Data = config
        });
    }

    [HttpPost("{id}/registros")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CriarRegistro(string id, [FromBody] ModuloMercadoRegistroRequest request)
    {
        if (!await ModuleExistsAsync(id))
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Modulo nao encontrado." });
        }

        try
        {
            var registro = MapRequest(id, $"mm-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request);
            db.ModuloMercadoRegistros.Add(registro);
            await db.SaveChangesAsync();

            return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>
            {
                Success = true,
                Message = "Registro criado com sucesso.",
                Data = await BuildConfigAsync(id)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id}/registros/{recordId}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AtualizarRegistro(string id, string recordId, [FromBody] ModuloMercadoRegistroRequest request)
    {
        if (!await ModuleExistsAsync(id))
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Modulo nao encontrado." });
        }

        try
        {
            var registro = await db.ModuloMercadoRegistros.FirstOrDefaultAsync(item => item.ModuleId == id && item.Id == recordId);
            if (registro is null)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "Registro nao encontrado." });
            }

            var updated = MapRequest(id, recordId, request);
            registro.Title = updated.Title;
            registro.Description = updated.Description;
            registro.Status = updated.Status;
            registro.Amount = updated.Amount;
            registro.Meta = updated.Meta;
            await db.SaveChangesAsync();

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Registro atualizado com sucesso.",
                Data = await BuildConfigAsync(id)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{id}/registros/{recordId}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ExcluirRegistro(string id, string recordId)
    {
        if (!await ModuleExistsAsync(id))
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Modulo nao encontrado." });
        }

        var registro = await db.ModuloMercadoRegistros.FirstOrDefaultAsync(item => item.ModuleId == id && item.Id == recordId);
        if (registro is null)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Registro nao encontrado." });
        }

        db.ModuloMercadoRegistros.Remove(registro);
        await db.SaveChangesAsync();
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Registro removido com sucesso.",
            Data = await BuildConfigAsync(id)
        });
    }

    private async Task<object?> BuildConfigAsync(string id)
    {
        var title = BuildModuleTitle(id);
        if (title is null) return null;

        var records = await db.ModuloMercadoRegistros
            .AsNoTracking()
            .Where(item => item.ModuleId == id)
            .OrderBy(item => item.Id)
            .Select(item => ToModel(item))
            .ToListAsync();
        var pendingCount = records.Count(item => IsPending(item.Status));
        var completedCount = records.Count(item => IsCompleted(item.Status));
        var completionRate = records.Count == 0
            ? 0
            : (int)Math.Round(completedCount * 100m / records.Count);

        return new
        {
            id,
            title,
            description = $"Gestão operacional do módulo {title}.",
            primaryAction = id switch
            {
                "fiscal" => "Nova NFC-e",
                "pagamentos" => "Nova cobrança",
                "estoque" => "Ajustar estoque",
                "caixa" => "Abrir caixa",
                "compras" => "Novo pedido",
                "devolucoes" => "Nova devolução",
                "crm-fidelidade" => "Nova campanha",
                "omnichannel" => "Conectar canal",
                _ => "Nova ação"
            },
            statusLabel = "Status do módulo",
            statusValue = "Operação ativa",
            kpis = new[]
            {
                new { label = "Volume", value = records.Count.ToString(), hint = "Movimentações registradas", tone = "secondary" },
                new { label = "Pendências", value = pendingCount.ToString(), hint = "Aguardando ação", tone = "accent" },
                new { label = "Concluídos", value = $"{completionRate}%", hint = "Fluxos processados", tone = "success" },
                new { label = "Alertas", value = Math.Max(1, pendingCount).ToString(), hint = "Pontos de atenção", tone = "primary" }
            },
            recordsTitle = "Registros operacionais",
            records,
            workflowTitle = "Fluxo operacional",
            workflow = new[]
            {
                "Consultar os dados atualizados do módulo.",
                "Validar informações e regras operacionais.",
                "Executar ação operacional no frontend.",
                "Registrar movimentação e acompanhar status."
            },
            alerts = new[]
            {
                pendingCount > 0
                    ? $"Existem {pendingCount} pendência(s) aguardando conferência."
                    : "Nenhuma pendência crítica no momento.",
                "Revise os registros com prioridade operacional.",
                "Acompanhe os indicadores antes do fechamento do período."
            }
        };
    }

    private async Task<bool> ModuleExistsAsync(string id)
        => BuildModuleTitle(id) is not null && await db.ModulosMercado.AnyAsync(item => item.Id == id);

    private static string? BuildModuleTitle(string id) => id switch
    {
        "fiscal" => "Fiscal NFC-e / NF-e",
        "pagamentos" => "Pagamentos Integrados",
        "estoque" => "Estoque e Inventário",
        "caixa" => "Abertura e Fechamento de Caixa",
        "compras" => "Compras e Reposição",
        "devolucoes" => "Trocas e Devoluções",
        "crm-fidelidade" => "CRM e Fidelidade",
        "omnichannel" => "Omnichannel e Integrações",
        _ => null
    };

    private static ModuloMercadoRegistroEntity MapRequest(
        string moduleId,
        string recordId,
        ModuloMercadoRegistroRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length < 3)
        {
            throw new InvalidOperationException("Titulo deve ter no minimo 3 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(request.Status))
        {
            throw new InvalidOperationException("Status e obrigatorio.");
        }

        return new ModuloMercadoRegistroEntity
        {
            Id = recordId,
            ModuleId = moduleId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Status = request.Status.Trim(),
            Amount = request.Amount.Trim(),
            Meta = request.Meta.Trim()
        };
    }

    private static bool IsPending(string status)
        => status.Contains("pend", StringComparison.OrdinalIgnoreCase)
           || status.Contains("aguard", StringComparison.OrdinalIgnoreCase);

    private static bool IsCompleted(string status)
        => status.Contains("conclu", StringComparison.OrdinalIgnoreCase)
           || status.Contains("audit", StringComparison.OrdinalIgnoreCase)
           || status.Contains("fech", StringComparison.OrdinalIgnoreCase)
           || status.Contains("ativo", StringComparison.OrdinalIgnoreCase);

    private static ModuloMercadoRegistroModel ToModel(ModuloMercadoRegistroEntity source) => new()
    {
        Id = source.Id,
        ModuleId = source.ModuleId,
        Title = source.Title,
        Description = source.Description,
        Status = source.Status,
        Amount = source.Amount,
        Meta = source.Meta
    };
}
