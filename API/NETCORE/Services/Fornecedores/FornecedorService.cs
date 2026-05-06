using HORUSPDV_API.Models.Fornecedores;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.AcessoBanco;

namespace HORUSPDV_API.Services.Fornecedores;

public class FornecedorService(HorusMockDatabase database) : IFornecedorService
{
    public Task<List<FornecedorModel>> ListarAsync()
        => database.ListarFornecedoresAsync();

    public async Task<FornecedorModel> CriarAsync(FornecedorRequest request)
    {
        Validate(request);
        await ValidateDuplicatesAsync(request, null);
        var supplier = MapRequest($"fr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request);
        return await database.SalvarFornecedorAsync(supplier);
    }

    public async Task<FornecedorModel?> AtualizarAsync(string id, FornecedorRequest request)
    {
        Validate(request);
        var current = await database.ObterFornecedorAsync(id);
        if (current is null)
        {
            return null;
        }

        await ValidateDuplicatesAsync(request, id);
        return await database.SalvarFornecedorAsync(MapRequest(id, request));
    }

    public async Task<bool> ExcluirAsync(string id)
    {
        var supplier = await database.ObterFornecedorAsync(id);
        if (supplier is null) return false;

        var products = await database.ListarProdutosAsync();
        if (products.Any(item =>
                item.ProductSupplier.Equals(supplier.FantasyName, StringComparison.OrdinalIgnoreCase) ||
                item.ProductSupplier.Equals(supplier.CompanyName, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Fornecedor possui produtos vinculados e nao pode ser excluido.");
        }

        return await database.ExcluirFornecedorAsync(id);
    }

    private static void Validate(FornecedorRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CompanyName) || request.CompanyName.Trim().Length < 3)
        {
            throw new InvalidOperationException("Razao social deve ter no minimo 3 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(request.FantasyName) || request.FantasyName.Trim().Length < 3)
        {
            throw new InvalidOperationException("Nome fantasia deve ter no minimo 3 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(request.Cnpj))
        {
            throw new InvalidOperationException("CNPJ do fornecedor e obrigatorio.");
        }

        if (OnlyDigits(request.Cnpj).Length != 14)
        {
            throw new InvalidOperationException("CNPJ do fornecedor invalido.");
        }

        if (string.IsNullOrWhiteSpace(request.Cellphone))
        {
            throw new InvalidOperationException("Celular do fornecedor e obrigatorio.");
        }

        if (!string.IsNullOrWhiteSpace(request.Email) && !request.Email.Contains('@'))
        {
            throw new InvalidOperationException("E-mail do fornecedor invalido.");
        }
    }

    private async Task ValidateDuplicatesAsync(FornecedorRequest request, string? currentId)
    {
        var suppliers = await database.ListarFornecedoresAsync();
        var cnpj = OnlyDigits(request.Cnpj);
        if (suppliers.Any(item => item.Id != currentId && OnlyDigits(item.Cnpj) == cnpj))
        {
            throw new InvalidOperationException("Ja existe fornecedor com este CNPJ.");
        }
    }

    private static FornecedorModel MapRequest(string id, FornecedorRequest request) => new()
    {
        Id = id,
        CompanyName = request.CompanyName.Trim(),
        FantasyName = request.FantasyName.Trim(),
        Cnpj = request.Cnpj,
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
