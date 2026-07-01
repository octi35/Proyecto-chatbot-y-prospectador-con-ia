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
  Settings,
} from "lucide-react";

import { AgentConfig, CRMLead, Campaign, AgentAction } from "./types";
import { DEFAULT_CONFIG } from "./data";
import { DEMO_LEADS, DEMO_CAMPAIGNS } from "./demoData";
import {
  getConfig, saveConfig,
  getLeads, createLead, updateLead, deleteLead,
  getCampaigns, createCampaign, updateCampaign,
  authLogout, claimLegacy, getSession,
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
    authLogout(); // clears the Supabase session tokens
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
  const [navExpanded, setNavExpanded] = useState(false);

  // Ref to avoid stale closure in pending config saves
  const pendingConfigSave = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // INITIAL LOAD from API
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // No session and no demo flag → the Login screen is showing; skip loading
    if (!authedUser) return;
    (async () => {
      try {
        setLoading(true);
        setIsDemo(false);
        // Adopt rows created before multi-account (one-time, no-op afterwards)
        if (getSession()) await claimLegacy().catch(() => {});
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
        // Not authenticated / API unreachable → demo mode with sample data
        setLeads(DEMO_LEADS);
        setCampaigns(DEMO_CAMPAIGNS);
        setIsDemo(true);
        addNotification("Mostrando datos de demostración. Iniciá sesión con una cuenta real para usar tus datos.");
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedUser]);

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
      <div className="min-h-screen bg-[#f7f8fc] flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="text-[#4f6ef7] animate-spin" />
        <p className="text-sm text-[#6b7280] font-medium tracking-tight">Cargando Respondo…</p>
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
    dashboard: "Panel general", playground: "Estudio IA", crm: "CRM de Ventas",
    analytics: "Métricas", integrations: "Integraciones", help: "Centro de ayuda",
  };
  const brandName = config.businessName && config.businessName !== "Mi Negocio" ? config.businessName : "Respondo";

  return (
    <div id="respondo-app" className="h-screen overflow-hidden bg-[#f7f8fc] text-[#111111] font-sans selection:bg-[#4f6ef7]/20 selection:text-[#4f6ef7]">
      {/* ===================== SIDEBAR (dark floating rail, expands on hover) ===================== */}
      <motion.aside
        onMouseEnter={() => setNavExpanded(true)}
        onMouseLeave={() => setNavExpanded(false)}
        animate={{ width: navExpanded ? 252 : 88 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="hidden md:flex fixed left-3 top-3 bottom-3 z-40 flex-col bg-[#232323] rounded-[26px] py-5 overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
      >
        {/* Brand */}
        <div className="flex items-center h-9 pl-[26px] pr-4 mb-8 shrink-0">
          <div className="w-9 h-9 rounded-[12px] bg-[#4f6ef7] flex items-center justify-center shrink-0 overflow-hidden">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt={brandName} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
            ) : (
              <span className="font-semibold text-[15px] text-white">R</span>
            )}
          </div>
          <AnimatePresence>
            {navExpanded && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="ml-3 font-semibold text-[15px] text-white whitespace-nowrap">{brandName}</motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(([tab, icon, label, badge]) => {
            const active = activeTab === tab;
            return (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                whileTap={{ scale: 0.97 }}
                className="group relative flex items-center h-11 pl-[22px] pr-4"
              >
                {active ? (
                  <motion.span layoutId="navPill" transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-y-0 left-3 right-3 rounded-[14px] bg-[#4f6ef7]" />
                ) : (
                  <span className="absolute inset-y-0 left-3 right-3 rounded-[14px] bg-transparent group-hover:bg-white/[0.06] transition-colors" />
                )}
                <span className={`relative z-10 w-11 flex items-center justify-center shrink-0 transition-colors ${active ? "text-white" : "text-[#8a8a8a] group-hover:text-white"}`}>
                  {icon}
                </span>
                <AnimatePresence>
                  {navExpanded && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={`relative z-10 ml-1 text-[13.5px] font-medium whitespace-nowrap ${active ? "text-white" : "text-[#b5b5b5] group-hover:text-white"}`}>
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {badge > 0 && (
                  <span className={`z-10 min-w-[18px] h-[18px] px-1 bg-white text-[#111111] text-[10px] font-semibold rounded-full flex items-center justify-center ${navExpanded ? "relative ml-auto" : "absolute top-1.5 right-3.5"}`}>
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Bottom: status + account + logout */}
        <div className="mt-4 shrink-0">
          <div className="flex items-center h-8 pl-[22px] pr-4">
            <span className="w-11 flex items-center justify-center shrink-0">
              <span className={`w-2 h-2 rounded-full ${isDemo ? "bg-[#8a8a8a]" : "bg-[#7dd87d] animate-pulse"}`} />
            </span>
            <AnimatePresence>
              {navExpanded && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="ml-1 text-[12px] text-[#8a8a8a] whitespace-nowrap">{isDemo ? "Modo demo" : "Conectado"}</motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center h-12 pl-[22px] pr-4">
            <span className="w-11 flex items-center justify-center shrink-0">
              <span className="w-8 h-8 rounded-full bg-[#4f6ef7] flex items-center justify-center text-white text-[12px] font-semibold" title={authedUser || ""}>
                {(authedUser || "U").charAt(0).toUpperCase()}
              </span>
            </span>
            <AnimatePresence>
              {navExpanded && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-1 flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-white truncate">{authedUser || "Usuario"}</p>
                  <p className="text-[11px] text-[#8a8a8a] truncate">Cuenta</p>
                </motion.div>
              )}
            </AnimatePresence>
            {navExpanded && (
              <button onClick={handleLogout} title="Cerrar sesión" className="relative z-10 text-[#8a8a8a] hover:text-white transition-colors cursor-pointer shrink-0">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ===================== MAIN ===================== */}
      <div className="h-screen flex flex-col md:pl-[112px]">
        {/* Top bar (white floating card) */}
        <header className="shrink-0 px-4 md:px-6 pt-4 md:pt-5">
          <div className="bg-white rounded-[22px] shadow-card h-16 flex items-center gap-3 px-4 md:px-5">
            {/* Mobile tab selector */}
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabType)}
              className="md:hidden bg-[#f3f5fb] rounded-full px-3 py-1.5 text-[13px] font-medium text-[#111111] focus:outline-none cursor-pointer"
            >
              {NAV_ITEMS.map(([tab, , label]) => <option key={tab} value={tab}>{label}</option>)}
            </select>

            {/* Breadcrumb + title */}
            <div className="hidden md:block shrink-0">
              <p className="text-[12px] text-[#9ca3af] leading-none">Workspace <span className="mx-1 text-[#cbd0e0]">/</span> {brandName}</p>
              <h1 className="text-[18px] font-semibold tracking-tight text-[#111111] mt-1">{pageTitle[activeTab]}</h1>
            </div>

            {/* Search */}
            <div className="flex-1 flex justify-center px-2">
              <div className="relative w-full max-w-md">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar campañas, clientes, copys…"
                  className="w-full bg-[#f3f5fb] rounded-full pl-11 pr-4 h-10 text-[13px] text-[#111111] placeholder:text-[#9ca3af] border-0 outline-none focus:bg-[#eef1fe] focus:ring-2 focus:ring-[#4f6ef7]/25 transition-all"
                />
              </div>
            </div>

            {/* Actions */}
            <button onClick={() => setActiveTab("help")} title="Ayuda" className="hidden sm:flex w-10 h-10 rounded-full hover:bg-[#f3f5fb] items-center justify-center text-[#6b7280] transition-colors cursor-pointer shrink-0">
              <HelpCircle size={18} />
            </button>

            {/* Notifications bell + dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowNotifPanel((v) => !v)}
                title="Notificaciones"
                className="relative w-10 h-10 rounded-full hover:bg-[#f3f5fb] flex items-center justify-center text-[#6b7280] transition-colors cursor-pointer"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-[#4f6ef7] rounded-full ring-2 ring-white" />
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
                      className="absolute right-0 mt-3 w-80 bg-white rounded-[18px] shadow-[0_16px_45px_rgba(15,23,42,0.14)] z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[#ececec]">
                        <span className="text-[13px] font-semibold text-[#111111]">Notificaciones</span>
                        {notifications.length > 0 && (
                          <button onClick={() => setNotifications([])} className="text-[11px] text-[#4f6ef7] hover:underline">Limpiar</button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {hotLeads > 0 && (
                          <div className="px-4 py-3 bg-[#fff6d6] flex items-center gap-2 border-b border-[#ececec]">
                            <Flame size={14} className="text-[#a16207] shrink-0" />
                            <div className="flex-1">
                              <p className="text-[12.5px] font-semibold text-[#a16207]">{hotLeads} lead{hotLeads !== 1 ? "s" : ""} caliente{hotLeads !== 1 ? "s" : ""} ahora</p>
                              <button onClick={() => { setActiveTab("crm"); setShowNotifPanel(false); }} className="text-[11px] text-[#a16207] hover:underline">Ver en el CRM →</button>
                            </div>
                          </div>
                        )}
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <Bell size={20} className="text-[#cbd0e0] mx-auto mb-1.5" />
                            <p className="text-[12px] text-[#9ca3af]">Sin notificaciones nuevas</p>
                          </div>
                        ) : (
                          notifications.map((n, i) => (
                            <div key={i} className="px-4 py-2.5 border-b last:border-0 hover:bg-[#f3f5fb] transition-colors border-[#f0f1f5]">
                              <p className="text-[12px] text-[#111111] leading-snug">{n}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button title="Ajustes" className="hidden sm:flex w-10 h-10 rounded-full hover:bg-[#f3f5fb] items-center justify-center text-[#6b7280] transition-colors cursor-pointer shrink-0">
              <Settings size={18} />
            </button>

            {/* Account chip */}
            <div className="flex items-center gap-2.5 pl-1 sm:pl-2 shrink-0">
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-[13px] font-semibold text-[#111111]">{brandName}</p>
                <p className="text-[11px] text-[#9ca3af]">Agencia IA</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#4f6ef7] flex items-center justify-center text-white text-[12px] font-semibold shrink-0">
                {brandName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Demo-mode pill (subtle) */}
        {isDemo && (
          <div className="mx-4 md:mx-6 mt-4 bg-white rounded-[18px] shadow-card px-4 py-2.5 flex items-center gap-2 text-[12.5px] text-[#6b7280]">
            <Sparkles size={13} className="shrink-0 text-[#4f6ef7]" />
            <span><span className="font-medium text-[#111111]">Modo demostración</span> — datos de ejemplo. Conectá Supabase para usar tus datos reales.</span>
          </div>
        )}

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 pb-8 pt-5">
          <div className="max-w-[1560px] mx-auto w-full">
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && (
                <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
                  <DashboardHome leads={leads} campaigns={campaigns} config={config} onNavigate={(t) => setActiveTab(t as TabType)} />
                </motion.div>
              )}

              {activeTab === "playground" && (
                <motion.div key="playground" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
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
                <motion.div key="crm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
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
                <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
                  <AnalyticsPanel leads={leads} campaigns={campaigns} config={config} />
                </motion.div>
              )}

              {activeTab === "integrations" && (
                <motion.div key="integrations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }} className="space-y-8">
                  <ChannelConnect />
                  <AutomationRules />
                  <WaTemplateManager />
                </motion.div>
              )}

              {activeTab === "help" && (
                <motion.div key="help" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
                  <HelpGuide onNavigate={(t) => setActiveTab(t as TabType)} />
                </motion.div>
              )}
            </AnimatePresence>

            <footer className="text-center mt-14 pt-6 text-[11px] text-[#9ca3af] flex items-center justify-center gap-3">
              <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-[#9ca3af]" /> Supabase</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Zap size={11} className="text-[#9ca3af]" /> Gemini AI</span>
            </footer>
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
