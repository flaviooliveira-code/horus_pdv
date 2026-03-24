/**
 * Arquivo: src/components/Register/AddressContactFields.tsx
 * Objetivo: renderiza campos reutilizáveis de endereço e contato com máscara e busca automática de CEP.
 * Entradas esperadas: recebe objeto de valores, estado de carregamento e callbacks de atualização/consulta de CEP.
 */

import { useRef } from "react";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";

export type AddressContactValue = {
  cep: string;
  city: string;
  state: string;
  address: string;
  neighborhood: string;
  streetComplement: string;
  number: string;
  referencePoint: string;
  telephone: string;
  cellphone: string;
  email: string;
};

const STATE_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
  "EX",
];

type AddressContactFieldsProps = {
  value: AddressContactValue;
  loadingCep: boolean;
  onChange: (field: keyof AddressContactValue, fieldValue: string) => void;
  onFillAddressFromCep: () => void;
};

export default function AddressContactFields({
  value,
  loadingCep,
  onChange,
  onFillAddressFromCep,
}: AddressContactFieldsProps) {
  const { maskCep, maskTelephoneBr, maskCellphoneBr } = useInputMasks();
  // Evita consultas repetidas do mesmo CEP durante digitação.
  const lastAutoLookupCepRef = useRef("");
  // Debounce para não disparar busca de CEP a cada tecla.
  const debounceTimerRef = useRef<number | null>(null);

  const runCepLookupIfReady = (maskedCep: string) => {
    const digits = maskedCep.replace(/\D/g, "");
    if (digits.length !== 8 || loadingCep) return;
    if (lastAutoLookupCepRef.current === digits) return;
    lastAutoLookupCepRef.current = digits;
    onFillAddressFromCep();
  };

  const scheduleCepLookup = (maskedCep: string) => {
    const digits = maskedCep.replace(/\D/g, "");
    if (digits.length !== 8) {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return;
    }

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      runCepLookupIfReady(maskedCep);
      debounceTimerRef.current = null;
    }, 2000);
  };

  return (
    <>
      <section className="card rounded-2xl p-4">
        <h4 className="text-sm font-semibold text-text-secondary">Endereço</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">
              CEP *
            </span>
            <input
              value={value.cep}
              onChange={(event) => {
                const maskedValue = maskCep(event.target.value);
                onChange("cep", maskedValue);
                scheduleCepLookup(maskedValue);
              }}
              onBlur={(event) => {
                if (debounceTimerRef.current) {
                  window.clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = null;
                }
                runCepLookupIfReady(event.target.value);
              }}
              className="input-field w-full"
              placeholder="00000-000"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Cidade *
            </span>
            <input
              value={value.city}
              onChange={(event) => onChange("city", event.target.value)}
              className="input-field w-full"
              placeholder="Cidade"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">
              UF *
            </span>
            <select
              value={value.state}
              onChange={(event) => onChange("state", event.target.value)}
              className="select-field w-full"
            >
              <option value="">UF</option>
              {STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Endereço *
            </span>
            <input
              value={value.address}
              onChange={(event) => onChange("address", event.target.value)}
              className="input-field w-full"
              placeholder="Endereço"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Bairro *
            </span>
            <input
              value={value.neighborhood}
              onChange={(event) => onChange("neighborhood", event.target.value)}
              className="input-field w-full"
              placeholder="Bairro"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Complemento
            </span>
            <input
              value={value.streetComplement}
              onChange={(event) =>
                onChange("streetComplement", event.target.value)
              }
              className="input-field w-full"
              placeholder="Complemento"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Número *
            </span>
            <input
              value={value.number}
              onChange={(event) =>
                onChange("number", event.target.value.replace(/\D/g, ""))
              }
              className="input-field w-full"
              placeholder="Número"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Referência
            </span>
            <input
              value={value.referencePoint}
              onChange={(event) =>
                onChange("referencePoint", event.target.value)
              }
              className="input-field w-full"
              placeholder="Referência"
            />
          </label>
        </div>
      </section>

      <section className="card rounded-2xl p-4">
        <h4 className="text-sm font-semibold text-text-secondary">Contato</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Telefone
            </span>
            <input
              value={value.telephone}
              onChange={(event) =>
                onChange("telephone", maskTelephoneBr(event.target.value))
              }
              className="input-field w-full"
              placeholder="(00) 0000-0000"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">
              Celular *
            </span>
            <input
              value={value.cellphone}
              onChange={(event) =>
                onChange("cellphone", maskCellphoneBr(event.target.value))
              }
              className="input-field w-full"
              placeholder="(00) 00000-0000"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">
              E-mail
            </span>
            <input
              value={value.email}
              onChange={(event) => onChange("email", event.target.value)}
              className="input-field w-full"
              placeholder="email@dominio.com"
            />
          </label>
        </div>
      </section>
    </>
  );
}
