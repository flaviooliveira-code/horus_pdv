/**
 * Arquivo: src/components/AppSidebar/AppSidebar.tsx
 * Objetivo: renderiza menu lateral no padrao do legado com suporte a desktop colapsado e drawer mobile.
 */
import {
  Building2,
  BadgeDollarSign,
  ChevronRight,
  CreditCard,
  FileText,
  History,
  House,
  Info,
  Landmark,
  Menu,
  Package,
  PackageCheck,
  Receipt,
  Repeat2,
  ShoppingCart,
  Store,
  Truck,
  UserCog,
  UsersRound,
  UserRoundPlus,
  WalletCards,
} from "lucide-react";
import { type ReactNode } from "react";
import UserMenu from "./UserMenu";

export type PageKey =
  | "home"
  | "cadastro-cliente"
  | "cadastro-fornecedor"
  | "cadastro-produto"
  | "historico-vendas"
  | "relatorios"
  | "vendas"
  | "fiscal"
  | "pagamentos"
  | "estoque"
  | "caixa"
  | "compras"
  | "devolucoes"
  | "crm-fidelidade"
  | "omnichannel"
  | "conta-de-usuario"
  | "minha-empresa"
  | "configuracoes"
  | "detalhe-licenca"
  | "sobre-pdv"
  | "editar-perfil";

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
  onOpenSalesInNewTab: () => void;
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
  onOpenSalesInNewTab,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const handleChangePage = (page: PageKey) => {
    onChangePage(page);
    onCloseMobile();
  };

  return (
    <>
      <aside
        className={`fixed top-0 left-0 z-layer-sidebar h-screen bg-bg-light border-r border-border-primary shadow-sm transition-all duration-300 flex flex-col justify-between ${
          collapsed ? "w-20" : "w-72"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static`}
      >
      <div className="flex min-h-0 flex-1 flex-col">
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

        <nav className="flex-1 min-h-0 space-y-3 overflow-y-auto overflow-x-hidden px-2 py-3 text-sm font-medium">
          <div className="space-y-2">
            <SidebarSectionTitle label="Principal" collapsed={collapsed} />

            <SidebarItem
              icon={<House size={20} />}
              label="Home"
              active={activePage === "home"}
              collapsed={collapsed}
              onClick={() => handleChangePage("home")}
            />
          </div>

          <div className="space-y-2">
            <SidebarSectionTitle label="Cadastros" collapsed={collapsed} />
            <SidebarItem
              icon={<UserRoundPlus size={20} />}
              label="Cliente"
              active={activePage === "cadastro-cliente"}
              collapsed={collapsed}
              onClick={() => handleChangePage("cadastro-cliente")}
            />
            <SidebarItem
              icon={<Truck size={20} />}
              label="Fornecedor"
              active={activePage === "cadastro-fornecedor"}
              collapsed={collapsed}
              onClick={() => handleChangePage("cadastro-fornecedor")}
            />
            <SidebarItem
              icon={<Package size={20} />}
              label="Produto"
              active={activePage === "cadastro-produto"}
              collapsed={collapsed}
              onClick={() => handleChangePage("cadastro-produto")}
            />
            <SidebarItem
              icon={<UserCog size={20} />}
              label="Contas de Usuários"
              active={activePage === "conta-de-usuario"}
              collapsed={collapsed}
              onClick={() => handleChangePage("conta-de-usuario")}
            />
          </div>

          <div className="space-y-2">
            <SidebarSectionTitle label="Operação" collapsed={collapsed} />
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
              onClick={onOpenSalesInNewTab}
            />
          </div>

          <div className="space-y-2">
            <SidebarSectionTitle label="Gestão Avançada" collapsed={collapsed} />
            <SidebarItem
              icon={<Receipt size={20} />}
              label="Fiscal NFC-e / NF-e"
              active={activePage === "fiscal"}
              collapsed={collapsed}
              onClick={() => handleChangePage("fiscal")}
            />
            <SidebarItem
              icon={<CreditCard size={20} />}
              label="Pagamentos Integrados"
              active={activePage === "pagamentos"}
              collapsed={collapsed}
              onClick={() => handleChangePage("pagamentos")}
            />
            <SidebarItem
              icon={<PackageCheck size={20} />}
              label="Estoque e Inventário"
              active={activePage === "estoque"}
              collapsed={collapsed}
              onClick={() => handleChangePage("estoque")}
            />
            <SidebarItem
              icon={<Landmark size={20} />}
              label="Abertura e Fechamento"
              active={activePage === "caixa"}
              collapsed={collapsed}
              onClick={() => handleChangePage("caixa")}
            />
            <SidebarItem
              icon={<BadgeDollarSign size={20} />}
              label="Compras e Reposição"
              active={activePage === "compras"}
              collapsed={collapsed}
              onClick={() => handleChangePage("compras")}
            />
            <SidebarItem
              icon={<Repeat2 size={20} />}
              label="Trocas e Devoluções"
              active={activePage === "devolucoes"}
              collapsed={collapsed}
              onClick={() => handleChangePage("devolucoes")}
            />
            <SidebarItem
              icon={<UsersRound size={20} />}
              label="CRM e Fidelidade"
              active={activePage === "crm-fidelidade"}
              collapsed={collapsed}
              onClick={() => handleChangePage("crm-fidelidade")}
            />
            <SidebarItem
              icon={<Store size={20} />}
              label="Omnichannel"
              active={activePage === "omnichannel"}
              collapsed={collapsed}
              onClick={() => handleChangePage("omnichannel")}
            />
          </div>

          <div className="space-y-2">
            <SidebarSectionTitle label="Sistema" collapsed={collapsed} />
            <SidebarItem
              icon={<Building2 size={20} />}
              label="Minha Empresa"
              active={activePage === "minha-empresa"}
              collapsed={collapsed}
              onClick={() => handleChangePage("minha-empresa")}
            />
            <SidebarItem
              icon={<WalletCards size={20} />}
              label="Detalhes da Licença"
              active={activePage === "detalhe-licenca"}
              collapsed={collapsed}
              onClick={() => handleChangePage("detalhe-licenca")}
            />
            <SidebarItem
              icon={<Info size={20} />}
              label="Sobre PDV"
              active={activePage === "sobre-pdv"}
              collapsed={collapsed}
              onClick={() => handleChangePage("sobre-pdv")}
            />
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
          onOpenCompany={() => handleChangePage("minha-empresa")}
          onOpenLicense={() => handleChangePage("detalhe-licenca")}
          onOpenAbout={() => handleChangePage("sobre-pdv")}
          onLogout={() => {
            onLogout();
            onCloseMobile();
          }}
        />
      </div>
      </aside>
    </>
  );
}
