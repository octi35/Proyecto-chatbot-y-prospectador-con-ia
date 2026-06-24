import type { CRMLead, Campaign, AgentConfig } from "../types";

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

// Config
export const getConfig = () => request<AgentConfig | null>("/api/config");
export const saveConfig = (config: AgentConfig) =>
  request<AgentConfig>("/api/config", { method: "PUT", body: JSON.stringify(config) });

// Leads
export const getLeads = () => request<CRMLead[]>("/api/leads");
export const createLead = (lead: Omit<CRMLead, "id">) =>
  request<CRMLead>("/api/leads", { method: "POST", body: JSON.stringify(lead) });
export const updateLead = (id: string, patch: Partial<Omit<CRMLead, "id">>) =>
  request<CRMLead>(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify(patch) });
export const deleteLead = (id: string) =>
  request<void>(`/api/leads/${id}`, { method: "DELETE" });

// Campaigns
export const getCampaigns = () => request<Campaign[]>("/api/campaigns");
export const createCampaign = (campaign: Omit<Campaign, "id">) =>
  request<Campaign>("/api/campaigns", { method: "POST", body: JSON.stringify(campaign) });
export const updateCampaign = (id: string, patch: Partial<Campaign>) =>
  request<Campaign>(`/api/campaigns/${id}`, { method: "PUT", body: JSON.stringify(patch) });
