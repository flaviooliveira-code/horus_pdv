/**
 * Arquivo: src/pages/Admin/FiscalPage.tsx
 * Objetivo: apresenta o módulo fiscal NFC-e/NF-e no estado de desenvolvimento.
 * Entradas esperadas: não recebe props; exibe conteúdo informativo e status do roadmap.
 */
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
