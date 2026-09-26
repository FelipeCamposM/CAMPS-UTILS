import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import {
  completeLead, instagramProfileDir, saveCampaign, saveLead, searchLeads,
} from "../services/leadService";
import type { Lead, LeadCampaign, ScoreWeights } from "../types/leads";
import { DEFAULT_SEARCH_SETTINGS } from "../types/leads";
import { effectiveLocation } from "../tools/leads/LeadSearchForm";
import type { LeadSearchFormValue } from "../tools/leads/LeadSearchForm";

const LEAD_TOAST_ID = "lead-search";

export interface LeadSearchStartResult {
  campaignId: string;
  found: number;
  audited: number;
}

/**
 * Estado da busca de leads vivendo fora de `LeadsTool` — instanciado uma vez
 * em `App.tsx` (nunca desmonta), então trocar de ferramenta no meio de uma
 * busca não mata mais o listener de `lead-search-event` nem o `running`.
 * O toast (sonner) é quem avisa o usuário enquanto ele está em outra tela.
 */
export function useLeadSearch() {
  const [running, setRunning] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [progress, setProgress] = useState(0);
  const campaignRef = useRef("");
  const runningRef = useRef(false);
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => {
    const un = listen<{ type: string; message?: string; lead?: Partial<Lead> & Pick<Lead, "name"> }>(
      "lead-search-event",
      (event) => {
        if (event.payload.type === "action_required") {
          toast.warning(event.payload.message ?? "Ação necessária no navegador.", { id: "lead-search-action" });
        }
        if (event.payload.type === "audited" && event.payload.lead) {
          const lead = completeLead(event.payload.lead, event.payload.lead.campaignId ?? campaignRef.current);
          saveLead(lead).catch(() => undefined);
          setLeads((prev) => [lead, ...prev.filter((x) => x.id !== lead.id)]);
        }
      }
    );
    return () => { un.then((fn) => fn()); };
  }, []);

  // `tool-progress` é genérico (toda tool do sidecar usa o mesmo canal) — só
  // atualiza o toast enquanto ESSA busca está rodando, pra não mostrar o
  // progresso de outra ferramenta caso o usuário use uma em paralelo.
  useEffect(() => {
    const un = listen<number>("tool-progress", (e) => {
      if (runningRef.current) setProgress(e.payload);
    });
    return () => { un.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    if (!running) return;
    toast.loading(`Buscando leads… ${progress}% · ${leads.length} encontrados`, { id: LEAD_TOAST_ID, duration: Infinity });
  }, [running, progress, leads.length]);

  const start = useCallback(async (form: LeadSearchFormValue, weights: ScoreWeights): Promise<LeadSearchStartResult> => {
    if (running) throw new Error("Já existe uma busca em andamento.");
    setRunning(true);
    setLeads([]);
    setProgress(0);
    const id = crypto.randomUUID();
    const now = Date.now();
    const niches = form.niches.split(",").map((x) => x.trim()).filter(Boolean);
    const location = effectiveLocation(form);
    const campaign: LeadCampaign = {
      id, name: form.name.trim() || `${niches[0]} — ${location}`, source: form.source, niches,
      locationLabel: location, radiusKm: form.radiusKm, maxLeads: form.maxLeads, language: form.language,
      country: form.country, status: "running",
      settings: { ...DEFAULT_SEARCH_SETTINGS, pace: form.pace, auditWebsites: form.auditWebsites },
      foundCount: 0, auditedCount: 0, createdAt: now, updatedAt: now,
    };
    try {
      await saveCampaign(campaign);
      campaignRef.current = id;
      setCampaignId(id);
      const profile = await instagramProfileDir();
      const result = await searchLeads({
        campaignId: id, source: form.source, niches, location, radiusKm: form.radiusKm,
        maxLeads: form.maxLeads, language: form.language, country: form.country, pace: form.pace,
        auditWebsites: form.auditWebsites, opportunityFocus: form.opportunityFocus,
        instagramProfileDir: profile, scoreWeights: weights,
      });
      if (!result.success) throw new Error(result.message || "Busca não concluída.");
      const normalized = result.leads.map((lead) => completeLead(lead, id));
      for (const lead of normalized) await saveLead(lead);
      const done = { ...campaign, status: "completed" as const, foundCount: result.found, auditedCount: result.audited, updatedAt: Date.now() };
      await saveCampaign(done);
      setLeads(normalized);
      toast.success(`"${campaign.name}": ${result.found} leads encontrados e ${result.audited} auditados.`, { id: LEAD_TOAST_ID, duration: 6000 });
      return { campaignId: id, found: result.found, audited: result.audited };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha na busca de leads.";
      const failed = { ...campaign, status: "failed" as const, updatedAt: Date.now() };
      await saveCampaign(failed).catch(() => undefined);
      toast.error(`"${campaign.name}": ${message}`, { id: LEAD_TOAST_ID, duration: 8000 });
      throw e;
    } finally {
      setRunning(false);
    }
  }, [running]);

  return { running, campaignId, leads, start };
}

export type LeadSearchController = ReturnType<typeof useLeadSearch>;
