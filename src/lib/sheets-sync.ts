/**
 * Sync 2 vias com Google Sheets — mesmo padrão OFFLINE-LEXISPREDICT / SyncCRM.
 * POST { token, action: "write"|"ping"|"list", rows: [...] } → Apps Script /exec
 */

export type SheetsCfg = {
  webhookUrl: string;
  token: string;
  sheetName?: string;
};

const CFG_KEY = "leadcheck-sheets-cfg";

export function loadSheetsCfg(): SheetsCfg {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return JSON.parse(raw) as SheetsCfg;
  } catch {}
  return { webhookUrl: "", token: "w1-fase1-2026", sheetName: "Leads" };
}

export function saveSheetsCfg(cfg: SheetsCfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

export async function sheetsPost(cfg: SheetsCfg, body: Record<string, unknown>) {
  const url = String(cfg.webhookUrl || "")
    .trim()
    .replace(/\/dev(\b|$)/, "/exec");
  if (!url || !/^https:\/\/script\.google\.com\//i.test(url)) {
    return { ok: false, error: "Configure URL do webhook Apps Script (/exec)" };
  }
  const payload = { token: cfg.token || "w1-fase1-2026", ...body };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      if (/<html|accounts\.google/i.test(text.slice(0, 200))) {
        return {
          ok: false,
          http: res.status,
          error: "HTML do Google — implantar com acesso Qualquer pessoa + Nova versão",
        };
      }
      return { ok: false, http: res.status, error: "Resposta não-JSON", raw: text.slice(0, 200) };
    }
    return { ok: !!(json && (json.ok || json.pong)), http: res.status, json, raw: text.slice(0, 200) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "rede" };
  }
}

export async function testSheetsWebhook(cfg: SheetsCfg) {
  return sheetsPost(cfg, { action: "ping", ping: true });
}

export async function pushLeadsToSheet(cfg: SheetsCfg, rows: Record<string, unknown>[]) {
  if (!rows.length) return { ok: false, error: "Nenhuma linha" };
  // lotes de 50 (limite prático Apps Script)
  const batch = rows.slice(0, 50);
  return sheetsPost(cfg, {
    action: "write",
    sheetName: cfg.sheetName || "Leads",
    rows: batch,
  });
}
