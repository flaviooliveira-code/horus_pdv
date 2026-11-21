/**
 * Arquivo: src/utils/pdvPreferences.ts
 * Objetivo: centraliza preferências locais da frente de caixa.
 * Entradas esperadas: recebe preferências locais do PDV e centraliza leitura/gravação no navegador.
 */
export const PRINT_PREVIEW_ENABLED_STORAGE_KEY = "horus-pdv-print-preview-enabled";
export const PRINT_PREVIEW_CHANGE_EVENT = "horus-pdv-print-preview-change";

export const HIGH_VISIBILITY_ENABLED_STORAGE_KEY = "horus-pdv-high-visibility-enabled";
export const HIGH_VISIBILITY_CHANGE_EVENT = "horus-pdv-high-visibility-change";

export const SCANNER_AUTO_FOCUS_ENABLED_STORAGE_KEY = "horus-pdv-scanner-autofocus-enabled";
export const SCANNER_AUTO_FOCUS_CHANGE_EVENT = "horus-pdv-scanner-autofocus-change";

function readBooleanPreference(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const storedValue = window.localStorage.getItem(key);
    if (storedValue === "false") return false;
    if (storedValue === "true") return true;
  } catch {
    return defaultValue;
  }

  return defaultValue;
}

function writeBooleanPreference(key: string, eventName: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(enabled));
  } catch {
    // Ignora falha de armazenamento local (ex.: modo privado restrito).
  }

  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail: { enabled } }));
  } catch {
    // Ignora erro caso CustomEvent não esteja disponível no ambiente.
  }
}

export function getPrintPreviewEnabled(): boolean {
  return readBooleanPreference(PRINT_PREVIEW_ENABLED_STORAGE_KEY, true);
}

export function setPrintPreviewEnabled(enabled: boolean): void {
  writeBooleanPreference(PRINT_PREVIEW_ENABLED_STORAGE_KEY, PRINT_PREVIEW_CHANGE_EVENT, enabled);
}

export function getHighVisibilityEnabled(): boolean {
  return readBooleanPreference(HIGH_VISIBILITY_ENABLED_STORAGE_KEY, false);
}

export function setHighVisibilityEnabled(enabled: boolean): void {
  writeBooleanPreference(HIGH_VISIBILITY_ENABLED_STORAGE_KEY, HIGH_VISIBILITY_CHANGE_EVENT, enabled);
}

export function getScannerAutoFocusEnabled(): boolean {
  return readBooleanPreference(SCANNER_AUTO_FOCUS_ENABLED_STORAGE_KEY, true);
}

export function setScannerAutoFocusEnabled(enabled: boolean): void {
  writeBooleanPreference(
    SCANNER_AUTO_FOCUS_ENABLED_STORAGE_KEY,
    SCANNER_AUTO_FOCUS_CHANGE_EVENT,
    enabled,
  );
}
