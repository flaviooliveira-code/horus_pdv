/**
 * Arquivo: API/NETCORE/Services/Clientes/ClienteService.cs
 * Objetivo: centraliza regras de negócio de cadastro e manutenção de clientes antes do acesso ao banco ou resposta HTTP.
 * Entradas esperadas: recebe requisições já validadas pelos controladores e aplica consistência operacional do domínio.
 */
using HORUSPDV_API.Models.Clientes;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;

namespace HORUSPDV_API.Services.Clientes;

public class ClienteService(ClienteAB clientesAB) : IClienteService
{
    public async Task<List<ClienteModel>> ListarAsync(string companyId)
        => (await clientesAB.ListarAsync(companyId)).Select(ToModel).ToList();

    public async Task<ClienteModel> CriarAsync(string companyId, ClienteRequest request)
    {
        Validate(request);
        await ValidateDuplicatesAsync(companyId, request, null);
        var customer = MapRequest($"cl-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request);
        return ToModel(await clientesAB.SalvarAsync(companyId, customer));
    }

    public async Task<ClienteModel?> AtualizarAsync(string companyId, string id, ClienteRequest request)
    {
        Validate(request);
        var current = await clientesAB.ObterAsync(companyId, id);
        if (current is null)
        {
            return null;
        }

        await ValidateDuplicatesAsync(companyId, request, id);
        return ToModel(await clientesAB.SalvarAsync(companyId, MapRequest(id, request)));
    }

    public Task<bool> ExcluirAsync(string companyId, string id)
        => clientesAB.ExcluirAsync(companyId, id);

    private static void Validate(ClienteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName) || request.CustomerName.Trim().Length < 3)
        {
            throw new InvalidOperationException("Nome do cliente deve ter no minimo 3 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(request.Document))
        {
            throw new InvalidOperationException("Documento do cliente e obrigatorio.");
        }

        var documentDigits = OnlyDigits(request.Document);
        if (documentDigits.Length != 11 && documentDigits.Length != 14)
        {
            throw new InvalidOperationException("Documento do cliente invalido.");
        }

        if (string.IsNullOrWhiteSpace(request.Cellphone))
        {
            throw new InvalidOperationException("Celular do cliente e obrigatorio.");
        }

        if (!string.IsNullOrWhiteSpace(request.Email) && !request.Email.Contains('@'))
        {
            throw new InvalidOperationException("E-mail do cliente invalido.");
        }
    }

    private async Task ValidateDuplicatesAsync(string companyId, ClienteRequest request, string? currentId)
    {
        var customers = await clientesAB.ListarAsync(companyId);
        var document = OnlyDigits(request.Document);
        if (customers.Any(item => item.Id != currentId && OnlyDigits(item.Document) == document))
        {
            throw new InvalidOperationException("Já existe cliente com este documento.");
        }
    }

    private static ClienteAD MapRequest(string id, ClienteRequest request) => new()
    {
        Id = id,
        CustomerName = request.CustomerName.Trim(),
        Document = request.Document,
        BirthDate = request.BirthDate,
        Age = request.Age,
        Cep = request.Cep,
        City = request.City,
        State = request.State,
        Address = request.Address,
        Neighborhood = request.Neighborhood,
        StreetComplement = request.StreetComplement,
        Number = request.Number,
        ReferencePoint = request.ReferencePoint,
        Telephone = request.Telephone,
        Cellphone = request.Cellphone,
        Email = request.Email
    };

    private static ClienteModel ToModel(ClienteAD source) => new()
    {
        Id = source.Id,
        CustomerName = source.CustomerName,
        Document = source.Document,
        BirthDate = source.BirthDate,
        Age = source.Age,
        Cep = source.Cep,
        City = source.City,
        State = source.State,
        Address = source.Address,
        Neighborhood = source.Neighborhood,
        StreetComplement = source.StreetComplement,
        Number = source.Number,
        ReferencePoint = source.ReferencePoint,
        Telephone = source.Telephone,
        Cellphone = source.Cellphone,
        Email = source.Email
    };

    private static string OnlyDigits(string value) => new(value.Where(char.IsDigit).ToArray());
}
