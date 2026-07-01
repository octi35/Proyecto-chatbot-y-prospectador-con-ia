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
  LayoutGrid,
  Search,
  LogOut,
  Flame,
} from "lucide-react";

import { AgentConfig, CRMLead, Campaign, AgentAction } from "./types";
import { DEFAULT_CONFIG } from "./data";
import { DEMO_LEADS, DEMO_CAMPAIGNS } from "./demoData";
import {
  getConfig, saveConfig,
  getLeads, createLead, updateLead, deleteLead,
  getCampaigns, createCampaign, updateCampaign,
} from "./lib/api";

import AgentTrainer from "./components/AgentTrainer";
import ChatSimulator from "./components/ChatSimulator";
import CRMAdmin from "./components/CRMAdmin";
import AnalyticsPanel from "./components/AnalyticsPanel";
import HelpGuide from "./components/HelpGuide";
import ChannelConnect from "./components/ChannelConnect";
import AutomationRules from "./components/AutomationRules";
import WaTemplateManager from "./components/WaTemplateManager";
import DashboardHome from "./components/DashboardHome";
import Login from "./components/Login";
import { Toaster, toast } from "./components/ui/toast";

type TabType = "dashboard" | "playground" | "crm" | "analytics" | "integrations" | "help";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  // Auth gate (no backend yet → persisted local session)
  const [authedUser, setAuthedUser] = useState<string | null>(() => {
    try { return localStorage.getItem("respondo_user"); } catch { return null; }
  });
  const handleLogin = useCallback((email: string) => {
    try { localStorage.setItem("respondo_user", email); } catch { /* ignore */ }
    setAuthedUser(email);
  }, []);
  const handleLogout = useCallback(() => {
    try { localStorage.removeItem("respondo_user"); } catch { /* ignore */ }
    setAuthedUser(null);
  }, []);

  // Data state (loaded from API)
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [newLeadsBadge, setNewLeadsBadge] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

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
        // Fall back to demo data so the UI never looks empty on a fresh account
        setLeads(serverLeads.length > 0 ? serverLeads : DEMO_LEADS);
        setCampaigns(serverCampaigns.length > 0 ? serverCampaigns : DEMO_CAMPAIGNS);
        if (serverLeads.length === 0) setIsDemo(true);
        addNotification("✅ Datos cargados desde la base de datos.");
      } catch (e) {
        // API unreachable → run in demo mode with realistic sample data
        setLeads(DEMO_LEADS);
        setCampaigns(DEMO_CAMPAIGNS);
        setIsDemo(true);
        addNotification("Mostrando datos de demostración. Conectá Supabase para usar tus datos reales.");
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
    // Surface a stylized toast for important events (leads, errors)
    if (/lead|🔥|error|⚠️/i.test(text)) {
      if (/error|⚠️/i.test(text)) toast.error(text.replace(/[⚠️]/g, "").trim());
      else toast.info(text.replace(/[📲🔥✅]/g, "").trim());
    }
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
  // Auth gate — show the login screen until there's a session
  if (!authedUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfb] flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="text-[#0a0a0a] animate-spin" />
        <p className="text-sm text-[#71717a] font-medium tracking-tight">Cargando Respondo…</p>
      </div>
    );
  }

  const NAV_ITEMS: [TabType, React.ReactNode, string, number][] = [
    ["dashboard",    <LayoutGrid size={18} />,     "Dashboard",      0],
    ["playground",   <MessageSquare size={18} />,  "Estudio IA",     0],
    ["crm",          <Users size={18} />,          "CRM de Ventas",  newLeadsBadge],
    ["analytics",    <BarChart3 size={18} />,      "Métricas",       0],
    ["integrations", <Layers size={18} />,         "Integraciones",  0],
    ["help",         <HelpCircle size={18} />,     "Ayuda",          0],
  ];
  const pageTitle: Record<TabType, string> = {
    dashboard: "Dashboard", playground: "Estudio IA", crm: "CRM de Ventas",
    analytics: "Métricas", integrations: "Integraciones", help: "Centro de ayuda",
  };

  return (
    <div id="respondo-app" className="min-h-screen bg-[#fbfbfb] text-[#0a0a0a] font-sans selection:bg-[#4f46e5]/15 selection:text-[#4f46e5] flex">
      {/* ===================== SIDEBAR (near-black thin rail) ===================== */}
      <aside className="hidden md:flex flex-col items-center w-[72px] shrink-0 h-screen sticky top-0 py-4 z-20 border-r border-black/[0.06]">
        {/* Brand mark */}
        <div className="w-9 h-9 rounded-[10px] bg-[#0a0a0a] flex items-center justify-center shrink-0 overflow-hidden mb-8">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt={config.businessName} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <span className="font-semibold text-[15px] text-white">R</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {NAV_ITEMS.map(([tab, icon, label, badge]) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              title={label}
              className={`group relative w-10 h-10 rounded-[10px] flex items-center justify-center transition-colors duration-150 ${
                activeTab === tab
                  ? "bg-[#0a0a0a] text-white"
                  : "text-[#a1a1aa] hover:bg-black/[0.05] hover:text-[#0a0a0a]"
              }`}
            >
              {icon}
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-[#4f46e5] text-white text-[9px] font-semibold rounded-full flex items-center justify-center ring-2 ring-[#fbfbfb]">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-[calc(100%+12px)] whitespace-nowrap px-2 py-1 rounded-md bg-[#0a0a0a] text-white text-[11.5px] font-medium opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all z-50">
                {label}
              </span>
            </motion.button>
          ))}
        </nav>

        {/* Bottom: account + logout */}
        <div className="flex flex-col items-center gap-3 mt-4">
          <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? "bg-[#a1a1aa]" : "bg-[#16a34a] animate-pulse"}`} title={isDemo ? "Modo demo" : "Conectado"} />
          <div className="w-8 h-8 rounded-full bg-[#0a0a0a] flex items-center justify-center text-white text-[12px] font-semibold shrink-0" title={authedUser || ""}>
            {(authedUser || "U").charAt(0).toUpperCase()}
          </div>
          <button onClick={handleLogout} title="Cerrar sesión" className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[#a1a1aa] hover:bg-black/[0.05] hover:text-[#0a0a0a] transition-colors cursor-pointer">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* ===================== MAIN ===================== */}
      <div className="flex-1 min-w-0 flex flex-col h-screen relative z-10">
        {/* Top bar */}
        <header className="shrink-0 bg-[#fbfbfb]/85 backdrop-blur-xl px-4 sm:px-8 h-16 flex items-center gap-4 sticky top-0 z-30 border-b border-black/[0.06]">
          {/* Mobile tab selector */}
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as TabType)}
            className="md:hidden bg-white border border-black/[0.09] rounded-[10px] px-2 py-1.5 text-[13px] font-medium text-[#0a0a0a] focus:outline-none cursor-pointer"
          >
            {NAV_ITEMS.map(([tab, , label]) => <option key={tab} value={tab}>{label}</option>)}
          </select>
          <h1 className="hidden md:block text-[18px] font-semibold tracking-tight text-[#0a0a0a] shrink-0">{pageTitle[activeTab]}</h1>

          {/* Search bar */}
          <div className="hidden md:flex flex-1 max-w-xs mx-2">
            <div className="relative w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar…"
                className="w-full bg-white rounded-[10px] pl-9 pr-3 h-9 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] border border-black/[0.09] focus:outline-none focus:border-[#4f46e5] focus:ring-[3px] focus:ring-[#4f46e5]/10 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 md:hidden" />

          {/* Create → goes to chat playground */}
          <motion.button
            onClick={() => setActiveTab("playground")}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="bg-[#0a0a0a] hover:bg-[#262626] text-white text-[13px] font-medium px-3.5 h-9 rounded-[10px] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Sparkles size={14} /> <span className="hidden sm:inline">Probar IA</span>
          </motion.button>

          {/* Notifications bell + dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifPanel((v) => !v)}
              className="relative w-9 h-9 rounded-[10px] bg-white hover:bg-[#fafafa] border border-black/[0.09] flex items-center justify-center text-[#71717a] transition-colors cursor-pointer"
              title="Notificaciones"
            >
              <Bell size={15} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 bg-[#4f46e5] text-white text-[8px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#fbfbfb]">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showNotifPanel && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-[14px] border border-black/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06]">
                      <span className="text-[13px] font-semibold text-[#0a0a0a]">Notificaciones</span>
                      {notifications.length > 0 && (
                        <button onClick={() => setNotifications([])} className="text-[11px] text-[#4f46e5] hover:underline">Limpiar</button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {hotLeads > 0 && (
                        <div className="px-4 py-3 bg-[#fefce8] flex items-center gap-2 border-b border-black/[0.05]">
                          <Flame size={14} className="text-[#a16207] shrink-0" />
                          <div className="flex-1">
                            <p className="text-[12.5px] font-semibold text-[#a16207]">{hotLeads} lead{hotLeads !== 1 ? "s" : ""} caliente{hotLeads !== 1 ? "s" : ""} ahora</p>
                            <button onClick={() => { setActiveTab("crm"); setShowNotifPanel(false); }} className="text-[11px] text-[#a16207] hover:underline">Ver en el CRM →</button>
                          </div>
                        </div>
                      )}
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell size={20} className="text-[#d4d4d8] mx-auto mb-1.5" />
                          <p className="text-[12px] text-[#a1a1aa]">Sin notificaciones nuevas</p>
                        </div>
                      ) : (
                        notifications.map((n, i) => (
                          <div key={i} className="px-4 py-2.5 border-b last:border-0 hover:bg-[#fafafa] transition-colors border-black/[0.04]">
                            <p className="text-[12px] text-[#0a0a0a] leading-snug">{n}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-[#0a0a0a] flex items-center justify-center text-white text-[12px] font-semibold shrink-0">
            {(config.businessName || "R").charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Demo-mode pill (subtle) */}
        {isDemo && (
          <div className="mx-4 sm:mx-8 mt-6 bg-white rounded-[12px] px-4 py-2.5 flex items-center gap-2 text-[12.5px] text-[#71717a] border border-black/[0.07]">
            <Sparkles size={13} className="shrink-0 text-[#4f46e5]" />
            <span><span className="font-medium text-[#0a0a0a]">Modo demostración</span> — datos de ejemplo. Conectá Supabase para usar tus datos reales.</span>
          </div>
        )}

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <DashboardHome leads={leads} campaigns={campaigns} config={config} onNavigate={(t) => setActiveTab(t as TabType)} />
              </motion.div>
            )}

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
                <AutomationRules />
                <WaTemplateManager />
              </motion.div>
            )}

            {activeTab === "help" && (
              <motion.div key="help" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <HelpGuide onNavigate={(t) => setActiveTab(t as TabType)} />
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="text-center mt-14 pt-6 text-[11px] text-[#a1a1aa] flex items-center justify-center gap-3">
            <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-[#a1a1aa]" /> Supabase</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Zap size={11} className="text-[#a1a1aa]" /> Gemini AI</span>
          </footer>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
