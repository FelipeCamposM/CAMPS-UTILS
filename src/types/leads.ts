export type LeadSource = "google_maps" | "instagram";
export type CampaignSource = LeadSource | "both";
export type CampaignStatus = "draft" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type WebsiteStatus = "unknown" | "no_site" | "social_only" | "broken" | "weak" | "healthy";
export type LeadOpportunityFocus = "no_site_first" | "balanced" | "all";

export interface LeadStage {
  id: string;
  name: string;
  color: string;
  position: number;
  terminal: boolean;
}

export interface LeadCampaign {
  id: string;
  name: string;
  source: CampaignSource;
  niches: string[];
  locationLabel: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm: number;
  maxLeads: number;
  language: string;
  country: string;
  status: CampaignStatus;
  settings: LeadSearchSettings;
  foundCount: number;
  auditedCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface LeadSearchSettings {
  requireInstagram: boolean;
  websiteStatuses: WebsiteStatus[];
  minRating: number;
  minReviews: number;
  pace: "slow" | "balanced" | "fast";
  auditWebsites: boolean;
}

export interface LeadAuditFinding {
  code: string;
  label: string;
  severity: "info" | "opportunity" | "critical";
  value?: string;
}

export interface Lead {
  id: string;
  campaignId: string;
  name: string;
  category: string;
  address: string;
  country: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  phone: string;
  email: string;
  whatsapp: string;
  websiteUrl: string;
  websiteStatus: WebsiteStatus;
  instagramHandle: string;
  instagramUrl: string;
  rating?: number;
  reviewCount?: number;
  score: number;
  scoreReasons: string[];
  auditFindings: LeadAuditFinding[];
  sourceUrls: string[];
  sources: LeadSource[];
  stageId: string;
  notes: string;
  tags: string[];
  nextActionAt?: number;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface LeadFilters {
  query?: string;
  campaignId?: string;
  stageId?: string;
  websiteStatuses?: WebsiteStatus[];
  minScore?: number;
  hasInstagram?: boolean;
  deleted?: boolean;
}

export interface LeadSearchInput {
  campaignId: string;
  source: CampaignSource;
  niches: string[];
  location: string;
  radiusKm: number;
  maxLeads: number;
  language: string;
  country: string;
  pace: LeadSearchSettings["pace"];
  auditWebsites: boolean;
  opportunityFocus: LeadOpportunityFocus;
  instagramProfileDir: string;
  scoreWeights?: ScoreWeights;
}

export interface LeadSearchResult {
  success: boolean;
  campaignId: string;
  found: number;
  audited: number;
  leads: Array<Partial<Lead> & Pick<Lead, "name">>;
  message?: string;
  errorCode?: string;
}

export interface ScoreWeights {
  noSite: number;
  brokenSite: number;
  weakSite: number;
  socialOnly: number;
  instagram: number;
  contact: number;
  reviews: number;
  distance: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  noSite: 30,
  brokenSite: 28,
  weakSite: 18,
  socialOnly: 24,
  instagram: 12,
  contact: 10,
  reviews: 6,
  distance: 4,
};

export const DEFAULT_SEARCH_SETTINGS: LeadSearchSettings = {
  requireInstagram: false,
  websiteStatuses: ["no_site", "social_only", "broken", "weak", "healthy", "unknown"],
  minRating: 0,
  minReviews: 0,
  pace: "balanced",
  auditWebsites: true,
};
