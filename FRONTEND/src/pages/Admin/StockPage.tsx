import MarketModulePage from "@/components/Admin/MarketModulePage";
import { stockModuleConfig } from "./marketModuleConfigs";

export default function StockPage() {
  return <MarketModulePage config={stockModuleConfig} />;
}
