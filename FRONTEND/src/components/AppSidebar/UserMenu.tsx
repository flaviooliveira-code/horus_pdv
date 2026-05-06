/**
 * Arquivo: src/components/AppSidebar/UserMenu.tsx
 * Objetivo: exibe avatar e menu de ações do usuário no rodapé da sidebar.
 * Entradas esperadas: dados do usuário e callbacks para páginas rápidas e logout.
 */
import { Building2, ChevronUp, Info, LogOut, Settings, User, WalletCards } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type UserMenuProps = {
  collapsed: boolean;
  currentUserName: string;
  currentUserPermission: string;
  avatarUrl: string | null;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenCompany: () => void;
  onOpenLicense: () => void;
  onOpenAbout: () => void;
  onLogout: () => void;
};

export default function UserMenu({
  collapsed,
  currentUserName,
  currentUserPermission,
  avatarUrl,
  onOpenProfile,
  onOpenSettings,
  onOpenCompany,
  onOpenLicense,
  onOpenAbout,
  onLogout,
}: UserMenuProps) {
  // Controla abertura do dropdown de usuário.
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelTop, setPanelTop] = useState(0);
  const [panelLeft, setPanelLeft] = useState(0);
  const panelWidth = 240;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setShowUserMenu(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showUserMenu) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const measuredHeight = panelRef.current?.getBoundingClientRect().height ?? 310;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredTop = rect.top - measuredHeight - 8;
      const fallbackTop = rect.bottom + 8;
      const nextTop =
        preferredTop >= 8
          ? preferredTop
          : Math.min(fallbackTop, viewportHeight - measuredHeight - 8);
      const nextLeft = collapsed ? rect.right + 8 : rect.right - panelWidth;
      const clampedLeft = Math.max(8, Math.min(nextLeft, viewportWidth - panelWidth - 8));

      setPanelTop(Math.max(8, nextTop));
      setPanelLeft(clampedLeft);
    };

    const rafId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [collapsed, showUserMenu]);

  const userInitials = currentUserName
    // Gera avatar textual com no máximo duas iniciais.
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative" ref={userMenuRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setShowUserMenu((current) => !current)}
        className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent/10 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,191,244,0.22)]"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-secondary text-white text-xs font-semibold flex items-center justify-center shadow-sm overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${currentUserName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            userInitials || "AD"
          )}
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 text-left">
              <span className="block text-sm font-semibold text-text-primary">
                {currentUserName}
              </span>
              <span className="block text-[11px] text-text-secondary">
                {currentUserPermission}
              </span>
            </div>
            <ChevronUp
              size={16}
              className={`text-text-secondary transition-transform ${showUserMenu ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {showUserMenu
        ? createPortal(
            <div
              ref={panelRef}
              style={{ top: panelTop, left: panelLeft, width: panelWidth }}
              className="fixed z-layer-popover bg-bg-light border border-border-secondary rounded-xl shadow-lg p-1.5"
            >
              <button
                type="button"
                onClick={() => {
                  onOpenProfile();
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent/10"
              >
                <User size={16} />
                Meu Perfil
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent/10"
              >
                <Settings size={16} />
                Configurações
              </button>

              <div className="my-1 border-t border-border-primary" />

              <button
                type="button"
                onClick={() => {
                  onOpenCompany();
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent/10"
              >
                <Building2 size={16} />
                Minha Empresa
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenLicense();
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent/10"
              >
                <WalletCards size={16} />
                Detalhes da Licença
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenAbout();
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent/10"
              >
                <Info size={16} />
                Sobre o PDV
              </button>

              <div className="my-1 border-t border-border-primary" />

              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent/10 text-primary"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
