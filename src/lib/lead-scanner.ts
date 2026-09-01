/**
 * Scanner de leads — só fontes com base legal (consentimento / legítimo interesse documentado).
 * NÃO implementa scraping de compradores de veículos + WhatsApp sem autorização (LGPD).
 */
import {
  type ScannedLead,
  type LeadSource,
  newScannedId,
  scoreLead,
  upsertScannedLead,
  loadScannedLeads,
} from "./leads-extended";

export type IngestPayload = {
  source: LeadSource;
  nome?: string;
  whatsapp?: string;
  telefone?: string;
  email?: string;
  cpf?: string;
  interesse?: ScannedLead["interesse"];
  placa?: string;
  valorBem?: number;
  parcela?: number;
  contractDate?: string;
  cidade?: string;
  uf?: string;
  /** ISO — obrigatório para disparo comercial */
  consentAt?: string;
  consentSource?: string;
  responsavel?: string;
  tags?: string[];
  raw?: Record<string, unknown>;
};

function onlyDigits(s: string) {
  return String(s || "").replace(/\D/g, "");
}

function normalizeWhatsapp(w: string) {
  let d = onlyDigits(w);
  if (d.length <= 11) d = "55" + d;
  return d;
}

/**
 * Ingesta um lead (form, webhook Meta, n8n, parceiro CaaS).
 * Sem consentimento → status sem_consentimento (não vai para fila de disparo).
 */
export function ingestLead(payload: IngestPayload): ScannedLead {
  const now = new Date().toISOString();
  const consentAt = payload.consentAt || null;
  const base: ScannedLead = {
    id: newScannedId(),
    createdAt: now,
    updatedAt: now,
    source: payload.source || "manual",
    status: consentAt ? "novo" : "sem_consentimento",
    consentAt,
    consentSource: payload.consentSource || null,
    nome: String(payload.nome || "").trim(),
    whatsapp: payload.whatsapp ? normalizeWhatsapp(payload.whatsapp) : "",
    telefone: onlyDigits(payload.telefone || ""),
    email: String(payload.email || "").trim().toLowerCase(),
    cpf: onlyDigits(payload.cpf || "").slice(0, 11),
    interesse: payload.interesse || "revisional",
    placa: String(payload.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    valorBem: payload.valorBem ?? null,
    parcela: payload.parcela ?? null,
    contractDate: payload.contractDate || "",
    cidade: String(payload.cidade || "").trim(),
    uf: String(payload.uf || "").trim().toUpperCase().slice(0, 2),
    score: 0,
    tier: "frio",
    enrichment: "nao",
    enrichmentNote: "",
    responsavel: payload.responsavel || "",
    tags: payload.tags || [],
    raw: payload.raw || {},
  };
  const sc = scoreLead(base);
  base.score = sc.points;
  base.tier = sc.tier;
  if (base.score >= 70 && base.consentAt) base.status = "qualificado";
  upsertScannedLead(base);
  return base;
}

/** Importa lote (ex.: CSV parceiro com consentimento). */
export function ingestBatch(items: IngestPayload[]) {
  return items.map((i) => ingestLead(i));
}

/**
 * Enriquecimento opcional — só se houver consentimento e API configurada.
 * Adapters reais: BigDataCorp / APIBrasil / Credify (pay-as-you-go).
 * Aqui: interface + bloqueio LGPD sem consentimento.
 */
export async function enrichLeadContact(
  leadId: string,
  opts: {
    provider?: "bigdatacorp" | "apibrasil" | "manual";
    apiKey?: string;
    endpoint?: string;
  } = {},
): Promise<ScannedLead | null> {
  const list = loadScannedLeads();
  const lead = list.find((l) => l.id === leadId);
  if (!lead) return null;

  if (!lead.consentAt) {
    lead.enrichment = "bloqueado_lgpd";
    lead.enrichmentNote = "Sem consentimento — enriquecimento proibido (LGPD art. 7)";
    lead.updatedAt = new Date().toISOString();
    upsertScannedLead(lead);
    return lead;
  }

  // Sem key local: tenta /api/enrich no server (env Vercel/Cloudflare)
  lead.enrichment = "pendente";
  lead.updatedAt = new Date().toISOString();
  upsertScannedLead(lead);

  try {
    // Preferir proxy server-side (/api/enrich) para não expor keys no browser
    const endpoint = opts.endpoint || "/api/enrich";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-leadcheck-token": opts.apiKey || "w1-fase1-2026",
        ...(opts.endpoint && opts.apiKey
          ? { Authorization: `Bearer ${opts.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        cpf: lead.cpf,
        provider: opts.provider || "bigdatacorp",
        token: opts.apiKey || "w1-fase1-2026",
        service: "carriers_phone_validation",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`);

    const phone = String((json as any)?.phone || (json as any)?.telefone || "").replace(/\D/g, "");
    if (phone) {
      lead.telefone = phone;
      if (!lead.whatsapp) lead.whatsapp = phone.length <= 11 ? "55" + phone : phone;
    }
    lead.enrichment = "ok";
    lead.enrichmentNote = `OK via ${opts.provider || "api"}`;
    const sc = scoreLead(lead);
    lead.score = sc.points;
    lead.tier = sc.tier;
  } catch (e) {
    lead.enrichment = "falha";
    lead.enrichmentNote = e instanceof Error ? e.message : "erro";
  }
  lead.updatedAt = new Date().toISOString();
  upsertScannedLead(lead);
  return lead;
}

/** Fila acionável: com consentimento + contato + score mínimo */
export function actionableQueue(minScore = 40): ScannedLead[] {
  return loadScannedLeads()
    .filter(
      (l) =>
        l.consentAt &&
        (l.whatsapp || l.telefone) &&
        l.status !== "descartado" &&
        l.status !== "convertido" &&
        l.score >= minScore,
    )
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
}
