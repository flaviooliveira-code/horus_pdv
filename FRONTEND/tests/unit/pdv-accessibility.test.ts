import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  findExactProductByCode,
  filterProductsByQuery,
  formatQuantity,
  formatTotalVolumes,
  resolveProductSubmission,
  type PdvProduct,
} from "../../src/components/Admin/SalesStartPage/pdvTypes.ts";
import {
  CUSTOMER_DISPLAY_CHANNEL_NAME,
  CUSTOMER_DISPLAY_STORAGE_KEY,
  publishCustomerDisplayState,
  readCustomerDisplayState,
  requestCustomerDisplaySync,
  subscribeCustomerDisplay,
  type CustomerDisplayState,
} from "../../src/utils/customerDisplayChannel.ts";
import {
  HIGH_VISIBILITY_CHANGE_EVENT,
  HIGH_VISIBILITY_ENABLED_STORAGE_KEY,
  PRINT_PREVIEW_ENABLED_STORAGE_KEY,
  SCANNER_AUTO_FOCUS_CHANGE_EVENT,
  SCANNER_AUTO_FOCUS_ENABLED_STORAGE_KEY,
  getHighVisibilityEnabled,
  getPrintPreviewEnabled,
  getScannerAutoFocusEnabled,
  setHighVisibilityEnabled,
  setPrintPreviewEnabled,
  setScannerAutoFocusEnabled,
} from "../../src/utils/pdvPreferences.ts";

type MockGlobals = {
  window?: unknown;
  BroadcastChannel?: unknown;
};

const originalGlobals: MockGlobals = {
  window: (globalThis as Record<string, unknown>).window,
  BroadcastChannel: (globalThis as Record<string, unknown>).BroadcastChannel,
};

function restoreGlobals() {
  const g = globalThis as Record<string, unknown>;
  if (originalGlobals.window === undefined) {
    delete g.window;
  } else {
    g.window = originalGlobals.window;
  }
  if (originalGlobals.BroadcastChannel === undefined) {
    delete g.BroadcastChannel;
  } else {
    g.BroadcastChannel = originalGlobals.BroadcastChannel;
  }
}

function createMockWindow() {
  const store = new Map<string, string>();
  const target = new EventTarget();
  const dispatchedEvents: Array<{ type: string; detail: unknown }> = [];

  const mockWindow = {
    localStorage: {
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
    },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      target.addEventListener(type, listener);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      target.removeEventListener(type, listener);
    },
    dispatchEvent(event: Event) {
      dispatchedEvents.push({
        type: event.type,
        detail: (event as CustomEvent).detail,
      });
      return target.dispatchEvent(event);
    },
  };

  (globalThis as Record<string, unknown>).window = mockWindow;
  return { store, mockWindow, target, dispatchedEvents };
}

afterEach(() => {
  restoreGlobals();
});

describe("pdvPreferences", () => {
  it("returns safe defaults when window is undefined", () => {
    delete (globalThis as Record<string, unknown>).window;
    assert.equal(getPrintPreviewEnabled(), true);
    assert.equal(getHighVisibilityEnabled(), false);
    assert.equal(getScannerAutoFocusEnabled(), true);
    assert.doesNotThrow(() => setHighVisibilityEnabled(true));
    assert.doesNotThrow(() => setScannerAutoFocusEnabled(false));
  });

  it("persists and dispatches events for high visibility and scanner auto-focus", () => {
    const { store, dispatchedEvents } = createMockWindow();

    assert.equal(getHighVisibilityEnabled(), false);
    assert.equal(getScannerAutoFocusEnabled(), true);
    assert.equal(getPrintPreviewEnabled(), true);

    setHighVisibilityEnabled(true);
    assert.equal(store.get(HIGH_VISIBILITY_ENABLED_STORAGE_KEY), "true");
    assert.equal(getHighVisibilityEnabled(), true);
    assert.deepEqual(dispatchedEvents.at(-1), {
      type: HIGH_VISIBILITY_CHANGE_EVENT,
      detail: { enabled: true },
    });

    setScannerAutoFocusEnabled(false);
    assert.equal(store.get(SCANNER_AUTO_FOCUS_ENABLED_STORAGE_KEY), "false");
    assert.equal(getScannerAutoFocusEnabled(), false);
    assert.deepEqual(dispatchedEvents.at(-1), {
      type: SCANNER_AUTO_FOCUS_CHANGE_EVENT,
      detail: { enabled: false },
    });

    setPrintPreviewEnabled(false);
    assert.equal(store.get(PRINT_PREVIEW_ENABLED_STORAGE_KEY), "false");
    assert.equal(getPrintPreviewEnabled(), false);
  });

  it("handles localStorage errors gracefully", () => {
    createMockWindow();
    (globalThis as { window: { localStorage: unknown } }).window.localStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    };

    assert.equal(getHighVisibilityEnabled(), false);
    assert.equal(getScannerAutoFocusEnabled(), true);
    assert.doesNotThrow(() => setHighVisibilityEnabled(true));
  });
});

describe("pdvTypes formatters & barcode resolution", () => {
  const sampleProducts: PdvProduct[] = [
    {
      id: "p1",
      code: "7891000100103",
      name: "Café Torrado 500g",
      stock: 20,
      salePrice: 18.9,
    },
    {
      id: "p2",
      code: "7891000100202",
      name: "Café Solúvel 200g",
      stock: 15,
      salePrice: 24.5,
    },
  ];

  it("formats integer and decimal quantities cleanly", () => {
    assert.equal(formatQuantity(2), "2");
    assert.equal(formatQuantity(0.45), "0,450");
    assert.equal(formatQuantity(0.45 + 0.32), "0,770");
    assert.equal(formatTotalVolumes(0), "0000");
    assert.equal(formatTotalVolumes(4), "0004");
    assert.equal(formatTotalVolumes(1.45), "1,450");
  });

  it("resolves exact barcode matches even when autocomplete dropdown is open", () => {
    assert.equal(findExactProductByCode(" 7891000100103 ", sampleProducts)?.id, "p1");
    assert.equal(filterProductsByQuery("café", sampleProducts).length, 2);

    const resolution = resolveProductSubmission({
      query: "7891000100202",
      products: sampleProducts,
      selectedProduct: null,
      showProductOptions: true,
      highlightedProductIndex: 0,
      allowFuzzyFallback: false,
    });
    assert.deepEqual(resolution, { type: "add", product: sampleProducts[1] });
  });

  it("selects highlighted autocomplete option on partial text and falls back on button submit", () => {
    const partialRes = resolveProductSubmission({
      query: "café",
      products: sampleProducts,
      selectedProduct: null,
      showProductOptions: true,
      highlightedProductIndex: 1,
      allowFuzzyFallback: false,
    });
    assert.deepEqual(partialRes, { type: "select_option", product: sampleProducts[1] });

    const buttonRes = resolveProductSubmission({
      query: "café torrado 500g",
      products: sampleProducts,
      selectedProduct: null,
      showProductOptions: true,
      highlightedProductIndex: 0,
      allowFuzzyFallback: true,
    });
    assert.deepEqual(buttonRes, { type: "add", product: sampleProducts[0] });

    const missingRes = resolveProductSubmission({
      query: "9999999999999",
      products: sampleProducts,
      selectedProduct: null,
      showProductOptions: true,
      highlightedProductIndex: -1,
      allowFuzzyFallback: false,
    });
    assert.deepEqual(missingRes, { type: "not_found" });
  });
});

describe("customerDisplayChannel", () => {
  function createMockBroadcastChannel() {
    const channelsByName = new Map<string, Set<MockBroadcastChannel>>();

    class MockBroadcastChannel extends EventTarget {
      name: string;
      closed = false;
      constructor(name: string) {
        super();
        this.name = name;
        if (!channelsByName.has(name)) {
          channelsByName.set(name, new Set());
        }
        channelsByName.get(name)!.add(this);
      }
      postMessage(data: unknown) {
        if (this.closed) return;
        const peers = channelsByName.get(this.name);
        if (!peers) return;
        for (const peer of peers) {
          if (peer === this || peer.closed) continue;
          const event = new MessageEvent("message", { data });
          peer.dispatchEvent(event);
        }
      }
      close() {
        this.closed = true;
        channelsByName.get(this.name)?.delete(this);
      }
    }

    (globalThis as Record<string, unknown>).BroadcastChannel = MockBroadcastChannel;
  }

  const sampleState: CustomerDisplayState = {
    updatedAt: 1700000000000,
    status: "active",
    companyName: "Mercado Hórus",
    operatorName: "Operador",
    cashCanSell: true,
    highVisibility: true,
    themeMode: "dark",
    lastScannedItem: {
      id: "p1",
      code: "7891000100103",
      name: "Café Torrado 500g",
      quantity: 2,
      unitPrice: 18.9,
      total: 37.8,
    },
    items: [
      {
        id: "p1",
        code: "7891000100103",
        name: "Café Torrado 500g",
        quantity: 2,
        unitPrice: 18.9,
        total: 37.8,
      },
    ],
    totalVolumes: 2,
    subtotal: 37.8,
    lastSale: null,
  };

  it("publishes, reads, requests sync, and receives BroadcastChannel + storage updates", () => {
    const { store, target } = createMockWindow();
    createMockBroadcastChannel();

    const receivedStates: CustomerDisplayState[] = [];
    let syncRequested = 0;

    const unsubscribe = subscribeCustomerDisplay({
      onState: (state) => receivedStates.push(state),
      onRequestSync: () => {
        syncRequested += 1;
      },
    });

    requestCustomerDisplaySync();
    assert.equal(syncRequested, 1);

    publishCustomerDisplayState(sampleState);
    assert.equal(receivedStates.length, 1);
    assert.equal(receivedStates[0].subtotal, 37.8);
    assert.equal(readCustomerDisplayState()?.companyName, "Mercado Hórus");
    assert.ok(store.get(CUSTOMER_DISPLAY_STORAGE_KEY));

    // Simula fallback via StorageEvent entre abas
    const updatedState: CustomerDisplayState = { ...sampleState, subtotal: 50.0, updatedAt: 1700000001000 };
    target.dispatchEvent(
      Object.assign(new Event("storage"), {
        key: CUSTOMER_DISPLAY_STORAGE_KEY,
        newValue: JSON.stringify(updatedState),
      }),
    );
    assert.equal(receivedStates.length, 2);
    assert.equal(receivedStates[1].subtotal, 50.0);

    assert.equal(CUSTOMER_DISPLAY_CHANNEL_NAME, "horus-pdv-customer-display");
    unsubscribe();
  });
});
