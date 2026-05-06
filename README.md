# Hórus PDV

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-f59e0b)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-2563eb)
![Backend](https://img.shields.io/badge/backend-.NET%208-512bd4)
![License](https://img.shields.io/badge/license-MIT-16a34a)

Hórus PDV é um projeto open source de frente de caixa e gestão operacional para pequenos e médios comércios.

O projeto está em evolução ativa, com frontend em React, API em ASP.NET Core e módulos operacionais conectados à API em memória enquanto a camada de banco de dados definitiva ainda não foi implementada.

## Sumário

- [Status do Projeto](#status-do-projeto)
- [Stack](#stack)
- [Funcionalidades](#funcionalidades)
- [Estrutura](#estrutura)
- [Quick Start](#quick-start)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Autenticação e Segurança](#autenticação-e-segurança)
- [Módulos em Desenvolvimento](#módulos-em-desenvolvimento)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)
- [Licença](#licença)
- [Autor](#autor)

## Status do Projeto

Este repositório está em fase de desenvolvimento. O frontend já conversa com a API .NET, mas os dados ainda são mantidos em memória na API até a implementação do banco.

| Área | Status |
| --- | --- |
| Frontend React | Em desenvolvimento ativo |
| API .NET | Em desenvolvimento ativo |
| Autenticação JWT | Implementada |
| reCAPTCHA v3 | Implementado, opcional por configuração |
| Banco de dados | Pendente |
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
- Stores em memória para esta fase

## Funcionalidades

- Login com JWT.
- Cadastro público por CNPJ.
- Recuperação e redefinição de senha.
- Gestão de clientes, fornecedores e produtos.
- Frente de caixa com carrinho, pagamento e baixa de estoque.
- Abertura e fechamento de caixa.
- Histórico de vendas.
- Relatórios.
- Minha empresa, licença, perfil e configurações.
- Gestão de usuários.
- Temas light/dark.

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
</code></pre>

### API .NET

<pre><code class="language-bash">cd API/NETCORE
dotnet restore
dotnet build
dotnet run --urls http://localhost:5260
</code></pre>

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

## Módulos em Desenvolvimento

Algumas áreas aparecem no menu para indicar a direção do produto, mas ainda não devem ser usadas em operação real:

- Fiscal NFC-e / NF-e.
- Pagamentos integrados.

Essas páginas mostram estado visual de "Em desenvolvimento" até as integrações e homologações ficarem prontas.

## Dados e Persistência

Nesta fase, a API mantém dados em memória. Isso permite validar o fluxo completo do frontend com a API sem depender ainda de banco.

Impacto:

- Ao reiniciar a API, dados criados em runtime podem ser perdidos.
- Tokens de recuperação de senha são temporários e ficam em memória.
- A próxima etapa estrutural é criar a camada de banco e migrations.

## Roadmap

- Implementar banco de dados.
- Persistir autenticação, usuários, produtos, vendas e caixa.
- Criar migrations e seeds.
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
