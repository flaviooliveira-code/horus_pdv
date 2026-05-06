import MarketModulePage from "@/components/Admin/MarketModulePage";
import { cashModuleConfig } from "./marketModuleConfigs";

export default function CashRegisterPage() {
  return <MarketModulePage config={cashModuleConfig} />;
}
