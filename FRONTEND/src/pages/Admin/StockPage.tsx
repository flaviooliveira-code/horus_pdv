/**
 * Arquivo: src/pages/Admin/StockPage.tsx
 * Objetivo: renderiza o módulo de estoque e inventário dentro da gestão avançada.
 * Entradas esperadas: não recebe props; delega a configuração do módulo para a página base.
 */
import MarketModuleRoutePage from "@/components/Admin/MarketModuleRoutePage";

export default function StockPage() {
  return <MarketModuleRoutePage moduleId="estoque" />;
}
