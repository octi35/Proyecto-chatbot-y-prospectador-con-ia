import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Send,
  CheckCheck,
  Plus,
  User,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  UserCheck,
  Zap,
  Trash2,
  Search,
  Phone,
  ChevronRight,
} from "lucide-react";
import { CRMLead, Campaign } from "../types";
import { makeAvatarUrl } from "../lib/avatar";
import { timeAgo } from "../lib/timeAgo";
import { sendLeadMessage, sendCampaign } from "../lib/api";

interface CRMAdminProps {
  leads: CRMLead[];
  setLeads: React.Dispatch<React.SetStateAction<CRMLead[]>>;
  campaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  onLeadUpdate?: (id: string, patch: Partial<CRMLead>) => Promise<CRMLead>;
  onLeadDelete?: (id: string) => Promise<void>;
  onLeadCreate?: (lead: Omit<CRMLead, "id">) => Promise<CRMLead>;
  onCampaignCreate?: (campaign: Omit<Campaign, "id">) => Promise<Campaign>;
}

export default function CRMAdmin({ leads, setLeads, campaigns, setCampaigns, onLeadUpdate, onLeadDelete, onLeadCreate, onCampaignCreate }: CRMAdminProps) {
  // Selection States
  const [activeTab, setActiveTab] = useState<"pipeline" | "broadcast">("pipeline");
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(leads[0] || null);
  const [manualOverrideActive, setManualOverrideActive] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<CRMLead["origin"] | "Todos">("Todos");
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null); // null = not editing
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadOrigin, setNewLeadOrigin] = useState<CRMLead["origin"]>("WhatsApp");
  const [isAddingLead, setIsAddingLead] = useState(false);
  
  // Manual message state (human override)
  const [manualMessage, setManualMessage] = useState("");
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [manualSendFeedback, setManualSendFeedback] = useState<string | null>(null);

  const handleSendManualMessage = async () => {
    if (!selectedLead || !manualMessage.trim()) return;
    setIsSendingManual(true);
    setManualSendFeedback(null);
    try {
      const result = await sendLeadMessage(selectedLead.id, manualMessage.trim());
      setManualMessage("");
      setManualSendFeedback(result.sent ? "✅ Enviado por WhatsApp" : `💾 ${result.note || "Guardado en historial"}`);
      // Update local conversation history
      const newMsg = { role: "model" as const, text: manualMessage.trim(), timestamp: new Date().toISOString() };
      setSelectedLead((prev) => prev ? { ...prev, conversationHistory: [...prev.conversationHistory, newMsg], lastInteraction: newMsg.timestamp } : prev);
      setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, conversationHistory: [...l.conversationHistory, newMsg], lastInteraction: newMsg.timestamp } : l));
    } catch (e) {
      setManualSendFeedback("⚠️ Error al enviar. Verificá que el lead tenga teléfono.");
    } finally {
      setIsSendingManual(false);
      setTimeout(() => setManualSendFeedback(null), 4000);
    }
  };

  // Broadcasting Campaign Form States
  const [newCampName, setNewCampName] = useState("");
  const [newCampTemplate, setNewCampTemplate] = useState("Hola {{nombre}}, te escribimos de {{empresa}} porque tenemos novedades especiales para vos...");
  const [newCampSegment, setNewCampSegment] = useState("Todos los contactos");
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);

  const handleAddLead = async () => {
    if (!newLeadName.trim() || !onLeadCreate) return;
    setIsAddingLead(true);
    try {
      const created = await onLeadCreate({
        name: newLeadName.trim(),
        phone: newLeadPhone.trim(),
        status: "Nuevo",
        origin: newLeadOrigin,
        lastInteraction: new Date().toISOString(),
        score: 65,
        notes: "",
        avatar: makeAvatarUrl(newLeadName.trim()),
        totalSpent: 0,
        conversationHistory: [],
      });
      setSelectedLead(created);
      setNewLeadName("");
      setNewLeadPhone("");
      setShowAddForm(false);
    } catch (e) {
      console.error("Create lead failed:", e);
    } finally {
      setIsAddingLead(false);
    }
  };

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

  const filteredLeads = leads.filter((l) => {
    const matchesSearch = !searchQuery.trim() ||
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      l.notes.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = channelFilter === "Todos" || l.origin === channelFilter;
    return matchesSearch && matchesChannel;
  });

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
    const patch = { status: nextStatus, lastInteraction: new Date().toISOString() };
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
      setSendingProgress((p) => Math.min(p + 8, 85));
    }, 400);

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

      // Trigger actual send via API
      const result = await sendCampaign(saved.id);
      clearInterval(progressTick);
      setSendingProgress(100);

      // Update local campaigns state
      setCampaigns((prev) => prev.map((c) => c.id === saved.id ? result : c));

      setTimeout(() => {
        setSendingProgress(0);
        setIsSendingCampaign(false);
        setNewCampName("");
      }, 800);
    } catch (e) {
      clearInterval(progressTick);
      setSendingProgress(0);
      setIsSendingCampaign(false);
      console.error("Campaign send failed:", e);
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
                {/* Search + Filter + Add Lead bar */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre, teléfono o notas…"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>
                  <select
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value as CRMLead["origin"] | "Todos")}
                    className="bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    title="Filtrar por canal"
                  >
                    <option value="Todos">Todos</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                  {onLeadCreate && (
                    <button
                      onClick={() => setShowAddForm((v) => !v)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        showAddForm ? "bg-slate-200 text-slate-700" : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      <Plus size={13} /> Lead
                    </button>
                  )}
                </div>

                {/* Quick add lead form */}
                <AnimatePresence>
                  {showAddForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-2">
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Agregar lead manualmente</span>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newLeadName}
                            onChange={(e) => setNewLeadName(e.target.value)}
                            placeholder="Nombre *"
                            className="bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            value={newLeadPhone}
                            onChange={(e) => setNewLeadPhone(e.target.value)}
                            placeholder="Teléfono (opcional)"
                            className="bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={newLeadOrigin}
                            onChange={(e) => setNewLeadOrigin(e.target.value as CRMLead["origin"])}
                            className="flex-1 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                          >
                            <option value="WhatsApp">WhatsApp</option>
                            <option value="Instagram">Instagram</option>
                            <option value="Facebook">Facebook</option>
                          </select>
                          <button
                            onClick={handleAddLead}
                            disabled={isAddingLead || !newLeadName.trim()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isAddingLead ? "Guardando…" : "Guardar"}
                          </button>
                          <button
                            onClick={() => setShowAddForm(false)}
                            className="px-3 py-1.5 bg-white text-slate-600 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                                <span className="text-xs font-bold text-slate-800 truncate flex-1">{lead.name}</span>
                              </div>
                              {/* Lead score mini bar */}
                              <div className="w-full h-0.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                                <div
                                  className={`h-full rounded-full transition-all ${lead.score >= 85 ? "bg-emerald-500" : lead.score >= 70 ? "bg-amber-400" : "bg-slate-300"}`}
                                  style={{ width: `${lead.score}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`text-[8px] font-semibold border px-1.5 py-0.5 rounded-full ${getOriginColor(lead.origin)}`}>
                                  {lead.origin}
                                </span>
                                <span className="text-[9px] text-slate-400">{timeAgo(lead.lastInteraction)}</span>
                              </div>
                              <div className="mt-1.5 flex justify-between items-center gap-1">
                                <span className="text-[8px] text-slate-500 font-mono block truncate flex-1">
                                  {lead.notes}
                                </span>
                                <span className={`text-[8px] font-mono font-bold shrink-0 ${lead.score >= 85 ? "text-emerald-600" : lead.score >= 70 ? "text-amber-600" : "text-slate-500"}`}>
                                  {lead.score}%
                                </span>
                                {/* Quick advance to next stage */}
                                {col !== "Cerrado" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextStage = COLUMNS[COLUMNS.indexOf(col) + 1];
                                      if (nextStage) handleMoveLead(lead.id, nextStage);
                                    }}
                                    className="p-0.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all shrink-0"
                                    title={`Mover a ${COLUMNS[COLUMNS.indexOf(col) + 1]}`}
                                  >
                                    <ChevronRight size={11} />
                                  </button>
                                )}
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
                      <div className="flex items-start space-x-3 pb-3 border-b border-slate-100">
                        <img
                          referrerPolicy="no-referrer"
                          src={selectedLead.avatar}
                          alt={selectedLead.name}
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-slate-900">{selectedLead.name}</h4>
                          <span className="text-xs text-slate-500 block">{selectedLead.phone || "Sin teléfono"}</span>
                          <span className={`text-[9px] font-mono font-bold uppercase ${selectedLead.score >= 85 ? "text-emerald-600" : selectedLead.score >= 65 ? "text-amber-600" : "text-slate-500"}`}>
                            Score: {selectedLead.score}/100 — {selectedLead.score >= 85 ? "Muy Alta" : selectedLead.score >= 65 ? "Media" : "Baja"}
                          </span>
                          {selectedLead.createdAt && (
                            <span className="text-[8px] text-slate-400 block mt-0.5">
                              Alta: {new Date(selectedLead.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                        {selectedLead.phone && (
                          <a
                            href={`https://wa.me/${selectedLead.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-1 text-[10px] font-bold transition-all shrink-0"
                            title="Abrir chat en WhatsApp"
                          >
                            <Phone size={11} /> WA
                          </a>
                        )}
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

                      {/* Register sale amount */}
                      {selectedLead.status === "Cerrado" && onLeadUpdate && (
                        <div className="py-3 border-b border-slate-100 space-y-1.5">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Monto de la Venta (ARS)
                          </span>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min={0}
                              defaultValue={selectedLead.totalSpent || 0}
                              id={`total-spent-${selectedLead.id}`}
                              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                              placeholder="0"
                            />
                            <button
                              onClick={async () => {
                                const input = document.getElementById(`total-spent-${selectedLead.id}`) as HTMLInputElement;
                                const amount = parseFloat(input.value) || 0;
                                const updated = await onLeadUpdate(selectedLead.id, { totalSpent: amount });
                                setSelectedLead(updated);
                                setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer"
                            >
                              Guardar
                            </button>
                          </div>
                          {selectedLead.totalSpent ? (
                            <p className="text-[9px] text-emerald-600 font-mono font-bold">
                              Venta actual: ${selectedLead.totalSpent.toLocaleString("es-AR")} ARS
                            </p>
                          ) : null}
                        </div>
                      )}

                      {/* Conversation Monitoring history */}
                      <div className="py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Conversación IA ({selectedLead.conversationHistory.length} mensajes)
                          </span>
                          {selectedLead.conversationHistory.length > 0 && (
                            <span className="text-[9px] text-slate-400">{timeAgo(selectedLead.lastInteraction)}</span>
                          )}
                        </div>
                        {selectedLead.conversationHistory.length === 0 ? (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-[10px] text-slate-400 italic">
                            Sin historial aún. Iniciá una conversación en el chat simulador.
                          </div>
                        ) : (
                          <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-[180px] overflow-y-auto">
                            {selectedLead.conversationHistory.map((h, index) => (
                              <div
                                key={index}
                                className={`flex ${h.role === "user" ? "justify-end" : "justify-start"}`}
                              >
                                <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[10px] leading-relaxed ${
                                  h.role === "user"
                                    ? "bg-emerald-100 text-emerald-900 rounded-tr-none"
                                    : "bg-white border border-slate-200 text-slate-700 rounded-tl-none"
                                }`}>
                                  <span className={`font-bold block text-[8px] mb-0.5 ${h.role === "user" ? "text-emerald-700" : "text-blue-600"}`}>
                                    {h.role === "user" ? "Cliente" : "Respondo AI"}
                                  </span>
                                  {h.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Human Override Controls */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <button
                        onClick={() => { toggleManualOverride(selectedLead.id); setManualMessage(""); setManualSendFeedback(null); }}
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
                      {manualOverrideActive[selectedLead.id] ? (
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-center font-medium">
                            IA pausada. Escribí un mensaje para enviar al cliente.
                          </p>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={manualMessage}
                              onChange={(e) => setManualMessage(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendManualMessage(); } }}
                              placeholder="Escribí tu mensaje…"
                              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={handleSendManualMessage}
                              disabled={isSendingManual || !manualMessage.trim()}
                              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Send size={13} />
                            </button>
                          </div>
                          {manualSendFeedback && (
                            <p className="text-[9px] text-center font-medium text-slate-600">{manualSendFeedback}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-400 text-center">
                          La IA de Respondo responde 24/7 de forma autónoma.
                        </p>
                      )}
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
                      <label className="text-xs font-medium text-slate-500">Plantilla de Mensaje</label>
                      <span className="text-[9px] text-slate-400 font-mono font-bold">Use {"{{nombre}}"} y {"{{empresa}}"}</span>
                    </div>
                    <textarea
                      value={newCampTemplate}
                      onChange={(e) => setNewCampTemplate(e.target.value)}
                      rows={4}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono leading-relaxed"
                    />
                    {/* Live preview with sample data */}
                    {newCampTemplate && (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vista previa (con datos reales)</span>
                        <div className="flex justify-end">
                          <div className="bg-[#DCF8C6] text-slate-800 text-[11px] leading-relaxed rounded-2xl rounded-tr-none px-3 py-2 max-w-[85%] border border-[#c2e7af] whitespace-pre-wrap">
                            {newCampTemplate
                              .replace(/\{\{nombre\}\}/gi, leads[0]?.name || "María García")
                              .replace(/\{\{empresa\}\}/gi, "Tu Negocio")}
                          </div>
                        </div>
                        <p className="text-[8px] text-slate-400 text-right">
                          Muestra con {leads[0] ? `datos de "${leads[0].name}"` : "datos de ejemplo"}
                        </p>
                      </div>
                    )}
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
