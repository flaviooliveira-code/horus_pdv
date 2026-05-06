import { useCallback, useEffect, useState } from "react";
import LoadingBar from "@/components/Loading/LoadingBar";
import { marketModuleService } from "@/services/api/marketModuleService";
import MarketModulePage, {
  type MarketModuleConfig,
  type MarketModuleRecordPayload,
} from "./MarketModulePage";

export default function MarketModuleRoutePage({ moduleId }: { moduleId: string }) {
  const [config, setConfig] = useState<MarketModuleConfig | null>(null);

  const loadConfig = useCallback(async () => {
    const data = await marketModuleService.get(moduleId);
    setConfig(data ?? null);
  }, [moduleId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig().catch(() => setConfig(null));
  }, [loadConfig]);

  const createRecord = async (payload: MarketModuleRecordPayload) => {
    const data = await marketModuleService.createRecord(moduleId, payload);
    setConfig(data ?? null);
  };

  const updateRecord = async (recordId: string, payload: MarketModuleRecordPayload) => {
    const data = await marketModuleService.updateRecord(moduleId, recordId, payload);
    setConfig(data ?? null);
  };

  const deleteRecord = async (recordId: string) => {
    const data = await marketModuleService.removeRecord(moduleId, recordId);
    setConfig(data ?? null);
  };

  if (!config) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-text-secondary">
        <LoadingBar />
      </div>
    );
  }

  return (
    <MarketModulePage
      config={config}
      onRefresh={loadConfig}
      onCreate={createRecord}
      onUpdate={updateRecord}
      onDelete={deleteRecord}
    />
  );
}
