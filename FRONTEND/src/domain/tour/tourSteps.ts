/**
 * Arquivo: src/domain/tour/tourSteps.ts
 * Objetivo: define os passos do tour guiado por página do sistema.
 * Entradas esperadas: exporta configuração estática consumida pelo componente de tour.
 */
import type { PageKey } from "@/components/AppSidebar/AppSidebar";

export type TourPageKey = PageKey;

export type TourStep = {
  id: string;
  title: string;
  description: string;
  selectors: string[];
};

function pageSelector(page: TourPageKey, selector: string) {
  return `main[data-active-page="${page}"] ${selector}`;
}

function withCommonPageSteps(
  page: TourPageKey,
  custom: Array<Omit<TourStep, "selectors"> & { selectors?: string[] }>,
) {
  const defaults: TourStep[] = [
    {
      id: `${page}-header`,
      title: "Objetivo da tela",
      description:
        "Confira o contexto da operação e use a ação principal quando precisar cadastrar, atualizar ou executar um fluxo.",
      selectors: [
        pageSelector(page, `[data-tour="page-header"]`),
        pageSelector(page, `[data-tour="page-header-action"]`),
        pageSelector(page, "h1"),
        pageSelector(page, "h2"),
      ],
    },
    {
      id: `${page}-workspace`,
      title: "Área de trabalho",
      description:
        "Aqui ficam os cards, formulários e tabelas usados na rotina do PDV.",
      selectors: [
        pageSelector(page, `[data-tour="main-workspace"]`),
        pageSelector(page, ".card"),
        pageSelector(page, "section"),
        pageSelector(page, "article"),
      ],
    },
    {
      id: `${page}-navigation`,
      title: "Busca, filtros e paginação",
      description:
        "Use filtros, seleção, ações por linha e paginação para operar grandes volumes sem perder contexto.",
      selectors: [
        pageSelector(page, `[data-tour="table-pagination"]`),
        pageSelector(page, "table"),
        pageSelector(page, ".select-field"),
        pageSelector(page, `[aria-label^="Abrir ações"]`),
      ],
    },
  ];

  const customSteps: TourStep[] = custom.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    selectors: item.selectors?.length
      ? item.selectors
      : [pageSelector(page, ".card"), pageSelector(page, "section")],
  }));

  return [...defaults, ...customSteps];
}

const registerPageKeys: TourPageKey[] = [
  "cadastro-cliente",
  "cadastro-fornecedor",
  "cadastro-produto",
];

const marketPageKeys: TourPageKey[] = [
  "estoque",
  "compras",
  "devolucoes",
  "crm-fidelidade",
  "omnichannel",
];

export const TOUR_STEPS_BY_PAGE: Partial<Record<TourPageKey, TourStep[]>> = {
  home: withCommonPageSteps("home", [
    {
      id: "home-shortcuts",
      title: "Atalhos operacionais",
      description:
        "Use os atalhos para chegar rapidamente aos cadastros, vendas, relatórios e módulos de gestão.",
      selectors: [pageSelector("home", "button"), pageSelector("home", "article")],
    },
  ]),

  ...Object.fromEntries(
    registerPageKeys.map((page) => [
      page,
      withCommonPageSteps(page, [
        {
          id: `${page}-form`,
          title: "Cadastro e manutenção",
          description:
            "Preencha os campos obrigatórios, use máscaras de documento, telefone e valores, e salve para refletir na API.",
          selectors: [
            pageSelector(page, "form"),
            pageSelector(page, "input"),
            pageSelector(page, `[data-tour="page-header-action"]`),
          ],
        },
        {
          id: `${page}-actions`,
          title: "Ações do registro",
          description:
            "Na lista você pode editar, excluir, selecionar itens e navegar pela paginação.",
          selectors: [
            pageSelector(page, `[aria-label^="Abrir ações"]`),
            pageSelector(page, `[data-tour="table-pagination"]`),
            pageSelector(page, "table"),
          ],
        },
      ]),
    ]),
  ),

  "historico-vendas": withCommonPageSteps("historico-vendas", [
    {
      id: "historico-print",
      title: "Impressão e reemissão",
      description:
        "Consulte vendas registradas, revise itens vendidos e use a impressão para reemitir comprovantes.",
      selectors: [
        pageSelector("historico-vendas", "table"),
        pageSelector("historico-vendas", "button"),
      ],
    },
  ]),

  relatorios: withCommonPageSteps("relatorios", [
    {
      id: "relatorios-catalog",
      title: "Catálogo de relatórios",
      description:
        "Escolha um relatório, aplique filtros e gere a visão operacional conectada à API.",
      selectors: [
        pageSelector("relatorios", `[data-tour="relatorios-catalog-card"]`),
        pageSelector("relatorios", `[data-tour="relatorios-first-report-card"]`),
        pageSelector("relatorios", "button"),
      ],
    },
    {
      id: "relatorios-results",
      title: "Resultado e exportação",
      description:
        "Após gerar, valide o resultado renderizado e use as ações de exportação quando disponíveis.",
      selectors: [
        pageSelector("relatorios", `[data-tour="relatorios-result-card"]`),
        pageSelector("relatorios", "table"),
      ],
    },
  ]),

  vendas: withCommonPageSteps("vendas", [
    {
      id: "vendas-products",
      title: "Produtos da venda",
      description:
        "Pesquise produtos vindos da API, adicione ao carrinho e acompanhe a baixa de estoque ao finalizar.",
      selectors: [
        pageSelector("vendas", "input"),
        pageSelector("vendas", "article"),
        pageSelector("vendas", "table"),
      ],
    },
    {
      id: "vendas-payment",
      title: "Pagamento e recibo",
      description:
        "Finalize a venda, confirme pagamento e visualize a prévia de impressão conforme a configuração do PDV.",
      selectors: [pageSelector("vendas", "button"), pageSelector("vendas", ".card")],
    },
  ]),

  caixa: withCommonPageSteps("caixa", [
    {
      id: "caixa-status",
      title: "Status do caixa",
      description:
        "O status informa se a venda está liberada, bloqueada ou se o caixa exige fechamento.",
      selectors: [pageSelector("caixa", "section"), pageSelector("caixa", ".card")],
    },
    {
      id: "caixa-history",
      title: "Histórico de abertura e fechamento",
      description:
        "Revise sessões anteriores, operadores e valores de abertura/fechamento.",
      selectors: [
        pageSelector("caixa", "table"),
        pageSelector("caixa", `[data-tour="table-pagination"]`),
      ],
    },
  ]),

  ...Object.fromEntries(
    marketPageKeys.map((page) => [
      page,
      withCommonPageSteps(page, [
        {
          id: `${page}-kpis`,
          title: "Indicadores do módulo",
          description:
            "Acompanhe volume, pendências, alertas e evolução dos registros operacionais.",
          selectors: [
            pageSelector(page, "article.card"),
            pageSelector(page, ".card"),
          ],
        },
        {
          id: `${page}-records`,
          title: "Registros operacionais",
          description:
            "Crie, edite, altere status, selecione e exclua registros conectados à API.",
          selectors: [
            pageSelector(page, `[data-tour="page-header-action"]`),
            pageSelector(page, `[aria-label^="Abrir ações"]`),
            pageSelector(page, "article"),
          ],
        },
      ]),
    ]),
  ),

  "conta-de-usuario": withCommonPageSteps("conta-de-usuario", [
    {
      id: "usuarios-security",
      title: "Usuários e segurança",
      description:
        "Crie usuários, edite permissões, inative ou reative acessos e use reset de senha quando necessário.",
      selectors: [
        pageSelector("conta-de-usuario", "table"),
        pageSelector("conta-de-usuario", `[aria-label^="Abrir ações"]`),
      ],
    },
  ]),

  "minha-empresa": withCommonPageSteps("minha-empresa", [
    {
      id: "empresa-email",
      title: "Configuração de e-mail",
      description:
        "Configure SMTP da empresa para disparos de recuperação de senha e comunicações operacionais.",
      selectors: [
        pageSelector("minha-empresa", "form"),
        pageSelector("minha-empresa", "input"),
      ],
    },
  ]),

  configuracoes: withCommonPageSteps("configuracoes", [
    {
      id: "config-preferences",
      title: "Preferências do PDV",
      description:
        "Altere tema, prévia de impressão e revise sessões de segurança.",
      selectors: [
        pageSelector("configuracoes", ".card"),
        pageSelector("configuracoes", "button"),
      ],
    },
  ]),

  "editar-perfil": withCommonPageSteps("editar-perfil", [
    {
      id: "perfil-password",
      title: "Perfil e senha",
      description:
        "Revise seus dados, altere foto e troque a senha da conta logada.",
      selectors: [
        pageSelector("editar-perfil", ".card"),
        pageSelector("editar-perfil", "input"),
      ],
    },
  ]),

  fiscal: withCommonPageSteps("fiscal", [
    {
      id: "fiscal-development",
      title: "Módulo em desenvolvimento",
      description:
        "Esta área indica o caminho da integração fiscal e permanece sinalizada até a homologação.",
      selectors: [pageSelector("fiscal", ".card"), pageSelector("fiscal", "section")],
    },
  ]),

  pagamentos: withCommonPageSteps("pagamentos", [
    {
      id: "pagamentos-development",
      title: "Módulo em desenvolvimento",
      description:
        "Esta área indica o caminho para pagamentos integrados e TEF quando a integração estiver pronta.",
      selectors: [pageSelector("pagamentos", ".card"), pageSelector("pagamentos", "section")],
    },
  ]),

  "detalhe-licenca": withCommonPageSteps("detalhe-licenca", []),
  "sobre-pdv": withCommonPageSteps("sobre-pdv", []),
};
