/**
 * Arquivo: src/App.tsx
 * Objetivo: orquestra o shell administrativo com sidebar, cabeçalho mobile e lazy loading das páginas.
 * Entradas esperadas: não recebe props; controla estado global de navegação local.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Menu } from "lucide-react";
import AppSidebar, { type PageKey } from "@/components/AppSidebar/AppSidebar";
import LoadingBar from "@/components/Loading/LoadingBar";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import LoginPage from "@/pages/Auth/LoginPage";

const HomePage = lazy(() => import("@/pages/Admin/HomePage"));
const CustomerRegisterPage = lazy(
  () => import("@/pages/Admin/CustomerRegisterPage"),
);
const SupplierRegisterPage = lazy(
  () => import("@/pages/Admin/SupplierRegisterPage"),
);
const ProductRegisterPage = lazy(() => import("@/pages/Admin/ProductRegisterPage"));
const SalesHistoryPage = lazy(() => import("@/pages/Admin/SalesHistoryPage"));
const SalesStartPage = lazy(() => import("@/pages/Admin/SalesStartPage"));
const ReportsPage = lazy(() => import("@/pages/Admin/ReportsPage"));
const UserAccountsPage = lazy(() => import("@/pages/Admin/UserAccountsPage"));
const FiscalPage = lazy(() => import("@/pages/Admin/FiscalPage"));
const PaymentsPage = lazy(() => import("@/pages/Admin/PaymentsPage"));
const StockPage = lazy(() => import("@/pages/Admin/StockPage"));
const CashRegisterPage = lazy(() => import("@/pages/Admin/CashRegisterPage"));
const PurchasesPage = lazy(() => import("@/pages/Admin/PurchasesPage"));
const ReturnsPage = lazy(() => import("@/pages/Admin/ReturnsPage"));
const CrmLoyaltyPage = lazy(() => import("@/pages/Admin/CrmLoyaltyPage"));
const OmnichannelPage = lazy(() => import("@/pages/Admin/OmnichannelPage"));
const SettingsPage = lazy(() => import("@/pages/Admin/SettingsPage"));
const MyCompanyPage = lazy(() => import("@/pages/Admin/MyCompanyPage"));
const LicenseDetailsPage = lazy(() => import("@/pages/Admin/LicenseDetailsPage"));
const AboutPdvPage = lazy(() => import("@/pages/Admin/AboutPdvPage"));
const EditProfilePage = lazy(() => import("@/pages/Admin/EditProfilePage"));
const PROFILE_AVATAR_STORAGE_KEY = "horuspdv.profile.avatar";
const ACTIVE_PAGE_STORAGE_KEY = "horuspdv.activePage";
const THEME_STORAGE_KEY = "horuspdv.theme";
const USER_PASSWORD_STORAGE_KEY = "horuspdv.current-user.password";
const AUTH_STORAGE_KEY = "horuspdv.authenticated";
const POS_TAB_NAME = "horuspdv-pdv-tab";

const EmptyPage = () => null;

type CurrentUser = {
  name: string;
  email: string;
  permission: string;
  avatarUrl: string | null;
};

type ThemeMode = "light" | "dark";

export default function App() {
  const statusDialog = useStatusDialog();
  const posTabRef = useRef<Window | null>(null);
  const isStandalonePos =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("pdv") === "1";

  const isPageKey = (value: string): value is PageKey =>
    [
      "home",
      "cadastro-cliente",
      "cadastro-fornecedor",
      "cadastro-produto",
      "historico-vendas",
      "relatorios",
      "vendas",
      "fiscal",
      "pagamentos",
      "estoque",
      "caixa",
      "compras",
      "devolucoes",
      "crm-fidelidade",
      "omnichannel",
      "conta-de-usuario",
      "minha-empresa",
      "detalhe-licenca",
      "sobre-pdv",
      "editar-perfil",
      "configuracoes",
    ].includes(value);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState<PageKey>(() => {
    if (typeof window === "undefined") return "home";
    if (new URLSearchParams(window.location.search).get("pdv") === "1") {
      return "vendas";
    }
    const savedPage = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    return savedPage && isPageKey(savedPage) ? savedPage : "home";
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === "dark" ? "dark" : "light";
  });
  const [currentUserPassword, setCurrentUserPassword] = useState(() => {
    if (typeof window === "undefined") return "Admin@1234";
    return window.localStorage.getItem(USER_PASSWORD_STORAGE_KEY) ?? "Admin@1234";
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === "1";
  });

  const [currentUser, setCurrentUser] = useState<CurrentUser>(() => ({
    name: "Administrador do Sistema",
    email: "admin@hpdv.com.br",
    permission: "Administrador",
    avatarUrl:
      typeof window !== "undefined"
        ? window.localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY)
        : null,
  }));

  const pageTitleByKey: Record<PageKey, string> = {
    home: "Home",
    "cadastro-cliente": "Cadastro de Cliente",
    "cadastro-fornecedor": "Cadastro de Fornecedor",
    "cadastro-produto": "Cadastro de Produto",
    "historico-vendas": "Histórico de Vendas",
    relatorios: "Relatórios",
    vendas: "Iniciar Vendas",
    fiscal: "Fiscal NFC-e / NF-e",
    pagamentos: "Pagamentos Integrados",
    estoque: "Estoque e Inventário",
    caixa: "Abertura e Fechamento de Caixa",
    compras: "Compras e Reposição",
    devolucoes: "Trocas e Devoluções",
    "crm-fidelidade": "CRM e Fidelidade",
    omnichannel: "Omnichannel e Integrações",
    "conta-de-usuario": "Contas de Usuários",
    "minha-empresa": "Minha Empresa",
    "detalhe-licenca": "Detalhes da Licença",
    "sobre-pdv": "Sobre PDV",
    "editar-perfil": "Meu Perfil",
    configuracoes: "Configurações",
  };

  const CurrentPage = useMemo(() => {
    switch (activePage) {
      case "home":
        return HomePage;
      case "cadastro-cliente":
        return CustomerRegisterPage;
      case "cadastro-fornecedor":
        return SupplierRegisterPage;
      case "cadastro-produto":
        return ProductRegisterPage;
      case "historico-vendas":
        return SalesHistoryPage;
      case "relatorios":
        return ReportsPage;
      case "fiscal":
        return FiscalPage;
      case "pagamentos":
        return PaymentsPage;
      case "estoque":
        return StockPage;
      case "caixa":
        return CashRegisterPage;
      case "compras":
        return PurchasesPage;
      case "devolucoes":
        return ReturnsPage;
      case "crm-fidelidade":
        return CrmLoyaltyPage;
      case "omnichannel":
        return OmnichannelPage;
      case "vendas":
        return SalesStartPage;
      case "conta-de-usuario":
        return UserAccountsPage;
      case "minha-empresa":
        return MyCompanyPage;
      case "detalhe-licenca":
        return LicenseDetailsPage;
      case "sobre-pdv":
        return AboutPdvPage;
      default:
        return EmptyPage;
    }
  }, [activePage]);

  const handleToggleTheme = () => {
    setThemeMode((current) => (current === "light" ? "dark" : "light"));
  };

  const handleLogout = () => {
    setMobileSidebarOpen(false);
    setActivePage("home");
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, "home");
    setIsAuthenticated(false);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const handleUploadAvatar = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      window.localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, result);
      setCurrentUser((current) => ({ ...current, avatarUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setCurrentUser((current) => {
      window.localStorage.removeItem(PROFILE_AVATAR_STORAGE_KEY);
      return { ...current, avatarUrl: null };
    });
  };

  const handleChangePassword = (currentPassword: string, nextPassword: string) => {
    if (currentPassword !== currentUserPassword) {
      return { success: false, message: "Senha atual inválida." };
    }
    setCurrentUserPassword(nextPassword);
    window.localStorage.setItem(USER_PASSWORD_STORAGE_KEY, nextPassword);
    return { success: true, message: "Senha atualizada com sucesso." };
  };

  const handleOpenSalesInNewTab = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("pdv", "1");

    if (posTabRef.current && !posTabRef.current.closed) {
      const shouldClose = await statusDialog.confirm(
        "A frente de caixa já está aberta. Deseja fechar essa aba?",
      );

      if (shouldClose) {
        posTabRef.current.close();
        posTabRef.current = null;
        await statusDialog.success("Aba da frente de caixa fechada.");
      } else {
        posTabRef.current.focus();
      }

      setMobileSidebarOpen(false);
      return;
    }

    posTabRef.current = window.open(url.toString(), POS_TAB_NAME);
    if (!posTabRef.current) {
      Toast.error("Não foi possível abrir a aba do PDV. Verifique bloqueio de pop-up.");
      setMobileSidebarOpen(false);
      return;
    }

    posTabRef.current.focus();
    setMobileSidebarOpen(false);
  };

  const handleLogin = (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const currentEmail = currentUser.email.trim().toLowerCase();

    if (normalizedEmail !== currentEmail) {
      return { success: false, message: "E-mail não encontrado." };
    }

    if (password !== currentUserPassword) {
      return { success: false, message: "Senha inválida." };
    }

    setIsAuthenticated(true);
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setActivePage(isStandalonePos ? "vendas" : "home");
    return { success: true, message: "Login realizado com sucesso." };
  };

  useEffect(() => {
    if (isStandalonePos) return;
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage);
  }, [activePage, isStandalonePos]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (activePage === "vendas" && isStandalonePos) {
      document.title = "Hórus PDV - Frente de Caixa";
      return;
    }
    document.title = "Hórus PDV";
  }, [activePage, isStandalonePos]);

  if (!isAuthenticated) {
    return <LoginPage defaultEmail={currentUser.email} onLogin={handleLogin} />;
  }

  if (activePage === "vendas") {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary font-sans">
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center text-text-secondary">
              <LoadingBar />
            </div>
          }
        >
          <SalesStartPage
            standalone={isStandalonePos}
            onExit={() => {
              if (isStandalonePos) {
                window.close();
                window.location.href = `${window.location.origin}${window.location.pathname}`;
                return;
              }
              setActivePage("home");
            }}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-bg-primary text-text-primary font-sans">
      <header className="lg:hidden fixed top-0 left-0 right-0 z-layer-mobile-header h-14 bg-bg-light border-b border-border-primary px-3 shadow-sm">
        <div className="h-full flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg border border-border-primary bg-bg-light shadow-sm"
            aria-label="Abrir menu"
          >
            <Menu size={20} className="text-accent" />
          </button>

          <h1 className="text-sm font-semibold text-text-primary truncate px-2">
            {pageTitleByKey[activePage]}
          </h1>
          <div className="w-10" />
        </div>
      </header>

      {mobileSidebarOpen && (
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-layer-mobile-header bg-black/30"
          aria-label="Fechar menu lateral"
        />
      )}

      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((current) => !current)}
        activePage={activePage}
        onChangePage={setActivePage}
        currentUserName={currentUser.name}
        currentUserPermission={currentUser.permission}
        currentUserAvatarUrl={currentUser.avatarUrl}
        onOpenProfile={() => setActivePage("editar-perfil")}
        onOpenSettings={() => setActivePage("configuracoes")}
        onLogout={handleLogout}
        onOpenSalesInNewTab={handleOpenSalesInNewTab}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <Suspense
        fallback={
          <div className="flex-1 h-full min-h-0 flex items-center justify-center text-text-secondary">
            <LoadingBar />
          </div>
        }
      >
        <main className="flex-1 h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pt-14 lg:pt-0">
          {activePage === "editar-perfil" ? (
            <EditProfilePage
              userName={currentUser.name}
              userEmail={currentUser.email}
              userRole={currentUser.permission}
              userAvatarUrl={currentUser.avatarUrl}
              onUploadAvatar={handleUploadAvatar}
              onRemoveAvatar={handleRemoveAvatar}
              onChangePassword={handleChangePassword}
            />
          ) : activePage === "configuracoes" ? (
            <SettingsPage themeMode={themeMode} onToggleTheme={handleToggleTheme} />
          ) : activePage === "home" ? (
            <HomePage
              onNavigate={setActivePage}
              onOpenSalesInNewTab={handleOpenSalesInNewTab}
            />
          ) : (
            <CurrentPage />
          )}
        </main>
      </Suspense>
      {statusDialog.Dialog}
    </div>
  );
}
