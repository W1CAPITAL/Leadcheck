/**
 * POST /api/enrich
 * Proxy server-side para enriquecimento (não expõe API key no browser).
 * Body: { token, cpf, provider?: "bigdatacorp"|"apibrasil" }
 * Env: LEADCHECK_INGEST_TOKEN, BIGDATACORP_TOKEN / BIGDATACORP_TOKEN_ID, APIBRASIL_TOKEN
 *
 * LGPD: só chame com lead que já tem consentAt no cliente.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const INGEST_TOKEN = process.env.LEADCHECK_INGEST_TOKEN || "w1-fase1-2026";

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

  const cpf = onlyDigits(body.cpf).slice(0, 11);
  if (cpf.length !== 11) return res.status(400).json({ ok: false, error: "cpf invalido" });

  const provider = String(body.provider || "bigdatacorp").toLowerCase();

  try {
    if (provider === "apibrasil") {
      const key = process.env.APIBRASIL_TOKEN || "";
      if (!key) return res.status(501).json({ ok: false, error: "APIBRASIL_TOKEN nao configurado" });
      // Placeholder: adapte ao endpoint real do seu plano APIBrasil
      return res.status(200).json({
        ok: true,
        provider: "apibrasil",
        phone: null,
        note: "Configure o endpoint real do seu plano APIBrasil neste handler",
        cpf,
      });
    }

    // BigDataCorp — documentação típica: AccessToken + TokenId
    const access = process.env.BIGDATACORP_TOKEN || process.env.BIGDATACORP_ACCESS_TOKEN || "";
    const tokenId = process.env.BIGDATACORP_TOKEN_ID || "";
    if (!access) {
      return res.status(501).json({
        ok: false,
        error: "BIGDATACORP_TOKEN nao configurado no server",
        hint: "Enriquecimento exige conta paga + hipótese legal (LGPD)",
      });
    }

    const endpoint =
      process.env.BIGDATACORP_URL ||
      "https://plataforma.bigdatacorp.com.br/pessoas";

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        AccessToken: access,
        TokenId: tokenId,
      },
      body: JSON.stringify({
        Datasets: "phones_extended",
        q: `doc{${cpf}}`,
      }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: (json as any)?.message || `HTTP ${r.status}`,
        raw: json,
      });
    }

    // Extração defensiva (estrutura varia por dataset)
    const str = JSON.stringify(json);
    const phoneMatch = str.match(/(\d{10,13})/);
    const phone = phoneMatch ? phoneMatch[1] : null;

    return res.status(200).json({
      ok: true,
      provider: "bigdatacorp",
      phone,
      telefone: phone,
      cpf,
      rawHint: "Payload resumido — não logar PII em produção",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "enrich_error",
    });
  }
}
