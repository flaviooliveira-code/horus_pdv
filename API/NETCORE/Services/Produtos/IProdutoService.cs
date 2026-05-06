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
