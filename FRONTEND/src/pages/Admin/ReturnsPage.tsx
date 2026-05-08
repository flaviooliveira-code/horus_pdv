/**
 * Arquivo: src/pages/Admin/ReturnsPage.tsx
 * Objetivo: renderiza o módulo de trocas e devoluções dentro da gestão avançada.
 * Entradas esperadas: não recebe props; delega a configuração do módulo para a página base.
 */
import MarketModuleRoutePage from "@/components/Admin/MarketModuleRoutePage";

export default function ReturnsPage() {
  return <MarketModuleRoutePage moduleId="devolucoes" />;
}
