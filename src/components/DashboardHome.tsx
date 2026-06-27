import React from "react";
import { motion } from "motion/react";
import {
  Users, TrendingUp, DollarSign, Flame, ArrowUpRight,
  ArrowRight, Sparkles, Clock, MessageSquare,
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
  const newToday = leads.filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === new Date().toDateString());
  const hotLeads = leads.filter((l) => l.score >= 85 && Date.now() - new Date(l.lastInteraction).getTime() < 2 * 60 * 60 * 1000);

  // Monthly revenue-style chart — last 7 days of activity, peak highlighted
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    const count = leads.filter((l) => new Date(l.lastInteraction).toDateString() === key).length;
    return { label: d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""), count };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const peakIdx = days.reduce((best, d, i, arr) => (d.count > arr[best].count ? i : best), 0);

  const topLeads = [...leads].sort((a, b) => b.score - a.score).slice(0, 5);
  const recent = [...leads].sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime()).slice(0, 4);

  const metrics = [
    { label: "Prospectos", value: totalLeads.toLocaleString("es-AR"), delta: `+${newToday.length}`, icon: <Users size={18} />, ring: "bg-blue-50 text-blue-600" },
    { label: "Ventas", value: `$${(totalSales / 1000).toFixed(totalSales >= 1000 ? 0 : 1)}k`, delta: `+${closed}`, icon: <DollarSign size={18} />, ring: "bg-emerald-50 text-emerald-600" },
    { label: "Conversión", value: `${convRate}%`, delta: `${convRate}%`, icon: <TrendingUp size={18} />, ring: "bg-orange-50 text-orange-500" },
    { label: "Calientes", value: `${hotLeads.length}`, delta: `🔥`, icon: <Flame size={18} />, ring: "bg-red-50 text-red-500" },
  ];

  const statusTint = (s: CRMLead["status"]) =>
    s === "Cerrado" ? "text-emerald-700 bg-emerald-50"
    : s === "Presupuestado" ? "text-violet-700 bg-violet-50"
    : s === "Contactado" ? "text-amber-700 bg-amber-50"
    : "text-sky-700 bg-sky-50";

  return (
    <div className="space-y-5">
      {/* ===== Top metric row ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white border border-slate-100 rounded-3xl p-5 shadow-apple-sm lift"
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${m.ring}`}>{m.icon}</span>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-0.5">
                <ArrowUpRight size={10} /> {m.delta}
              </span>
            </div>
            <span className="block text-[28px] font-bold tracking-[-0.03em] text-[#101828] leading-none">{m.value}</span>
            <span className="block text-[12.5px] text-[#667085] font-medium mt-1.5">{m.label}</span>
          </motion.div>
        ))}
      </div>

      {/* ===== Chart + promo ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue chart (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-apple-sm">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-[15px] font-semibold text-[#101828]">Actividad mensual</h3>
              <p className="text-[12px] text-[#98a2b3] mt-0.5">Interacciones por día (últimos 7)</p>
            </div>
            <select className="text-[12px] text-[#667085] border border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none cursor-pointer">
              <option>Últimos 7 días</option>
            </select>
          </div>
          <span className="block text-[30px] font-bold tracking-[-0.03em] text-[#101828] mt-3 mb-5">
            {days.reduce((a, d) => a + d.count, 0)} <span className="text-[14px] font-medium text-[#98a2b3]">interacciones</span>
          </span>
          <div className="flex items-end gap-3 h-40">
            {days.map((d, i) => {
              const isPeak = i === peakIdx && d.count > 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 relative group">
                  {isPeak && (
                    <span className="absolute -top-1 z-10 bg-[#101828] text-white text-[10px] font-semibold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap">
                      {d.count} hoy
                    </span>
                  )}
                  <div className="w-full flex flex-col justify-end" style={{ height: "130px" }}>
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: `${Math.max(8, (d.count / maxDay) * 100)}%` }}
                      transition={{ delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                      className={`w-full rounded-xl ${isPeak ? "bg-blue-600" : "bg-slate-100 group-hover:bg-slate-200"} transition-colors`}
                    />
                  </div>
                  <span className="text-[11px] text-[#98a2b3] font-medium capitalize">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Blue gradient promo card */}
        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-6 shadow-apple overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute right-6 top-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="relative">
            <span className="inline-block text-[10px] font-bold text-blue-700 bg-white px-2.5 py-1 rounded-full mb-3">NUEVO</span>
            <h3 className="text-[19px] font-bold text-white leading-tight tracking-tight">Tu agente IA está activo 24/7</h3>
            <p className="text-[12.5px] text-blue-100 mt-2 leading-relaxed">
              Responde en WhatsApp, Instagram, Facebook y Email. Probalo y mirá cómo vende solo.
            </p>
          </div>
          <button
            onClick={() => onNavigate("playground")}
            className="relative mt-5 bg-white text-blue-700 text-[13px] font-semibold py-2.5 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={14} /> Probar ahora
          </button>
        </div>
      </div>

      {/* ===== Activities + recent leads ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent activity */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-apple-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#101828]">Actividad reciente</h3>
            <button onClick={() => onNavigate("crm")} className="text-[12px] font-semibold text-blue-600 hover:underline">Ver todo</button>
          </div>
          <div className="space-y-4">
            {recent.map((l) => (
              <div key={l.id} className="flex gap-3 items-start">
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#344054] leading-snug">
                    <strong className="font-semibold text-[#101828]">{l.name}</strong>{" "}
                    {l.status === "Cerrado" ? "concretó una compra" : `escribió por ${l.origin}`}
                  </p>
                  <span className="text-[11px] text-[#98a2b3] flex items-center gap-1 mt-0.5"><Clock size={10} /> {timeAgo(l.lastInteraction)}</span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusTint(l.status)}`}>{l.status}</span>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="text-center py-6"><MessageSquare size={22} className="text-slate-300 mx-auto mb-1.5" /><p className="text-[12px] text-[#98a2b3]">La actividad aparecerá acá</p></div>
            )}
          </div>
        </div>

        {/* Top leads table */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-apple-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#101828]">Mejores leads</h3>
            <button onClick={() => onNavigate("crm")} className="text-[12px] font-semibold text-blue-600 hover:underline">Ver CRM</button>
          </div>
          <div className="space-y-1">
            {topLeads.map((l) => (
              <div key={l.id} onClick={() => onNavigate("crm")} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold text-[#101828] block truncate">{l.name}</span>
                  <span className="text-[11px] text-[#98a2b3]">{l.origin} · Score {l.score}</span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusTint(l.status)}`}>{l.status}</span>
              </div>
            ))}
            {topLeads.length === 0 && <p className="text-[12px] text-[#98a2b3] py-6 text-center">Sin leads todavía</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
