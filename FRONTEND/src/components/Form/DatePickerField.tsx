/**
 * Arquivo: src/components/Form/DatePickerField.tsx
 * Objetivo: fornece campo de data com calendário, navegação de mês/ano e suporte aos formatos ISO/BR.
 * Entradas esperadas: recebe valor atual, callback de mudança e opções de placeholder, formato e estado desabilitado.
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  minDate?: string;
};

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
};

const VIEWPORT_MARGIN = 12;
const POPOVER_GAP = 8;
const DESKTOP_POPOVER_WIDTH = 360;
const MOBILE_POPOVER_WIDTH = 340;

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
  minDate,
}: DatePickerFieldProps) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  // Controla abertura do popover de calendário.
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // Data selecionada derivada do valor textual recebido por props.
  const selectedDate = useMemo(
    () => (format === "br" ? parseBrDate(value) : parseIsoDate(value)),
    [format, value],
  );
  const minSelectableDate = useMemo(
    () => (format === "br" ? parseBrDate(minDate || "") : parseIsoDate(minDate || "")),
    [format, minDate],
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

  const yearOptions = useMemo(() => {
    const selectedYear = selectedDate?.getFullYear();
    const minYear = minSelectableDate?.getFullYear();
    const viewYear = viewMonth.getFullYear();
    const startYear = Math.min(
      1900,
      currentYear - 100,
      selectedYear ?? currentYear,
      minYear ?? currentYear,
      viewYear,
    );
    const endYear = Math.max(
      currentYear + 20,
      selectedYear ?? currentYear,
      minYear ?? currentYear,
      viewYear,
    );

    return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
  }, [currentYear, minSelectableDate, selectedDate, viewMonth]);

  const displayValue = useMemo(() => {
    if (!selectedDate) return "";
    return selectedDate.toLocaleDateString("pt-BR");
  }, [selectedDate]);

  useEffect(() => {
    // Mantém o calendário sincronizado quando o valor externo muda.
    if (selectedDate) setViewMonth(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!open || selectedDate) return;
    setViewMonth(new Date());
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) return;

    function updatePopoverPosition() {
      if (!rootRef.current) return;

      const inputRect = rootRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredWidth =
        viewportWidth >= 640 ? DESKTOP_POPOVER_WIDTH : MOBILE_POPOVER_WIDTH;
      const popoverWidth = Math.min(
        preferredWidth,
        viewportWidth - VIEWPORT_MARGIN * 2,
      );
      const measuredHeight = popoverRef.current?.offsetHeight ?? 390;
      const maxLeft = viewportWidth - popoverWidth - VIEWPORT_MARGIN;
      const left = Math.min(
        Math.max(inputRect.left, VIEWPORT_MARGIN),
        Math.max(maxLeft, VIEWPORT_MARGIN),
      );

      const belowTop = inputRect.bottom + POPOVER_GAP;
      const aboveTop = inputRect.top - measuredHeight - POPOVER_GAP;
      const hasRoomBelow =
        belowTop + measuredHeight <= viewportHeight - VIEWPORT_MARGIN;
      const hasRoomAbove = aboveTop >= VIEWPORT_MARGIN;
      const top =
        hasRoomBelow || !hasRoomAbove
          ? Math.min(
              belowTop,
              Math.max(viewportHeight - measuredHeight - VIEWPORT_MARGIN, VIEWPORT_MARGIN),
            )
          : aboveTop;

      setPopoverPosition({ left, top, width: popoverWidth });
    }

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open]);

  useEffect(() => {
    // Fecha calendário ao clicar fora ou pressionar ESC.
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
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

      {open && !disabled && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-layer-popover rounded-2xl border border-border-primary bg-bg-light p-3 shadow-xl"
          style={{
            left: popoverPosition?.left ?? VIEWPORT_MARGIN,
            top: popoverPosition?.top ?? VIEWPORT_MARGIN,
            width: popoverPosition?.width ?? MOBILE_POPOVER_WIDTH,
          }}
        >
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
            disabled={minSelectableDate ? { before: minSelectableDate } : undefined}
            onSelect={(nextDate) => {
              if (
                nextDate &&
                minSelectableDate &&
                nextDate.getTime() < minSelectableDate.getTime()
              ) {
                return;
              }
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
        </div>,
        document.body,
      )}
    </div>
  );
}
