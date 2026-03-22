/**
 * Arquivo: src/components/AppSidebar/AppSidebar.tsx
 * Objetivo: renderiza menu lateral no padrao do legado com suporte a desktop colapsado e drawer mobile.
 */
import {
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  House,
  KeyRound,
  LockKeyhole,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  UserRoundPlus,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import { useEffect, useState, type ReactNode } from "react";
import UserMenu from "./UserMenu";

const POS_TAB_NAME = "horuspdv-pdv-tab";
let posTabRef: Window | null = null;

export type PageKey =
  | "home"
  | "cadastro-cliente"
  | "cadastro-fornecedor"
  | "cadastro-produto"
  | "historico-vendas"
  | "relatorios"
  | "vendas"
  | "conta-de-usuario"
  | "detalhe-licenca"
  | "editar-perfil"
  | "alterar-senha";

type SidebarItemProps = {
  icon: ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick: () => void;
};

type SidebarSectionTitleProps = {
  label: string;
  collapsed: boolean;
};

function SidebarSectionTitle({ label, collapsed }: SidebarSectionTitleProps) {
  if (collapsed) {
    return <div className="my-1 border-t border-border-primary/70" />;
  }

  return (
    <h2 className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary/85">
      {label}
    </h2>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  collapsed,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition border text-left focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,191,244,0.22)] ${
        active
          ? "border-secondary/30 bg-accent/12 text-text-primary shadow-sm"
          : "border-transparent hover:border-border-secondary hover:bg-accent/10 hover:text-text-primary"
      }`}
    >
      <div className="text-accent">{icon}</div>
      {!collapsed && <span className="flex-1 whitespace-nowrap">{label}</span>}
      {!collapsed && <ChevronRight size={14} className="text-text-secondary" />}
    </button>
  );
}

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  activePage: PageKey;
  onChangePage: (page: PageKey) => void;
  currentUserName: string;
  currentUserPermission: string;
  currentUserAvatarUrl: string | null;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function AppSidebar({
  collapsed,
  onToggle,
  activePage,
  onChangePage,
  currentUserName,
  currentUserPermission,
  currentUserAvatarUrl,
  onOpenProfile,
  onOpenSettings,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const statusDialog = useStatusDialog();
  const cadastrosPages: PageKey[] = [
    "cadastro-cliente",
    "cadastro-fornecedor",
    "cadastro-produto",
  ];
  const configuracoesPages: PageKey[] = [
    "conta-de-usuario",
    "detalhe-licenca",
    "editar-perfil",
    "alterar-senha",
  ];

  const [cadastrosOpen, setCadastrosOpen] = useState(
    cadastrosPages.includes(activePage),
  );
  const [configOpen, setConfigOpen] = useState(
    configuracoesPages.includes(activePage),
  );

  useEffect(() => {
    setCadastrosOpen(cadastrosPages.includes(activePage));
    setConfigOpen(configuracoesPages.includes(activePage));
  }, [activePage]);

  const handleChangePage = (page: PageKey) => {
    onChangePage(page);
    onCloseMobile();
  };

  const handleOpenSalesInNewTab = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("pdv", "1");

    if (posTabRef && !posTabRef.closed) {
      const shouldClose = await statusDialog.confirm(
        "A frente de caixa já está aberta. Deseja fechar essa aba?",
      );

      if (shouldClose) {
        posTabRef.close();
        posTabRef = null;
        await statusDialog.success("Aba da frente de caixa fechada.");
      } else {
        posTabRef.focus();
      }

      onCloseMobile();
      return;
    }

    posTabRef = window.open(url.toString(), POS_TAB_NAME);
    if (!posTabRef) {
      Toast.error("Não foi possível abrir a aba do PDV. Verifique bloqueio de pop-up.");
      onCloseMobile();
      return;
    }

    posTabRef.focus();
    onCloseMobile();
  };

  return (
    <>
      <aside
        className={`fixed top-0 left-0 z-40 h-screen bg-bg-light border-r border-border-primary shadow-sm transition-all duration-300 flex flex-col justify-between ${
          collapsed ? "w-20" : "w-72"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static`}
      >
      <div>
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold tracking-tight text-accent">Hórus PDV</h1>
              <p className="text-[11px] text-text-secondary">Painel operacional</p>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              className="hidden lg:inline-flex p-2 rounded-lg hover:bg-accent/10 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,191,244,0.22)]"
            >
              <Menu size={20} className="text-accent" />
            </button>

            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-lg hover:bg-accent/10 lg:hidden focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,191,244,0.22)]"
              aria-label="Fechar menu"
            >
              <Menu size={20} className="text-accent" />
            </button>
          </div>
        </div>

        <nav className="space-y-3 overflow-y-auto px-2 py-3 text-sm font-medium">
          <div className="space-y-2">
            <SidebarSectionTitle label="Principal" collapsed={collapsed} />

            <SidebarItem
              icon={<House size={20} />}
              label="Home"
              active={activePage === "home"}
              collapsed={collapsed}
              onClick={() => handleChangePage("home")}
            />

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (collapsed) {
                    handleChangePage("cadastro-cliente");
                    return;
                  }
                  setCadastrosOpen((current) => !current);
                }}
                aria-current={cadastrosPages.includes(activePage) ? "page" : undefined}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition border text-left focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,191,244,0.22)] ${
                  cadastrosPages.includes(activePage)
                    ? "border-secondary/30 bg-accent/12 text-text-primary shadow-sm"
                    : "border-transparent hover:border-border-secondary hover:bg-accent/10 hover:text-text-primary"
                }`}
              >
                <div className="text-accent">
                  <UsersRound size={20} />
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 whitespace-nowrap">Cadastros</span>
                    {cadastrosOpen ? (
                      <ChevronDown size={16} className="text-text-secondary" />
                    ) : (
                      <ChevronRight size={16} className="text-text-secondary" />
                    )}
                  </>
                )}
              </button>

              {!collapsed && cadastrosOpen && (
                <div className="ml-4 space-y-1.5 border-l border-border-primary pl-3">
                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      activePage === "cadastro-cliente"
                        ? "bg-secondary/12 text-text-primary border border-secondary/20"
                        : "text-text-secondary border border-transparent hover:bg-accent/10 hover:text-text-primary"
                    }`}
                    onClick={() => handleChangePage("cadastro-cliente")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <UserRoundPlus size={13} />
                      Cliente
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      activePage === "cadastro-fornecedor"
                        ? "bg-secondary/12 text-text-primary border border-secondary/20"
                        : "text-text-secondary border border-transparent hover:bg-accent/10 hover:text-text-primary"
                    }`}
                    onClick={() => handleChangePage("cadastro-fornecedor")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Truck size={13} />
                      Fornecedor
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      activePage === "cadastro-produto"
                        ? "bg-secondary/12 text-text-primary border border-secondary/20"
                        : "text-text-secondary border border-transparent hover:bg-accent/10 hover:text-text-primary"
                    }`}
                    onClick={() => handleChangePage("cadastro-produto")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Package size={13} />
                      Produto
                    </span>
                  </button>
                </div>
              )}
            </div>

            <SidebarItem
              icon={<History size={20} />}
              label="Histórico de Vendas"
              active={activePage === "historico-vendas"}
              collapsed={collapsed}
              onClick={() => handleChangePage("historico-vendas")}
            />
            <SidebarItem
              icon={<FileText size={20} />}
              label="Relatórios"
              active={activePage === "relatorios"}
              collapsed={collapsed}
              onClick={() => handleChangePage("relatorios")}
            />
            <SidebarItem
              icon={<ShoppingCart size={20} />}
              label="Iniciar Vendas"
              active={activePage === "vendas"}
              collapsed={collapsed}
              onClick={handleOpenSalesInNewTab}
            />
          </div>

          <div className="space-y-2">
            <SidebarSectionTitle label="Configurações" collapsed={collapsed} />

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (collapsed) {
                    handleChangePage("conta-de-usuario");
                    return;
                  }
                  setConfigOpen((current) => !current);
                }}
                aria-current={configuracoesPages.includes(activePage) ? "page" : undefined}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition border text-left focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,191,244,0.22)] ${
                  configuracoesPages.includes(activePage)
                    ? "border-secondary/30 bg-accent/12 text-text-primary shadow-sm"
                    : "border-transparent hover:border-border-secondary hover:bg-accent/10 hover:text-text-primary"
                }`}
              >
                <div className="text-accent">
                  <Settings size={20} />
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 whitespace-nowrap">Configurações</span>
                    {configOpen ? (
                      <ChevronDown size={16} className="text-text-secondary" />
                    ) : (
                      <ChevronRight size={16} className="text-text-secondary" />
                    )}
                  </>
                )}
              </button>

              {!collapsed && configOpen && (
                <div className="ml-4 space-y-1.5 border-l border-border-primary pl-3">
                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      activePage === "conta-de-usuario"
                        ? "bg-secondary/12 text-text-primary border border-secondary/20"
                        : "text-text-secondary border border-transparent hover:bg-accent/10 hover:text-text-primary"
                    }`}
                    onClick={() => handleChangePage("conta-de-usuario")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <UserCog size={13} />
                      Contas de Usuários
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      activePage === "detalhe-licenca"
                        ? "bg-secondary/12 text-text-primary border border-secondary/20"
                        : "text-text-secondary border border-transparent hover:bg-accent/10 hover:text-text-primary"
                    }`}
                    onClick={() => handleChangePage("detalhe-licenca")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <WalletCards size={13} />
                      Detalhes da Licença
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      activePage === "editar-perfil"
                        ? "bg-secondary/12 text-text-primary border border-secondary/20"
                        : "text-text-secondary border border-transparent hover:bg-accent/10 hover:text-text-primary"
                    }`}
                    onClick={() => handleChangePage("editar-perfil")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <KeyRound size={13} />
                      Editar Perfil
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      activePage === "alterar-senha"
                        ? "bg-secondary/12 text-text-primary border border-secondary/20"
                        : "text-text-secondary border border-transparent hover:bg-accent/10 hover:text-text-primary"
                    }`}
                    onClick={() => handleChangePage("alterar-senha")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <LockKeyhole size={13} />
                      Alterar Senha
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>

      <div className="p-3 border-t border-border-primary">
        <UserMenu
          collapsed={collapsed}
          currentUserName={currentUserName}
          currentUserPermission={currentUserPermission}
          avatarUrl={currentUserAvatarUrl}
          onOpenProfile={() => {
            onOpenProfile();
            onCloseMobile();
          }}
          onOpenSettings={() => {
            onOpenSettings();
            onCloseMobile();
          }}
          onLogout={() => {
            onLogout();
            onCloseMobile();
          }}
        />
      </div>
      </aside>
      {statusDialog.Dialog}
    </>
  );
}
