# Hórus PDV API .NET

API ASP.NET Core do Hórus PDV.

## Stack

- .NET 8
- ASP.NET Core Web API
- Microsoft.Data.SqlClient
- SQL Server
- Swagger
- JWT em cookie HttpOnly

## Banco Local

Suba o SQL Server via Docker:

<pre><code class="language-bash">docker run -d \
  --name sqlserver2025 \
  -e ACCEPT_EULA=Y \
  -e SA_PASSWORD='Senha@12345' \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2025-latest
</code></pre>

Connection string local de desenvolvimento:

<pre><code class="language-json">"ConnectionStrings": {
  "HorusPdv": "Server=localhost,1433;Database=HorusPdv;User Id=sa;Password=Senha@12345;TrustServerCertificate=True;Encrypt=True;MultipleActiveResultSets=True"
}</code></pre>

Se seu container estiver publicado em outra porta, ajuste o host da connection string local. Exemplo: `docker ps` mostrando `0.0.0.0:1434->1433/tcp` exige `Server=localhost,1434`.

Não use essa senha em produção. Para ambientes publicados, configure a conexão fora do repositório, por exemplo com `HORUSPDV_CONNECTION_STRING` ou o secret manager da hospedagem. O `appsettings.json` versionado não deve conter connection string, segredo JWT ou chave de criptografia reais.

Ao iniciar, a API executa `DataBase/Resumo.sql` para criar o banco `HorusPdv`, criar tabelas/relacionamentos e inserir os dados iniciais quando ainda não existirem.

Script principal:

<pre><code class="language-text">DataBase/Resumo.sql
</code></pre>

## E-mail

O remetente configurado é:

<pre><code class="language-text">naoresponderhoruspdv@outlook.com
</code></pre>

O envio é SMTP simples, no mesmo modelo usado com Gmail: host, porta, usuário e senha de app. Não coloque a senha em arquivo versionado. Configure localmente com User Secrets:

<pre><code class="language-bash">cd API/NETCORE
dotnet user-secrets set "Email:Enabled" "true"
dotnet user-secrets set "Email:Password" "SUA_SENHA_DE_APP_AQUI"
</code></pre>

Configurações de exemplo:

<pre><code class="language-json">"Email": {
  "Host": "smtp-mail.outlook.com",
  "Port": 587,
  "User": "naoresponderhoruspdv@outlook.com",
  "FromEmail": "naoresponderhoruspdv@outlook.com",
  "FrontendBaseUrl": "https://seu-frontend.example.com"
}</code></pre>

Para conta `@outlook.com`, o host padrão é `smtp-mail.outlook.com`, porta `587`, com STARTTLS. Para conta Microsoft 365 corporativa, use `smtp.office365.com`.

Se o envio SMTP retornar `SmtpClientAuthentication is disabled for the Mailbox`, o código está chegando no Outlook, mas a caixa postal está bloqueando SMTP autenticado. Nesse caso, a conta precisa liberar envio SMTP/autenticação por app ou o remetente precisa ser trocado por uma conta que aceite senha de app via SMTP.

Em operação, a configuração principal fica em `Minha Empresa > Configuração de e-mail`, salva na tabela `Empresas`. Quando ela estiver ativa, os disparos usam o SMTP da empresa; quando estiver desativada, a API usa o fallback de `appsettings`/User Secrets para desenvolvimento. A senha SMTP não é devolvida pela API, apenas o indicador de senha configurada.

A senha SMTP é gravada criptografada no banco. Em produção, configure uma chave forte por variável de ambiente ou secret manager:

<pre><code class="language-bash">Security__EncryptionKey="UMA_CHAVE_FORTE_COM_PELO_MENOS_32_CARACTERES"
</code></pre>

Exemplo para Gmail, se você decidir usar uma caixa Gmail no futuro:

<pre><code class="language-bash">dotnet user-secrets set "Email:Host" "smtp.gmail.com"
dotnet user-secrets set "Email:Port" "587"
dotnet user-secrets set "Email:User" "seu-email@gmail.com"
dotnet user-secrets set "Email:FromEmail" "seu-email@gmail.com"
dotnet user-secrets set "Email:Password" "SENHA_DE_APP_DO_GMAIL"
</code></pre>

Para testar outro host sem mexer no arquivo:

<pre><code class="language-bash">dotnet user-secrets set "Email:Host" "smtp-mail.outlook.com"
dotnet user-secrets set "Email:Port" "587"
</code></pre>

## Rodando

<pre><code class="language-bash">dotnet restore
dotnet build
dotnet run --urls http://localhost:5260
</code></pre>

Swagger fica disponível apenas em ambiente `Development`:

<pre><code class="language-text">http://localhost:5260/swagger
</code></pre>

## Autenticação

O login emite JWT assinado e grava a sessão em cookie HttpOnly (`horuspdv.auth`). O frontend usa `credentials: "include"` nas chamadas HTTP e não armazena o token JWT em `localStorage`.

Em desenvolvimento, o cookie não exige HTTPS e usa `SameSite=Lax`. Em produção, o cookie é `Secure` e a API valida `Auth:JwtSecret` e `Security:EncryptionKey`; configure esses valores por variável de ambiente ou secret manager.

O middleware ainda aceita `Authorization: Bearer` para compatibilidade, mas o fluxo principal do frontend é por cookie.

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
- `GatewaysPagamento`

## Gateways de Pagamento

Em `Pagamentos Integrados`, administradores e gerentes cadastram contas de **Asaas**, **Mercado Pago** e **PagBank** (`/api/GatewayPagamento`), em Produção ou Sandbox.

- O Access Token / API Key e a assinatura de webhook são gravados criptografados com `Security:EncryptionKey`. A API devolve só a máscara (`abcd••••wxyz`). Enviar a credencial em branco na edição mantém a salva.
- `POST /api/GatewayPagamento/{id}/validate` testa a credencial no provedor, só com leitura: Asaas `GET /v3/finance/balance`, Mercado Pago `GET /users/me`. No PagBank, só o formato é conferido; o token é validado na primeira cobrança.
- Cada empresa tem no máximo um gateway padrão para PIX e um para boleto. "Somente PIX" vale para Mercado Pago e PagBank.
- `Payments:MercadoPagoApiBaseUrl` troca a URL da API do Mercado Pago (útil para testes).

A emissão de cobranças e o recebimento de webhooks ainda não estão implementados.

## Organização dos Repositórios

- `Repositories/DataAccess`: classes `*AD`, usadas para transportar dados vindos do banco.
- `Repositories/DatabaseAccess`: classes `*AB`, responsáveis por SQL e acesso ao banco.
- `Services`: regras de negócio e orquestração, sem `SqlCommand`.
- `Controllers`: HTTP/API, sem SQL direto.

## Próximo Passo Técnico

Criar scripts SQL incrementais para cada evolução de schema antes de produção.
