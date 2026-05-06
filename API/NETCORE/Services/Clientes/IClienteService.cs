using HORUSPDV_API.Models.Clientes;
using HORUSPDV_API.Models.Requests;

namespace HORUSPDV_API.Services.Clientes;

public interface IClienteService
{
    Task<List<ClienteModel>> ListarAsync();
    Task<ClienteModel> CriarAsync(ClienteRequest request);
    Task<ClienteModel?> AtualizarAsync(string id, ClienteRequest request);
    Task<bool> ExcluirAsync(string id);
}
