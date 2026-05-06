import MarketModulePage from "@/components/Admin/MarketModulePage";
import { returnsModuleConfig } from "./marketModuleConfigs";

export default function ReturnsPage() {
  return <MarketModulePage config={returnsModuleConfig} />;
}
