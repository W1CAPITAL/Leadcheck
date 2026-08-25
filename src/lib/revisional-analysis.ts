/**
 * Análise automática pós-contrato — linguagem comercial de revisional.
 * Não exige o cliente escolher o que “quer resolver”: o app aponta caminhos.
 */

import { formatBRL, formatRate, monthLabel } from "./br";
import { estimateSavingsVsBacen, type SavingsEstimate } from "./simulate";
import type { FunnelFlags } from "./leads";
import type { BacenResult } from "./bacen";

export type OpportunityLevel = "alta" | "media" | "baixa";

export type RevisionalOpportunity = {
  id: string;
  title: string;
  level: OpportunityLevel;
  pitch: string;
  detail: string;
  /** flag CRM */
  flag?: keyof FunnelFlags;
};

export type RevisionalAnalysis = {
  headline: string;
  subhead: string;
  scoreLabel: string;
  scoreHint: string;
  opportunities: RevisionalOpportunity[];
  savings: SavingsEstimate | null;
  nextSteps: string[];
  /** flags sugeridas para a equipe */
  suggestedFlags: FunnelFlags;
  summaryBullets: string[];
};

function levelRank(l: OpportunityLevel) {
  return l === "alta" ? 3 : l === "media" ? 2 : 1;
}

export function buildRevisionalAnalysis(input: {
  nome: string;
  parcela: number;
  contractDate: string;
  bacen: BacenResult | null;
  hasContractFile: boolean;
}): RevisionalAnalysis {
  const firstName = (input.nome || "Cliente").trim().split(/\s+/)[0] || "Cliente";
  const bacenMonthly = input.bacen?.monthlyRate ?? null;
  const savings =
    bacenMonthly != null && input.parcela >= 50
      ? estimateSavingsVsBacen({
          currentInstallment: input.parcela,
          bacenMonthlyPercent: bacenMonthly,
          months: 48,
          assumedSpreadPp: 0.45,
        })
      : null;

  const opportunities: RevisionalOpportunity[] = [];
  const flags: FunnelFlags = { quitacao: false, prestamista: false, reduzir: false };

  // 1) Taxa / parcela vs Bacen
  if (savings && savings.monthlySavings >= 80) {
    flags.reduzir = true;
    opportunities.push({
      id: "taxa",
      title: "Revisão de juros e recálculo da parcela",
      level: savings.monthlySavings >= 200 ? "alta" : "media",
      pitch: `Há indício de espaço para reduzir a prestação em torno de ${formatBRL(savings.monthlySavings)}/mês (estimativa).`,
      detail:
        `Na média oficial do Bacen em ${input.bacen?.period || monthLabel(input.contractDate) || "sua competência"}, a taxa de referência era ${formatRate(bacenMonthly!)} a.m. ` +
        `Comparando com a sua parcela de ${formatBRL(input.parcela)}, o cenário de mercado sugere possível onerosidade — típico de ação revisional de financiamento de veículo.`,
      flag: "reduzir",
    });
  } else if (bacenMonthly != null) {
    flags.reduzir = true;
    opportunities.push({
      id: "taxa",
      title: "Auditoria de taxa contratual",
      level: "media",
      pitch: "Mesmo com margem menor, vale confrontar a taxa do contrato com a série oficial do Bacen e o CET.",
      detail:
        `A média Bacen na época era ${formatRate(bacenMonthly)} a.m. O pré-laudo aponta se a taxa e o custo efetivo total estão alinhados ao mercado — base clássica de revisional.`,
      flag: "reduzir",
    });
  } else {
    opportunities.push({
      id: "taxa",
      title: "Confronto de taxa com o Bacen",
      level: "media",
      pitch: "Vamos fechar a competência do contrato e cruzar com a série oficial de crédito de veículos.",
      detail: "Sem a média oficial ainda, a equipe completa a consulta e compara taxa, CET e fluxo das parcelas.",
      flag: "reduzir",
    });
  }

  // 2) Seguro prestamista — sempre relevante em revisional de veículo
  flags.prestamista = true;
  opportunities.push({
    id: "prestamista",
    title: "Seguro prestamista e tarifas embutidas",
    level: input.hasContractFile ? "alta" : "media",
    pitch: input.hasContractFile
      ? "Com o contrato em mãos, a equipe confere se o seguro e tarifas foram embutidos no financiamento sem clareza."
      : "Em contratos de veículo é frequente o prestamista embutido — um dos pontos que mais geram revisão e abatimento.",
    detail:
      "A jurisprudência e a prática revisional costumam atacar cobrança de seguro prestamista, tarifas de cadastro e serviços agregados quando não houve contratação clara e em separado. " +
      "Isso pode reduzir o saldo e a parcela sem depender só da taxa de juros.",
    flag: "prestamista",
  });

  // 3) Quitação / saldo
  if (input.parcela >= 600 || (savings && savings.totalSavings >= 5000)) {
    flags.quitacao = true;
    opportunities.push({
      id: "quitacao",
      title: "Estratégia de quitação ou renegociação do saldo",
      level: "media",
      pitch: "Se o objetivo é se livrar da dívida ou do gravame, simulamos cenários de quitação com base no recálculo.",
      detail:
        "Após auditar taxa e encargos, é possível estimar um saldo mais aderente à média de mercado e orientar proposta de quitação ou acordo — útil para quem quer vender o carro ou limpar o nome.",
      flag: "quitacao",
    });
  }

  // 4) Contrato anexado fortalece
  if (input.hasContractFile) {
    opportunities.push({
      id: "documento",
      title: "Pré-laudo com documento anexado",
      level: "alta",
      pitch: "Seu contrato já está no pedido — a análise sai mais precisa (taxa impressa, CET, prestamista, IOF).",
      detail:
        "Com PDF ou foto das páginas de condições gerais e quadro de taxas, o especialista valida o que o Bacen só estima. Isso aumenta a chance de um parecer objetivo e de uma proposta comercial clara.",
    });
  } else {
    opportunities.push({
      id: "documento",
      title: "Completar com o contrato digitalizado",
      level: "baixa",
      pitch: "Sem o arquivo, a análise usa parcela e data. Anexar o contrato eleva a precisão do pré-laudo.",
      detail: "Envie PDF ou foto legível das páginas de taxa, CET e seguros para a equipe fechar o diagnóstico.",
    });
  }

  opportunities.sort((a, b) => levelRank(b.level) - levelRank(a.level));

  const high = opportunities.filter((o) => o.level === "alta").length;
  const scoreLabel =
    high >= 2 ? "Alta probabilidade de oportunidade revisional" : high === 1 ? "Boa oportunidade de revisão" : "Vale aprofundar com especialista";
  const scoreHint =
    savings && savings.monthlySavings > 0
      ? `Estimativa ilustrativa: até ${formatBRL(savings.monthlySavings)}/mês e cerca de ${formatBRL(savings.totalSavings)} em 48 meses — sujeita a conferência no contrato.`
      : "Os valores finais dependem da taxa impressa, do CET e dos encargos no contrato.";

  const headline =
    savings && savings.monthlySavings >= 100
      ? `${firstName}, encontramos indícios claros para uma revisional`
      : `${firstName}, seu contrato merece uma auditoria revisional`;

  const subhead =
    "O app cruzou a data e a parcela com a média oficial do Bacen e as práticas mais comuns em financiamento de veículo. " +
    "Abaixo está o que dá para fazer — sem você precisar escolher “o que resolver primeiro”.";

  const summaryBullets: string[] = [];
  if (bacenMonthly != null) {
    summaryBullets.push(`Média Bacen na época: ${formatRate(bacenMonthly)} a.m. (${input.bacen?.period || "—"})`);
  }
  summaryBullets.push(`Parcela informada: ${formatBRL(input.parcela)}`);
  if (input.contractDate) summaryBullets.push(`Competência do contrato: ${monthLabel(input.contractDate) || input.contractDate}`);
  summaryBullets.push(input.hasContractFile ? "Contrato anexado: sim" : "Contrato anexado: ainda não");

  const nextSteps = [
    "Liberar o pré-laudo (valor simbólico) para a equipe priorizar seu caso",
    "Especialista confere taxa, CET, prestamista e tarifas no documento",
    "Você recebe orientação objetiva: reduzir parcela, contestar encargos ou negociar quitação",
  ];

  return {
    headline,
    subhead,
    scoreLabel,
    scoreHint,
    opportunities,
    savings,
    nextSteps,
    suggestedFlags: flags,
    summaryBullets,
  };
}
