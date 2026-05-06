namespace HORUSPDV_API.Data.Entities;

public class ProdutoEntity
{
    public string Id { get; set; } = string.Empty;
    public string ProductImageUrl { get; set; } = string.Empty;
    public string ProductImageName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductSupplier { get; set; } = string.Empty;
    public string? SupplierId { get; set; }
    public FornecedorEntity? Supplier { get; set; }
    public string ProductDescription { get; set; } = string.Empty;
    public string ProductQnt { get; set; } = string.Empty;
    public string ProductUnitPrice { get; set; } = string.Empty;
    public string ProductSalePrice { get; set; } = string.Empty;
    public string TotalPriceOnProduct { get; set; } = string.Empty;
}

public class ClienteEntity
{
    public string Id { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string Document { get; set; } = string.Empty;
    public string BirthDate { get; set; } = string.Empty;
    public string Age { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Neighborhood { get; set; } = string.Empty;
    public string StreetComplement { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string ReferencePoint { get; set; } = string.Empty;
    public string Telephone { get; set; } = string.Empty;
    public string Cellphone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class FornecedorEntity
{
    public string Id { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string FantasyName { get; set; } = string.Empty;
    public string Cnpj { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Neighborhood { get; set; } = string.Empty;
    public string StreetComplement { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string ReferencePoint { get; set; } = string.Empty;
    public string Telephone { get; set; } = string.Empty;
    public string Cellphone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public List<ProdutoEntity> Products { get; set; } = [];
}

public class EmpresaEntity
{
    public string Id { get; set; } = "empresa-principal";
    public string FantasyName { get; set; } = string.Empty;
    public string CorporateName { get; set; } = string.Empty;
    public string Cnpj { get; set; } = string.Empty;
    public string StateRegistration { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string SacPhone { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string Neighborhood { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Uf { get; set; } = string.Empty;
    public string Complement { get; set; } = string.Empty;
}

public class SecurityUserEntity
{
    public string Id { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string LastLoginAt { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool MustChangePassword { get; set; }
    public List<SecuritySessionEntity> Sessions { get; set; } = [];
    public List<PasswordResetTokenEntity> PasswordResetTokens { get; set; } = [];
}

public class SecuritySessionEntity
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public SecurityUserEntity? User { get; set; }
    public string Device { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Ip { get; set; } = string.Empty;
    public string LastActive { get; set; } = string.Empty;
    public string Platform { get; set; } = "desktop";
    public DateTimeOffset CreatedAt { get; set; }
}

public class PasswordResetTokenEntity
{
    public string Token { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public SecurityUserEntity? User { get; set; }
    public string Email { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
}

public class CaixaSessionEntity
{
    public string Id { get; set; } = string.Empty;
    public DateTimeOffset OpenedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public string OpeningAmount { get; set; } = "0,00";
    public string ClosingAmount { get; set; } = "0,00";
    public string OperatorId { get; set; } = string.Empty;
    public SecurityUserEntity? Operator { get; set; }
    public string OperatorName { get; set; } = string.Empty;
    public string ClosedById { get; set; } = string.Empty;
    public string ClosedByName { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}

public class VendaEntity
{
    public string Id { get; set; } = string.Empty;
    public string SaleNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerCpf { get; set; } = string.Empty;
    public DateTimeOffset SaleDate { get; set; }
    public List<VendaItemEntity> Items { get; set; } = [];
}

public class VendaItemEntity
{
    public string Id { get; set; } = string.Empty;
    public string VendaId { get; set; } = string.Empty;
    public VendaEntity? Venda { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
}

public class ModuloMercadoEntity
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public List<ModuloMercadoRegistroEntity> Records { get; set; } = [];
}

public class ModuloMercadoRegistroEntity
{
    public string Id { get; set; } = string.Empty;
    public string ModuleId { get; set; } = string.Empty;
    public ModuloMercadoEntity? Module { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Meta { get; set; } = string.Empty;
}
