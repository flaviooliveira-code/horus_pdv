import { expect, test, type Page } from "@playwright/test";

const MOCK_USER = {
  id: "user-1",
  companyId: "comp-1",
  cpf: "12345678901",
  name: "Operador Balcão",
  email: "operador@horus.local",
  phone: "11999999999",
  role: "administrador",
  status: "ativo",
  createdAt: "2026-01-01T00:00:00Z",
  lastLoginAt: "2026-11-15T10:00:00Z",
  mustChangePassword: false,
};

const MOCK_PRODUCTS = [
  {
    id: "prod-1",
    productImageUrl: "",
    productImageName: "",
    productName: "Café Torrado Especial 500g",
    productCode: "7891234567890",
    productSupplier: "Fornecedor A",
    productDescription: "Café especial",
    productQnt: "50",
    productUnitPrice: "10,00",
    productSalePrice: "18,50",
    totalPriceOnProduct: "925,00",
  },
  {
    id: "prod-2",
    productImageUrl: "",
    productImageName: "",
    productName: "Refrigerante Cola 2L",
    productCode: "7890001112223",
    productSupplier: "Fornecedor B",
    productDescription: "Bebida 2L",
    productQnt: "30",
    productUnitPrice: "5,00",
    productSalePrice: "9,90",
    totalPriceOnProduct: "297,00",
  },
];

const MOCK_COMPANY = {
  fantasyName: "Mercado Hórus Central",
  corporateName: "Mercado Hórus Ltda",
  cnpj: "12.345.678/0001-90",
  stateRegistration: "",
  website: "",
  email: "contato@horus.local",
  sacPhone: "",
  phone: "(11) 3333-4444",
  mobile: "",
  cep: "01000-000",
  address: "Av. Paulista",
  number: "100",
  neighborhood: "Centro",
  city: "São Paulo",
  uf: "SP",
  complement: "",
  emailSmtpEnabled: false,
  emailSmtpHost: "",
  emailSmtpPort: 587,
  emailSmtpEnableSsl: true,
  emailSmtpUser: "",
  emailSmtpPassword: "",
  emailSmtpHasPassword: false,
  emailSmtpFromEmail: "",
  emailSmtpFromName: "",
  emailSmtpReplyTo: "",
};

const MOCK_CASH_STATUS = {
  state: "aberto",
  canSell: true,
  blockReason: "",
  serverNow: "2026-11-15T14:00:00Z",
  currentSession: {
    id: "caixa-1",
    status: "aberto",
    openedAt: "2026-11-15T08:00:00Z",
    openingAmount: "100,00",
    closingAmount: "",
    operatorName: "Operador Balcão",
    closedByName: "",
    note: "",
    elapsedMinutes: 45,
  },
  lastSession: null,
  history: [],
};

async function installApiMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const origin = request.headers()["origin"] ?? "http://127.0.0.1:4173";
    const corsHeaders = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const url = new URL(request.url());
    const pathname = url.pathname;
    let data: unknown = {};

    if (pathname.endsWith("/Auth/me")) {
      data = MOCK_USER;
    } else if (pathname.endsWith("/Produto")) {
      data = MOCK_PRODUCTS;
    } else if (pathname.endsWith("/Empresa")) {
      data = MOCK_COMPANY;
    } else if (pathname.endsWith("/Caixa/status")) {
      data = MOCK_CASH_STATUS;
    } else if (pathname.endsWith("/HistoricoVendas") && request.method() === "POST") {
      data = { saleNumber: "PDV-2026-001" };
    } else if (pathname.endsWith("/Sessao")) {
      data = [];
    } else if (pathname.endsWith("/Home")) {
      data = { cards: [] };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: "OK", data }),
    });
  });
}

async function seedAuthenticatedSession(
  page: Page,
  options?: { activePage?: string; theme?: "light" | "dark"; highVisibility?: boolean },
) {
  await page.addInitScript(
    ({ user, activePage, theme, highVisibility }) => {
      window.localStorage.setItem("horuspdv.auth.user", JSON.stringify(user));
      window.localStorage.setItem("horuspdv.auth.remember", "1");
      window.localStorage.setItem("horuspdv.activePage", activePage);
      window.localStorage.setItem("horuspdv.theme", theme);
      if (typeof highVisibility === "boolean") {
        window.localStorage.setItem(
          "horus-pdv-high-visibility-enabled",
          String(highVisibility),
        );
      }
    },
    {
      user: MOCK_USER,
      activePage: options?.activePage ?? "vendas",
      theme: options?.theme ?? "light",
      highVisibility: options?.highVisibility,
    },
  );
}

async function measureContrastRatio(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    function parseRgba(input: string): [number, number, number, number] {
      const match = input.match(/rgba?\(([^)]+)\)/i);
      if (!match) return [0, 0, 0, 0];
      const parts = match[1].split(",").map((p) => Number(p.trim()));
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    }

    function compositeOver(
      fg: [number, number, number, number],
      bg: [number, number, number, number],
    ): [number, number, number, number] {
      const a = fg[3];
      return [
        fg[0] * a + bg[0] * (1 - a),
        fg[1] * a + bg[1] * (1 - a),
        fg[2] * a + bg[2] * (1 - a),
        1,
      ];
    }

    function resolveBackground(el: Element): [number, number, number, number] {
      const layers: Array<[number, number, number, number]> = [];
      let cur: Element | null = el;
      while (cur) {
        const bg = parseRgba(window.getComputedStyle(cur).backgroundColor);
        if (bg[3] > 0) {
          layers.push(bg);
          if (bg[3] >= 0.999) break;
        }
        cur = cur.parentElement;
      }
      let result: [number, number, number, number] = [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        result = compositeOver(layers[i], result);
      }
      return result;
    }

    function relativeLuminance([r, g, b]: [number, number, number, number]): number {
      const toLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }

    const element = document.querySelector(sel);
    if (!element) throw new Error(`Selector not found for contrast check: ${sel}`);
    const style = window.getComputedStyle(element);
    const bg = resolveBackground(element);
    const fgRaw = parseRgba(style.color);
    const fg = fgRaw[3] < 1 ? compositeOver(fgRaw, bg) : fgRaw;
    const l1 = relativeLuminance(fg);
    const l2 = relativeLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }, selector);
}

test.describe("PR 1 — Acessibilidade e Redesenho da Frente de Caixa", () => {
  test("preserva seletores legados e conclui venda completa no PDV", async ({ page }) => {
    await installApiMocks(page);
    await seedAuthenticatedSession(page, { activePage: "vendas" });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Hórus PDV/i })).toBeVisible();
    await expect(page.getByText("AGUARDANDO PRODUTO")).toBeVisible();

    await page.getByLabel(/^Produto:/i).fill("7891234567890");
    await page.getByText("Café Torrado Especial 500g", { exact: true }).click();
    await page.getByLabel(/quantidade/i).fill("2");
    await page.getByRole("button", { name: /adicionar item/i }).click();

    await expect(page.getByText("Café Torrado Especial 500g").first()).toBeVisible();
    await expect(page.getByText(/2 x R\$ 18,50 =/i)).toBeVisible();
    await expect(page.locator(".pdv-total-amount")).toHaveText("R$ 37,00");

    await page.getByRole("button", { name: /pagamento/i }).click();
    await expect(page.getByRole("heading", { name: "Pagamento", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();

    await expect(page.getByText(/cupom nao fiscal/i)).toBeVisible();
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page.getByText(/cupom nao fiscal/i)).toBeHidden();
  });

  test("alterna Alta Visibilidade (F7), persiste no localStorage, amplia +50% e atinge WCAG AAA (>=7:1) em temas claro e escuro", async ({
    page,
  }) => {
    await installApiMocks(page);
    await seedAuthenticatedSession(page, { activePage: "vendas", theme: "light" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    // Adiciona um item para medir também a tabela de itens e o card gigante.
    await page.getByLabel(/^Produto:/i).fill("7891234567890");
    await page.getByLabel(/^Produto:/i).press("Enter");
    await expect(page.locator(".pdv-table tbody tr")).toHaveCount(1);

    const wrapper = page.locator("[data-pdv-high-visibility]");
    await expect(wrapper).toHaveAttribute("data-pdv-high-visibility", "false");

    const baseSizes = await page.evaluate(() => {
      const sizeOf = (sel: string) =>
        parseFloat(window.getComputedStyle(document.querySelector(sel)!).fontSize);
      return {
        label: sizeOf(".pdv-field-label"),
        search: sizeOf(".pdv-search-input"),
        tableCell: sizeOf(".pdv-table td"),
        lastName: sizeOf(".pdv-last-scanned-name"),
        lastMath: sizeOf(".pdv-last-scanned-math"),
        footer: sizeOf(".pdv-footer"),
      };
    });

    // Ativa via F7
    await page.keyboard.press("F7");
    await expect(wrapper).toHaveAttribute("data-pdv-high-visibility", "true");
    await expect(wrapper).toHaveClass(/pdv-high-visibility/);
    expect(
      await page.evaluate(() => window.localStorage.getItem("horus-pdv-high-visibility-enabled")),
    ).toBe("true");

    const highVisSizes = await page.evaluate(() => {
      const sizeOf = (sel: string) =>
        parseFloat(window.getComputedStyle(document.querySelector(sel)!).fontSize);
      return {
        label: sizeOf(".pdv-field-label"),
        search: sizeOf(".pdv-search-input"),
        tableCell: sizeOf(".pdv-table td"),
        lastName: sizeOf(".pdv-last-scanned-name"),
        lastMath: sizeOf(".pdv-last-scanned-math"),
        footer: sizeOf(".pdv-footer"),
      };
    });

    expect(highVisSizes.label).toBeGreaterThanOrEqual(baseSizes.label * 1.5);
    expect(highVisSizes.search).toBeGreaterThanOrEqual(baseSizes.search * 1.5);
    expect(highVisSizes.tableCell).toBeGreaterThanOrEqual(baseSizes.tableCell * 1.5);
    expect(highVisSizes.lastName).toBeGreaterThanOrEqual(baseSizes.lastName * 1.45);
    expect(highVisSizes.lastMath).toBeGreaterThanOrEqual(baseSizes.lastMath * 1.5);
    expect(highVisSizes.footer).toBeGreaterThanOrEqual(baseSizes.footer * 1.5);

    // Contraste WCAG AAA >= 7:1 no tema claro
    expect(await measureContrastRatio(page, ".pdv-last-scanned-name")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, ".pdv-table td")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, ".pdv-total-amount")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, ".pdv-cash-banner")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, ".pdv-price-input")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, "header h1")).toBeGreaterThanOrEqual(7);

    // Persiste após reload
    await page.reload();
    await expect(page.locator("[data-pdv-high-visibility]")).toHaveAttribute(
      "data-pdv-high-visibility",
      "true",
    );

    // Verifica WCAG AAA >= 7:1 também no tema escuro (armadilha Tailwind v4 .bg-accent)
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      window.localStorage.setItem("horuspdv.theme", "dark");
    });

    await page.getByLabel(/^Produto:/i).fill("7891234567890");
    await page.getByLabel(/^Produto:/i).press("Enter");
    await expect(page.locator(".pdv-table tbody tr")).toHaveCount(1);

    expect(await measureContrastRatio(page, ".pdv-last-scanned-name")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, ".pdv-table td")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, ".pdv-total-amount")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, ".pdv-cash-banner")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, ".pdv-price-input")).toBeGreaterThanOrEqual(7);
    expect(await measureContrastRatio(page, "header h1")).toBeGreaterThanOrEqual(7);
  });

  test("corrige Enter no leitor de código de barras e captura rajada HID global mesmo fora do input", async ({
    page,
  }) => {
    await installApiMocks(page);
    await seedAuthenticatedSession(page, { activePage: "vendas" });
    await page.goto("/");

    const productInput = page.getByLabel(/^Produto:/i);

    // 1) Código exato com autocomplete aberto + Enter deve adicionar direto sem parar na quantidade
    await productInput.fill("7891234567890");
    await expect(page.getByText("Café Torrado Especial 500g", { exact: true })).toBeVisible();
    await productInput.press("Enter");

    await expect(page.locator(".pdv-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".pdv-last-scanned-name")).toHaveText("Café Torrado Especial 500g");
    await expect(productInput).toHaveValue("");
    await expect(productInput).toBeFocused();

    // 2) Código desconhecido mostra erro e mantém foco selecionado no campo Produto
    await productInput.fill("9999999999999");
    await productInput.press("Enter");
    await expect(page.getByText(/Produto não encontrado/i)).toBeVisible();
    await expect(productInput).toBeFocused();

    // 3) Rajada HID global com foco em document.body (fora do input)
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    for (const ch of "7890001112223") {
      await page.keyboard.press(ch, { delay: 5 });
    }
    await page.keyboard.press("Enter");

    await expect(page.locator(".pdv-table tbody tr")).toHaveCount(2);
    await expect(page.locator(".pdv-last-scanned-name")).toHaveText("Refrigerante Cola 2L");
    await expect(page.locator(".pdv-total-amount")).toHaveText("R$ 28,40");
  });

  test("configurações persistem Alta Visibilidade e Foco Contínuo para o PDV", async ({ page }) => {
    await installApiMocks(page);
    await seedAuthenticatedSession(page, { activePage: "configuracoes", highVisibility: false });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();

    const highVisGroup = page.getByRole("group", {
      name: "Ativar modo alta visibilidade no PDV",
    });
    await highVisGroup.getByRole("button", { name: "Sim" }).click();
    await expect(page.getByText(/Modo Alta Visibilidade \(F7\) ativado/i)).toBeVisible();

    const scannerGroup = page.getByRole("group", {
      name: "Ativar foco contínuo no leitor de código de barras",
    });
    await scannerGroup.getByRole("button", { name: "Não" }).click();
    await expect(page.getByText(/Foco contínuo no leitor de código de barras desativado/i)).toBeVisible();

    await page.goto("/?pdv=1");
    await expect(page.locator("[data-pdv-high-visibility]")).toHaveAttribute(
      "data-pdv-high-visibility",
      "true",
    );
    await expect(
      page.getByRole("button", { name: /Manter foco no leitor: OFF/i }),
    ).toBeVisible();
  });

  test("visor do cliente (?pdv-display=1) sincroniza via BroadcastChannel e REQUEST_SYNC", async ({
    context,
    page,
  }) => {
    await installApiMocks(page);
    await seedAuthenticatedSession(page, { activePage: "vendas" });
    await page.goto("/");

    // Bipa primeiro item antes mesmo de abrir o visor do cliente
    await page.getByLabel(/^Produto:/i).fill("7891234567890");
    await page.getByLabel(/^Produto:/i).press("Enter");
    await expect(page.locator(".pdv-total-amount")).toHaveText("R$ 18,50");

    // Abre segunda aba do visor do cliente
    const displayPage = await context.newPage();
    await installApiMocks(displayPage);
    await seedAuthenticatedSession(displayPage, { activePage: "vendas" });
    await displayPage.goto("/?pdv-display=1");

    await expect(displayPage.getByText("Visor do Cliente")).toBeVisible();
    await expect(displayPage.locator(".pdv-last-scanned-name")).toHaveText(
      "Café Torrado Especial 500g",
    );
    await expect(displayPage.locator(".pdv-total-amount")).toHaveText("R$ 18,50");

    // Bipa segundo item no PDV e verifica atualização em tempo real no visor do cliente
    await page.getByLabel(/^Produto:/i).fill("7890001112223");
    await page.getByLabel(/^Produto:/i).press("Enter");

    await expect(displayPage.locator(".pdv-last-scanned-name")).toHaveText("Refrigerante Cola 2L");
    await expect(displayPage.locator(".pdv-total-amount")).toHaveText("R$ 28,40");

    // Finaliza venda no PDV e verifica confirmação no visor do cliente
    await page.getByRole("button", { name: /pagamento/i }).click();
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(displayPage.getByText(/Venda #PDV-2026-001 concluída/i)).toBeVisible();

    await displayPage.close();
  });
});
