/**
 * Ponte funil Parcela Justa → Scanner + Google Sheets (padrão SyncCRM / Offline).
 * Só roda após pagamento no funil: o cliente já preencheu WhatsApp/CPF com captura LGPD.
 */
import type { Lead } from "./leads";
import { ingestLead } from "./lead-scanner";
import { leadsToSheetRows } from "./leads-extended";
import { loadSheetsCfg, pushLeadsToSheet } from "./sheets-sync";

export async function bridgeFunnelLeadToScanner(lead: Lead) {
  try {
    const scanned = ingestLead({
      source: "funnel_site",
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      cpf: lead.cpf,
      parcela: lead.parcela || undefined,
      contractDate: lead.contractDate || undefined,
      consentAt: lead.paidAt || new Date().toISOString(),
      consentSource: "funnel_parcela_justa_pago",
      interesse: "revisional",
      tags: [
        lead.flags?.quitacao ? "quitacao" : "",
        lead.flags?.prestamista ? "prestamista" : "",
        lead.flags?.reduzir ? "reduzir" : "",
        "pago",
      ].filter(Boolean),
      raw: {
        funnelId: lead.id,
        bacenMonthly: lead.bacenMonthly,
        bacenAnnual: lead.bacenAnnual,
        paid: lead.paid,
      },
    });

    const cfg = loadSheetsCfg();
    if (cfg.webhookUrl) {
      await pushLeadsToSheet(cfg, leadsToSheetRows([scanned]));
    }
    return scanned;
  } catch (e) {
    console.warn("[funnel-bridge]", e);
    return null;
  }
}
