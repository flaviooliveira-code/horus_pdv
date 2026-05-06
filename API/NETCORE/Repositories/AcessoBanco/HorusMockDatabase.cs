using HORUSPDV_API.Data;
using HORUSPDV_API.Data.Entities;
using HORUSPDV_API.Models.Clientes;
using HORUSPDV_API.Models.Fornecedores;
using HORUSPDV_API.Models.Produtos;
using Microsoft.EntityFrameworkCore;

namespace HORUSPDV_API.Repositories.AcessoBanco;

public class HorusMockDatabase(HorusDbContext db)
{
    public async Task<List<ProdutoModel>> ListarProdutosAsync()
        => await db.Produtos
            .AsNoTracking()
            .OrderBy(item => item.ProductName)
            .Select(item => ToModel(item))
            .ToListAsync();

    public async Task<ProdutoModel?> ObterProdutoAsync(string id)
        => await db.Produtos
            .AsNoTracking()
            .Where(item => item.Id == id)
            .Select(item => ToModel(item))
            .FirstOrDefaultAsync();

    public async Task<ProdutoModel> SalvarProdutoAsync(ProdutoModel product)
    {
        var current = await db.Produtos.FirstOrDefaultAsync(item => item.Id == product.Id);
        var supplier = await ResolveSupplierAsync(product.ProductSupplier);
        if (current is null)
        {
            current = new ProdutoEntity { Id = product.Id };
            db.Produtos.Add(current);
        }

        current.ProductImageUrl = product.ProductImageUrl;
        current.ProductImageName = product.ProductImageName;
        current.ProductName = product.ProductName;
        current.ProductCode = product.ProductCode;
        current.ProductSupplier = product.ProductSupplier;
        current.SupplierId = supplier?.Id;
        current.ProductDescription = product.ProductDescription;
        current.ProductQnt = product.ProductQnt;
        current.ProductUnitPrice = product.ProductUnitPrice;
        current.ProductSalePrice = product.ProductSalePrice;
        current.TotalPriceOnProduct = product.TotalPriceOnProduct;
        await db.SaveChangesAsync();
        return ToModel(current);
    }

    public async Task<bool> ExcluirProdutoAsync(string id)
    {
        var current = await db.Produtos.FirstOrDefaultAsync(item => item.Id == id);
        if (current is null) return false;
        db.Produtos.Remove(current);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task BaixarEstoqueAsync(IEnumerable<(string ProductCode, int Quantity)> items)
    {
        var groupedItems = items
            .GroupBy(item => item.ProductCode.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(group => new { ProductCode = group.Key, Quantity = group.Sum(item => item.Quantity) })
            .ToList();

        var codes = groupedItems.Select(item => item.ProductCode).ToList();
        var products = await db.Produtos
            .Where(product => codes.Contains(product.ProductCode))
            .ToListAsync();

        foreach (var item in groupedItems)
        {
            var product = products.FirstOrDefault(product =>
                product.ProductCode.Equals(item.ProductCode, StringComparison.OrdinalIgnoreCase));
            if (product is null)
            {
                throw new InvalidOperationException($"Produto {item.ProductCode} nao encontrado.");
            }

            var currentStock = ParseInt(product.ProductQnt);
            if (item.Quantity <= 0)
            {
                throw new InvalidOperationException("Quantidade da venda deve ser maior que zero.");
            }

            if (currentStock < item.Quantity)
            {
                throw new InvalidOperationException(
                    $"Estoque insuficiente para {product.ProductName}. Disponivel: {currentStock}.");
            }
        }

        foreach (var item in groupedItems)
        {
            var product = products.First(product =>
                product.ProductCode.Equals(item.ProductCode, StringComparison.OrdinalIgnoreCase));
            var nextStock = ParseInt(product.ProductQnt) - item.Quantity;
            product.ProductQnt = nextStock.ToString();
            product.TotalPriceOnProduct = CalculateTotal(product.ProductUnitPrice, nextStock);
        }

        await db.SaveChangesAsync();
    }

    public async Task<List<ClienteModel>> ListarClientesAsync()
        => await db.Clientes
            .AsNoTracking()
            .OrderBy(item => item.CustomerName)
            .Select(item => ToModel(item))
            .ToListAsync();

    public async Task<ClienteModel?> ObterClienteAsync(string id)
        => await db.Clientes
            .AsNoTracking()
            .Where(item => item.Id == id)
            .Select(item => ToModel(item))
            .FirstOrDefaultAsync();

    public async Task<ClienteModel> SalvarClienteAsync(ClienteModel customer)
    {
        var current = await db.Clientes.FirstOrDefaultAsync(item => item.Id == customer.Id);
        if (current is null)
        {
            current = new ClienteEntity { Id = customer.Id };
            db.Clientes.Add(current);
        }

        current.CustomerName = customer.CustomerName;
        current.Document = customer.Document;
        current.BirthDate = customer.BirthDate;
        current.Age = customer.Age;
        current.Cep = customer.Cep;
        current.City = customer.City;
        current.State = customer.State;
        current.Address = customer.Address;
        current.Neighborhood = customer.Neighborhood;
        current.StreetComplement = customer.StreetComplement;
        current.Number = customer.Number;
        current.ReferencePoint = customer.ReferencePoint;
        current.Telephone = customer.Telephone;
        current.Cellphone = customer.Cellphone;
        current.Email = customer.Email;
        await db.SaveChangesAsync();
        return ToModel(current);
    }

    public async Task<bool> ExcluirClienteAsync(string id)
    {
        var current = await db.Clientes.FirstOrDefaultAsync(item => item.Id == id);
        if (current is null) return false;
        db.Clientes.Remove(current);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<FornecedorModel>> ListarFornecedoresAsync()
        => await db.Fornecedores
            .AsNoTracking()
            .OrderBy(item => item.FantasyName)
            .Select(item => ToModel(item))
            .ToListAsync();

    public async Task<FornecedorModel?> ObterFornecedorAsync(string id)
        => await db.Fornecedores
            .AsNoTracking()
            .Where(item => item.Id == id)
            .Select(item => ToModel(item))
            .FirstOrDefaultAsync();

    public async Task<FornecedorModel> SalvarFornecedorAsync(FornecedorModel supplier)
    {
        var current = await db.Fornecedores.FirstOrDefaultAsync(item => item.Id == supplier.Id);
        if (current is null)
        {
            current = new FornecedorEntity { Id = supplier.Id };
            db.Fornecedores.Add(current);
        }

        current.CompanyName = supplier.CompanyName;
        current.FantasyName = supplier.FantasyName;
        current.Cnpj = supplier.Cnpj;
        current.Cep = supplier.Cep;
        current.City = supplier.City;
        current.State = supplier.State;
        current.Address = supplier.Address;
        current.Neighborhood = supplier.Neighborhood;
        current.StreetComplement = supplier.StreetComplement;
        current.Number = supplier.Number;
        current.ReferencePoint = supplier.ReferencePoint;
        current.Telephone = supplier.Telephone;
        current.Cellphone = supplier.Cellphone;
        current.Email = supplier.Email;
        await db.SaveChangesAsync();
        return ToModel(current);
    }

    public async Task<bool> ExcluirFornecedorAsync(string id)
    {
        var current = await db.Fornecedores.FirstOrDefaultAsync(item => item.Id == id);
        if (current is null) return false;
        db.Fornecedores.Remove(current);
        await db.SaveChangesAsync();
        return true;
    }

    private async Task<FornecedorEntity?> ResolveSupplierAsync(string supplierName)
        => await db.Fornecedores.FirstOrDefaultAsync(item =>
            item.FantasyName == supplierName || item.CompanyName == supplierName);

    private static ProdutoModel ToModel(ProdutoEntity source) => new()
    {
        Id = source.Id,
        ProductImageUrl = source.ProductImageUrl,
        ProductImageName = source.ProductImageName,
        ProductName = source.ProductName,
        ProductCode = source.ProductCode,
        ProductSupplier = source.ProductSupplier,
        ProductDescription = source.ProductDescription,
        ProductQnt = source.ProductQnt,
        ProductUnitPrice = source.ProductUnitPrice,
        ProductSalePrice = source.ProductSalePrice,
        TotalPriceOnProduct = source.TotalPriceOnProduct
    };

    private static ClienteModel ToModel(ClienteEntity source) => new()
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

    private static FornecedorModel ToModel(FornecedorEntity source) => new()
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

    private static int ParseInt(string value)
        => int.TryParse(value, out var parsed) ? parsed : 0;

    private static string CalculateTotal(string unitPrice, int quantity)
    {
        var normalized = unitPrice.Replace(".", "").Replace(",", ".");
        if (!decimal.TryParse(
                normalized,
                System.Globalization.NumberStyles.Number,
                System.Globalization.CultureInfo.InvariantCulture,
                out var parsed))
        {
            return "0,00";
        }

        return (parsed * quantity).ToString("N2", new System.Globalization.CultureInfo("pt-BR"));
    }
}
