/**
 * Arquivo: src/pages/Admin/PurchasesPage.tsx
 * Objetivo: renderiza o módulo de compras e reposição dentro da gestão avançada.
 * Entradas esperadas: não recebe props; delega a configuração do módulo para a página base.
 */
import MarketModuleRoutePage from "@/components/Admin/MarketModuleRoutePage";

export default function PurchasesPage() {
  return <MarketModuleRoutePage moduleId="compras" />;
}
