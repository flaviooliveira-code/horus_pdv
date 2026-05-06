using HORUSPDV_API.Models.ModuloMercado;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.ModuloMercado;

[ApiController]
[Route("api/[controller]")]
public class ModuloMercadoController : ControllerBase
{
    private static readonly object SyncRoot = new();
    private static readonly Dictionary<string, List<ModuloMercadoRegistroModel>> RegistrosPorModulo =
        CreateInitialRecords();

    [HttpGet("{id}")]
    public IActionResult Obter(string id)
    {
        var config = BuildConfig(id);
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
    public IActionResult CriarRegistro(string id, [FromBody] ModuloMercadoRegistroRequest request)
    {
        if (!ModuleExists(id))
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Modulo nao encontrado." });
        }

        try
        {
            var registro = MapRequest(id, $"mm-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request);
            lock (SyncRoot)
            {
                RegistrosPorModulo[id].Insert(0, CloneRecord(registro));
            }

            return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>
            {
                Success = true,
                Message = "Registro criado com sucesso.",
                Data = BuildConfig(id)
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
    public IActionResult AtualizarRegistro(string id, string recordId, [FromBody] ModuloMercadoRegistroRequest request)
    {
        if (!ModuleExists(id))
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Modulo nao encontrado." });
        }

        try
        {
            lock (SyncRoot)
            {
                var records = RegistrosPorModulo[id];
                var index = records.FindIndex(item => item.Id == recordId);
                if (index < 0)
                {
                    return NotFound(new ApiResponse<object> { Success = false, Message = "Registro nao encontrado." });
                }

                records[index] = MapRequest(id, recordId, request);
            }

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Registro atualizado com sucesso.",
                Data = BuildConfig(id)
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
    public IActionResult ExcluirRegistro(string id, string recordId)
    {
        if (!ModuleExists(id))
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = "Modulo nao encontrado." });
        }

        lock (SyncRoot)
        {
            var removed = RegistrosPorModulo[id].RemoveAll(item => item.Id == recordId) > 0;
            if (!removed)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "Registro nao encontrado." });
            }
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Registro removido com sucesso.",
            Data = BuildConfig(id)
        });
    }

    private static object? BuildConfig(string id)
    {
        var title = id switch
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

        if (title is null) return null;
        var records = GetRecords(id);
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

    private static bool ModuleExists(string id) => BuildModuleTitle(id) is not null;

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

    private static List<ModuloMercadoRegistroModel> GetRecords(string id)
    {
        lock (SyncRoot)
        {
            return RegistrosPorModulo.TryGetValue(id, out var records)
                ? records.Select(CloneRecord).ToList()
                : [];
        }
    }

    private static ModuloMercadoRegistroModel MapRequest(
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

        return new ModuloMercadoRegistroModel
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

    private static ModuloMercadoRegistroModel CloneRecord(ModuloMercadoRegistroModel source) => new()
    {
        Id = source.Id,
        ModuleId = source.ModuleId,
        Title = source.Title,
        Description = source.Description,
        Status = source.Status,
        Amount = source.Amount,
        Meta = source.Meta
    };

    private static Dictionary<string, List<ModuloMercadoRegistroModel>> CreateInitialRecords()
    {
        var moduleIds = new[]
        {
            "fiscal",
            "pagamentos",
            "estoque",
            "caixa",
            "compras",
            "devolucoes",
            "crm-fidelidade",
            "omnichannel"
        };

        return moduleIds.ToDictionary(
            id => id,
            id =>
            {
                var title = BuildModuleTitle(id) ?? "Modulo";
                return new List<ModuloMercadoRegistroModel>
                {
                    new()
                    {
                        Id = $"{id}-001",
                        ModuleId = id,
                        Title = $"{title} - Registro 001",
                        Description = "Registro principal do módulo.",
                        Status = "Ativo",
                        Amount = "R$ 184,90",
                        Meta = "Sincronizado agora"
                    },
                    new()
                    {
                        Id = $"{id}-002",
                        ModuleId = id,
                        Title = $"{title} - Registro 002",
                        Description = "Item aguardando validação operacional.",
                        Status = "Pendente",
                        Amount = "R$ 59,80",
                        Meta = "Prioridade média"
                    },
                    new()
                    {
                        Id = $"{id}-003",
                        ModuleId = id,
                        Title = $"{title} - Registro 003",
                        Description = "Evento de auditoria e acompanhamento.",
                        Status = "Auditado",
                        Amount = "R$ 1.240,00",
                        Meta = "Responsável: Administrador"
                    }
                };
            });
    }
}
