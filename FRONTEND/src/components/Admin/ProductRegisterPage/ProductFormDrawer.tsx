/**
 * Arquivo: src/components/Admin/ProductRegisterPage/ProductFormDrawer.tsx
 * Objetivo: formulário rápido e flexível de cadastro/edição de produtos com busca automática por código de barras,
 * categorias com fixação, atalhos de teclado e cadastro contínuo ("Salvar e novo").
 * Entradas esperadas: estado do formulário, listas de categorias/fornecedores e callbacks de persistência.
 */

import {
  AlertTriangle,
  Barcode,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Pin,
  PinOff,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SearchableSelectField } from "@/components/Form";
import LoadingButton from "@/components/Loading/LoadingButton";
import AddressContactFields from "@/components/Register/AddressContactFields";
import { Toast } from "@/hooks/Dialog";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import { productService } from "@/services/api/productService";
import { type SupplierPayload } from "@/services/api/supplierService";
import { lookupAddressByCep } from "@/utils/cepLookup";
import { onlyDigits } from "@/utils/inputMasks";
import {
  computeEffectiveExpirationDate,
  DEFAULT_SHELF_LIFE_DAYS,
  evaluateProductExpiration,
  formatIsoDateBr,
  getTodayIsoDate,
} from "@/utils/productExpiration";
import { canOverrideFixedPrice, getStoredUserRole } from "@/utils/roles";
import { isValidCnpj, isValidEmail } from "@/utils/validators";

export type ProductFormItem = {
  id: string;
  productImageUrl: string;
  productImageName: string;
  productName: string;
  productCode: string;
  productSupplier: string;
  productCategory: string;
  productDescription: string;
  productQnt: string;
  productUnitPrice: string;
  productSalePrice: string;
  totalPriceOnProduct: string;
  unitType: "UN" | "KG";
  expirationMode: "" | "FIXED_DATE" | "DAYS_FROM_MANUFACTURE";
  manufactureDate: string;
  shelfLifeDays: number | null;
  expirationDate: string;
  expirationStatus?: "NONE" | "OK" | "EXPIRING_SOON" | "EXPIRED";
  daysUntilExpiration?: number | null;
};

export type ProductFormData = Omit<
  ProductFormItem,
  "id" | "expirationStatus" | "daysUntilExpiration"
>;
export type QuickSupplierDraft = SupplierPayload;

const EMPTY_SUPPLIER_DRAFT: QuickSupplierDraft = {
  companyName: "",
  fantasyName: "",
  cnpj: "",
  cep: "",
  city: "",
  state: "",
  address: "",
  neighborhood: "",
  streetComplement: "",
  number: "",
  referencePoint: "",
  telephone: "",
  cellphone: "",
  email: "",
};

type LookupFeedback =
  | { status: "idle" }
  | { status: "loading"; code: string }
  | { status: "found"; source: string; filledFields: string[] }
  | { status: "not_found"; code: string }
  | { status: "duplicate"; existing: ProductFormItem };

function preventNonDigitBeforeInput(event: FormEvent<HTMLInputElement>) {
  const data = (event.nativeEvent as InputEvent).data ?? "";
  if (data && /\D/.test(data)) {
    event.preventDefault();
  }
}

export default function ProductFormDrawer({
  open,
  isEditMode,
  editingId,
  value,
  isSaving,
  focusResetToken,
  pinCategory,
  onTogglePinCategory,
  onClose,
  onChange,
  onSave,
  onEditExisting,
  existingProducts,
  categoryOptions,
  supplierOptions,
  onCreateSupplier,
}: {
  open: boolean;
  isEditMode: boolean;
  editingId: string | null;
  value: ProductFormData;
  isSaving: boolean;
  focusResetToken: number;
  pinCategory: boolean;
  onTogglePinCategory: () => void;
  onClose: () => void;
  onChange: (next: ProductFormData) => void;
  onSave: (options?: { keepOpen?: boolean }) => void;
  onEditExisting: (product: ProductFormItem) => void;
  existingProducts: ProductFormItem[];
  categoryOptions: string[];
  supplierOptions: string[];
  onCreateSupplier: (draft: QuickSupplierDraft) => Promise<string | null>;
}) {
  const {
    maskCnpj,
    maskMoneyBr,
    parseMoneyBr,
    formatMoneyBr,
    sanitizeDecimalInput,
  } = useInputMasks();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const categoryInputRef = useRef<HTMLInputElement | null>(null);
  const salePriceInputRef = useRef<HTMLInputElement | null>(null);
  const qntInputRef = useRef<HTMLInputElement | null>(null);
  const unitPriceInputRef = useRef<HTMLInputElement | null>(null);

  const latestValueRef = useRef(value);
  const lastLookedUpCodeRef = useRef(isEditMode ? value.productCode.trim() : "");
  const lookupRequestIdRef = useRef(0);

  const [isDragActive, setIsDragActive] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(() =>
    Boolean(
      value.productSupplier.trim() ||
        value.productDescription.trim() ||
        value.unitType === "KG",
    ),
  );
  const [lookupFeedback, setLookupFeedback] = useState<LookupFeedback>({ status: "idle" });
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState<QuickSupplierDraft>(EMPTY_SUPPLIER_DRAFT);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [loadingSupplierCep, setLoadingSupplierCep] = useState(false);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => {
      codeInputRef.current?.focus();
      codeInputRef.current?.select();
    }, 0);
  }, [open, focusResetToken]);

  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (supplierModalOpen) {
          setSupplierModalOpen(false);
        } else {
          onClose();
        }
        return;
      }

      if (supplierModalOpen) return;

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (!isSaving) {
          onSave({ keepOpen: !isEditMode });
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!isSaving) {
          onSave({ keepOpen: false });
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open, supplierModalOpen, isSaving, isEditMode, onClose, onSave]);

  const setField = useCallback(
    <K extends keyof ProductFormData>(key: K, fieldValue: ProductFormData[K]) => {
      const next = { ...latestValueRef.current, [key]: fieldValue };
      const quantity = Number(String(next.productQnt || "0").replace(",", "."));
      const unitPrice = parseMoneyBr(next.productUnitPrice);
      next.totalPriceOnProduct =
        Number.isFinite(quantity) && quantity > 0 && unitPrice > 0
          ? formatMoneyBr(quantity * unitPrice)
          : "";
      latestValueRef.current = next;
      onChange(next);
    },
    [formatMoneyBr, onChange, parseMoneyBr],
  );

  const runBarcodeLookup = useCallback(
    async (rawCode: string, options?: { force?: boolean; advanceFocus?: boolean }) => {
      const trimmed = rawCode.trim();
      const digits = onlyDigits(trimmed);

      if (!trimmed) {
        setLookupFeedback({ status: "idle" });
        if (options?.advanceFocus) {
          nameInputRef.current?.focus();
        }
        return;
      }

      const duplicate = existingProducts.find(
        (item) =>
          item.id !== editingId &&
          item.productCode.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) {
        setLookupFeedback({ status: "duplicate", existing: duplicate });
        return;
      }

      if (digits.length < 8 || digits.length > 14) {
        if (options?.force) {
          Toast.info("Digite ou bipe um código de barras (8 a 14 dígitos) para buscar online.");
        }
        if (options?.advanceFocus) {
          nameInputRef.current?.focus();
        }
        return;
      }

      if (!options?.force && lastLookedUpCodeRef.current === digits) {
        if (options?.advanceFocus) {
          if (latestValueRef.current.productName.trim()) {
            salePriceInputRef.current?.focus();
          } else {
            nameInputRef.current?.focus();
          }
        }
        return;
      }

      lastLookedUpCodeRef.current = digits;
      const requestId = ++lookupRequestIdRef.current;
      setLookupFeedback({ status: "loading", code: digits });

      if (options?.advanceFocus) {
        nameInputRef.current?.focus();
      }

      try {
        const result = await productService.lookupBarcode(digits);
        if (requestId !== lookupRequestIdRef.current) return;

        if (!result || !result.found) {
          setLookupFeedback({ status: "not_found", code: digits });
          return;
        }

        const current = latestValueRef.current;
        const next: ProductFormData = { ...current };
        const filledFields: string[] = [];

        if (!current.productName.trim() && result.productName) {
          next.productName = result.productName;
          filledFields.push("nome");
        }
        if (!current.productCategory.trim() && result.productCategory) {
          next.productCategory = result.productCategory;
          filledFields.push("categoria");
        }
        if (!current.productDescription.trim() && result.productDescription) {
          next.productDescription = result.productDescription;
          filledFields.push("descrição");
        }
        if (!current.productImageUrl.trim() && result.productImageUrl) {
          next.productImageUrl = result.productImageUrl;
          next.productImageName = `Catálogo (${result.source})`;
          filledFields.push("imagem");
        }
        if (
          !current.productSalePrice.trim() &&
          typeof result.suggestedSalePrice === "number" &&
          result.suggestedSalePrice > 0
        ) {
          next.productSalePrice = formatMoneyBr(result.suggestedSalePrice);
          filledFields.push("preço sugerido");
        }

        if (filledFields.length > 0) {
          latestValueRef.current = next;
          onChange(next);
          if (
            options?.advanceFocus &&
            document.activeElement === nameInputRef.current &&
            filledFields.includes("nome")
          ) {
            salePriceInputRef.current?.focus();
            salePriceInputRef.current?.select();
          }
        }

        setLookupFeedback({
          status: "found",
          source: result.source || "catálogo online",
          filledFields,
        });
      } catch {
        if (requestId !== lookupRequestIdRef.current) return;
        setLookupFeedback({ status: "not_found", code: digits });
      }
    },
    [editingId, existingProducts, formatMoneyBr, onChange],
  );

  const marginPercent = useMemo(() => {
    const cost = parseMoneyBr(value.productUnitPrice);
    const sale = parseMoneyBr(value.productSalePrice);
    if (cost <= 0 || sale <= 0) return null;
    return Math.round(((sale - cost) / cost) * 100);
  }, [parseMoneyBr, value.productSalePrice, value.productUnitPrice]);

  const effectiveExpirationDate = useMemo(
    () =>
      computeEffectiveExpirationDate({
        expirationMode: value.expirationMode,
        manufactureDate: value.manufactureDate,
        shelfLifeDays: value.shelfLifeDays,
        expirationDate: value.expirationDate,
      }),
    [value.expirationDate, value.expirationMode, value.manufactureDate, value.shelfLifeDays],
  );

  const expirationEvaluation = useMemo(
    () => evaluateProductExpiration(effectiveExpirationDate),
    [effectiveExpirationDate],
  );

  const supplierMissingFields = useMemo(() => {
    const missing: string[] = [];
    if (!supplierDraft.cnpj.trim()) missing.push("CNPJ");
    if (!supplierDraft.cellphone.trim() && !supplierDraft.telephone.trim()) missing.push("Contato");
    if (!supplierDraft.address.trim() && !supplierDraft.city.trim()) missing.push("Endereço");
    return missing;
  }, [supplierDraft]);

  if (!open) return null;

  const applyImage = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const next = {
        ...latestValueRef.current,
        productImageName: file.name,
        productImageUrl: result,
      };
      latestValueRef.current = next;
      onChange(next);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    const next = {
      ...latestValueRef.current,
      productImageName: "",
      productImageUrl: "",
    };
    latestValueRef.current = next;
    onChange(next);
  };

  const setMoneyField = (
    key: "productUnitPrice" | "productSalePrice",
    fieldValue: string,
  ) => {
    setField(key, maskMoneyBr(fieldValue));
  };

  const pasteMoneyField = (
    event: ClipboardEvent<HTMLInputElement>,
    key: "productUnitPrice" | "productSalePrice",
  ) => {
    event.preventDefault();
    setMoneyField(key, event.clipboardData.getData("text"));
  };

  const applyMarkup = (percent: number) => {
    const cost = parseMoneyBr(value.productUnitPrice);
    if (cost <= 0) return;
    const suggestedSale = cost * (1 + percent / 100);
    setField("productSalePrice", formatMoneyBr(suggestedSale));
  };

  const applyCostPriceToSale = () => {
    const cost = parseMoneyBr(value.productUnitPrice);
    if (cost <= 0) return;
    setField("productSalePrice", formatMoneyBr(cost));
  };

  const selectExpirationMode = (nextMode: "" | "FIXED_DATE" | "DAYS_FROM_MANUFACTURE") => {
    const current = latestValueRef.current;
    if (nextMode === "") {
      const next: ProductFormData = {
        ...current,
        expirationMode: "",
        manufactureDate: "",
        shelfLifeDays: null,
        expirationDate: "",
      };
      latestValueRef.current = next;
      onChange(next);
      return;
    }

    if (nextMode === "FIXED_DATE") {
      const preservedDate =
        computeEffectiveExpirationDate(current) || current.expirationDate || "";
      const next: ProductFormData = {
        ...current,
        expirationMode: "FIXED_DATE",
        manufactureDate: "",
        shelfLifeDays: null,
        expirationDate: preservedDate,
      };
      latestValueRef.current = next;
      onChange(next);
      return;
    }

    const manufactureDate = current.manufactureDate || getTodayIsoDate();
    const shelfLifeDays =
      current.shelfLifeDays && current.shelfLifeDays > 0
        ? current.shelfLifeDays
        : DEFAULT_SHELF_LIFE_DAYS;
    const computedDate = computeEffectiveExpirationDate({
      expirationMode: "DAYS_FROM_MANUFACTURE",
      manufactureDate,
      shelfLifeDays,
    });
    const next: ProductFormData = {
      ...current,
      expirationMode: "DAYS_FROM_MANUFACTURE",
      manufactureDate,
      shelfLifeDays,
      expirationDate: computedDate,
    };
    latestValueRef.current = next;
    onChange(next);
  };

  const updateExpirationDateField = (nextDate: string) => {
    const next: ProductFormData = {
      ...latestValueRef.current,
      expirationMode: "FIXED_DATE",
      manufactureDate: "",
      shelfLifeDays: null,
      expirationDate: nextDate,
    };
    latestValueRef.current = next;
    onChange(next);
  };

  const updateManufactureExpiration = (nextManufactureDate: string, nextDays: number | null) => {
    const resolvedDays = nextDays && nextDays > 0 ? nextDays : DEFAULT_SHELF_LIFE_DAYS;
    const computedDate = computeEffectiveExpirationDate({
      expirationMode: "DAYS_FROM_MANUFACTURE",
      manufactureDate: nextManufactureDate,
      shelfLifeDays: resolvedDays,
    });
    const next: ProductFormData = {
      ...latestValueRef.current,
      expirationMode: "DAYS_FROM_MANUFACTURE",
      manufactureDate: nextManufactureDate,
      shelfLifeDays: resolvedDays,
      expirationDate: computedDate,
    };
    latestValueRef.current = next;
    onChange(next);
  };

  const handleEnterNext = (
    event: ReactKeyboardEvent<HTMLInputElement>,
    nextRef?: React.RefObject<HTMLInputElement | null>,
    options?: { submitOnEnter?: boolean },
  ) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (nextRef?.current) {
      nextRef.current.focus();
      nextRef.current.select?.();
      return;
    }
    if (options?.submitOnEnter && !isSaving) {
      onSave({ keepOpen: !isEditMode });
    }
  };

  const openSupplierModal = (searchTerm = "") => {
    const name = searchTerm || value.productSupplier;
    setSupplierDraft({
      ...EMPTY_SUPPLIER_DRAFT,
      fantasyName: name,
    });
    setSupplierModalOpen(true);
  };

  const setSupplierField = <K extends keyof QuickSupplierDraft>(
    key: K,
    fieldValue: QuickSupplierDraft[K],
  ) => {
    setSupplierDraft((current) => ({ ...current, [key]: fieldValue }));
  };

  const fillSupplierAddressFromCep = async () => {
    if (onlyDigits(supplierDraft.cep).length !== 8) {
      Toast.error("CEP inválido.");
      return;
    }

    setLoadingSupplierCep(true);
    const result = await lookupAddressByCep(supplierDraft.cep);
    setLoadingSupplierCep(false);

    if (!result.success) {
      Toast.error("CEP não encontrado.");
      return;
    }

    setSupplierDraft((current) => ({
      ...current,
      address: result.data.endereco || current.address,
      neighborhood: result.data.bairro || current.neighborhood,
      city: result.data.cidade || current.city,
      state: result.data.estado || current.state,
      streetComplement: result.data.complemento || current.streetComplement,
    }));
  };

  const validateSupplierDraft = () => {
    const fantasyName = supplierDraft.fantasyName.trim();
    const companyName = supplierDraft.companyName.trim();
    if (fantasyName.length < 2 && companyName.length < 2) {
      Toast.error("Informe pelo menos o nome fantasia ou a razão social (mínimo 2 caracteres).");
      return false;
    }

    if (onlyDigits(supplierDraft.cnpj).length > 0 && !isValidCnpj(supplierDraft.cnpj)) {
      Toast.error("CNPJ inválido. Deixe em branco se o fornecedor for informal.");
      return false;
    }

    if (!isValidEmail(supplierDraft.email)) {
      Toast.error("E-mail inválido.");
      return false;
    }

    return true;
  };

  const submitSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateSupplierDraft()) return;

    setSavingSupplier(true);
    try {
      const createdName = await onCreateSupplier(supplierDraft);
      if (createdName) {
        setField("productSupplier", createdName);
        setSupplierModalOpen(false);
        setSupplierDraft(EMPTY_SUPPLIER_DRAFT);
      }
    } finally {
      setSavingSupplier(false);
    }
  };

  const costValue = parseMoneyBr(value.productUnitPrice);
  // Alterar preço de produto já cadastrado exige administrador ou gerente (a API recusa os demais perfis).
  const pricesLocked = isEditMode && !canOverrideFixedPrice(getStoredUserRole());
  const lockedPriceTitle = pricesLocked
    ? "Somente administrador ou gerente pode alterar o preço de um produto cadastrado."
    : undefined;

  return (
    <div className="dept-drawer-overlay" onClick={onClose}>
      <aside className="dept-drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border-primary p-5">
          <div>
            <h3 className="text-xl font-semibold text-text-primary">
              {isEditMode ? "Editar produto" : "Cadastro rápido de produto"}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Bipe o código de barras para tentar preencher dados e imagem automaticamente, ou informe apenas o nome (o preço pode ser fixo ou avulso no caixa).
            </p>
          </div>
          <button
            type="button"
            tabIndex={-1}
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
            aria-label="Fechar formulário"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Bloco principal: código de barras + foto compacta + dados essenciais */}
          <section className="card rounded-2xl p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* Miniatura compacta (fora do fluxo de Tab principal) */}
              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragActive(false);
                  applyImage(event.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed p-2.5 transition sm:w-32 ${
                  isDragActive
                    ? "border-accent bg-accent/10"
                    : "border-border-secondary bg-bg-primary/50"
                }`}
              >
                <div className="h-20 w-20 overflow-hidden rounded-xl border border-border-primary bg-bg-light shadow-sm">
                  {value.productImageUrl ? (
                    <img
                      src={value.productImageUrl}
                      alt="Pré-visualização do produto"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-1 text-center text-xs text-text-tertiary">
                      Sem foto
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => applyImage(event.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-secondary px-2 py-1 text-xs font-medium text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
                    title="Enviar imagem do computador ou arraste aqui"
                  >
                    <Upload size={12} />
                    Foto
                  </button>
                  {value.productImageUrl ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={clearImage}
                      className="inline-flex items-center justify-center rounded-lg border border-border-secondary p-1 text-text-secondary transition hover:border-red-400 hover:text-red-500"
                      title="Remover imagem"
                      aria-label="Remover imagem"
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Campos principais na ordem ideal de leitura + Tab */}
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between text-sm text-text-secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <Barcode size={14} className="text-accent" />
                        Código de barras (opcional)
                      </span>
                      <span className="text-[11px] text-text-tertiary">
                        Vazio = código interno automático
                      </span>
                    </span>
                    <div className="flex gap-2">
                      <input
                        ref={codeInputRef}
                        value={value.productCode}
                        onChange={(event) => {
                          setField("productCode", event.target.value);
                          if (lookupFeedback.status !== "idle") {
                            setLookupFeedback({ status: "idle" });
                          }
                        }}
                        onBlur={(event) => {
                          void runBarcodeLookup(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void runBarcodeLookup(value.productCode, {
                              force: onlyDigits(value.productCode).length >= 8,
                              advanceFocus: true,
                            });
                          }
                        }}
                        className="input-field w-full"
                        placeholder="Bipe ou digite o código (ou deixe vazio)"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => void runBarcodeLookup(value.productCode, { force: true })}
                        disabled={lookupFeedback.status === "loading"}
                        className="btn-outline-secondary inline-flex shrink-0 items-center gap-1.5 px-3 text-xs"
                        title="Pesquisar nome, categoria e imagem na internet pelo código de barras"
                      >
                        {lookupFeedback.status === "loading" ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                          <Search size={14} />
                        )}
                        Buscar
                      </button>
                    </div>
                  </label>

                  {lookupFeedback.status === "loading" ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-accent">
                      <LoaderCircle size={13} className="animate-spin" />
                      Buscando informações e imagem para {lookupFeedback.code}...
                    </p>
                  ) : null}

                  {lookupFeedback.status === "found" ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <Sparkles size={13} />
                      {lookupFeedback.filledFields.length > 0
                        ? `Preenchido via ${lookupFeedback.source}: ${lookupFeedback.filledFields.join(", ")}.`
                        : `Código encontrado via ${lookupFeedback.source} (campos já estavam preenchidos).`}
                    </p>
                  ) : null}

                  {lookupFeedback.status === "not_found" ? (
                    <p className="mt-1.5 text-xs text-text-tertiary">
                      Não encontrado nas bases públicas para {lookupFeedback.code}. Preencha os dados manualmente.
                    </p>
                  ) : null}

                  {lookupFeedback.status === "duplicate" ? (
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">
                      <span>
                        Já cadastrado como <strong>{lookupFeedback.existing.productName}</strong>.
                      </span>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => onEditExisting(lookupFeedback.existing)}
                        className="font-semibold underline hover:opacity-80"
                      >
                        Editar existente
                      </button>
                    </div>
                  ) : null}
                </div>

                <label className="block">
                  <span className="mb-1 block text-sm text-text-secondary">
                    Nome do Produto *
                  </span>
                  <input
                    ref={nameInputRef}
                    value={value.productName}
                    onChange={(event) => setField("productName", event.target.value)}
                    onKeyDown={(event) => handleEnterNext(event, categoryInputRef)}
                    className="input-field w-full"
                    placeholder="Ex.: Coca-Cola 2L, Pão Francês, Bolo Caseiro..."
                  />
                </label>

                <div className="flex items-end gap-2">
                  <SearchableSelectField
                    label="Categoria (opcional)"
                    value={value.productCategory}
                    options={categoryOptions}
                    onChange={(nextValue) => setField("productCategory", nextValue)}
                    getOptionValue={(category) => category}
                    getOptionLabel={(category) => category}
                    placeholder="Escolha ou digite uma nova categoria"
                    emptyMessage="Digite para criar uma categoria."
                    allowCustomValue
                    inputRef={categoryInputRef}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        window.setTimeout(() => {
                          salePriceInputRef.current?.focus();
                          salePriceInputRef.current?.select();
                        }, 0);
                      }
                    }}
                    className="min-w-0 flex-1"
                  />
                  {!isEditMode ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={onTogglePinCategory}
                      title={
                        pinCategory
                          ? "Categoria fixada para os próximos cadastros (clique para soltar)"
                          : "Fixar esta categoria ao usar Salvar e novo"
                      }
                      className={`inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition ${
                        pinCategory
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border-secondary text-text-secondary hover:bg-hover-light hover:text-text-primary"
                      }`}
                    >
                      {pinCategory ? <Pin size={14} /> : <PinOff size={14} />}
                      <span className="hidden sm:inline">{pinCategory ? "Fixada" : "Fixar"}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* Preço e estoque */}
          <section className="card rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-text-secondary">Preço e estoque</h4>
              {marginPercent !== null ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    marginPercent >= 0
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-500/15 text-red-700 dark:text-red-300"
                  }`}
                >
                  Margem sobre custo: {marginPercent >= 0 ? `+${marginPercent}%` : `${marginPercent}%`}
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm text-text-secondary">
                  Preço de Venda (opcional)
                </span>
                <input
                  ref={salePriceInputRef}
                  value={value.productSalePrice}
                  readOnly={pricesLocked}
                  title={lockedPriceTitle}
                  inputMode="numeric"
                  pattern="[0-9,.]*"
                  onBeforeInput={preventNonDigitBeforeInput}
                  onPaste={(event) => pasteMoneyField(event, "productSalePrice")}
                  onChange={(event) => setMoneyField("productSalePrice", event.target.value)}
                  onKeyDown={(event) => handleEnterNext(event, qntInputRef)}
                  className="input-field w-full"
                  placeholder="Avulso no caixa"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-text-secondary">
                  Estoque (opcional)
                </span>
                <input
                  ref={qntInputRef}
                  value={value.productQnt}
                  inputMode="decimal"
                  onChange={(event) =>
                    setField("productQnt", sanitizeDecimalInput(event.target.value, 3).slice(0, 12))
                  }
                  onKeyDown={(event) => handleEnterNext(event, unitPriceInputRef)}
                  className="input-field w-full"
                  placeholder="0"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-text-secondary">
                  Preço de Custo (opcional)
                </span>
                <input
                  ref={unitPriceInputRef}
                  value={value.productUnitPrice}
                  readOnly={pricesLocked}
                  title={lockedPriceTitle}
                  inputMode="numeric"
                  pattern="[0-9,.]*"
                  onBeforeInput={preventNonDigitBeforeInput}
                  onPaste={(event) => pasteMoneyField(event, "productUnitPrice")}
                  onChange={(event) => setMoneyField("productUnitPrice", event.target.value)}
                  onKeyDown={(event) =>
                    handleEnterNext(event, undefined, { submitOnEnter: !isEditMode })
                  }
                  className="input-field w-full"
                  placeholder="0,00"
                />
              </label>
            </div>

            {pricesLocked ? (
              <p className="mt-2 text-xs text-text-tertiary">
                Preços bloqueados: somente administrador ou gerente pode alterar o preço de um produto cadastrado.
              </p>
            ) : costValue > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
                <span>Aplicar margem ao preço de venda:</span>
                {[30, 50, 80, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    tabIndex={-1}
                    onClick={() => applyMarkup(pct)}
                    className="rounded-lg border border-border-secondary px-2 py-0.5 font-medium transition hover:border-accent hover:text-accent"
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-tertiary">
                Deixe o preço de venda vazio para definir o valor avulso na frente de caixa (ideal para produtos fatiados ou variáveis).
              </p>
            )}
          </section>

          {/* Validade / Vencimento */}
          <section className="card rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock size={16} className="text-text-secondary" />
                <h4 className="text-sm font-semibold text-text-secondary">
                  Validade / Vencimento (opcional)
                </h4>
              </div>
              {effectiveExpirationDate ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    expirationEvaluation.status === "EXPIRED"
                      ? "bg-rose-500/15 text-rose-500"
                      : expirationEvaluation.status === "EXPIRING_SOON"
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  }`}
                >
                  Vence em {formatIsoDateBr(effectiveExpirationDate)}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => selectExpirationMode("")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  !value.expirationMode
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border-secondary text-text-secondary hover:bg-hover-light hover:text-text-primary"
                }`}
              >
                Sem validade
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => selectExpirationMode("FIXED_DATE")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  value.expirationMode === "FIXED_DATE"
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border-secondary text-text-secondary hover:bg-hover-light hover:text-text-primary"
                }`}
              >
                Data de vencimento
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => selectExpirationMode("DAYS_FROM_MANUFACTURE")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  value.expirationMode === "DAYS_FROM_MANUFACTURE"
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border-secondary text-text-secondary hover:bg-hover-light hover:text-text-primary"
                }`}
              >
                30 dias da fabricação
              </button>
            </div>

            {value.expirationMode === "FIXED_DATE" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-text-secondary">
                    Data de vencimento
                  </span>
                  <input
                    type="date"
                    value={value.expirationDate}
                    onChange={(event) => updateExpirationDateField(event.target.value)}
                    className="input-field w-full"
                  />
                </label>
              </div>
            ) : null}

            {value.expirationMode === "DAYS_FROM_MANUFACTURE" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-text-secondary">
                    Data de fabricação (padrão: hoje)
                  </span>
                  <input
                    type="date"
                    value={value.manufactureDate}
                    onChange={(event) =>
                      updateManufactureExpiration(event.target.value, value.shelfLifeDays)
                    }
                    className="input-field w-full"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-text-secondary">
                    Duração (dias após fabricação)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={value.shelfLifeDays ?? DEFAULT_SHELF_LIFE_DAYS}
                    onChange={(event) => {
                      const raw = Number.parseInt(event.target.value, 10);
                      updateManufactureExpiration(
                        value.manufactureDate || getTodayIsoDate(),
                        Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SHELF_LIFE_DAYS,
                      );
                    }}
                    className="input-field w-full"
                  />
                </label>
              </div>
            ) : null}

            {effectiveExpirationDate &&
            (expirationEvaluation.status === "EXPIRED" ||
              expirationEvaluation.status === "EXPIRING_SOON") ? (
              <div
                className={`mt-3 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                  expirationEvaluation.status === "EXPIRED"
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                }`}
              >
                <div className="flex items-start gap-2 text-xs">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {expirationEvaluation.label} ({expirationEvaluation.formattedDate})
                    </p>
                    <p className="opacity-90">
                      Produto vencido ou próximo ao vencimento. Sugestão: vender a preço de custo.
                    </p>
                  </div>
                </div>
                {costValue > 0 && !pricesLocked ? (
                  Math.abs(parseMoneyBr(value.productSalePrice) - costValue) >= 0.005 ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={applyCostPriceToSale}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
                    >
                      <Tag size={13} />
                      Aplicar preço de custo (R$ {formatMoneyBr(costValue)})
                    </button>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <Tag size={13} />
                      Já está a preço de custo
                    </span>
                  )
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Seção recolhível: Mais detalhes (opcional) */}
          <section className="card rounded-2xl p-4">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowMoreDetails((current) => !current)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h4 className="text-sm font-semibold text-text-secondary">
                  Mais detalhes (opcional)
                </h4>
                <p className="text-xs text-text-tertiary">
                  Fornecedor, unidade de medida (UN/KG) e descrição
                </p>
              </div>
              {showMoreDetails ? (
                <ChevronUp size={16} className="text-text-secondary" />
              ) : (
                <ChevronDown size={16} className="text-text-secondary" />
              )}
            </button>

            {showMoreDetails ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <SearchableSelectField
                  label="Fornecedor (opcional)"
                  value={value.productSupplier}
                  options={supplierOptions}
                  onChange={(nextValue) => setField("productSupplier", nextValue)}
                  getOptionValue={(supplier) => supplier}
                  getOptionLabel={(supplier) => supplier}
                  placeholder="Sem fornecedor (ou pesquise)"
                  emptyMessage="Nenhum fornecedor encontrado."
                  createActionLabel="Cadastrar fornecedor"
                  onCreateOption={openSupplierModal}
                  className="md:col-span-2"
                />

                <label className="block">
                  <span className="mb-1 block text-sm text-text-secondary">
                    Unidade de Medida
                  </span>
                  <select
                    value={value.unitType}
                    onChange={(event) =>
                      setField("unitType", event.target.value === "KG" ? "KG" : "UN")
                    }
                    className="input-field w-full"
                  >
                    <option value="UN">UN - Unidade</option>
                    <option value="KG">KG - Quilograma (Balança)</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-text-secondary">
                    Valor Total em Estoque (custo)
                  </span>
                  <input
                    value={value.totalPriceOnProduct || "0,00"}
                    className="input-field w-full"
                    disabled
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm text-text-secondary">
                    Descrição (opcional)
                  </span>
                  <textarea
                    value={value.productDescription}
                    onChange={(event) => setField("productDescription", event.target.value)}
                    className="input-field min-h-[76px] w-full"
                    placeholder="Observações, sabor, marca ou detalhes do item"
                  />
                </label>
              </div>
            ) : null}
          </section>
        </div>

        {/* Rodapé com atalhos e ação de cadastro contínuo */}
        <div className="border-t border-border-primary p-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-cancel">
                Cancelar
              </button>
              {!isEditMode ? (
                <LoadingButton
                  type="button"
                  onClick={() => onSave({ keepOpen: true })}
                  isLoading={isSaving}
                  loadingLabel="Salvando..."
                  className="btn-outline-secondary"
                  title="Atalho: Ctrl + Enter"
                >
                  Salvar e novo
                </LoadingButton>
              ) : null}
              <LoadingButton
                type="button"
                onClick={() => onSave({ keepOpen: false })}
                isLoading={isSaving}
                loadingLabel="Salvando..."
                className="btn-primary"
                title="Atalho: Ctrl + S"
              >
                {isEditMode ? "Salvar produto" : "Salvar e fechar"}
              </LoadingButton>
            </div>
            <p className="text-right text-[11px] text-text-tertiary">
              Enter: próximo campo · {isEditMode ? "Ctrl+S: salvar" : "Ctrl+Enter: salvar e novo · Ctrl+S: salvar e fechar"} · Esc: fechar
            </p>
          </div>
        </div>
      </aside>

      {/* Modal de cadastro rápido de fornecedor informal */}
      {supplierModalOpen ? (
        <div
          className="fixed inset-0 z-layer-dialog flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <form
            onSubmit={submitSupplier}
            className="w-full max-w-4xl rounded-2xl border border-border-primary bg-bg-light shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Cadastrar fornecedor
                </h3>
                <p className="text-sm text-text-secondary">
                  Apenas o nome é obrigatório — ideal também para fornecedores informais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-hover-light"
                aria-label="Fechar cadastro de fornecedor"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
              {supplierMissingFields.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <p>
                    <strong>Faltam dados opcionais ({supplierMissingFields.join(", ")}):</strong> você pode salvar apenas com o nome e completar depois.
                  </p>
                </div>
              ) : null}

              <section className="card rounded-2xl p-4">
                <h4 className="text-sm font-semibold text-text-secondary">Dados do fornecedor</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-text-secondary">Nome / Nome fantasia *</span>
                    <input
                      value={supplierDraft.fantasyName}
                      onChange={(event) => setSupplierField("fantasyName", event.target.value)}
                      className="input-field w-full"
                      placeholder="Ex.: Zé das Frutas"
                      autoFocus
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-text-secondary">Razão social (opcional)</span>
                    <input
                      value={supplierDraft.companyName}
                      onChange={(event) => setSupplierField("companyName", event.target.value)}
                      className="input-field w-full"
                      placeholder="Razão social"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-text-secondary">CNPJ (opcional)</span>
                    <input
                      value={supplierDraft.cnpj}
                      onChange={(event) => setSupplierField("cnpj", maskCnpj(event.target.value))}
                      className="input-field w-full"
                      placeholder="00.000.000/0000-00"
                    />
                  </label>
                </div>
              </section>

              <AddressContactFields
                value={{
                  cep: supplierDraft.cep,
                  city: supplierDraft.city,
                  state: supplierDraft.state,
                  address: supplierDraft.address,
                  neighborhood: supplierDraft.neighborhood,
                  streetComplement: supplierDraft.streetComplement,
                  number: supplierDraft.number,
                  referencePoint: supplierDraft.referencePoint,
                  telephone: supplierDraft.telephone,
                  cellphone: supplierDraft.cellphone,
                  email: supplierDraft.email,
                }}
                loadingCep={loadingSupplierCep}
                optionalFields
                onFillAddressFromCep={fillSupplierAddressFromCep}
                onChange={(field, fieldValue) => setSupplierField(field, fieldValue)}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border-primary px-4 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="btn-cancel"
              >
                Cancelar
              </button>
              <LoadingButton
                type="submit"
                isLoading={savingSupplier}
                loadingLabel="Salvando..."
                className="btn-primary"
              >
                Salvar fornecedor
              </LoadingButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
