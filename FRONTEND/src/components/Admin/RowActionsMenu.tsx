/**
 * Arquivo: src/components/Admin/RowActionsMenu.tsx
 * Objetivo: renderiza menu contextual de ações por linha com posicionamento automático no viewport.
 * Entradas esperadas: recebe lista de ações, rótulo do gatilho e flag opcional para abrir para cima.
 */

import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type RowActionItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

type RowActionsMenuProps = {
  items: RowActionItem[];
  triggerLabel?: string;
  forceUpwards?: boolean;
};

export default function RowActionsMenu({
  items,
  triggerLabel = "Abrir ações",
  forceUpwards = false,
}: RowActionsMenuProps) {
  // Controle de visibilidade do dropdown de ações.
  const [open, setOpen] = useState(false);
  // Define se o painel deve abrir para cima para evitar corte no viewport.
  const [openUpwards, setOpenUpwards] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Fecha menu ao clicar fora do componente.
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;

    // Mede espaço disponível para decidir a direção de abertura do painel.
    const measurePlacement = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      if (!triggerRect || !panelRect) return;

      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const required = panelRect.height + 12;
      setOpenUpwards(forceUpwards || (spaceBelow < required && spaceAbove > spaceBelow));
    };

    const rafId = window.requestAnimationFrame(measurePlacement);
    window.addEventListener("resize", measurePlacement);
    window.addEventListener("scroll", measurePlacement, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measurePlacement);
      window.removeEventListener("scroll", measurePlacement, true);
    };
  }, [forceUpwards, open]);

  return (
    <div className="relative inline-flex" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpenUpwards(false);
          setOpen((current) => !current);
        }}
        aria-label={triggerLabel}
        title="Ações"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-primary text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`absolute right-0 z-30 min-w-40 rounded-xl border border-border-secondary bg-bg-light p-1.5 shadow-lg ${
            openUpwards ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {items.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                action.danger
                  ? "text-primary hover:bg-primary/10"
                  : "text-text-primary hover:bg-accent/10"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
