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
                item.ProductSupplier.Equals(supplier.FantasyName, StringComparison.OrdinalIgnoreCase) ||
                item.ProductSupplier.Equals(supplier.CompanyName, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Fornecedor possui produtos vinculados e não pode ser excluído.");
        }

        return await fornecedoresAB.ExcluirAsync(companyId, id);
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

    private async Task ValidateDuplicatesAsync(string companyId, FornecedorRequest request, string? currentId)
    {
        var suppliers = await fornecedoresAB.ListarAsync(companyId);
        var cnpj = OnlyDigits(request.Cnpj);
        if (suppliers.Any(item => item.Id != currentId && OnlyDigits(item.Cnpj) == cnpj))
        {
            throw new InvalidOperationException("Já existe fornecedor com este CNPJ.");
        }
    }

    private static FornecedorAD MapRequest(string id, FornecedorRequest request) => new()
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
