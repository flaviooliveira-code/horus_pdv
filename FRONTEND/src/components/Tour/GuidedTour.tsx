/**
 * Arquivo: src/components/Tour/GuidedTour.tsx
 * Objetivo: controla o tour guiado sobre elementos da interface com foco, destaque e navegação entre passos.
 * Entradas esperadas: recebe passos, estado de abertura e callbacks para avançar, voltar ou finalizar o tour.
 */
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { TOUR_STEPS_BY_PAGE, type TourPageKey, type TourStep } from "@/domain/tour/tourSteps";

type GuidedTourProps = {
  open: boolean;
  page: TourPageKey;
  onClose: () => void;
};

function findTarget(step: TourStep): HTMLElement | null {
  for (const selector of step.selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) return element;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function GuidedTour({ open, page, onClose }: GuidedTourProps) {
  const steps = useMemo(() => TOUR_STEPS_BY_PAGE[page] || [], [page]);
  const [stepIndex, setStepIndex] = useState(0);
  const [viewportTick, setViewportTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const rafId = window.requestAnimationFrame(() => setStepIndex(0));
    return () => window.cancelAnimationFrame(rafId);
  }, [open, page]);

  useEffect(() => {
    if (!open) return;
    const update = () => setViewportTick((current) => current + 1);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const currentStep = steps[stepIndex] || null;
  const currentTarget = open && currentStep ? findTarget(currentStep) : null;
  const hasAnyTarget =
    open && steps.length > 0 && steps.some((step) => Boolean(findTarget(step)));

  const highlightRect = (() => {
    void viewportTick;
    if (!currentTarget) return null;
    const rect = currentTarget.getBoundingClientRect();
    const padding = 6;
    return {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      bottom: rect.bottom + padding,
    };
  })();

  const tooltipStyle = (() => {
    void viewportTick;
    const width = Math.min(340, window.innerWidth - 16);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (!highlightRect) {
      return {
        top: Math.max(20, viewportHeight / 2 - 130),
        left: Math.max(8, viewportWidth / 2 - width / 2),
        width,
      };
    }

    const preferredBelow = highlightRect.bottom + 12;
    const fallbackAbove = highlightRect.top - 220;
    const top = preferredBelow + 210 <= viewportHeight ? preferredBelow : Math.max(8, fallbackAbove);
    const left = clamp(
      highlightRect.left + highlightRect.width / 2 - width / 2,
      8,
      viewportWidth - width - 8,
    );

    return { top, left, width };
  })();

  const goToNext = () => {
    if (stepIndex >= steps.length - 1) {
      onClose();
      return;
    }

    for (let index = stepIndex + 1; index < steps.length; index += 1) {
      if (findTarget(steps[index])) {
        setStepIndex(index);
        return;
      }
    }
    onClose();
  };

  const goToPrev = () => {
    if (stepIndex <= 0) return;

    for (let index = stepIndex - 1; index >= 0; index -= 1) {
      if (findTarget(steps[index])) {
        setStepIndex(index);
        return;
      }
    }
    setStepIndex(0);
  };

  useEffect(() => {
    if (!open || !currentTarget) return;
    currentTarget.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [open, currentTarget, stepIndex]);

  useEffect(() => {
    if (!open) return;
    if (!currentStep) return;
    if (currentTarget) return;

    let nextIndex: number | null = null;
    for (let index = stepIndex + 1; index < steps.length; index += 1) {
      if (findTarget(steps[index])) {
        nextIndex = index;
        break;
      }
    }

    if (nextIndex !== null) {
      const rafId = window.requestAnimationFrame(() => setStepIndex(nextIndex));
      return () => window.cancelAnimationFrame(rafId);
    }
  }, [open, currentStep, currentTarget, stepIndex, steps]);

  if (!open) return null;
  if (!currentStep || steps.length === 0) return null;
  if (!hasAnyTarget) {
    return (
      <div className="fixed inset-0 z-layer-dialog bg-black/55">
        <div className="fixed top-1/2 left-1/2 w-[min(340px,calc(100vw-16px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-secondary bg-bg-light p-4 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">Tour guiado</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-text-secondary hover:bg-hover-light"
              aria-label="Fechar tour"
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            Não foi possível localizar elementos desta tela para iniciar o tour.
          </p>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="btn-back px-3 py-2 text-xs">
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-layer-dialog">
      <div className="absolute inset-0 bg-black/55" />

      {highlightRect ? (
        <div
          className="absolute rounded-xl border-2 border-accent shadow-[0_0_0_9999px_rgba(2,6,23,0.58)] transition-all duration-200"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      ) : null}

      <div
        className="pointer-events-auto fixed rounded-2xl border border-border-secondary bg-bg-light p-4 shadow-xl"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Tour da tela
            </p>
            <h3 className="mt-1 text-sm font-semibold text-text-primary">{currentStep.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-secondary hover:bg-hover-light"
            aria-label="Fechar tour"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-2 text-sm text-text-secondary">{currentStep.description}</p>
        <p className="mt-3 text-xs text-text-tertiary">
          Passo {stepIndex + 1} de {steps.length}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goToPrev}
            disabled={stepIndex <= 0}
            className="btn-back px-3 py-2 text-xs"
          >
            Anterior
          </button>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-back px-3 py-2 text-xs">
              Pular
            </button>
            <button type="button" onClick={goToNext} className="btn-primary px-3 py-2 text-xs">
              {stepIndex >= steps.length - 1 ? "Concluir" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
