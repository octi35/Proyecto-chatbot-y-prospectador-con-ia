import React, { useState, useRef, useEffect } from "react";
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
  Clock,
  TrendingUp,
  Upload,
  Instagram,
  Facebook,
  Mail,
  MessageCircle,
  Bot,
  Calendar,
  FileText,
  Sparkles,
} from "lucide-react";
import { CRMLead, Campaign, AgentConfig } from "../types";
import { makeAvatarUrl } from "../lib/avatar";
import { timeAgo } from "../lib/timeAgo";
import { sendLeadMessage, sendCampaign, runFollowups, aiSummary, aiSuggest, aiCampaign } from "../lib/api";
import { toast } from "./ui/toast";

interface CRMAdminProps {
  leads: CRMLead[];
  setLeads: React.Dispatch<React.SetStateAction<CRMLead[]>>;
  campaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  config: AgentConfig;
  onLeadUpdate?: (id: string, patch: Partial<CRMLead>) => Promise<CRMLead>;
  onLeadDelete?: (id: string) => Promise<void>;
  onLeadCreate?: (lead: Omit<CRMLead, "id">) => Promise<CRMLead>;
  onCampaignCreate?: (campaign: Omit<Campaign, "id">) => Promise<Campaign>;
}

export default function CRMAdmin({ leads, setLeads, campaigns, setCampaigns, config, onLeadUpdate, onLeadDelete, onLeadCreate, onCampaignCreate }: CRMAdminProps) {
  // Selection States
  const [activeTab, setActiveTab] = useState<"inbox" | "pipeline" | "broadcast">("inbox");
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(leads[0] || null);
  const [checkedLeadIds, setCheckedLeadIds] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [manualOverrideActive, setManualOverrideActive] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<CRMLead["origin"] | "Todos">("Todos");
  const [sortBy, setSortBy] = useState<"score" | "date" | "name">("date");
  const [followupResult, setFollowupResult] = useState<string | null>(null);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null); // null = not editing
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadOrigin, setNewLeadOrigin] = useState<CRMLead["origin"]>("WhatsApp");
  const [isAddingLead, setIsAddingLead] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const importCsvRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  // "/" keyboard shortcut focuses search when in pipeline view
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        activeTab === "pipeline" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        searchInputRef.current?.blur();
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab]);

  // Manual message state (human override)
  const [manualMessage, setManualMessage] = useState("");
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [manualSendFeedback, setManualSendFeedback] = useState<string | null>(null);

  // AI assist state (inbox summary + suggested replies)
  const [aiSummaryText, setAiSummaryText] = useState("");
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);

  const loadAiSummary = async (lead: CRMLead | null) => {
    if (!lead || lead.conversationHistory.length === 0) { setAiSummaryText(""); return; }
    setAiSummaryLoading(true);
    try {
      const { summary } = await aiSummary(lead.conversationHistory, lead.name);
      setAiSummaryText(summary);
    } catch { setAiSummaryText(""); }
    finally { setAiSummaryLoading(false); }
  };

  const loadAiSuggestions = async () => {
    if (!selectedLead || selectedLead.conversationHistory.length === 0) return;
    setAiSuggestLoading(true);
    try {
      const { suggestions } = await aiSuggest(selectedLead.conversationHistory);
      setAiSuggestions(suggestions);
    } catch { setAiSuggestions([]); }
    finally { setAiSuggestLoading(false); }
  };

  // Auto-generate the AI summary when a conversation is opened in the inbox
  useEffect(() => {
    setAiSuggestions([]);
    if (activeTab === "inbox") loadAiSummary(selectedLead);
    else setAiSummaryText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id, activeTab]);

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

  // Pre-built campaign templates
  const CAMPAIGN_TEMPLATES = [
    { name: "Oferta de Temporada", text: "¡Hola {{nombre}}! 🔥 Tenemos una oferta especial de temporada sólo por hoy. ¿Te interesa conocer los detalles? ¡Respondé este mensaje!" },
    { name: "Seguimiento de Consulta", text: "Hola {{nombre}}, somos de {{empresa}}. Te contactamos para seguir con tu consulta. ¿Pudiste decidirte? Estamos para ayudarte 😊" },
    { name: "Carrito Abandonado", text: "¡{{nombre}}, te olvidaste algo! 🛒 Todavía tenés tu pedido guardado en {{empresa}}. ¿Querés que lo completemos juntos? Escribinos." },
    { name: "Nuevo Producto", text: "¡Hola {{nombre}}! 🆕 Acaba de llegar algo que te va a encantar en {{empresa}}. ¿Querés que te cuente más? Solo respondé este mensaje." },
    { name: "Recordatorio de Turno", text: "Hola {{nombre}}, te recordamos que tenés un turno agendado con {{empresa}}. Confirmá con un 👍 o avisanos si necesitás cambiar el horario." },
  ];

  // Broadcasting Campaign Form States
  const [newCampName, setNewCampName] = useState("");
  const [newCampTemplate, setNewCampTemplate] = useState("Hola {{nombre}}, te escribimos de {{empresa}} porque tenemos novedades especiales para vos...");
  const [newCampSegment, setNewCampSegment] = useState("Todos los contactos");
  const [newCampScheduledAt, setNewCampScheduledAt] = useState("");
  const [newCampMediaUrl, setNewCampMediaUrl] = useState("");
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [aiCampLoading, setAiCampLoading] = useState(false);

  const handleGenerateCampaign = async () => {
    setAiCampLoading(true);
    try {
      const objetivo = newCampName.trim() || "reactivar clientes interesados y aumentar las ventas";
      const result = await aiCampaign(objetivo, newCampSegment);
      setNewCampName(result.name);
      setNewCampTemplate(result.template);
      toast.success("Campaña generada con IA", "Revisala y ajustala antes de enviar.");
    } catch (e) {
      toast.error("No se pudo generar la campaña", (e as Error).message);
    } finally {
      setAiCampLoading(false);
    }
  };

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
      toast.success("Lead agregado", `${created.name} entró al embudo.`);
    } catch (e) {
      toast.error("No se pudo crear el lead", (e as Error).message);
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
      toast.success("Lead eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar el lead", (e as Error).message);
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
    const header = ["Nombre","Teléfono","Estado","Canal","Puntaje","Categoría","Mensajes","Venta ARS","Alta","Última actividad","Notas"].join(",");
    const rows = leads.map((l) => [
      `"${(l.name || "").replace(/"/g, '""')}"`,
      l.phone || "",
      l.status,
      l.origin,
      l.score,
      l.category || "",
      l.conversationHistory.length,
      l.totalSpent || 0,
      l.createdAt ? new Date(l.createdAt).toLocaleDateString("es-AR") : "",
      new Date(l.lastInteraction).toLocaleDateString("es-AR"),
      `"${(l.notes || "").replace(/"/g, '""')}"`,
    ].join(","));
    const bom = "﻿"; // UTF-8 BOM for Excel compatibility
    const csv = bom + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onLeadCreate) return;
    const text = await file.text();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    if (lines.length < 2) { setImportResult("⚠️ CSV vacío o sin filas de datos."); return; }
    const headers = lines[0].toLowerCase().split(",").map((h) => h.replace(/"/g, "").trim());
    let imported = 0; let errors = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.replace(/^"|"$/g, "").trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
      const name = row["nombre"] || row["name"] || "";
      if (!name) continue;
      const rawStatus = row["estado"] || row["status"] || "Nuevo";
      const validStatuses = ["Nuevo","Contactado","Presupuestado","Cerrado"] as const;
      const status = validStatuses.includes(rawStatus as typeof validStatuses[number]) ? rawStatus as CRMLead["status"] : "Nuevo";
      const rawOrigin = row["canal"] || row["origin"] || "WhatsApp";
      const validOrigins = ["WhatsApp","Instagram","Facebook","Email"] as const;
      const origin = validOrigins.includes(rawOrigin as typeof validOrigins[number]) ? rawOrigin as CRMLead["origin"] : "WhatsApp";
      try {
        await onLeadCreate({
          name,
          phone: row["teléfono"] || row["telefono"] || row["phone"] || "",
          status,
          origin,
          notes: row["notas"] || row["notes"] || "",
          category: row["categoría"] || row["categoria"] || row["category"] || undefined,
          score: parseInt(row["puntaje"] || row["score"] || "65") || 65,
          lastInteraction: new Date().toISOString(),
          avatar: makeAvatarUrl(name),
          totalSpent: parseFloat(row["venta ars"] || row["totalspent"] || "0") || 0,
          conversationHistory: [],
        });
        imported++;
      } catch { errors++; }
    }
    setImportResult(`✅ ${imported} lead${imported !== 1 ? "s" : ""} importado${imported !== 1 ? "s" : ""}${errors > 0 ? ` · ${errors} error${errors !== 1 ? "es" : ""}` : ""}`);
    setTimeout(() => setImportResult(null), 6000);
    e.target.value = "";
  };

  const filteredLeads = leads
    .filter((l) => {
      const matchesSearch = !searchQuery.trim() ||
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.phone.includes(searchQuery) ||
        l.notes.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesChannel = channelFilter === "Todos" || l.origin === channelFilter;
      return matchesSearch && matchesChannel;
    })
    .sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "name") return a.name.localeCompare(b.name, "es");
      // date: most recent first
      return new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime();
    });

  // Status Column list
  const COLUMNS: CRMLead["status"][] = ["Nuevo", "Contactado", "Presupuestado", "Cerrado"];

  // Stale = no interaction for >24h and not closed
  const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
  const isStale = (lead: CRMLead) =>
    lead.status !== "Cerrado" &&
    Date.now() - new Date(lead.lastInteraction).getTime() > STALE_THRESHOLD_MS;

  // Hot lead = score >= 85 and activity within the last 2 hours
  const HOT_THRESHOLD_MS = 2 * 60 * 60 * 1000;
  const isHot = (lead: CRMLead) =>
    lead.score >= 85 &&
    Date.now() - new Date(lead.lastInteraction).getTime() < HOT_THRESHOLD_MS;

  // Quick CRM aggregate stats
  const totalValue = leads.reduce((a, l) => a + (l.totalSpent || 0), 0);
  const staleCount = leads.filter(isStale).length;
  const avgScore = leads.length ? Math.round(leads.reduce((a, l) => a + l.score, 0) / leads.length) : 0;

  // Today's activity summary
  const todayStr = new Date().toDateString();
  const newLeadsToday = leads.filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === todayStr).length;
  const activeToday = leads.filter((l) => new Date(l.lastInteraction).toDateString() === todayStr).length;
  const closedToday = leads.filter((l) => l.status === "Cerrado" && new Date(l.lastInteraction).toDateString() === todayStr).length;
  const revenueToday = leads.filter((l) => l.status === "Cerrado" && new Date(l.lastInteraction).toDateString() === todayStr).reduce((a, l) => a + (l.totalSpent || 0), 0);

  // Score label with intent explanation
  const getScoreLabel = (lead: CRMLead) => {
    const HIGH_INTENT = ["precio","cuánto","costo","comprar","reservar","disponible","quiero","necesito","envío","delivery","talle","color","stock","modelo","foto","medida"];
    const VERY_HIGH_INTENT = ["pago","transferencia","confirmar","efectivo","tarjeta","cuotas","link de pago","pagar","saldo","factura"];
    const msgs = lead.conversationHistory.filter(m => m.role === "user").map(m => m.text).join(" ").toLowerCase();
    const hi = HIGH_INTENT.filter(kw => msgs.includes(kw));
    const vhi = VERY_HIGH_INTENT.filter(kw => msgs.includes(kw));
    if (vhi.length > 0) return `Alta intención de pago: "${vhi[0]}"`;
    if (hi.length > 0) return `Interés de compra: "${hi[0]}"`;
    if (lead.score >= 85) return "Lead caliente por actividad reciente";
    if (lead.score >= 70) return "Interés moderado";
    return "Lead nuevo sin señales claras";
  };

  // Colors based on stage
  const getStageColor = (status: CRMLead["status"]) => {
    switch (status) {
      case "Nuevo": return "bg-[#f0fafe] text-sky-700 border-[#e8f6fe]";
      case "Contactado": return "bg-[#fff7e0] text-[#a67c00] border-[#fff2cc]";
      case "Presupuestado": return "bg-purple-50 text-purple-700 border-purple-100";
      case "Cerrado": return "bg-[#eafaea] text-[#3f9f3f] border-[#dcf5dc]";
    }
  };

  const getOriginColor = (origin: CRMLead["origin"]) => {
    switch (origin) {
      case "WhatsApp": return "bg-[#eafaea] text-[#3f9f3f] border-[#dcf5dc]";
      case "Instagram": return "bg-pink-50 text-pink-700 border-pink-100";
      case "Facebook": return "bg-[#f5f6ff] text-[#3b5bdb] border-[#eef1fe]";
      case "Email": return "bg-[#f4f4f5] text-[#3f3f46] border-[#e2e5ee]";
    }
  };

  const channelIcon = (origin: CRMLead["origin"], size = 13) => {
    switch (origin) {
      case "WhatsApp": return <MessageCircle size={size} />;
      case "Instagram": return <Instagram size={size} />;
      case "Facebook": return <Facebook size={size} />;
      case "Email": return <Mail size={size} />;
    }
  };
  const channelDot = (origin: CRMLead["origin"]) => {
    switch (origin) {
      case "WhatsApp": return "text-[#25d366]";
      case "Instagram": return "text-[#e1306c]";
      case "Facebook": return "text-[#4f6ef7]";
      case "Email": return "text-[#6b7280]";
    }
  };
  const lastMsgPreview = (lead: CRMLead) => {
    const last = lead.conversationHistory[lead.conversationHistory.length - 1];
    if (!last) return lead.notes || "Sin mensajes todavía";
    return `${last.role === "user" ? "" : "Tú: "}${last.text}`;
  };

  const handleMoveLead = async (leadId: string, nextStatus: CRMLead["status"]) => {
    const patch = { status: nextStatus, lastInteraction: new Date().toISOString() };
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...patch } : l)));
    if (selectedLead?.id === leadId) setSelectedLead((prev) => prev ? { ...prev, ...patch } : prev);
    if (onLeadUpdate) {
      await onLeadUpdate(leadId, patch).catch((e) => console.error("Lead update failed:", e));
    }
  };

  const toggleCheckedLead = (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId); else next.add(leadId);
      return next;
    });
  };

  const handleBulkMove = async (newStatus: CRMLead["status"]) => {
    if (checkedLeadIds.size === 0 || isBulkActing) return;
    setIsBulkActing(true);
    try {
      const patch = { status: newStatus, lastInteraction: new Date().toISOString() };
      setLeads((prev) => prev.map((l) => checkedLeadIds.has(l.id) ? { ...l, ...patch } : l));
      if (onLeadUpdate) {
        await Promise.all([...checkedLeadIds].map((id) => onLeadUpdate(id, patch).catch(() => {})));
      }
      setCheckedLeadIds(new Set());
    } finally {
      setIsBulkActing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (checkedLeadIds.size === 0 || isBulkActing || !onLeadDelete) return;
    if (!window.confirm(`¿Eliminar ${checkedLeadIds.size} lead${checkedLeadIds.size !== 1 ? "s" : ""}?`)) return;
    const count = checkedLeadIds.size;
    setIsBulkActing(true);
    try {
      await Promise.all([...checkedLeadIds].map((id) => onLeadDelete(id).catch(() => {})));
      setLeads((prev) => prev.filter((l) => !checkedLeadIds.has(l.id)));
      if (selectedLead && checkedLeadIds.has(selectedLead.id)) setSelectedLead(null);
      setCheckedLeadIds(new Set());
      toast.success(`${count} lead${count !== 1 ? "s" : ""} eliminado${count !== 1 ? "s" : ""}`);
    } finally {
      setIsBulkActing(false);
    }
  };

  // Effective handoff state: local optimistic value wins, else server value
  const isOverride = (lead: CRMLead | null) =>
    lead ? (manualOverrideActive[lead.id] ?? lead.aiPaused ?? false) : false;

  const toggleManualOverride = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId) || selectedLead;
    const next = !(manualOverrideActive[leadId] ?? lead?.aiPaused ?? false);
    setManualOverrideActive((prev) => ({ ...prev, [leadId]: next }));
    // Persist so the AI really stays silent on webhooks while a human handles it
    if (onLeadUpdate) {
      onLeadUpdate(leadId, { aiPaused: next }).then((updated) => {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
        setSelectedLead((prev) => (prev?.id === leadId ? updated : prev));
      }).catch(() => {
        toast.error("No se pudo guardar el cambio de IA");
        setManualOverrideActive((prev) => ({ ...prev, [leadId]: !next }));
      });
    }
  };

  const handleLaunchCampaign = async () => {
    if (!newCampName.trim() || !newCampTemplate.trim()) return;

    setIsSendingCampaign(true);
    setSendingProgress(10);

    const progressTick = setInterval(() => {
      setSendingProgress((p) => Math.min(p + 8, 85));
    }, 400);

    try {
      const isScheduled = !!newCampScheduledAt && new Date(newCampScheduledAt) > new Date();
      const draft: Omit<Campaign, "id"> = {
        name: newCampName,
        template: newCampTemplate,
        segment: newCampSegment,
        status: "Borrador",
        sentCount: 0,
        readCount: 0,
        repliesCount: 0,
        dateCreated: new Date().toISOString().split("T")[0],
        ...(newCampScheduledAt ? { scheduledAt: new Date(newCampScheduledAt).toISOString() } : {}),
        ...(newCampMediaUrl.trim() ? { mediaUrl: newCampMediaUrl.trim(), mediaType: "image" as const } : {}),
      };
      // If scheduled for the future, save as draft without sending now
      if (isScheduled) {
        let saved: Campaign;
        if (onCampaignCreate) {
          saved = await onCampaignCreate(draft);
        } else {
          saved = { ...draft, id: `camp-${Date.now()}` };
          setCampaigns((prev) => [saved, ...prev]);
        }
        clearInterval(progressTick);
        setSendingProgress(100);
        setTimeout(() => {
          setSendingProgress(0);
          setIsSendingCampaign(false);
          setNewCampName("");
          setNewCampScheduledAt("");
          setNewCampMediaUrl("");
        }, 800);
        return;
      }

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
      toast.success("Campaña enviada", `Se disparó a ${result.totalTargeted ?? result.sentCount} contactos.`);

      setTimeout(() => {
        setSendingProgress(0);
        setIsSendingCampaign(false);
        setNewCampName("");
      }, 800);
    } catch (e) {
      clearInterval(progressTick);
      setSendingProgress(0);
      setIsSendingCampaign(false);
      toast.error("No se pudo enviar la campaña", (e as Error).message);
    }
  };

  return (
    <div className="bg-white rounded-[22px] overflow-hidden shadow-card flex flex-col h-[calc(100vh-155px)] min-h-[660px]">

      {/* CRM Dashboard Tabs */}
      <div className="glass p-4 sm:p-5 border-b border-[#f4f4f5] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[13px] bg-[#111111] flex items-center justify-center text-white ds-shadow shrink-0">
            <Users size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-[18px] tracking-tight text-[#111111]">Panel de Control CRM</h3>
            <p className="text-[12.5px] text-[#6b7280]">Gestioná prospectos, tomá chats de la IA y lanzá difusiones</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const result = await runFollowups();
                toast.success("Seguimientos enviados", `${result.contacted} de ${result.totalStale} leads inactivos.`);
              } catch (e) {
                toast.error("Error al ejecutar seguimientos", (e as Error).message);
              }
            }}
            className="px-3.5 h-9 text-[12px] rounded-full font-medium bg-[#fff6d6] text-[#a16207] hover:bg-[#ffefb0] flex items-center gap-1.5 transition-all cursor-pointer"
            title="Enviar seguimientos automáticos a leads sin respuesta"
          >
            <Zap size={13} /> Seguimientos
          </button>
          <input ref={importCsvRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          {onLeadCreate && (
            <button
              onClick={() => importCsvRef.current?.click()}
              className="px-3.5 h-9 text-[12px] rounded-full font-medium bg-[#f3f5fb] text-[#4b5563] hover:bg-[#eef1fe] flex items-center gap-1.5 transition-all cursor-pointer"
              title="Importar leads desde CSV (columnas: nombre, teléfono, estado, canal, notas, puntaje)"
            >
              <Upload size={13} /> Importar CSV
            </button>
          )}
          <button
            onClick={exportCSV}
            className="px-3.5 h-9 text-[12px] rounded-full font-medium bg-[#f3f5fb] text-[#4b5563] hover:bg-[#eef1fe] flex items-center gap-1.5 transition-all cursor-pointer"
            title="Exportar leads a CSV"
          >
            <FileSpreadsheet size={13} /> Exportar CSV
          </button>
          <div className="flex bg-[#f3f5fb] p-1 rounded-full">
            <button
              onClick={() => setActiveTab("inbox")}
              className={`px-4 h-8 flex items-center gap-1.5 text-[12px] rounded-full font-medium transition-all duration-300 cursor-pointer ${
                activeTab === "inbox"
                  ? "bg-white text-[#111111] shadow-card font-semibold"
                  : "text-[#6b7280] hover:text-[#111111]"
              }`}
            >
              <MessageCircle size={13} /> Bandeja
            </button>
            <button
              onClick={() => setActiveTab("pipeline")}
              className={`px-4 h-8 flex items-center text-[12px] rounded-full font-medium transition-all duration-300 cursor-pointer ${
                activeTab === "pipeline"
                  ? "bg-white text-[#111111] shadow-card font-semibold"
                  : "text-[#6b7280] hover:text-[#111111]"
              }`}
            >
              Embudo de Ventas
            </button>
            <button
              onClick={() => setActiveTab("broadcast")}
              className={`px-4 h-8 flex items-center text-[12px] rounded-full font-medium transition-all duration-300 cursor-pointer ${
                activeTab === "broadcast"
                  ? "bg-white text-[#111111] shadow-card font-semibold"
                  : "text-[#6b7280] hover:text-[#111111]"
              }`}
            >
              Envíos Masivos (Meta API)
            </button>
          </div>
        </div>
      </div>

      {/* Follow-up result toast */}
      <AnimatePresence>
        {followupResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-[#fff7e0] border-b border-amber-200 text-xs text-[#7a5f00] font-medium"
          >
            {followupResult}
          </motion.div>
        )}
        {importResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-[#f5f6ff] border-b border-[#e0e7ff] text-xs text-blue-800 font-medium"
          >
            {importResult}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main CRM Workspace */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">

          {/* TAB 0: BANDEJA (INBOX ESTILO CHAT) */}
          {activeTab === "inbox" && (
            <motion.div
              key="inbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full"
            >
              {/* LEFT — conversation list */}
              <div className="w-[300px] shrink-0 border-r border-[#f0f1f5] flex flex-col">
                <div className="p-3 border-b border-[#f0f1f5] shrink-0">
                  <span className="text-[13px] font-semibold text-[#111111] px-1 block mb-2">Conversaciones</span>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar contacto…"
                      className="w-full bg-[#f3f5fb] rounded-full pl-10 pr-3 h-9 text-[13px] text-[#111111] placeholder:text-[#9ca3af] border-0 outline-none focus:bg-[#eef1fe] focus:ring-2 focus:ring-[#4f6ef7]/25 transition-all"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredLeads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => { setSelectedLead(lead); setEditingNotes(null); }}
                      className={`w-full text-left px-3 py-3 flex gap-3 border-b border-[#f5f6f8] transition-colors cursor-pointer ${
                        selectedLead?.id === lead.id ? "bg-[#eef1fe]" : "hover:bg-[#f7f8fc]"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img referrerPolicy="no-referrer" src={lead.avatar} alt={lead.name} className="w-11 h-11 rounded-full object-cover" />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.12)] ${channelDot(lead.origin)}`}>
                          {channelIcon(lead.origin, 10)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-semibold text-[#111111] truncate">{lead.name}</span>
                          <span className="text-[10.5px] text-[#9ca3af] shrink-0">{timeAgo(lead.lastInteraction)}</span>
                        </div>
                        <p className="text-[12px] text-[#6b7280] truncate mt-0.5">{lastMsgPreview(lead)}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getStageColor(lead.status)}`}>{lead.status}</span>
                          {isHot(lead) && <span className="text-[11px]">🔥</span>}
                          {!isHot(lead) && isStale(lead) && <Clock size={11} className="text-[#ffcf2e]" />}
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredLeads.length === 0 && (
                    <div className="text-center py-12 text-[12px] text-[#9ca3af]">Sin conversaciones</div>
                  )}
                </div>
              </div>

              {/* CENTER — chat thread */}
              <div className="flex-1 min-w-0 flex flex-col bg-[#f6f7fb]">
                {selectedLead ? (
                  <>
                    <div className="h-16 shrink-0 px-5 flex items-center gap-3 border-b border-[#f0f1f5] bg-white">
                      <img referrerPolicy="no-referrer" src={selectedLead.avatar} alt={selectedLead.name} className="w-10 h-10 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#111111] truncate">{selectedLead.name}</p>
                        <p className="text-[12px] text-[#6b7280] flex items-center gap-1.5">
                          {selectedLead.conversationHistory.length} mensajes <span className="text-[#cbd0e0]">·</span>
                          <span className={`inline-flex items-center gap-1 ${channelDot(selectedLead.origin)}`}>{channelIcon(selectedLead.origin, 12)} {selectedLead.origin}</span>
                        </p>
                      </div>
                      {selectedLead.phone && (
                        <a href={`https://wa.me/${selectedLead.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                          className="ml-auto w-9 h-9 rounded-full bg-[#eafaea] hover:bg-[#dcf5dc] text-[#3f9f3f] flex items-center justify-center transition-colors" title="Abrir en WhatsApp">
                          <Phone size={15} />
                        </a>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-2.5">
                      {selectedLead.conversationHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-[13px] text-[#9ca3af] gap-2">
                          <MessageCircle size={30} className="text-[#cbd0e0]" />
                          Sin mensajes todavía.
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-center mb-2">
                            <span className="text-[11px] text-[#9ca3af] bg-white px-3 py-1 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.04)]">Historial</span>
                          </div>
                          {selectedLead.conversationHistory.map((h, index) => (
                            <div key={index} className={`flex ${h.role === "model" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[68%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-[0_1px_1px_rgba(0,0,0,0.06)] ${
                                h.role === "model" ? "bg-[#dcf8c6] text-[#1a3a1a] rounded-br-md" : "bg-white text-[#3f3f46] rounded-bl-md"
                              }`}>
                                {h.text}
                                {h.timestamp && (
                                  <span className="block text-[10.5px] text-[#8a8f98] mt-1 text-right">
                                    {new Date(h.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    <div className="shrink-0 p-3.5 border-t border-[#f0f1f5] bg-white">
                      {isOverride(selectedLead) ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <button onClick={loadAiSuggestions} disabled={aiSuggestLoading || selectedLead.conversationHistory.length === 0}
                              className="text-[11.5px] font-medium text-[#4f6ef7] hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                              <Sparkles size={12} /> {aiSuggestLoading ? "Pensando…" : "Sugerir respuesta con IA"}
                            </button>
                          </div>
                          {aiSuggestions.length > 0 && (
                            <div className="space-y-1.5">
                              {aiSuggestions.map((s, i) => (
                                <button key={i} onClick={() => setManualMessage(s)}
                                  className="block w-full text-left text-[12.5px] px-3 py-2 rounded-xl bg-[#eef1fe] text-[#3b5bdb] hover:bg-[#e0e7ff] transition-colors cursor-pointer leading-snug">
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {(config.quickReplies?.length ? config.quickReplies : ["¿En qué más te ayudo?", "Te paso el precio", "¿Coordinamos el envío?", "Gracias por tu consulta"]).map((r) => (
                              <button key={r} type="button" onClick={() => setManualMessage(r)}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#f3f5fb] text-[#4b5563] hover:bg-[#eef1fe] hover:text-[#3b5bdb] transition-all cursor-pointer">{r}</button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="text" value={manualMessage} onChange={(e) => setManualMessage(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendManualMessage(); } }}
                              placeholder="Escribí tu mensaje…"
                              className="flex-1 bg-[#f3f5fb] rounded-full px-4 h-11 text-[14px] text-[#111111] placeholder:text-[#9ca3af] border-0 outline-none focus:bg-[#eef1fe] focus:ring-2 focus:ring-[#4f6ef7]/25 transition-all" />
                            <button onClick={handleSendManualMessage} disabled={isSendingManual || !manualMessage.trim()}
                              className="w-11 h-11 rounded-full bg-[#4f6ef7] hover:bg-[#3b5bdb] text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shrink-0">
                              <Send size={16} />
                            </button>
                          </div>
                          {manualSendFeedback && <p className="text-[11px] text-center font-medium text-[#4b5563]">{manualSendFeedback}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-3 h-8 rounded-full bg-[#111111] text-white shrink-0">
                            <Bot size={13} /> IA activada · Solo lectura
                          </span>
                          <div className="flex-1 bg-[#f3f5fb] rounded-full px-4 h-11 flex items-center text-[13px] text-[#9ca3af] min-w-0">
                            No puedes enviar mensajes
                          </div>
                          <button onClick={() => { toggleManualOverride(selectedLead.id); setManualMessage(""); setManualSendFeedback(null); }}
                            className="px-3.5 h-9 rounded-full bg-[#fff6d6] text-[#a16207] hover:bg-[#ffefb0] text-[12px] font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5">
                            <User size={13} /> Intervenir
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-[#9ca3af] gap-2">
                    <MessageCircle size={40} className="text-[#cbd0e0]" />
                    <span className="text-[13px] font-medium text-[#4b5563]">Elegí una conversación</span>
                    <span className="text-[12px]">Seleccioná un contacto de la izquierda.</span>
                  </div>
                )}
              </div>

              {/* RIGHT — contact details */}
              <div className="w-[320px] shrink-0 border-l border-[#f0f1f5] overflow-y-auto hidden xl:block">
                {selectedLead ? (
                  <div className="p-5 space-y-6">
                    <span className="text-[13px] font-semibold text-[#111111]">Detalles del contacto</span>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-semibold text-[#6b7280] flex items-center gap-1.5"><Sparkles size={13} className="text-[#4f6ef7]" /> Resumen IA</span>
                        <button onClick={() => loadAiSummary(selectedLead)} disabled={aiSummaryLoading}
                          className="text-[11px] text-[#4f6ef7] hover:underline disabled:opacity-50 flex items-center gap-1 cursor-pointer">
                          {aiSummaryLoading ? "Generando…" : "Regenerar"}
                        </button>
                      </div>
                      <p className="text-[13px] text-[#4b5563] leading-relaxed bg-[#f3f5fb] rounded-2xl p-3.5 min-h-[64px]">
                        {aiSummaryLoading
                          ? "Analizando la conversación con IA…"
                          : (aiSummaryText || (selectedLead.conversationHistory.length ? getScoreLabel(selectedLead) : "Sin conversación para resumir todavía."))}
                      </p>
                    </div>

                    <div>
                      <span className="text-[12px] font-semibold text-[#6b7280] flex items-center gap-1.5 mb-3"><User size={13} /> Información</span>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2.5">
                          <User size={14} className="text-[#9ca3af] mt-0.5 shrink-0" />
                          <div><p className="text-[11px] text-[#9ca3af]">Nombre / Contacto</p><p className="text-[13px] font-medium text-[#111111]">{selectedLead.name}</p></div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Phone size={14} className="text-[#9ca3af] mt-0.5 shrink-0" />
                          <div><p className="text-[11px] text-[#9ca3af]">Teléfono</p><p className="text-[13px] font-medium text-[#111111]">{selectedLead.phone || "Sin teléfono"}</p></div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-0.5 shrink-0 ${channelDot(selectedLead.origin)}`}>{channelIcon(selectedLead.origin, 14)}</span>
                          <div><p className="text-[11px] text-[#9ca3af]">Canal</p><p className="text-[13px] font-medium text-[#111111]">{selectedLead.origin}</p></div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Bot size={14} className="text-[#9ca3af] mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[11px] text-[#9ca3af]">Agente asignado</p>
                            <p className="text-[13px] font-medium text-[#111111]">{config.botPersonaName || "Respondo AI"}</p>
                            <span className="inline-flex items-center gap-1 text-[10.5px] text-[#3f9f3f] mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#25d366]" /> Canal conectado</span>
                          </div>
                        </div>
                        {selectedLead.createdAt && (
                          <div className="flex items-start gap-2.5">
                            <Calendar size={14} className="text-[#9ca3af] mt-0.5 shrink-0" />
                            <div><p className="text-[11px] text-[#9ca3af]">Fecha de creación</p><p className="text-[13px] font-medium text-[#111111]">{new Date(selectedLead.createdAt).toLocaleString("es-AR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Human assignment (handoff) */}
                    {onLeadUpdate && (
                      <div>
                        <span className="text-[12px] font-semibold text-[#6b7280] flex items-center gap-1.5 mb-2"><UserCheck size={13} /> Asignado a (humano)</span>
                        <input
                          type="text"
                          key={selectedLead.id}
                          defaultValue={selectedLead.assignedTo || ""}
                          placeholder="Ej: octi@minegocio.com"
                          onBlur={async (e) => {
                            const val = e.target.value.trim();
                            if (val === (selectedLead.assignedTo || "")) return;
                            try {
                              const updated = await onLeadUpdate(selectedLead.id, { assignedTo: val || undefined });
                              setSelectedLead(updated);
                              setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
                              toast.success(val ? `Chat asignado a ${val}` : "Asignación quitada");
                            } catch { toast.error("No se pudo asignar"); }
                          }}
                          className="w-full bg-[#f3f5fb] rounded-[14px] px-4 h-10 text-[13px] text-[#111111] placeholder:text-[#9ca3af] border-0 outline-none focus:bg-[#eef1fe] focus:ring-2 focus:ring-[#4f6ef7]/25 transition-all"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between bg-[#f3f5fb] rounded-2xl p-3.5">
                      <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-[#4f6ef7]" />
                        <div>
                          <p className="text-[13px] font-medium text-[#111111]">Respuesta con IA</p>
                          <p className="text-[11px] text-[#9ca3af]">El agente responde automáticamente</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { toggleManualOverride(selectedLead.id); setManualMessage(""); setManualSendFeedback(null); }}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${!isOverride(selectedLead) ? "bg-[#4f6ef7]" : "bg-[#cbd0e0]"}`}
                        title="Activar/pausar respuesta automática"
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${!isOverride(selectedLead) ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    </div>

                    {onLeadDelete && (
                      <button onClick={handleDeleteSelectedLead} disabled={isDeletingLead}
                        className="w-full h-9 rounded-full text-[12px] font-medium text-[#e26562] hover:bg-[#fdecec] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
                        <Trash2 size={13} /> {isDeletingLead ? "Eliminando…" : "Eliminar contacto"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-[12px] text-[#9ca3af]">Sin contacto seleccionado</div>
                )}
              </div>
            </motion.div>
          )}

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
              <div className="lg:col-span-8 p-4 sm:p-5 border-r border-[#f0f1f5] overflow-y-auto space-y-4 h-full">
                {/* Today's Activity card */}
                {(newLeadsToday > 0 || activeToday > 0 || closedToday > 0) && (
                  <div className="rounded-xl border border-[#eef1fe] bg-[#f3f5fb] p-3">
                    <p className="text-[10px] font-bold text-[#3b5bdb] uppercase tracking-wider mb-2 flex items-center gap-1">
                      <TrendingUp size={11} /> Actividad de hoy
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <span className="block text-lg font-black text-[#3b5bdb] leading-tight">{newLeadsToday}</span>
                        <span className="block text-[9px] text-[#3b5bdb] font-semibold uppercase tracking-wide leading-tight">Nuevos</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-lg font-black text-[#3b5bdb] leading-tight">{activeToday}</span>
                        <span className="block text-[9px] text-[#3b5bdb] font-semibold uppercase tracking-wide leading-tight">Activos</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-lg font-black text-[#3f9f3f] leading-tight">{closedToday}</span>
                        <span className="block text-[9px] text-[#7dd87d] font-semibold uppercase tracking-wide leading-tight">Cerrados</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-lg font-black text-purple-700 leading-tight">${revenueToday > 0 ? revenueToday.toLocaleString("es-AR") : "0"}</span>
                        <span className="block text-[9px] text-[#818cf8] font-semibold uppercase tracking-wide leading-tight">Ingresos</span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Quick stats strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(["Nuevo","Contactado","Presupuestado","Cerrado"] as const).map((s) => {
                    const count = leads.filter((l) => l.status === s).length;
                    const dot: Record<string, string> = { Nuevo: "bg-[#6366f1]", Contactado: "bg-[#ffcf2e]", Presupuestado: "bg-[#818cf8]", Cerrado: "bg-[#7dd87d]" };
                    return (
                      <div key={s} className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
                        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#6b7280] mb-1">
                          <span className={`w-2 h-2 rounded-full ${dot[s]}`} /> {s}
                        </span>
                        <span className="text-[26px] font-semibold text-[#111111] tracking-tight leading-none">{count}</span>
                      </div>
                    );
                  })}
                </div>
                {(staleCount > 0 || totalValue > 0) && (
                  <div className="flex items-center gap-3 text-[10px] text-[#6b7280]">
                    {staleCount > 0 && (
                      <span className="flex items-center gap-1 text-[#b8860b] font-semibold">
                        <Clock size={11} /> {staleCount} lead{staleCount > 1 ? "s" : ""} sin actividad (+24h)
                      </span>
                    )}
                    {totalValue > 0 && (
                      <span className="flex items-center gap-1 text-[#4caf4c] font-semibold">
                        <TrendingUp size={11} /> ${totalValue.toLocaleString("es-AR")} ARS facturado
                      </span>
                    )}
                    {avgScore > 0 && (
                      <span className="flex items-center gap-1 text-[#4f6ef7] font-semibold ml-auto">
                        Score prom: {avgScore}%
                      </span>
                    )}
                  </div>
                )}
                {/* Search + Filter + Add Lead bar */}
                <div className="flex gap-2.5">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar lead…"
                      className="w-full bg-white rounded-xl pl-10 pr-3 py-2.5 text-[13.5px] text-[#111111] shadow-[0_1px_2px_rgba(24,24,27,0.04)] focus:outline-none focus:ring-2 focus:ring-[#eef1fe] transition-all placeholder:text-[#9ca3af]"
                    />
                  </div>
                  <select
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value as CRMLead["origin"] | "Todos")}
                    className="bg-white rounded-xl px-3 py-2.5 text-[13px] text-[#3f3f46] shadow-[0_1px_2px_rgba(24,24,27,0.04)] focus:outline-none cursor-pointer"
                    title="Filtrar por canal"
                  >
                    <option value="Todos">Todos</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Email">Email</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="bg-white rounded-xl px-3 py-2.5 text-[13px] text-[#3f3f46] shadow-[0_1px_2px_rgba(24,24,27,0.04)] focus:outline-none cursor-pointer"
                    title="Ordenar leads"
                  >
                    <option value="date">↓ Fecha</option>
                    <option value="score">↓ Score</option>
                    <option value="name">A-Z Nombre</option>
                  </select>
                  {onLeadCreate && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setShowAddForm((v) => !v)}
                      className={`px-4 py-2.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        showAddForm ? "bg-[#e2e5ee] text-[#3f3f46]" : "bg-[#4f6ef7] text-white hover:bg-[#3b5bdb]"
                      }`}
                    >
                      <Plus size={15} /> Lead
                    </motion.button>
                  )}
                </div>

                {/* Bulk actions bar */}
                <AnimatePresence>
                  {checkedLeadIds.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 bg-[#f5f6ff] border border-[#e0e7ff] rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-[#3b5bdb] shrink-0">
                          {checkedLeadIds.size} seleccionado{checkedLeadIds.size !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[#c7d2fe] mx-1">|</span>
                        <span className="text-[10px] text-[#4f6ef7] font-semibold shrink-0">Mover a:</span>
                        {(["Nuevo","Contactado","Presupuestado","Cerrado"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleBulkMove(s)}
                            disabled={isBulkActing}
                            className="text-[9px] font-bold px-2 py-1 rounded-lg bg-[#f4f4f5] border border-transparent text-[#3b5bdb] hover:bg-[#eef1fe] transition-all cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {s}
                          </button>
                        ))}
                        <span className="flex-1" />
                        {onLeadDelete && (
                          <button
                            onClick={handleBulkDelete}
                            disabled={isBulkActing}
                            className="text-[9px] font-bold px-2 py-1 rounded-lg bg-[#fdecec] border border-red-200 text-[#d9534f] hover:bg-[#fbdcdc] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                          >
                            <Trash2 size={10} /> Eliminar
                          </button>
                        )}
                        <button
                          onClick={() => setCheckedLeadIds(new Set())}
                          className="text-[9px] text-[#3b5bdb] hover:text-[#3b5bdb] cursor-pointer shrink-0"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Quick add lead form */}
                <AnimatePresence>
                  {showAddForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-[#f5f6ff] border border-[#e0e7ff] rounded-2xl p-3 space-y-2">
                        <span className="text-[10px] font-bold text-[#3b5bdb] uppercase tracking-wider block">Agregar lead manualmente</span>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newLeadName}
                            onChange={(e) => setNewLeadName(e.target.value)}
                            placeholder="Nombre *"
                            className="bg-[#f4f4f5] border border-transparent rounded-lg px-2.5 py-1.5 text-xs text-[#27272a] focus:outline-none focus:border-[#3b5bdb]"
                          />
                          <input
                            type="text"
                            value={newLeadPhone}
                            onChange={(e) => setNewLeadPhone(e.target.value)}
                            placeholder="Teléfono (opcional)"
                            className="bg-[#f4f4f5] border border-transparent rounded-lg px-2.5 py-1.5 text-xs text-[#27272a] focus:outline-none focus:border-[#3b5bdb]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={newLeadOrigin}
                            onChange={(e) => setNewLeadOrigin(e.target.value as CRMLead["origin"])}
                            className="flex-1 bg-[#f4f4f5] border border-transparent rounded-lg px-2.5 py-1.5 text-xs text-[#27272a] focus:outline-none"
                          >
                            <option value="WhatsApp">WhatsApp</option>
                            <option value="Instagram">Instagram</option>
                            <option value="Facebook">Facebook</option>
                            <option value="Email">Email</option>
                          </select>
                          <button
                            onClick={handleAddLead}
                            disabled={isAddingLead || !newLeadName.trim()}
                            className="px-3 py-1.5 bg-[#4f6ef7] hover:bg-[#3b5bdb] text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isAddingLead ? "Guardando…" : "Guardar"}
                          </button>
                          <button
                            onClick={() => setShowAddForm(false)}
                            className="px-3 py-1.5 bg-white text-[#4b5563] text-xs font-medium border border-[#e2e5ee] rounded-lg hover:bg-[#f3f5fb] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {COLUMNS.map((col) => {
                    const columnLeads = filteredLeads.filter((l) => l.status === col);
                    const dot: Record<string, string> = { Nuevo: "bg-[#6366f1]", Contactado: "bg-[#ffcf2e]", Presupuestado: "bg-[#818cf8]", Cerrado: "bg-[#7dd87d]" };
                    return (
                      <div key={col} className="bg-[#f3f5fb] rounded-2xl p-3.5 flex flex-col h-[500px]">
                        <div className="flex justify-between items-center mb-3.5 px-1">
                          <span className="flex items-center gap-2 text-[13px] font-semibold text-[#3f3f46]">
                            <span className={`w-2 h-2 rounded-full ${dot[col]}`} />
                            {col}
                          </span>
                          <span className="px-2 py-0.5 bg-white rounded-full text-[12px] text-[#6b7280] font-medium shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
                            {columnLeads.length}
                          </span>
                        </div>

                        {/* Leads Cards Container */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                          {columnLeads.map((lead) => (
                            <motion.div
                              key={lead.id}
                              onClick={() => { setSelectedLead(lead); setEditingNotes(null); }}
                              whileHover={{ y: -2 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28 }}
                              className={`p-3.5 rounded-2xl text-left cursor-pointer bg-white ${
                                selectedLead?.id === lead.id
                                  ? "ring-2 ring-[#3b5bdb] shadow-[0_8px_24px_rgba(79,70,229,0.12)]"
                                  : "shadow-[0_1px_2px_rgba(24,24,27,0.04),0_2px_8px_rgba(24,24,27,0.04)] hover:shadow-[0_8px_24px_rgba(24,24,27,0.08)]"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 mb-2.5">
                                <div
                                  onClick={(e) => toggleCheckedLead(lead.id, e)}
                                  className={`w-4 h-4 rounded-md border-2 shrink-0 flex items-center justify-center cursor-pointer transition-all ${
                                    checkedLeadIds.has(lead.id)
                                      ? "bg-[#4f6ef7] border-[#4f6ef7]"
                                      : "border-[#cbd0e0] bg-white hover:border-[#818cf8]"
                                  }`}
                                >
                                  {checkedLeadIds.has(lead.id) && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <img referrerPolicy="no-referrer" src={lead.avatar} alt={lead.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                <span className="text-[14px] font-semibold text-[#111111] truncate flex-1">{lead.name}</span>
                                {isHot(lead) && <span title="Lead caliente" className="shrink-0 text-[14px]">🔥</span>}
                                {!isHot(lead) && isStale(lead) && (
                                  <span title="Sin actividad hace +24h" className="shrink-0"><Clock size={13} className="text-[#ffcf2e]" /></span>
                                )}
                              </div>

                              <p className="text-[12.5px] text-[#6b7280] leading-snug line-clamp-2 mb-2.5">{lead.notes || "Sin notas"}</p>

                              {/* Score bar */}
                              <div className="w-full h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden mb-2.5" title={getScoreLabel(lead)}>
                                <div
                                  className={`h-full rounded-full transition-all ${lead.score >= 85 ? "bg-[#7dd87d]" : lead.score >= 70 ? "bg-[#ffd84d]" : "bg-[#cbd0e0]"}`}
                                  style={{ width: `${lead.score}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getOriginColor(lead.origin)}`}>
                                  {lead.origin}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[12px] font-semibold ${lead.score >= 85 ? "text-[#4caf4c]" : lead.score >= 70 ? "text-[#b8860b]" : "text-[#9ca3af]"}`}>{lead.score}%</span>
                                  {col !== "Cerrado" && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); const next = COLUMNS[COLUMNS.indexOf(col) + 1]; if (next) handleMoveLead(lead.id, next); }}
                                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[#9ca3af] hover:text-[#4f6ef7] hover:bg-[#f5f6ff] transition-all shrink-0"
                                      title={`Mover a ${COLUMNS[COLUMNS.indexOf(col) + 1]}`}
                                    >
                                      <ChevronRight size={15} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <span className="text-[11px] text-[#9ca3af] mt-2 block">{timeAgo(lead.lastInteraction)}</span>
                            </motion.div>
                          ))}

                          {columnLeads.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center py-10">
                              <UserCheck size={22} className="text-[#cbd0e0] mb-1.5" />
                              <span className="text-[12px] text-[#9ca3af]">Sin contactos</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lead Details Right (4 columns on lg grid) */}
              <div className="lg:col-span-4 p-4 sm:p-5 flex flex-col h-full overflow-y-auto border-l border-[#f0f1f5]">
                {selectedLead ? (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Avatar Profile */}
                      <div className="flex items-start gap-3.5 pb-4 border-b border-[#f4f4f5]">
                        <img
                          referrerPolicy="no-referrer"
                          src={selectedLead.avatar}
                          alt={selectedLead.name}
                          className="w-14 h-14 rounded-full object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[16px] text-[#111111]">{selectedLead.name}</h4>
                          <span className="text-[13px] text-[#6b7280] block">{selectedLead.phone || "Sin teléfono"}</span>
                          <span className={`mt-1 inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-full ${selectedLead.score >= 85 ? "text-[#3f9f3f] bg-[#eafaea]" : selectedLead.score >= 65 ? "text-[#a67c00] bg-[#fff7e0]" : "text-[#4b5563] bg-[#f4f4f5]"}`} title={getScoreLabel(selectedLead)}>
                            Score {selectedLead.score} · {selectedLead.score >= 85 ? "Alta" : selectedLead.score >= 65 ? "Media" : "Baja"}
                            {isHot(selectedLead) && " 🔥"}
                          </span>
                          <span className="text-[11.5px] text-[#9ca3af] block mt-1.5">{getScoreLabel(selectedLead)}</span>
                        </div>
                        {selectedLead.phone && (
                          <a
                            href={`https://wa.me/${selectedLead.phone.replace(/\D/g, "")}`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-2.5 bg-[#eafaea] hover:bg-[#dcf5dc] text-[#3f9f3f] rounded-xl flex items-center gap-1 text-[12px] font-medium transition-all shrink-0"
                            title="Abrir chat en WhatsApp"
                          >
                            <Phone size={14} />
                          </a>
                        )}
                      </div>

                      {/* Lead Stage Controls */}
                      <div className="py-4 border-b border-[#f4f4f5] space-y-2.5">
                        <span className="text-[12px] font-medium text-[#6b7280] block">Etapa del embudo</span>
                        <div className="grid grid-cols-2 gap-2">
                          {COLUMNS.map((stage) => (
                            <button
                              key={stage}
                              onClick={() => handleMoveLead(selectedLead.id, stage)}
                              className={`py-2 px-3 rounded-xl text-[13px] font-medium text-center transition-all cursor-pointer ${
                                selectedLead.status === stage
                                  ? "bg-[#4f6ef7] text-white"
                                  : "bg-[#f4f4f5] text-[#4b5563] hover:bg-[#e2e5ee]"
                              }`}
                            >
                              {stage}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* CRM Notes — editable */}
                      <div className="py-4 border-b border-[#f4f4f5] space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[12px] font-medium text-[#6b7280]">Notas e interés</span>
                          {onLeadUpdate && editingNotes === null && (
                            <button
                              onClick={() => setEditingNotes(selectedLead.notes)}
                              className="text-[12px] text-[#4f6ef7] hover:underline cursor-pointer"
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
                              className="w-full bg-[#f4f4f5] border border-transparent rounded-xl p-2.5 text-xs text-[#3f3f46] focus:outline-none focus:border-[#3b5bdb] resize-none font-mono"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={handleSaveNotes}
                                disabled={isSavingNotes}
                                className="flex-1 py-1 rounded-lg bg-[#4f6ef7] text-white text-[10px] font-bold hover:bg-[#3b5bdb] transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isSavingNotes ? "Guardando…" : "Guardar"}
                              </button>
                              <button
                                onClick={() => setEditingNotes(null)}
                                className="py-1 px-3 rounded-lg bg-[#f4f4f5] text-[#4b5563] text-[10px] font-bold hover:bg-[#e2e5ee] transition-all cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[13.5px] text-[#3f3f46] bg-[#f3f5fb] p-3 rounded-xl leading-relaxed min-h-[44px]">
                            {selectedLead.notes || <span className="text-[#9ca3af] italic">Sin notas</span>}
                          </p>
                        )}
                      </div>

                      {/* Category / Tag */}
                      {onLeadUpdate && (
                        <div className="py-4 border-b border-[#f4f4f5] flex items-center gap-3">
                          <span className="text-[12px] font-medium text-[#6b7280] shrink-0">Categoría</span>
                          <input
                            type="text"
                            defaultValue={selectedLead.category || ""}
                            placeholder="Ej: Ropa, Calzado, VIP…"
                            onBlur={async (e) => {
                              const val = e.target.value.trim();
                              if (val !== (selectedLead.category || "")) {
                                const updated = await onLeadUpdate(selectedLead.id, { category: val || undefined });
                                setSelectedLead(updated);
                                setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l));
                              }
                            }}
                            className="flex-1 bg-[#f3f5fb] rounded-xl px-3 py-2 text-[13px] text-[#3f3f46] focus:outline-none focus:ring-2 focus:ring-[#eef1fe] min-w-0"
                          />
                        </div>
                      )}

                      {/* Register sale amount */}
                      {selectedLead.status === "Cerrado" && onLeadUpdate && (
                        <div className="py-3 border-b border-[#f4f4f5] space-y-1.5">
                          <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider block">
                            Monto de la Venta (ARS)
                          </span>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min={0}
                              defaultValue={selectedLead.totalSpent || 0}
                              id={`total-spent-${selectedLead.id}`}
                              className="flex-1 bg-[#f4f4f5] border border-transparent rounded-xl px-3 py-1.5 text-xs text-[#27272a] focus:outline-none focus:border-[#3b5bdb]"
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
                              className="px-3 py-1.5 bg-[#4caf4c] hover:bg-[#3f9f3f] text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer"
                            >
                              Guardar
                            </button>
                          </div>
                          {selectedLead.totalSpent ? (
                            <p className="text-[9px] text-[#4caf4c] font-mono font-bold">
                              Venta actual: ${selectedLead.totalSpent.toLocaleString("es-AR")} ARS
                            </p>
                          ) : null}
                        </div>
                      )}

                      {/* Conversation Monitoring history */}
                      <div className="py-4 space-y-3 flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold text-[#111111] flex items-center gap-1.5">
                            <MessageSquare size={14} className="text-[#4f6ef7]" /> Conversación IA · {selectedLead.conversationHistory.length} mensajes
                          </span>
                          {selectedLead.conversationHistory.length > 0 && (
                            <span className="text-[11px] text-[#9ca3af]">{timeAgo(selectedLead.lastInteraction)}</span>
                          )}
                        </div>
                        {selectedLead.conversationHistory.length === 0 ? (
                          <div className="bg-[#f3f5fb] rounded-2xl p-8 text-center text-[13px] text-[#9ca3af] flex-1 min-h-[320px] flex flex-col items-center justify-center gap-2">
                            <MessageSquare size={26} className="text-[#cbd0e0]" />
                            Sin historial aún. Iniciá una conversación en Estudio IA.
                          </div>
                        ) : (
                          <div className="space-y-3 bg-[#f3f5fb] p-4 rounded-2xl flex-1 min-h-[320px] max-h-[520px] overflow-y-auto">
                            {selectedLead.conversationHistory.map((h, index) => (
                              <div
                                key={index}
                                className={`flex ${h.role === "user" ? "justify-end" : "justify-start"}`}
                              >
                                <div className={`max-w-[86%] px-4 py-2.5 rounded-[18px] text-[14px] leading-relaxed ${
                                  h.role === "user"
                                    ? "bg-[#dcf5dc] text-emerald-900 rounded-tr-md"
                                    : "bg-white text-[#3f3f46] rounded-tl-md shadow-[0_1px_2px_rgba(24,24,27,0.05)]"
                                }`}>
                                  <span className={`font-semibold block text-[11.5px] mb-1 ${h.role === "user" ? "text-[#3f9f3f]" : "text-[#4f6ef7]"}`}>
                                    {h.role === "user" ? "Cliente" : (config.botPersonaName || "Respondo AI")}
                                  </span>
                                  {h.text}
                                  {h.timestamp && (
                                    <span className="block text-[10.5px] opacity-50 mt-1 text-right">
                                      {new Date(h.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Human Override Controls */}
                    <div className="pt-4 border-t border-[#f4f4f5] space-y-2.5">
                      <button
                        onClick={() => { toggleManualOverride(selectedLead.id); setManualMessage(""); setManualSendFeedback(null); }}
                        className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isOverride(selectedLead)
                            ? "bg-[#d9534f] hover:bg-[#c33b37] text-white"
                            : "bg-[#b8860b] hover:bg-[#a67c00] text-white"
                        }`}
                      >
                        <User size={14} />
                        {isOverride(selectedLead)
                          ? "Re-activar Agente de IA"
                          : "Intervenir Chat (Derivar a Humano)"}
                      </button>
                      {isOverride(selectedLead) ? (
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-[#a67c00] bg-[#fff7e0] border border-amber-200 rounded-lg px-2 py-1 text-center font-medium">
                            IA pausada. Escribí un mensaje para enviar al cliente.
                          </p>
                          {/* Quick reply chips for human agent */}
                          <div className="flex flex-wrap gap-1">
                            {(config.quickReplies?.length
                              ? config.quickReplies
                              : ["¿En qué más te ayudo?","Te paso el precio","¿Coordinamos el envío?","Muchas gracias por tu consulta"]
                            ).map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setManualMessage(r)}
                                className="text-[8px] font-medium px-2 py-0.5 rounded-full bg-[#f4f4f5] border border-[#e2e5ee] text-[#4b5563] hover:bg-[#f5f6ff] hover:border-[#e0e7ff] hover:text-[#3b5bdb] cursor-pointer transition-all"
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={manualMessage}
                              onChange={(e) => setManualMessage(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendManualMessage(); } }}
                              placeholder="Escribí tu mensaje…"
                              className="flex-1 bg-[#f4f4f5] border border-transparent rounded-xl px-3 py-1.5 text-xs text-[#27272a] focus:outline-none focus:border-[#3b5bdb]"
                            />
                            <button
                              onClick={handleSendManualMessage}
                              disabled={isSendingManual || !manualMessage.trim()}
                              className="p-2 bg-[#4caf4c] hover:bg-[#3f9f3f] text-white rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Send size={13} />
                            </button>
                          </div>
                          {manualSendFeedback && (
                            <p className="text-[9px] text-center font-medium text-[#4b5563]">{manualSendFeedback}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[9px] text-[#9ca3af] text-center">
                          La IA de Respondo responde 24/7 de forma autónoma.
                        </p>
                      )}
                      {onLeadDelete && (
                        <button
                          onClick={handleDeleteSelectedLead}
                          disabled={isDeletingLead}
                          className="w-full py-1.5 px-4 rounded-xl text-xs font-semibold border border-red-200 text-[#e26562] hover:bg-[#fdecec] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          {isDeletingLead ? "Eliminando…" : "Eliminar lead"}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                    <UserCheck size={36} className="text-[#9ca3af] mb-2" />
                    <span className="text-xs text-[#3f3f46] font-semibold">Seleccioná un Lead</span>
                    <span className="text-[10px] text-[#9ca3af] max-w-xs mt-1">
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
              <div className="lg:col-span-6 bg-[#f3f5fb] p-5 rounded-2xl border border-[#e2e5ee] space-y-4">
                <div className="flex items-center space-x-2 pb-3 border-b border-[#e2e5ee]">
                  <div className="p-2 bg-[#eafaea] text-[#3f9f3f] rounded-lg">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#111111]">Nueva Campaña Masiva de WhatsApp</h4>
                    <p className="text-[10px] text-[#9ca3af]">Envío 100% seguro utilizando la API Oficial de Meta</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#6b7280]">Nombre de la Campaña</label>
                    <input
                      type="text"
                      value={newCampName}
                      onChange={(e) => setNewCampName(e.target.value)}
                      className="w-full bg-[#f4f4f5] border border-transparent rounded-xl px-3 py-2 text-xs text-[#27272a] focus:outline-none focus:border-[#3b5bdb] transition-colors"
                      placeholder="Ej: Hot Sale Lanzamiento"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#6b7280]">Segmento de Audiencia Objetivo</label>
                    <select
                      value={newCampSegment}
                      onChange={(e) => setNewCampSegment(e.target.value)}
                      className="w-full bg-[#f4f4f5] border border-transparent rounded-xl px-3 py-2 text-xs text-[#27272a] focus:outline-none focus:border-[#3b5bdb] transition-colors"
                    >
                      <option value="Todos los contactos">Todos los contactos ({leads.length} leads activos)</option>
                      <option value="Clientes con Carrito Incompleto">Carritos Abandonados (Inactivos)</option>
                      <option value="Interesados en Camperas (Talle L)">Interesados en Camperas</option>
                      <option value="Compradores Recurrentes">Compradores Recurrentes</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-[#6b7280]">Plantilla de Mensaje</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateCampaign}
                          disabled={aiCampLoading}
                          className="text-[11px] font-semibold px-3 h-7 rounded-full bg-[#eef1fe] text-[#4f6ef7] hover:bg-[#e0e7ff] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                          title="La IA escribe la campaña con tu catálogo y tono (usa el nombre como objetivo)"
                        >
                          <Sparkles size={11} /> {aiCampLoading ? "Generando…" : "Generar con IA"}
                        </button>
                        <span className="text-[9px] text-[#9ca3af] font-mono font-bold">Use {"{{nombre}}"} y {"{{empresa}}"}</span>
                      </div>
                    </div>
                    {/* Quick template picker */}
                    <div className="flex flex-wrap gap-1.5 pb-1">
                      {CAMPAIGN_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => { setNewCampTemplate(tpl.text); setNewCampName(tpl.name); }}
                          className="text-[9px] font-semibold px-2 py-1 rounded-lg bg-[#f4f4f5] border border-transparent text-[#4b5563] hover:bg-[#f5f6ff] hover:border-[#c7d2fe] hover:text-[#3b5bdb] transition-all cursor-pointer"
                        >
                          {tpl.name}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={newCampTemplate}
                      onChange={(e) => setNewCampTemplate(e.target.value)}
                      rows={4}
                      className="w-full bg-[#f4f4f5] border border-transparent rounded-xl p-3 text-xs text-[#27272a] focus:outline-none focus:border-[#3b5bdb] transition-colors resize-none font-mono leading-relaxed"
                    />
                    {/* Live preview with sample data */}
                    {newCampTemplate && (
                      <div className="bg-[#f4f4f5] border border-transparent rounded-xl p-3 space-y-1.5">
                        <span className="text-[9px] font-bold text-[#9ca3af] uppercase tracking-wider block">Vista previa (con datos reales)</span>
                        <div className="flex justify-end">
                          <div className="bg-[#DCF8C6] text-[#27272a] text-[11px] leading-relaxed rounded-2xl rounded-tr-none px-3 py-2 max-w-[85%] border border-[#c2e7af] whitespace-pre-wrap">
                            {newCampTemplate
                              .replace(/\{\{nombre\}\}/gi, leads[0]?.name || "María García")
                              .replace(/\{\{empresa\}\}/gi, "Tu Negocio")}
                          </div>
                        </div>
                        <p className="text-[8px] text-[#9ca3af] text-right">
                          Muestra con {leads[0] ? `datos de "${leads[0].name}"` : "datos de ejemplo"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                  {/* Media URL (optional) */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#6b7280]">Imagen adjunta (URL opcional)</label>
                    <input
                      type="url"
                      value={newCampMediaUrl}
                      onChange={(e) => setNewCampMediaUrl(e.target.value)}
                      placeholder="https://tu-tienda.com/banner-oferta.jpg"
                      className="w-full bg-[#f4f4f5] border border-transparent rounded-xl px-3 py-2 text-xs text-[#27272a] focus:outline-none focus:border-[#3b5bdb] transition-colors"
                    />
                    {newCampMediaUrl && (
                      <img src={newCampMediaUrl} alt="Preview" className="w-full max-h-24 object-cover rounded-xl border border-[#e2e5ee] mt-1" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                  </div>

                  {/* Scheduling */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#6b7280] flex items-center gap-1">
                      <Clock size={11} className="text-[#ffcf2e]" /> Programar envío (opcional — dejá vacío para enviar ahora)
                    </label>
                    <input
                      type="datetime-local"
                      value={newCampScheduledAt}
                      onChange={(e) => setNewCampScheduledAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full bg-[#f4f4f5] border border-transparent rounded-xl px-3 py-2 text-xs text-[#27272a] focus:outline-none focus:border-[#3b5bdb] transition-colors"
                    />
                    {newCampScheduledAt && new Date(newCampScheduledAt) > new Date() && (
                      <p className="text-[10px] text-[#a67c00] font-medium flex items-center gap-1">
                        <Clock size={10} /> Programado para: {new Date(newCampScheduledAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    )}
                  </div>

                {isSendingCampaign ? (
                  <div className="space-y-2 py-2">
                    <div className="flex justify-between text-xs font-semibold text-[#4caf4c]">
                      <span className="flex items-center gap-1.5">
                        <Zap size={12} className="animate-bounce" /> Procesando envíos Meta API...
                      </span>
                      <span>{sendingProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#e2e5ee] border border-[#cbd0e0] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${sendingProgress}%` }}
                        className="h-full bg-[#111111] transition-all duration-300"
                      />
                    </div>
                    <span className="text-[9px] text-[#9ca3af] block text-center italic">
                      Evitando baneos: Respondo realiza el envío utilizando los servidores oficiales de Meta Cloud.
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleLaunchCampaign}
                    className={`w-full py-2 px-4 rounded-xl text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                      newCampScheduledAt && new Date(newCampScheduledAt) > new Date()
                        ? "bg-[#b8860b] hover:bg-[#a67c00]"
                        : "bg-[#4caf4c] hover:bg-[#3f9f3f]"
                    }`}
                  >
                    {newCampScheduledAt && new Date(newCampScheduledAt) > new Date()
                      ? <><Clock size={12} /> Programar Campaña</>
                      : <><Send size={12} /> Disparar Campaña Masiva</>
                    }
                  </button>
                )}
              </div>

              {/* Campaigns Analytics Right (6 columns) */}
              <div className="lg:col-span-6 flex flex-col space-y-4 max-h-[460px] overflow-y-auto pr-1">
                <span className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider block">
                  Campañas Recientes & Métricas de API Oficial
                </span>

                <div className="space-y-3">
                  {campaigns.map((camp) => (
                    <div
                      key={camp.id}
                      className="p-4 bg-[#f3f5fb] border border-[#e2e5ee] rounded-2xl space-y-3 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-bold text-xs text-[#27272a]">{camp.name}</h5>
                          <span className="text-[9px] px-2 py-0.5 bg-white text-[#6b7280] border border-[#e2e5ee] rounded-full font-mono">
                            Segmento: {camp.segment}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            camp.status === "Completado"
                              ? "bg-[#eafaea] text-[#3f9f3f] border-emerald-200"
                              : "bg-[#f4f4f5] text-[#9ca3af] border-[#cbd0e0]"
                          }`}>
                            {camp.status}
                          </span>
                          {camp.scheduledAt && (
                            <span className="text-[8px] text-[#a67c00] bg-[#fff7e0] border border-amber-200 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                              <Clock size={8} /> {new Date(camp.scheduledAt).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>

                      {camp.mediaUrl && (
                        <img src={camp.mediaUrl} alt="Media" className="w-full h-16 object-cover rounded-lg border border-[#e2e5ee]" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      )}
                      <p className="text-[10px] text-[#4b5563] bg-white p-2 rounded-lg italic border border-[#e2e5ee] font-mono">
                        "{camp.template.replace("{{nombre}}", "Agustín").replace("{{empresa}}", "Respondo")}"
                      </p>

                      {camp.sentCount > 0 && (() => {
                        const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
                        const openRate = pct(camp.readCount, camp.sentCount);
                        const replyRate = pct(camp.repliesCount, camp.sentCount);
                        const convRate = pct(camp.repliesCount, camp.readCount); // replied of those who read
                        const metrics = [
                          { label: "Enviados", value: `${camp.sentCount}`, rate: 100, color: "bg-[#9ca3af]", text: "text-[#111111]" },
                          { label: "Apertura", value: `${openRate}%`, rate: openRate, color: "bg-[#6366f1]", text: "text-[#4f6ef7]" },
                          { label: "Respuesta", value: `${replyRate}%`, rate: replyRate, color: "bg-[#7dd87d]", text: "text-[#4caf4c]" },
                          { label: "Conversión", value: `${convRate}%`, rate: convRate, color: "bg-[#818cf8]", text: "text-[#3b5bdb]" },
                        ];
                        return (
                          <div className="grid grid-cols-4 gap-2 pt-1">
                            {metrics.map((m) => (
                              <div key={m.label} className="p-2 bg-white rounded-xl text-center ds-shadow">
                                <span className={`text-[13px] font-bold block ${m.text}`}>{m.value}</span>
                                <span className="text-[8px] text-[#9ca3af] block uppercase font-semibold tracking-wide mb-1">{m.label}</span>
                                <div className="w-full h-1 bg-[#f4f4f5] rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${m.color}`} style={{ width: `${Math.max(2, m.rate)}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
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
