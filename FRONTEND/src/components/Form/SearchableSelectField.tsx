/**
 * Arquivo: src/components/Form/SearchableSelectField.tsx
 * Objetivo: padronizar seleção pesquisável para listas de entidades do sistema.
  * Entradas esperadas: recebe lista de opções, valor atual, callbacks de seleção e configuração de criação rápida.
*/
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";

type SearchableSelectFieldProps<TOption> = {
  label?: string;
  value: string;
  options: TOption[];
  onChange: (value: string, option: TOption | null) => void;
  getOptionValue: (option: TOption) => string;
  getOptionLabel: (option: TOption) => string;
  getOptionDescription?: (option: TOption) => string | undefined;
  getOptionSearchText?: (option: TOption) => string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  createActionLabel?: string;
  onCreateOption?: (search: string) => void;
};

function normalizeSearchValue(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function SearchableSelectField<TOption>({
  label,
  value,
  options,
  onChange,
  getOptionValue,
  getOptionLabel,
  getOptionDescription,
  getOptionSearchText,
  placeholder = "Digite para filtrar",
  emptyMessage = "Nenhum resultado encontrado.",
  disabled = false,
  required = false,
  className = "",
  inputClassName = "",
  dropdownClassName = "",
  createActionLabel,
  onCreateOption,
}: SearchableSelectFieldProps<TOption>) {
  const inputId = useId();
  const blurTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => getOptionValue(option) === value) || null,
    [getOptionValue, options, value],
  );

  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : "";

  useEffect(() => {
    if (isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(selectedLabel);
  }, [isOpen, selectedLabel]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      required && !value ? "Selecione uma opção da lista." : "",
    );
  }, [required, value]);

  useEffect(
    () => () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    },
    [],
  );

  const filteredOptions = useMemo(() => {
    const normalized = normalizeSearchValue(search);
    if (!normalized) return options;
    return options.filter((option) => {
      const text = getOptionSearchText
        ? getOptionSearchText(option)
        : `${getOptionLabel(option)} ${getOptionDescription?.(option) || ""}`;
      return normalizeSearchValue(text).includes(normalized);
    });
  }, [getOptionDescription, getOptionLabel, getOptionSearchText, options, search]);

  const handleSelect = (option: TOption) => {
    const nextValue = getOptionValue(option);
    onChange(nextValue, option);
    setSearch(getOptionLabel(option));
    setIsOpen(false);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setSearch(selectedLabel);
    }, 120);
  };

  const handleCreateOption = () => {
    if (!onCreateOption) return;
    onCreateOption(search.trim());
    setIsOpen(false);
  };

  const field = (
    <>
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          ref={inputRef}
          id={inputId}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setIsOpen(true);
            if (!event.target.value.trim() && value) {
              onChange("", null);
            }
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onBlur={handleBlur}
          className={`input-field w-full pl-9 ${inputClassName}`}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          required={required}
        />
      </div>

      {isOpen && !disabled ? (
        <ul
          className={`absolute left-0 right-0 z-layer-popover mt-1 max-h-56 overflow-y-auto rounded-xl border border-border-primary bg-bg-light shadow-lg ${dropdownClassName}`}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const optionValue = getOptionValue(option);
              const description = getOptionDescription?.(option);
              const isSelected = optionValue === value;
              return (
                <li
                  key={optionValue}
                  className={`cursor-pointer px-3 py-2 text-sm transition hover:bg-hover-light ${
                    isSelected ? "bg-accent/10" : ""
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(option);
                  }}
                >
                  <p className="font-medium text-text-primary">
                    {getOptionLabel(option)}
                  </p>
                  {description ? (
                    <p className="text-xs text-text-secondary">{description}</p>
                  ) : null}
                </li>
              );
            })
          ) : (
            <li className="px-3 py-2 text-sm text-text-secondary">
              {emptyMessage}
            </li>
          )}
          {onCreateOption ? (
            <li className="border-t border-border-primary p-1.5">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-secondary transition hover:bg-secondary/10"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleCreateOption();
                }}
              >
                <Plus size={14} />
                {createActionLabel || "Cadastrar novo"}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );

  if (!label) {
    return <div className={`relative ${className}`}>{field}</div>;
  }

  return (
    <label className={`relative block ${className}`}>
      <span className="mb-1 block text-sm text-text-secondary">{label}</span>
      {field}
    </label>
  );
}
