/**
 * Arquivo: src/pages/Auth/AuthFields.tsx
 * Objetivo: concentra campos e controles reutilizados nas telas públicas de autenticação.
 * Entradas esperadas: recebe estado de formulário, callbacks e flags de carregamento/validação.
 */
import { Building2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { maskCnpj } from "@/utils/inputMasks";

type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
};

export function CnpjField({ value, onChange, onEnter }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-text-primary">
        CNPJ
      </span>
      <div className="relative">
        <Building2
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          inputMode="text"
          className="input-field w-full pl-10"
          value={value}
          onChange={(event) => onChange(maskCnpj(event.target.value))}
          placeholder="00.000.000/0000-00"
          onKeyDown={(event) => {
            if (event.key === "Enter") void onEnter();
          }}
        />
      </div>
    </label>
  );
}

export function EmailField({ value, onChange, onEnter }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-text-primary">
        E-mail
      </span>
      <div className="relative">
        <Mail
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="email"
          className="input-field w-full pl-10"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="usuario@hpdv.com.br"
          onKeyDown={(event) => {
            if (event.key === "Enter") void onEnter();
          }}
        />
      </div>
    </label>
  );
}

export function PasswordField({
  label,
  value,
  show,
  onChange,
  onToggle,
  onEnter,
}: {
  label: string;
  value: string;
  show: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  onEnter: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-text-primary">
        {label}
      </span>
      <div className="relative">
        <Lock
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type={show ? "text" : "password"}
          className="input-field w-full pl-10 pr-10"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="••••••••"
          onKeyDown={(event) => {
            if (event.key === "Enter") void onEnter();
          }}
        />
        <button
          type="button"
          className="absolute top-1/2 right-3 -translate-y-1/2 text-text-secondary"
          onClick={onToggle}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}

export function FeedbackMessage({ result }: { result: { success: boolean; message: string } | null }) {
  if (!result) return null;

  return (
    <p
      className={`rounded-lg border px-3 py-2 text-sm ${
        result.success
          ? "border-success/30 bg-success/10 text-success"
          : "border-primary/30 bg-primary/10 text-primary"
      }`}
    >
      {result.message}
    </p>
  );
}
