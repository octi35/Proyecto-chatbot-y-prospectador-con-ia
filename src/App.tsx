import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  MessageSquare,
  Users,
  BarChart3,
  Layers,
  HelpCircle,
  ShieldCheck,
  Zap,
  Bell,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import { AgentConfig, CRMLead, Campaign, AgentAction } from "./types";
import { DEFAULT_CONFIG } from "./data";
import {
  getConfig, saveConfig,
  getLeads, createLead, updateLead, deleteLead,
  getCampaigns, createCampaign, updateCampaign,
} from "./lib/api";

import AgentTrainer from "./components/AgentTrainer";
import ChatSimulator from "./components/ChatSimulator";
import CRMAdmin from "./components/CRMAdmin";
import AnalyticsPanel from "./components/AnalyticsPanel";
import ComparisonTable from "./components/ComparisonTable";
import WhiteLabelStudio from "./components/WhiteLabelStudio";
import ChannelConnect from "./components/ChannelConnect";

type TabType = "playground" | "crm" | "analytics" | "integrations" | "compare";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("playground");

  // Data state (loaded from API)
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [newLeadsBadge, setNewLeadsBadge] = useState(0);

  // Ref to avoid stale closure in pending config saves
  const pendingConfigSave = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // INITIAL LOAD from API
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [serverConfig, serverLeads, serverCampaigns] = await Promise.all([
          getConfig(),
          getLeads(),
          getCampaigns(),
        ]);
        if (serverConfig) setConfig(serverConfig);
        setLeads(serverLeads);
        setCampaigns(serverCampaigns);
        addNotification("✅ Datos cargados desde la base de datos.");
      } catch (e) {
        const msg = (e as Error).message;
        setApiError(msg);
        addNotification(`⚠️ Sin conexión a la API: ${msg}. Trabajando en modo local.`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // AUTO-POLL leads every 30 s to catch incoming WhatsApp messages
  // ---------------------------------------------------------------------------
  const lastPollTimeRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || apiError) return;
    const interval = setInterval(async () => {
      try {
        const since = lastPollTimeRef.current;
        lastPollTimeRef.current = new Date().toISOString();
        const recent = await getLeads(since ?? undefined);
        if (recent.length > 0) {
          // Merge: new leads prepended, existing ones updated in place
          setLeads((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const brandNew = recent.filter((l) => !existingIds.has(l.id));
            const merged = prev.map((l) => recent.find((r) => r.id === l.id) || l);
            return [...brandNew, ...merged];
          });
          const brandNewCount = recent.filter((r) => {
            return !leads.find((l) => l.id === r.id);
          }).length;
          if (brandNewCount > 0 && activeTab !== "crm") {
            setNewLeadsBadge((b) => b + brandNewCount);
            addNotification(`📲 ${brandNewCount} nuevo${brandNewCount > 1 ? "s" : ""} lead${brandNewCount > 1 ? "s" : ""} recibido${brandNewCount > 1 ? "s" : ""} desde WhatsApp`);
          }
        }
      } catch {
        // Polling failures are non-critical; ignore silently
      }
    }, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, apiError, activeTab]);

  // Clear badge when user navigates to CRM
  useEffect(() => {
    if (activeTab === "crm") setNewLeadsBadge(0);
  }, [activeTab]);

  // Update document title with new leads badge
  useEffect(() => {
    const name = config.businessName && config.businessName !== "Mi Negocio"
      ? config.businessName
      : "Respondo";
    document.title = newLeadsBadge > 0
      ? `(${newLeadsBadge}) ${name} — CRM`
      : `${name} — Panel de Control`;
  }, [newLeadsBadge, config.businessName]);

  // ---------------------------------------------------------------------------
  // CONFIG — debounce save to API on every change
  // ---------------------------------------------------------------------------
  const handleConfigChange = useCallback((newConfig: AgentConfig) => {
    setConfig(newConfig);
    if (pendingConfigSave.current) clearTimeout(pendingConfigSave.current);
    pendingConfigSave.current = setTimeout(() => {
      saveConfig(newConfig).catch((e) =>
        addNotification(`⚠️ Config no guardada: ${(e as Error).message}`)
      );
    }, 800);
  }, []);

  // ---------------------------------------------------------------------------
  // LEADS CRUD (API-backed)
  // ---------------------------------------------------------------------------
  const handleCreateLead = useCallback(async (lead: Omit<CRMLead, "id">): Promise<CRMLead> => {
    const created = await createLead(lead);
    setLeads((prev) => [created, ...prev]);
    return created;
  }, []);

  const handleUpdateLead = useCallback(async (id: string, patch: Partial<CRMLead>) => {
    const updated = await updateLead(id, patch);
    setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    return updated;
  }, []);

  const handleDeleteLead = useCallback(async (id: string) => {
    await deleteLead(id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // Legacy setter for components that still use React.Dispatch pattern
  const setLeadsCompat: React.Dispatch<React.SetStateAction<CRMLead[]>> = useCallback(
    (updater) => {
      setLeads((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        // Sync changed leads to API (fire and forget)
        next.forEach((lead) => {
          const old = prev.find((l) => l.id === lead.id);
          if (old && JSON.stringify(old) !== JSON.stringify(lead)) {
            updateLead(lead.id, lead).catch(() => {});
          }
        });
        // Create any new leads that don't exist in prev
        next.forEach((lead) => {
          if (!prev.find((l) => l.id === lead.id)) {
            // Already created via handleCreateLead, skip
          }
        });
        return next;
      });
    },
    []
  );

  // ---------------------------------------------------------------------------
  // CAMPAIGNS CRUD (API-backed)
  // ---------------------------------------------------------------------------
  const handleCreateCampaign = useCallback(async (campaign: Omit<Campaign, "id">): Promise<Campaign> => {
    const created = await createCampaign(campaign);
    setCampaigns((prev) => [created, ...prev]);
    return created;
  }, []);

  const handleUpdateCampaign = useCallback(async (id: string, patch: Partial<Campaign>) => {
    const updated = await updateCampaign(id, patch);
    setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const setCampaignsCompat: React.Dispatch<React.SetStateAction<Campaign[]>> = useCallback(
    (updater) => {
      setCampaigns((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        next.forEach((camp) => {
          if (!prev.find((c) => c.id === camp.id)) {
            createCampaign(camp).catch(() => {});
          } else {
            const old = prev.find((c) => c.id === camp.id);
            if (old && JSON.stringify(old) !== JSON.stringify(camp)) {
              updateCampaign(camp.id, camp).catch(() => {});
            }
          }
        });
        return next;
      });
    },
    []
  );

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS
  // ---------------------------------------------------------------------------
  const addNotification = (text: string) => {
    setNotifications((prev) => [text, ...prev.slice(0, 4)]);
  };

  const handleLeadMessageAdded = useCallback((text: string, role: "user" | "model") => {
    if (role === "user") {
      addNotification(`💬 Cliente: "${text.substring(0, 50)}${text.length > 50 ? "…" : ""}"`);
    } else {
      addNotification(`🤖 Respondo AI: "${text.substring(0, 50)}${text.length > 50 ? "…" : ""}"`);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // AGENT TOOL-USE ACTIONS → optimistic UI update + short-delay refresh from DB
  // NOTE: The server-side /api/chat handler already persists all CRM actions to DB.
  // So here we only do optimistic local updates; the lead refresh syncs actual DB state.
  // ---------------------------------------------------------------------------
  const handleAgentActions = useCallback((actions: AgentAction[]) => {
    let needsRefresh = false;

    actions.forEach((action) => {
      addNotification(action.label);

      if (action.type === "upsert_lead") {
        const { nombre, telefono, interes } = action.payload;
        setLeads((prev) => {
          const existing = prev.find(
            (l) => (telefono && l.phone === telefono) ||
              l.name.toLowerCase() === String(nombre || "").toLowerCase()
          );
          if (existing) {
            // Optimistic update for known lead
            return prev.map((l) => l.id === existing.id ? {
              ...l,
              notes: interes || l.notes,
              lastInteraction: new Date().toISOString(),
            } : l);
          }
          // New lead — server already created it; refresh will bring it in
          return prev;
        });
        needsRefresh = true;

      } else if (action.type === "update_lead_status") {
        const { nombre, estado, nota } = action.payload;
        setLeads((prev) => {
          const target = prev.find((l) => l.name.toLowerCase() === String(nombre || "").toLowerCase());
          if (!target) return prev;
          const patch: Partial<CRMLead> = {
            status: estado as CRMLead["status"],
            lastInteraction: new Date().toISOString(),
            ...(nota ? { notes: nota } : {}),
          };
          updateLead(target.id, patch).catch(() => {});
          return prev.map((l) => l.id === target.id ? { ...l, ...patch } : l);
        });
      }
      // schedule_followup and payment_link appear in the activity stream only
    });

    // After AI creates/updates leads in DB, fetch fresh data so our UI reflects real DB state
    if (needsRefresh) {
      setTimeout(() => {
        getLeads().then((fresh) => setLeads(fresh)).catch(() => {});
      }, 1500); // slight delay to let DB write settle
    }
  }, []);

  // ---------------------------------------------------------------------------
  // METRICS (calculated from real CRM data)
  // ---------------------------------------------------------------------------
  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => l.status === "Cerrado").length;
  const totalSales = leads.reduce((a, l) => a + (l.totalSpent || 0), 0);
  const convRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

  // Hot leads: score >= 85 and active in last 2h
  const hotLeads = leads.filter(
    (l) => l.score >= 85 && Date.now() - new Date(l.lastInteraction).getTime() < 2 * 60 * 60 * 1000
  ).length;

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex flex-col items-center justify-center gap-3">
        <Loader2 size={30} className="text-[#0071e3] animate-spin" />
        <p className="text-sm text-[#6e6e73] font-medium tracking-tight">Cargando Respondo…</p>
      </div>
    );
  }

  return (
    <div id="respondo-app" className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Ambient Apple-style gradient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] bg-blue-400/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[30rem] h-[30rem] bg-indigo-300/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center glass border border-white/60 rounded-[28px] p-4 sm:p-6 gap-4 shadow-apple sticky top-4 z-30">
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#0071e3] to-[#0a5fc7] shadow-apple-sm flex items-center justify-center shrink-0 overflow-hidden">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt={config.businessName} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
              ) : (
                <span className="font-bold text-xl tracking-tighter text-white">R</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-[1.7rem] leading-none tracking-[-0.03em] text-[#1d1d1f]">
                  {config.businessName && config.businessName !== "Mi Negocio" ? config.businessName : "Respondo"}
                </h1>
                <span className="px-2 py-0.5 bg-blue-50 text-[#0071e3] rounded-full text-[10px] font-semibold tracking-tight">
                  v3.0
                </span>
              </div>
              <p className="text-[13px] text-[#6e6e73] font-medium mt-1">
                Chatea menos, <strong className="text-[#0071e3] font-semibold">Vendé más.</strong>
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {[
              { label: "Prospectos", value: `${totalLeads}`, color: "text-[#1d1d1f]" },
              ...(hotLeads > 0 ? [{ label: "Calientes 🔥", value: `${hotLeads}`, color: "text-orange-600" }] : []),
              { label: "Conversión", value: `${convRate}%`, color: "text-[#0071e3]" },
              { label: "Ventas ARS", value: `$${totalSales.toLocaleString("es-AR")}`, color: "text-emerald-600" },
            ].map((stat) => (
              <div key={stat.label} className="text-center px-3.5 py-2 rounded-2xl bg-white/60 border border-white/80 shadow-apple-sm min-w-[78px]">
                <span className={`block text-base font-semibold tracking-tight ${stat.color}`}>{stat.value}</span>
                <span className="block text-[9px] text-[#86868b] font-medium uppercase tracking-wide mt-0.5">{stat.label}</span>
              </div>
            ))}
            <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${apiError ? "text-red-600 bg-red-50" : "text-emerald-700 bg-emerald-50"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${apiError ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
              {apiError ? "Local" : "Supabase"}
            </span>
          </div>
        </header>

        {/* Navigation — iOS segmented control */}
        <nav className="flex glass p-1.5 border border-white/60 rounded-2xl overflow-x-auto gap-1 shadow-apple-sm">
          {([
            ["playground",   <MessageSquare size={15} />, "Estudio IA",       0],
            ["crm",          <Users size={15} />,         "CRM de Ventas",    newLeadsBadge],
            ["analytics",    <BarChart3 size={15} />,     "Métricas",         0],
            ["integrations", <Layers size={15} />,        "Integraciones",    0],
            ["compare",      <HelpCircle size={15} />,    "Comparativa",      0],
          ] as [TabType, React.ReactNode, string, number][]).map(([tab, icon, label, badge]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-[13px] font-medium rounded-[13px] transition-all duration-300 shrink-0 flex items-center gap-2 relative ${
                activeTab === tab
                  ? "bg-white text-[#1d1d1f] shadow-apple-sm font-semibold"
                  : "text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/40"
              }`}
            >
              <span className={activeTab === tab ? "text-[#0071e3]" : ""}>{icon}</span>{label}
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Activity Stream */}
        {notifications.length > 0 && (
          <div className="glass border border-white/60 rounded-2xl p-3.5 flex items-start gap-3 shadow-apple-sm">
            <Bell size={15} className="text-[#0071e3] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider block mb-1">Actividad en Vivo</span>
              <div className="space-y-1 max-h-[80px] overflow-y-auto pr-2">
                {notifications.map((n, i) => (
                  <p key={i} className="text-[12px] text-[#1d1d1f] truncate leading-relaxed">• {n}</p>
                ))}
              </div>
            </div>
            <button
              onClick={() => setNotifications([])}
              className="text-[10px] text-[#6e6e73] hover:text-[#1d1d1f] bg-white/60 px-3 py-1.5 rounded-full hover:bg-white shrink-0 transition-colors"
            >
              Limpiar
            </button>
          </div>
        )}

        {/* API error banner */}
        {apiError && (
          <div className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-3.5 flex items-center gap-2 text-[13px] text-amber-800">
            <AlertTriangle size={14} className="shrink-0" />
            <span><strong>API no disponible:</strong> {apiError}. Revisá que SUPABASE_URL y SUPABASE_ANON_KEY estén configurados en el .env.</span>
          </div>
        )}

        {/* Main content */}
        <main className="min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === "playground" && (
              <motion.div key="playground" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7">
                  <AgentTrainer config={config} onChange={handleConfigChange} />
                </div>
                <div className="lg:col-span-5 h-[620px]">
                  <ChatSimulator
                    config={config}
                    onLeadMessageAdded={handleLeadMessageAdded}
                    onAgentActions={handleAgentActions}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === "crm" && (
              <motion.div key="crm" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <CRMAdmin
                  leads={leads}
                  setLeads={setLeadsCompat}
                  campaigns={campaigns}
                  setCampaigns={setCampaignsCompat}
                  config={config}
                  onLeadCreate={handleCreateLead}
                  onLeadUpdate={handleUpdateLead}
                  onLeadDelete={handleDeleteLead}
                  onCampaignCreate={handleCreateCampaign}
                />
              </motion.div>
            )}

            {activeTab === "analytics" && (
              <motion.div key="analytics" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <AnalyticsPanel leads={leads} campaigns={campaigns} config={config} />
              </motion.div>
            )}

            {activeTab === "integrations" && (
              <motion.div key="integrations" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-8">
                <ChannelConnect />
                <div className="pt-2 border-t border-slate-150">
                  <WhiteLabelStudio />
                </div>
              </motion.div>
            )}

            {activeTab === "compare" && (
              <motion.div key="compare" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <ComparisonTable />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="text-center pt-8 border-t border-slate-200 text-xs text-slate-400 space-y-2">
          <p>Respondo — Automatización de ventas inteligente y CRM en tiempo real.</p>
          <div className="flex items-center justify-center space-x-4">
            <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-600" /> Datos en Supabase (sa-east-1)</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Zap size={12} className="text-blue-600" /> Gemini AI — Function Calling activo</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
