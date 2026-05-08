/**
 * Arquivo: src/pages/Admin/CrmLoyaltyPage.tsx
 * Objetivo: renderiza o módulo de CRM e fidelidade dentro da gestão avançada.
 * Entradas esperadas: não recebe props; delega a configuração do módulo para a página base.
 */
import MarketModuleRoutePage from "@/components/Admin/MarketModuleRoutePage";

export default function CrmLoyaltyPage() {
  return <MarketModuleRoutePage moduleId="crm-fidelidade" />;
}
