# Hórus PDV API .NET

API ASP.NET Core do Hórus PDV.

## Stack

- .NET 8
- ASP.NET Core Web API
- Entity Framework Core
- SQL Server
- Swagger
- JWT

## Banco Local

Suba o SQL Server via Docker:

<pre><code class="language-bash">docker run -d \
  --name sqlserver \
  -e ACCEPT_EULA=Y \
  -e SA_PASSWORD='Senha@12345' \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2022-latest
</code></pre>

Connection string padrão:

<pre><code class="language-json">"ConnectionStrings": {
  "HorusPdv": "Server=localhost,1433;Database=HorusPdv;User Id=sa;Password=Senha@12345;TrustServerCertificate=True;Encrypt=True;MultipleActiveResultSets=True"
}</code></pre>

Ao iniciar, a API cria o banco `HorusPdv`, cria as tabelas com `EnsureCreated` e insere os dados iniciais.

## Rodando

<pre><code class="language-bash">dotnet restore
dotnet build
dotnet run --urls http://localhost:5260
</code></pre>

Swagger:

<pre><code class="language-text">http://localhost:5260/swagger
</code></pre>

## Tabelas

- `Usuarios`
- `Sessoes`
- `PasswordResetTokens`
- `Produtos`
- `Fornecedores`
- `Clientes`
- `Empresas`
- `CaixaSessoes`
- `Vendas`
- `VendaItens`
- `ModulosMercado`
- `ModuloMercadoRegistros`

## Próximo Passo Técnico

Trocar `EnsureCreated` por migrations versionadas antes de produção.
