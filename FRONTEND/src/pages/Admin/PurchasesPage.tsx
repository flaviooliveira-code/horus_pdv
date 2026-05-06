import MarketModulePage from "@/components/Admin/MarketModulePage";
import { purchasesModuleConfig } from "./marketModuleConfigs";

export default function PurchasesPage() {
  return <MarketModulePage config={purchasesModuleConfig} />;
}
