using HORUSPDV_API.Models.Clientes;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.AcessoBanco;

namespace HORUSPDV_API.Services.Clientes;

public class ClienteService(HorusMockDatabase database) : IClienteService
{
    public Task<List<ClienteModel>> ListarAsync()
        => database.ListarClientesAsync();

    public async Task<ClienteModel> CriarAsync(ClienteRequest request)
    {
        Validate(request);
        await ValidateDuplicatesAsync(request, null);
        var customer = MapRequest($"cl-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request);
        return await database.SalvarClienteAsync(customer);
    }

    public async Task<ClienteModel?> AtualizarAsync(string id, ClienteRequest request)
    {
        Validate(request);
        var current = await database.ObterClienteAsync(id);
        if (current is null)
        {
            return null;
        }

        await ValidateDuplicatesAsync(request, id);
        return await database.SalvarClienteAsync(MapRequest(id, request));
    }

    public Task<bool> ExcluirAsync(string id)
        => database.ExcluirClienteAsync(id);

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

    private async Task ValidateDuplicatesAsync(ClienteRequest request, string? currentId)
    {
        var customers = await database.ListarClientesAsync();
        var document = OnlyDigits(request.Document);
        if (customers.Any(item => item.Id != currentId && OnlyDigits(item.Document) == document))
        {
            throw new InvalidOperationException("Ja existe cliente com este documento.");
        }
    }

    private static ClienteModel MapRequest(string id, ClienteRequest request) => new()
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

    private static string OnlyDigits(string value) => new(value.Where(char.IsDigit).ToArray());
}
