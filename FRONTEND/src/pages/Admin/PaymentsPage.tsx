import UnderDevelopmentPage from "@/components/Admin/UnderDevelopmentPage";

export default function PaymentsPage() {
  return (
    <UnderDevelopmentPage
      title="Pagamentos Integrados"
      description="TEF, adquirentes, carteiras digitais e conciliação automática."
      checkpoints={[
        "Integração TEF e provedores de pagamento",
        "Conciliação por venda, bandeira e adquirente",
        "Estorno, cancelamento e comprovantes transacionais",
      ]}
    />
  );
}
