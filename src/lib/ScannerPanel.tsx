/**
 * Painel Scanner — cole no Backoffice do Leadcheck (#backoffice).
 * Gera leads de verdade via: formulário, webhook API, Meta/n8n → planilha.
 */
import { useMemo, useState } from "react";
import {
  loadScannedLeads,
  scannedToCsv,
  type ScannedLead,
} from "./leads-extended";
import { ingestLead, actionableQueue, enrichLeadContact } from "./lead-scanner";
import {
  loadSheetsCfg,
  saveSheetsCfg,
  testSheetsWebhook,
  pushLeadsToSheet,
  type SheetsCfg,
} from "./sheets-sync";
import { leadsToSheetRows } from "./leads-extended";

export function ScannerPanel() {
  const [leads, setLeads] = useState<ScannedLead[]>(() => loadScannedLeads());
  const [cfg, setCfg] = useState<SheetsCfg>(() => loadSheetsCfg());
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    cpf: "",
    parcela: "",
    consent: true,
    source: "manual" as const,
  });

  const queue = useMemo(() => actionableQueue(40), [leads]);

  function refresh() {
    setLeads(loadScannedLeads());
  }

  function onIngest() {
    const lead = ingestLead({
      source: form.source,
      nome: form.nome,
      whatsapp: form.whatsapp,
      cpf: form.cpf,
      parcela: form.parcela ? Number(form.parcela) : undefined,
      consentAt: form.consent ? new Date().toISOString() : undefined,
      consentSource: "scanner_manual",
      interesse: "revisional",
    });
    setStatus(`Lead ${lead.id} · score ${lead.score} · ${lead.tier}`);
    refresh();
  }

  async function onTestWebhook() {
    setStatus("Testando webhook…");
    saveSheetsCfg(cfg);
    const r = await testSheetsWebhook(cfg);
    setStatus(
      r.ok
        ? "Webhook OK — planilha pronta"
        : `Falha: ${r.error || (r as any).json?.error || "inesperado"}`,
    );
  }

  async function onPushSheet() {
    setStatus("Enviando para planilha…");
    saveSheetsCfg(cfg);
    const rows = leadsToSheetRows(loadScannedLeads());
    const r = await pushLeadsToSheet(cfg, rows);
    setStatus(
      r.ok
        ? `Planilha OK — +${(r as any).json?.added ?? 0} / ~${(r as any).json?.updated ?? 0}`
        : `Falha sheets: ${r.error || JSON.stringify((r as any).json)}`,
    );
  }

  function onExportCsv() {
    const csv = scannedToCsv(loadScannedLeads());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leadcheck-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  async function onEnrich(id: string) {
    setStatus("Enriquecendo (consentimento obrigatório · proxy /api/enrich)…");
    await enrichLeadContact(id, {
      provider: "bigdatacorp",
      endpoint: "/api/enrich",
      apiKey: cfg.token || "w1-fase1-2026",
    });
    refresh();
    setStatus("Enriquecimento processado (veja nota do lead)");
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 960 }}>
      <h2 style={{ margin: 0 }}>Scanner de leads</h2>
      <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>
        Só entra na fila de contato quem tem <strong>consentimento</strong>. Enriquecimento de
        telefone via BigDataCorp/APIBrasil é opcional e bloqueado sem base legal (LGPD).
      </p>

      <section style={{ border: "1px solid #333", borderRadius: 12, padding: 16 }}>
        <h3>Captura rápida</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
          <input
            placeholder="WhatsApp"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          />
          <input
            placeholder="CPF"
            value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: e.target.value })}
          />
          <input
            placeholder="Parcela R$"
            value={form.parcela}
            onChange={(e) => setForm({ ...form, parcela: e.target.value })}
          />
        </div>
        <label style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          />
          Cliente consentiu contato (obrigatório para fila)
        </label>
        <button type="button" onClick={onIngest} style={{ marginTop: 8 }}>
          Gerar lead
        </button>
      </section>

      <section style={{ border: "1px solid #333", borderRadius: 12, padding: 16 }}>
        <h3>Planilha (SyncCRM / padrão Offline)</h3>
        <input
          style={{ width: "100%", marginBottom: 6 }}
          placeholder="URL webhook Apps Script …/exec"
          value={cfg.webhookUrl}
          onChange={(e) => setCfg({ ...cfg, webhookUrl: e.target.value })}
        />
        <input
          style={{ width: "100%", marginBottom: 6 }}
          placeholder="Token"
          value={cfg.token}
          onChange={(e) => setCfg({ ...cfg, token: e.target.value })}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={onTestWebhook}>
            Testar webhook
          </button>
          <button type="button" onClick={onPushSheet}>
            Enviar leads → planilha
          </button>
          <button type="button" onClick={onExportCsv}>
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => {
              saveSheetsCfg(cfg);
              setStatus("Config salva");
            }}
          >
            Salvar
          </button>
        </div>
        <p style={{ fontSize: 13, marginTop: 8 }}>{status}</p>
      </section>

      <section>
        <h3>
          Fila acionável ({queue.length}) · total {leads.length}
        </h3>
        <div style={{ overflow: "auto", maxHeight: 360 }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Nome</th>
                <th align="left">WhatsApp</th>
                <th>Score</th>
                <th>Status</th>
                <th>Fonte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 50).map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid #333" }}>
                  <td>{l.nome || "—"}</td>
                  <td>{l.whatsapp || l.telefone || "—"}</td>
                  <td align="center">
                    {l.score} · {l.tier}
                  </td>
                  <td align="center">{l.status}</td>
                  <td align="center">{l.source}</td>
                  <td>
                    <button type="button" onClick={() => onEnrich(l.id)}>
                      Enriquecer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
        <strong>Como gerar leads de verdade (LGPD):</strong>
        <ol style={{ margin: "8px 0", paddingLeft: 18 }}>
          <li>Funil do site (cliente preenche WhatsApp) — automático ao pagar</li>
          <li>Meta Lead Ads → n8n → POST <code>/api/leads-ingest</code> com <code>consentAt</code></li>
          <li>Parceiro CaaS / formulário com checkbox de consentimento</li>
        </ol>
        <strong>Não suportado:</strong> scraping de compradores de veículo + WhatsApp sem autorização.
        <br />
        Header <code>x-leadcheck-token</code> · planilha via Apps Script (mesmo padrão SyncCRM / Offline Lexis).
        No Cloudflare, use o Worker <code>workers/leads-ingest-worker.js</code>.
      </section>
    </div>
  );
}
