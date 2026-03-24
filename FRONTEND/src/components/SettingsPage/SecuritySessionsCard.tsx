/**
 * Arquivo: src/components/SettingsPage/SecuritySessionsCard.tsx
 * Objetivo: exibe sessões ativas e permite encerramento seletivo para segurança.
 * Entradas esperadas: lista de sessões e callbacks para encerrar sessão/outras.
 */
import { Laptop, ShieldCheck, Smartphone, X } from "lucide-react";
import Skeleton from "@/components/Loading/Skeleton";

export type ActiveSession = {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
  platform: "desktop" | "mobile";
};

type SecuritySessionsCardProps = {
  sessions: ActiveSession[];
  isLoading?: boolean;
  onTerminateSession: (sessionId: string) => void;
  onTerminateOtherSessions: () => void;
};

export default function SecuritySessionsCard({
  sessions,
  isLoading = false,
  onTerminateSession,
  onTerminateOtherSessions,
}: SecuritySessionsCardProps) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-primary p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-text-primary">Segurança</p>
          <p className="mt-1 text-sm text-text-secondary">
            Monitore os acessos da sua conta e encerre sessões suspeitas.
          </p>
        </div>

        <button
          type="button"
          onClick={onTerminateOtherSessions}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-secondary bg-bg-light px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-hover-light"
        >
          <ShieldCheck size={14} />
          Encerrar outras sessões
        </button>
      </div>

      <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`session-skeleton-${index + 1}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border-primary bg-bg-light px-3 py-3"
            >
              <div className="flex w-full items-start gap-2">
                <Skeleton circle className="mt-0.5 h-4 w-4" />
                <div className="w-full space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            </div>
          ))
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-secondary bg-bg-light px-3 py-6 text-center">
            <p className="text-sm font-medium text-text-primary">
              Nenhuma sessão ativa encontrada
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Novos acessos aparecerão nesta lista automaticamente.
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border-primary bg-bg-light px-3 py-3"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-text-secondary">
                  {session.platform === "desktop" ? (
                    <Laptop size={16} />
                  ) : (
                    <Smartphone size={16} />
                  )}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">
                      {session.device}
                    </p>
                    {session.current && (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                        Sessão atual
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {session.location} • IP {session.ip}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Última atividade: {session.lastActive}
                  </p>
                </div>
              </div>

              {!session.current && (
                <button
                  type="button"
                  onClick={() => onTerminateSession(session.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-secondary px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-red-50"
                >
                  <X size={14} />
                  Encerrar
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
