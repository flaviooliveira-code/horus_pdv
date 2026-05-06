/**
 * Arquivo: src/pages/Admin/marketModuleConfigs.ts
 * Objetivo: centralizar dados mockados dos módulos competitivos do PDV.
 */
import type { MarketModuleConfig } from "@/components/Admin/MarketModulePage";

export const fiscalModuleConfig: MarketModuleConfig = {
  title: "Fiscal NFC-e / NF-e",
  description: "Simulação de emissão fiscal, contingência, XML, DANFE e eventos SEFAZ.",
  primaryAction: "Nova NFC-e",
  statusLabel: "Ambiente fiscal",
  statusValue: "Homologação simulada",
  kpis: [
    { label: "NFC-e emitidas", value: "128", hint: "Hoje, incluindo contingência", tone: "success" },
    { label: "Pendentes SEFAZ", value: "3", hint: "Aguardando autorização", tone: "accent" },
    { label: "Cancelamentos", value: "2", hint: "Dentro do prazo legal", tone: "primary" },
    { label: "XML arquivados", value: "100%", hint: "Guarda digital mockada", tone: "secondary" },
  ],
  recordsTitle: "Fila fiscal",
  records: [
    { id: "nfce-8192", title: "NFC-e 8192", description: "Venda balcão com CPF informado", status: "Autorizada", amount: "R$ 184,90", meta: "Chave mock: 3526 0501 2345 6700 0165 5001 0000 0081 9210 0000 0001" },
    { id: "nfce-8193", title: "NFC-e 8193", description: "Venda em contingência offline", status: "Pendente", amount: "R$ 59,80", meta: "Reenvio automático em 15 minutos" },
    { id: "nfe-104", title: "NF-e 104", description: "Venda para cliente CNPJ", status: "Rascunho", amount: "R$ 1.240,00", meta: "Natureza: venda de mercadoria adquirida" },
  ],
  workflowTitle: "Fluxo fiscal esperado",
  workflow: [
    "Validar dados do emitente, certificado digital e CSC.",
    "Gerar XML assinado da NFC-e ou NF-e.",
    "Enviar para autorização SEFAZ e registrar protocolo.",
    "Disponibilizar DANFE, QR Code e arquivo XML ao cliente.",
  ],
  alerts: [
    "Certificado A1 vence em 27 dias.",
    "Contingência habilitada para simular queda da SEFAZ.",
    "Três vendas aguardam validação tributária de CFOP/NCM.",
  ],
};

export const paymentsModuleConfig: MarketModuleConfig = {
  title: "Pagamentos Integrados",
  description: "Mock de TEF, Pix dinâmico, link de pagamento e conciliação por adquirente.",
  primaryAction: "Nova cobrança",
  statusLabel: "Conciliação",
  statusValue: "97,8% conciliado",
  kpis: [
    { label: "TEF aprovado", value: "R$ 8.420", hint: "Débito/crédito no dia", tone: "success" },
    { label: "Pix dinâmico", value: "R$ 2.180", hint: "34 QR Codes pagos", tone: "secondary" },
    { label: "Divergências", value: "5", hint: "Taxa ou NSU divergente", tone: "accent" },
    { label: "Links abertos", value: "12", hint: "Aguardando pagamento", tone: "primary" },
  ],
  recordsTitle: "Transações",
  records: [
    { id: "pay-001", title: "TEF Cielo - NSU 778102", description: "Crédito à vista aprovado no pinpad", status: "Conciliado", amount: "R$ 349,90", meta: "Venda PDV01 - operador Admin" },
    { id: "pay-002", title: "Pix QR dinâmico", description: "Cobrança expirada aguardando nova tentativa", status: "Expirado", amount: "R$ 72,30", meta: "Tempo limite: 5 minutos" },
    { id: "pay-003", title: "Link de pagamento", description: "Cliente recebeu cobrança por WhatsApp", status: "Aberto", amount: "R$ 510,00", meta: "Expira hoje às 18:00" },
  ],
  workflowTitle: "Fluxo de cobrança",
  workflow: [
    "Selecionar forma de pagamento na venda.",
    "Enviar cobrança para TEF, Pix ou link mockado.",
    "Receber retorno de autorização e NSU/endToEndId.",
    "Conciliar taxa, valor líquido e baixa da venda.",
  ],
  alerts: [
    "Cinco transações têm taxa divergente do contrato.",
    "Pix dinâmico está em modo simulado.",
    "Pinpad PDV02 não envia heartbeat há 12 minutos.",
  ],
};

export const stockModuleConfig: MarketModuleConfig = {
  title: "Estoque e Inventário",
  description: "Controle mockado de entradas, saídas, perdas, estoque mínimo, lote e validade.",
  primaryAction: "Ajustar estoque",
  statusLabel: "Saúde do estoque",
  statusValue: "18 itens críticos",
  kpis: [
    { label: "SKU ativos", value: "1.284", hint: "42 com lote/validade", tone: "secondary" },
    { label: "Ruptura", value: "4,1%", hint: "Abaixo do estoque mínimo", tone: "primary" },
    { label: "Giro médio", value: "23 dias", hint: "Últimos 90 dias", tone: "success" },
    { label: "Perdas", value: "R$ 312", hint: "Vencimento e avaria", tone: "accent" },
  ],
  recordsTitle: "Movimentações",
  records: [
    { id: "stk-001", title: "Café Tradicional 500g", description: "Entrada por compra do fornecedor Distribuidora Alfa", status: "Entrada", amount: "+120 un", meta: "Lote CAF0526 - validade 10/12/2026" },
    { id: "stk-002", title: "Detergente 500ml", description: "Abaixo do estoque mínimo configurado", status: "Crítico", amount: "2 un", meta: "Mínimo: 10 un" },
    { id: "stk-003", title: "Achocolatado 400g", description: "Baixa automática por venda PDV01", status: "Saída", amount: "-3 un", meta: "Venda 000183" },
  ],
  workflowTitle: "Fluxo de estoque",
  workflow: [
    "Registrar entrada por compra, inventário ou ajuste autorizado.",
    "Baixar estoque automaticamente ao finalizar venda.",
    "Alertar ruptura, validade próxima e divergência de contagem.",
    "Gerar sugestão de compra por giro e estoque mínimo.",
  ],
  alerts: [
    "12 produtos vencem nos próximos 15 dias.",
    "Inventário cego pendente no corredor A.",
    "Produtos sem NCM/CEST bloqueiam emissão fiscal futura.",
  ],
};

export const cashModuleConfig: MarketModuleConfig = {
  title: "Abertura e Fechamento de Caixa",
  description: "Mock de turnos, sangrias, suprimentos, conferência e divergência por operador.",
  primaryAction: "Abrir caixa",
  statusLabel: "Turno atual",
  statusValue: "PDV01 aberto",
  kpis: [
    { label: "Saldo esperado", value: "R$ 3.842", hint: "Dinheiro + eletrônico", tone: "secondary" },
    { label: "Diferença", value: "R$ 8,50", hint: "Abaixo do limite", tone: "accent" },
    { label: "Sangrias", value: "3", hint: "R$ 1.200 retirados", tone: "primary" },
    { label: "Vendas turno", value: "76", hint: "Desde 08:02", tone: "success" },
  ],
  recordsTitle: "Eventos do caixa",
  records: [
    { id: "cash-001", title: "Abertura PDV01", description: "Saldo inicial informado pelo operador", status: "Confirmado", amount: "R$ 250,00", meta: "08:02 - Administrador" },
    { id: "cash-002", title: "Sangria cofre", description: "Retirada autorizada por gerente", status: "Auditado", amount: "R$ 600,00", meta: "14:20 - motivo: excesso em caixa" },
    { id: "cash-003", title: "Pré-fechamento", description: "Conferência parcial por forma de pagamento", status: "Em aberto", amount: "R$ 3.842,40", meta: "Dinheiro, Pix, débito e crédito" },
  ],
  workflowTitle: "Fluxo de caixa",
  workflow: [
    "Abrir turno com saldo inicial e operador responsável.",
    "Registrar vendas, cancelamentos, sangrias e suprimentos.",
    "Conferir valores esperados por forma de pagamento.",
    "Fechar caixa com divergência, justificativa e assinatura.",
  ],
  alerts: [
    "PDV02 está aberto há mais de 10 horas.",
    "Uma sangria aguarda segunda aprovação.",
    "Divergência em dinheiro acima da média semanal.",
  ],
};

export const purchasesModuleConfig: MarketModuleConfig = {
  title: "Compras e Reposição",
  description: "Pedidos de compra, recebimento, custo médio e sugestão de reposição mockados.",
  primaryAction: "Novo pedido",
  statusLabel: "Reposição",
  statusValue: "24 sugestões",
  kpis: [
    { label: "Pedidos abertos", value: "9", hint: "3 atrasados", tone: "accent" },
    { label: "A receber", value: "R$ 14.820", hint: "Próximos 7 dias", tone: "secondary" },
    { label: "Custo médio", value: "+2,8%", hint: "Variação mensal", tone: "primary" },
    { label: "Cobertura", value: "18 dias", hint: "Média da loja", tone: "success" },
  ],
  recordsTitle: "Pedidos e sugestões",
  records: [
    { id: "po-001", title: "Pedido 4501 - Distribuidora Alfa", description: "Reposição de mercearia seca", status: "Enviado", amount: "R$ 6.430,00", meta: "Entrega prevista amanhã" },
    { id: "po-002", title: "Sugestão detergente", description: "Baseada em estoque mínimo e giro médio", status: "Sugerido", amount: "48 un", meta: "Cobertura atual: 2 dias" },
    { id: "po-003", title: "Recebimento parcial", description: "Divergência entre XML e conferência física", status: "Divergente", amount: "R$ 312,90", meta: "Faltam 6 unidades" },
  ],
  workflowTitle: "Fluxo de compras",
  workflow: [
    "Gerar sugestão por estoque mínimo, giro e sazonalidade.",
    "Criar pedido para fornecedor com custo previsto.",
    "Receber mercadoria conferindo quantidade, lote e validade.",
    "Atualizar estoque, custo médio e contas a pagar.",
  ],
  alerts: [
    "Três pedidos estão fora do prazo prometido.",
    "Fornecedor Atacado Vitória subiu preço em 6 SKUs.",
    "Recebimento sem conferência fiscal bloqueia estoque disponível.",
  ],
};

export const returnsModuleConfig: MarketModuleConfig = {
  title: "Trocas e Devoluções",
  description: "Fluxo mockado de devolução, estorno, crédito, autorização e auditoria.",
  primaryAction: "Nova devolução",
  statusLabel: "Política ativa",
  statusValue: "30 dias com cupom",
  kpis: [
    { label: "Devoluções", value: "14", hint: "Últimos 7 dias", tone: "primary" },
    { label: "Trocas", value: "22", hint: "Crédito em loja", tone: "secondary" },
    { label: "Estornos", value: "R$ 920", hint: "Cartão e Pix", tone: "accent" },
    { label: "Reintegrado", value: "86%", hint: "Produtos voltaram ao estoque", tone: "success" },
  ],
  recordsTitle: "Solicitações",
  records: [
    { id: "ret-001", title: "Devolução venda 000182", description: "Cliente solicitou estorno Pix parcial", status: "Aprovar", amount: "R$ 42,90", meta: "Motivo: produto avariado" },
    { id: "ret-002", title: "Troca sem diferença", description: "Produto retornou ao estoque disponível", status: "Finalizada", amount: "R$ 89,90", meta: "Novo cupom vinculado" },
    { id: "ret-003", title: "Crédito em loja", description: "Vale gerado para uso futuro", status: "Aberto", amount: "R$ 126,40", meta: "Expira em 90 dias" },
  ],
  workflowTitle: "Fluxo de devolução",
  workflow: [
    "Localizar venda original e validar prazo/política.",
    "Selecionar itens e motivo da devolução ou troca.",
    "Definir estorno, crédito em loja ou produto substituto.",
    "Registrar autorização, auditoria e reintegração ao estoque.",
  ],
  alerts: [
    "Uma devolução de alto valor exige aprovação gerencial.",
    "Produto avariado deve ir para estoque de perdas.",
    "Estorno de cartão depende de conciliação com adquirente.",
  ],
};

export const crmModuleConfig: MarketModuleConfig = {
  title: "CRM e Fidelidade",
  description: "Mock de perfil de cliente, pontos, cashback, cupons e campanhas segmentadas.",
  primaryAction: "Nova campanha",
  statusLabel: "Programa",
  statusValue: "Pontos ativo",
  kpis: [
    { label: "Clientes ativos", value: "3.842", hint: "Compraram em 90 dias", tone: "secondary" },
    { label: "Cashback aberto", value: "R$ 4.120", hint: "Saldo a resgatar", tone: "accent" },
    { label: "Cupons usados", value: "18%", hint: "Taxa de resgate", tone: "success" },
    { label: "Inativos", value: "624", hint: "Sem compra há 120 dias", tone: "primary" },
  ],
  recordsTitle: "Clientes e campanhas",
  records: [
    { id: "crm-001", title: "Ana Martins", description: "Cliente VIP com alta recorrência", status: "Ouro", amount: "1.840 pts", meta: "Ticket médio R$ 214,30" },
    { id: "crm-002", title: "Campanha volta ao PDV", description: "Cupom de 10% para clientes inativos", status: "Rodando", amount: "312 envios", meta: "WhatsApp e e-mail mockados" },
    { id: "crm-003", title: "Cashback expirando", description: "Saldo vence nos próximos 7 dias", status: "Ação", amount: "R$ 680,00", meta: "42 clientes impactados" },
  ],
  workflowTitle: "Fluxo de fidelidade",
  workflow: [
    "Identificar cliente por CPF, telefone ou cadastro.",
    "Registrar compra no perfil e calcular pontos/cashback.",
    "Permitir resgate no checkout com regras configuradas.",
    "Segmentar campanhas por valor, frequência e recência.",
  ],
  alerts: [
    "42 clientes têm cashback próximo do vencimento.",
    "Campanha de inativos está abaixo da meta de resgate.",
    "Clientes sem consentimento LGPD ficam fora de campanhas.",
  ],
};

export const omnichannelModuleConfig: MarketModuleConfig = {
  title: "Omnichannel e Integrações",
  description: "Mock de e-commerce, marketplace, delivery, catálogo e estoque unificado.",
  primaryAction: "Conectar canal",
  statusLabel: "Canais online",
  statusValue: "4 conectados",
  kpis: [
    { label: "Pedidos online", value: "38", hint: "Hoje", tone: "secondary" },
    { label: "Estoque sincronizado", value: "96%", hint: "Última sync há 3 min", tone: "success" },
    { label: "Falhas sync", value: "7", hint: "Aguardando retry", tone: "accent" },
    { label: "Reservado", value: "R$ 2.930", hint: "Pedidos não faturados", tone: "primary" },
  ],
  recordsTitle: "Canais e pedidos",
  records: [
    { id: "omni-001", title: "Loja virtual", description: "Catálogo e estoque sincronizados", status: "Online", amount: "18 pedidos", meta: "Última atualização 09:02" },
    { id: "omni-002", title: "Marketplace Mercado Livre", description: "Pedido importado aguardando emissão fiscal", status: "Pendente", amount: "R$ 349,90", meta: "SKU CAF500 reservado" },
    { id: "omni-003", title: "Delivery local", description: "Pedido para retirada no balcão", status: "Separação", amount: "R$ 89,40", meta: "Previsão: 25 minutos" },
  ],
  workflowTitle: "Fluxo omnichannel",
  workflow: [
    "Publicar catálogo, preço e estoque por canal.",
    "Importar pedido online e reservar estoque.",
    "Separar, faturar, embalar e atualizar status do canal.",
    "Unificar histórico do cliente entre loja física e online.",
  ],
  alerts: [
    "Sete SKUs falharam por divergência de preço no marketplace.",
    "Dois pedidos online aguardam separação há mais de 30 minutos.",
    "Canal de delivery está em horário de pico.",
  ],
};
