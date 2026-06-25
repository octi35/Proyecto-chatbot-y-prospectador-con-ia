import type { CRMLead, Campaign, AgentConfig } from "../types";

export interface HealthData {
  status: string;
  model: string;
  integrations: { gemini: boolean; supabase: boolean; whatsapp: boolean };
  webhookUrl: string | null;
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Health
export const getHealth = () => request<HealthData>("/api/health");

// Config
export const getConfig = () => request<AgentConfig | null>("/api/config");
export const saveConfig = (config: AgentConfig) =>
  request<AgentConfig>("/api/config", { method: "PUT", body: JSON.stringify(config) });

// Leads
export const getLeads = (since?: string) =>
  request<CRMLead[]>(since ? `/api/leads?since=${encodeURIComponent(since)}` : "/api/leads");
export const createLead = (lead: Omit<CRMLead, "id">) =>
  request<CRMLead>("/api/leads", { method: "POST", body: JSON.stringify(lead) });
export const updateLead = (id: string, patch: Partial<Omit<CRMLead, "id">>) =>
  request<CRMLead>(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify(patch) });
export const deleteLead = (id: string) =>
  request<void>(`/api/leads/${id}`, { method: "DELETE" });
export const sendLeadMessage = (id: string, text: string) =>
  request<{ ok: boolean; sent: boolean; note?: string }>(`/api/leads/${id}/message`, {
    method: "POST", body: JSON.stringify({ text }),
  });

// Campaigns
export const getCampaigns = () => request<Campaign[]>("/api/campaigns");
export const createCampaign = (campaign: Omit<Campaign, "id">) =>
  request<Campaign>("/api/campaigns", { method: "POST", body: JSON.stringify(campaign) });
export const updateCampaign = (id: string, patch: Partial<Campaign>) =>
  request<Campaign>(`/api/campaigns/${id}`, { method: "PUT", body: JSON.stringify(patch) });
export const sendCampaign = (id: string) =>
  request<Campaign & { waConfigured: boolean; totalTargeted: number }>(`/api/campaigns/${id}/send`, { method: "POST" });

// Follow-ups
export const runFollowups = () =>
  request<{ ok: boolean; contacted: number; totalStale: number; followUpMinutes: number }>("/api/followups/run", { method: "POST" });

// Analytics
export interface AnalyticsData {
  monthlySales: { month: string; sales: number }[];
  totalConversations: number;
  totalMessages: number;
  totalEvents: number;
  channelCounts: Record<string, number>;
  leadsPerDay?: { date: string; label: string; count: number }[];
}
export const getAnalytics = () => request<AnalyticsData>("/api/analytics");
