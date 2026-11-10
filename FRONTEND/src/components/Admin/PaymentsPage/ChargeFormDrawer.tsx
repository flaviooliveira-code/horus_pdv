/**
 * Arquivo: src/components/Admin/PaymentsPage/ChargeFormDrawer.tsx
 * Objetivo: drawer para emitir boleto ou PIX para um cliente cadastrado pelo gateway padrão.
 * Entradas esperadas: lista de clientes e callbacks de emitir/fechar; valida valor e cliente antes do envio.
 */
import { Send, X } from "lucide-react";
import { useState } from "react";
import { SearchableSelectField } from "@/components/Form";
import LoadingButton from "@/components/Loading/LoadingButton";
import useInputMasks from "@/hooks/InputMasks/useInputMasks";
import type {
  CreatePaymentChargePayload,
  PaymentChargeMethod,
} from "@/services/api/paymentChargeService";
import type { CustomerDto } from "@/services/api/customerService";

type ChargeFormDrawerProps = {
  open: boolean;
  customers: CustomerDto[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: CreatePaymentChargePayload) => void;
};

const METHOD_OPTIONS: Array<{ value: PaymentChargeMethod; label: string; helper: string }> = [
  { value: "BOLETO", label: "Boleto", helper: "Vence em dias; o cliente paga pelo banco." },
  { value: "PIX", label: "PIX", helper: "QR Code com validade de 30 minutos." },
];

export default function ChargeFormDrawer({
  open,
  customers,
  isSaving,
  onClose,
  onSave,
}: ChargeFormDrawerProps) {
  const { maskMoneyBr, parseMoneyBr } = useInputMasks();
  const [method, setMethod] = useState<PaymentChargeMethod>("BOLETO");
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDays, setDueDays] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = () => {
    const amountCents = Math.round(parseMoneyBr(amount || "0") * 100);
    if (!customerId) {
      setError("Escolha o cliente que vai pagar.");
      return;
    }
    if (amountCents < 100) {
      setError("Informe um valor de pelo menos R$ 1,00.");
      return;
    }
    setError("");
    onSave({
      method,
      amountCents,
      customerId,
      description: description.trim(),
      dueDays: method === "BOLETO" && dueDays ? Number(dueDays) : null,
    });
  };

  return (
    <div className="dept-drawer-overlay" onClick={isSaving ? undefined : onClose}>
      <aside
        className="dept-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="charge-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <form
          className="flex h-full min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex items-start justify-between border-b border-border-primary p-5">
            <div>
              <h3 id="charge-drawer-title" className="text-xl font-semibold text-text-primary">
                Nova cobrança
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Emitida no gateway padrão do método escolhido, com os dados do cliente cadastrado.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg p-2 text-text-secondary transition hover:bg-hover-light hover:text-text-primary"
              aria-label="Fechar nova cobrança"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <section className="card rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-text-secondary">Método</h4>
              <div role="radiogroup" aria-label="Método da cobrança" className="mt-3 grid grid-cols-2 gap-2">
                {METHOD_OPTIONS.map((option) => {
                  const selected = method === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${option.label}: ${option.helper}`}
                      onClick={() => setMethod(option.value)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        selected
                          ? "border-secondary bg-secondary text-text-light shadow-sm"
                          : "border-border-secondary bg-bg-light text-text-secondary hover:bg-hover-light"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className={`block text-xs ${selected ? "text-text-light/80" : "text-text-tertiary"}`}>
                        {option.helper}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-text-secondary">Cobrança</h4>
              <div className="mt-3 grid gap-3">
                <SearchableSelectField
                  label="Cliente"
                  value={customerId}
                  options={customers}
                  onChange={(nextValue) => setCustomerId(nextValue)}
                  getOptionValue={(customer) => customer.id}
                  getOptionLabel={(customer) => customer.customerName}
                  getOptionDescription={(customer) => customer.document || "Sem CPF/CNPJ"}
                  getOptionSearchText={(customer) => `${customer.customerName} ${customer.document}`}
                  placeholder="Busque por nome ou documento"
                  emptyMessage="Nenhum cliente cadastrado com esse nome."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-text-secondary">Valor (R$)</span>
                    <input
                      value={amount}
                      inputMode="numeric"
                      onChange={(event) => setAmount(maskMoneyBr(event.target.value))}
                      className="input-field w-full text-lg font-semibold"
                      placeholder="0,00"
                    />
                  </label>
                  {method === "BOLETO" ? (
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-text-secondary">Vencimento (dias)</span>
                      <input
                        value={dueDays}
                        inputMode="numeric"
                        onChange={(event) => setDueDays(event.target.value.replace(/\D/g, "").slice(0, 2))}
                        className="input-field w-full"
                        placeholder="Regra do gateway"
                      />
                    </label>
                  ) : null}
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-text-secondary">Descrição</span>
                  <input
                    value={description}
                    maxLength={120}
                    onChange={(event) => setDescription(event.target.value)}
                    className="input-field w-full"
                    placeholder="Ex.: Pedido 123 - entrega"
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-text-tertiary">
                O cliente precisa ter CPF/CNPJ. No Mercado Pago e no PagBank, o boleto também exige e-mail
                e endereço completo no cadastro.
              </p>
            </section>

            {error ? (
              <p role="alert" className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-border-primary p-4">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <button type="button" onClick={onClose} disabled={isSaving} className="btn-cancel">
                Cancelar
              </button>
              <LoadingButton
                type="submit"
                isLoading={isSaving}
                loadingLabel="Emitindo..."
                className="btn-primary inline-flex items-center justify-center gap-1.5"
              >
                <Send size={15} />
                Emitir
              </LoadingButton>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
