/**
 * Arquivo: src/pages/Admin/OmnichannelPage.tsx
 * Objetivo: renderiza o módulo de omnichannel e integrações dentro da gestão avançada.
 * Entradas esperadas: não recebe props; delega a configuração do módulo para a página base.
 */
import MarketModuleRoutePage from "@/components/Admin/MarketModuleRoutePage";

export default function OmnichannelPage() {
  return <MarketModuleRoutePage moduleId="omnichannel" />;
}
