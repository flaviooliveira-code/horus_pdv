/**
 * Arquivo: src/components/Form/TimePickerField.tsx
 * Objetivo: fornece campo de horário com seleção controlada e formato estável para formulários.
 * Entradas esperadas: recebe valor atual, callback de alteração e estados opcionais de placeholder/desabilitado.
 */
import { ChevronDown, ChevronUp, Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

type TimePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  hasError?: boolean;
  isClearable?: boolean;
  minuteStep?: number;
};

type ParsedTime = {
  hour: number;
  minute: number;
};

type ActiveColumn = "hour" | "minute";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toMinuteOptions(step: number) {
  const numericStep = Number(step);
  const safeStep =
    Number.isFinite(numericStep) && numericStep > 0
      ? Math.min(60, Math.floor(numericStep))
      : 15;

  const values: number[] = [];
  for (let minute = 0; minute < 60; minute += safeStep) {
    values.push(minute);
  }

  return values.length > 0 ? values : [0];
}

function parseTimeValue(value: string): ParsedTime | null {
  if (typeof value !== "string") return null;

  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

function formatTimeValue(hour: number, minute: number) {
  return `${pad2(hour)}:${pad2(minute)}`;
}

function nearestMinute(minute: number, minuteOptions: number[]) {
  if (!Array.isArray(minuteOptions) || minuteOptions.length === 0) return 0;

  return minuteOptions.reduce((best, current) =>
    Math.abs(current - minute) < Math.abs(best - minute) ? current : best,
  );
}

function getDefaultSelection(minuteOptions: number[]): ParsedTime {
  const now = new Date();
  return {
    hour: now.getHours(),
    minute: nearestMinute(now.getMinutes(), minuteOptions),
  };
}

function getNeighborValues(values: number[], index: number) {
  const length = values.length;
  if (length === 0) {
    return { prev: "00", current: "00", next: "00" };
  }

  const safeIndex = ((index % length) + length) % length;
  const prev = values[(safeIndex - 1 + length) % length];
  const current = values[safeIndex];
  const next = values[(safeIndex + 1) % length];

  return {
    prev: pad2(prev),
    current: pad2(current),
    next: pad2(next),
  };
}

export default function TimePickerField({
  id,
  value,
  onChange,
  placeholder = "Selecione um horário",
  className = "",
  inputClassName = "",
  disabled = false,
  hasError = false,
  isClearable = false,
  minuteStep = 15,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<ActiveColumn>("hour");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const minuteOptions = useMemo(() => toMinuteOptions(minuteStep), [minuteStep]);
  const parsedValue = useMemo(() => parseTimeValue(value), [value]);
  const hasValue = Boolean(parsedValue);

  const selection = useMemo<ParsedTime>(() => {
    if (!parsedValue) {
      return getDefaultSelection(minuteOptions);
    }

    return {
      hour: parsedValue.hour,
      minute: nearestMinute(parsedValue.minute, minuteOptions),
    };
  }, [minuteOptions, parsedValue]);

  const minuteIndex = useMemo(
    () => minuteOptions.findIndex((minuteOption) => minuteOption === selection.minute),
    [minuteOptions, selection.minute],
  );

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  const commit = (nextHour: number, nextMinute: number) => {
    onChange(formatTimeValue(nextHour, nextMinute));
  };

  const changeHour = (delta: number) => {
    const nextHour = (selection.hour + delta + 24) % 24;
    commit(nextHour, selection.minute);
  };

  const changeMinute = (delta: number) => {
    if (minuteOptions.length === 0) return;

    const nextIndex = (minuteIndex + delta + minuteOptions.length) % minuteOptions.length;
    const nextMinute = minuteOptions[nextIndex];
    commit(selection.hour, nextMinute);
  };

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled) return;
    onChange("");
    setOpen(false);
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveColumn("hour");
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveColumn("minute");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (activeColumn === "hour") changeHour(-1);
      if (activeColumn === "minute") changeMinute(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (activeColumn === "hour") changeHour(1);
      if (activeColumn === "minute") changeMinute(1);
    }
  };

  const hourNeighbors = getNeighborValues(
    Array.from({ length: 24 }, (_, index) => index),
    selection.hour,
  );
  const minuteNeighbors = getNeighborValues(minuteOptions, minuteIndex);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`input-field inline-flex w-full items-center justify-between gap-2 text-left ${
          hasError ? "border border-primary" : ""
        } ${inputClassName}`}
      >
        <span className={hasValue ? "text-text-primary" : "text-[var(--color-text-tertiary)]"}>
          {hasValue ? formatTimeValue(selection.hour, selection.minute) : placeholder}
        </span>
        <Clock3 size={16} className="shrink-0 text-[var(--color-text-tertiary)]" />
      </button>

      {isClearable && hasValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded-full border border-border-primary bg-bg-light px-1.5 py-0.5 text-xs text-[var(--color-text-tertiary)] hover:text-text-primary"
          aria-label="Limpar horário"
        >
          x
        </button>
      )}

      {open && !disabled && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Selecionar horário"
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          className="absolute left-0 top-[calc(100%+8px)] z-layer-popover w-[14rem] max-w-full rounded-[1.5rem] border border-border-primary bg-bg-light px-3.5 py-3 shadow-[0_14px_28px_-20px_rgba(37,99,235,0.7)]"
        >
          <div className="grid grid-cols-2 gap-2.5">
            <section className="flex flex-col items-center gap-1.25">
              <button
                type="button"
                onClick={() => changeHour(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-accent transition hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                aria-label="Diminuir hora"
              >
                <ChevronUp size={21} strokeWidth={1.3} />
              </button>

              <button
                type="button"
                onClick={() => setActiveColumn("hour")}
                className={`w-full rounded-2xl px-1 py-1 text-center transition ${
                  activeColumn === "hour"
                    ? "bg-accent/10 ring-1 ring-accent/25"
                    : "bg-transparent ring-1 ring-transparent"
                }`}
              >
                <div className="text-[1.2rem] font-normal leading-none text-text-secondary">
                  {hourNeighbors.prev}
                </div>
                <div className="mt-1.25 rounded-[0.85rem] bg-accent px-2.5 py-1.5 text-[1.2rem] font-medium leading-none text-white shadow-[0_8px_16px_-10px_rgba(47,103,246,0.9)]">
                  {hourNeighbors.current}
                </div>
                <div className="mt-1.25 text-[1.2rem] font-normal leading-none text-text-secondary">
                  {hourNeighbors.next}
                </div>
              </button>

              <button
                type="button"
                onClick={() => changeHour(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-accent transition hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                aria-label="Aumentar hora"
              >
                <ChevronDown size={21} strokeWidth={1.3} />
              </button>
            </section>

            <section className="flex flex-col items-center gap-1.25">
              <button
                type="button"
                onClick={() => changeMinute(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-accent transition hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                aria-label="Diminuir minuto"
              >
                <ChevronUp size={21} strokeWidth={1.3} />
              </button>

              <button
                type="button"
                onClick={() => setActiveColumn("minute")}
                className={`w-full rounded-2xl px-1 py-1 text-center transition ${
                  activeColumn === "minute"
                    ? "bg-accent/10 ring-1 ring-accent/25"
                    : "bg-transparent ring-1 ring-transparent"
                }`}
              >
                <div className="text-[1.2rem] font-normal leading-none text-text-secondary">
                  {minuteNeighbors.prev}
                </div>
                <div className="mt-1.25 rounded-[0.85rem] bg-accent px-2.5 py-1.5 text-[1.2rem] font-medium leading-none text-white shadow-[0_8px_16px_-10px_rgba(47,103,246,0.9)]">
                  {minuteNeighbors.current}
                </div>
                <div className="mt-1.25 text-[1.2rem] font-normal leading-none text-text-secondary">
                  {minuteNeighbors.next}
                </div>
              </button>

              <button
                type="button"
                onClick={() => changeMinute(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-accent transition hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                aria-label="Aumentar minuto"
              >
                <ChevronDown size={21} strokeWidth={1.3} />
              </button>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
