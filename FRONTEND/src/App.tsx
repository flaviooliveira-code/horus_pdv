/**
 * Arquivo: src/App.tsx
 * Objetivo: orquestra o shell administrativo com sidebar, cabeçalho mobile e lazy loading das páginas.
 * Entradas esperadas: não recebe props; controla estado global de navegação local.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Menu } from "lucide-react";
import AppSidebar, { type PageKey } from "@/components/AppSidebar/AppSidebar";
import LoadingBar from "@/components/Loading/LoadingBar";
import GuidedTour from "@/components/Tour/GuidedTour";
import { APP_OPEN_TOUR_EVENT } from "@/domain/navigation/events";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import ForgotPasswordPage from "@/pages/Auth/ForgotPasswordPage";
import LoginPage from "@/pages/Auth/LoginPage";
import RegisterPage from "@/pages/Auth/RegisterPage";
import ResetPasswordPage from "@/pages/Auth/ResetPasswordPage";
import type { RegisterFormPayload } from "@/pages/Auth/types";
import { authService } from "@/services/api/authService";
import { cashRegisterService } from "@/services/api/cashRegisterService";
import {
  clearAuthSession,
  getAuthToken,
  getStoredAuthUser,
  isTokenExpired,
  setAuthSession,
  type AuthenticatedUser,
} from "@/utils/authStorage";

const HomePage = lazy(() => import("@/pages/Admin/HomePage"));
const CustomerRegisterPage = lazy(
  () => import("@/pages/Admin/CustomerRegisterPage"),
);
const SupplierRegisterPage = lazy(
  () => import("@/pages/Admin/SupplierRegisterPage"),
);
const ProductRegisterPage = lazy(
  () => import("@/pages/Admin/ProductRegisterPage"),
);
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
const LicenseDetailsPage = lazy(
  () => import("@/pages/Admin/LicenseDetailsPage"),
);
const AboutPdvPage = lazy(() => import("@/pages/Admin/AboutPdvPage"));
const EditProfilePage = lazy(() => import("@/pages/Admin/EditProfilePage"));
const PROFILE_AVATAR_STORAGE_KEY = "horuspdv.profile.avatar";
const ACTIVE_PAGE_STORAGE_KEY = "horuspdv.activePage";
const THEME_STORAGE_KEY = "horuspdv.theme";
const POS_TAB_NAME = "horuspdv-pdv-tab";

const EmptyPage = () => null;

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  permission: string;
  avatarUrl: string | null;
};

type ThemeMode = "light" | "dark";
type PublicAuthPage =
  | "login"
  | "forgot-password"
  | "reset-password"
  | "register";

function formatRole(role: string) {
  const labels: Record<string, string> = {
    administrador: "Administrador",
    gerente: "Gerente",
    atendente: "Atendente",
    financeiro: "Financeiro",
  };
  return labels[role] ?? role;
}

function toCurrentUser(user: AuthenticatedUser): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    permission: formatRole(user.role),
    avatarUrl:
      typeof window !== "undefined"
        ? window.localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY)
        : null,
  };
}

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
  const [tourOpen, setTourOpen] = useState(false);
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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    const token = getAuthToken();
    return Boolean(token && !isTokenExpired(token) && getStoredAuthUser());
  });

  const [currentUser, setCurrentUser] = useState<CurrentUser>(() => {
    const storedUser =
      typeof window !== "undefined" ? getStoredAuthUser() : null;
    return {
      id: storedUser?.id || "",
      name: storedUser?.name || "",
      email: storedUser?.email || "",
      phone: storedUser?.phone || "",
      permission: formatRole(storedUser?.role || ""),
      avatarUrl:
        typeof window !== "undefined"
          ? window.localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY)
          : null,
    };
  });
  const [publicAuthPage, setPublicAuthPage] = useState<PublicAuthPage>(() => {
    if (typeof window === "undefined") return "login";
    const params = new URLSearchParams(window.location.search);
    return params.get("resetToken") || params.get("token")
      ? "reset-password"
      : "login";
  });
  const [passwordResetToken, setPasswordResetToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("resetToken") || params.get("token") || "";
  });

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
    authService.logout().catch(() => undefined);
    clearAuthSession();
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

  const handleChangePassword = async (
    currentPassword: string,
    nextPassword: string,
  ) => {
    try {
      await authService.changePassword(currentPassword, nextPassword);
      clearAuthSession();
      setIsAuthenticated(false);
      return {
        success: true,
        message: "Senha atualizada com sucesso. Faça login novamente.",
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao atualizar senha.",
      };
    }
  };

  const handleUpdateProfile = async (name: string, email: string, phone: string) => {
    try {
      const user = await authService.updateMe({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      if (!user) {
        return { success: false, message: "A API não retornou o perfil atualizado." };
      }

      const token = getAuthToken();
      if (token) setAuthSession(token, user);
      setCurrentUser(toCurrentUser(user));
      return { success: true, message: "Perfil atualizado com sucesso." };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Erro ao atualizar perfil.",
      };
    }
  };

  const handleOpenSalesInNewTab = async () => {
    try {
      const cashStatus = await cashRegisterService.status();
      if (!cashStatus?.canSell) {
        const shouldOpenCashRegister = await statusDialog.confirm(
          cashStatus?.blockReason ||
            "Para iniciar vendas, abra o caixa do dia primeiro.",
          {
            confirmIntent: "success",
            cancelLabel: "Agora não",
            confirmLabel: "Abrir caixa",
          },
        );

        if (shouldOpenCashRegister) {
          setActivePage("caixa");
        }

        setMobileSidebarOpen(false);
        return;
      }
    } catch (error) {
      Toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível validar o status do caixa.",
      );
      setMobileSidebarOpen(false);
      return;
    }

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
      Toast.error(
        "Não foi possível abrir a aba do PDV. Verifique bloqueio de pop-up.",
      );
      setMobileSidebarOpen(false);
      return;
    }

    posTabRef.current.focus();
    setMobileSidebarOpen(false);
  };

  const handleLogin = async (
    email: string,
    password: string,
    remember: boolean,
    recaptchaToken?: string,
  ) => {
    try {
      const result = await authService.login({
        email: email.trim(),
        password,
        rememberMe: remember,
        recaptchaToken,
      });

      if (!result) {
        return {
          success: false,
          message: "A API não retornou os dados de login.",
        };
      }

      setAuthSession(result.token, result.user, remember);
      setCurrentUser(toCurrentUser(result.user));
      setIsAuthenticated(true);
      setActivePage(isStandalonePos ? "vendas" : "home");
      return { success: true, message: "Login realizado com sucesso." };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao fazer login.",
      };
    }
  };

  const handleForgotPassword = async (
    cnpj: string,
    email: string,
    recaptchaToken?: string,
  ) => {
    try {
      const data = await authService.forgotPassword(
        cnpj.trim(),
        email.trim(),
        recaptchaToken,
      );
      return {
        success: true,
        message:
          "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.",
        data,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro ao solicitar recuperação de senha.",
      };
    }
  };

  const handleResetPassword = async (
    token: string,
    nextPassword: string,
    confirmPassword: string,
    recaptchaToken?: string,
  ) => {
    try {
      await authService.resetPassword(
        token.trim(),
        nextPassword,
        confirmPassword,
        recaptchaToken,
      );
      const url = new URL(window.location.href);
      url.searchParams.delete("resetToken");
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
      return {
        success: true,
        message: "Senha redefinida com sucesso. Faça login novamente.",
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao redefinir senha.",
      };
    }
  };

  const handleRegister = async (
    payload: RegisterFormPayload,
    recaptchaToken?: string,
  ) => {
    try {
      await authService.register({
        ...payload,
        email: payload.email.trim(),
        name: payload.name.trim(),
        recaptchaToken,
      });
      return {
        success: true,
        message: "Cadastro criado com sucesso. Faça login para continuar.",
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao criar cadastro.",
      };
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    authService
      .me()
      .then((user) => {
        if (!user) return;
        const token = getAuthToken();
        if (token) setAuthSession(token, user);
        setCurrentUser(toCurrentUser(user));
      })
      .catch(() => {
        clearAuthSession();
        setIsAuthenticated(false);
      });
  }, [isAuthenticated]);

  useEffect(() => {
    const syncAuthState = () => {
      const token = getAuthToken();
      if (!token || isTokenExpired(token)) {
        clearAuthSession();
        setIsAuthenticated(false);
        return;
      }

      const user = getStoredAuthUser();
      if (user) {
        setCurrentUser(toCurrentUser(user));
        setIsAuthenticated(true);
      }
    };

    window.addEventListener("storage", syncAuthState);
    window.addEventListener("horuspdv-auth-change", syncAuthState);
    window.addEventListener("focus", syncAuthState);
    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("horuspdv-auth-change", syncAuthState);
      window.removeEventListener("focus", syncAuthState);
    };
  }, []);

  useEffect(() => {
    if (isStandalonePos) return;
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage);
  }, [activePage, isStandalonePos]);

  useEffect(() => {
    const handleOpenTourEvent = () => {
      setTourOpen(true);
    };

    window.addEventListener(APP_OPEN_TOUR_EVENT, handleOpenTourEvent);
    return () => window.removeEventListener(APP_OPEN_TOUR_EVENT, handleOpenTourEvent);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (activePage === "vendas" && isStandalonePos) {
      document.title = "Hórus PDV - Frente de caixa grátis";
      return;
    }
    document.title = "Hórus PDV - PDV grátis e frente de caixa";
  }, [activePage, isStandalonePos]);

  if (!isAuthenticated) {
    if (publicAuthPage === "forgot-password") {
      return (
        <ForgotPasswordPage
          onForgotPassword={handleForgotPassword}
          onOpenLogin={() => setPublicAuthPage("login")}
          onOpenResetPassword={(token) => {
            setPasswordResetToken(token);
            setPublicAuthPage("reset-password");
          }}
        />
      );
    }

    if (publicAuthPage === "reset-password") {
      return (
        <ResetPasswordPage
          initialToken={passwordResetToken}
          onResetPassword={handleResetPassword}
          onOpenLogin={() => setPublicAuthPage("login")}
        />
      );
    }

    if (publicAuthPage === "register") {
      return (
        <RegisterPage
          onRegister={handleRegister}
          onOpenLogin={() => setPublicAuthPage("login")}
          onRegisterSuccess={() => {
            setPublicAuthPage("login");
          }}
        />
      );
    }

    return (
      <LoginPage
        onLogin={handleLogin}
        onOpenForgotPassword={() => setPublicAuthPage("forgot-password")}
        onOpenRegister={() => setPublicAuthPage("register")}
      />
    );
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
            operatorName={currentUser.name}
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
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-primary bg-bg-light text-secondary shadow-sm transition hover:bg-secondary/10"
            aria-label="Abrir tour da tela"
            title="Tour da tela"
          >
            <CircleHelp size={16} />
          </button>
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
        <main
          data-active-page={activePage}
          className="flex-1 h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pt-14 lg:pt-0"
        >
          {activePage === "editar-perfil" ? (
            <EditProfilePage
              userName={currentUser.name}
              userEmail={currentUser.email}
              userPhone={currentUser.phone}
              userRole={currentUser.permission}
              userAvatarUrl={currentUser.avatarUrl}
              onUploadAvatar={handleUploadAvatar}
              onRemoveAvatar={handleRemoveAvatar}
              onChangePassword={handleChangePassword}
              onUpdateProfile={handleUpdateProfile}
            />
          ) : activePage === "configuracoes" ? (
            <SettingsPage
              themeMode={themeMode}
              onToggleTheme={handleToggleTheme}
            />
          ) : activePage === "home" ? (
            <HomePage
              onNavigate={setActivePage}
              onOpenSalesInNewTab={handleOpenSalesInNewTab}
            />
          ) : (
            <CurrentPage />
          )}
          <GuidedTour
            open={tourOpen}
            page={activePage}
            onClose={() => setTourOpen(false)}
          />
        </main>
      </Suspense>
      {statusDialog.Dialog}
    </div>
  );
}
