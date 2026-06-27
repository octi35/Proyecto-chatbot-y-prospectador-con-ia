import React from "react";
import { motion } from "motion/react";
import {
  Users, TrendingUp, DollarSign, Flame, ArrowUpRight, ArrowDownRight,
  ArrowRight, MessageSquare, Clock,
} from "lucide-react";
import { CRMLead, Campaign, AgentConfig } from "../types";
import { timeAgo } from "../lib/timeAgo";

interface DashboardHomeProps {
  leads: CRMLead[];
  campaigns: Campaign[];
  config: AgentConfig;
  onNavigate: (tab: string) => void;
}

export default function DashboardHome({ leads, campaigns, config, onNavigate }: DashboardHomeProps) {
  const totalLeads = leads.length;
  const closed = leads.filter((l) => l.status === "Cerrado").length;
  const totalSales = leads.reduce((a, l) => a + (l.totalSpent || 0), 0);
  const convRate = totalLeads > 0 ? Math.round((closed / totalLeads) * 100) : 0;

  const todayStr = new Date().toDateString();
  const newToday = leads.filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === todayStr);
  const hotLeads = leads.filter(
    (l) => l.score >= 85 && Date.now() - new Date(l.lastInteraction).getTime() < 2 * 60 * 60 * 1000
  );

  // Last 7 days activity for the chart (by lastInteraction)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    const count = leads.filter((l) => new Date(l.lastInteraction).toDateString() === key).length;
    return { label: d.toLocaleDateString("es-AR", { weekday: "short" }).slice(0, 1).toUpperCase(), count };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  // Top leads by score (the "popular products" analog)
  const topLeads = [...leads].sort((a, b) => b.score - a.score).slice(0, 5);

  // Recent activity (the "comments" analog)
  const recent = [...leads]
    .sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime())
    .slice(0, 4);

  const metrics = [
    { label: "Prospectos", value: totalLeads.toLocaleString("es-AR"), delta: newToday.length, up: true, icon: <Users size={16} />, grad: "from-indigo-500 to-blue-600", glow: "shadow-[0_0_24px_-6px_rgba(99,102,241,0.6)]" },
    { label: "Ventas ARS", value: `$${(totalSales / 1000).toFixed(totalSales >= 1000 ? 0 : 1)}k`, delta: closed, up: true, icon: <DollarSign size={16} />, grad: "from-emerald-500 to-teal-600", glow: "shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]" },
    { label: "Conversión", value: `${convRate}%`, delta: convRate, up: convRate >= 20, icon: <TrendingUp size={16} />, grad: "from-violet-500 to-purple-600", glow: "shadow-[0_0_24px_-6px_rgba(139,92,246,0.6)]" },
    { label: "Calientes", value: `${hotLeads.length}`, delta: hotLeads.length, up: true, icon: <Flame size={16} />, grad: "from-orange-500 to-amber-600", glow: "shadow-[0_0_24px_-6px_rgba(245,158,11,0.6)]" },
  ];

  const statusTint = (s: CRMLead["status"]) =>
    s === "Cerrado" ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
    : s === "Presupuestado" ? "text-violet-300 bg-violet-500/10 border border-violet-500/20"
    : s === "Contactado" ? "text-amber-300 bg-amber-500/10 border border-amber-500/20"
    : "text-sky-300 bg-sky-500/10 border border-sky-500/20";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* LEFT / MAIN (2 cols) */}
      <div className="xl:col-span-2 space-y-5">
        {/* Overview metric cards */}
        <section className="card rounded-[24px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-semibold tracking-tight text-white">Resumen</h2>
            <span className="text-[12px] text-[#6b6b76]">En tiempo real</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="relative rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 overflow-hidden card-hover"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${m.grad} flex items-center justify-center text-white ${m.glow}`}>{m.icon}</span>
                  {m.delta > 0 && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${m.up ? "text-emerald-300 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                      {m.up ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}+{m.delta}
                    </span>
                  )}
                </div>
                <span className="block text-[27px] font-bold tracking-[-0.03em] text-white leading-none">{m.value}</span>
                <span className="block text-[11px] text-[#8e8e96] font-medium mt-1.5">{m.label}</span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* New leads today + avatars */}
        <section className="card rounded-[24px] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-white">
                {newToday.length > 0 ? `${newToday.length} ${newToday.length === 1 ? "lead nuevo" : "leads nuevos"} hoy` : "Sin leads nuevos hoy"}
              </h3>
              <p className="text-[12.5px] text-[#8e8e96] mt-0.5">Tu agente los captó y registró automáticamente.</p>
            </div>
            <button onClick={() => onNavigate("crm")} className="text-[12px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Ver todos <ArrowRight size={13} />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-4">
            {(newToday.length > 0 ? newToday : leads).slice(0, 6).map((l) => (
              <div key={l.id} className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => onNavigate("crm")}>
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-indigo-400/50 group-hover:scale-105 transition-all" />
                <span className="text-[10px] text-[#8e8e96] font-medium truncate max-w-[52px]">{l.name.split(" ")[0]}</span>
              </div>
            ))}
            {leads.length === 0 && <p className="text-[12px] text-[#6b6b76]">Todavía no hay leads. Probá el chat en Estudio IA.</p>}
          </div>
        </section>

        {/* Activity chart */}
        <section className="card rounded-[24px] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-white">Actividad de la semana</h3>
              <p className="text-[12.5px] text-[#8e8e96] mt-0.5">Interacciones por día (últimos 7 días)</p>
            </div>
            <span className="text-[20px] font-bold tracking-tight text-white">{days.reduce((a, d) => a + d.count, 0)}</span>
          </div>
          <div className="flex items-end gap-2 h-32">
            {days.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }}
                    transition={{ delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                    className={`w-full rounded-lg ${i === days.length - 1 ? "bg-gradient-to-t from-indigo-500 to-blue-400 shadow-[0_0_20px_-4px_rgba(99,102,241,0.8)]" : "bg-white/10"}`}
                  />
                </div>
                <span className="text-[10px] text-[#6b6b76] font-medium">{d.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* RIGHT column */}
      <div className="space-y-5">
        {/* Top leads */}
        <section className="card rounded-[24px] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold tracking-tight text-white">Mejores leads</h3>
            <button onClick={() => onNavigate("crm")} className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">Ver CRM</button>
          </div>
          <div className="space-y-1">
            {topLeads.map((l) => (
              <div key={l.id} onClick={() => onNavigate("crm")} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-white/10" />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold text-white block truncate">{l.name}</span>
                  <span className="text-[11px] text-[#8e8e96]">Score {l.score}</span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusTint(l.status)}`}>{l.status}</span>
              </div>
            ))}
            {topLeads.length === 0 && <p className="text-[12px] text-[#6b6b76] py-4 text-center">Sin leads todavía</p>}
          </div>
        </section>

        {/* Recent activity */}
        <section className="card rounded-[24px] p-5">
          <h3 className="text-[15px] font-semibold tracking-tight text-white mb-3">Actividad reciente</h3>
          <div className="space-y-3">
            {recent.map((l) => (
              <div key={l.id} className="flex gap-3">
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 ring-1 ring-white/10" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-[#e4e4e7] leading-snug">
                    <strong className="font-semibold text-white">{l.name}</strong>{" "}
                    <span className="text-[#8e8e96]">{l.status === "Cerrado" ? "concretó una compra" : "interactuó por " + l.origin}</span>
                  </p>
                  <span className="text-[10px] text-[#6b6b76] flex items-center gap-1 mt-0.5"><Clock size={9} /> {timeAgo(l.lastInteraction)}</span>
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="text-center py-4">
                <MessageSquare size={22} className="text-[#3a3a44] mx-auto mb-1.5" />
                <p className="text-[12px] text-[#6b6b76]">La actividad aparecerá acá</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
