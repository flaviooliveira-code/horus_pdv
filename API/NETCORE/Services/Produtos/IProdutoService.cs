/**
 * Arquivo: API/NETCORE/Services/Produtos/IProdutoService.cs
 * Objetivo: centraliza regras de negócio de cadastro, estoque e manutenção de produtos antes do acesso ao banco ou resposta HTTP.
 * Entradas esperadas: recebe requisições já validadas pelos controladores e aplica consistência operacional do domínio.
 */
using HORUSPDV_API.Models.Produtos;
using HORUSPDV_API.Models.Requests;

namespace HORUSPDV_API.Services.Produtos;

public interface IProdutoService
{
    Task<List<ProdutoModel>> ListarAsync();
    Task<ProdutoModel> CriarAsync(ProdutoRequest request);
    Task<ProdutoModel?> AtualizarAsync(string id, ProdutoRequest request);
    Task<bool> ExcluirAsync(string id);
}
