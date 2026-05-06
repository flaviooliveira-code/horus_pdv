/**
 * Arquivo: src/hooks/Dialog/useToast.tsx
 * Objetivo: disponibiliza API global de notificações toast e componentes/hooks para consumo na UI.
 * Entradas esperadas: recebe tipo, mensagem e duração opcional para criar/remover toasts.
 */

/* eslint-disable react-refresh/only-export-components */
/**
 * Arquivo: src/hooks/Dialog/useToast.tsx
 * Objetivo: disponibiliza API global e hook para exibição de toasts.
 * Entradas esperadas: tipo, mensagem e duração opcional por toast.
 */
import { useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleX, Info, LoaderCircle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastProps {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastProps[]) => void;

const backgroundByType = {
  success: "toast-success",
  error: "toast-error",
  info: "toast-info",
  loading: "toast-loading",
} satisfies Record<ToastType, string>;

// Estado global em memória para permitir disparo de toast fora da árvore de componentes.
let toastState: ToastProps[] = [];
const listeners = new Set<ToastListener>();

const notify = () => {
  // Emite cópia imutável para evitar mutação acidental por consumidor.
  const snapshot = [...toastState];
  listeners.forEach((listener) => listener(snapshot));
};

const removeToast = (id: number) => {
  toastState = toastState.filter((toast) => toast.id !== id);
  notify();
};

const addToast = (type: ToastType, message: string, duration?: number) => {
  const id = Date.now() + Math.random();
  const toast: ToastProps = { id, type, message, duration };

  toastState = [...toastState, toast];
  notify();

  if (type !== "loading") {
    // Toats comuns expiram automaticamente.
    window.setTimeout(() => removeToast(id), duration ?? 3000);
  }

  return id;
};

const subscribe = (listener: ToastListener) => {
  listeners.add(listener);
  listener([...toastState]);
  return () => {
    listeners.delete(listener);
  };
};

export const Toast = {
  success: (message: string, duration?: number) =>
    addToast("success", message, duration),
  error: (message: string, duration?: number) => addToast("error", message, duration),
  info: (message: string, duration?: number) => addToast("info", message, duration),
  loading: (message: string) => addToast("loading", message, 0),
  remove: removeToast,
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  useEffect(() => {
    // Registra listener para refletir mudanças globais no componente visual.
    const unsubscribe = subscribe(setToasts);
    return unsubscribe;
  }, []);

  return (
    <div className="fixed bottom-5 left-1/2 z-layer-toast flex -translate-x-1/2 flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex min-w-[16rem] items-center gap-3 rounded-xl p-4 shadow-lg ${backgroundByType[toast.type]}`}
        >
          {toast.type === "success" && <CircleCheck className="h-6 w-6" />}
          {toast.type === "error" && <CircleX className="h-6 w-6" />}
          {toast.type === "info" && <Info className="h-6 w-6" />}
          {toast.type === "loading" && <LoaderCircle className="h-6 w-6 animate-spin" />}

          <span className="flex-1">{toast.message}</span>

          {toast.type !== "loading" && (
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Fechar toast"
              className="rounded-md p-1 transition hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  useEffect(() => {
    // Mantém o hook sincronizado com fila global de toast.
    const unsubscribe = subscribe(setToasts);
    return unsubscribe;
  }, []);

  const ToastContainerInstance = useMemo(() => <ToastContainer />, []);

  return {
    toasts,
    addToast,
    removeToast,
    success: (msg: string, duration?: number) => addToast("success", msg, duration),
    error: (msg: string, duration?: number) => addToast("error", msg, duration),
    info: (msg: string, duration?: number) => addToast("info", msg, duration),
    loading: (msg: string) => addToast("loading", msg, 0),
    ToastContainer: ToastContainerInstance,
  };
}
