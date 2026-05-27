/**
 * Arquivo: API/NETCORE/Services/Clientes/IClienteService.cs
 * Objetivo: centraliza regras de negócio de cadastro e manutenção de clientes antes do acesso ao banco ou resposta HTTP.
 * Entradas esperadas: recebe requisições já validadas pelos controladores e aplica consistência operacional do domínio.
 */
using HORUSPDV_API.Models.Clientes;
using HORUSPDV_API.Models.Requests;

namespace HORUSPDV_API.Services.Clientes;

public interface IClienteService
{
    Task<List<ClienteModel>> ListarAsync(string companyId);
    Task<ClienteModel> CriarAsync(string companyId, ClienteRequest request);
    Task<ClienteModel?> AtualizarAsync(string companyId, string id, ClienteRequest request);
    Task<bool> ExcluirAsync(string companyId, string id);
}
