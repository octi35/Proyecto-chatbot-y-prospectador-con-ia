import React from "react";
import { motion } from "motion/react";
import {
  Users, TrendingUp, DollarSign, Flame, ArrowUpRight,
  Sparkles, MessageSquare, Calendar as CalendarIcon,
  Send, UserPlus, Megaphone, ChevronRight,
} from "lucide-react";
import { CRMLead, Campaign, AgentConfig } from "../types";
import { timeAgo } from "../lib/timeAgo";
import { Card, Badge, Button, StatCard, SectionTitle, QuickAction, AvatarGroup } from "./ui";

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
    { label: "Prospectos", value: totalLeads.toLocaleString("es-AR"), icon: <Users size={18} />, tone: "brand" as const, delta: `+${newToday.length}` },
    { label: "Ventas", value: `$${(totalSales / 1000).toFixed(totalSales >= 1000 ? 0 : 1)}k`, icon: <DollarSign size={18} />, tone: "success" as const, delta: `+${closed}` },
    { label: "Conversión", value: `${convRate}%`, icon: <TrendingUp size={18} />, tone: "warning" as const, delta: `${convRate}%` },
    { label: "Leads calientes", value: `${hotLeads.length}`, icon: <Flame size={18} />, tone: "danger" as const, delta: "ahora" },
  ];

  const statusTone = (s: CRMLead["status"]) =>
    s === "Cerrado" ? "success" : s === "Presupuestado" ? "brand" : s === "Contactado" ? "warning" : "info";

  // Soft-palette opportunity cards (Salesforce-style, never saturated)
  const dealCards = topLeads.slice(0, 4).map((l, i) => {
    const palettes = [
      { bg: "bg-[#4f6ef7]", text: "text-white", sub: "text-white/70", chip: "bg-white/15 text-white", ring: "ring-white/40" },
      { bg: "bg-[#8fd4f8]", text: "text-[#0d3b52]", sub: "text-[#0d3b52]/60", chip: "bg-black/10 text-[#0d3b52]", ring: "ring-black/10" },
      { bg: "bg-[#ffd84d]", text: "text-[#5c4700]", sub: "text-[#5c4700]/60", chip: "bg-black/10 text-[#5c4700]", ring: "ring-black/10" },
      { bg: "bg-[#101010]", text: "text-white", sub: "text-white/50", chip: "bg-white/10 text-white", ring: "ring-white/30" },
    ];
    const amount = l.totalSpent && l.totalSpent > 0 ? l.totalSpent : Math.round(l.score * 1500);
    return { lead: l, ...palettes[i % palettes.length], amount };
  });

  // Sales funnel by status
  const funnelStages: { label: string; status: CRMLead["status"]; color: string }[] = [
    { label: "Nuevos", status: "Nuevo", color: "#8fd4f8" },
    { label: "Contactados", status: "Contactado", color: "#4f6ef7" },
    { label: "Presupuestados", status: "Presupuestado", color: "#ffd84d" },
    { label: "Cerrados", status: "Cerrado", color: "#7dd87d" },
  ];
  const funnel = funnelStages.map((s) => ({ ...s, count: leads.filter((l) => l.status === s.status).length }));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  // Mini calendar (current month)
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

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

      {/* Opportunity cards */}
      {dealCards.length > 0 && (
        <div>
          <SectionTitle
            title="Oportunidades destacadas"
            subtitle="Tus leads con mayor score listos para cerrar"
            action={<button onClick={() => onNavigate("crm")} className="text-[13px] font-medium text-[#4f6ef7] hover:brightness-110 transition-all flex items-center gap-1">Ver todas <ChevronRight size={14} /></button>}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {dealCards.map((d, i) => (
              <motion.div
                key={d.lead.id}
                onClick={() => onNavigate("crm")}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 26 }}
                whileHover={{ y: -3 }}
                className={`${d.bg} ${d.text} rounded-[22px] p-5 cursor-pointer ds-shadow flex flex-col justify-between min-h-[168px]`}
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
                    <img src={d.lead.avatar} referrerPolicy="no-referrer" alt={d.lead.name} className={`w-6 h-6 rounded-full object-cover ring-2 ${d.ring} shrink-0`} />
                    <span className="text-[12px] font-medium truncate">{d.lead.name}</span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${d.chip}`}>{d.lead.score}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Main grid: activity chart + funnel | agenda/calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: activity + funnel (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <SectionTitle
              title="Actividad de la semana"
              action={<span className="text-[13px] text-[#9aa0ab]">Últimos 7 días</span>}
            />
            <div className="text-[28px] font-semibold tracking-tight text-[#111] tabular-nums">
              {days.reduce((a, d) => a + d.count, 0)}
              <span className="text-[13px] font-normal text-[#9aa0ab] ml-2">interacciones</span>
            </div>
            <div className="flex items-end gap-3 h-40 mt-6">
              {days.map((d, i) => {
                const isPeak = i === peakIdx && d.count > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2.5 relative group">
                    {isPeak && (
                      <span className="absolute -top-1 z-10 bg-[#101010] text-white text-[11px] font-medium px-2 py-1 rounded-lg whitespace-nowrap">
                        {d.count}
                      </span>
                    )}
                    <div className="w-full flex flex-col justify-end" style={{ height: "130px" }}>
                      <motion.div
                        initial={{ height: 0 }} animate={{ height: `${Math.max(8, (d.count / maxDay) * 100)}%` }}
                        transition={{ delay: i * 0.05, type: "spring", stiffness: 200, damping: 22 }}
                        className={isPeak ? "w-full rounded-lg bg-[#4f6ef7]" : "w-full rounded-lg bg-[#eef1fe] group-hover:bg-[#dbe1fd] transition-colors"}
                      />
                    </div>
                    <span className="text-[11px] text-[#9aa0ab] font-medium capitalize">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Funnel */}
          <Card className="p-6">
            <SectionTitle title="Embudo de ventas" subtitle="Distribución de leads por etapa" />
            <div className="space-y-3.5">
              {funnel.map((f, i) => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="w-28 text-[13px] text-[#6b7280] shrink-0">{f.label}</span>
                  <div className="flex-1 h-8 bg-[#f7f8fc] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${Math.max(6, (f.count / funnelMax) * 100)}%` }}
                      transition={{ delay: i * 0.08, type: "spring", stiffness: 200, damping: 24 }}
                      className="h-full rounded-full flex items-center justify-end pr-3"
                      style={{ background: f.color }}
                    >
                      <span className="text-[12px] font-semibold text-[#111]/70 tabular-nums">{f.count}</span>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column: promo + calendar + quick actions */}
        <div className="space-y-6">
          {/* Promo / AI card */}
          <motion.div
            whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative p-6 rounded-[22px] ds-shadow bg-[#101010] overflow-hidden flex flex-col justify-between min-h-[190px]"
          >
            <div className="absolute -right-12 -bottom-12 w-44 h-44 bg-[#4f6ef7]/25 rounded-full blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/10 text-[#8fd4f8]">Nuevo</span>
              <h3 className="text-[19px] font-semibold text-white leading-tight mt-3">Tu agente IA vende 24/7</h3>
              <p className="text-[13px] text-white/50 mt-2 leading-relaxed">
                Responde en WhatsApp, Instagram, Facebook y Email. Probalo y mirá cómo cierra ventas solo.
              </p>
            </div>
            <Button variant="brand" className="relative mt-6 w-full" onClick={() => onNavigate("playground")}>
              <Sparkles size={15} /> Probar ahora
            </Button>
          </motion.div>

          {/* Mini calendar */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-[#111] capitalize">{monthLabel}</h3>
              <CalendarIcon size={16} className="text-[#9aa0ab]" />
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <span key={i} className="text-[10px] font-medium text-[#9aa0ab] py-1">{d}</span>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = day === now.getDate();
                return (
                  <span key={day} className={`text-[12px] py-1.5 rounded-lg cursor-default transition-colors ${
                    isToday ? "bg-[#4f6ef7] text-white font-semibold" : "text-[#6b7280] hover:bg-[#f3f4f8]"
                  }`}>
                    {day}
                  </span>
                );
              })}
            </div>
          </Card>

          {/* Quick actions */}
          <Card className="p-6">
            <SectionTitle title="Acciones rápidas" />
            <div className="grid grid-cols-3 gap-3">
              <QuickAction icon={<MessageSquare size={18} />} label="Probar IA" onClick={() => onNavigate("playground")} />
              <QuickAction icon={<UserPlus size={18} />} label="Nuevo lead" onClick={() => onNavigate("crm")} />
              <QuickAction icon={<Megaphone size={18} />} label="Campaña" onClick={() => onNavigate("crm")} />
              <QuickAction icon={<Send size={18} />} label="Plantilla" onClick={() => onNavigate("integrations")} />
              <QuickAction icon={<TrendingUp size={18} />} label="Métricas" onClick={() => onNavigate("analytics")} />
              <QuickAction icon={<Users size={18} />} label="Ver CRM" onClick={() => onNavigate("crm")} />
            </div>
          </Card>
        </div>
      </div>

      {/* Activity + leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <SectionTitle title="Actividad reciente" action={<button onClick={() => onNavigate("crm")} className="text-[13px] font-medium text-[#4f6ef7] hover:brightness-110 transition-all">Ver todo</button>} />
          <div className="space-y-4">
            {recent.map((l) => (
              <div key={l.id} className="flex items-center gap-3">
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#6b7280] leading-snug">
                    <span className="font-medium text-[#111]">{l.name}</span>{" "}
                    {l.status === "Cerrado" ? "concretó una compra" : `escribió por ${l.origin}`}
                  </p>
                  <span className="text-[11px] text-[#9aa0ab]">{timeAgo(l.lastInteraction)}</span>
                </div>
                <Badge tone={statusTone(l.status)}>{l.status}</Badge>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="text-center py-8"><MessageSquare size={22} className="text-[#d1d5db] mx-auto mb-2" /><p className="text-[13px] text-[#9aa0ab]">La actividad aparecerá acá</p></div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            title="Mejores leads"
            action={
              <div className="flex items-center gap-3">
                <AvatarGroup avatars={topLeads.map((l) => l.avatar)} />
                <button onClick={() => onNavigate("crm")} className="text-[13px] font-medium text-[#4f6ef7] hover:brightness-110 transition-all">Ver CRM</button>
              </div>
            }
          />
          <div className="space-y-1">
            {topLeads.map((l) => (
              <motion.div
                key={l.id} onClick={() => onNavigate("crm")} whileHover={{ x: 2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-xl hover:bg-[#f7f8fc] cursor-pointer"
              >
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-[#111] block truncate">{l.name}</span>
                  <span className="text-[11px] text-[#9aa0ab]">{l.origin} · Score {l.score}</span>
                </div>
                <Badge tone={statusTone(l.status)}>{l.status}</Badge>
              </motion.div>
            ))}
            {topLeads.length === 0 && <p className="text-[13px] text-[#9aa0ab] py-8 text-center">Sin leads todavía</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
