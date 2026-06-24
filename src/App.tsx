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
  // AGENT TOOL-USE ACTIONS → persist to DB + update local state
  // ---------------------------------------------------------------------------
  const handleAgentActions = useCallback((actions: AgentAction[]) => {
    actions.forEach((action) => {
      addNotification(action.label);

      if (action.type === "upsert_lead") {
        const { nombre, telefono, interes, canal } = action.payload;
        const validOrigins = ["WhatsApp","Instagram","Facebook"];
        const origin: CRMLead["origin"] = validOrigins.includes(canal) ? canal : "WhatsApp";

        setLeads((prev) => {
          const existing = prev.find(
            (l) => (telefono && l.phone === telefono) ||
              l.name.toLowerCase() === String(nombre || "").toLowerCase()
          );
          if (existing) {
            const patch = { notes: interes || existing.notes, lastInteraction: "Ahora" };
            updateLead(existing.id, patch).catch(() => {});
            return prev.map((l) => l.id === existing.id ? { ...l, ...patch } : l);
          }
          // Create new lead via API
          const newLeadData: Omit<CRMLead, "id"> = {
            name: nombre || "Cliente sin identificar",
            phone: telefono || "",
            status: "Nuevo",
            origin,
            lastInteraction: "Ahora",
            score: 70,
            notes: interes || "",
            avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nombre || "?")}`,
            totalSpent: 0,
            conversationHistory: [],
          };
          createLead(newLeadData)
            .then((created) => setLeads((p) => [created, ...p.filter((l) => l.name !== nombre)]))
            .catch(() => {});
          return prev; // API response will update state
        });

      } else if (action.type === "update_lead_status") {
        const { nombre, estado, nota } = action.payload;
        setLeads((prev) => {
          const target = prev.find((l) => l.name.toLowerCase() === String(nombre || "").toLowerCase());
          if (!target) return prev;
          const patch: Partial<CRMLead> = {
            status: estado as CRMLead["status"],
            lastInteraction: "Ahora",
            ...(nota ? { notes: nota } : {}),
          };
          updateLead(target.id, patch).catch(() => {});
          return prev.map((l) => l.id === target.id ? { ...l, ...patch } : l);
        });
      }
      // schedule_followup and payment_link appear in the activity stream only
    });
  }, []);

  // ---------------------------------------------------------------------------
  // METRICS (calculated from real CRM data)
  // ---------------------------------------------------------------------------
  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => l.status === "Cerrado").length;
  const totalSales = leads.reduce((a, l) => a + (l.totalSpent || 0), 0);
  const convRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-3">
        <Loader2 size={32} className="text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Cargando Respondo…</p>
      </div>
    );
  }

  return (
    <div id="respondo-app" className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 gap-4 shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-blue-600 shadow-sm flex items-center justify-center shrink-0">
              <span className="font-black text-xl tracking-tighter text-white">R</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-2xl tracking-tight text-slate-900">Respondo</h1>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px] font-mono font-bold">
                  v3.0 Real
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Chatea menos, <strong className="text-blue-600 font-semibold">Vendé más.</strong>
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-6">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Prospectos</span>
              <span className="font-mono text-sm font-bold text-slate-800">{totalLeads} activos</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Conversión</span>
              <span className="font-mono text-sm font-bold text-blue-600">{convRate}% cierre</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Ventas</span>
              <span className="font-mono text-sm font-bold text-emerald-600">${totalSales.toLocaleString("es-AR")} ARS</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Base de datos</span>
              <span className={`text-xs font-bold px-2.5 py-1 border rounded-lg flex items-center gap-1.5 ${apiError ? "text-red-600 bg-red-50 border-red-200" : "text-slate-700 bg-slate-50 border-slate-200"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${apiError ? "bg-red-500" : "bg-green-500 animate-pulse"}`} />
                {apiError ? "Local" : "Supabase"}
              </span>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="flex bg-white p-1 border border-slate-200 rounded-2xl overflow-x-auto gap-1 shadow-sm">
          {([
            ["playground", <MessageSquare size={14} />, "Estudio IA (Entrenamiento y Chat)"],
            ["crm",        <Users size={14} />,        "CRM de Ventas & Meta API"],
            ["analytics",  <BarChart3 size={14} />,    "Métricas & Analíticas"],
            ["integrations",<Layers size={14} />,      "Integraciones & White Label"],
            ["compare",    <HelpCircle size={14} />,   "Comparativa Chatbots"],
          ] as [TabType, React.ReactNode, string][]).map(([tab, icon, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === tab ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </nav>

        {/* Activity Stream */}
        {notifications.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-start gap-3 shadow-sm">
            <Bell size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Actividad en Vivo</span>
              <div className="space-y-1 max-h-[80px] overflow-y-auto pr-2">
                {notifications.map((n, i) => (
                  <p key={i} className="text-[11px] text-slate-600 truncate leading-relaxed">• {n}</p>
                ))}
              </div>
            </div>
            <button
              onClick={() => setNotifications([])}
              className="text-[9px] text-slate-500 hover:text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 shrink-0"
            >
              Limpiar
            </button>
          </div>
        )}

        {/* API error banner */}
        {apiError && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2 text-xs text-amber-800">
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
              <motion.div key="integrations" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <WhiteLabelStudio />
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
