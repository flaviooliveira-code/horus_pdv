using HORUSPDV_API.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace HORUSPDV_API.Data;

public class HorusDbContext(DbContextOptions<HorusDbContext> options) : DbContext(options)
{
    public DbSet<ProdutoEntity> Produtos => Set<ProdutoEntity>();
    public DbSet<ClienteEntity> Clientes => Set<ClienteEntity>();
    public DbSet<FornecedorEntity> Fornecedores => Set<FornecedorEntity>();
    public DbSet<EmpresaEntity> Empresas => Set<EmpresaEntity>();
    public DbSet<SecurityUserEntity> Usuarios => Set<SecurityUserEntity>();
    public DbSet<SecuritySessionEntity> Sessoes => Set<SecuritySessionEntity>();
    public DbSet<PasswordResetTokenEntity> PasswordResetTokens => Set<PasswordResetTokenEntity>();
    public DbSet<CaixaSessionEntity> CaixaSessoes => Set<CaixaSessionEntity>();
    public DbSet<VendaEntity> Vendas => Set<VendaEntity>();
    public DbSet<VendaItemEntity> VendaItens => Set<VendaItemEntity>();
    public DbSet<ModuloMercadoEntity> ModulosMercado => Set<ModuloMercadoEntity>();
    public DbSet<ModuloMercadoRegistroEntity> ModuloMercadoRegistros => Set<ModuloMercadoRegistroEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ProdutoEntity>(entity =>
        {
            entity.ToTable("Produtos");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(40);
            entity.Property(item => item.ProductCode).HasMaxLength(80).IsRequired();
            entity.HasIndex(item => item.ProductCode).IsUnique();
            entity.HasOne(item => item.Supplier)
                .WithMany(item => item.Products)
                .HasForeignKey(item => item.SupplierId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ClienteEntity>(entity =>
        {
            entity.ToTable("Clientes");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(40);
            entity.HasIndex(item => item.Document).IsUnique();
        });

        modelBuilder.Entity<FornecedorEntity>(entity =>
        {
            entity.ToTable("Fornecedores");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(40);
            entity.HasIndex(item => item.Cnpj).IsUnique();
        });

        modelBuilder.Entity<EmpresaEntity>(entity =>
        {
            entity.ToTable("Empresas");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(40);
        });

        modelBuilder.Entity<SecurityUserEntity>(entity =>
        {
            entity.ToTable("Usuarios");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(40);
            entity.HasIndex(item => item.Email).IsUnique();
            entity.HasIndex(item => item.Cpf).IsUnique();
        });

        modelBuilder.Entity<SecuritySessionEntity>(entity =>
        {
            entity.ToTable("Sessoes");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(80);
            entity.HasOne(item => item.User)
                .WithMany(item => item.Sessions)
                .HasForeignKey(item => item.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PasswordResetTokenEntity>(entity =>
        {
            entity.ToTable("PasswordResetTokens");
            entity.HasKey(item => item.Token);
            entity.Property(item => item.Token).HasMaxLength(120);
            entity.HasOne(item => item.User)
                .WithMany(item => item.PasswordResetTokens)
                .HasForeignKey(item => item.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CaixaSessionEntity>(entity =>
        {
            entity.ToTable("CaixaSessoes");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(40);
            entity.HasOne(item => item.Operator)
                .WithMany()
                .HasForeignKey(item => item.OperatorId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<VendaEntity>(entity =>
        {
            entity.ToTable("Vendas");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(40);
            entity.HasIndex(item => item.SaleNumber).IsUnique();
        });

        modelBuilder.Entity<VendaItemEntity>(entity =>
        {
            entity.ToTable("VendaItens");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(40);
            entity.HasOne(item => item.Venda)
                .WithMany(item => item.Items)
                .HasForeignKey(item => item.VendaId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ModuloMercadoEntity>(entity =>
        {
            entity.ToTable("ModulosMercado");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(80);
        });

        modelBuilder.Entity<ModuloMercadoRegistroEntity>(entity =>
        {
            entity.ToTable("ModuloMercadoRegistros");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(100);
            entity.HasOne(item => item.Module)
                .WithMany(item => item.Records)
                .HasForeignKey(item => item.ModuleId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
