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
