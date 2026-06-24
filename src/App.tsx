import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  MessageSquare,
  Users,
  BarChart3,
  Layers,
  Settings,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Activity,
  Award,
  Globe,
  Bell,
  CheckCircle2,
  Lock
} from "lucide-react";

// Types
import { AgentConfig, CRMLead, Campaign, AgentAction } from "./types";

// Shared Data
import { DEFAULT_CONFIG, INITIAL_LEADS, INITIAL_CAMPAIGNS } from "./data";

// Modular Components
import AgentTrainer from "./components/AgentTrainer";
import ChatSimulator from "./components/ChatSimulator";
import CRMAdmin from "./components/CRMAdmin";
import AnalyticsPanel from "./components/AnalyticsPanel";
import ComparisonTable from "./components/ComparisonTable";
import WhiteLabelStudio from "./components/WhiteLabelStudio";

type TabType = "playground" | "crm" | "analytics" | "integrations" | "compare";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("playground");
  const [config, setConfig] = useState<AgentConfig>(() => {
    const saved = localStorage.getItem("respondo_agent_config");
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  const [leads, setLeads] = useState<CRMLead[]>(() => {
    const saved = localStorage.getItem("respondo_crm_leads");
    return saved ? JSON.parse(saved) : INITIAL_LEADS;
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const saved = localStorage.getItem("respondo_campaigns");
    return saved ? JSON.parse(saved) : INITIAL_CAMPAIGNS;
  });
  const [notifications, setNotifications] = useState<string[]>([
    "🎉 ¡Bienvenido! Has ingresado al simulador oficial de Respondo AI.",
    "📈 Conversión: El cliente Agustín Almendra pasó de 'Nuevo' a 'Contactado' tras la última respuesta del bot."
  ]);

  // Save changes to localStorage to enable 100% persistence in reality
  useEffect(() => {
    localStorage.setItem("respondo_agent_config", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem("respondo_crm_leads", JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem("respondo_campaigns", JSON.stringify(campaigns));
  }, [campaigns]);

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const addNotification = (text: string) => {
    setNotifications((prev) => [text, ...prev.slice(0, 4)]);
  };

  // Callback to log active simulation events to the global notification stream
  const handleLeadMessageAdded = (text: string, role: "user" | "model") => {
    if (role === "user") {
      addNotification(`💬 Cliente envió un mensaje en el simulador: "${text.substring(0, 45)}${text.length > 45 ? "..." : ""}"`);
    } else {
      addNotification(`🤖 Respondo AI contestó: "${text.substring(0, 45)}${text.length > 45 ? "..." : ""}"`);
    }
  };

  // Applies the tool-use actions the agent performed (function calling) to the
  // real CRM state, so the chatbot can actually create/move leads on its own.
  const handleAgentActions = (actions: AgentAction[]) => {
    actions.forEach((action) => {
      addNotification(action.label);

      if (action.type === "upsert_lead") {
        const { nombre, telefono, interes, canal } = action.payload;
        const allowedChannels = ["WhatsApp", "Instagram", "Facebook"];
        setLeads((prev) => {
          const idx = prev.findIndex(
            (l) =>
              (telefono && l.phone === telefono) ||
              l.name.toLowerCase() === String(nombre || "").toLowerCase()
          );
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              notes: interes || updated[idx].notes,
              lastInteraction: "Ahora",
            };
            return updated;
          }
          const newLead: CRMLead = {
            id: `lead-${Date.now()}`,
            name: nombre || "Cliente sin identificar",
            phone: telefono || "Sin teléfono",
            status: "Nuevo",
            origin: (allowedChannels.includes(canal) ? canal : "WhatsApp") as CRMLead["origin"],
            lastInteraction: "Ahora",
            score: 70,
            notes: interes || "",
            avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nombre || "Cliente")}`,
            totalSpent: 0,
            conversationHistory: [],
          };
          return [newLead, ...prev];
        });
      } else if (action.type === "update_lead_status") {
        const { nombre, estado, nota } = action.payload;
        setLeads((prev) =>
          prev.map((l) =>
            l.name.toLowerCase() === String(nombre || "").toLowerCase()
              ? {
                  ...l,
                  status: estado as CRMLead["status"],
                  notes: nota || l.notes,
                  lastInteraction: "Ahora",
                }
              : l
          )
        );
      }
      // schedule_followup & payment_link surface in the activity stream above.
    });
  };

  // Real, dynamic workspace metrics calculated from active CRM leads
  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => l.status === "Cerrado").length;
  const totalSalesAmount = leads.reduce((acc, l) => acc + (l.totalSpent || 0), 0);
  const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

  return (
    <div id="respondo-app" className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Subtle light accent background line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Navigation & Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 gap-4 shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-blue-600 shadow-sm flex items-center justify-center shrink-0">
              <span className="font-sans font-black text-xl tracking-tighter text-white">
                R
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-sans font-black text-2xl tracking-tight text-slate-900">Respondo</h1>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px] font-mono font-bold">
                  v2.8 Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Chatea menos, <strong className="text-blue-600 font-semibold">Vendé más.</strong>
              </p>
            </div>
          </div>

          {/* Real operational stats based on CRM leads */}
          <div className="hidden lg:flex items-center space-x-6">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Prospectos Totales</span>
              <span className="font-mono text-sm font-bold text-slate-800">{totalLeads} Activos</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-200" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Tasa de Conversión</span>
              <span className="font-mono text-sm font-bold text-blue-600">{conversionRate}% Cierre</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-200" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Ventas Concretadas</span>
              <span className="font-mono text-sm font-bold text-emerald-600">${totalSalesAmount.toLocaleString("es-AR")} ARS</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-200" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Estado de Servidor</span>
              <span className="text-xs text-slate-700 font-bold bg-slate-50 px-2.5 py-1 border border-slate-200 rounded-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> 100% Real
              </span>
            </div>
          </div>
        </header>

        {/* Navigation Tabs bar */}
        <nav className="flex bg-white p-1 border border-slate-200 rounded-2xl overflow-x-auto gap-1 shadow-sm">
          <button
            onClick={() => setActiveTab("playground")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === "playground"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <MessageSquare size={14} />
            Estudio de IA (Entrenamiento y Chat)
          </button>
          <button
            onClick={() => setActiveTab("crm")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === "crm"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Users size={14} />
            CRM de Ventas & Meta API
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === "analytics"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <BarChart3 size={14} />
            Métricas & Analíticas
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === "integrations"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Layers size={14} />
            Integraciones & White Label
          </button>
          <button
            onClick={() => setActiveTab("compare")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === "compare"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <HelpCircle size={14} />
            Comparativa Chatbots
          </button>
        </nav>

        {/* Live Activity Stream (Toast bar for demo immersion) */}
        {notifications.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-start gap-3 shadow-sm">
            <Bell size={15} className="text-blue-600 shrink-0 mt-0.5 animate-bounce" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Actividad de la Plataforma en Vivo
              </span>
              <div className="space-y-1.5 max-h-[80px] overflow-y-auto pr-2">
                {notifications.map((notif, i) => (
                  <p key={i} className="text-[11px] text-slate-600 truncate leading-relaxed">
                    • {notif}
                  </p>
                ))}
              </div>
            </div>
            <button
              onClick={handleClearNotifications}
              className="text-[9px] text-slate-500 hover:text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 shrink-0 transition-colors"
            >
              Limpiar logs
            </button>
          </div>
        )}

        {/* Tabs Main Panels */}
        <main className="min-h-[500px]">
          <AnimatePresence mode="wait">
            
            {/* Tab: AI Playground & Training */}
            {activeTab === "playground" && (
              <motion.div
                key="playground"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* Left Side: Training Form (7 columns on large grids) */}
                <div className="lg:col-span-7">
                  <AgentTrainer config={config} onChange={setConfig} />
                </div>

                {/* Right Side: Interactive Mobile Chatbot Simulator (5 columns on large grids) */}
                <div className="lg:col-span-5 h-[620px]">
                  <ChatSimulator config={config} onLeadMessageAdded={handleLeadMessageAdded} onAgentActions={handleAgentActions} />
                </div>
              </motion.div>
            )}

            {/* Tab: Native CRM Dashboard */}
            {activeTab === "crm" && (
              <motion.div
                key="crm"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <CRMAdmin 
                  leads={leads} 
                  setLeads={setLeads} 
                  campaigns={campaigns} 
                  setCampaigns={setCampaigns} 
                />
              </motion.div>
            )}

            {/* Tab: Analytics & Metrics Dashboard */}
            {activeTab === "analytics" && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <AnalyticsPanel 
                  leads={leads} 
                  campaigns={campaigns} 
                  config={config} 
                />
              </motion.div>
            )}

            {/* Tab: Integrations & White Label Agency Studio */}
            {activeTab === "integrations" && (
              <motion.div
                key="integrations"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <WhiteLabelStudio />
              </motion.div>
            )}

            {/* Tab: Comparison Matrix */}
            {activeTab === "compare" && (
              <motion.div
                key="compare"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <ComparisonTable />
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* Footer info brand */}
        <footer className="text-center pt-8 border-t border-slate-200 text-xs text-slate-400 space-y-2">
          <p>
            Respondo — Tu infraestructura de automatización de ventas inteligente y gestor de clientes en tiempo real.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-600" /> Encriptación de Datos de Extremo a Extremo
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Zap size={12} className="text-blue-600" /> Servidores Cloud en Latencia Ultra Baja
            </span>
          </div>
        </footer>

      </div>
    </div>
  );
}
