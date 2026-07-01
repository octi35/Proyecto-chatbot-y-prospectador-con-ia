import type { CRMLead, Campaign, AgentConfig, AutomationRule, WaTemplate } from "../types";

export interface HealthData {
  status: string;
  model: string;
  botEngine?: "gemini" | "openrouter" | "local";
  integrations: {
    gemini: boolean; openrouter?: boolean; supabase: boolean;
    whatsapp: boolean; facebook?: boolean; instagram?: boolean; email?: boolean;
  };
  webhookUrl: string | null;
  messengerWebhookUrl?: string | null;
}

// ---------------------------------------------------------------------------
// AUTH SESSION (tokens issued by Supabase Auth via the server)
// ---------------------------------------------------------------------------
export interface AuthSession { access_token: string; refresh_token: string; expires_at?: number; email?: string }
const SESSION_KEY = "respondo_session";

export function getSession(): AuthSession | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
export function setSession(s: AuthSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

async function rawFetch(path: string, opts?: RequestInit, token?: string | null): Promise<Response> {
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers as Record<string, string> | undefined),
    },
  });
}

// Single-flight token refresh: many parallel 401s trigger ONE refresh call.
let refreshPromise: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  const s = getSession();
  if (!s?.refresh_token) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const r = await fetch("/api/auth/refresh", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: s.refresh_token }),
        });
        if (!r.ok) { setSession(null); return false; }
        const data = await r.json();
        setSession({ ...data.session, email: data.user?.email ?? s.email });
        return true;
      } catch { return false; }
    })().finally(() => { setTimeout(() => { refreshPromise = null; }, 0); }) as Promise<boolean>;
  }
  return refreshPromise;
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  let res = await rawFetch(path, opts, getSession()?.access_token);
  if (res.status === 401 && getSession()?.refresh_token) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawFetch(path, opts, getSession()?.access_token);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// AUTH API
// ---------------------------------------------------------------------------
export interface AuthResult {
  ok: boolean;
  needsEmailConfirm?: boolean;
  session?: AuthSession;
  user?: { id: string; email?: string };
}

export async function authSignup(email: string, password: string): Promise<AuthResult> {
  const r = await fetch("/api/auth/signup", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any).error || "No se pudo crear la cuenta");
  if (data.session) setSession({ ...data.session, email });
  return data;
}

export async function authLogin(email: string, password: string): Promise<AuthResult> {
  const r = await fetch("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any).error || "No se pudo iniciar sesión");
  if (data.session) setSession({ ...data.session, email });
  return data;
}

export function authLogout() { setSession(null); }

// Adopts pre-multi-account rows (owner_id NULL) into the current account
export const claimLegacy = () =>
  request<{ ok: boolean; claimed: number }>("/api/auth/claim-legacy", { method: "POST" });

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

// Automations
export const getAutomations = () => request<AutomationRule[]>("/api/automations");
export const createAutomation = (rule: Omit<AutomationRule, "id" | "timesTriggered">) =>
  request<AutomationRule>("/api/automations", { method: "POST", body: JSON.stringify(rule) });
export const updateAutomation = (id: string, patch: Partial<AutomationRule>) =>
  request<AutomationRule>(`/api/automations/${id}`, { method: "PUT", body: JSON.stringify(patch) });
export const deleteAutomation = (id: string) =>
  request<void>(`/api/automations/${id}`, { method: "DELETE" });

// WhatsApp templates
export const getTemplates = () => request<WaTemplate[]>("/api/templates");
export const createTemplate = (tpl: Omit<WaTemplate, "id" | "createdAt">) =>
  request<WaTemplate>("/api/templates", { method: "POST", body: JSON.stringify(tpl) });
export const updateTemplate = (id: string, patch: Partial<WaTemplate>) =>
  request<WaTemplate>(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify(patch) });
export const deleteTemplate = (id: string) =>
  request<void>(`/api/templates/${id}`, { method: "DELETE" });

// AI assist (conversation summary + suggested replies)
type ConvMsg = { role: "user" | "model"; text: string };
export const aiSummary = (history: ConvMsg[], name?: string) =>
  request<{ summary: string }>("/api/ai/summary", { method: "POST", body: JSON.stringify({ history, name }) });
export const aiSuggest = (history: ConvMsg[]) =>
  request<{ suggestions: string[] }>("/api/ai/suggest", { method: "POST", body: JSON.stringify({ history }) });

export interface AiInsights {
  sentiment: { positive: number; neutral: number; negative: number };
  highlights: string[];
  recommendation: string;
  analyzed?: number;
}
export const aiInsights = () => request<AiInsights>("/api/ai/insights");

// AI campaign generator (uses the account's business config + catalog)
export const aiCampaign = (objetivo: string, segmento?: string) =>
  request<{ name: string; template: string }>("/api/ai/campaign", {
    method: "POST", body: JSON.stringify({ objetivo, segmento }),
  });

// Pull real products from the connected store into config.catalog
export const syncCatalog = () =>
  request<{ ok: boolean; store: string; imported: number; catalog: string }>("/api/catalog/sync", { method: "POST" });
