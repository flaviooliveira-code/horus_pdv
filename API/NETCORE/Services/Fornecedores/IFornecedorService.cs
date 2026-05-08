/**
 * Arquivo: API/NETCORE/Services/Fornecedores/IFornecedorService.cs
 * Objetivo: centraliza regras de negócio de cadastro e manutenção de fornecedores antes do acesso ao banco ou resposta HTTP.
 * Entradas esperadas: recebe requisições já validadas pelos controladores e aplica consistência operacional do domínio.
 */
using HORUSPDV_API.Models.Fornecedores;
using HORUSPDV_API.Models.Requests;

namespace HORUSPDV_API.Services.Fornecedores;

public interface IFornecedorService
{
    Task<List<FornecedorModel>> ListarAsync();
    Task<FornecedorModel> CriarAsync(FornecedorRequest request);
    Task<FornecedorModel?> AtualizarAsync(string id, FornecedorRequest request);
    Task<bool> ExcluirAsync(string id);
}
