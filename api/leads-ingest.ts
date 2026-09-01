/**
 * POST /api/leads-ingest
 * Recebe leads de Meta/n8n/parceiros e grava via resposta (cliente persiste) ou encaminha ao webhook Sheets.
 *
 * Body: { token?, source, nome, whatsapp, cpf?, consentAt, ... }
 * Header opcional: x-leadcheck-token
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const INGEST_TOKEN = process.env.LEADCHECK_INGEST_TOKEN || "w1-fase1-2026";
const SHEETS_WEBHOOK = process.env.LEADCHECK_SHEETS_WEBHOOK || "";
const SHEETS_TOKEN = process.env.LEADCHECK_SHEETS_TOKEN || "w1-fase1-2026";

function onlyDigits(s: string) {
  return String(s || "").replace(/\D/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-leadcheck-token");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const tok = String(req.headers["x-leadcheck-token"] || body.token || "");
  if (tok !== INGEST_TOKEN) return res.status(401).json({ ok: false, error: "token invalido" });

  const consentAt = body.consentAt || body.consent_at || null;
  const lead = {
    id: "api_" + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    source: body.source || "n8n",
    status: consentAt ? "novo" : "sem_consentimento",
    consentAt,
    consentSource: body.consentSource || body.source || "api",
    nome: String(body.nome || body.name || "").trim(),
    whatsapp: onlyDigits(body.whatsapp || body.phone || body.telefone || ""),
    telefone: onlyDigits(body.telefone || body.phone || ""),
    email: String(body.email || "").trim().toLowerCase(),
    cpf: onlyDigits(body.cpf || "").slice(0, 11),
    interesse: body.interesse || "revisional",
    placa: String(body.placa || "").toUpperCase(),
    parcela: body.parcela != null ? Number(body.parcela) : null,
    contractDate: body.contractDate || body.data_contrato || "",
    cidade: body.cidade || "",
    uf: body.uf || "",
    raw: body,
  };

  // Encaminha para planilha se webhook configurado no server
  let sheets: unknown = null;
  if (SHEETS_WEBHOOK && consentAt) {
    try {
      const r = await fetch(SHEETS_WEBHOOK.replace(/\/dev(\b|$)/, "/exec"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: SHEETS_TOKEN,
          action: "write",
          sheetName: "Leads",
          rows: [
            {
              Id: lead.id,
              CriadoEm: lead.createdAt,
              Fonte: lead.source,
              Status: lead.status,
              Consentimento: lead.consentAt,
              Nome: lead.nome,
              WhatsApp: lead.whatsapp,
              Telefone: lead.telefone,
              Email: lead.email,
              CPF: lead.cpf,
              Interesse: lead.interesse,
              Placa: lead.placa,
              Parcela: lead.parcela ?? "",
              DataContrato: lead.contractDate,
              Cidade: lead.cidade,
              UF: lead.uf,
            },
          ],
        }),
      });
      sheets = await r.json().catch(() => ({ ok: false }));
    } catch (e) {
      sheets = { ok: false, error: e instanceof Error ? e.message : "sheets" };
    }
  }

  return res.status(200).json({
    ok: true,
    lead,
    sheets,
    hint: consentAt
      ? "Lead aceito"
      : "Sem consentAt — gravado como sem_consentimento (não dispare WhatsApp)",
  });
}
