# Hórus PDV

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-f59e0b)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-2563eb)
![Backend](https://img.shields.io/badge/backend-.NET%208-512bd4)
![License](https://img.shields.io/badge/license-MIT-16a34a)

Hórus PDV é um projeto open source de frente de caixa e gestão operacional para pequenos e médios comércios.

O projeto está em evolução ativa, com frontend em React, API em ASP.NET Core e persistência em SQL Server para os dados operacionais principais.

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
- [Módulos em Desenvolvimento](#módulos-em-desenvolvimento)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)
- [Licença](#licença)
- [Autor](#autor)

## Status do Projeto

Este repositório está em fase de desenvolvimento. O frontend já conversa com a API .NET e a API cria o banco `HorusPdv` no SQL Server local quando a aplicação sobe.

| Área | Status |
| --- | --- |
| Frontend React | Em desenvolvimento ativo |
| API .NET | Em desenvolvimento ativo |
| Autenticação JWT | Implementada |
| reCAPTCHA v3 | Implementado, opcional por configuração |
| Banco de dados | SQL Server conectado |
| Smoke test E2E | Implementado |
| Fiscal NFC-e / NF-e | Em desenvolvimento |
| Pagamentos integrados | Em desenvolvimento |
| Sistema legado | Mantido como referência histórica |

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
- JWT
- Rate limit local
- Acesso manual ao SQL Server com `Microsoft.Data.SqlClient`
- SQL Server

## Funcionalidades

- Login com JWT.
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
- Tour guiado por tela.
- Temas light/dark.

## Screenshots

<table>
  <tr>
    <td width="50%">
      <strong>Login</strong><br />
      <img src="docs/images/login.png" alt="Tela de login do Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Dashboard</strong><br />
      <img src="docs/images/dashboard.png" alt="Dashboard do Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Clientes</strong><br />
      <img src="docs/images/clientes.png" alt="Cadastro de clientes no Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Fornecedores</strong><br />
      <img src="docs/images/fornecedores.png" alt="Cadastro de fornecedores no Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Produtos</strong><br />
      <img src="docs/images/produtos.png" alt="Cadastro de produtos no Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Usuários</strong><br />
      <img src="docs/images/usuarios.png" alt="Gestão de usuários no Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Frente de Caixa</strong><br />
      <img src="docs/images/frente-caixa.png" alt="Frente de caixa do Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Histórico de Vendas</strong><br />
      <img src="docs/images/historico-vendas.png" alt="Histórico de vendas do Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Relatórios</strong><br />
      <img src="docs/images/relatorios.png" alt="Relatórios do Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Fiscal</strong><br />
      <img src="docs/images/fiscal.png" alt="Módulo fiscal do Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Pagamentos Integrados</strong><br />
      <img src="docs/images/pagamentos.png" alt="Pagamentos integrados do Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Estoque e Inventário</strong><br />
      <img src="docs/images/estoque-inventario.png" alt="Estoque e inventário do Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Abertura e Fechamento</strong><br />
      <img src="docs/images/abertura-fechamento.png" alt="Abertura e fechamento de caixa no Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Compras e Reposição</strong><br />
      <img src="docs/images/compras-reposicao.png" alt="Compras e reposição no Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Trocas e Devoluções</strong><br />
      <img src="docs/images/trocas-devolucoes.png" alt="Trocas e devoluções no Hórus PDV" />
    </td>
    <td width="50%">
      <strong>CRM e Fidelidade</strong><br />
      <img src="docs/images/crm-fidelidade.png" alt="CRM e fidelidade no Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Omnichannel</strong><br />
      <img src="docs/images/omnichannel.png" alt="Omnichannel no Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Minha Empresa</strong><br />
      <img src="docs/images/minha-empresa.png" alt="Página Minha Empresa do Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Detalhes da Licença</strong><br />
      <img src="docs/images/detalhes-licenca.png" alt="Detalhes da licença do Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Sobre PDV</strong><br />
      <img src="docs/images/sobre-pdv.png" alt="Página Sobre PDV do Hórus PDV" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Configurações</strong><br />
      <img src="docs/images/configuracoes.png" alt="Configurações do Hórus PDV" />
    </td>
    <td width="50%">
      <strong>Perfil</strong><br />
      <img src="docs/images/editar-perfil.png" alt="Perfil do usuário no Hórus PDV" />
    </td>
  </tr>
</table>

## Estrutura

<pre><code class="language-text">horus_pdv/
├── API/
│   └── NETCORE/          # API ASP.NET Core
├── FRONTEND/             # Aplicação React + Vite
├── SYSTEM-LEGACY/        # Base legada para consulta/migração
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
  mcr.microsoft.com/mssql/server:2022-latest
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
VITE_RECAPTCHA_SITE_KEY=
</code></pre>

Arquivos disponíveis:

- `FRONTEND/.env.example`
- `FRONTEND/.env.development`
- `FRONTEND/.env.prod`

Na API, configurações sensíveis como JWT, CORS e reCAPTCHA ficam em `API/NETCORE/appsettings.json` durante o desenvolvimento local.

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
</code></pre>

### API .NET

<pre><code class="language-bash">cd API/NETCORE
dotnet restore
dotnet build
dotnet run --urls http://localhost:5260
</code></pre>

## Smoke Test

O smoke test sobe a API e o frontend automaticamente, cria uma conta pública, autentica, valida navegação, executa operações principais via API e limpa os dados criados com prefixo `SMOKE_`.

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

- `SMOKE_APP_URL`, padrão `http://127.0.0.1:5173`.
- `SMOKE_API_URL`, padrão `http://localhost:5260/api`.
- `SMOKE_SQL_CONTAINER`, padrão tenta `sqlserver2025` e depois `sqlserver`.
- `SMOKE_SQL_PASSWORD`, padrão `Senha@12345`.
- `SMOKE_KEEP_DATA=1`, mantém os dados criados no banco para conferência manual.

O SQL Server Docker precisa estar rodando. O teste desativa temporariamente o disparo real de e-mail da empresa durante a execução e restaura a configuração ao final.

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

Última validação local executada em **08/05/2026**:

<pre><code class="language-bash">dotnet build API/NETCORE/HORUSPDV-API.sln
cd FRONTEND
npm run lint
npx tsc --noEmit --project tsconfig.app.json
npm run build
npm run smoke
</code></pre>

Resultado: build da API, lint, TypeScript, build do frontend e smoke test completo passaram.

Observação: durante a validação, o smoke encontrou um caixa antigo aberto fora do período permitido. O teste foi ajustado para fechar caixa expirado antes de abrir o caixa da execução atual, preservando a regra de negócio da API.

## Autenticação e Segurança

O projeto já possui uma base de segurança para desenvolvimento:

- JWT com sessão.
- Middleware de autenticação.
- Controle de sessão ativa.
- Rate limit local.
- Bloqueio por tentativas inválidas de login.
- Recuperação de senha por token temporário.
- reCAPTCHA v3 opcional para login, cadastro e recuperação de senha.
- CORS configurado para ambientes locais do frontend.

> Importante: antes de produção, altere `Auth:JwtSecret`, habilite armazenamento persistente e configure chaves reais de reCAPTCHA quando necessário.

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

## Módulos em Desenvolvimento

Algumas áreas aparecem no menu para indicar a direção do produto, mas ainda não devem ser usadas em operação real:

- Fiscal NFC-e / NF-e.
- Pagamentos integrados.

Essas páginas mostram estado visual de "Em desenvolvimento" até as integrações e homologações ficarem prontas.

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

Script principal:

<pre><code class="language-text">API/NETCORE/DataBase/Resumo.sql
</code></pre>

## Roadmap

- Versionar evoluções de banco em scripts SQL incrementais.
- Expandir seeds e rotinas de migração manual.
- Expandir testes automatizados.
- Consolidar regras fiscais.
- Integrar TEF/provedores de pagamento.
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
