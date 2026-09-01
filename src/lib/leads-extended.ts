/** Tipos estendidos para scanner de leads (LGPD-compliant). */

export type LeadSource =
  | "funnel_site"
  | "meta_lead_ads"
  | "whatsapp_inbound"
  | "form_parceiro"
  | "n8n"
  | "manual"
  | "caaS_parceiro";

export type LeadStatus =
  | "novo"
  | "qualificado"
  | "contatado"
  | "negociacao"
  | "convertido"
  | "descartado"
  | "sem_consentimento";

export type EnrichmentStatus = "nao" | "pendente" | "ok" | "falha" | "bloqueado_lgpd";

export type ScannedLead = {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: LeadSource;
  status: LeadStatus;
  /** Consentimento explícito para contato comercial */
  consentAt: string | null;
  consentSource: string | null;
  nome: string;
  whatsapp: string;
  telefone: string;
  email: string;
  cpf: string;
  /** Dados de intenção (preenchidos pelo lead ou parceiro) */
  interesse: "revisional" | "financiamento" | "home_equity" | "credito_pessoal" | "outro";
  placa: string;
  valorBem: number | null;
  parcela: number | null;
  contractDate: string;
  cidade: string;
  uf: string;
  /** Score interno 0-100 */
  score: number;
  tier: "quente" | "morno" | "frio";
  enrichment: EnrichmentStatus;
  enrichmentNote: string;
  responsavel: string;
  tags: string[];
  raw: Record<string, unknown>;
};

export const SCAN_LEADS_KEY = "leadcheck-scanner-leads";

export function loadScannedLeads(): ScannedLead[] {
  try {
    const raw = localStorage.getItem(SCAN_LEADS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function saveScannedLeads(list: ScannedLead[]) {
  localStorage.setItem(SCAN_LEADS_KEY, JSON.stringify(list));
}

export function upsertScannedLead(lead: ScannedLead) {
  const list = loadScannedLeads();
  const i = list.findIndex((x) => x.id === lead.id);
  const next =
    i >= 0 ? list.map((x, idx) => (idx === i ? lead : x)) : [lead, ...list];
  saveScannedLeads(next);
  return next;
}

export function newScannedId() {
  return "sl_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Score simples: consentimento + contato + intenção + dados financeiros */
export function scoreLead(l: Partial<ScannedLead>): { points: number; tier: ScannedLead["tier"] } {
  let p = 0;
  if (l.consentAt) p += 30;
  if (l.whatsapp || l.telefone) p += 25;
  if (l.cpf) p += 10;
  if (l.parcela && l.parcela > 0) p += 15;
  if (l.interesse === "revisional" || l.interesse === "financiamento") p += 10;
  if (l.placa) p += 5;
  if (l.email) p += 5;
  const points = Math.min(100, p);
  const tier = points >= 70 ? "quente" : points >= 40 ? "morno" : "frio";
  return { points, tier };
}

export function leadsToSheetRows(list: ScannedLead[]) {
  return list.map((l) => ({
    Id: l.id,
    CriadoEm: l.createdAt,
    AtualizadoEm: l.updatedAt,
    Fonte: l.source,
    Status: l.status,
    Consentimento: l.consentAt || "",
    Nome: l.nome,
    WhatsApp: l.whatsapp,
    Telefone: l.telefone,
    Email: l.email,
    CPF: l.cpf,
    Interesse: l.interesse,
    Placa: l.placa,
    ValorBem: l.valorBem ?? "",
    Parcela: l.parcela ?? "",
    DataContrato: l.contractDate,
    Cidade: l.cidade,
    UF: l.uf,
    Score: l.score,
    Tier: l.tier,
    Enriquecimento: l.enrichment,
    Responsavel: l.responsavel,
    Tags: (l.tags || []).join(";"),
  }));
}

export function scannedToCsv(list: ScannedLead[]): string {
  const rows = leadsToSheetRows(list);
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(","))].join("\n");
}
