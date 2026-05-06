/**
 * Arquivo: src/hooks/Dialog/useStatusDialog.tsx
 * Objetivo: centraliza diálogos de sucesso, erro, carregamento e confirmação.
 * Entradas esperadas: mensagem opcional para cada tipo exibido.
 */
import { useCallback, useState, type JSX } from "react";
import { CircleAlert, CircleCheck, CircleX, LoaderCircle, X } from "lucide-react";

type DialogType = "success" | "error" | "loading" | "confirm";
type ConfirmIntent = "warning" | "success";

type DialogConfig = {
  type: DialogType;
  message?: string;
  confirmIntent?: ConfirmIntent;
  cancelLabel?: string;
  confirmLabel?: string;
};

let resolver: ((value?: boolean) => void) | null = null;

export function useStatusDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<DialogConfig>({
    type: "success",
    message: "",
    confirmIntent: "warning",
    cancelLabel: "Não",
    confirmLabel: "Sim",
  });

  const show = useCallback(
    (
      type: DialogType,
      message?: string,
      options?: { confirmIntent?: ConfirmIntent; cancelLabel?: string; confirmLabel?: string },
    ) => {
      setConfig({
        type,
        message,
        confirmIntent: options?.confirmIntent ?? "warning",
        cancelLabel: options?.cancelLabel ?? "Não",
        confirmLabel: options?.confirmLabel ?? "Sim",
      });
      setOpen(true);

      return new Promise<boolean | void>((resolve) => {
        resolver = resolve;
      });
    },
    [],
  );

  const handleClose = useCallback((value?: boolean) => {
    setOpen(false);
    resolver?.(value);
    resolver = null;
  }, []);

  const iconByType: Record<DialogType, JSX.Element> = {
    success: <CircleCheck className="h-8 w-8 text-success" />,
    error: <CircleX className="h-8 w-8 text-primary" />,
    loading: <LoaderCircle className="h-8 w-8 animate-spin text-secondary" />,
    confirm:
      config.confirmIntent === "success" ? (
        <CircleCheck className="h-8 w-8 text-success" />
      ) : (
        <CircleAlert className="h-8 w-8 text-accent" />
      ),
  };

  const dialogMessage = config.message || "Operação concluída.";

  const Dialog = open ? (
    <div className="fixed inset-0 z-layer-dialog flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-bg-light relative flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl p-6 shadow-xl">
        {config.type !== "loading" && config.type !== "confirm" && (
          <button
            type="button"
            onClick={() => handleClose()}
            className="absolute top-4 right-4 rounded-md p-1 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {iconByType[config.type]}
        <p className="text-text-primary text-center">{dialogMessage}</p>

        {config.type === "loading" && (
          <p className="text-text-secondary mt-1 text-sm">
            Aguarde, isso pode levar alguns segundos...
          </p>
        )}

        {config.type === "success" && (
          <button
            type="button"
            onClick={() => handleClose()}
            className="btn-success mt-4 w-full"
          >
            OK
          </button>
        )}

        {config.type === "error" && (
          <button
            type="button"
            onClick={() => handleClose()}
            className="btn-cancel mt-4 w-full"
          >
            OK
          </button>
        )}

        {config.type === "confirm" && (
          <div className="mt-4 flex w-full gap-2">
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="btn-cancel flex-1"
            >
              {config.cancelLabel ?? "Não"}
            </button>
            <button
              type="button"
              onClick={() => handleClose(true)}
              className="btn-success flex-1"
            >
              {config.confirmLabel ?? "Sim"}
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return {
    show,
    success: (msg?: string) => show("success", msg),
    error: (msg?: string) => show("error", msg),
    loading: (msg?: string) => show("loading", msg),
    confirm: (
      msg?: string,
      options?: { confirmIntent?: ConfirmIntent; cancelLabel?: string; confirmLabel?: string },
    ) =>
      show("confirm", msg || "Tem certeza?", options),
    close: () => handleClose(),
    Dialog,
  };
}
