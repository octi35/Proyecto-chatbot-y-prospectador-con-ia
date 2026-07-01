import React from "react";
import { motion } from "motion/react";
import {
  Users, TrendingUp, DollarSign, Flame, ArrowUpRight,
  ArrowRight, Sparkles, MessageSquare,
} from "lucide-react";
import { CRMLead, Campaign, AgentConfig } from "../types";
import { timeAgo } from "../lib/timeAgo";
import { Card, Badge, Button, StatCard, SectionHeading } from "./ui";

interface DashboardHomeProps {
  leads: CRMLead[];
  campaigns: Campaign[];
  config: AgentConfig;
  onNavigate: (tab: string) => void;
}

export default function DashboardHome({ leads, onNavigate }: DashboardHomeProps) {
  const totalLeads = leads.length;
  const closed = leads.filter((l) => l.status === "Cerrado").length;
  const totalSales = leads.reduce((a, l) => a + (l.totalSpent || 0), 0);
  const convRate = totalLeads > 0 ? Math.round((closed / totalLeads) * 100) : 0;
  const newToday = leads.filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === new Date().toDateString());
  const hotLeads = leads.filter((l) => l.score >= 85 && Date.now() - new Date(l.lastInteraction).getTime() < 2 * 60 * 60 * 1000);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    const count = leads.filter((l) => new Date(l.lastInteraction).toDateString() === key).length;
    return { label: d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""), count };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const peakIdx = days.reduce((b, d, i, a) => (d.count > a[b].count ? i : b), 0);

  const topLeads = [...leads].sort((a, b) => b.score - a.score).slice(0, 5);
  const recent = [...leads].sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime()).slice(0, 4);

  const stats = [
    { label: "Prospectos", value: totalLeads.toLocaleString("es-AR"), icon: <Users size={18} />, tone: "accent" as const, delta: `+${newToday.length}` },
    { label: "Ventas", value: `$${(totalSales / 1000).toFixed(totalSales >= 1000 ? 0 : 1)}k`, icon: <DollarSign size={18} />, tone: "success" as const, delta: `+${closed}` },
    { label: "Conversión", value: `${convRate}%`, icon: <TrendingUp size={18} />, tone: "warning" as const, delta: `${convRate}%` },
    { label: "Leads calientes", value: `${hotLeads.length}`, icon: <Flame size={18} />, tone: "danger" as const, delta: "ahora" },
  ];

  const statusTone = (s: CRMLead["status"]) =>
    s === "Cerrado" ? "success" : s === "Presupuestado" ? "accent" : s === "Contactado" ? "warning" : "info";

  // Vibrant "Interaction History" deal cards (Salesforce-style)
  const dealCards = topLeads.slice(0, 4).map((l, i) => {
    const palettes = [
      { bg: "bg-indigo-600", text: "text-white", sub: "text-indigo-200", chip: "bg-white/15 text-white" },
      { bg: "bg-teal-400", text: "text-zinc-900", sub: "text-teal-900/70", chip: "bg-black/10 text-zinc-900" },
      { bg: "bg-amber-300", text: "text-zinc-900", sub: "text-amber-900/70", chip: "bg-black/10 text-zinc-900" },
      { bg: "bg-zinc-900", text: "text-white", sub: "text-zinc-400", chip: "bg-white/10 text-white" },
    ];
    const amount = l.totalSpent && l.totalSpent > 0 ? l.totalSpent : Math.round(l.score * 1500);
    return { lead: l, ...palettes[i % palettes.length], amount };
  });

  return (
    <div className="space-y-6">
      {/* Metric row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <StatCard
            key={s.label} index={i} icon={s.icon} label={s.label} value={s.value} tone={s.tone}
            hint={<Badge tone="success"><ArrowUpRight size={11} /> {s.delta}</Badge>}
          />
        ))}
      </div>

      {/* Vibrant deal cards — "Historial de oportunidades" */}
      {dealCards.length > 0 && (
        <div>
          <SectionHeading
            title="Oportunidades destacadas"
            action={<button onClick={() => onNavigate("crm")} className="text-[13px] font-medium text-indigo-600 hover:text-indigo-500 transition-colors">Ver todas</button>}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {dealCards.map((d, i) => (
              <motion.div
                key={d.lead.id}
                onClick={() => onNavigate("crm")}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 26 }}
                whileHover={{ y: -4 }}
                className={`${d.bg} ${d.text} rounded-3xl p-5 cursor-pointer shadow-[0_8px_30px_rgba(24,24,27,0.10)] flex flex-col justify-between min-h-[168px]`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${d.chip}`}>
                    {new Date(d.lead.lastInteraction).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                  </span>
                  <span className={`w-8 h-8 rounded-full ${d.chip} flex items-center justify-center`}>
                    <ArrowUpRight size={15} />
                  </span>
                </div>
                <div className="mt-4">
                  <p className={`text-[12.5px] ${d.sub} leading-snug line-clamp-1`}>{d.lead.notes || `${d.lead.origin} · ${d.lead.status}`}</p>
                  <p className="text-[26px] font-bold tracking-tight leading-none mt-1 tabular-nums">
                    ${d.amount.toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={d.lead.avatar} referrerPolicy="no-referrer" alt={d.lead.name} className="w-6 h-6 rounded-full object-cover ring-2 ring-white/40 shrink-0" />
                    <span className="text-[12px] font-medium truncate">{d.lead.name}</span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${d.chip}`}>{d.lead.score}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Chart + promo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <SectionHeading
            title="Actividad de la semana"
            action={<span className="text-[13px] text-zinc-400">Últimos 7 días</span>}
          />
          <div className="text-[28px] font-semibold tracking-tight text-zinc-900 tabular-nums">
            {days.reduce((a, d) => a + d.count, 0)}
            <span className="text-[13px] font-normal text-zinc-400 ml-2">interacciones</span>
          </div>
          <div className="flex items-end gap-3 h-40 mt-6">
            {days.map((d, i) => {
              const isPeak = i === peakIdx && d.count > 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2.5 relative group">
                  {isPeak && (
                    <span className="absolute -top-1 z-10 bg-zinc-900 text-white text-[11px] font-medium px-2 py-1 rounded-lg whitespace-nowrap">
                      {d.count}
                    </span>
                  )}
                  <div className="w-full flex flex-col justify-end" style={{ height: "130px" }}>
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: `${Math.max(8, (d.count / maxDay) * 100)}%` }}
                      transition={{ delay: i * 0.05, type: "spring", stiffness: 200, damping: 22 }}
                      className={isPeak ? "w-full rounded-lg bg-indigo-600" : "w-full rounded-lg bg-zinc-100 group-hover:bg-zinc-200 transition-colors"}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400 font-medium capitalize">{d.label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Promo */}
        <Card className="relative p-6 bg-zinc-900 overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-12 -bottom-12 w-44 h-44 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="relative">
            <Badge tone="accent" className="bg-white/10 text-indigo-300">Nuevo</Badge>
            <h3 className="text-[19px] font-semibold text-white leading-tight mt-3">Tu agente IA vende 24/7</h3>
            <p className="text-[13px] text-zinc-400 mt-2 leading-relaxed">
              Responde en WhatsApp, Instagram, Facebook y Email. Probalo y mirá cómo cierra ventas solo.
            </p>
          </div>
          <Button variant="accent" className="relative mt-6 w-full" onClick={() => onNavigate("playground")}>
            <Sparkles size={15} /> Probar ahora
          </Button>
        </Card>
      </div>

      {/* Activity + leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <SectionHeading title="Actividad reciente" action={<button onClick={() => onNavigate("crm")} className="text-[13px] font-medium text-indigo-600 hover:text-indigo-500 transition-colors">Ver todo</button>} />
          <div className="space-y-4">
            {recent.map((l) => (
              <div key={l.id} className="flex items-center gap-3">
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-zinc-700 leading-snug">
                    <span className="font-medium text-zinc-900">{l.name}</span>{" "}
                    {l.status === "Cerrado" ? "concretó una compra" : `escribió por ${l.origin}`}
                  </p>
                  <span className="text-[11px] text-zinc-400">{timeAgo(l.lastInteraction)}</span>
                </div>
                <Badge tone={statusTone(l.status)}>{l.status}</Badge>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="text-center py-8"><MessageSquare size={22} className="text-zinc-300 mx-auto mb-2" /><p className="text-[13px] text-zinc-400">La actividad aparecerá acá</p></div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeading title="Mejores leads" action={<button onClick={() => onNavigate("crm")} className="text-[13px] font-medium text-indigo-600 hover:text-indigo-500 transition-colors">Ver CRM</button>} />
          <div className="space-y-1">
            {topLeads.map((l) => (
              <motion.div
                key={l.id} onClick={() => onNavigate("crm")} whileHover={{ x: 2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-xl hover:bg-zinc-50 cursor-pointer"
              >
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-zinc-900 block truncate">{l.name}</span>
                  <span className="text-[11px] text-zinc-400">{l.origin} · Score {l.score}</span>
                </div>
                <Badge tone={statusTone(l.status)}>{l.status}</Badge>
              </motion.div>
            ))}
            {topLeads.length === 0 && <p className="text-[13px] text-zinc-400 py-8 text-center">Sin leads todavía</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
