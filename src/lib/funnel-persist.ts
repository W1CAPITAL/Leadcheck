import type { BacenResult } from "./bacen";
import type { Lead } from "./leads";
import { createLeadDraft } from "./leads";

const KEY = "leadcheck-funnel-v1";

export type FunnelSnapshot = {
  step: number;
  done: boolean;
  lead: Lead;
  bacen: BacenResult | null;
  savedAt: string;
};

export function loadFunnelSnapshot(): FunnelSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FunnelSnapshot;
    if (!parsed || typeof parsed.step !== "number" || !parsed.lead) return null;
    // Não restaura fileDataUrl gigante se > 1.5MB (só metadados)
    const lead = { ...createLeadDraft(), ...parsed.lead };
    if (lead.fileDataUrl && lead.fileDataUrl.length > 1_500_000) {
      lead.fileDataUrl = null;
    }
    return {
      step: Math.min(5, Math.max(1, parsed.step || 1)),
      done: !!parsed.done,
      lead,
      bacen: parsed.bacen ?? null,
      savedAt: parsed.savedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveFunnelSnapshot(snap: Omit<FunnelSnapshot, "savedAt">) {
  try {
    const lead = { ...snap.lead };
    // Evita estourar localStorage com PDF base64 enorme
    if (lead.fileDataUrl && lead.fileDataUrl.length > 1_500_000) {
      lead.fileDataUrl = null;
    }
    const payload: FunnelSnapshot = {
      ...snap,
      lead,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearFunnelSnapshot() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
