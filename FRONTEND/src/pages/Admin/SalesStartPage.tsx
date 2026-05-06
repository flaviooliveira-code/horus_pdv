/**
 * Arquivo: src/pages/Admin/SalesStartPage.tsx
 * Objetivo: implementa a frente de caixa com busca de produto, carrinho, fechamento e pagamento.
 * Entradas esperadas: recebe flag opcional de modo standalone para ajustar comportamento da aba PDV.
 */

import { Image as ImageIcon, Printer, ReceiptText, Search, Trash2, X } from "lucide-react";
import {
  type ClipboardEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SearchableSelectField } from "@/components/Form";
import { Toast, useStatusDialog } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import {
  cashRegisterService,
  type CashRegisterStatusDto,
} from "@/services/api/cashRegisterService";
import { companyService, type CompanyDto } from "@/services/api/companyService";
import { productService } from "@/services/api/productService";
import { salesHistoryService } from "@/services/api/salesHistoryService";
import { getPrintPreviewEnabled } from "@/utils/pdvPreferences";

type SalesStartPageProps = {
  onExit?: () => void;
  standalone?: boolean;
  operatorName?: string;
};

type Product = {
  id: string;
  name: string;
  code: string;
  stock: number;
  salePrice: number;
  imageUrl?: string;
};

type CartItem = {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type PaymentType = "dinheiro" | "pix" | "debito" | "credito";

type ReceiptItem = CartItem & {
  total: number;
};

type SaleReceipt = {
  saleNumber: string;
  issuedAt: string;
  company: Pick<
    CompanyDto,
    | "fantasyName"
    | "corporateName"
    | "cnpj"
    | "address"
    | "number"
    | "neighborhood"
    | "city"
    | "uf"
    | "phone"
    | "sacPhone"
  > | null;
  customerCpf: string;
  paymentType: PaymentType;
  paymentLabel: string;
  operatorName: string;
  subtotal: number;
  cashGiven: number;
  change: number;
  items: ReceiptItem[];
};

const PAYMENT_OPTIONS: Array<{ value: PaymentType; label: string }> = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debito", label: "Cartão Débito" },
  { value: "credito", label: "Cartão Crédito" },
];

const LAST_RECEIPT_STORAGE_KEY = "horus-pdv-last-receipt";

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

function formatReceiptDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCashElapsed(minutes?: number) {
  if (!minutes || minutes < 1) return "menos de 1 min";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}min`;
}

function ReceiptPreviewModal({
  receipt,
  formatMoney,
  onClose,
}: {
  receipt: SaleReceipt;
  formatMoney: (value: number) => string;
  onClose: () => void;
}) {
  const companyName =
    receipt.company?.fantasyName || receipt.company?.corporateName || "Hórus PDV";
  const companyAddress = [
    receipt.company?.address,
    receipt.company?.number,
    receipt.company?.neighborhood,
  ]
    .filter(Boolean)
    .join(", ");
  const companyCity = [receipt.company?.city, receipt.company?.uf].filter(Boolean).join(" - ");

  return (
    <div className="fixed inset-0 z-layer-dialog flex items-end bg-black/50 px-3 backdrop-blur-sm md:items-center md:justify-center">
      <div className="w-full max-w-xl rounded-t-2xl border border-border-primary bg-bg-light shadow-2xl md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <ReceiptText size={18} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Prévia de impressão</h2>
              <p className="text-xs text-text-secondary">Cupom da venda {receipt.saleNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-primary text-text-secondary hover:bg-hover-light"
            aria-label="Fechar prévia de impressão"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto bg-bg-primary p-4">
          <div className="mx-auto w-full max-w-[360px] border border-border-secondary bg-white px-5 py-4 font-mono text-[12px] leading-tight text-slate-950 shadow-sm">
            <div className="text-center">
              <p className="text-sm font-bold uppercase">{companyName}</p>
              <p>{receipt.company?.corporateName || companyName}</p>
              <p>CNPJ: {receipt.company?.cnpj || "-"}</p>
              {companyAddress ? <p>{companyAddress}</p> : null}
              {companyCity ? <p>{companyCity}</p> : null}
              <p>Telefone: {receipt.company?.phone || receipt.company?.sacPhone || "-"}</p>
            </div>

            <div className="my-3 border-t border-dashed border-slate-500" />

            <div className="space-y-1">
              <p>CUPOM NAO FISCAL</p>
              <p>Venda: {receipt.saleNumber}</p>
              <p>Emissao: {formatReceiptDate(receipt.issuedAt)}</p>
              <p>Operador: {receipt.operatorName}</p>
              <p>CPF/CNPJ consumidor: {receipt.customerCpf || "-"}</p>
            </div>

            <div className="my-3 border-t border-dashed border-slate-500" />

            <div className="grid grid-cols-[28px_1fr_44px_64px] gap-1 font-bold">
              <span>#</span>
              <span>ITEM</span>
              <span className="text-right">QTD</span>
              <span className="text-right">TOTAL</span>
            </div>
            <div className="mt-1 space-y-2">
              {receipt.items.map((item, index) => (
                <div key={`${item.id}-${index}`}>
                  <div className="grid grid-cols-[28px_1fr_44px_64px] gap-1">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span className="truncate">{item.name}</span>
                    <span className="text-right">{item.quantity}</span>
                    <span className="text-right">{formatMoney(item.total)}</span>
                  </div>
                  <p className="pl-7 text-[11px]">
                    {item.code} - UN {formatMoney(item.unitPrice)}
                  </p>
                </div>
              ))}
            </div>

            <div className="my-3 border-t border-dashed border-slate-500" />

            <div className="space-y-1">
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>R$ {formatMoney(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pagamento</span>
                <span>{receipt.paymentLabel}</span>
              </div>
              {receipt.paymentType === "dinheiro" ? (
                <>
                  <div className="flex justify-between">
                    <span>Valor recebido</span>
                    <span>R$ {formatMoney(receipt.cashGiven)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Troco</span>
                    <span>R$ {formatMoney(receipt.change)}</span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="my-3 border-t border-dashed border-slate-500" />
            <p className="text-center">Obrigado pela preferencia.</p>
          </div>
        </div>

        <div className="flex justify-end border-t border-border-primary px-4 py-3">
          <button type="button" onClick={onClose} className="btn-primary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SalesStartPage({
  standalone = false,
  operatorName = "Operador",
}: SalesStartPageProps) {
  const { formatMoneyBr, maskMoneyBr, parseMoneyBr, sanitizeIntegerInput } = useInputMasks();
  const statusDialog = useStatusDialog();
  const productInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const [now, setNow] = useState(new Date());
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [cashStatus, setCashStatus] = useState<CashRegisterStatusDto | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showProductOptions, setShowProductOptions] = useState(false);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const [quantityInput, setQuantityInput] = useState("1");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>("dinheiro");
  const [cpfNota, setCpfNota] = useState("");
  const [cashGiven, setCashGiven] = useState("");
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<SaleReceipt | null>(null);
  const [printPreviewEnabled, setPrintPreviewEnabled] = useState(() =>
    getPrintPreviewEnabled(),
  );

  const pasteCashGiven = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    setCashGiven(maskMoneyBr(event.clipboardData.getData("text")));
  };

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const quantity = useMemo(() => {
    const parsed = Number(quantityInput);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
  }, [quantityInput]);

  const filteredProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.code.toLowerCase().includes(normalized),
    );
  }, [products, productSearch]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  );
  const totalVolumes = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const cashGivenValue = parseMoneyBr(cashGiven || "0");
  const changeValue = paymentType === "dinheiro" ? Math.max(0, cashGivenValue - subtotal) : 0;

  const activeProductName =
    cart.length > 0 ? cart[cart.length - 1].name : selectedProduct?.name ?? "";

  const previewProduct = useMemo(() => {
    if (selectedProduct) return selectedProduct;
    const lastItem = cart[cart.length - 1];
    if (!lastItem) return null;
    return products.find((item) => item.id === lastItem.id) ?? null;
  }, [selectedProduct, products, cart]);

  const loadProducts = useCallback(async () => {
    const items = await productService.list();
    setProducts(
      items.map((item) => ({
        id: item.id,
        name: item.productName,
        code: item.productCode,
        stock: Number(item.productQnt || 0),
        salePrice: parseMoneyBr(item.productSalePrice || "0"),
        imageUrl: item.productImageUrl,
      })),
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
    const syncPrintPreviewPreference = () => setPrintPreviewEnabled(getPrintPreviewEnabled());
    const onCustomPreferenceChange = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setPrintPreviewEnabled(typeof enabled === "boolean" ? enabled : getPrintPreviewEnabled());
    };

    window.addEventListener("focus", syncPrintPreviewPreference);
    window.addEventListener("storage", syncPrintPreviewPreference);
    window.addEventListener("horus-pdv-print-preview-change", onCustomPreferenceChange);

    return () => {
      window.removeEventListener("focus", syncPrintPreviewPreference);
      window.removeEventListener("storage", syncPrintPreviewPreference);
      window.removeEventListener("horus-pdv-print-preview-change", onCustomPreferenceChange);
    };
  }, []);

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

  const selectProductOption = (product: Product) => {
    setSelectedProductId(product.id);
    setProductSearch(product.name);
    setShowProductOptions(false);
    setHighlightedProductIndex(0);
    qtyInputRef.current?.focus();
  };

  const addItem = useCallback(() => {
    const matchedFromSearch =
      selectedProduct ??
      filteredProducts.find(
        (item) =>
          item.name.toLowerCase() === productSearch.trim().toLowerCase() ||
          item.code.toLowerCase() === productSearch.trim().toLowerCase(),
      ) ??
      filteredProducts[0];

    if (!matchedFromSearch) {
      Toast.error("Selecione um produto.");
      return;
    }
    if (quantity > matchedFromSearch.stock) {
      Toast.error(`Estoque insuficiente. Disponível: ${matchedFromSearch.stock}.`);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === matchedFromSearch.id);
      if (!existing) {
        return [
          ...current,
          {
            id: matchedFromSearch.id,
            code: matchedFromSearch.code,
            name: matchedFromSearch.name,
            quantity,
            unitPrice: matchedFromSearch.salePrice,
          },
        ];
      }
      const nextQuantity = existing.quantity + quantity;
      if (nextQuantity > matchedFromSearch.stock) {
        Toast.error(`Estoque insuficiente para ${matchedFromSearch.name}.`);
        return current;
      }
      return current.map((item) =>
        item.id === matchedFromSearch.id ? { ...item, quantity: nextQuantity } : item,
      );
    });

    setSelectedProductId("");
    setProductSearch("");
    setShowProductOptions(false);
    setQuantityInput("1");
    productInputRef.current?.focus();
  }, [filteredProducts, productSearch, quantity, selectedProduct]);

  const removeItem = (id: string) => {
    setCart((current) => current.filter((item) => item.id !== id));
  };

  const saveLastReceipt = (receipt: SaleReceipt) => {
    setLastReceipt(receipt);
    try {
      window.localStorage.setItem(LAST_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
    } catch {
      // Mantem apenas em memoria caso o navegador bloqueie o armazenamento local.
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
    if (!confirmed) return;
    setCart([]);
    setCpfNota("");
    setCashGiven("");
    setCheckoutOpen(false);
    Toast.info("Venda cancelada.");
  }, [cart.length, statusDialog]);

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
    setCashGiven(formatMoneyBr(subtotal));
    setCheckoutOpen(true);
  }, [cart.length, formatMoneyBr, loadCashStatus, subtotal]);

  const confirmPayment = async () => {
    if (paymentType === "dinheiro" && cashGivenValue < subtotal) {
      Toast.error("Valor recebido menor que total.");
      return;
    }

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
        items: cart.map((item) => ({
          productCode: item.code,
          productName: item.name,
          quantity: item.quantity,
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
          total: item.quantity * item.unitPrice,
        })),
      };

      setCheckoutOpen(false);
      await loadProducts();
      saveLastReceipt(receipt);
      if (printPreviewEnabled) {
        setReceiptPreview(receipt);
      }
      Toast.success(`Pagamento confirmado. Venda ${receipt.saleNumber} registrada.`);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : "Erro ao registrar venda.");
      return;
    }

    setCart([]);
    setSelectedProductId("");
    setProductSearch("");
    setShowProductOptions(false);
    setQuantityInput("1");
    setPaymentType("dinheiro");
    setCpfNota("");
    setCashGiven("");
    window.setTimeout(() => productInputRef.current?.focus(), 0);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isInput = target?.tagName === "INPUT";

      if (event.key === "F2") {
        event.preventDefault();
        productInputRef.current?.focus();
      }
      if (event.key === "F4") {
        event.preventDefault();
        qtyInputRef.current?.focus();
      }
      if (event.key === "F8") {
        event.preventDefault();
        void cancelSale();
      }
      if (event.key === "F12") {
        event.preventDefault();
        if (!checkoutOpen) openPayment();
      }
      if (event.key === "Enter" && isInput && !checkoutOpen) {
        if (target === productInputRef.current && showProductOptions) {
          return;
        }
        if (target === productInputRef.current || target === qtyInputRef.current) {
          event.preventDefault();
          addItem();
        }
      }
      if (event.key === "Escape" && checkoutOpen) {
        event.preventDefault();
        setCheckoutOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addItem, cancelSale, checkoutOpen, openPayment, quantity, selectedProductId, cart.length, showProductOptions]);

  const { dateLabel, timeLabel } = formatDateTime(now);
  const cashCanSell = cashStatus?.canSell === true;
  const cashLabel = cashStatus
    ? cashCanSell
      ? `Caixa aberto por ${formatCashElapsed(cashStatus.currentSession?.elapsedMinutes)}`
      : cashStatus.blockReason || "Caixa fechado"
    : "Validando caixa...";

  return (
    <div className="h-[100dvh] overflow-y-auto bg-bg-primary p-1.5 md:overflow-hidden md:p-2">
      <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col overflow-visible rounded-2xl border border-border-primary bg-bg-light shadow-md md:h-full md:overflow-hidden">
        <header className="relative border-b border-border-secondary bg-accent px-4 py-3 text-text-light">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold italic leading-none md:text-4xl">Hórus PDV</h1>
              <p className="text-sm italic leading-none md:text-lg">Frente de Caixa</p>
            </div>
            <div className="text-right text-xs md:text-sm">
              <p className="capitalize">{dateLabel}</p>
              <p className="text-base font-semibold md:text-lg">{timeLabel}</p>
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="shrink-0 border-b border-border-primary bg-bg-gray-theme p-3.5 text-text-primary lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <label className="mb-2 block">
              <span className="mb-1 block text-xs font-semibold uppercase">Produto:</span>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
                <input
                  ref={productInputRef}
                  value={productSearch}
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setSelectedProductId("");
                    setShowProductOptions(true);
                    setHighlightedProductIndex(0);
                  }}
                  onFocus={() => {
                    // Evita reabrir o autocomplete automaticamente após adicionar item no mobile.
                    const hasSearch = productSearch.trim().length > 0;
                    setShowProductOptions(hasSearch);
                    if (hasSearch && filteredProducts.length > 0) setHighlightedProductIndex(0);
                  }}
                  onBlur={() => window.setTimeout(() => setShowProductOptions(false), 120)}
                  onKeyDown={(event) => {
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

                    if (event.key === "Enter") {
                      event.preventDefault();
                      const product = filteredProducts[highlightedProductIndex];
                      if (product) {
                        selectProductOption(product);
                      }
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      setShowProductOptions(false);
                    }
                  }}
                  className="input-field h-10 w-full pl-9 text-sm"
                  autoComplete="off"
                />
                {showProductOptions && (
                  <ul className="absolute left-0 right-0 top-full z-layer-popover mt-1 max-h-44 overflow-y-auto rounded-xl border border-border-secondary bg-bg-light text-text-primary shadow-lg">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((item, index) => (
                        <li
                          key={item.id}
                          className={`cursor-pointer border-b border-border-primary px-3 py-2 text-xs ${
                            highlightedProductIndex === index ? "bg-hover-light" : "hover:bg-hover-light"
                          }`}
                          onMouseEnter={() => setHighlightedProductIndex(index)}
                          onMouseDown={() => {
                            selectProductOption(item);
                          }}
                        >
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-[11px] text-text-secondary">{item.code}</p>
                        </li>
                      ))
                    ) : (
                      <li className="px-2 py-2 text-xs text-text-secondary">Nenhum produto encontrado.</li>
                    )}
                  </ul>
                )}
              </div>
            </label>

            <label className="mb-2 block">
              <span className="mb-1 block text-xs font-semibold uppercase">Quantidade (volume):</span>
              <input
                ref={qtyInputRef}
                value={quantityInput}
                inputMode="numeric"
                pattern="[0-9]*"
                onFocus={(event) => event.target.select()}
                onChange={(event) =>
                  setQuantityInput(sanitizeIntegerInput(event.target.value).slice(0, 4))
                }
                onBlur={() => {
                  if (!quantityInput || Number(quantityInput) < 1) setQuantityInput("1");
                }}
                className="input-field h-10 w-full text-lg font-semibold"
              />
            </label>

            <label className="mb-2 block">
              <span className="mb-1 block text-xs font-semibold uppercase">Preço unitário:</span>
              <input
                value={selectedProduct ? formatMoneyBr(selectedProduct.salePrice) : "0,00"}
                className="input-field h-10 w-full text-lg font-semibold"
                disabled
              />
            </label>

            <label className="mb-2 block">
              <span className="mb-1 block text-xs font-semibold uppercase">Preço total:</span>
              <input
                value={selectedProduct ? formatMoneyBr(selectedProduct.salePrice * quantity) : "0,00"}
                className="input-field h-10 w-full text-lg font-semibold"
                disabled
              />
            </label>

            <button
              type="button"
              onClick={addItem}
              className="btn-success h-10 w-full rounded-xl"
            >
              ADICIONAR ITEM (ENTER)
            </button>

            <div className="mt-2 border-t border-border-primary pt-2 text-sm">
              <p className="font-semibold">Total volumes: {String(totalVolumes).padStart(4, "0")}</p>
            </div>

            <div className="mt-3 hidden rounded-xl border border-border-primary bg-bg-light p-3 sm:block">
              <div className="mx-auto flex h-28 w-full max-w-[220px] items-center justify-center overflow-hidden rounded-xl border-2 border-border-secondary bg-bg-primary text-text-tertiary">
                {previewProduct?.imageUrl ? (
                  <img
                    src={previewProduct.imageUrl}
                    alt={previewProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-center">
                    <ImageIcon size={28} />
                    <span className="text-xs font-medium">Sem imagem</span>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="flex min-h-[55vh] flex-col bg-bg-light lg:min-h-0">
            <div className="grid grid-cols-1 gap-1 border-b border-border-primary bg-bg-gray-theme px-3 py-2 text-xs text-text-primary sm:grid-cols-[1fr_200px] sm:gap-0">
              <p>
                <span className="font-semibold">Empresa:</span>{" "}
                {company?.fantasyName || "Hórus PDV"}
              </p>
              <p className="sm:text-right">
                <span className="font-semibold">CNPJ:</span> {company?.cnpj || "-"}
              </p>
            </div>

            <div
              className={`border-b px-3 py-2 text-xs font-semibold ${
                cashCanSell
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-primary/20 bg-primary/10 text-primary"
              }`}
            >
              {cashLabel}
            </div>

            <div className="border-b border-border-primary px-3 py-3">
              <p className="text-xs font-semibold">Nome produto:</p>
              <h2 className="text-center font-display text-xl font-semibold leading-none tracking-tight text-text-primary md:text-3xl">
                {activeProductName || "AGUARDANDO PRODUTO"}
              </h2>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
              <p className="mb-1 text-sm font-semibold">Lista de itens:</p>
              <div className="min-h-[180px] flex-1 overflow-auto rounded-xl border border-dashed border-border-secondary bg-bg-primary md:min-h-0">
                {cart.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-text-secondary">
                    Nenhum item no cupom.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 p-2 md:hidden">
                      {cart.map((item, index) => {
                        const total = item.quantity * item.unitPrice;
                        return (
                          <article
                            key={item.id}
                            className="rounded-xl border border-border-primary bg-bg-light p-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-text-secondary">
                                  Item #{index + 1} • {item.code}
                                </p>
                                <p className="truncate text-sm font-semibold text-text-primary">
                                  {item.name}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-white"
                                aria-label={`Remover ${item.name}`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <p className="text-text-secondary">Qtd</p>
                                <p className="font-semibold text-text-primary">{item.quantity}</p>
                              </div>
                              <div>
                                <p className="text-text-secondary">Vl. Unit</p>
                                <p className="font-semibold text-text-primary">
                                  {formatMoneyBr(item.unitPrice)}
                                </p>
                              </div>
                              <div>
                                <p className="text-text-secondary">Vl. Total</p>
                                <p className="font-semibold text-text-primary">
                                  {formatMoneyBr(total)}
                                </p>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <table className="hidden min-w-[720px] w-full text-sm leading-[1.25] md:table md:text-base">
                      <thead>
                        <tr className="border-b border-border-primary bg-bg-gray-theme text-[11px] uppercase text-text-secondary md:text-xs">
                          <th className="w-12 px-2 py-1 text-center">#</th>
                          <th className="w-28 px-2 py-1 text-left">Código</th>
                          <th className="px-2 py-1 text-left">Produto</th>
                          <th className="w-16 px-2 py-1 text-center">Qtd</th>
                          <th className="w-32 px-2 py-1 text-right">Vl. Unit</th>
                          <th className="w-32 px-2 py-1 text-right">Vl. Total</th>
                          <th className="w-12 px-1 py-1 text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item, index) => {
                          const total = item.quantity * item.unitPrice;
                          return (
                            <tr key={item.id} className="border-b border-border-primary">
                              <td className="w-12 px-2 py-1 text-center">{index + 1}</td>
                              <td className="w-28 px-2 py-1">{item.code}</td>
                              <td className="px-2 py-1">{item.name}</td>
                              <td className="w-16 px-2 py-1 text-center">{item.quantity}</td>
                              <td className="w-32 px-2 py-1 text-right">{formatMoneyBr(item.unitPrice)}</td>
                              <td className="w-32 px-2 py-1 text-right">{formatMoneyBr(total)}</td>
                              <td className="w-12 px-1 py-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.id)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-white"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>

            <div className="md:sticky md:bottom-0 md:z-10 md:shadow-[0_-8px_18px_rgba(15,23,42,0.08)]">
              <div className="border-t border-border-primary bg-bg-gray-theme px-3 py-1.5 text-sm text-text-primary">00 - Ajuda</div>

              <div className="grid grid-cols-[1fr_160px] border-t border-border-primary md:grid-cols-[1fr_220px]">
                <div className="bg-bg-gray-theme px-3 py-2 text-right text-sm font-semibold uppercase text-text-primary">
                  SUB TOTAL:
                </div>
                <div className="bg-accent px-3 py-2 text-right font-display text-3xl font-bold text-text-light md:text-4xl">
                  R$ {formatMoneyBr(subtotal)}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 border-t border-border-primary px-3 py-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={cancelSale}
                  className="btn-cancel h-11 w-full rounded-xl"
                >
                  ✖ CANCELAR (F8)
                </button>
                <button
                  type="button"
                  onClick={printLastSale}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-secondary px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
                >
                  <Printer size={16} />
                  Imprimir última venda
                </button>
                <button
                  type="button"
                  onClick={openPayment}
                  className="btn-success h-11 w-full rounded-xl disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!cashCanSell}
                >
                  PAGAMENTO (F12)
                </button>
              </div>

              <footer className="space-y-0.5 border-t border-border-primary bg-bg-primary px-3 py-2 text-[11px] text-text-secondary sm:grid sm:grid-cols-3 sm:items-center sm:space-y-0 sm:text-xs">
                <p>Usuário: {operatorName}</p>
                <p className="sm:text-center">
                  Estabelecimento: {company?.fantasyName || "Hórus PDV"}
                </p>
                <p className="sm:text-right">
                  Prévia impressão: {printPreviewEnabled ? "Sim" : "Não"} • Caixa:{" "}
                  {cashCanSell ? "PDV01 aberto" : "bloqueado"}
                </p>
              </footer>
            </div>
          </section>
        </main>
      </div>

      {checkoutOpen && (
        <div className="fixed inset-0 z-layer-modal flex items-end bg-black/45 md:items-center md:justify-center">
          <div className="w-full rounded-t-2xl border border-border-primary bg-bg-light p-4 md:max-w-xl md:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Pagamento</h2>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-primary text-text-secondary"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm text-text-secondary">CPF na nota (opcional)</span>
                <input
                  value={cpfNota}
                  onChange={(event) => setCpfNota(event.target.value)}
                  className="input-field w-full"
                  placeholder="Somente se cliente pedir"
                />
              </label>

              <SearchableSelectField
                label="Forma de pagamento"
                value={paymentType}
                options={PAYMENT_OPTIONS}
                onChange={(nextValue) => setPaymentType(nextValue as PaymentType)}
                getOptionValue={(option) => option.value}
                getOptionLabel={(option) => option.label}
                placeholder="Selecione a forma de pagamento"
                emptyMessage="Forma de pagamento não encontrada."
              />

              {paymentType === "dinheiro" && (
                <label className="block">
                  <span className="mb-1.5 block text-sm text-text-secondary">Valor recebido</span>
                  <input
                    value={cashGiven}
                    inputMode="numeric"
                    pattern="[0-9,.]*"
                    onBeforeInput={preventNonDigitBeforeInput}
                    onPaste={pasteCashGiven}
                    onChange={(event) => setCashGiven(maskMoneyBr(event.target.value))}
                    className="input-field w-full"
                    placeholder="0,00"
                  />
                </label>
              )}

              <div className="rounded-xl border border-border-primary bg-bg-primary p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Total</span>
                  <span className="font-semibold text-text-primary">R$ {formatMoneyBr(subtotal)}</span>
                </div>
                {paymentType === "dinheiro" && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-text-secondary">Troco</span>
                    <span className="font-semibold text-success">R$ {formatMoneyBr(changeValue)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setCheckoutOpen(false)} className="btn-cancel">
                Voltar
              </button>
              <button type="button" onClick={confirmPayment} className="btn-success">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptPreview ? (
        <ReceiptPreviewModal
          receipt={receiptPreview}
          formatMoney={formatMoneyBr}
          onClose={() => setReceiptPreview(null)}
        />
      ) : null}

      {statusDialog.Dialog}
    </div>
  );
}
