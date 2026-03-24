/**
 * Arquivo: src/components/Admin/UsersPage/DeactivateUserReasonDialog.tsx
 * Objetivo: exige justificativa mínima antes de confirmar a inativação de usuário.
 */
import { FileText, Power, X } from "lucide-react";

type DeactivateUserReasonDialogProps = {
  open: boolean;
  userName: string;
  reason: string;
  requiredChars: number;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeactivateUserReasonDialog({
  open,
  userName,
  reason,
  requiredChars,
  onReasonChange,
  onClose,
  onConfirm,
}: DeactivateUserReasonDialogProps) {
  if (!open) return null;
  const charCount = reason.trim().length;
  const canConfirm = charCount >= requiredChars;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
      <div className="card w-full max-w-2xl rounded-2xl p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Motivo da inativação</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Para inativar <span className="font-semibold">{userName}</span>, descreva o motivo
              com pelo menos {requiredChars} caracteres.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
            aria-label="Fechar diálogo de inativação de usuário"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm text-text-secondary">Justificativa operacional</label>
          <div className="relative">
            <FileText
              size={15}
              className="pointer-events-none absolute left-3 top-3 text-text-tertiary"
            />
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              className="input-field min-h-44 w-full resize-y pl-9"
              placeholder="Explique o contexto da inativação, impactos e prazo estimado..."
            />
          </div>
          <p className={`mt-2 text-xs font-medium ${canConfirm ? "text-success" : "text-primary"}`}>
            Caracteres preenchidos: {charCount}/{requiredChars}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-back">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="btn-cancel inline-flex items-center gap-1.5"
          >
            <Power size={14} />
            Confirmar inativação
          </button>
        </div>
      </div>
    </div>
  );
}

