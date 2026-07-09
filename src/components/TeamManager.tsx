import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Plus, Trash2, Loader2, ShieldCheck, UserRound, Mail } from "lucide-react";
import { getTeam, addTeamMember, updateTeamMember, removeTeamMember, TeamMember } from "../lib/api";
import { toast } from "./ui/toast";

const ROLE_LABEL: Record<TeamMember["role"], string> = { admin: "Administrador", agente: "Agente" };

export default function TeamManager() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("agente");

  useEffect(() => {
    getTeam().then(setMembers).catch(() => setMembers([])).finally(() => setLoading(false));
  }, []);

  const reset = () => { setEmail(""); setName(""); setRole("agente"); };

  const handleAdd = async () => {
    if (!email.trim()) { toast.error("Falta el email", "Ingresá el email del miembro."); return; }
    setSaving(true);
    try {
      const created = await addTeamMember({ email: email.trim(), name: name.trim(), role });
      setMembers((prev) => [...prev, created]);
      reset(); setShowForm(false);
      toast.success("Miembro agregado", `${created.name || created.email} — ${ROLE_LABEL[created.role]}`);
    } catch (e) {
      toast.error("No se pudo agregar", (e as Error).message);
    } finally { setSaving(false); }
  };

  const cycleRole = async (m: TeamMember) => {
    const next: TeamMember["role"] = m.role === "admin" ? "agente" : "admin";
    try {
      const updated = await updateTeamMember(m.id, { role: next });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) {
      toast.error("No se pudo cambiar el rol", (e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await removeTeamMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success("Miembro eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar", (e as Error).message);
    }
  };

  return (
    <div className="bg-white rounded-[16px] p-6 shadow-card space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[14px] bg-[#101010] flex items-center justify-center text-white shadow-card">
            <Users size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[18px] tracking-tight text-[#111111]">Equipo y roles</h3>
            <p className="text-[12.5px] text-[#6b7280]">Sumá gente a tu equipo y asigná los chats del CRM a cada persona</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`px-4 h-9 rounded-full text-[13px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${showForm ? "bg-[#f3f5fb] text-[#111111]" : "bg-[#4f6ef7] text-white hover:bg-[#3b5bdb]"}`}
        >
          <Plus size={15} className={showForm ? "rotate-45 transition-transform" : "transition-transform"} />
          {showForm ? "Cancelar" : "Agregar miembro"}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#f7f8fc] rounded-2xl p-4 space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@equipo.com"
                  className="bg-white border border-[#e5e7eb] rounded-xl px-3 h-11 text-[13px] text-[#111111] focus:outline-none focus:border-[#4f6ef7]"
                />
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre (opcional)"
                  className="bg-white border border-[#e5e7eb] rounded-xl px-3 h-11 text-[13px] text-[#111111] focus:outline-none focus:border-[#4f6ef7]"
                />
                <select
                  value={role} onChange={(e) => setRole(e.target.value as TeamMember["role"])}
                  className="bg-white border border-[#e5e7eb] rounded-xl px-3 h-11 text-[13px] text-[#111111] focus:outline-none focus:border-[#4f6ef7] cursor-pointer"
                >
                  <option value="agente">Agente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button
                onClick={handleAdd} disabled={saving || !email.trim()}
                className="w-full h-11 bg-[#4f6ef7] hover:bg-[#3b5bdb] disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Agregar al equipo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-[#9ca3af]"><Loader2 size={20} className="animate-spin" /></div>
      ) : members.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-[#f7f8fc] flex items-center justify-center mx-auto mb-3"><Users size={26} className="text-[#9ca3af]" /></div>
          <p className="text-[14px] font-semibold text-[#111111]">Todavía trabajás solo</p>
          <p className="text-[12.5px] text-[#6b7280] mt-1 max-w-sm mx-auto">Agregá a tu equipo para repartir los chats y que cada consulta tenga un responsable.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#f7f8fc]">
              <div className="w-9 h-9 rounded-full bg-[#4f6ef7] flex items-center justify-center text-white text-[13px] font-semibold shrink-0">
                {(m.name || m.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-[#111111] truncate flex items-center gap-1.5">
                  <UserRound size={12} className="text-[#9ca3af]" /> {m.name || m.email.split("@")[0]}
                </p>
                <p className="text-[11.5px] text-[#9ca3af] truncate flex items-center gap-1"><Mail size={10} /> {m.email}</p>
              </div>
              <button
                onClick={() => cycleRole(m)}
                title="Cambiar rol"
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors ${m.role === "admin" ? "bg-[#eef1fe] text-[#4f6ef7]" : "bg-[#e9f8ec] text-[#2f8f4e]"}`}
              >
                <ShieldCheck size={11} /> {ROLE_LABEL[m.role]}
              </button>
              <button onClick={() => remove(m.id)} className="p-1 text-[#d1d5db] hover:text-[#e26562] transition-colors cursor-pointer" title="Eliminar"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
