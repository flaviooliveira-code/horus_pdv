/**
 * Arquivo: src/components/SettingsPage/index.ts
 * Objetivo: centraliza e reexporta módulos relacionados à página de configurações.
  * Entradas esperadas: não recebe props; reexporta componentes da página de configurações.
*/
export { default as ThemeSettingsCard } from "./ThemeSettingsCard";
export { default as PrintSettingsCard } from "./PrintSettingsCard";
export {
  default as SecuritySessionsCard,
  type ActiveSession,
} from "./SecuritySessionsCard";
