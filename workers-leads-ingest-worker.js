/**
 * Cloudflare Worker — POST /api/leads-ingest (espelho do Vercel api/leads-ingest.ts)
 *
 * Secrets (wrangler secret put):
 *   LEADCHECK_INGEST_TOKEN
 *   LEADCHECK_SHEETS_WEBHOOK
 *   LEADCHECK_SHEETS_TOKEN
 *
 * Deploy:
 *   npx wrangler deploy workers/leads-ingest-worker.js --name leadcheck-ingest
 *   Aponte o domínio ou use workers.dev e configure VITE_LEADS_INGEST_URL no Pages
 */

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-leadcheck-token",
  };
}

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }
    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "POST only" }, { status: 405, headers: cors() });
    }

    const INGEST_TOKEN = env.LEADCHECK_INGEST_TOKEN || "w1-fase1-2026";
    const SHEETS_WEBHOOK = env.LEADCHECK_SHEETS_WEBHOOK || "";
    const SHEETS_TOKEN = env.LEADCHECK_SHEETS_TOKEN || "w1-fase1-2026";

    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: "JSON invalido" }, { status: 400, headers: cors() });
    }

    const tok = request.headers.get("x-leadcheck-token") || body.token || "";
    if (tok !== INGEST_TOKEN) {
      return Response.json({ ok: false, error: "token invalido" }, { status: 401, headers: cors() });
    }

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
    };

    let sheets = null;
    if (SHEETS_WEBHOOK && consentAt) {
      try {
        const url = SHEETS_WEBHOOK.replace(/\/dev(\b|$)/, "/exec");
        const r = await fetch(url, {
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
        sheets = { ok: false, error: String(e && e.message ? e.message : e) };
      }
    }

    return Response.json(
      {
        ok: true,
        lead,
        sheets,
        hint: consentAt
          ? "Lead aceito"
          : "Sem consentAt — nao dispare WhatsApp",
      },
      { headers: cors() },
    );
  },
};
