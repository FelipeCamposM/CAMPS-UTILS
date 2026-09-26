import { invoke } from "@tauri-apps/api/core";
import type {
  Lead,
  LeadCampaign,
  LeadFilters,
  LeadSearchInput,
  LeadSearchResult,
  LeadStage,
  ScoreWeights,
} from "../types/leads";

/** Preenche os campos ausentes de um lead parcial (evento incremental ou legado) com defaults seguros. */
export function completeLead(raw: Partial<Lead> & Pick<Lead, "name">, campaignId: string): Lead {
  const now = Date.now();
  return {
    id: raw.id ?? crypto.randomUUID(), campaignId, name: raw.name, category: raw.category ?? "",
    address: raw.address ?? "", country: raw.country ?? "", latitude: raw.latitude, longitude: raw.longitude,
    distanceKm: raw.distanceKm, phone: raw.phone ?? "", email: raw.email ?? "", whatsapp: raw.whatsapp ?? "",
    websiteUrl: raw.websiteUrl ?? "", websiteStatus: raw.websiteStatus ?? "unknown",
    instagramHandle: raw.instagramHandle ?? "", instagramUrl: raw.instagramUrl ?? "", rating: raw.rating,
    reviewCount: raw.reviewCount, score: raw.score ?? 0, scoreReasons: raw.scoreReasons ?? [],
    auditFindings: raw.auditFindings ?? [], sourceUrls: raw.sourceUrls ?? [], sources: raw.sources ?? [],
    stageId: raw.stageId ?? "new", notes: raw.notes ?? "", tags: raw.tags ?? [], nextActionAt: raw.nextActionAt,
    deletedAt: raw.deletedAt, createdAt: raw.createdAt ?? now, updatedAt: raw.updatedAt ?? now,
  };
}

export async function initializeLeads(): Promise<void> {
  await invoke("lead_initialize");
}

export async function listCampaigns(): Promise<LeadCampaign[]> {
  return invoke("lead_campaigns");
}

export async function saveCampaign(campaign: LeadCampaign): Promise<void> {
  await invoke("lead_save_campaign", { campaign });
}

export async function deleteCampaign(id: string): Promise<void> {
  await invoke("lead_delete_campaign", { id });
}

export async function listLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  return invoke("lead_list", { filters });
}

export async function saveLead(lead: Lead): Promise<void> {
  await invoke("lead_save", { lead });
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<void> {
  await invoke("lead_update", { id, patch });
}

export async function trashLead(id: string): Promise<void> {
  await invoke("lead_trash", { id });
}

export async function restoreLead(id: string): Promise<void> {
  await invoke("lead_restore", { id });
}

export async function purgeLead(id: string): Promise<void> {
  await invoke("lead_purge", { id });
}

export async function listStages(): Promise<LeadStage[]> {
  return invoke("lead_stages");
}

export async function saveStages(stages: LeadStage[]): Promise<void> {
  await invoke("lead_save_stages", { stages });
}

export async function getScoreWeights(): Promise<ScoreWeights> {
  return invoke("lead_score_weights");
}

export async function saveScoreWeights(weights: ScoreWeights): Promise<void> {
  await invoke("lead_save_score_weights", { weights });
}

export async function exportCampaignMarkdown(campaignId: string, path: string): Promise<void> {
  await invoke("lead_export_markdown", { campaignId, path });
}

export async function importCampaignMarkdown(path: string): Promise<{ campaignId: string; imported: number }> {
  return invoke("lead_import_markdown", { path });
}

export async function searchLeads(input: LeadSearchInput): Promise<LeadSearchResult> {
  const raw = await invoke<string>("run_tool", {
    tool: "search_leads",
    inputJson: JSON.stringify(input),
  });
  return JSON.parse(raw) as LeadSearchResult;
}

export async function instagramProfileDir(): Promise<string> {
  return invoke("lead_instagram_profile_dir");
}

export async function clearInstagramSession(): Promise<void> {
  await invoke("lead_clear_instagram_session");
}
