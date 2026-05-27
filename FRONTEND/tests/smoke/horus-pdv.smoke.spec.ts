import { execFileSync } from "node:child_process";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const APP_URL = process.env.SMOKE_APP_URL ?? "http://127.0.0.1:5173";
const API_URL = process.env.SMOKE_API_URL ?? "http://localhost:5260/api";
const SQL_PASSWORD = process.env.SMOKE_SQL_PASSWORD ?? "Senha@12345";
const SQL_DATABASE = process.env.SMOKE_SQL_DATABASE ?? "HorusPdv";
const RUN_ID = process.env.SMOKE_RUN_ID ?? `SMOKE_${Date.now()}`;
const SQL_PREFIX = RUN_ID.replace(/[^A-Z0-9_]/gi, "_");
const PASSWORD = `Senha@${Date.now().toString().slice(-6)}Aa`;
const KEEP_DATA = ["1", "true", "sim", "yes"].includes(
  (process.env.SMOKE_KEEP_DATA ?? "").toLowerCase(),
);

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type LoginData = {
  token: string;
  user: {
    id: string;
    companyId: string;
    cpf: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    createdAt: string;
    lastLoginAt: string;
    mustChangePassword: boolean;
  };
};

type Entity = { id: string };
type Product = Entity & { productCode: string; productName: string; productQnt: string };
type Company = {
  fantasyName: string;
  corporateName: string;
  cnpj: string;
  stateRegistration: string;
  website: string;
  email: string;
  sacPhone: string;
  phone: string;
  mobile: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  uf: string;
  complement: string;
  emailSmtpEnabled: boolean;
  emailSmtpHost: string;
  emailSmtpPort: number;
  emailSmtpEnableSsl: boolean;
  emailSmtpUser: string;
  emailSmtpPassword: string;
  emailSmtpHasPassword: boolean;
  emailSmtpFromEmail: string;
  emailSmtpFromName: string;
  emailSmtpReplyTo: string;
};

let sqlContainer: string | null = null;
let originalCompanyEmailEnabled: string | null = null;
let companySnapshot: Company | null = null;
let authToken = "";
let openedCashInSmoke = false;
let documentSequence = 0;

const smoke = {
  companyName: `${RUN_ID} Empresa`,
  email: `${RUN_ID.toLowerCase()}@hpdv.test`,
  phone: "(11) 98888-7777",
  cnpj: generateCnpj(),
};

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  sqlContainer = resolveSqlContainer();
  cleanupSql();
  originalCompanyEmailEnabled = querySqlScalar(
    "SET NOCOUNT ON; SELECT CAST(EmailSmtpEnabled AS INT) FROM Empresas WHERE Id = N'empresa-principal';",
  );
  runSql("UPDATE Empresas SET EmailSmtpEnabled = 0 WHERE Id = N'empresa-principal';");
});

test.afterAll(async ({ request }) => {
  if (authToken && openedCashInSmoke) {
    await api(request, authToken, "/Caixa/fechar", {
      method: "POST",
      body: { closingAmount: "100,00", note: `${RUN_ID} cleanup` },
      allowFailure: true,
    });
  }

  if (authToken && companySnapshot) {
    await api(request, authToken, "/Empresa", {
      method: "PUT",
      body: companySnapshot,
      allowFailure: true,
    });
  }

  if (!KEEP_DATA) {
    cleanupSql();
  }
  if (originalCompanyEmailEnabled !== null && /^[01]$/.test(originalCompanyEmailEnabled)) {
    runSql(
      `UPDATE Empresas SET EmailSmtpEnabled = ${originalCompanyEmailEnabled} WHERE Id = N'empresa-principal';`,
    );
  }
});

test("smoke completo: cadastro, login, navegacao e operacoes conectadas", async ({
  page,
  request,
}) => {
  await createPublicAccount(page);
  authToken = await loginThroughUi(page);

  await expect(page.getByText(smoke.companyName).first()).toBeVisible();
  await validateAuthenticatedCompanyScope(request);
  await validateGuidedTour(page);

  await logoutAndLoginAgain(page);
  const loginData = await loginApi(request);
  authToken = loginData.token;
  expect(loginData.user.companyId).toBeTruthy();
  expect(loginData.user.companyId).not.toBe("empresa-principal");
  await hydrateBrowserSession(page, loginData);

  await validateAllPagesRender(page);
  await validateProfileUpdateThroughUi(page, request);
  await validateAdvancedModulesThroughUi(page);
  await validateCrudAndOperations(request);
  logSavedDataHint();
});

async function createPublicAccount(page: Page) {
  await page.goto(APP_URL);
  await page.getByRole("button", { name: /criar cadastro/i }).click();
  await expect(page.getByRole("heading", { name: /criar cadastro/i })).toBeVisible();

  await page.getByLabel(/nome da empresa/i).fill(smoke.companyName);
  await page.getByLabel(/cnpj/i).fill(smoke.cnpj);
  await page.getByLabel(/telefone/i).fill(smoke.phone);
  await page.getByLabel(/e-mail/i).fill(smoke.email);
  await page.getByLabel(/^senha$/i).fill(PASSWORD);
  await page.getByLabel(/confirmar senha/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^criar cadastro$/i }).click();

  await expect(page.getByRole("heading", { name: /bem-vindo de volta/i })).toBeVisible({
    timeout: 20_000,
  });
}

async function loginThroughUi(page: Page) {
  await page.getByLabel(/e-mail/i).fill(smoke.email);
  await page.getByLabel(/^senha$/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({ timeout: 20_000 });
  return page.evaluate(() => window.localStorage.getItem("horuspdv.auth.token") ?? "");
}

async function logoutAndLoginAgain(page: Page) {
  await page.getByRole("button", { name: new RegExp(smoke.companyName, "i") }).click();
  await page.getByRole("button", { name: /sair/i }).click();
  await expect(page.getByRole("heading", { name: /bem-vindo de volta/i })).toBeVisible();
  await page.getByLabel(/e-mail/i).fill(smoke.email);
  await page.getByLabel(/^senha$/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({ timeout: 20_000 });
}

async function validateGuidedTour(page: Page) {
  await page.getByRole("button", { name: "Abrir tour da tela", exact: true }).click();
  await expect(page.getByText("Objetivo da tela")).toBeVisible();
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await expect(page.getByText("Área de trabalho")).toBeVisible();
  await page.getByRole("button", { name: "Pular", exact: true }).click();
  await expect(page.getByText("Área de trabalho")).toBeHidden();
}

async function hydrateBrowserSession(page: Page, loginData: LoginData) {
  const applyAuthSession = ({ token, user }: LoginData) => {
    window.sessionStorage.removeItem("horuspdv.auth.token");
    window.sessionStorage.removeItem("horuspdv.auth.user");
    window.localStorage.setItem("horuspdv.auth.token", token);
    window.localStorage.setItem("horuspdv.auth.user", JSON.stringify(user));
    window.localStorage.setItem("horuspdv.auth.remember", "1");
  };

  await page.context().addInitScript(applyAuthSession, loginData);
  await page.evaluate(applyAuthSession, loginData);
  await page.goto(APP_URL);
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

async function validateAllPagesRender(page: Page) {
  const pages = [
    ["home", "Home"],
    ["cadastro-cliente", "Cadastro de Cliente"],
    ["cadastro-fornecedor", "Cadastro de Fornecedor"],
    ["cadastro-produto", "Cadastro de Produto"],
    ["historico-vendas", "Histórico de Vendas"],
    ["relatorios", "Relatórios"],
    ["fiscal", "Fiscal NFC-e / NF-e"],
    ["pagamentos", "Pagamentos Integrados"],
    ["estoque", "Estoque e Inventário"],
    ["caixa", "Abertura e Fechamento de Caixa"],
    ["compras", "Compras e Reposição"],
    ["devolucoes", "Trocas e Devoluções"],
    ["crm-fidelidade", "CRM e Fidelidade"],
    ["omnichannel", "Omnichannel e Integrações"],
    ["conta-de-usuario", "Usuários"],
    ["minha-empresa", "Minha Empresa"],
    ["detalhe-licenca", "Detalhes da Licença"],
    ["sobre-pdv", "Sobre PDV"],
    ["editar-perfil", "Perfil do usuário"],
    ["configuracoes", "Configurações"],
  ] as const;

  for (const [key, title] of pages) {
    await page.evaluate((activePage) => {
      window.localStorage.setItem("horuspdv.activePage", activePage);
    }, key);
    await page.goto(APP_URL);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible({
      timeout: 15_000,
    });
    if (key === "fiscal" || key === "pagamentos") {
      await expect(page.getByText(/em desenvolvimento/i).first()).toBeVisible();
    }
  }
}

async function validateAdvancedModulesThroughUi(page: Page) {
  const modules = [
    ["estoque", "Estoque e Inventário", "Ajustar estoque"],
    ["compras", "Compras e Reposição", "Novo pedido"],
    ["devolucoes", "Trocas e Devoluções", "Nova devolução"],
    ["crm-fidelidade", "CRM e Fidelidade", "Nova campanha"],
    ["omnichannel", "Omnichannel e Integrações", "Conectar canal"],
  ] as const;

  for (const [key, title, action] of modules) {
    const recordTitle = `${RUN_ID} UI ${title}`;
    const editedTitle = `${recordTitle} Editado`;

    await openAppPage(page, key, title);
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByRole("heading", { name: action, exact: true })).toBeVisible();
    await page.getByLabel("Título").fill(recordTitle);
    await page.getByLabel("Descrição").fill(`Fluxo de ${title} validado pela tela.`);
    await page.getByLabel("Valor").fill("12345");
    await page.getByLabel("Informação adicional").fill(`${RUN_ID} via UI`);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    const row = page.locator("article").filter({ hasText: recordTitle }).first();
    await expect(row).toBeVisible();

    await row.getByLabel("Abrir ações").click();
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Editar registro", exact: true })).toBeVisible();
    await page.getByLabel("Título").fill(editedTitle);
    await page.getByLabel("Descrição").fill(`Fluxo de ${title} editado pela tela.`);
    await page.getByLabel("Informação adicional").fill(`${RUN_ID} editado via UI`);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    const editedRow = page.locator("article").filter({ hasText: editedTitle }).first();
    await expect(editedRow).toBeVisible();

    if (!KEEP_DATA) {
      await editedRow.getByLabel("Abrir ações").click();
      await page.getByRole("button", { name: "Excluir", exact: true }).click();
      await page.getByRole("button", { name: "Sim", exact: true }).click();
      await expect(editedRow).toBeHidden();
    }
  }
}

async function validateProfileUpdateThroughUi(page: Page, request: APIRequestContext) {
  const updatedName = `${RUN_ID} Perfil Editado`;
  const updatedEmail = `${RUN_ID.toLowerCase()}_perfil@hpdv.test`;
  const updatedPhone = "(11) 96666-3333";

  await openAppPage(page, "editar-perfil", "Perfil do usuário");
  await page.getByLabel(/^Nome$/i).fill(updatedName);
  await page.getByLabel(/^Email$/i).fill(updatedEmail);
  await page.getByLabel(/^Telefone$/i).fill(updatedPhone);
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByText("Perfil atualizado com sucesso.")).toBeVisible();
  await page.getByRole("button", { name: "OK", exact: true }).click();

  const storedUser = await page.evaluate(() => {
    const raw = window.localStorage.getItem("horuspdv.auth.user");
    return raw ? JSON.parse(raw) : null;
  });
  expect(storedUser?.name).toBe(updatedName);
  expect(storedUser?.email).toBe(updatedEmail);
  expect(storedUser?.phone).toBe(updatedPhone);
  expect(storedUser?.companyId).toBeTruthy();

  const me = await api<LoginData["user"]>(request, authToken, "/Auth/me");
  expect(me.name).toBe(updatedName);
  expect(me.email).toBe(updatedEmail);
  expect(me.phone).toBe(updatedPhone);
  expect(me.companyId).toBe(storedUser.companyId);
}

async function validateAuthenticatedCompanyScope(request: APIRequestContext) {
  const me = await api<LoginData["user"]>(request, authToken, "/Auth/me");
  expect(me.companyId).toBeTruthy();
  expect(me.companyId).not.toBe("empresa-principal");
}

async function openAppPage(page: Page, key: string, title: string) {
  await page.evaluate((activePage) => {
    window.localStorage.setItem("horuspdv.activePage", activePage);
  }, key);
  await page.goto(APP_URL);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

async function validateCrudAndOperations(request: APIRequestContext) {
  const supplier = await createSupplier(request);
  const supplierName = await updateSupplier(request, supplier.id);

  const customer = await createCustomer(request);
  await updateCustomer(request, customer.id);

  const product = await createProduct(request, supplierName);
  const sellableProduct = await updateProduct(request, product.id, product.productCode, supplierName);

  await validateAdvancedModules(request);
  await validateUsers(request);
  await validateCompany(request);
  await validateCashAndSales(request, sellableProduct.productCode, sellableProduct.productName);
  await validateReportsAndSessions(request);

  if (!KEEP_DATA) {
    await api(request, authToken, `/Produto/${product.id}`, { method: "DELETE" });
    await api(request, authToken, `/Cliente/${customer.id}`, { method: "DELETE" });
    await api(request, authToken, `/Fornecedor/${supplier.id}`, { method: "DELETE" });
  }
}

function logSavedDataHint() {
  if (!KEEP_DATA) return;
  console.log(
    `Dados mantidos para conferencia: RUN_ID=${RUN_ID}. Consulte registros com prefixo ${SQL_PREFIX}% no banco ${SQL_DATABASE}.`,
  );
}

async function createSupplier(request: APIRequestContext) {
  const supplier = await api<Entity>(request, authToken, "/Fornecedor", {
    method: "POST",
    body: supplierPayload("Fornecedor"),
  });
  expect(supplier?.id).toBeTruthy();
  return supplier;
}

async function updateSupplier(request: APIRequestContext, id: string) {
  const name = `${RUN_ID} Fornecedor Editado`;
  await api(request, authToken, `/Fornecedor/${id}`, {
    method: "PUT",
    body: supplierPayload("Fornecedor Editado"),
  });
  return name;
}

async function createCustomer(request: APIRequestContext) {
  const customer = await api<Entity>(request, authToken, "/Cliente", {
    method: "POST",
    body: customerPayload("Cliente"),
  });
  expect(customer?.id).toBeTruthy();
  return customer;
}

async function updateCustomer(request: APIRequestContext, id: string) {
  await api(request, authToken, `/Cliente/${id}`, {
    method: "PUT",
    body: customerPayload("Cliente Editado"),
  });
}

async function createProduct(request: APIRequestContext, supplierName: string) {
  const payload = productPayload("Produto", supplierName, "5");
  const product = await api<Product>(request, authToken, "/Produto", {
    method: "POST",
    body: payload,
  });
  expect(product?.id).toBeTruthy();
  return { ...product, productCode: payload.productCode, productName: payload.productName };
}

async function updateProduct(
  request: APIRequestContext,
  id: string,
  productCode: string,
  supplierName: string,
) {
  const productName = `${RUN_ID} Produto Editado`;
  await api(request, authToken, `/Produto/${id}`, {
    method: "PUT",
    body: {
      ...productPayload("Produto Editado", supplierName, "5"),
      productCode,
      productName,
    },
  });
  return { productCode, productName };
}

async function validateAdvancedModules(request: APIRequestContext) {
  const modules = ["estoque", "caixa", "compras", "devolucoes", "crm-fidelidade", "omnichannel"];

  for (const moduleId of modules) {
    const title = `${RUN_ID} ${moduleId}`;
    const createdConfig = await api<{ records: Array<Entity & { title: string }> }>(
      request,
      authToken,
      `/ModuloMercado/${moduleId}/registros`,
      {
        method: "POST",
        body: {
          title,
          description: "Registro criado pelo smoke",
          status: "Pendente",
          amount: "R$ 10,00",
          meta: RUN_ID,
        },
      },
    );
    const record = createdConfig.records.find((item) => item.title === title);
    expect(record?.id).toBeTruthy();

    await api(request, authToken, `/ModuloMercado/${moduleId}/registros/${record!.id}`, {
      method: "PUT",
      body: {
        title: `${title} Editado`,
        description: "Registro editado pelo smoke",
        status: "Concluído",
        amount: "R$ 12,00",
        meta: RUN_ID,
      },
    });

    if (!KEEP_DATA) {
      await api(request, authToken, `/ModuloMercado/${moduleId}/registros/${record!.id}`, {
        method: "DELETE",
      });
    }
  }
}

async function validateUsers(request: APIRequestContext) {
  const userId = (
    await api<Entity>(request, authToken, "/Usuario", {
      method: "POST",
      body: {
        cpf: generateCpf(),
        name: `${RUN_ID} Operador`,
        email: `${RUN_ID.toLowerCase()}_operador@hpdv.test`,
        phone: "(11) 97777-1111",
        role: "atendente",
        status: "ativo",
        password: PASSWORD,
      },
    })
  ).id;

  await api(request, authToken, `/Usuario/${userId}`, {
    method: "PUT",
    body: {
      cpf: generateCpf(),
      name: `${RUN_ID} Operador Editado`,
      email: `${RUN_ID.toLowerCase()}_operador_editado@hpdv.test`,
      phone: "(11) 97777-2222",
      role: "gerente",
      status: "ativo",
      password: PASSWORD,
    },
  });
  await api(request, authToken, `/Usuario/${userId}/status`, {
    method: "PATCH",
    body: { status: "inativo" },
  });
  await api(request, authToken, `/Usuario/${userId}/status`, {
    method: "PATCH",
    body: { status: "ativo" },
  });
  await api(request, authToken, `/Usuario/${userId}/resetar-senha`, { method: "POST" });
}

async function validateCompany(request: APIRequestContext) {
  companySnapshot = await api<Company>(request, authToken, "/Empresa");
  await api(request, authToken, "/Empresa", {
    method: "PUT",
    body: {
      ...companySnapshot,
      website: "https://smoke.hpdv.test",
      emailSmtpEnabled: false,
      emailSmtpPassword: "",
    },
  });
}

async function validateCashAndSales(
  request: APIRequestContext,
  productCode: string,
  productName: string,
) {
  const status = await api<{
    state: string;
    canSell?: boolean;
    currentSession?: { operatorName: string } | null;
  }>(request, authToken, "/Caixa/status");

  if (status.currentSession && !status.canSell) {
    await api(request, authToken, "/Caixa/fechar", {
      method: "POST",
      body: { closingAmount: "0,00", note: `${RUN_ID} fechamento de caixa expirado` },
    });
  }

  if (status.state !== "aberto" || !status.canSell) {
    await api(request, authToken, "/Caixa/abrir", {
      method: "POST",
      body: { openingAmount: "100,00" },
    });
    openedCashInSmoke = true;
  }

  const sale = await api<{ saleNumber: string }>(request, authToken, "/HistoricoVendas", {
    method: "POST",
    body: {
      customerName: `${RUN_ID} Consumidor`,
      customerCpf: generateCpf(),
      paymentType: "Dinheiro",
      totalAmount: "50,00",
      items: [{ productCode, productName, quantity: 2 }],
    },
  });

  expect(sale.saleNumber).toBeTruthy();
  const sales = await api<Array<{ saleNumber: string }>>(request, authToken, "/HistoricoVendas");
  expect(sales.some((item) => item.saleNumber === sale.saleNumber)).toBeTruthy();
  await api(request, authToken, `/HistoricoVendas/${sale.saleNumber}/imprimir`, { method: "POST" });

  const products = await api<Product[]>(request, authToken, "/Produto");
  const soldProduct = products.find((item) => item.productCode === productCode);
  expect(soldProduct?.productQnt).toBe("3");

  if (openedCashInSmoke) {
    await api(request, authToken, "/Caixa/fechar", {
      method: "POST",
      body: { closingAmount: "150,00", note: `${RUN_ID} fechamento smoke` },
    });
    openedCashInSmoke = false;
  }
}

async function validateReportsAndSessions(request: APIRequestContext) {
  const report = await api<{ rows: unknown[] }>(request, authToken, "/Relatorio/Gerar", {
    method: "POST",
    body: { reportId: "vendas-periodo", filters: { origem: RUN_ID } },
  });
  expect(report.rows.length).toBeGreaterThan(0);

  await api(request, authToken, "/Sessao");
  await api(request, authToken, "/Sessao/outras", { method: "DELETE", allowFailure: true });
}

async function loginApi(request: APIRequestContext) {
  return api<LoginData>(request, "", "/Auth/login", {
    method: "POST",
    body: {
      email: smoke.email,
      password: PASSWORD,
      rememberMe: true,
      recaptchaToken: "smoke-test",
    },
  });
}

async function api<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    allowFailure?: boolean;
  } = {},
) {
  const response = await request.fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    data: options.body,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  });

  const raw = await response.text();
  let payload: ApiResponse<T>;
  try {
    payload = raw ? JSON.parse(raw) : { success: response.ok() };
  } catch {
    payload = { success: response.ok(), message: raw };
  }

  if (!options.allowFailure) {
    expect(response.ok(), `${options.method ?? "GET"} ${path}: ${raw}`).toBeTruthy();
    expect(payload.success, `${options.method ?? "GET"} ${path}: ${raw}`).toBeTruthy();
  }

  return payload.data as T;
}

function supplierPayload(label: string) {
  return {
    companyName: `${RUN_ID} ${label} Ltda`,
    fantasyName: `${RUN_ID} ${label}`,
    cnpj: generateCnpj(),
    cep: "01310-100",
    city: "São Paulo",
    state: "SP",
    address: "Avenida Paulista",
    neighborhood: "Bela Vista",
    streetComplement: "Conjunto smoke",
    number: "1578",
    referencePoint: "MASP",
    telephone: "(11) 3333-1111",
    cellphone: "(11) 94444-1111",
    email: `${RUN_ID.toLowerCase()}_${slug(label)}@fornecedor.test`,
  };
}

function customerPayload(label: string) {
  return {
    customerName: `${RUN_ID} ${label}`,
    document: generateCpf(),
    birthDate: "01/01/1990",
    age: "36",
    cep: "01310-100",
    city: "São Paulo",
    state: "SP",
    address: "Avenida Paulista",
    neighborhood: "Bela Vista",
    streetComplement: "Apto smoke",
    number: "1578",
    referencePoint: "MASP",
    telephone: "(11) 3333-2222",
    cellphone: "(11) 95555-2222",
    email: `${RUN_ID.toLowerCase()}_${slug(label)}@cliente.test`,
  };
}

function productPayload(label: string, supplierName: string, quantity: string) {
  const unit = "10,00";
  const total = (Number(quantity) * 10).toFixed(2).replace(".", ",");
  return {
    productImageUrl: "",
    productImageName: "",
    productName: `${RUN_ID} ${label}`,
    productCode: `${SQL_PREFIX}_${slug(label).toUpperCase()}`,
    productSupplier: supplierName,
    productDescription: "Produto criado pelo smoke",
    productQnt: quantity,
    productUnitPrice: unit,
    productSalePrice: "25,00",
    totalPriceOnProduct: total,
  };
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

function resolveSqlContainer() {
  const configured = process.env.SMOKE_SQL_CONTAINER;
  const candidates = configured ? [configured] : ["sqlserver2025", "sqlserver"];

  for (const name of candidates) {
    try {
      execFileSync("docker", ["inspect", "-f", "{{.State.Running}}", name], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return name;
    } catch {
      // tenta o proximo nome conhecido
    }
  }

  throw new Error(
    `SQL Server Docker nao encontrado. Use SMOKE_SQL_CONTAINER ou suba um container chamado ${candidates.join(" ou ")}.`,
  );
}

function runSql(sql: string) {
  if (!sqlContainer) throw new Error("Container SQL nao resolvido.");
  const args = ["exec", sqlContainer, sqlcmdPath(), "-S", "localhost", "-U", "sa", "-P", SQL_PASSWORD, "-C", "-d", SQL_DATABASE, "-b", "-Q", sql];
  execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function querySqlScalar(sql: string) {
  if (!sqlContainer) throw new Error("Container SQL nao resolvido.");
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
    "-h",
    "-1",
    "-W",
    "-Q",
    sql,
  ];
  const output = execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0] ?? null;
}

function sqlcmdPath() {
  if (!sqlContainer) return "/opt/mssql-tools18/bin/sqlcmd";
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

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}
