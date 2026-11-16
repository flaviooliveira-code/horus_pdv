/**
 * Arquivo: src/utils/customerDisplayChannel.ts
 * Objetivo: sincroniza em tempo real o estado da frente de caixa com a segunda tela do cliente.
 * Entradas esperadas: mensagens BroadcastChannel e snapshot em localStorage como fallback.
 */

export const CUSTOMER_DISPLAY_CHANNEL_NAME = "horus-pdv-customer-display";
export const CUSTOMER_DISPLAY_STORAGE_KEY = "horus-pdv-customer-display-state";

export type CustomerDisplayItem = {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl?: string;
};

export type CustomerDisplayLastSale = {
  saleNumber: string;
  total: number;
  paymentLabel: string;
  change: number;
};

export type CustomerDisplayState = {
  updatedAt: number;
  status: "idle" | "active" | "completed" | "cancelled";
  companyName: string;
  operatorName: string;
  cashCanSell: boolean;
  highVisibility: boolean;
  themeMode: "light" | "dark";
  lastScannedItem: CustomerDisplayItem | null;
  items: CustomerDisplayItem[];
  totalVolumes: number;
  subtotal: number;
  lastSale: CustomerDisplayLastSale | null;
};

export type CustomerDisplayMessage =
  | { type: "STATE_SYNC"; payload: CustomerDisplayState }
  | { type: "REQUEST_SYNC" };

function isValidCustomerDisplayState(value: unknown): value is CustomerDisplayState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CustomerDisplayState>;
  return (
    typeof candidate.updatedAt === "number" &&
    typeof candidate.status === "string" &&
    Array.isArray(candidate.items) &&
    typeof candidate.subtotal === "number" &&
    typeof candidate.totalVolumes === "number"
  );
}

export function createCustomerDisplayChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL_NAME);
  } catch {
    return null;
  }
}

export function readCustomerDisplayState(): CustomerDisplayState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidCustomerDisplayState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function publishCustomerDisplayState(
  state: CustomerDisplayState,
  channel?: BroadcastChannel | null,
): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOMER_DISPLAY_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignora erro de quota/acesso ao localStorage.
    }
  }

  const message: CustomerDisplayMessage = { type: "STATE_SYNC", payload: state };
  if (channel) {
    try {
      channel.postMessage(message);
    } catch {
      // Ignora canal fechado.
    }
    return;
  }

  const transientChannel = createCustomerDisplayChannel();
  if (!transientChannel) return;
  try {
    transientChannel.postMessage(message);
  } catch {
    // Ignora falha ao postar mensagem.
  } finally {
    transientChannel.close();
  }
}

export function requestCustomerDisplaySync(channel?: BroadcastChannel | null): void {
  const message: CustomerDisplayMessage = { type: "REQUEST_SYNC" };
  if (channel) {
    try {
      channel.postMessage(message);
    } catch {
      // Ignora canal fechado.
    }
    return;
  }

  const transientChannel = createCustomerDisplayChannel();
  if (!transientChannel) return;
  try {
    transientChannel.postMessage(message);
  } catch {
    // Ignora falha ao solicitar sincronização.
  } finally {
    transientChannel.close();
  }
}

export function subscribeCustomerDisplay(handlers: {
  onState?: (state: CustomerDisplayState) => void;
  onRequestSync?: () => void;
}): () => void {
  const channel = createCustomerDisplayChannel();

  const onChannelMessage = (event: MessageEvent<CustomerDisplayMessage>) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "STATE_SYNC" && isValidCustomerDisplayState(data.payload)) {
      handlers.onState?.(data.payload);
    } else if (data.type === "REQUEST_SYNC") {
      handlers.onRequestSync?.();
    }
  };

  channel?.addEventListener("message", onChannelMessage as EventListener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== CUSTOMER_DISPLAY_STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as unknown;
      if (isValidCustomerDisplayState(parsed)) {
        handlers.onState?.(parsed);
      }
    } catch {
      // Ignora snapshot inválido.
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    channel?.removeEventListener("message", onChannelMessage as EventListener);
    channel?.close();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
