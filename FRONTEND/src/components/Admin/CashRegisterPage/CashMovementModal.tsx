/**
 * Arquivo: src/components/Admin/CashRegisterPage/CashMovementModal.tsx
 * Objetivo: modal para lançamento de Sangria (retirada) e Suprimento (reforço de troco) na sessão de caixa aberta.
 * Entradas esperadas: recebe modo da operação, estado de submissão e callbacks de fechamento e confirmação.
 */
import { ArrowDownCircle, ArrowUpCircle, X } from "lucide-react";
import { type ClipboardEvent, type FormEvent, useState } from "react";
import LoadingButton from "@/components/Loading/LoadingButton";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import { parseMoneyBr } from "@/utils/inputMasks";

type CashMovementModalProps = {
  mode: "sangria" | "suprimento";
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (amount: string, description: string) => Promise<void>;
};

function preventInvalidMoneyBeforeInput(event: FormEvent<HTMLInputElement>) {
  const data = (event.nativeEvent as InputEvent).data ?? "";
  if (data && /[^0-9,.]/.test(data)) {
    event.preventDefault();
  }
}

export default function CashMovementModal({
  mode,
  isSubmitting,
  onClose,
  onSubmit,
}: CashMovementModalProps) {
  const { maskMoneyBr } = useInputMasks();
  const [amount, setAmount] = useState("0,00");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isSangria = mode === "sangria";
  const title = isSangria ? "Registrar sangria" : "Registrar suprimento";
  const subtitle = isSangria
    ? "Retirada de dinheiro da gaveta (ex.: pagamento de despesas ou sangria de segurança)."
    : "Reforço de troco adicionado à gaveta do caixa atual.";

  const handlePasteAmount = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    setAmount(maskMoneyBr(event.clipboardData.getData("text")));
  };

  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    const numericAmount = parseMoneyBr(amount);
    if (numericAmount <= 0) {
      setErrorMessage("Informe um valor maior que zero.");
      return;
    }

    const trimmedDescription = description.trim();
    if (isSangria && trimmedDescription.length < 3) {
      setErrorMessage("Informe uma descrição com pelo menos 3 caracteres para a sangria.");
      return;
    }

    await onSubmit(amount, trimmedDescription);
  };

  return (
    <div
      className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/55 px-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-movement-modal-title"
    >
      <div className="card w-full max-w-lg rounded-2xl p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-primary pb-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                isSangria
                  ? "bg-primary/15 text-primary"
                  : "bg-success/15 text-success"
              }`}
            >
              {isSangria ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
            </span>
            <div>
              <h3 id="cash-movement-modal-title" className="text-lg font-bold text-text-primary">
                {title}
              </h3>
              <p className="text-xs text-text-secondary">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar modal de movimentação"
            className="rounded-lg p-1.5 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-secondary">
              Valor (R$) *
            </span>
            <input
              value={amount}
              inputMode="numeric"
              pattern="[0-9,.]*"
              onBeforeInput={preventInvalidMoneyBeforeInput}
              onPaste={handlePasteAmount}
              onChange={(event) => setAmount(maskMoneyBr(event.target.value) || "0,00")}
              className="input-field w-full"
              placeholder="0,00"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-secondary">
              Descrição {isSangria ? "*" : "(opcional)"}
            </span>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={300}
              className="input-field w-full"
              placeholder={
                isSangria
                  ? "Ex.: Pagamento motoboy ou sangria de cofre"
                  : "Ex.: Reforço de moedas e notas para troco"
              }
            />
          </label>

          {errorMessage ? (
            <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-outline-secondary"
            >
              Cancelar
            </button>
            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              loadingLabel="Registrando..."
              className={isSangria ? "btn-cancel" : "btn-success"}
            >
              {isSangria ? "Confirmar sangria" : "Confirmar suprimento"}
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
