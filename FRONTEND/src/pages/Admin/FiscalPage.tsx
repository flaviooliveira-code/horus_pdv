import UnderDevelopmentPage from "@/components/Admin/UnderDevelopmentPage";

export default function FiscalPage() {
  return (
    <UnderDevelopmentPage
      title="Fiscal NFC-e / NF-e"
      description="Emissão fiscal, contingência e homologação de documentos eletrônicos."
      checkpoints={[
        "Homologação SEFAZ e certificados digitais",
        "Contingência fiscal e inutilização de numeração",
        "Pré-visualização e transmissão de NFC-e / NF-e",
      ]}
    />
  );
}
