import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Plus, Trash2, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { WaTemplate } from "../types";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from "../lib/api";
import { toast } from "./ui/toast";

const CATEGORIES: WaTemplate["category"][] = ["MARKETING", "UTILITY", "AUTHENTICATION"];
const CATEGORY_LABEL: Record<WaTemplate["category"], string> = {
  MARKETING: "Marketing", UTILITY: "Utilidad", AUTHENTICATION: "Autenticación",
};
const STATUS_META: Record<WaTemplate["status"], { label: string; cls: string; icon: React.ReactNode }> = {
  APROBADA: { label: "Aprobada", cls: "text-[#3f9f3f] bg-[#eafaea]", icon: <CheckCircle2 size={11} /> },
  PENDIENTE: { label: "Pendiente", cls: "text-[#a67c00] bg-[#fff7e0]", icon: <Clock size={11} /> },
  RECHAZADA: { label: "Rechazada", cls: "text-[#d9534f] bg-[#fdecec]", icon: <XCircle size={11} /> },
};

export default function WaTemplateManager() {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("es_AR");
  const [category, setCategory] = useState<WaTemplate["category"]>("MARKETING");
  const [body, setBody] = useState("");

  useEffect(() => {
    getTemplates().then(setTemplates).catch(() => setTemplates([])).finally(() => setLoading(false));
  }, []);

  const reset = () => { setName(""); setLanguage("es_AR"); setCategory("MARKETING"); setBody(""); };

  const handleCreate = async () => {
    if (!name.trim() || !body.trim()) { toast.error("Faltan datos", "Completá el nombre y el cuerpo del mensaje."); return; }
    setSaving(true);
    try {
      const created = await createTemplate({ name: name.trim(), language, category, body: body.trim(), status: "PENDIENTE" });
      setTemplates((prev) => [created, ...prev]);
      reset(); setShowForm(false);
      toast.success("Plantilla creada", "Quedó en revisión (pendiente).");
    } catch (e) {
      toast.error("No se pudo crear la plantilla", (e as Error).message);
    } finally { setSaving(false); }
  };

  const cycleStatus = async (t: WaTemplate) => {
    const order: WaTemplate["status"][] = ["PENDIENTE", "APROBADA", "RECHAZADA"];
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    try {
      const updated = await updateTemplate(t.id, { status: next });
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch (e) {
      toast.error("No se pudo actualizar el estado", (e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Plantilla eliminada");
    } catch (e) {
      toast.error("No se pudo eliminar", (e as Error).message);
    }
  };

  // Variable count for preview hint
  const varCount = (body.match(/\{\{\d+\}\}/g) || []).length;

  return (
    <div className="bg-white rounded-[22px] p-6 ds-shadow space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[14px] bg-[#111111] flex items-center justify-center text-white ds-shadow">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[18px] tracking-tight text-[#111111]">Plantillas de WhatsApp</h3>
            <p className="text-[12.5px] text-[#6b7280]">Mensajes aprobados por Meta para campañas masivas legales</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`px-4 py-2 rounded-full text-[13px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${showForm ? "bg-[#f4f4f5] text-[#111111]" : "bg-[#4f6ef7] text-white hover:bg-[#3b5bdb]"}`}
        >
          <Plus size={15} className={showForm ? "rotate-45 transition-transform" : "transition-transform"} />
          {showForm ? "Cancelar" : "Nueva plantilla"}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#f3f5fb]/70 rounded-2xl p-4 space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase())}
                  placeholder="nombre_plantilla"
                  className="bg-[#f4f4f5] border border-transparent rounded-xl px-3 py-2 text-[13px] text-[#111111] focus:outline-none focus:border-[#4f6ef7]"
                />
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-[#f4f4f5] border border-transparent rounded-xl px-3 py-2 text-[13px] text-[#111111] focus:outline-none focus:border-[#4f6ef7] cursor-pointer">
                  <option value="es_AR">Español (AR)</option>
                  <option value="es_MX">Español (MX)</option>
                  <option value="es_ES">Español (ES)</option>
                  <option value="en_US">English (US)</option>
                  <option value="pt_BR">Português (BR)</option>
                </select>
                <select value={category} onChange={(e) => setCategory(e.target.value as WaTemplate["category"])} className="bg-[#f4f4f5] border border-transparent rounded-xl px-3 py-2 text-[13px] text-[#111111] focus:outline-none focus:border-[#4f6ef7] cursor-pointer">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                </select>
              </div>
              <textarea
                value={body} onChange={(e) => setBody(e.target.value)} rows={3}
                placeholder="Hola {{1}}, tenemos una oferta especial para vos en {{2}}. ¡Respondé para más info!"
                className="w-full bg-[#f4f4f5] border border-transparent rounded-xl p-3 text-[13px] text-[#111111] focus:outline-none focus:border-[#4f6ef7] resize-none leading-relaxed"
              />
              <p className="text-[10px] text-[#9ca3af]">Usá {"{{1}}"}, {"{{2}}"}… para variables. {varCount > 0 ? `${varCount} variable${varCount !== 1 ? "s" : ""} detectada${varCount !== 1 ? "s" : ""}.` : "Sin variables."}</p>
              <button
                onClick={handleCreate} disabled={saving || !name.trim() || !body.trim()}
                className="w-full py-2.5 bg-[#4f6ef7] hover:bg-[#3b5bdb] disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Crear plantilla
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-[#9ca3af]"><Loader2 size={20} className="animate-spin" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-[#f3f5fb] flex items-center justify-center mx-auto mb-3"><FileText size={26} className="text-[#cbd0e0]" /></div>
          <p className="text-[14px] font-semibold text-[#111111]">Sin plantillas todavía</p>
          <p className="text-[12.5px] text-[#6b7280] mt-1 max-w-sm mx-auto">Creá plantillas para enviar campañas masivas por la API oficial sin riesgo de baneo.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {templates.map((t) => {
            const s = STATUS_META[t.status];
            return (
              <div key={t.id} className="p-3.5 rounded-2xl bg-white ds-shadow">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-mono font-semibold text-[#111111] truncate">{t.name}</span>
                    <span className="text-[10px] text-[#9ca3af] bg-[#f4f4f5] px-1.5 py-0.5 rounded-md shrink-0">{t.language}</span>
                    <span className="text-[10px] text-[#6b7280] bg-[#f4f4f5] px-1.5 py-0.5 rounded-md shrink-0">{CATEGORY_LABEL[t.category]}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => cycleStatus(t)} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full cursor-pointer ${s.cls}`} title="Cambiar estado (simula la revisión de Meta)">
                      {s.icon} {s.label}
                    </button>
                    <button onClick={() => remove(t.id)} className="p-1 text-[#cbd0e0] hover:text-[#e26562] transition-colors cursor-pointer" title="Eliminar"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="text-[12px] text-[#6b7280] mt-2 leading-relaxed bg-[#f3f5fb]/70 rounded-xl px-3 py-2 whitespace-pre-wrap">{t.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
