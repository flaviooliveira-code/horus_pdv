/**
 * Arquivo: API/NETCORE/Services/Fornecedores/FornecedorService.cs
 * Objetivo: centraliza regras de negócio de cadastro e manutenção de fornecedores antes do acesso ao banco ou resposta HTTP.
 * Entradas esperadas: recebe requisições já validadas pelos controladores e aplica consistência operacional do domínio.
 */
using HORUSPDV_API.Models.Fornecedores;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;

namespace HORUSPDV_API.Services.Fornecedores;

public class FornecedorService(FornecedorAB fornecedoresAB, ProdutoAB produtosAB) : IFornecedorService
{
    public async Task<List<FornecedorModel>> ListarAsync(string companyId)
        => (await fornecedoresAB.ListarAsync(companyId)).Select(ToModel).ToList();

    public async Task<FornecedorModel> CriarAsync(string companyId, FornecedorRequest request)
    {
        Validate(request);
        await ValidateDuplicatesAsync(companyId, request, null);
        var supplier = MapRequest($"fr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request);
        return ToModel(await fornecedoresAB.SalvarAsync(companyId, supplier));
    }

    public async Task<FornecedorModel?> AtualizarAsync(string companyId, string id, FornecedorRequest request)
    {
        Validate(request);
        var current = await fornecedoresAB.ObterAsync(companyId, id);
        if (current is null)
        {
            return null;
        }

        await ValidateDuplicatesAsync(companyId, request, id);
        return ToModel(await fornecedoresAB.SalvarAsync(companyId, MapRequest(id, request)));
    }

    public async Task<bool> ExcluirAsync(string companyId, string id)
    {
        var supplier = await fornecedoresAB.ObterAsync(companyId, id);
        if (supplier is null) return false;

        var products = await produtosAB.ListarAsync(companyId);
        if (products.Any(item =>
                !string.IsNullOrWhiteSpace(item.ProductSupplier) &&
                ((!string.IsNullOrWhiteSpace(supplier.FantasyName) &&
                  item.ProductSupplier.Equals(supplier.FantasyName, StringComparison.OrdinalIgnoreCase)) ||
                 (!string.IsNullOrWhiteSpace(supplier.CompanyName) &&
                  item.ProductSupplier.Equals(supplier.CompanyName, StringComparison.OrdinalIgnoreCase)))))
        {
            throw new InvalidOperationException("Fornecedor possui produtos vinculados e não pode ser excluído.");
        }

        return await fornecedoresAB.ExcluirAsync(companyId, id);
    }

    internal static void Validate(FornecedorRequest request)
    {
        var fantasyName = (request.FantasyName ?? string.Empty).Trim();
        var companyName = (request.CompanyName ?? string.Empty).Trim();

        if (fantasyName.Length < 2 && companyName.Length < 2)
        {
            throw new InvalidOperationException("Informe pelo menos o nome fantasia ou a razão social (mínimo 2 caracteres).");
        }

        var cnpjDigits = OnlyDigits(request.Cnpj ?? string.Empty);
        if (cnpjDigits.Length > 0 && cnpjDigits.Length != 14)
        {
            throw new InvalidOperationException("CNPJ do fornecedor inválido.");
        }

        if (!string.IsNullOrWhiteSpace(request.Email) && !request.Email.Contains('@'))
        {
            throw new InvalidOperationException("E-mail do fornecedor inválido.");
        }
    }

    private async Task ValidateDuplicatesAsync(string companyId, FornecedorRequest request, string? currentId)
    {
        var cnpj = OnlyDigits(request.Cnpj ?? string.Empty);
        if (cnpj.Length == 0)
        {
            return;
        }

        var suppliers = await fornecedoresAB.ListarAsync(companyId);
        if (suppliers.Any(item => item.Id != currentId && OnlyDigits(item.Cnpj) == cnpj))
        {
            throw new InvalidOperationException("Já existe fornecedor com este CNPJ.");
        }
    }

    internal static FornecedorAD MapRequest(string id, FornecedorRequest request)
    {
        var companyName = (request.CompanyName ?? string.Empty).Trim();
        var fantasyName = (request.FantasyName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(fantasyName))
        {
            fantasyName = companyName;
        }

        return new FornecedorAD
        {
            Id = id,
            CompanyName = companyName,
            FantasyName = fantasyName,
            Cnpj = (request.Cnpj ?? string.Empty).Trim(),
            Cep = (request.Cep ?? string.Empty).Trim(),
            City = (request.City ?? string.Empty).Trim(),
            State = (request.State ?? string.Empty).Trim().ToUpperInvariant(),
            Address = (request.Address ?? string.Empty).Trim(),
            Neighborhood = (request.Neighborhood ?? string.Empty).Trim(),
            StreetComplement = (request.StreetComplement ?? string.Empty).Trim(),
            Number = (request.Number ?? string.Empty).Trim(),
            ReferencePoint = (request.ReferencePoint ?? string.Empty).Trim(),
            Telephone = (request.Telephone ?? string.Empty).Trim(),
            Cellphone = (request.Cellphone ?? string.Empty).Trim(),
            Email = (request.Email ?? string.Empty).Trim()
        };
    }

    private static FornecedorModel ToModel(FornecedorAD source) => new()
    {
        Id = source.Id,
        CompanyName = source.CompanyName,
        FantasyName = source.FantasyName,
        Cnpj = source.Cnpj,
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
