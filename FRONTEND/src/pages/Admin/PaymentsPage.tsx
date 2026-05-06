import MarketModulePage from "@/components/Admin/MarketModulePage";
import { paymentsModuleConfig } from "./marketModuleConfigs";

export default function PaymentsPage() {
  return <MarketModulePage config={paymentsModuleConfig} />;
}
