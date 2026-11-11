# Hórus PDV

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-f59e0b)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-2563eb)
![Backend](https://img.shields.io/badge/backend-.NET%208-512bd4)
![License](https://img.shields.io/badge/license-MIT-16a34a)

Hórus PDV é um PDV grátis para frente de caixa e gestão operacional de pequenos e médios comércios.

O projeto está em evolução ativa, com sistema de cadastro grátis para clientes, fornecedores e produtos, controle de estoque, vendas, caixa e relatórios. A base usa frontend em React, API em ASP.NET Core e persistência em SQL Server para os dados operacionais principais.

Página inicial do projeto: https://flaviooliveira.dev/horus-pdv/

## Sumário

- [Status do Projeto](#status-do-projeto)
- [Stack](#stack)
- [Funcionalidades](#funcionalidades)
- [Screenshots](#screenshots)
- [Estrutura](#estrutura)
- [Quick Start](#quick-start)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Smoke Test](#smoke-test)
- [Validação Local](#validação-local)
- [Autenticação e Segurança](#autenticação-e-segurança)
- [Padrões de Interface](#padrões-de-interface)
- [Pagamentos Integrados](#pagamentos-integrados)
- [Módulos em Desenvolvimento](#módulos-em-desenvolvimento)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)
- [Licença](#licença)
- [Autor](#autor)

## Status do Projeto

Este repositório está em fase de desenvolvimento. O frontend já conversa com a API .NET e a API cria o banco `HorusPdv` no SQL Server local quando a aplicação sobe.

| Área                  | Status                                  |
| --------------------- | --------------------------------------- |
| Frontend React        | Em desenvolvimento ativo                |
| API .NET              | Em desenvolvimento ativo                |
| Autenticação          | JWT em cookie HttpOnly                  |
| reCAPTCHA v3          | Implementado, opcional por configuração |
| Banco de dados        | SQL Server conectado                    |
| Smoke test E2E        | Implementado                            |
| Fiscal NFC-e / NF-e   | Em desenvolvimento                      |
| Pagamentos integrados | Gateways, PIX no caixa, boleto e webhooks |
| Sistema legado (branch legacy) | Mantido como referência histórica       |

## Stack

**Frontend**

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Recharts

**Backend**

- .NET 8
- ASP.NET Core Web API
- Swagger
- JWT em cookie HttpOnly
- Rate limit local
- Acesso manual ao SQL Server com `Microsoft.Data.SqlClient`
- SQL Server

## Funcionalidades

- Login com sessão JWT em cookie HttpOnly.
- Cadastro público por CNPJ.
- Recuperação e redefinição de senha.
- Gestão de clientes, fornecedores e produtos.
- Frente de caixa com carrinho, pagamento e baixa de estoque.
- Abertura e fechamento de caixa.
- Histórico de vendas com valores, reimpressão e prévia de cupom não fiscal.
- Relatórios.
- Minha empresa, licença, perfil e configurações.
- Gestão de usuários.
- Gestão avançada: estoque, abertura/fechamento, compras, trocas/devoluções, CRM/fidelidade e omnichannel.
- Configuração SMTP por empresa.
- Cadastro de gateways de pagamento (Asaas, Mercado Pago e PagBank) com validação de credencial.
- PIX com QR Code na frente de caixa e boletos para clientes cadastrados, com confirmação por webhook ou consulta ao provedor.
- Tour guiado por tela.
- Temas light/dark.

## Screenshots

Para visualizar em formato de slides, abra a página inicial e clique em qualquer screenshot:

<pre><code class="language-text">https://flaviooliveira.dev/horus-pdv/
</code></pre>

<table>
  <tr>
    <td width="50%">
      <strong>Login</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/login.png" alt="Tela de login do Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Dashboard</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/dashboard.png" alt="Dashboard do Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Clientes</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/clientes.png" alt="Cadastro de clientes no Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Fornecedores</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/fornecedores.png" alt="Cadastro de fornecedores no Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Produtos</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/produtos.png" alt="Cadastro de produtos no Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Usuários</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/usuarios.png" alt="Gestão de usuários no Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Frente de Caixa</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/frente-caixa.png" alt="Frente de caixa do Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Histórico de Vendas</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/historico-vendas.png" alt="Histórico de vendas do Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Relatórios</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/relatorios.png" alt="Relatórios do Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Fiscal</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/fiscal.png" alt="Módulo fiscal do Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Pagamentos Integrados</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/pagamentos.png" alt="Pagamentos integrados do Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Estoque e Inventário</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/estoque-inventario.png" alt="Estoque e inventário do Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Abertura e Fechamento</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/abertura-fechamento.png" alt="Abertura e fechamento de caixa no Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Compras e Reposição</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/compras-reposicao.png" alt="Compras e reposição no Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Trocas e Devoluções</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/trocas-devolucoes.png" alt="Trocas e devoluções no Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>CRM e Fidelidade</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/crm-fidelidade.png" alt="CRM e fidelidade no Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Omnichannel</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/omnichannel.png" alt="Omnichannel no Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Minha Empresa</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/minha-empresa.png" alt="Página Minha Empresa do Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Detalhes da Licença</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/detalhes-licenca.png" alt="Detalhes da licença do Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Sobre PDV</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/sobre-pdv.png" alt="Página Sobre PDV do Hórus PDV" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Configurações</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/configuracoes.png" alt="Configurações do Hórus PDV" /></a>
    </td>
    <td width="50%">
      <strong>Perfil</strong><br />
      <a href="https://flaviooliveira.dev/horus-pdv/"><img src="docs/images/editar-perfil.png" alt="Perfil do usuário no Hórus PDV" /></a>
    </td>
  </tr>
</table>

## Estrutura

<pre><code class="language-text">horus_pdv/
├── API/
│   └── NETCORE/          # API ASP.NET Core
├── FRONTEND/             # Aplicação React + Vite
├── LICENSE
└── README.md
</code></pre>

## Quick Start

### Requisitos

- Node.js 20+
- npm 10+
- .NET SDK 8+

### 1. Clonar o projeto

<pre><code class="language-bash">git clone https://github.com/flaviooliveira-code/horus_pdv.git
cd horus_pdv
</code></pre>

### 2. Configurar o frontend

<pre><code class="language-bash">cd FRONTEND
cp .env.example .env
npm install
</code></pre>

### 3. Subir a API .NET

O projeto espera um SQL Server local na porta `1433`. Exemplo com Docker:

<pre><code class="language-bash">docker run -d \
  --name sqlserver2025 \
  -e ACCEPT_EULA=Y \
  -e SA_PASSWORD='Senha@12345' \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2025-latest
</code></pre>

Se o container já existir e estiver parado:

<pre><code class="language-bash">docker start sqlserver2025
</code></pre>

Em outro terminal:

<pre><code class="language-bash">cd API/NETCORE
dotnet restore
dotnet run --urls http://localhost:5260
</code></pre>

Swagger local:

<pre><code class="language-text">http://localhost:5260/swagger
</code></pre>

### 4. Subir o frontend

<pre><code class="language-bash">cd FRONTEND
npm run dev
</code></pre>

URL local padrão:

<pre><code class="language-text">http://localhost:5173
</code></pre>

## Variáveis de Ambiente

O frontend usa um arquivo `.env` para mapear os endpoints da API.

Exemplo:

<pre><code class="language-env">VITE_AUTH_API_URL=http://localhost:5260/api/Auth
VITE_PRODUTO_API_URL=http://localhost:5260/api/Produto
VITE_CLIENTE_API_URL=http://localhost:5260/api/Cliente
VITE_FORNECEDOR_API_URL=http://localhost:5260/api/Fornecedor
VITE_EMPRESA_API_URL=http://localhost:5260/api/Empresa
VITE_CAIXA_API_URL=http://localhost:5260/api/Caixa
VITE_HISTORICO_VENDAS_API_URL=http://localhost:5260/api/HistoricoVendas
VITE_GATEWAY_PAGAMENTO_API_URL=http://localhost:5260/api/GatewayPagamento
VITE_COBRANCA_PAGAMENTO_API_URL=http://localhost:5260/api/CobrancaPagamento
VITE_RECAPTCHA_SITE_KEY=
</code></pre>

Arquivos disponíveis:

- `FRONTEND/.env.example`
- `FRONTEND/.env.development`
- `FRONTEND/.env.prod`

Na API, `API/NETCORE/appsettings.json` fica sem segredos reais. Para desenvolvimento local, use `API/NETCORE/appsettings.Development.json`, variáveis de ambiente ou User Secrets. Em produção, configure connection string, `Auth:JwtSecret`, `Security:EncryptionKey`, CORS, reCAPTCHA e SMTP fora do repositório.

## Scripts

### Frontend

<pre><code class="language-bash">cd FRONTEND
npm run dev          # servidor local Vite
npm run dev:dev      # Vite em modo development
npm run dev:prod     # Vite em modo prod
npm run lint         # ESLint
npm run build:dev    # build usando env de desenvolvimento
npm run build:prod   # build usando env de produção
npm run preview      # preview do build
npm run smoke         # smoke test frontend + API
npm run smoke:headed  # smoke test com navegador visível
npm run smoke:keep    # smoke com navegador visível e dados mantidos para conferência
npm run demo:video    # grava docs/videos/horus-pdv-demo.webm para o GitHub Pages
</code></pre>

Para ajustar o ritmo do vídeo demonstrativo:

<pre><code class="language-bash">DEMO_SLOW_MO=320 DEMO_PAUSE_MULTIPLIER=1.55 npm run demo:video
</code></pre>

### API .NET

<pre><code class="language-bash">cd API/NETCORE
dotnet restore
dotnet build
dotnet run --urls http://localhost:5260
</code></pre>

## Smoke Test

O smoke test sobe a API e o frontend automaticamente, cria uma conta pública, autentica com cookie HttpOnly, valida navegação, executa operações principais via API e limpa os dados criados com prefixo `SMOKE_`.

Pré-requisito: Docker Desktop e SQL Server local precisam estar rodando antes da execução.

Primeiro uso na máquina:

<pre><code class="language-bash">cd FRONTEND
npm run smoke:install
npm run smoke
</code></pre>

Execução recorrente:

<pre><code class="language-bash">cd FRONTEND
npm run smoke
</code></pre>

Execução para conferir dados no banco:

<pre><code class="language-bash">cd FRONTEND
npm run smoke:keep
</code></pre>

Variáveis opcionais:

- `SMOKE_APP_URL`, padrão `http://localhost:5173`.
- `SMOKE_API_URL`, padrão `http://localhost:5260/api`.
- `SMOKE_SQL_CONTAINER`, padrão `sqlserver2025`.
- `SMOKE_SQL_PASSWORD`, padrão `Senha@12345`.
- `SMOKE_KEEP_DATA=1`, mantém os dados criados no banco para conferência manual.

O SQL Server Docker precisa estar rodando. O teste exige que o container configurado esteja com estado `running`; se ele estiver parado, o smoke falha antes de tentar `docker exec`. O teste desativa temporariamente o disparo real de e-mail da empresa durante a execução e restaura a configuração ao final. A validação de reset de senha não depende de SMTP externo.

Se o smoke falhar com erro de conexão no SQL Server, suba o Docker Desktop e inicie o container:

<pre><code class="language-bash">open -a Docker
docker start sqlserver2025
</code></pre>

O script `smoke:keep` usa `SMOKE_RUN_ID=SMOKE_CONFERE` e `SMOKE_KEEP_DATA=1`.
Se quiser outro prefixo manualmente:

<pre><code class="language-bash">cd FRONTEND
SMOKE_RUN_ID=SMOKE_CONFERE SMOKE_KEEP_DATA=1 npm run smoke
</code></pre>

Depois procure no banco por `SMOKE_CONFERE%` em `Usuarios`, `Clientes`, `Fornecedores`, `Produtos`, `Vendas`, `CaixaSessoes` e `ModuloMercadoRegistros`.

## Validação Local

Última validação local executada em **10/06/2026**:

<pre><code class="language-bash">dotnet build API/NETCORE/HORUSPDV-API.sln
cd FRONTEND
npm run build
npm run smoke
</code></pre>

Resultado: build da API, build do frontend e smoke test completo passaram.

Observação: durante a validação, o smoke encontrou um caixa antigo aberto fora do período permitido. O teste foi ajustado para fechar caixa expirado antes de abrir o caixa da execução atual, preservando a regra de negócio da API.

## Autenticação e Segurança

O projeto já possui uma base de segurança para desenvolvimento:

- JWT assinado com sessão persistida.
- Cookie HttpOnly para sessão autenticada; o frontend não armazena token JWT em `localStorage`.
- Middleware de autenticação com suporte a cookie e Bearer token legado.
- Controle de sessão ativa.
- Rate limit local.
- Bloqueio por tentativas inválidas de login.
- Recuperação de senha por token temporário.
- reCAPTCHA v3 opcional para login, cadastro e recuperação de senha.
- CORS configurado para ambientes locais do frontend com credenciais.
- Swagger disponível apenas em ambiente `Development`.

> Importante: antes de produção, defina `Auth:JwtSecret`, `Security:EncryptionKey`, connection string, CORS e reCAPTCHA por variável de ambiente ou secret manager. Não versionar segredos reais.

## Padrões de Interface

Para escolhas booleanas voltadas ao usuário final, use sempre o controle segmentado `Sim/Não`, no padrão visual da página de Configurações.

Componente padrão:

<pre><code class="language-text">FRONTEND/src/components/Form/YesNoSegmentedControl.tsx
</code></pre>

Uso:

<pre><code class="language-tsx">import { YesNoSegmentedControl } from "@/components/Form";

&lt;YesNoSegmentedControl
  value={enabled}
  onChange={setEnabled}
  ariaLabel="Ativar recurso"
/&gt;
</code></pre>

Não use checkbox cru para preferências como "ativar/desativar", "mostrar/ocultar", "enviar/não enviar" ou decisões equivalentes de `Sim/Não`.

## Pagamentos Integrados

Em **Integrações › Pagamentos Integrados**, administradores e gerentes conectam as contas de gateway que vão receber PIX e boleto.

| Provedor     | Credencial                                           | Validação                                   |
| ------------ | ---------------------------------------------------- | ------------------------------------------- |
| Asaas        | API Key (Integrações › Chaves de API)                | Consulta o saldo da conta (`/v3/finance/balance`) |
| Mercado Pago | Access Token (Suas integrações › Credenciais)        | Consulta a conta (`/users/me`)              |
| PagBank      | Access Token (Minha conta › Integrações)             | Confere o formato; o token é validado na primeira cobrança |

Como funciona:

- Cada conta tem ambiente (Produção ou Sandbox), nome, status (Pendente, Validado, Erro ou Inativo) e regras do boleto (vencimento em dias, multa e juros ao mês).
- A empresa tem no máximo um gateway padrão para PIX e um para boleto. Marcar outro como padrão tira o padrão do anterior.
- "Somente PIX" vale para Mercado Pago e PagBank. O Asaas sempre emite boleto com PIX.
- Credenciais são gravadas criptografadas com `Security:EncryptionKey` e a API devolve só a máscara (`abcd••••wxyz`). Para manter a chave salva na edição, deixe o campo em branco.
- Trocar a credencial, o provedor ou o ambiente faz o status voltar a Pendente até nova validação.
- A Public Key do Mercado Pago é recusada no lugar do Access Token.

Endpoints (`/api/GatewayPagamento`):

<pre><code class="language-text">GET    /api/GatewayPagamento
POST   /api/GatewayPagamento
PUT    /api/GatewayPagamento/{id}
DELETE /api/GatewayPagamento/{id}
POST   /api/GatewayPagamento/{id}/validate

GET    /api/CobrancaPagamento
POST   /api/CobrancaPagamento
GET    /api/CobrancaPagamento/{id}          # consulta e sincroniza com o provedor
POST   /api/CobrancaPagamento/{id}/cancel
</code></pre>

### Cobranças PIX e boleto

- **Frente de caixa:** com PIX selecionado, "Gerar QR Code PIX" emite a cobrança no gateway padrão de PIX e mostra o QR Code e o copia e cola. O PDV consulta o pagamento a cada 3 segundos e registra a venda sozinho quando o PIX cai. Fechar o pagamento com um QR Code aberto pede para cancelar a cobrança. Sem gateway, "Confirmar PIX recebido" registra o PIX manual, como antes.
- **Venda ligada ao PIX:** a API só aceita uma venda com `paymentChargeId` se a cobrança estiver paga, for da mesma empresa, tiver o mesmo valor e não estiver ligada a outra venda. Se não estiver, a venda e a baixa de estoque são desfeitas.
- **Aba Cobranças:** lista os PIX e boletos emitidos (status, valor, vencimento, venda), emite boleto ou PIX para um cliente cadastrado e permite atualizar o status, copiar a linha digitável ou o copia e cola, abrir o boleto e cancelar.
- **Dados do pagador:** Asaas e PagBank exigem CPF/CNPJ (no caixa, use "CPF na nota"). Mercado Pago e PagBank exigem e-mail; sem e-mail do cliente, a API usa o e-mail da empresa. O boleto do Mercado Pago e do PagBank exige o endereço completo do cliente.
- **Validade:** o QR Code vale 30 minutos. O boleto vence nos dias definidos na regra do gateway, ou em 3 dias.
- **Cancelamento:** no Asaas e no Mercado Pago, cancela também no provedor. No PagBank, a API de pedidos não cancela cobrança em aberto; ela é encerrada no Hórus PDV e expira sozinha. Cobrança paga não é cancelada (o estorno é feito no painel do provedor).

### Webhooks

`POST /api/Webhooks/{asaas|mercado-pago|pagbank}/{gatewayId}` é público e autentica cada aviso pela assinatura do provedor:

| Provedor     | Autenticação                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Asaas        | Header `asaas-access-token` igual ao segredo gerado ao cadastrar o webhook (Validar)              |
| Mercado Pago | HMAC `x-signature` com a assinatura secreta do gateway, com tolerância de 5 minutos (opcional)     |
| PagBank      | `x-authenticity-token` = `sha256(token + "-" + corpo)`                                            |

O aviso nunca é usado como prova de pagamento: a API pega só o id e consulta o status no provedor.

Para receber webhooks, configure a URL pública da API (HTTPS):

<pre><code class="language-bash">Payments__WebhookPublicBaseUrl="https://api.seudominio.com.br"
</code></pre>

Com ela, Mercado Pago e PagBank recebem a URL de aviso em cada cobrança, e o Asaas tem o webhook da conta cadastrado ao clicar em **Validar**. Sem ela (por exemplo, rodando local), tudo funciona por consulta: o PDV acompanha o PIX e a aba Cobranças tem o botão **Status**.

Ainda não implementado: estorno de cobrança paga, cartão/TEF e relatórios de conciliação (taxas e repasses).

## Módulos em Desenvolvimento

Algumas áreas aparecem no menu para indicar a direção do produto, mas ainda não devem ser usadas em operação real:

- Fiscal NFC-e / NF-e.
- Pagamentos integrados: gateways, PIX e boleto funcionam; estorno e cartão/TEF ainda não.

A página fiscal mostra estado visual de "Em desenvolvimento" até as integrações e homologações ficarem prontas.

## Dados e Persistência

A API usa SQL Server com scripts manuais, seguindo o padrão de `DataBase/Resumo.sql`. No start, a aplicação executa esse script para criar o banco, tabelas, relacionamentos e dados iniciais quando ainda não existirem.

O script também aplica ajustes seguros de schema já existentes e faz backfill de valores de vendas antigas quando `VendaItens.UnitPrice` ou `VendaItens.ItemTotal` ainda estiverem vazios/zerados.

Banco padrão:

<pre><code class="language-text">HorusPdv
</code></pre>

Tabelas principais:

- `Usuarios`, `Sessoes`, `PasswordResetTokens`
- `Produtos`, `Fornecedores`, `Clientes`
- `Empresas`
- `CaixaSessoes`
- `Vendas`, `VendaItens`
- `ModulosMercado`, `ModuloMercadoRegistros`
- `GatewaysPagamento`, `CobrancasPagamento`

Script principal:

<pre><code class="language-text">API/NETCORE/DataBase/Resumo.sql
</code></pre>

## Roadmap

- Versionar evoluções de banco em scripts SQL incrementais.
- Expandir seeds e rotinas de migração manual.
- Expandir testes automatizados.
- Consolidar regras fiscais.
- Estorno de cobranças pagas e relatórios de conciliação (taxas e repasses) por gateway.
- Integrar TEF/adquirentes.
- Melhorar documentação técnica da API.
- Criar guias de deploy.

## Contribuindo

Contribuições são bem-vindas.

Fluxo sugerido:

<pre><code class="language-bash">git checkout -b feature/minha-melhoria
npm --prefix FRONTEND run lint
npm --prefix FRONTEND run build:prod
dotnet build API/NETCORE
</code></pre>

Antes de abrir um pull request:

- Explique o problema resolvido.
- Liste arquivos ou módulos impactados.
- Informe como validou a mudança.
- Evite misturar refatorações grandes com correções pequenas.

## Licença

Este projeto está sob licença MIT. Consulte [LICENSE](./LICENSE).

## Autor

Criado por **Flávio Oliveira**.

- GitHub: <https://github.com/flaviooliveira-code>
- LinkedIn: <https://www.linkedin.com/in/fladoliveira>
