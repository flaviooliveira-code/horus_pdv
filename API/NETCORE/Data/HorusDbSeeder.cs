using HORUSPDV_API.Data.Entities;
using HORUSPDV_API.Services.Security;
using Microsoft.EntityFrameworkCore;

namespace HORUSPDV_API.Data;

public static class HorusDbSeeder
{
    public static async Task InitializeAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HorusDbContext>();
        await db.Database.EnsureCreatedAsync();
        await SeedAsync(db);
    }

    private static async Task SeedAsync(HorusDbContext db)
    {
        if (!await db.Usuarios.AnyAsync())
        {
            db.Usuarios.AddRange(
                CreateUser("usr-001", "123.456.789-01", "Flávio Oliveira", "flavio@hpdv.com.br", "(11) 98888-1111", "administrador", "ativo", "2026-02-10", "Admin@1234", false),
                CreateUser("usr-002", "234.567.890-12", "Maria Santos", "maria@hpdv.com.br", "(11) 97777-2222", "gerente", "ativo", "2026-02-15", "Gerente@1234", false),
                CreateUser("usr-003", "345.678.901-23", "João Costa", "joao@hpdv.com.br", "(11) 96666-3333", "atendente", "inativo", "2026-03-01", "Atendente@1234", true));
        }

        if (!await db.Fornecedores.AnyAsync())
        {
            db.Fornecedores.AddRange(
                new FornecedorEntity
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
                new FornecedorEntity
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
                });
        }

        if (!await db.Produtos.AnyAsync())
        {
            db.Produtos.AddRange(
                new ProdutoEntity
                {
                    Id = "pr-001",
                    ProductName = "Café Tradicional 500g",
                    ProductCode = "CAF500",
                    ProductSupplier = "Distribuidora Alfa",
                    SupplierId = "fr-001",
                    ProductDescription = "Café torrado e moído 500g",
                    ProductQnt = "120",
                    ProductUnitPrice = "14,90",
                    ProductSalePrice = "18,90",
                    TotalPriceOnProduct = "1.788,00"
                },
                new ProdutoEntity
                {
                    Id = "pr-002",
                    ProductName = "Óleo de Soja",
                    ProductCode = "OLE900",
                    ProductSupplier = "Atacado Vitória",
                    SupplierId = "fr-002",
                    ProductDescription = "Óleo de soja 900ml",
                    ProductQnt = "56",
                    ProductUnitPrice = "3,29",
                    ProductSalePrice = "6,99",
                    TotalPriceOnProduct = "184,24"
                },
                new ProdutoEntity
                {
                    Id = "pr-003",
                    ProductName = "Erva Chimarrão",
                    ProductCode = "ERV500",
                    ProductSupplier = "Distribuidora Alfa",
                    SupplierId = "fr-001",
                    ProductDescription = "Erva mate para chimarrão 500g",
                    ProductQnt = "24",
                    ProductUnitPrice = "9,80",
                    ProductSalePrice = "15,00",
                    TotalPriceOnProduct = "235,20"
                });
        }

        if (!await db.Clientes.AnyAsync())
        {
            db.Clientes.Add(new ClienteEntity
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
            });
        }

        if (!await db.Empresas.AnyAsync())
        {
            db.Empresas.Add(new EmpresaEntity
            {
                Id = "empresa-principal",
                FantasyName = "Festa & Fantasia",
                CorporateName = "Festa & Fantasia Comercio LTDA",
                Cnpj = "06.332.765/0001-05",
                StateRegistration = "123.456.789.110",
                Website = "https://www.horuspdv.com.br",
                Email = "contato@hpdv.com.br",
                SacPhone = "(11) 3000-1000",
                Phone = "(11) 3681-1000",
                Mobile = "(11) 98888-1000",
                Cep = "06010-000",
                Address = "Rua Primitiva Vianco",
                Number = "100",
                Neighborhood = "Centro",
                City = "Osasco",
                Uf = "SP",
                Complement = "Sala 12"
            });
        }

        if (!await db.CaixaSessoes.AnyAsync())
        {
            db.CaixaSessoes.Add(new CaixaSessionEntity
            {
                Id = "cx-001",
                OpenedAt = DateTimeOffset.Now.AddDays(-1).Date.AddHours(8),
                ClosedAt = DateTimeOffset.Now.AddDays(-1).Date.AddHours(18),
                OpeningAmount = "250,00",
                ClosingAmount = "3.418,90",
                OperatorId = "usr-001",
                OperatorName = "Flávio Oliveira",
                ClosedById = "usr-001",
                ClosedByName = "Flávio Oliveira",
                Note = "Fechamento do período anterior."
            });
        }

        if (!await db.Vendas.AnyAsync())
        {
            db.Vendas.AddRange(
                CreateSale("sale-15039", "15039", "Ana Martins", "123.456.789-09", "CAF500", "Café Tradicional 500g", 3, new DateTimeOffset(2026, 3, 21, 14, 12, 8, TimeSpan.Zero)),
                CreateSale("sale-15038", "15038", "Lucas Souza", "427.632.180-01", "ACH400", "Achocolatado 400g", 1, new DateTimeOffset(2026, 3, 21, 13, 42, 11, TimeSpan.Zero)),
                CreateSale("sale-15037", "15037", "Beatriz Lima", "064.822.390-16", "ARR5KG", "Arroz Tipo 1 5kg", 2, new DateTimeOffset(2026, 3, 21, 12, 55, 46, TimeSpan.Zero)));
        }

        if (!await db.ModulosMercado.AnyAsync())
        {
            foreach (var (id, title) in ModuleTitles())
            {
                db.ModulosMercado.Add(new ModuloMercadoEntity { Id = id, Title = title });
                db.ModuloMercadoRegistros.AddRange(CreateModuleRecords(id, title));
            }
        }

        await db.SaveChangesAsync();
    }

    private static SecurityUserEntity CreateUser(
        string id,
        string cpf,
        string name,
        string email,
        string phone,
        string role,
        string status,
        string createdAt,
        string password,
        bool mustChangePassword) => new()
    {
        Id = id,
        Cpf = cpf,
        Name = name,
        Email = email,
        Phone = phone,
        Role = role,
        Status = status,
        CreatedAt = createdAt,
        LastLoginAt = "-",
        PasswordHash = PasswordHasher.Hash(password),
        MustChangePassword = mustChangePassword
    };

    private static VendaEntity CreateSale(
        string id,
        string saleNumber,
        string customerName,
        string customerCpf,
        string productCode,
        string productName,
        int quantity,
        DateTimeOffset saleDate) => new()
    {
        Id = id,
        SaleNumber = saleNumber,
        CustomerName = customerName,
        CustomerCpf = customerCpf,
        SaleDate = saleDate,
        Items =
        [
            new VendaItemEntity
            {
                Id = $"{id}-item-001",
                ProductCode = productCode,
                ProductName = productName,
                Quantity = quantity
            }
        ]
    };

    private static IEnumerable<(string Id, string Title)> ModuleTitles()
    {
        yield return ("fiscal", "Fiscal NFC-e / NF-e");
        yield return ("pagamentos", "Pagamentos Integrados");
        yield return ("estoque", "Estoque e Inventário");
        yield return ("caixa", "Abertura e Fechamento de Caixa");
        yield return ("compras", "Compras e Reposição");
        yield return ("devolucoes", "Trocas e Devoluções");
        yield return ("crm-fidelidade", "CRM e Fidelidade");
        yield return ("omnichannel", "Omnichannel e Integrações");
    }

    private static IEnumerable<ModuloMercadoRegistroEntity> CreateModuleRecords(string id, string title)
    {
        yield return new ModuloMercadoRegistroEntity
        {
            Id = $"{id}-001",
            ModuleId = id,
            Title = $"{title} - Registro 001",
            Description = "Registro principal do módulo.",
            Status = "Ativo",
            Amount = "R$ 184,90",
            Meta = "Sincronizado agora"
        };
        yield return new ModuloMercadoRegistroEntity
        {
            Id = $"{id}-002",
            ModuleId = id,
            Title = $"{title} - Registro 002",
            Description = "Item aguardando validação operacional.",
            Status = "Pendente",
            Amount = "R$ 59,80",
            Meta = "Prioridade média"
        };
        yield return new ModuloMercadoRegistroEntity
        {
            Id = $"{id}-003",
            ModuleId = id,
            Title = $"{title} - Registro 003",
            Description = "Evento de auditoria e acompanhamento.",
            Status = "Auditado",
            Amount = "R$ 1.240,00",
            Meta = "Responsável: Administrador"
        };
    }
}
