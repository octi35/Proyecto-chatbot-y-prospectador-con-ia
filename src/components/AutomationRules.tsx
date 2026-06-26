import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, Plus, Trash2, Loader2, ArrowRight, Workflow } from "lucide-react";
import { AutomationRule } from "../types";
import {
  getAutomations, createAutomation, updateAutomation, deleteAutomation,
} from "../lib/api";

// Human-friendly labels for each trigger and action
const TRIGGERS: { value: AutomationRule["trigger"]; label: string; needsValue?: string }[] = [
  { value: "new_lead", label: "Entra un lead nuevo" },
  { value: "lead_stale", label: "Un lead queda inactivo", needsValue: "Horas sin actividad (ej: 24)" },
  { value: "high_score", label: "Un lead supera un score", needsValue: "Score mínimo (ej: 85)" },
  { value: "status_closed", label: "Se cierra una venta" },
  { value: "keyword_match", label: "El cliente dice una palabra", needsValue: "Palabra clave (ej: reembolso)" },
];

const ACTIONS: { value: AutomationRule["action"]; label: string; needsValue?: string }[] = [
  { value: "send_followup", label: "Enviar seguimiento automático" },
  { value: "notify", label: "Notificarme", needsValue: "Texto del aviso (opcional)" },
  { value: "move_stage", label: "Mover de etapa", needsValue: "Etapa destino (ej: Contactado)" },
  { value: "tag_lead", label: "Etiquetar el lead", needsValue: "Etiqueta (ej: VIP)" },
];

const triggerLabel = (t: string) => TRIGGERS.find((x) => x.value === t)?.label || t;
const actionLabel = (a: string) => ACTIONS.find((x) => x.value === a)?.label || a;

export default function AutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // New-rule form state
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationRule["trigger"]>("new_lead");
  const [triggerValue, setTriggerValue] = useState("");
  const [action, setAction] = useState<AutomationRule["action"]>("notify");
  const [actionValue, setActionValue] = useState("");

  useEffect(() => {
    getAutomations().then(setRules).catch(() => setRules([])).finally(() => setLoading(false));
  }, []);

  const triggerDef = TRIGGERS.find((t) => t.value === trigger);
  const actionDef = ACTIONS.find((a) => a.value === action);

  const resetForm = () => {
    setName(""); setTrigger("new_lead"); setTriggerValue("");
    setAction("notify"); setActionValue("");
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await createAutomation({
        name: name.trim(), enabled: true,
        trigger, triggerValue: triggerValue.trim() || undefined,
        action, actionValue: actionValue.trim() || undefined,
      });
      setRules((prev) => [created, ...prev]);
      resetForm();
      setShowForm(false);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const toggleRule = async (rule: AutomationRule) => {
    const updated = await updateAutomation(rule.id, { enabled: !rule.enabled });
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
  };

  const removeRule = async (id: string) => {
    await deleteAutomation(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="bg-white border border-slate-150 rounded-[28px] p-6 shadow-apple space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-apple-sm">
            <Workflow size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[18px] tracking-tight text-[#1d1d1f]">Automatizaciones</h3>
            <p className="text-[12.5px] text-[#6e6e73]">Reglas que se ejecutan solas: si pasa X, hacé Y</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`px-4 py-2 rounded-full text-[13px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            showForm ? "bg-slate-100 text-[#1d1d1f]" : "bg-[#0071e3] text-white hover:bg-[#0077ed]"
          }`}
        >
          <Plus size={15} className={showForm ? "rotate-45 transition-transform" : "transition-transform"} />
          {showForm ? "Cancelar" : "Nueva regla"}
        </button>
      </div>

      {/* New rule form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-50/70 border border-slate-150 rounded-2xl p-4 space-y-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la regla (ej: Avisar leads calientes)"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] transition-colors"
              />
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Trigger */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                    <Zap size={11} /> Cuando pase esto
                  </label>
                  <select
                    value={trigger}
                    onChange={(e) => { setTrigger(e.target.value as AutomationRule["trigger"]); setTriggerValue(""); }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] cursor-pointer"
                  >
                    {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {triggerDef?.needsValue && (
                    <input
                      type="text"
                      value={triggerValue}
                      onChange={(e) => setTriggerValue(e.target.value)}
                      placeholder={triggerDef.needsValue}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[12px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                    />
                  )}
                </div>
                {/* Action */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[#0071e3] uppercase tracking-wide flex items-center gap-1">
                    <ArrowRight size={11} /> Hacé esto
                  </label>
                  <select
                    value={action}
                    onChange={(e) => { setAction(e.target.value as AutomationRule["action"]); setActionValue(""); }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] cursor-pointer"
                  >
                    {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  {actionDef?.needsValue && (
                    <input
                      type="text"
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                      placeholder={actionDef.needsValue}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[12px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]"
                    />
                  )}
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="w-full py-2.5 bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Crear regla
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules list */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-[#86868b]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-10 px-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
            <Workflow size={26} className="text-slate-300" />
          </div>
          <p className="text-[14px] font-semibold text-[#1d1d1f]">Sin automatizaciones todavía</p>
          <p className="text-[12.5px] text-[#6e6e73] mt-1 max-w-sm mx-auto">
            Creá tu primera regla para que el sistema trabaje solo: seguimientos, avisos de leads calientes, etiquetas y más.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                rule.enabled ? "bg-white border-slate-150 shadow-apple-sm" : "bg-slate-50/60 border-slate-100 opacity-70"
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${rule.enabled ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400"}`}>
                <Zap size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[13.5px] font-semibold text-[#1d1d1f] block truncate">{rule.name}</span>
                <div className="flex items-center gap-1.5 text-[11px] text-[#6e6e73] mt-0.5 flex-wrap">
                  <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md font-medium">{triggerLabel(rule.trigger)}{rule.triggerValue ? `: ${rule.triggerValue}` : ""}</span>
                  <ArrowRight size={10} className="text-slate-400" />
                  <span className="bg-blue-50 text-[#0071e3] px-1.5 py-0.5 rounded-md font-medium">{actionLabel(rule.action)}{rule.actionValue ? `: ${rule.actionValue}` : ""}</span>
                  {(rule.timesTriggered ?? 0) > 0 && (
                    <span className="text-[10px] text-slate-400">· {rule.timesTriggered}× ejecutada</span>
                  )}
                </div>
              </div>
              {/* iOS toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={rule.enabled}
                onClick={() => toggleRule(rule)}
                className={`relative w-10 h-[22px] rounded-full transition-colors duration-300 shrink-0 cursor-pointer ${rule.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-300 ${rule.enabled ? "translate-x-[18px]" : "translate-x-0"}`} />
              </button>
              <button
                onClick={() => removeRule(rule.id)}
                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                title="Eliminar regla"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
