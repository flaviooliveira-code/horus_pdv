/**
 * Arquivo: src/utils/pdvPreferences.ts
 * Objetivo: centraliza preferências locais da frente de caixa.
  * Entradas esperadas: recebe preferências locais do PDV e centraliza leitura/gravação no navegador.
*/
export const PRINT_PREVIEW_ENABLED_STORAGE_KEY = "horus-pdv-print-preview-enabled";

export function getPrintPreviewEnabled() {
  try {
    const storedValue = window.localStorage.getItem(PRINT_PREVIEW_ENABLED_STORAGE_KEY);
    if (storedValue === "false") return false;
    if (storedValue === "true") return true;
  } catch {
    return true;
  }

  return true;
}

export function setPrintPreviewEnabled(enabled: boolean) {
  window.localStorage.setItem(PRINT_PREVIEW_ENABLED_STORAGE_KEY, String(enabled));
  window.dispatchEvent(
    new CustomEvent("horus-pdv-print-preview-change", { detail: { enabled } }),
  );
}
