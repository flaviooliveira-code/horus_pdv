import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";

const APP_URL = process.env.DEMO_APP_URL ?? "http://127.0.0.1:5173";
const API_URL = process.env.DEMO_API_URL ?? "http://localhost:5260/api";
const SQL_PASSWORD = process.env.DEMO_SQL_PASSWORD ?? "Senha@12345";
const SQL_DATABASE = process.env.DEMO_SQL_DATABASE ?? "HorusPdv";
const RUN_ID = process.env.DEMO_RUN_ID ?? `DEMO_${Date.now()}`;
const SQL_PREFIX = RUN_ID.replace(/[^A-Z0-9_]/gi, "_");
const PASSWORD = "Senha@Demo123";
const VIDEO_DIR = path.resolve(import.meta.dirname, "../../../docs/videos");
const VIDEO_FILE = path.join(VIDEO_DIR, "horus-pdv-demo.webm");
const DEMO_PAUSE_MULTIPLIER = Number(process.env.DEMO_PAUSE_MULTIPLIER ?? 1.55);

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

let sqlContainer = "";
let authToken = "";
let documentSequence = 0;

const demo = {
  companyName: `${RUN_ID} Empresa`,
  email: `${RUN_ID.toLowerCase()}@hpdv.test`,
  phone: "(11) 98888-7777",
  cnpj: generateCnpj(),
  customerName: `${RUN_ID} Cliente`,
  customerEditedName: `${RUN_ID} Cliente Editado`,
  supplierName: `${RUN_ID} Fornecedor`,
  supplierEditedName: `${RUN_ID} Fornecedor Editado`,
  productName: `${RUN_ID} Produto`,
  productEditedName: `${RUN_ID} Produto Editado`,
  productCode: `${SQL_PREFIX}_PRODUTO`,
};

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  sqlContainer = resolveAndStartSqlContainer();
  cleanupSql();
  runSql("UPDATE Empresas SET EmailSmtpEnabled = 0 WHERE Id = N'empresa-principal';");
});

test.afterAll(() => {
  cleanupSql();
});

test("grava video demonstrativo do sistema", async ({ browser, request }) => {
  mkdirSync(VIDEO_DIR, { recursive: true });
  rmSync(VIDEO_FILE, { force: true });

  const { page, closeAndSave } = await createRecordedPage(browser);
  page.setDefaultTimeout(15_000);

  try {
    await createAccountAndLogin(page);
    authToken = await page.evaluate(() => window.localStorage.getItem("horuspdv.auth.token") ?? "");

    await walkthroughCorePages(page);
    await customerCrud(page);
    await supplierCrud(page);
    await productCrud(page);
    await advancedModulesCrud(page);
    await openCashRegister(page, request);
    await completeSale(page, request);
    await historyAndReports(page);
    await finishOnHome(page);
  } finally {
    await closeAndSave();
  }

  expect(VIDEO_FILE).toBeTruthy();
});

async function createRecordedPage(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: path.join(VIDEO_DIR, ".tmp"),
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();

  return {
    page,
    closeAndSave: async () => {
      const video = page.video();
      await context.close();
      const videoPath = await video?.path();
      if (videoPath) copyFileSync(videoPath, VIDEO_FILE);
      rmSync(path.join(VIDEO_DIR, ".tmp"), { recursive: true, force: true });
    },
  };
}

async function createAccountAndLogin(page: Page) {
  await page.goto(APP_URL);
  await caption(page, "Cadastro público da empresa");
  await pause(page);
  await page.getByRole("button", { name: /criar cadastro/i }).click();
  await page.getByLabel(/nome da empresa/i).fill(demo.companyName);
  await page.getByLabel(/cnpj/i).fill(demo.cnpj);
  await page.getByLabel(/telefone/i).fill(demo.phone);
  await page.getByLabel(/e-mail/i).fill(demo.email);
  await page.getByLabel(/^senha$/i).fill(PASSWORD);
  await page.getByLabel(/confirmar senha/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^criar cadastro$/i }).click();

  await expect(page.getByRole("heading", { name: /bem-vindo de volta/i })).toBeVisible({
    timeout: 25_000,
  });
  await caption(page, "Login com usuário cadastrado");
  await page.getByLabel(/e-mail/i).fill(demo.email);
  await page.getByLabel(/^senha$/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible({
    timeout: 25_000,
  });
  await caption(page, "Dashboard inicial conectado à API");
  await pause(page);
}

async function walkthroughCorePages(page: Page) {
  const pages = [
    ["minha-empresa", "Minha Empresa", "Dados da empresa e configuração de e-mail"],
    ["conta-de-usuario", "Usuários", "Gestão de contas e permissões"],
    ["configuracoes", "Configurações", "Preferências do PDV"],
    ["fiscal", "Fiscal NFC-e / NF-e", "Módulo fiscal marcado como em desenvolvimento"],
    ["pagamentos", "Pagamentos Integrados", "Gateways Asaas, Mercado Pago e PagBank para PIX e boleto"],
  ] as const;

  for (const [key, title, text] of pages) {
    await openAppPage(page, key, title);
    await caption(page, text);
    await pause(page, 800);
  }
}

async function customerCrud(page: Page) {
  await openAppPage(page, "cadastro-cliente", "Cadastro de Cliente");
  await caption(page, "Cadastro de cliente: criar, editar e excluir");
  await page.getByRole("button", { name: /novo cliente/i }).click();
  const drawer = drawerPanel(page);
  await drawer.getByLabel(/documento/i).fill(generateCpf());
  await drawer.getByLabel(/^nome/i).fill(demo.customerName);
  await pickDate(drawer, /dn/i, { day: "1", monthIndex: "0", year: "1990" });
  await fillAddress(drawer);
  await drawer.getByRole("button", { name: /criar cliente/i }).click();
  await expect(rowWithText(page, demo.customerName)).toBeVisible();

  await rowAction(page, demo.customerName, "Editar");
  const editDrawer = drawerPanel(page);
  await editDrawer.getByLabel(/^nome/i).fill(demo.customerEditedName);
  await editDrawer.getByRole("button", { name: /salvar cliente/i }).click();
  await expect(rowWithText(page, demo.customerEditedName)).toBeVisible();

  await rowAction(page, demo.customerEditedName, "Excluir");
  await page.getByRole("button", { name: "Sim", exact: true }).click();
  await expect(rowWithText(page, demo.customerEditedName)).toBeHidden();
  await pause(page);
}

async function supplierCrud(page: Page) {
  await openAppPage(page, "cadastro-fornecedor", "Cadastro de Fornecedor");
  await caption(page, "Fornecedor: cadastro, edição e manutenção para produtos");
  await page.getByRole("button", { name: /novo fornecedor/i }).click();
  const drawer = drawerPanel(page);
  await drawer.getByLabel(/razão social/i).fill(`${demo.supplierName} Ltda`);
  await drawer.getByLabel(/nome fantasia/i).fill(demo.supplierName);
  await drawer.getByLabel(/cnpj/i).fill(generateCnpj());
  await fillAddress(drawer);
  await drawer.getByRole("button", { name: /criar fornecedor/i }).click();
  await expect(rowWithText(page, demo.supplierName)).toBeVisible();

  await rowAction(page, demo.supplierName, "Editar");
  const editDrawer = drawerPanel(page);
  await editDrawer.getByLabel(/nome fantasia/i).fill(demo.supplierEditedName);
  await editDrawer.getByRole("button", { name: /salvar fornecedor/i }).click();
  await expect(rowWithText(page, demo.supplierEditedName)).toBeVisible();
  await pause(page);
}

async function productCrud(page: Page) {
  await openAppPage(page, "cadastro-produto", "Cadastro de Produto");
  await caption(page, "Produto: cadastro com fornecedor, edição e estoque");
  await page.getByRole("button", { name: /novo produto/i }).click();
  const drawer = drawerPanel(page);
  await drawer.getByLabel(/nome do produto/i).fill(demo.productName);
  await drawer.getByLabel(/código do produto/i).fill(demo.productCode);
  await drawer.getByLabel(/fornecedor/i).fill(demo.supplierEditedName);
  await page.getByText(demo.supplierEditedName, { exact: true }).click();
  await drawer.getByLabel(/descrição do produto/i).fill("Produto demonstrativo para venda no PDV.");
  await drawer.getByLabel(/quantidade do produto/i).fill("8");
  await fillMoney(drawer.getByLabel(/preço unitário do produto/i), "1000");
  await fillMoney(drawer.getByLabel(/preço de venda do produto/i), "2500");
  await drawer.getByRole("button", { name: /criar produto/i }).click();
  await expect(rowWithText(page, demo.productName)).toBeVisible();

  await rowAction(page, demo.productName, "Editar");
  const editDrawer = drawerPanel(page);
  await editDrawer.getByLabel(/nome do produto/i).fill(demo.productEditedName);
  await editDrawer.getByRole("button", { name: /salvar produto/i }).click();
  await expect(rowWithText(page, demo.productEditedName)).toBeVisible();
  await pause(page);
}

async function advancedModulesCrud(page: Page) {
  const modules = [
    ["estoque", "Estoque e Inventário", "Ajustar estoque"],
    ["compras", "Compras e Reposição", "Novo pedido"],
    ["devolucoes", "Trocas e Devoluções", "Nova devolução"],
    ["crm-fidelidade", "CRM e Fidelidade", "Nova campanha"],
    ["omnichannel", "Omnichannel e Integrações", "Conectar canal"],
  ] as const;

  for (const [key, title, action] of modules) {
    const recordTitle = `${RUN_ID} ${title}`;
    const editedTitle = `${recordTitle} Editado`;
    await openAppPage(page, key, title);
    await caption(page, `${title}: criar, editar e excluir registro`);
    await page.getByRole("button", { name: action, exact: true }).click();
    await page.getByLabel("Título").fill(recordTitle);
    await page.getByLabel("Descrição").fill(`Registro demonstrativo de ${title}.`);
    await page.getByLabel("Valor").fill("12345");
    await page.getByLabel("Informação adicional").fill(RUN_ID);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.locator("article").filter({ hasText: recordTitle }).first()).toBeVisible();

    await cardAction(page, recordTitle, "Editar");
    await page.getByLabel("Título").fill(editedTitle);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.locator("article").filter({ hasText: editedTitle }).first()).toBeVisible();

    await cardAction(page, editedTitle, "Excluir");
    await page.getByRole("button", { name: "Sim", exact: true }).click();
    await pause(page, 650);
  }
}

async function openCashRegister(page: Page, request: APIRequestContext) {
  await closeCurrentCashIfNeeded(request);
  await openAppPage(page, "caixa", "Abertura e Fechamento de Caixa");
  await caption(page, "Abertura de caixa antes de vender");
  await page.getByLabel(/valor inicial/i).fill("100,00");
  await page.getByRole("button", { name: /^abrir caixa$/i }).click();
  await expect(page.getByText(/caixa aberto para venda/i)).toBeVisible();
  await pause(page);
}

async function completeSale(page: Page, request: APIRequestContext) {
  await caption(page, "Frente de caixa: adicionar produto e confirmar pagamento");
  await page.goto(`${APP_URL}?pdv=1`);
  await expect(page.getByRole("heading", { name: /Hórus PDV/i })).toBeVisible();
  await page.getByLabel(/^Produto:/i).fill(demo.productCode);
  await page.getByText(demo.productEditedName, { exact: true }).click();
  await page.getByLabel(/quantidade/i).fill("2");
  await page.getByRole("button", { name: /adicionar item/i }).click();
  await expect(page.getByText(demo.productEditedName).first()).toBeVisible();
  await page.getByRole("button", { name: /pagamento/i }).click();
  await expect(page.getByRole("heading", { name: "Pagamento", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText(/cupom nao fiscal/i)).toBeVisible({ timeout: 20_000 });
  await pause(page, 1_200);
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await closeCurrentCashIfNeeded(request);
}

async function historyAndReports(page: Page) {
  await openAppPage(page, "historico-vendas", "Histórico de Vendas");
  await caption(page, "Histórico de vendas com valor unitário, total e reimpressão");
  await expect(page.getByText(demo.productEditedName).first()).toBeVisible({ timeout: 20_000 });
  await pause(page);

  await openAppPage(page, "relatorios", "Relatórios");
  await caption(page, "Relatórios operacionais");
  await pause(page);
}

async function finishOnHome(page: Page) {
  await openAppPage(page, "home", "Home");
  await caption(page, "Hórus PDV pronto para operação de balcão");
  await pause(page, 1_200);
}

async function openAppPage(page: Page, key: string, title: string) {
  await page.evaluate((activePage) => {
    window.localStorage.setItem("horuspdv.activePage", activePage);
  }, key);
  await page.goto(APP_URL);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

async function fillAddress(scope: Locator) {
  await scope.getByLabel(/cep/i).fill("01310-100");
  await scope.getByLabel(/cidade/i).fill("São Paulo");
  await scope.getByLabel(/uf/i).fill("SP");
  await scope.page().getByText("SP", { exact: true }).last().click();
  await scope.getByLabel(/endereço/i).fill("Avenida Paulista");
  await scope.getByLabel(/bairro/i).fill("Bela Vista");
  await scope.getByLabel(/número/i).fill("1578");
  await scope.getByLabel(/celular/i).fill("(11) 95555-2222");
  await scope.getByLabel(/e-mail/i).fill(`${RUN_ID.toLowerCase()}_${Date.now()}@hpdv.test`);
}

async function fillMoney(field: Locator, digits: string) {
  await field.click();
  await field.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await field.press("Backspace");
  await field.pressSequentially(digits, { delay: 20 });
}

async function pickDate(
  scope: Locator,
  label: RegExp,
  date: { day: string; monthIndex: string; year: string },
) {
  await scope.getByLabel(label).click();
  const page = scope.page();
  const popover = page.locator(".rdp-root").locator("..");
  await popover.locator("select").nth(0).selectOption(date.monthIndex);
  await popover.locator("select").nth(1).selectOption(date.year);
  await popover.locator("button").filter({ hasText: new RegExp(`^${date.day}$`) }).first().click();
}

async function caption(page: Page, text: string) {
  await page.evaluate((captionText) => {
    let element = document.getElementById("horus-demo-caption");
    if (!element) {
      element = document.createElement("div");
      element.id = "horus-demo-caption";
      element.style.position = "fixed";
      element.style.left = "24px";
      element.style.bottom = "24px";
      element.style.zIndex = "2147483647";
      element.style.maxWidth = "560px";
      element.style.borderRadius = "18px";
      element.style.background = "rgba(7, 95, 145, 0.94)";
      element.style.color = "#fff";
      element.style.boxShadow = "0 18px 42px rgba(15, 23, 42, 0.22)";
      element.style.font = "700 18px/1.35 system-ui, -apple-system, Segoe UI, sans-serif";
      element.style.padding = "16px 18px";
      element.style.pointerEvents = "none";
      document.body.appendChild(element);
    }
    element.textContent = captionText;
  }, text);
}

async function pause(page: Page, ms = 950) {
  await page.waitForTimeout(Math.round(ms * DEMO_PAUSE_MULTIPLIER));
}

function drawerPanel(page: Page) {
  return page.locator(".dept-drawer-panel").last();
}

function rowWithText(page: Page, text: string) {
  return page.locator("tr").filter({ hasText: text }).first();
}

async function rowAction(page: Page, rowText: string, action: string) {
  const row = rowWithText(page, rowText);
  await row.getByLabel("Abrir ações").click();
  await page.getByRole("button", { name: action, exact: true }).click();
}

async function cardAction(page: Page, text: string, action: string) {
  const card = page.locator("article").filter({ hasText: text }).first();
  await card.getByLabel("Abrir ações").click();
  await page.getByRole("button", { name: action, exact: true }).click();
}

async function closeCurrentCashIfNeeded(request: APIRequestContext) {
  const status = await api<{ currentSession?: unknown | null }>(request, authToken, "/Caixa/status", {
    allowFailure: true,
  });
  if (!status?.currentSession) return;
  await api(request, authToken, "/Caixa/fechar", {
    method: "POST",
    body: { closingAmount: "100,00", note: `${RUN_ID} fechamento demonstracao` },
    allowFailure: true,
  });
}

async function api<T>(
  request: APIRequestContext,
  token: string,
  apiPath: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    allowFailure?: boolean;
  } = {},
) {
  const response = await request.fetch(`${API_URL}${apiPath}`, {
    method: options.method ?? "GET",
    data: options.body,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  });
  const raw = await response.text();
  const payload = raw ? (JSON.parse(raw) as ApiResponse<T>) : ({ success: response.ok() } as ApiResponse<T>);

  if (!options.allowFailure) {
    expect(response.ok(), `${options.method ?? "GET"} ${apiPath}: ${raw}`).toBeTruthy();
    expect(payload.success, `${options.method ?? "GET"} ${apiPath}: ${raw}`).toBeTruthy();
  }

  return payload.data as T;
}

function cleanupSql() {
  if (!sqlContainer) return;
  const like = `${escapeSql(SQL_PREFIX)}%`;
  runSql(`
    DELETE FROM VendaItens
      WHERE VendaId IN (
        SELECT v.Id FROM Vendas v
        WHERE v.CustomerName LIKE N'${like}'
           OR EXISTS (SELECT 1 FROM VendaItens i WHERE i.VendaId = v.Id AND i.ProductCode LIKE N'${like}')
      );
    DELETE FROM Vendas
      WHERE CustomerName LIKE N'${like}'
         OR Id IN (SELECT VendaId FROM VendaItens WHERE ProductCode LIKE N'${like}');
    DELETE FROM Produtos WHERE ProductCode LIKE N'${like}' OR ProductName LIKE N'${like}';
    DELETE FROM Clientes WHERE CustomerName LIKE N'${like}' OR Email LIKE N'${like.toLowerCase()}';
    DELETE FROM Fornecedores WHERE FantasyName LIKE N'${like}' OR CompanyName LIKE N'${like}' OR Email LIKE N'${like.toLowerCase()}';
    DELETE FROM ModuloMercadoRegistros WHERE Title LIKE N'${like}';
    DELETE FROM CaixaSessoes WHERE OperatorName LIKE N'${like}' OR ClosedByName LIKE N'${like}' OR Note LIKE N'${like}';
    DELETE FROM PasswordResetTokens WHERE Email LIKE N'${like.toLowerCase()}';
    DELETE FROM Sessoes WHERE UserId IN (SELECT Id FROM Usuarios WHERE Email LIKE N'${like.toLowerCase()}' OR Name LIKE N'${like}');
    DELETE FROM Usuarios WHERE Email LIKE N'${like.toLowerCase()}' OR Name LIKE N'${like}';
  `);
}

function resolveAndStartSqlContainer() {
  const configured = process.env.DEMO_SQL_CONTAINER;
  const candidates = configured ? [configured] : ["sqlserver2025", "sqlserver"];
  for (const name of candidates) {
    try {
      execFileSync("docker", ["start", name], { encoding: "utf8", stdio: "ignore" });
      execFileSync("docker", ["inspect", "-f", "{{.State.Running}}", name], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return name;
    } catch {
      // tenta o proximo container conhecido
    }
  }
  throw new Error(`SQL Server Docker nao encontrado. Use DEMO_SQL_CONTAINER ou suba ${candidates.join(" ou ")}.`);
}

function runSql(sql: string) {
  const args = [
    "exec",
    sqlContainer,
    sqlcmdPath(),
    "-S",
    "localhost",
    "-U",
    "sa",
    "-P",
    SQL_PASSWORD,
    "-C",
    "-d",
    SQL_DATABASE,
    "-b",
    "-Q",
    sql,
  ];
  execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function sqlcmdPath() {
  try {
    execFileSync("docker", ["exec", sqlContainer, "test", "-x", "/opt/mssql-tools18/bin/sqlcmd"]);
    return "/opt/mssql-tools18/bin/sqlcmd";
  } catch {
    return "/opt/mssql-tools/bin/sqlcmd";
  }
}

function generateCpf() {
  const base = randomDigits(9);
  const firstDigit = cpfDigit(base);
  const secondDigit = cpfDigit([...base, firstDigit]);
  return formatCpf([...base, firstDigit, secondDigit].join(""));
}

function cpfDigit(numbers: number[]) {
  const sum = numbers.reduce((acc, digit, index) => acc + digit * (numbers.length + 1 - index), 0);
  const mod = (sum * 10) % 11;
  return mod === 10 ? 0 : mod;
}

function generateCnpj() {
  const base = randomDigits(12);
  const firstDigit = cnpjDigit(base);
  const secondDigit = cnpjDigit([...base, firstDigit]);
  return formatCnpj([...base, firstDigit, secondDigit].join(""));
}

function cnpjDigit(numbers: number[]) {
  const weights =
    numbers.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = numbers.reduce((acc, digit, index) => acc + digit * weights[index], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

function randomDigits(length: number) {
  documentSequence += 1;
  const seed = `${Date.now()}${documentSequence}`.padEnd(length, "7");
  return Array.from({ length }, (_, index) => Number(seed[index % seed.length]));
}

function formatCpf(value: string) {
  return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCnpj(value: string) {
  return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}
