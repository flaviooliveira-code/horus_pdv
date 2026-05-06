using HORUSPDV_API.Models.Clientes;
using HORUSPDV_API.Models.Fornecedores;
using HORUSPDV_API.Models.Produtos;

namespace HORUSPDV_API.Repositories.AcessoBanco;

public class HorusMockDatabase
{
    private readonly List<ProdutoModel> _produtos =
    [
        new()
        {
            Id = "pr-001",
            ProductName = "Café Tradicional 500g",
            ProductCode = "CAF500",
            ProductSupplier = "Distribuidora Alfa",
            ProductDescription = "Café torrado e moído 500g",
            ProductQnt = "120",
            ProductUnitPrice = "14,90",
            ProductSalePrice = "18,90",
            TotalPriceOnProduct = "1.788,00"
        },
        new()
        {
            Id = "pr-002",
            ProductName = "Óleo de Soja",
            ProductCode = "OLE900",
            ProductSupplier = "Atacado Vitória",
            ProductDescription = "Óleo de soja 900ml",
            ProductQnt = "56",
            ProductUnitPrice = "3,29",
            ProductSalePrice = "6,99",
            TotalPriceOnProduct = "184,24"
        },
        new()
        {
            Id = "pr-003",
            ProductName = "Erva Chimarrão",
            ProductCode = "ERV500",
            ProductSupplier = "Distribuidora Alfa",
            ProductDescription = "Erva mate para chimarrão 500g",
            ProductQnt = "24",
            ProductUnitPrice = "9,80",
            ProductSalePrice = "15,00",
            TotalPriceOnProduct = "235,20"
        }
    ];

    private readonly List<ClienteModel> _clientes =
    [
        new()
        {
            Id = "cl-001",
            CustomerName = "Ana Martins",
            Document = "123.456.789-09",
            BirthDate = "16/10/1991",
            Age = "34",
            Cep = "06010-000",
            City = "Osasco",
            State = "SP",
            Address = "Rua Primitiva Vianco",
            Neighborhood = "Centro",
            Number = "100",
            Telephone = "(11) 3681-1000",
            Cellphone = "(11) 99888-1122",
            Email = "ana.martins@email.com"
        }
    ];

    private readonly List<FornecedorModel> _fornecedores =
    [
        new()
        {
            Id = "fr-001",
            CompanyName = "Distribuidora Alfa LTDA",
            FantasyName = "Distribuidora Alfa",
            Cnpj = "12.345.678/0001-95",
            Cep = "01001-000",
            City = "São Paulo",
            State = "SP",
            Address = "Praça da Sé",
            Neighborhood = "Sé",
            Number = "100",
            Telephone = "(11) 3322-1100",
            Cellphone = "(11) 98888-3344",
            Email = "comercial@alfa.com.br"
        },
        new()
        {
            Id = "fr-002",
            CompanyName = "Atacado Vitória LTDA",
            FantasyName = "Atacado Vitória",
            Cnpj = "98.765.432/0001-10",
            Cep = "20040-020",
            City = "Rio de Janeiro",
            State = "RJ",
            Address = "Rua da Quitanda",
            Neighborhood = "Centro",
            Number = "55",
            Telephone = "(21) 2222-1000",
            Cellphone = "(21) 97777-2211",
            Email = "vendas@vitoria.com.br"
        }
    ];

    public Task<List<ProdutoModel>> ListarProdutosAsync()
        => Task.FromResult(_produtos.Select(CloneProduto).ToList());

    public Task<ProdutoModel?> ObterProdutoAsync(string id)
        => Task.FromResult(_produtos.FirstOrDefault(item => item.Id == id) is { } product ? CloneProduto(product) : null);

    public Task<ProdutoModel> SalvarProdutoAsync(ProdutoModel product)
    {
        var current = _produtos.FirstOrDefault(item => item.Id == product.Id);
        if (current is null)
        {
            _produtos.Insert(0, CloneProduto(product));
            return Task.FromResult(CloneProduto(product));
        }

        var index = _produtos.IndexOf(current);
        _produtos[index] = CloneProduto(product);
        return Task.FromResult(CloneProduto(product));
    }

    public Task<bool> ExcluirProdutoAsync(string id)
    {
        var removed = _produtos.RemoveAll(item => item.Id == id) > 0;
        return Task.FromResult(removed);
    }

    public Task BaixarEstoqueAsync(IEnumerable<(string ProductCode, int Quantity)> items)
    {
        var groupedItems = items
            .GroupBy(item => item.ProductCode.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(group => new { ProductCode = group.Key, Quantity = group.Sum(item => item.Quantity) })
            .ToList();

        foreach (var item in groupedItems)
        {
            var product = _produtos.FirstOrDefault(product =>
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
            var product = _produtos.First(product =>
                product.ProductCode.Equals(item.ProductCode, StringComparison.OrdinalIgnoreCase));
            var nextStock = ParseInt(product.ProductQnt) - item.Quantity;
            product.ProductQnt = nextStock.ToString();
            product.TotalPriceOnProduct = CalculateTotal(product.ProductUnitPrice, nextStock);
        }

        return Task.CompletedTask;
    }

    public Task<List<ClienteModel>> ListarClientesAsync()
        => Task.FromResult(_clientes.Select(CloneCliente).ToList());

    public Task<ClienteModel?> ObterClienteAsync(string id)
        => Task.FromResult(_clientes.FirstOrDefault(item => item.Id == id) is { } customer ? CloneCliente(customer) : null);

    public Task<ClienteModel> SalvarClienteAsync(ClienteModel customer)
    {
        var current = _clientes.FirstOrDefault(item => item.Id == customer.Id);
        if (current is null)
        {
            _clientes.Insert(0, CloneCliente(customer));
            return Task.FromResult(CloneCliente(customer));
        }

        var index = _clientes.IndexOf(current);
        _clientes[index] = CloneCliente(customer);
        return Task.FromResult(CloneCliente(customer));
    }

    public Task<bool> ExcluirClienteAsync(string id)
    {
        var removed = _clientes.RemoveAll(item => item.Id == id) > 0;
        return Task.FromResult(removed);
    }

    public Task<List<FornecedorModel>> ListarFornecedoresAsync()
        => Task.FromResult(_fornecedores.Select(CloneFornecedor).ToList());

    public Task<FornecedorModel?> ObterFornecedorAsync(string id)
        => Task.FromResult(_fornecedores.FirstOrDefault(item => item.Id == id) is { } supplier ? CloneFornecedor(supplier) : null);

    public Task<FornecedorModel> SalvarFornecedorAsync(FornecedorModel supplier)
    {
        var current = _fornecedores.FirstOrDefault(item => item.Id == supplier.Id);
        if (current is null)
        {
            _fornecedores.Insert(0, CloneFornecedor(supplier));
            return Task.FromResult(CloneFornecedor(supplier));
        }

        var index = _fornecedores.IndexOf(current);
        _fornecedores[index] = CloneFornecedor(supplier);
        return Task.FromResult(CloneFornecedor(supplier));
    }

    public Task<bool> ExcluirFornecedorAsync(string id)
    {
        var removed = _fornecedores.RemoveAll(item => item.Id == id) > 0;
        return Task.FromResult(removed);
    }

    private static ProdutoModel CloneProduto(ProdutoModel source) => new()
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

    private static ClienteModel CloneCliente(ClienteModel source) => new()
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

    private static FornecedorModel CloneFornecedor(FornecedorModel source) => new()
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
}
