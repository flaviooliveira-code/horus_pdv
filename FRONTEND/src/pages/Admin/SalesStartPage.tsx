/**
 * Arquivo: src/pages/Admin/SalesStartPage.tsx
 * Objetivo: implementa a frente de caixa com busca de produto, leitor HID contínuo, acessibilidade (F7),
 * visor do cliente em segunda tela, carrinho, fechamento e pagamento.
 * Entradas esperadas: recebe flag opcional de modo standalone para ajustar comportamento da aba PDV.
 */

import { AlertTriangle, Eye, Monitor, Printer, ScanBarcode, Search, Tag, X } from "lucide-react";
import {
  type ClipboardEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PixChargePanel from "@/components/Admin/PixChargePanel";
import ReceiptPreviewModal, {
  type PaymentType,
  type SaleReceipt,
} from "@/components/Admin/ReceiptPreviewModal";
import {
  CartItemsTable,
  HighVisibilityWrapper,
  LastScannedCard,
  TotalBanner,
  filterProductsByQuery,
  formatQuantity,
  formatTotalVolumes,
  getCartLineKey,
  getCartLineTotal,
  resolveProductSubmission,
  type PdvCartItem,
  type PdvProduct,
} from "@/components/Admin/SalesStartPage";
import LoadingButton from "@/components/Loading/LoadingButton";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import {
  cashRegisterService,
  type CashRegisterStatusDto,
} from "@/services/api/cashRegisterService";
import { companyService, type CompanyDto } from "@/services/api/companyService";
import {
  paymentChargeService,
  type PaymentChargeDto,
} from "@/services/api/paymentChargeService";
import { productService } from "@/services/api/productService";
import { salesHistoryService } from "@/services/api/salesHistoryService";
import {
  type CustomerDisplayLastSale,
  type CustomerDisplayState,
  createCustomerDisplayChannel,
  publishCustomerDisplayState,
  subscribeCustomerDisplay,
} from "@/utils/customerDisplayChannel";
import { evaluateProductExpiration, formatIsoDateBr } from "@/utils/productExpiration";
import {
  HIGH_VISIBILITY_CHANGE_EVENT,
  PRINT_PREVIEW_CHANGE_EVENT,
  SCANNER_AUTO_FOCUS_CHANGE_EVENT,
  getHighVisibilityEnabled,
  getPrintPreviewEnabled,
  getScannerAutoFocusEnabled,
  setHighVisibilityEnabled,
  setScannerAutoFocusEnabled,
} from "@/utils/pdvPreferences";
import { computeLineTotal, parseScaleBarcode, roundQuantity } from "@/utils/scaleBarcode";

type SalesStartPageProps = {
  onExit?: () => void;
  standalone?: boolean;
  operatorName?: string;
};

const PAYMENT_OPTIONS: Array<{ value: PaymentType; label: string; shortcut: string }> = [
  { value: "dinheiro", label: "Dinheiro", shortcut: "1" },
  { value: "pix", label: "PIX", shortcut: "2" },
  { value: "debito", label: "Cartão Débito", shortcut: "3" },
  { value: "credito", label: "Cartão Crédito", shortcut: "4" },
];

const KEYBOARD_SHORTCUTS: Array<{ key: string; label: string }> = [
  { key: "F2", label: "Produto" },
  { key: "F4", label: "Quantidade" },
  { key: "F6", label: "Preço avulso" },
  { key: "F7", label: "Alta visibilidade" },
  { key: "Enter", label: "Adicionar" },
  { key: "F8", label: "Cancelar" },
  { key: "F12", label: "Pagamento" },
];

/** Intervalo de consulta do PIX enquanto o cliente paga. */
const PIX_POLL_INTERVAL_MS = 3000;
const LAST_RECEIPT_STORAGE_KEY = "horus-pdv-last-receipt";
const PENDING_CART_STORAGE_KEY = "horus-pdv-pending-cart";
const HID_INTER_KEY_MAX_MS = 60;
const HID_ENTER_MAX_MS = 80;
const HID_MIN_CODE_LENGTH = 4;

function readPendingCart(): PdvCartItem[] {
  try {
    const stored = window.sessionStorage.getItem(PENDING_CART_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as PdvCartItem[]) : [];
  } catch {
    return [];
  }
}

function formatDateTime(date: Date) {
  return {
    dateLabel: date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    timeLabel: date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

function preventNonDigitBeforeInput(event: FormEvent<HTMLInputElement>) {
  const data = (event.nativeEvent as InputEvent).data ?? "";
  if (data && /\D/.test(data)) {
    event.preventDefault();
  }
}

function getPaymentLabel(paymentType: PaymentType) {
  return PAYMENT_OPTIONS.find((option) => option.value === paymentType)?.label ?? paymentType;
}

function formatCashElapsed(minutes?: number) {
  if (!minutes || minutes < 1) return "menos de 1 min";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}min`;
}

function readDocumentThemeMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function isEditableElement(target: HTMLElement | null): boolean {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export default function SalesStartPage({
  standalone = false,
  operatorName = "Operador",
}: SalesStartPageProps) {
  const { formatMoneyBr, maskCpf, maskMoneyBr, parseMoneyBr, sanitizeDecimalInput } =
    useInputMasks();
  const statusDialog = useStatusDialog();
  const productInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
  const unitPriceInputRef = useRef<HTMLInputElement | null>(null);
  const displayWindowRef = useRef<Window | null>(null);
  const displayChannelRef = useRef<BroadcastChannel | null>(null);
  const hidBufferRef = useRef<{ buffer: string; lastKeyAt: number }>({
    buffer: "",
    lastKeyAt: 0,
  });

  const [now, setNow] = useState(new Date());
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<PdvProduct[]>([]);
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [cashStatus, setCashStatus] = useState<CashRegisterStatusDto | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showProductOptions, setShowProductOptions] = useState(false);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const [quantityInput, setQuantityInput] = useState("1");
  const [unitPriceInput, setUnitPriceInput] = useState("");
  const [cart, setCart] = useState<PdvCartItem[]>(readPendingCart);
  const [lastScannedItemId, setLastScannedItemId] = useState<string | null>(() => {
    const initialCart = readPendingCart();
    return initialCart.length > 0 ? getCartLineKey(initialCart[initialCart.length - 1]) : null;
  });
  const [displayStatus, setDisplayStatus] = useState<
    "idle" | "active" | "completed" | "cancelled"
  >(() => (readPendingCart().length > 0 ? "active" : "idle"));
  const [lastCompletedSale, setLastCompletedSale] = useState<CustomerDisplayLastSale | null>(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>("dinheiro");
  const [cpfNota, setCpfNota] = useState("");
  const [cashGiven, setCashGiven] = useState("");
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [pixCharge, setPixCharge] = useState<PaymentChargeDto | null>(null);
  const [generatingPix, setGeneratingPix] = useState(false);
  const [cancellingPix, setCancellingPix] = useState(false);
  const pixPending = pixCharge?.status === "PENDING";
  const cashGivenInputRef = useRef<HTMLInputElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<SaleReceipt | null>(null);
  const [printPreviewEnabled, setPrintPreviewEnabled] = useState(() =>
    getPrintPreviewEnabled(),
  );
  const [highVisibilityEnabled, setHighVisibilityEnabledState] = useState(() =>
    getHighVisibilityEnabled(),
  );
  const [scannerAutoFocusEnabled, setScannerAutoFocusEnabledState] = useState(() =>
    getScannerAutoFocusEnabled(),
  );
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => readDocumentThemeMode());
  const [expiringModalOpen, setExpiringModalOpen] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");

  const pasteCashGiven = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    setCashGiven(maskMoneyBr(event.clipboardData.getData("text")));
  };

  const pasteUnitPrice = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    setUnitPriceInput(maskMoneyBr(event.clipboardData.getData("text")));
  };

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((item) => {
      const category = item.category?.trim();
      if (category) set.add(category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [products]);

  const expiringProducts = useMemo(() => {
    return products
      .filter(
        (item) =>
          item.stock > 0 &&
          (item.expirationStatus === "EXPIRING_SOON" || item.expirationStatus === "EXPIRED"),
      )
      .sort((a, b) => (a.daysUntilExpiration ?? 0) - (b.daysUntilExpiration ?? 0));
  }, [products]);

  const selectedProductExpiration = useMemo(() => {
    if (
      !selectedProduct ||
      (selectedProduct.expirationStatus !== "EXPIRING_SOON" &&
        selectedProduct.expirationStatus !== "EXPIRED")
    ) {
      return null;
    }
    return evaluateProductExpiration(selectedProduct.expirationDate);
  }, [selectedProduct]);

  const quantity = useMemo(() => {
    const parsed = Number(String(quantityInput).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return roundQuantity(parsed) || 1;
  }, [quantityInput]);

  const parsedCustomUnitPrice = useMemo(() => {
    if (!unitPriceInput.trim()) return 0;
    const parsed = parseMoneyBr(unitPriceInput);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
  }, [parseMoneyBr, unitPriceInput]);

  const activeUnitPrice = useMemo(() => {
    if (parsedCustomUnitPrice > 0) return parsedCustomUnitPrice;
    return selectedProduct && selectedProduct.salePrice > 0 ? selectedProduct.salePrice : 0;
  }, [parsedCustomUnitPrice, selectedProduct]);

  const filteredProducts = useMemo(() => {
    const byCategory =
      selectedCategoryFilter === "ALL"
        ? products
        : products.filter(
            (item) =>
              (item.category?.trim().toLowerCase() ?? "") ===
              selectedCategoryFilter.toLowerCase(),
          );
    return filterProductsByQuery(productSearch, byCategory);
  }, [products, productSearch, selectedCategoryFilter]);

  const subtotal = useMemo(
    () => Math.round(cart.reduce((sum, item) => sum + getCartLineTotal(item), 0) * 100) / 100,
    [cart],
  );
  const totalVolumes = useMemo(
    () => roundQuantity(cart.reduce((sum, item) => sum + item.quantity, 0)),
    [cart],
  );

  const cashGivenValue = parseMoneyBr(cashGiven || "0");
  const changeValue = paymentType === "dinheiro" ? Math.max(0, cashGivenValue - subtotal) : 0;

  const lastScannedCartItem = useMemo(() => {
    if (cart.length === 0) return null;
    if (lastScannedItemId) {
      const matched = cart.find((item) => getCartLineKey(item) === lastScannedItemId);
      if (matched) return matched;
    }
    return cart[cart.length - 1];
  }, [cart, lastScannedItemId]);

  const previewProduct = useMemo(() => {
    if (selectedProduct) return selectedProduct;
    if (!lastScannedCartItem) return null;
    return products.find((item) => item.id === lastScannedCartItem.id) ?? null;
  }, [selectedProduct, products, lastScannedCartItem]);

  const focusProductInput = useCallback((options?: { select?: boolean }) => {
    if (typeof document !== "undefined" && document.querySelector('[role="dialog"]')) {
      return;
    }
    window.setTimeout(() => {
      if (document.querySelector('[role="dialog"]')) return;
      productInputRef.current?.focus();
      if (options?.select) {
        productInputRef.current?.select();
      }
    }, 0);
  }, []);

  const loadProducts = useCallback(async () => {
    const items = await productService.list();
    setProducts(
      items.map((item) => {
        const evalExp = item.expirationDate ? evaluateProductExpiration(item.expirationDate) : null;
        return {
          id: item.id,
          name: item.productName,
          code: item.productCode,
          stock: Number(String(item.productQnt || "0").replace(",", ".")),
          salePrice: parseMoneyBr(item.productSalePrice || "0"),
          unitCost: parseMoneyBr(item.productUnitPrice || "0"),
          imageUrl: item.productImageUrl,
          unitType: item.unitType,
          category: item.productCategory,
          expirationMode: item.expirationMode,
          expirationDate: item.expirationDate,
          expirationStatus: item.expirationStatus ?? evalExp?.status ?? "NONE",
          daysUntilExpiration: item.daysUntilExpiration ?? evalExp?.daysUntilExpiration ?? null,
        };
      }),
    );
  }, [parseMoneyBr]);

  const loadCashStatus = useCallback(async () => {
    const status = await cashRegisterService.status();
    setCashStatus(status ?? null);
    return status ?? null;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts().catch(() => {
      Toast.error("Não foi possível carregar produtos da API no PDV.");
    });
  }, [loadProducts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCashStatus().catch(() => {
      setCashStatus(null);
      Toast.error("Não foi possível validar a abertura de caixa.");
    });
  }, [loadCashStatus]);

  useEffect(() => {
    companyService
      .get()
      .then((data) => {
        if (data) setCompany(data);
      })
      .catch(() => {
        Toast.error("Não foi possível carregar dados da empresa no PDV.");
      });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const storedReceipt = window.localStorage.getItem(LAST_RECEIPT_STORAGE_KEY);
      if (!storedReceipt) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastReceipt(JSON.parse(storedReceipt) as SaleReceipt);
    } catch {
      window.localStorage.removeItem(LAST_RECEIPT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const syncPreferences = () => {
      setPrintPreviewEnabled(getPrintPreviewEnabled());
      setHighVisibilityEnabledState(getHighVisibilityEnabled());
      setScannerAutoFocusEnabledState(getScannerAutoFocusEnabled());
    };
    const onPrintPreferenceChange = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setPrintPreviewEnabled(typeof enabled === "boolean" ? enabled : getPrintPreviewEnabled());
    };
    const onHighVisibilityChange = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setHighVisibilityEnabledState(
        typeof enabled === "boolean" ? enabled : getHighVisibilityEnabled(),
      );
    };
    const onScannerAutoFocusChange = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setScannerAutoFocusEnabledState(
        typeof enabled === "boolean" ? enabled : getScannerAutoFocusEnabled(),
      );
    };

    window.addEventListener("focus", syncPreferences);
    window.addEventListener("storage", syncPreferences);
    window.addEventListener(PRINT_PREVIEW_CHANGE_EVENT, onPrintPreferenceChange);
    window.addEventListener(HIGH_VISIBILITY_CHANGE_EVENT, onHighVisibilityChange);
    window.addEventListener(SCANNER_AUTO_FOCUS_CHANGE_EVENT, onScannerAutoFocusChange);

    return () => {
      window.removeEventListener("focus", syncPreferences);
      window.removeEventListener("storage", syncPreferences);
      window.removeEventListener(PRINT_PREVIEW_CHANGE_EVENT, onPrintPreferenceChange);
      window.removeEventListener(HIGH_VISIBILITY_CHANGE_EVENT, onHighVisibilityChange);
      window.removeEventListener(SCANNER_AUTO_FOCUS_CHANGE_EVENT, onScannerAutoFocusChange);
    };
  }, []);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      setThemeMode(readDocumentThemeMode());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      if (cart.length > 0) {
        window.sessionStorage.setItem(PENDING_CART_STORAGE_KEY, JSON.stringify(cart));
      } else {
        window.sessionStorage.removeItem(PENDING_CART_STORAGE_KEY);
      }
    } catch {
      // Sem sessionStorage a venda continua apenas em memória.
    }
  }, [cart]);

  const restoredNoticeShownRef = useRef(false);
  useEffect(() => {
    if (restoredNoticeShownRef.current) return;
    restoredNoticeShownRef.current = true;
    const restored = readPendingCart();
    if (restored.length > 0) {
      Toast.info(`Venda em andamento restaurada (${restored.length} item(ns)).`);
    }
  }, []);

  useEffect(() => {
    if (!scannerAutoFocusEnabled || checkoutOpen || receiptPreview) return;
    focusProductInput();
  }, [scannerAutoFocusEnabled, checkoutOpen, receiptPreview, focusProductInput]);

  useEffect(() => {
    if (!checkoutOpen) return;
    const timer = window.setTimeout(() => {
      if (paymentType === "dinheiro") {
        cashGivenInputRef.current?.select();
        cashGivenInputRef.current?.focus();
      } else {
        confirmButtonRef.current?.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [checkoutOpen, paymentType]);

  useEffect(() => {
    if (!standalone) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [standalone]);

  useEffect(() => {
    if (filteredProducts.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHighlightedProductIndex(-1);
      return;
    }
    setHighlightedProductIndex((current) => {
      if (current < 0) return 0;
      if (current >= filteredProducts.length) return filteredProducts.length - 1;
      return current;
    });
  }, [filteredProducts]);

  const cashCanSell = cashStatus?.canSell === true;

  const customerDisplayState = useMemo<CustomerDisplayState>(() => {
    const productImageMap = new Map(products.map((product) => [product.id, product.imageUrl]));
    const mappedItems = cart.map((item) => ({
      id: getCartLineKey(item),
      code: item.code,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: getCartLineTotal(item),
      imageUrl: productImageMap.get(item.id),
    }));
    const mappedLastScanned = lastScannedCartItem
      ? mappedItems.find((item) => item.id === getCartLineKey(lastScannedCartItem)) ?? null
      : null;

    return {
      updatedAt: 0,
      status: cart.length > 0 ? "active" : displayStatus,
      companyName: company?.fantasyName || "Hórus PDV",
      operatorName,
      cashCanSell,
      highVisibility: highVisibilityEnabled,
      themeMode,
      lastScannedItem: mappedLastScanned,
      items: mappedItems,
      totalVolumes,
      subtotal,
      lastSale: lastCompletedSale,
    };
  }, [
    cart,
    cashCanSell,
    company?.fantasyName,
    displayStatus,
    highVisibilityEnabled,
    lastCompletedSale,
    lastScannedCartItem,
    operatorName,
    products,
    subtotal,
    themeMode,
    totalVolumes,
  ]);

  const latestDisplayStateRef = useRef(customerDisplayState);
  useEffect(() => {
    latestDisplayStateRef.current = customerDisplayState;
  });

  useEffect(() => {
    const channel = createCustomerDisplayChannel();
    displayChannelRef.current = channel;
    const unsubscribe = subscribeCustomerDisplay({
      onRequestSync: () => {
        publishCustomerDisplayState(
          { ...latestDisplayStateRef.current, updatedAt: Date.now() },
          displayChannelRef.current,
        );
      },
    });
    return () => {
      unsubscribe();
      channel?.close();
      displayChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    publishCustomerDisplayState(
      { ...customerDisplayState, updatedAt: Date.now() },
      displayChannelRef.current,
    );
  }, [customerDisplayState]);

  const highVisibilityRef = useRef(highVisibilityEnabled);
  const scannerAutoFocusRef = useRef(scannerAutoFocusEnabled);
  useEffect(() => {
    highVisibilityRef.current = highVisibilityEnabled;
  }, [highVisibilityEnabled]);
  useEffect(() => {
    scannerAutoFocusRef.current = scannerAutoFocusEnabled;
  }, [scannerAutoFocusEnabled]);

  const toggleHighVisibility = useCallback(() => {
    const next = !highVisibilityRef.current;
    highVisibilityRef.current = next;
    setHighVisibilityEnabledState(next);
    setHighVisibilityEnabled(next);
  }, []);

  const toggleScannerAutoFocus = useCallback(() => {
    const next = !scannerAutoFocusRef.current;
    scannerAutoFocusRef.current = next;
    setScannerAutoFocusEnabledState(next);
    setScannerAutoFocusEnabled(next);
    if (next) {
      focusProductInput();
    }
  }, [focusProductInput]);

  const openCustomerDisplayWindow = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("pdv");
    url.searchParams.set("pdv-display", "1");
    publishCustomerDisplayState(
      { ...latestDisplayStateRef.current, updatedAt: Date.now() },
      displayChannelRef.current,
    );
    const opened = window.open(
      url.toString(),
      "horuspdv-customer-display",
      "width=1280,height=800",
    );
    if (opened) {
      displayWindowRef.current = opened;
      opened.focus();
    }
  };

  const selectProductOption = useCallback(
    (product: PdvProduct) => {
      setSelectedProductId(product.id);
      setProductSearch(product.name);
      setShowProductOptions(false);
      setHighlightedProductIndex(0);
      if (product.salePrice > 0) {
        setUnitPriceInput(formatMoneyBr(product.salePrice));
        window.setTimeout(() => {
          qtyInputRef.current?.focus();
          qtyInputRef.current?.select();
        }, 0);
      } else {
        setUnitPriceInput("");
        window.setTimeout(() => {
          unitPriceInputRef.current?.focus();
          unitPriceInputRef.current?.select();
        }, 0);
      }
    },
    [formatMoneyBr],
  );

  const finishProductEntry = useCallback(() => {
    setDisplayStatus("active");
    setLastCompletedSale(null);
    setSelectedProductId("");
    setProductSearch("");
    setShowProductOptions(false);
    setQuantityInput("1");
    setUnitPriceInput("");
    productInputRef.current?.focus();
  }, []);

  const addProductToCart = useCallback(
    (product: PdvProduct, qty: number, customUnitPrice?: number): boolean => {
      const requestedPrice =
        customUnitPrice !== undefined && customUnitPrice > 0
          ? Math.round(customUnitPrice * 100) / 100
          : product.salePrice > 0
            ? product.salePrice
            : 0;

      if (requestedPrice <= 0) {
        setSelectedProductId(product.id);
        setProductSearch(product.name);
        setShowProductOptions(false);
        setUnitPriceInput("");
        Toast.info(`"${product.name}" tem preço variável. Informe o preço avulso e pressione Enter.`);
        window.setTimeout(() => {
          unitPriceInputRef.current?.focus();
          unitPriceInputRef.current?.select();
        }, 0);
        return false;
      }

      const isCustomPrice =
        product.salePrice <= 0 || Math.abs(requestedPrice - product.salePrice) >= 0.005;

      // Linhas de etiqueta de balança têm total próprio; linhas com preço avulso agrupam apenas se o preço unitário for idêntico.
      const existing = cart.find(
        (item) =>
          item.id === product.id &&
          item.itemTotalOverride === undefined &&
          Math.abs(item.unitPrice - requestedPrice) < 0.005,
      );
      const qtyInCart = roundQuantity(
        cart.filter((item) => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0),
      );
      if (qty > product.stock) {
        Toast.error(`Estoque insuficiente. Disponível: ${formatQuantity(product.stock)}.`);
        return false;
      }
      if (roundQuantity(qtyInCart + qty) > product.stock) {
        Toast.error(`Estoque insuficiente para ${product.name}.`);
        return false;
      }

      const newLineId = isCustomPrice
        ? `${product.id}-price-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : undefined;

      setCart((current) => {
        const currentExisting = current.find(
          (item) =>
            item.id === product.id &&
            item.itemTotalOverride === undefined &&
            Math.abs(item.unitPrice - requestedPrice) < 0.005,
        );
        if (!currentExisting) {
          return [
            ...current,
            {
              id: product.id,
              ...(newLineId ? { lineId: newLineId } : {}),
              code: product.code,
              name: product.name,
              quantity: qty,
              unitPrice: requestedPrice,
              unitCost: product.unitCost,
              expirationDate: product.expirationDate,
              expirationStatus: product.expirationStatus,
              daysUntilExpiration: product.daysUntilExpiration ?? null,
              ...(isCustomPrice ? { unitPriceOverride: requestedPrice } : {}),
            },
          ];
        }
        return current.map((item) =>
          item === currentExisting
            ? { ...item, quantity: roundQuantity(currentExisting.quantity + qty) }
            : item,
        );
      });

      setLastScannedItemId(existing ? getCartLineKey(existing) : (newLineId ?? product.id));
      finishProductEntry();
      if (product.expirationStatus === "EXPIRED" || product.expirationStatus === "EXPIRING_SOON") {
        const evaluation = product.expirationDate
          ? evaluateProductExpiration(product.expirationDate)
          : null;
        const label =
          evaluation?.label ||
          (product.expirationStatus === "EXPIRED" ? "vencido" : "prestes a vencer");
        const canSuggestCost =
          product.unitCost && product.unitCost > 0 && requestedPrice > product.unitCost + 0.005;
        Toast.info(
          canSuggestCost
            ? `Atenção: "${product.name}" (${label}). Clique em Custo na lista para vender a R$ ${formatMoneyBr(product.unitCost!)}.`
            : `Atenção: "${product.name}" (${label}).`,
        );
      }
      return true;
    },
    [cart, finishProductEntry, formatMoneyBr],
  );

  /** Etiqueta EAN-13 de balança (prefixo 2): adiciona uma linha com peso e total da etiqueta. */
  const addScaleLabelToCart = useCallback(
    (rawQuery: string): boolean | null => {
      const scaleMatch = parseScaleBarcode(rawQuery.trim(), products);
      if (!scaleMatch) return null;

      const qtyInCart = roundQuantity(
        cart
          .filter((item) => item.id === scaleMatch.product.id)
          .reduce((sum, item) => sum + item.quantity, 0),
      );
      if (roundQuantity(qtyInCart + scaleMatch.quantity) > scaleMatch.product.stock) {
        Toast.error(
          `Estoque insuficiente para ${scaleMatch.product.name}. Disponível: ${formatQuantity(scaleMatch.product.stock)}.`,
        );
        return false;
      }

      const lineId = `${scaleMatch.product.id}-scale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setCart((current) => [
        ...current,
        {
          id: scaleMatch.product.id,
          lineId,
          code: scaleMatch.product.code,
          name: scaleMatch.product.name,
          quantity: scaleMatch.quantity,
          unitPrice: scaleMatch.unitPrice,
          unitCost: scaleMatch.product.unitCost,
          expirationDate: scaleMatch.product.expirationDate,
          expirationStatus: scaleMatch.product.expirationStatus,
          daysUntilExpiration: scaleMatch.product.daysUntilExpiration ?? null,
          itemTotalOverride: scaleMatch.totalValue,
        },
      ]);
      setLastScannedItemId(lineId);
      finishProductEntry();
      return true;
    },
    [cart, finishProductEntry, products],
  );

  const submitProductEntry = useCallback(
    (rawQuery?: string, options?: { allowFuzzyFallback?: boolean }): boolean => {
      const query = rawQuery ?? productSearch;
      if (rawQuery || !selectedProduct) {
        const scaleResult = addScaleLabelToCart(query);
        if (scaleResult !== null) return scaleResult;
      }

      const resolution = resolveProductSubmission({
        query,
        products,
        selectedProduct: rawQuery ? null : selectedProduct,
        showProductOptions: rawQuery ? false : showProductOptions,
        highlightedProductIndex,
        allowFuzzyFallback: options?.allowFuzzyFallback ?? false,
      });

      if (resolution.type === "add") {
        const customPrice =
          !rawQuery && parsedCustomUnitPrice > 0 ? parsedCustomUnitPrice : undefined;
        return addProductToCart(resolution.product, quantity, customPrice);
      }

      if (resolution.type === "select_option") {
        selectProductOption(resolution.product);
        return true;
      }

      Toast.error(
        query.trim()
          ? "Produto não encontrado para o código informado."
          : "Selecione um produto.",
      );
      setShowProductOptions(false);
      focusProductInput({ select: true });
      return false;
    },
    [
      addProductToCart,
      addScaleLabelToCart,
      focusProductInput,
      highlightedProductIndex,
      parsedCustomUnitPrice,
      productSearch,
      products,
      quantity,
      selectProductOption,
      selectedProduct,
      showProductOptions,
    ],
  );

  const addItem = useCallback(() => {
    submitProductEntry(undefined, { allowFuzzyFallback: true });
  }, [submitProductEntry]);

  const removeItem = (lineKey: string) => {
    setCart((current) => {
      const next = current.filter((item) => getCartLineKey(item) !== lineKey);
      if (lastScannedItemId === lineKey) {
        setLastScannedItemId(next.length > 0 ? getCartLineKey(next[next.length - 1]) : null);
      }
      if (next.length === 0) {
        setDisplayStatus("idle");
      }
      return next;
    });
    if (scannerAutoFocusEnabled) {
      focusProductInput();
    }
  };

  const applyCostPriceToCartLine = (lineKey: string, unitCost: number) => {
    if (unitCost <= 0) return;
    const roundedCost = Math.round(unitCost * 100) / 100;
    let updatedKey = lineKey;
    setCart((current) =>
      current.map((item) => {
        if (getCartLineKey(item) !== lineKey) return item;
        const nextLineId = item.lineId ?? `${item.id}-cost-${Date.now()}`;
        updatedKey = nextLineId;
        return {
          ...item,
          lineId: nextLineId,
          unitPrice: roundedCost,
          unitPriceOverride: roundedCost,
        };
      }),
    );
    setLastScannedItemId((current) => (current === lineKey ? updatedKey : current));
    Toast.success(`Preço ajustado para o custo (R$ ${formatMoneyBr(roundedCost)}).`);
    if (scannerAutoFocusEnabled) {
      focusProductInput();
    }
  };

  const saveLastReceipt = (receipt: SaleReceipt) => {
    setLastReceipt(receipt);
    try {
      window.localStorage.setItem(LAST_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
    } catch {
      // Mantém apenas em memória caso o navegador bloqueie o armazenamento local.
    }
  };

  const printLastSale = () => {
    if (!lastReceipt) {
      Toast.info("Nenhuma venda finalizada nesta estação.");
      return;
    }
    setReceiptPreview(lastReceipt);
  };

  const cancelSale = useCallback(async () => {
    if (cart.length === 0) return;
    const confirmed = await statusDialog.confirm("Cancelar venda atual?");
    if (!confirmed) {
      if (scannerAutoFocusEnabled) focusProductInput();
      return;
    }
    setCart([]);
    setLastScannedItemId(null);
    setSelectedProductId("");
    setProductSearch("");
    setUnitPriceInput("");
    setDisplayStatus("cancelled");
    setLastCompletedSale(null);
    setCpfNota("");
    setCashGiven("");
    setPixCharge(null);
    setCheckoutOpen(false);
    Toast.info("Venda cancelada.");
    if (scannerAutoFocusEnabled) focusProductInput();
  }, [cart.length, focusProductInput, scannerAutoFocusEnabled, statusDialog]);

  const openPayment = useCallback(async () => {
    if (cart.length === 0) {
      Toast.error("Adicione ao menos um item.");
      return;
    }

    try {
      const latestCashStatus = await loadCashStatus();
      if (!latestCashStatus?.canSell) {
        Toast.error(
          latestCashStatus?.blockReason || "Abra o caixa antes de iniciar uma venda.",
        );
        return;
      }
    } catch {
      Toast.error("Não foi possível validar a abertura de caixa.");
      return;
    }

    setPaymentType("dinheiro");
    setPixCharge(null);
    setCashGiven(formatMoneyBr(subtotal));
    setCheckoutOpen(true);
  }, [cart.length, formatMoneyBr, loadCashStatus, subtotal]);

  const generatePix = async () => {
    if (generatingPix) return;
    setGeneratingPix(true);
    try {
      const result = await paymentChargeService.create({
        method: "PIX",
        amountCents: Math.round(subtotal * 100),
        description: `Venda ${company?.fantasyName || "Hórus PDV"}`.slice(0, 120),
        payerName: "Consumidor",
        payerDocument: cpfNota,
      });
      setPixCharge(result.charge);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível gerar o QR Code PIX.");
    } finally {
      setGeneratingPix(false);
    }
  };

  /** Cancela o PIX pendente. Devolve false se o operador desistiu ou se o pagamento caiu no meio. */
  const cancelPix = async (askFirst: boolean) => {
    if (!pixCharge || pixCharge.status !== "PENDING") return true;
    if (askFirst) {
      const confirmed = await statusDialog.confirm(
        "Há um QR Code PIX aguardando pagamento. Cancelar a cobrança?",
        { confirmLabel: "Cancelar PIX", cancelLabel: "Manter" },
      );
      if (!confirmed) return false;
    }

    setCancellingPix(true);
    try {
      const result = await paymentChargeService.cancel(pixCharge.id);
      setPixCharge(result.charge.status === "PENDING" ? result.charge : null);
      Toast.info(result.message);
      return true;
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Não foi possível cancelar o PIX.");
      // O pagamento pode ter caído: atualiza para o polling finalizar a venda.
      paymentChargeService.get(pixCharge.id).then(setPixCharge).catch(() => undefined);
      return false;
    } finally {
      setCancellingPix(false);
    }
  };

  const closeCheckout = async () => {
    if (confirmingPayment) return;
    if (!(await cancelPix(true))) return;
    setCheckoutOpen(false);
    if (scannerAutoFocusEnabled) {
      focusProductInput();
    }
  };

  const confirmPayment = async (polledChargeId?: string) => {
    if (confirmingPayment) return;
    // Se o PIX já caiu e o registro falhou antes (ex.: estoque), a nova tentativa mantém o vínculo.
    const paidChargeId = polledChargeId ?? (pixCharge?.status === "PAID" ? pixCharge.id : undefined);
    if (paymentType === "pix" && pixPending && !paidChargeId) {
      Toast.info("Aguardando o pagamento do PIX. Cancele o QR Code para registrar de outra forma.");
      return;
    }
    if (paymentType === "dinheiro" && cashGivenValue < subtotal) {
      Toast.error("Valor recebido menor que total.");
      return;
    }

    setConfirmingPayment(true);
    try {
      const latestCashStatus = await loadCashStatus();
      if (!latestCashStatus?.canSell) {
        Toast.error(
          latestCashStatus?.blockReason || "Abra o caixa antes de confirmar a venda.",
        );
        return;
      }

      const result = await salesHistoryService.register({
        customerName: "Consumidor",
        customerCpf: cpfNota || "-",
        paymentType,
        totalAmount: formatMoneyBr(subtotal),
        operatorName,
        paymentChargeId: paymentType === "pix" ? paidChargeId : undefined,
        items: cart.map((item) => ({
          productCode: item.code,
          productName: item.name,
          quantity: item.quantity,
          ...(item.unitPriceOverride !== undefined
            ? { unitPriceOverride: item.unitPriceOverride }
            : {}),
          ...(item.itemTotalOverride !== undefined
            ? { itemTotalOverride: item.itemTotalOverride }
            : {}),
        })),
      });
      const receipt: SaleReceipt = {
        saleNumber: result?.saleNumber || `PDV-${Date.now()}`,
        issuedAt: new Date().toISOString(),
        company: company
          ? {
              fantasyName: company.fantasyName,
              corporateName: company.corporateName,
              cnpj: company.cnpj,
              address: company.address,
              number: company.number,
              neighborhood: company.neighborhood,
              city: company.city,
              uf: company.uf,
              phone: company.phone,
              sacPhone: company.sacPhone,
            }
          : null,
        customerCpf: cpfNota || "-",
        paymentType,
        paymentLabel: getPaymentLabel(paymentType),
        operatorName,
        subtotal,
        cashGiven: paymentType === "dinheiro" ? cashGivenValue : subtotal,
        change: paymentType === "dinheiro" ? changeValue : 0,
        items: cart.map((item) => ({
          ...item,
          total: getCartLineTotal(item),
        })),
      };

      setCheckoutOpen(false);
      saveLastReceipt(receipt);
      setLastCompletedSale({
        saleNumber: receipt.saleNumber,
        total: receipt.subtotal,
        paymentLabel: receipt.paymentLabel,
        change: receipt.change,
      });
      setDisplayStatus("completed");
      // Atualiza o estoque em segundo plano para não atrasar o recibo.
      loadProducts().catch(() => {
        Toast.error("Não foi possível atualizar o estoque no PDV.");
      });
      if (printPreviewEnabled) {
        setReceiptPreview(receipt);
      }
      Toast.success(`Pagamento confirmado. Venda ${receipt.saleNumber} registrada.`);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao registrar venda.");
      return;
    } finally {
      setConfirmingPayment(false);
    }

    setCart([]);
    setLastScannedItemId(null);
    setSelectedProductId("");
    setProductSearch("");
    setShowProductOptions(false);
    setQuantityInput("1");
    setUnitPriceInput("");
    setPaymentType("dinheiro");
    setCpfNota("");
    setCashGiven("");
    setPixCharge(null);
    window.setTimeout(() => {
      if (!document.querySelector('[role="dialog"]')) {
        productInputRef.current?.focus();
      }
    }, 0);
  };

  // Mantém a versão mais recente para o polling do PIX chamar sem reiniciar o intervalo a cada render.
  const confirmPaymentRef = useRef(confirmPayment);
  useEffect(() => {
    confirmPaymentRef.current = confirmPayment;
  });

  const pendingChargeId = checkoutOpen && pixPending ? pixCharge?.id : undefined;
  useEffect(() => {
    if (!pendingChargeId) return undefined;
    let stopped = false;
    const intervalId = window.setInterval(() => {
      paymentChargeService
        .get(pendingChargeId)
        .then((charge) => {
          if (stopped) return;
          setPixCharge(charge);
          if (charge.status === "PAID") {
            stopped = true;
            void confirmPaymentRef.current(charge.id);
          }
        })
        .catch(() => undefined);
    }, PIX_POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [pendingChargeId]);

  const closeCheckoutRef = useRef(closeCheckout);
  const pixPendingRef = useRef(pixPending);
  useEffect(() => {
    closeCheckoutRef.current = closeCheckout;
    pixPendingRef.current = pixPending;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isInput = target?.tagName === "INPUT";
      const isEditable = isEditableElement(target);
      const hasOpenDialog = Boolean(document.querySelector('[role="dialog"]'));

      if (event.key === "F2") {
        event.preventDefault();
        productInputRef.current?.focus();
        return;
      }
      if (event.key === "F4") {
        event.preventDefault();
        qtyInputRef.current?.focus();
        return;
      }
      if (event.key === "F6") {
        event.preventDefault();
        unitPriceInputRef.current?.focus();
        unitPriceInputRef.current?.select();
        return;
      }
      if (event.key === "F7") {
        event.preventDefault();
        toggleHighVisibility();
        return;
      }
      if (event.key === "F8") {
        event.preventDefault();
        void cancelSale();
        return;
      }
      if (event.key === "F12") {
        event.preventDefault();
        if (!checkoutOpen) void openPayment();
        return;
      }
      if (event.key === "Enter" && isInput && !checkoutOpen) {
        if (target === qtyInputRef.current || target === unitPriceInputRef.current) {
          event.preventDefault();
          submitProductEntry(undefined, { allowFuzzyFallback: true });
          return;
        }
      }
      if (event.key === "Escape" && checkoutOpen) {
        event.preventDefault();
        void closeCheckoutRef.current();
        return;
      }
      if (checkoutOpen && !isInput && !pixPendingRef.current) {
        // Teclas 1–4 escolhem a forma de pagamento quando o foco não está num campo de texto.
        const option = PAYMENT_OPTIONS.find((item) => item.shortcut === event.key);
        if (option) {
          event.preventDefault();
          setPaymentType(option.value);
        }
        return;
      }

      // Captura rajada de leitor HID mesmo quando o foco estiver fora de campos editáveis.
      if (!checkoutOpen && !receiptPreview && !isEditable && !hasOpenDialog) {
        const nowMs = Date.now();
        if (event.key === "Enter") {
          const { buffer, lastKeyAt } = hidBufferRef.current;
          hidBufferRef.current = { buffer: "", lastKeyAt: 0 };
          if (buffer.length >= HID_MIN_CODE_LENGTH && nowMs - lastKeyAt <= HID_ENTER_MAX_MS) {
            event.preventDefault();
            submitProductEntry(buffer, { allowFuzzyFallback: false });
          }
          return;
        }

        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          const withinBurst = nowMs - hidBufferRef.current.lastKeyAt <= HID_INTER_KEY_MAX_MS;
          hidBufferRef.current = {
            buffer: withinBurst ? `${hidBufferRef.current.buffer}${event.key}` : event.key,
            lastKeyAt: nowMs,
          };
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    cancelSale,
    checkoutOpen,
    openPayment,
    receiptPreview,
    submitProductEntry,
    toggleHighVisibility,
  ]);

  const { dateLabel, timeLabel } = formatDateTime(now);
  const cashLabel = cashStatus
    ? cashCanSell
      ? `Caixa aberto por ${formatCashElapsed(cashStatus.currentSession?.elapsedMinutes)}`
      : cashStatus.blockReason || "Caixa fechado"
    : "Validando caixa...";

  return (
    <HighVisibilityWrapper enabled={highVisibilityEnabled} className="h-full">
      <div className="h-[100dvh] overflow-y-auto bg-bg-primary p-1.5 md:overflow-hidden md:p-2">
        <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col overflow-visible rounded-2xl border border-border-primary bg-bg-light shadow-md md:h-full md:overflow-hidden">
          <header className="relative border-b border-border-secondary bg-accent px-4 py-3 text-text-light">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="pdv-header-title font-display text-2xl font-bold italic leading-none md:text-4xl">
                  Hórus PDV
                </h1>
                <p className="pdv-header-subtitle text-sm italic leading-none md:text-lg">
                  Frente de Caixa
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={toggleHighVisibility}
                  aria-pressed={highVisibilityEnabled}
                  className="pdv-toggle-pill inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-bold text-text-light transition hover:bg-white/25 md:text-sm"
                  title="Alternar modo Alta Visibilidade (F7)"
                >
                  <Eye size={16} />
                  <span>
                    {highVisibilityEnabled
                      ? "Alta Visibilidade: ON (F7)"
                      : "Alta Visibilidade (F7)"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleScannerAutoFocus}
                  aria-pressed={scannerAutoFocusEnabled}
                  className="pdv-toggle-pill inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-bold text-text-light transition hover:bg-white/25 md:text-sm"
                  title="Manter o leitor de código de barras sempre pronto para o próximo bipe"
                >
                  <ScanBarcode size={16} />
                  <span>
                    {scannerAutoFocusEnabled
                      ? "Manter foco no leitor: ON"
                      : "Manter foco no leitor: OFF"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={openCustomerDisplayWindow}
                  className="pdv-toggle-pill inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-bold text-text-light transition hover:bg-white/25 md:text-sm"
                  title="Abrir segunda tela para o cliente"
                >
                  <Monitor size={16} />
                  <span>Visor do Cliente</span>
                </button>

                {expiringProducts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setExpiringModalOpen(true)}
                    className="pdv-toggle-pill inline-flex items-center gap-1.5 rounded-xl border border-amber-300/80 bg-amber-400/95 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-300 md:text-sm"
                    title="Produtos vencidos ou prestes a vencer para venda a preço de custo"
                  >
                    <AlertTriangle size={16} />
                    <span>Vencendo ({expiringProducts.length})</span>
                  </button>
                ) : null}

                <div className="text-right text-xs md:text-sm pdv-tabular">
                  <p className="capitalize">{dateLabel}</p>
                  <p className="pdv-header-clock text-base font-semibold md:text-lg">
                    {timeLabel}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main
            className={`flex min-h-0 flex-1 flex-col ${
              highVisibilityEnabled
                ? "lg:grid lg:grid-cols-[360px_minmax(0,1fr)]"
                : "lg:grid lg:grid-cols-[310px_minmax(0,1fr)]"
            }`}
          >
            <aside className="shrink-0 border-b border-border-primary bg-bg-gray-theme p-3.5 text-text-primary lg:overflow-y-auto lg:border-b-0 lg:border-r">
              <div className="mb-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="pdv-product-search"
                    className="pdv-field-label text-xs font-semibold uppercase"
                  >
                    Produto:
                  </label>
                  {availableCategories.length > 0 ? (
                    <select
                      aria-label="Filtrar produtos por categoria"
                      value={selectedCategoryFilter}
                      onChange={(event) => {
                        const nextCategory = event.target.value;
                        setSelectedCategoryFilter(nextCategory);
                        setHighlightedProductIndex(0);
                        setShowProductOptions(nextCategory !== "ALL" || productSearch.trim().length > 0);
                        window.setTimeout(() => {
                          productInputRef.current?.focus();
                        }, 0);
                      }}
                      className="max-w-[155px] rounded-lg border border-border-secondary bg-bg-light px-2 py-1 text-xs font-medium text-text-primary outline-none focus:border-accent"
                    >
                      <option value="ALL">Todas categorias</option>
                      {availableCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  />
                  <input
                    id="pdv-product-search"
                    ref={productInputRef}
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setSelectedProductId("");
                      setUnitPriceInput("");
                      setShowProductOptions(true);
                      setHighlightedProductIndex(0);
                    }}
                    onFocus={() => {
                      // Evita reabrir o autocomplete automaticamente após adicionar item no mobile.
                      const shouldOpen =
                        productSearch.trim().length > 0 || selectedCategoryFilter !== "ALL";
                      setShowProductOptions(shouldOpen);
                      if (shouldOpen && filteredProducts.length > 0) setHighlightedProductIndex(0);
                    }}
                    onBlur={() => window.setTimeout(() => setShowProductOptions(false), 120)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitProductEntry(undefined, { allowFuzzyFallback: false });
                        return;
                      }

                      if (!showProductOptions) return;

                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        if (filteredProducts.length === 0) return;
                        setHighlightedProductIndex((current) =>
                          current >= filteredProducts.length - 1 ? 0 : current + 1,
                        );
                      }

                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        if (filteredProducts.length === 0) return;
                        setHighlightedProductIndex((current) =>
                          current <= 0 ? filteredProducts.length - 1 : current - 1,
                        );
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        setShowProductOptions(false);
                      }
                    }}
                    placeholder="Código, nome ou categoria"
                    className="input-field pdv-search-input h-10 w-full pl-9 text-sm"
                    autoComplete="off"
                  />
                  {showProductOptions && (
                    <ul className="absolute left-0 right-0 top-full z-layer-popover mt-1 max-h-52 overflow-y-auto rounded-xl border border-border-secondary bg-bg-light text-text-primary shadow-lg">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((item, index) => (
                          <li
                            key={item.id}
                            className={`cursor-pointer border-b border-border-primary px-3 py-2 text-sm ${
                              highlightedProductIndex === index
                                ? "bg-hover-light"
                                : "hover:bg-hover-light"
                            }`}
                            onMouseEnter={() => setHighlightedProductIndex(index)}
                            onMouseDown={() => {
                              selectProductOption(item);
                            }}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <p className="font-semibold">{item.name}</p>
                              {item.expirationStatus === "EXPIRED" ||
                              item.expirationStatus === "EXPIRING_SOON" ? (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    item.expirationStatus === "EXPIRED"
                                      ? "bg-rose-500/15 text-rose-500"
                                      : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                                  }`}
                                >
                                  {item.expirationStatus === "EXPIRED"
                                    ? "Vencido"
                                    : "Prestes a vencer"}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-text-secondary pdv-tabular">
                              {item.code}
                              {item.category ? ` · ${item.category}` : ""}
                              {item.salePrice > 0
                                ? ` · R$ ${formatMoneyBr(item.salePrice)}`
                                : " · Preço avulso"}
                              {item.expirationDate
                                ? ` · Val. ${formatIsoDateBr(item.expirationDate)}`
                                : ""}
                            </p>
                          </li>
                        ))
                      ) : (
                        <li className="px-3 py-2 text-xs text-text-secondary">
                          Nenhum produto encontrado.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              <label className="mb-2.5 block">
                <span className="pdv-field-label mb-1 block text-xs font-semibold uppercase">
                  Quantidade (volume):
                </span>
                <input
                  ref={qtyInputRef}
                  value={quantityInput}
                  inputMode="decimal"
                  onFocus={(event) => event.target.select()}
                  onChange={(event) =>
                    setQuantityInput(sanitizeDecimalInput(event.target.value, 3).slice(0, 10))
                  }
                  onBlur={() => {
                    const cleaned = quantityInput.replace(/\.$/, "");
                    const parsed = Number(cleaned.replace(",", "."));
                    if (!cleaned || !Number.isFinite(parsed) || parsed <= 0) {
                      setQuantityInput("1");
                    } else if (cleaned !== quantityInput) {
                      setQuantityInput(cleaned);
                    }
                  }}
                  className="input-field pdv-qty-input pdv-tabular h-10 w-full text-lg font-semibold"
                />
              </label>

              <label className="mb-2.5 block">
                <span className="pdv-field-label mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase">
                  <span>Preço unitário (F6):</span>
                  {selectedProduct && selectedProduct.salePrice <= 0 ? (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold normal-case text-amber-700 dark:text-amber-300">
                      Informe o preço avulso
                    </span>
                  ) : selectedProduct &&
                    parsedCustomUnitPrice > 0 &&
                    Math.abs(parsedCustomUnitPrice - selectedProduct.salePrice) >= 0.005 ? (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold normal-case text-accent">
                      Preço avulso
                    </span>
                  ) : null}
                </span>
                <input
                  ref={unitPriceInputRef}
                  value={unitPriceInput}
                  inputMode="numeric"
                  pattern="[0-9,.]*"
                  onFocus={(event) => event.target.select()}
                  onBeforeInput={preventNonDigitBeforeInput}
                  onPaste={pasteUnitPrice}
                  onChange={(event) => setUnitPriceInput(maskMoneyBr(event.target.value))}
                  placeholder={
                    selectedProduct && selectedProduct.salePrice > 0
                      ? formatMoneyBr(selectedProduct.salePrice)
                      : "0,00 (avulso)"
                  }
                  className="input-field pdv-price-input pdv-tabular h-10 w-full text-lg font-semibold"
                />
              </label>

              {selectedProductExpiration ? (
                <div
                  className={`mb-2.5 rounded-xl border p-2.5 text-xs ${
                    selectedProductExpiration.status === "EXPIRED"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  }`}
                >
                  <p className="font-semibold">
                    {selectedProductExpiration.label} ({selectedProductExpiration.formattedDate})
                  </p>
                  {selectedProduct?.unitCost && selectedProduct.unitCost > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setUnitPriceInput(formatMoneyBr(selectedProduct.unitCost!));
                        window.setTimeout(() => {
                          qtyInputRef.current?.focus();
                          qtyInputRef.current?.select();
                        }, 0);
                      }}
                      className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
                    >
                      <Tag size={12} />
                      Usar preço de custo (R$ {formatMoneyBr(selectedProduct.unitCost)})
                    </button>
                  ) : null}
                </div>
              ) : null}

              <label className="mb-2.5 block">
                <span className="pdv-field-label mb-1 block text-xs font-semibold uppercase">
                  Preço total:
                </span>
                <input
                  value={
                    activeUnitPrice > 0
                      ? formatMoneyBr(computeLineTotal(activeUnitPrice, quantity))
                      : "0,00"
                  }
                  className="input-field pdv-price-input pdv-tabular h-10 w-full text-lg font-semibold"
                  disabled
                />
              </label>

              <button
                type="button"
                onClick={addItem}
                className="btn-success pdv-btn-action h-11 w-full rounded-xl"
              >
                ADICIONAR ITEM (ENTER)
              </button>

              <div className="mt-3 border-t border-border-primary pt-2.5 text-sm">
                <p className="pdv-field-label pdv-tabular font-semibold">
                  Total volumes: {formatTotalVolumes(totalVolumes)}
                </p>
              </div>
            </aside>

            <section className="flex min-h-[55vh] flex-col bg-bg-light lg:min-h-0">
              <div className="grid grid-cols-1 gap-1 border-b border-border-primary bg-bg-gray-theme px-3 py-2 text-xs text-text-primary sm:grid-cols-[1fr_220px] sm:gap-0 md:text-sm">
                <p>
                  <span className="font-semibold">Empresa:</span>{" "}
                  {company?.fantasyName || "Hórus PDV"}
                </p>
                <p className="sm:text-right pdv-tabular">
                  <span className="font-semibold">CNPJ:</span> {company?.cnpj || "-"}
                </p>
              </div>

              <div
                className={`pdv-cash-banner border-b px-3 py-2 text-sm font-semibold ${
                  cashCanSell
                    ? "border-success/20 bg-success/10 text-success"
                    : "border-primary/20 bg-primary/10 text-primary"
                }`}
              >
                {cashLabel}
              </div>

              <LastScannedCard
                activeItem={lastScannedCartItem}
                selectedProduct={selectedProduct}
                previewImageUrl={previewProduct?.imageUrl}
                previewQuantity={quantity}
                formatMoney={formatMoneyBr}
                highVisibility={highVisibilityEnabled}
              />

              <div className="flex min-h-0 flex-1 flex-col px-3 py-2.5">
                <p className="pdv-field-label mb-1.5 text-sm font-semibold">Lista de itens:</p>
                <div className="min-h-[180px] flex-1 overflow-auto rounded-xl border border-dashed border-border-secondary bg-bg-primary md:min-h-0">
                  <CartItemsTable
                    cart={cart}
                    lastScannedItemId={lastScannedCartItem ? getCartLineKey(lastScannedCartItem) : null}
                    formatMoney={formatMoneyBr}
                    onRemoveItem={removeItem}
                    onApplyCostPrice={applyCostPriceToCartLine}
                    highVisibility={highVisibilityEnabled}
                  />
                </div>
              </div>

              <div className="md:sticky md:bottom-0 md:z-10 md:shadow-[0_-8px_18px_rgba(15,23,42,0.08)]">
                <div
                  className="pdv-shortcuts-bar hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-primary bg-bg-gray-theme px-3 py-1.5 text-xs text-text-secondary md:flex"
                  aria-label="Atalhos de teclado"
                >
                  {KEYBOARD_SHORTCUTS.map((shortcut) => (
                    <span key={shortcut.key} className="inline-flex items-center gap-1.5">
                      <kbd className="rounded-md border border-border-secondary bg-bg-light px-1.5 py-0.5 font-mono text-[11px] font-semibold text-text-primary">
                        {shortcut.key}
                      </kbd>
                      {shortcut.label}
                    </span>
                  ))}
                </div>

                <TotalBanner
                  subtotal={subtotal}
                  totalVolumes={totalVolumes}
                  itemCount={cart.length}
                  formatMoney={formatMoneyBr}
                  highVisibility={highVisibilityEnabled}
                />

                <div className="grid grid-cols-1 gap-2 border-t border-border-primary px-3 py-3 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={cancelSale}
                    disabled={cart.length === 0}
                    className="btn-cancel pdv-btn-action h-12 w-full rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ✖ CANCELAR (F8)
                  </button>
                  <button
                    type="button"
                    onClick={printLastSale}
                    className="pdv-btn-action inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border-secondary px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
                  >
                    <Printer size={16} />
                    Imprimir última venda
                  </button>
                  <button
                    type="button"
                    onClick={openPayment}
                    className="btn-success pdv-btn-action h-14 w-full rounded-xl text-lg tracking-wide disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 sm:h-12"
                    disabled={!cashCanSell}
                    title={cashCanSell ? undefined : cashLabel}
                  >
                    PAGAMENTO (F12)
                  </button>
                </div>

                <footer className="pdv-footer space-y-0.5 border-t border-border-primary bg-bg-primary px-3 py-2 text-[11px] text-text-secondary sm:grid sm:grid-cols-3 sm:items-center sm:space-y-0 sm:text-xs">
                  <p>Usuário: {operatorName}</p>
                  <p className="sm:text-center">
                    Estabelecimento: {company?.fantasyName || "Hórus PDV"}
                  </p>
                  <p className="sm:text-right">
                    Alta visibilidade: {highVisibilityEnabled ? "Ativa" : "Padrão"} • Prévia:{" "}
                    {printPreviewEnabled ? "Sim" : "Não"} • Caixa:{" "}
                    {cashCanSell ? "PDV01 aberto" : "bloqueado"}
                  </p>
                </footer>
              </div>
            </section>
          </main>
        </div>

        {checkoutOpen && (
          <div className="fixed inset-0 z-layer-modal flex items-end bg-black/45 md:items-center md:justify-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-title"
              className="max-h-[100dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-border-primary bg-bg-light p-4 md:max-h-[94dvh] md:max-w-xl md:rounded-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 id="checkout-title" className="text-lg font-semibold text-text-primary">
                  Pagamento
                </h2>
                <button
                  type="button"
                  onClick={() => void closeCheckout()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-primary text-text-secondary"
                  aria-label="Fechar pagamento (Esc)"
                >
                  <X size={14} />
                </button>
              </div>

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void confirmPayment();
                }}
              >
                <fieldset>
                  <legend className="pdv-field-label mb-1.5 block text-sm text-text-secondary">
                    Forma de pagamento
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PAYMENT_OPTIONS.map((option) => {
                      const selected = paymentType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          disabled={pixPending && !selected}
                          onClick={() => setPaymentType(option.value)}
                          className={`flex h-14 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            selected
                              ? "border-accent bg-accent text-text-light shadow-sm"
                              : "border-border-secondary bg-bg-light text-text-primary hover:bg-hover-light"
                          }`}
                        >
                          <span>{option.label}</span>
                          <span
                            className={`text-[11px] font-normal ${
                              selected ? "text-text-light/80" : "text-text-tertiary"
                            }`}
                          >
                            tecla {option.shortcut}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {paymentType === "dinheiro" && (
                  <label className="block">
                    <span className="pdv-field-label mb-1.5 block text-sm text-text-secondary">
                      Valor recebido
                    </span>
                    <input
                      ref={cashGivenInputRef}
                      value={cashGiven}
                      inputMode="numeric"
                      pattern="[0-9,.]*"
                      onBeforeInput={preventNonDigitBeforeInput}
                      onPaste={pasteCashGiven}
                      onChange={(event) => setCashGiven(maskMoneyBr(event.target.value))}
                      className="input-field pdv-tabular w-full text-lg font-semibold"
                      placeholder="0,00"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="pdv-field-label mb-1.5 block text-sm text-text-secondary">
                    CPF na nota (opcional)
                  </span>
                  <input
                    value={cpfNota}
                    readOnly={pixPending}
                    inputMode="numeric"
                    onChange={(event) => setCpfNota(maskCpf(event.target.value))}
                    className="input-field pdv-tabular w-full"
                    placeholder="000.000.000-00"
                  />
                </label>

                {paymentType === "pix" && (
                  <PixChargePanel
                    charge={pixCharge}
                    generating={generatingPix}
                    cancelling={cancellingPix}
                    onGenerate={() => void generatePix()}
                    onCancel={() => void cancelPix(false)}
                  />
                )}

                <div className="rounded-xl border border-border-primary bg-bg-primary p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-text-secondary">Total</span>
                    <span className="pdv-tabular font-display text-2xl font-bold text-text-primary">
                      R$ {formatMoneyBr(subtotal)}
                    </span>
                  </div>
                  {paymentType === "dinheiro" && (
                    <div className="mt-2 flex items-baseline justify-between border-t border-border-primary pt-2">
                      <span className="text-sm text-text-secondary">Troco</span>
                      <span className="pdv-tabular font-display text-3xl font-bold text-success">
                        R$ {formatMoneyBr(changeValue)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid gap-2 pt-1 sm:grid-cols-[1fr_2fr]">
                  <button
                    type="button"
                    onClick={() => void closeCheckout()}
                    className="btn-cancel h-12"
                  >
                    Voltar
                  </button>
                  <LoadingButton
                    ref={confirmButtonRef}
                    type="submit"
                    isLoading={confirmingPayment}
                    loadingLabel="Registrando..."
                    disabled={paymentType === "pix" && pixPending}
                    className="btn-success inline-flex h-12 items-center justify-center gap-2 text-base disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {paymentType !== "pix"
                      ? "Confirmar"
                      : pixPending
                        ? "Aguardando PIX..."
                        : pixCharge?.status === "PAID"
                          ? "Registrar venda"
                          : "Confirmar PIX recebido"}
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {expiringModalOpen ? (
          <div
            className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/55 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Produtos vencidos ou prestes a vencer"
            onClick={() => setExpiringModalOpen(false)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border border-border-primary bg-bg-light p-5 text-text-primary shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border-primary pb-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                    <AlertTriangle size={18} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">
                      Produtos vencidos ou prestes a vencer ({expiringProducts.length})
                    </h2>
                    <p className="text-xs text-text-secondary">
                      Selecione um item para lançar no caixa a preço de custo ou atualize o preço
                      cadastrado para liquidação imediata.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpiringModalOpen(false)}
                  className="rounded-lg p-1.5 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
                  aria-label="Fechar alertas de validade"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
                {expiringProducts.map((item) => {
                  const evaluation = evaluateProductExpiration(item.expirationDate);
                  const isExpired =
                    item.expirationStatus === "EXPIRED" || evaluation.status === "EXPIRED";
                  const cost = item.unitCost ?? 0;
                  const canUpdateToCost = cost > 0 && Math.abs(item.salePrice - cost) >= 0.005;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-border-primary bg-bg-primary p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold text-text-primary">
                            {item.name}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isExpired
                                ? "bg-rose-500/15 text-rose-500"
                                : "bg-amber-500/15 text-amber-500"
                            }`}
                          >
                            {evaluation.label || (isExpired ? "Vencido" : "Prestes a vencer")}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary pdv-tabular">
                          Cód. {item.code} • Estoque: {formatQuantity(item.stock)}{" "}
                          {item.unitType || "un"} • Validade:{" "}
                          <strong>{formatIsoDateBr(item.expirationDate) || "-"}</strong>
                        </p>
                        <p className="text-xs text-text-secondary pdv-tabular">
                          Venda atual:{" "}
                          <strong className="text-text-primary">
                            R$ {formatMoneyBr(item.salePrice)}
                          </strong>{" "}
                          • Custo:{" "}
                          <strong className="text-text-primary">
                            {cost > 0 ? `R$ ${formatMoneyBr(cost)}` : "Não informado"}
                          </strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {cost > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProductId(item.id);
                              setProductSearch(item.name);
                              setShowProductOptions(false);
                              setUnitPriceInput(formatMoneyBr(cost));
                              setExpiringModalOpen(false);
                              window.setTimeout(() => {
                                qtyInputRef.current?.focus();
                                qtyInputRef.current?.select();
                              }, 0);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
                          >
                            <Tag size={13} />
                            Lançar a custo (R$ {formatMoneyBr(cost)})
                          </button>
                        ) : null}
                        {canUpdateToCost ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await productService.applyCostPrice(item.id);
                                await loadProducts();
                                Toast.success(`"${item.name}" atualizado para preço de custo.`);
                              } catch (error) {
                                Toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Erro ao atualizar preço.",
                                );
                              }
                            }}
                            className="rounded-lg border border-border-secondary px-2.5 py-1.5 text-xs font-medium text-text-primary transition hover:bg-hover-light"
                          >
                            Fixar preço no catálogo
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {receiptPreview ? (
          <ReceiptPreviewModal
            receipt={receiptPreview}
            formatMoney={formatMoneyBr}
            onClose={() => {
              setReceiptPreview(null);
              if (scannerAutoFocusEnabled) {
                focusProductInput();
              }
            }}
          />
        ) : null}

        {statusDialog.Dialog}
      </div>
    </HighVisibilityWrapper>
  );
}
