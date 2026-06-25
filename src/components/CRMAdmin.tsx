import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Send,
  CheckCheck,
  Plus,
  Filter,
  User,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Target,
  FileSpreadsheet,
  AlertCircle,
  UserCheck,
  Zap,
  Tag,
  ArrowRight,
  Trash2,
  Search,
} from "lucide-react";
import { CRMLead, Campaign } from "../types";

interface CRMAdminProps {
  leads: CRMLead[];
  setLeads: React.Dispatch<React.SetStateAction<CRMLead[]>>;
  campaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  onLeadUpdate?: (id: string, patch: Partial<CRMLead>) => Promise<CRMLead>;
  onLeadDelete?: (id: string) => Promise<void>;
  onCampaignCreate?: (campaign: Omit<Campaign, "id">) => Promise<Campaign>;
}

export default function CRMAdmin({ leads, setLeads, campaigns, setCampaigns, onLeadUpdate, onLeadDelete, onCampaignCreate }: CRMAdminProps) {
  // Selection States
  const [activeTab, setActiveTab] = useState<"pipeline" | "broadcast">("pipeline");
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(leads[0] || null);
  const [manualOverrideActive, setManualOverrideActive] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null); // null = not editing
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  // Broadcasting Campaign Form States
  const [newCampName, setNewCampName] = useState("");
  const [newCampTemplate, setNewCampTemplate] = useState("Hola {{nombre}}, te escribimos de {{empresa}} porque tenemos novedades especiales para vos...");
  const [newCampSegment, setNewCampSegment] = useState("Todos los contactos");
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);

  const handleDeleteSelectedLead = async () => {
    if (!selectedLead || !onLeadDelete) return;
    setIsDeletingLead(true);
    try {
      await onLeadDelete(selectedLead.id);
      setLeads((prev) => prev.filter((l) => l.id !== selectedLead.id));
      setSelectedLead(null);
    } catch (e) {
      console.error("Delete lead failed:", e);
    } finally {
      setIsDeletingLead(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedLead || editingNotes === null || !onLeadUpdate) return;
    setIsSavingNotes(true);
    try {
      const updated = await onLeadUpdate(selectedLead.id, { notes: editingNotes });
      setSelectedLead(updated);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setEditingNotes(null);
    } catch (e) {
      console.error("Save notes failed:", e);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const exportCSV = () => {
    const header = ["Nombre", "Teléfono", "Estado", "Canal", "Puntaje", "Última interacción", "Notas"].join(",");
    const rows = leads.map((l) =>
      [l.name, l.phone, l.status, l.origin, l.score, l.lastInteraction, `"${l.notes.replace(/"/g, '""')}"`].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLeads = searchQuery.trim()
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.phone.includes(searchQuery) ||
          l.notes.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : leads;

  // Status Column list
  const COLUMNS: CRMLead["status"][] = ["Nuevo", "Contactado", "Presupuestado", "Cerrado"];

  // Colors based on stage
  const getStageColor = (status: CRMLead["status"]) => {
    switch (status) {
      case "Nuevo": return "bg-sky-50 text-sky-700 border-sky-100";
      case "Contactado": return "bg-amber-50 text-amber-700 border-amber-100";
      case "Presupuestado": return "bg-purple-50 text-purple-700 border-purple-100";
      case "Cerrado": return "bg-emerald-50 text-emerald-700 border-emerald-100";
    }
  };

  const getOriginColor = (origin: CRMLead["origin"]) => {
    switch (origin) {
      case "WhatsApp": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Instagram": return "bg-pink-50 text-pink-700 border-pink-100";
      case "Facebook": return "bg-blue-50 text-blue-700 border-blue-100";
    }
  };

  const handleMoveLead = async (leadId: string, nextStatus: CRMLead["status"]) => {
    const patch = { status: nextStatus, lastInteraction: "Ahora" };
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...patch } : l)));
    if (selectedLead?.id === leadId) setSelectedLead((prev) => prev ? { ...prev, ...patch } : prev);
    if (onLeadUpdate) {
      await onLeadUpdate(leadId, patch).catch((e) => console.error("Lead update failed:", e));
    }
  };

  const toggleManualOverride = (leadId: string) => {
    setManualOverrideActive((prev) => {
      const next = !prev[leadId];
      return { ...prev, [leadId]: next };
    });
  };

  const handleLaunchCampaign = async () => {
    if (!newCampName.trim() || !newCampTemplate.trim()) return;

    setIsSendingCampaign(true);
    setSendingProgress(10);

    const progressTick = setInterval(() => {
      setSendingProgress((p) => Math.min(p + 10, 90));
    }, 200);

    try {
      const draft: Omit<Campaign, "id"> = {
        name: newCampName,
        template: newCampTemplate,
        segment: newCampSegment,
        status: "Borrador",
        sentCount: 0,
        readCount: 0,
        repliesCount: 0,
        dateCreated: new Date().toISOString().split("T")[0],
      };

      let saved: Campaign;
      if (onCampaignCreate) {
        saved = await onCampaignCreate(draft);
      } else {
        saved = { ...draft, id: `camp-${Date.now()}` };
        setCampaigns((prev) => [saved, ...prev]);
      }

      // Update to "Enviando" (real Meta API calls would go here)
      clearInterval(progressTick);
      setSendingProgress(100);

      setTimeout(() => {
        setSendingProgress(0);
        setIsSendingCampaign(false);
        setNewCampName("");
      }, 600);
    } catch (e) {
      clearInterval(progressTick);
      setSendingProgress(0);
      setIsSendingCampaign(false);
      console.error("Campaign create failed:", e);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col h-full min-h-[600px]">
      
      {/* CRM Dashboard Tabs */}
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-sans font-semibold text-lg text-slate-900 flex items-center">
            <Users size={18} className="text-blue-600 mr-2" /> Panel de Control CRM Nativo
          </h3>
          <p className="text-xs text-slate-500">Gestiona prospectos, asume chats de la IA y lanza difusiones masivas</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 text-xs rounded-lg font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Exportar leads a CSV"
          >
            <FileSpreadsheet size={13} /> Exportar CSV
          </button>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("pipeline")}
              className={`px-4 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "pipeline"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Embudo de Ventas
            </button>
            <button
              onClick={() => setActiveTab("broadcast")}
              className={`px-4 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "broadcast"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Envíos Masivos (Meta API)
            </button>
          </div>
        </div>
      </div>

      {/* Main CRM Workspace */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: PIPELINE EMBUDO DE VENTAS */}
          {activeTab === "pipeline" && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              className="grid grid-cols-1 lg:grid-cols-12 h-full min-h-[500px]"
            >
              {/* Funnel Columns Left (3 columns on lg grid) */}
              <div className="lg:col-span-8 p-4 border-r border-slate-200 overflow-y-auto space-y-4 max-h-[520px]">
                {/* Search bar */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar leads por nombre, teléfono o notas…"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {COLUMNS.map((col) => {
                    const columnLeads = filteredLeads.filter((l) => l.status === col);
                    return (
                      <div key={col} className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col h-[320px]">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {col}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-200 rounded-full text-[10px] text-slate-600 font-mono border border-slate-300">
                            {columnLeads.length}
                          </span>
                        </div>

                        {/* Leads Cards Container */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                          {columnLeads.map((lead) => (
                            <div
                              key={lead.id}
                              onClick={() => { setSelectedLead(lead); setEditingNotes(null); }}
                              className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                                selectedLead?.id === lead.id
                                  ? "bg-blue-50 border-blue-500 shadow-sm"
                                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center space-x-2 mb-1.5">
                                <img
                                  referrerPolicy="no-referrer"
                                  src={lead.avatar}
                                  alt={lead.name}
                                  className="w-5 h-5 rounded-full object-cover shrink-0"
                                />
                                <span className="text-xs font-bold text-slate-800 truncate">{lead.name}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`text-[8px] font-semibold border px-1.5 py-0.5 rounded-full ${getOriginColor(lead.origin)}`}>
                                  {lead.origin}
                                </span>
                                <span className="text-[9px] text-slate-400">{lead.lastInteraction}</span>
                              </div>
                              <div className="mt-1.5 flex justify-between items-center">
                                <span className="text-[8px] text-slate-500 font-mono block truncate max-w-[70%]">
                                  {lead.notes}
                                </span>
                                <span className={`text-[8px] font-mono font-bold ${lead.score >= 85 ? "text-emerald-600" : lead.score >= 70 ? "text-amber-600" : "text-slate-500"}`}>
                                  {lead.score}% Lead
                                </span>
                              </div>
                            </div>
                          ))}

                          {columnLeads.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-10">
                              <UserCheck size={20} className="text-slate-400 mb-1" />
                              <span className="text-[10px] text-slate-400">Sin contactos en esta etapa</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend Guidelines */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between text-xs text-slate-500 gap-4">
                  <div className="flex items-center space-x-2">
                    <Zap size={14} className="text-amber-500 shrink-0" />
                    <span>
                      <strong className="text-slate-800">Asesoramiento Inteligente:</strong> El CRM de Respondo registra automáticamente a cada prospecto tan pronto inicia el chat, asignándole un puntaje según su intención de compra e interés detectado.
                    </span>
                  </div>
                </div>
              </div>

              {/* Lead Details Right (4 columns on lg grid) */}
              <div className="lg:col-span-4 p-4 flex flex-col h-full max-h-[520px] overflow-y-auto border-l border-slate-150">
                {selectedLead ? (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Avatar Profile */}
                      <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                        <img
                          referrerPolicy="no-referrer"
                          src={selectedLead.avatar}
                          alt={selectedLead.name}
                          className="w-12 h-12 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{selectedLead.name}</h4>
                          <span className="text-xs text-slate-500 block">{selectedLead.phone}</span>
                          <span className={`text-[9px] font-mono font-bold uppercase ${selectedLead.score >= 85 ? "text-emerald-600" : "text-amber-600"}`}>
                            Fidelidad de compra: {selectedLead.score}/100 (Muy Alta)
                          </span>
                        </div>
                      </div>

                      {/* Lead Stage Controls */}
                      <div className="py-3 border-b border-slate-100 space-y-2">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Cambiar Etapa del Embudo
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {COLUMNS.map((stage) => (
                            <button
                              key={stage}
                              onClick={() => handleMoveLead(selectedLead.id, stage)}
                              className={`py-1 px-2 rounded-lg text-[10px] font-semibold border text-center transition-all cursor-pointer ${
                                selectedLead.status === stage
                                  ? `${getStageColor(stage)} border-blue-500`
                                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              {stage}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* CRM Notes — editable */}
                      <div className="py-3 border-b border-slate-100 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Notas del Lead & Interés
                          </span>
                          {onLeadUpdate && editingNotes === null && (
                            <button
                              onClick={() => setEditingNotes(selectedLead.notes)}
                              className="text-[9px] text-blue-600 hover:underline cursor-pointer"
                            >
                              Editar
                            </button>
                          )}
                        </div>
                        {editingNotes !== null ? (
                          <div className="space-y-1.5">
                            <textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              rows={3}
                              className="w-full bg-white border border-blue-300 rounded-xl p-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 resize-none font-mono"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={handleSaveNotes}
                                disabled={isSavingNotes}
                                className="flex-1 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isSavingNotes ? "Guardando…" : "Guardar"}
                              </button>
                              <button
                                onClick={() => setEditingNotes(null)}
                                className="py-1 px-3 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200 transition-all cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 leading-relaxed font-mono min-h-[40px]">
                            {selectedLead.notes || <span className="text-slate-400 italic">Sin notas</span>}
                          </p>
                        )}
                      </div>

                      {/* Conversation Monitoring history */}
                      <div className="py-3 space-y-2">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Monitoreo de Conversación IA
                        </span>
                        <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-[140px] overflow-y-auto">
                          {selectedLead.conversationHistory.map((h, index) => (
                            <div key={index} className="text-[10px] space-y-0.5">
                              <span className={`font-bold block ${h.role === "user" ? "text-blue-600" : "text-slate-500"}`}>
                                {h.role === "user" ? "Cliente:" : "Respondo AI:"}
                              </span>
                              <p className="text-slate-700 italic">"{h.text}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Human Override Controls */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <button
                        onClick={() => toggleManualOverride(selectedLead.id)}
                        className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          manualOverrideActive[selectedLead.id]
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-amber-600 hover:bg-amber-700 text-white"
                        }`}
                      >
                        <User size={14} />
                        {manualOverrideActive[selectedLead.id]
                          ? "Re-activar Agente de IA"
                          : "Intervenir Chat (Derivar a Humano)"}
                      </button>
                      <p className="text-[9px] text-slate-400 text-center">
                        {manualOverrideActive[selectedLead.id]
                          ? "La IA está pausada para este cliente. Escribe manualmente."
                          : "La IA de Respondo responde 24/7 de forma autónoma."}
                      </p>
                      {onLeadDelete && (
                        <button
                          onClick={handleDeleteSelectedLead}
                          disabled={isDeletingLead}
                          className="w-full py-1.5 px-4 rounded-xl text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          {isDeletingLead ? "Eliminando…" : "Eliminar lead"}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                    <UserCheck size={36} className="text-slate-400 mb-2" />
                    <span className="text-xs text-slate-700 font-semibold">Seleccioná un Lead</span>
                    <span className="text-[10px] text-slate-400 max-w-xs mt-1">
                      Haz clic en cualquier tarjeta de prospecto del embudo para ver su historial completo e intervenir.
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: BROADCAST CAMPAIGNS (API OFICIAL META) */}
          {activeTab === "broadcast" && (
            <motion.div
              key="broadcast"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="grid grid-cols-1 lg:grid-cols-12 p-6 gap-6 h-full min-h-[500px]"
            >
              {/* Campaign Composer Left (6 columns) */}
              <div className="lg:col-span-6 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Nueva Campaña Masiva de WhatsApp</h4>
                    <p className="text-[10px] text-slate-400">Envío 100% seguro utilizando la API Oficial de Meta</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Nombre de la Campaña</label>
                    <input
                      type="text"
                      value={newCampName}
                      onChange={(e) => setNewCampName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Ej: Hot Sale Lanzamiento"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Segmento de Audiencia Objetivo</label>
                    <select
                      value={newCampSegment}
                      onChange={(e) => setNewCampSegment(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="Todos los contactos">Todos los contactos ({leads.length} leads activos)</option>
                      <option value="Clientes con Carrito Incompleto">Carritos Abandonados (Inactivos)</option>
                      <option value="Interesados en Camperas (Talle L)">Interesados en Camperas</option>
                      <option value="Compradores Recurrentes">Compradores Recurrentes</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-slate-500">Plantilla de Mensaje (Habilitada por Meta)</label>
                      <span className="text-[9px] text-slate-400 font-mono font-bold">Use {"{{nombre}}"} y {"{{empresa}}"}</span>
                    </div>
                    <textarea
                      value={newCampTemplate}
                      onChange={(e) => setNewCampTemplate(e.target.value)}
                      rows={5}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono leading-relaxed"
                    />
                  </div>
                </div>

                {isSendingCampaign ? (
                  <div className="space-y-2 py-2">
                    <div className="flex justify-between text-xs font-semibold text-emerald-600">
                      <span className="flex items-center gap-1.5">
                        <Zap size={12} className="animate-bounce" /> Procesando envíos Meta API...
                      </span>
                      <span>{sendingProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 border border-slate-300 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${sendingProgress}%` }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-300"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 block text-center italic">
                      Evitando baneos: Respondo realiza el envío utilizando los servidores oficiales de Meta Cloud.
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleLaunchCampaign}
                    className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Send size={12} />
                    Disparar Campaña Masiva
                  </button>
                )}
              </div>

              {/* Campaigns Analytics Right (6 columns) */}
              <div className="lg:col-span-6 flex flex-col space-y-4 max-h-[460px] overflow-y-auto pr-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Campañas Recientes & Métricas de API Oficial
                </span>

                <div className="space-y-3">
                  {campaigns.map((camp) => (
                    <div
                      key={camp.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-bold text-xs text-slate-800">{camp.name}</h5>
                          <span className="text-[9px] px-2 py-0.5 bg-white text-slate-500 border border-slate-200 rounded-full font-mono">
                            Segmento: {camp.segment}
                          </span>
                        </div>
                        <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          camp.status === "Completado"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-400 border-slate-300"
                        }`}>
                          {camp.status}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-600 bg-white p-2 rounded-lg italic border border-slate-200 font-mono">
                        "{camp.template.replace("{{nombre}}", "Agustín").replace("{{empresa}}", "Respondo")}"
                      </p>

                      {camp.status === "Completado" && (
                        <div className="grid grid-cols-3 gap-3 pt-1 text-center">
                          <div className="p-2 bg-white border border-slate-200 rounded-xl">
                            <span className="text-xs font-bold text-slate-800 block font-mono">
                              {camp.sentCount}
                            </span>
                            <span className="text-[9px] text-slate-400 block uppercase font-semibold">Enviados</span>
                          </div>
                          <div className="p-2 bg-white border border-slate-200 rounded-xl">
                            <span className="text-xs font-bold text-sky-600 block font-mono">
                              {Math.round((camp.readCount / camp.sentCount) * 100)}%
                            </span>
                            <span className="text-[9px] text-slate-400 block uppercase font-semibold">Tasa Lectura</span>
                          </div>
                          <div className="p-2 bg-white border border-slate-200 rounded-xl">
                            <span className="text-xs font-bold text-emerald-600 block font-mono">
                              {Math.round((camp.repliesCount / camp.readCount) * 100)}%
                            </span>
                            <span className="text-[9px] text-slate-400 block uppercase font-semibold">Respuestas</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
