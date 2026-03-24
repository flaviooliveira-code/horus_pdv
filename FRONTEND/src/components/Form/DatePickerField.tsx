/**
 * Arquivo: src/components/Form/DatePickerField.tsx
 * Objetivo: fornece campo de data com calendário, navegação de mês/ano e suporte aos formatos ISO/BR.
 * Entradas esperadas: recebe valor atual, callback de mudança e opções de placeholder, formato e estado desabilitado.
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";

type DateOutputFormat = "iso" | "br";

type DatePickerFieldProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  format?: DateOutputFormat;
};

function parseIsoDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function parseBrDate(value: string) {
  if (!value) return undefined;
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return undefined;
  return new Date(year, month - 1, day);
}

function toIsoDate(value?: Date) {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toBrDate(value?: Date) {
  if (!value) return "";
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function DatePickerField({
  value,
  onChange,
  placeholder = "Selecione uma data",
  className = "",
  disabled = false,
  format = "iso",
}: DatePickerFieldProps) {
  // Controla abertura do popover de calendário.
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Data selecionada derivada do valor textual recebido por props.
  const selectedDate = useMemo(
    () => (format === "br" ? parseBrDate(value) : parseIsoDate(value)),
    [format, value],
  );
  // Mês exibido no calendário (pode diferir da data selecionada).
  const [viewMonth, setViewMonth] = useState<Date>(selectedDate ?? new Date());

  const monthLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { month: "long" }),
    [],
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => {
        const monthLabel = monthLabelFormatter.format(new Date(2024, monthIndex, 1));
        return {
          value: monthIndex,
          label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        };
      }),
    [monthLabelFormatter],
  );

  const yearOptions = useMemo(
    () => Array.from({ length: 101 }, (_, index) => 1970 + index),
    [],
  );

  const displayValue = useMemo(() => {
    if (!selectedDate) return "";
    return selectedDate.toLocaleDateString("pt-BR");
  }, [selectedDate]);

  useEffect(() => {
    // Mantém o calendário sincronizado quando o valor externo muda.
    if (selectedDate) setViewMonth(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    // Fecha calendário ao clicar fora ou pressionar ESC.
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="input-field inline-flex w-full items-center justify-between gap-2 text-left"
      >
        <span className={displayValue ? "text-text-primary" : "text-text-tertiary"}>
          {displayValue || placeholder}
        </span>
        <CalendarDays size={16} className="shrink-0 text-text-tertiary" />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 rounded-2xl border border-border-primary bg-bg-light p-3 shadow-xl">
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
              }
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-primary text-text-secondary transition hover:border-accent/50 hover:text-accent"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="grid flex-1 grid-cols-2 gap-2">
              <select
                value={viewMonth.getMonth()}
                onChange={(event) => {
                  const nextMonth = Number(event.target.value);
                  setViewMonth(new Date(viewMonth.getFullYear(), nextMonth, 1));
                }}
                className="select-field w-full py-1.5 text-sm"
              >
                {monthOptions.map((monthOption) => (
                  <option key={monthOption.value} value={monthOption.value}>
                    {monthOption.label}
                  </option>
                ))}
              </select>
              <select
                value={viewMonth.getFullYear()}
                onChange={(event) => {
                  const nextYear = Number(event.target.value);
                  setViewMonth(new Date(nextYear, viewMonth.getMonth(), 1));
                }}
                className="select-field w-full py-1.5 text-sm"
              >
                {yearOptions.map((yearOption) => (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
              }
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-primary text-text-secondary transition hover:border-accent/50 hover:text-accent"
              aria-label="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <DayPicker
            mode="single"
            locale={ptBR}
            selected={selectedDate}
            month={viewMonth}
            onMonthChange={setViewMonth}
            hideNavigation
            onSelect={(nextDate) => {
              onChange(format === "br" ? toBrDate(nextDate) : toIsoDate(nextDate));
              if (nextDate) setOpen(false);
            }}
            showOutsideDays
            classNames={{
              root: "rdp-root mx-auto text-sm text-text-primary",
              months: "flex justify-center",
              month: "space-y-3",
              month_caption: "hidden",
              caption_label: "hidden",
              weekdays: "grid grid-cols-7 gap-1",
              weekday:
                "h-8 w-8 inline-flex items-center justify-center text-[11px] font-semibold uppercase text-text-tertiary",
              weeks: "space-y-1",
              week: "grid grid-cols-7 gap-1",
              day: "h-8 w-8",
              day_button:
                "h-8 w-8 rounded-lg text-sm text-text-secondary hover:bg-accent/10 hover:text-accent transition",
              today:
                "rounded-lg border border-accent/40 bg-accent/10 font-semibold text-accent",
              selected:
                "rounded-lg bg-accent font-semibold text-white hover:bg-hover-accent hover:text-white",
              outside: "text-text-tertiary/60",
              disabled: "text-text-tertiary/50 line-through",
            }}
          />
        </div>
      )}
    </div>
  );
}
