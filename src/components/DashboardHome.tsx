import React from "react";
import { motion } from "motion/react";
import {
  Users, TrendingUp, DollarSign, Flame, ArrowUpRight, ArrowRight,
  Sparkles, MessageSquare, Calendar as CalendarIcon,
  UserPlus, Megaphone, Send, BarChart3,
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
    { label: "Prospectos", value: totalLeads.toLocaleString("es-AR"), icon: <Users size={15} />, delta: `+${newToday.length} hoy` },
    { label: "Ventas", value: `$${(totalSales / 1000).toFixed(totalSales >= 1000 ? 0 : 1)}k`, icon: <DollarSign size={15} />, delta: `${closed} cerradas` },
    { label: "Conversión", value: `${convRate}%`, icon: <TrendingUp size={15} />, delta: "últ. 30 días" },
    { label: "Leads calientes", value: `${hotLeads.length}`, icon: <Flame size={15} />, delta: "activos ahora" },
  ];

  const statusTone = (s: CRMLead["status"]) =>
    s === "Cerrado" ? "success" : s === "Presupuestado" ? "brand" : s === "Contactado" ? "warning" : "neutral";

  // Sales funnel by status (monochrome ink scale)
  const funnelStages: { label: string; status: CRMLead["status"] }[] = [
    { label: "Nuevos", status: "Nuevo" },
    { label: "Contactados", status: "Contactado" },
    { label: "Presupuestados", status: "Presupuestado" },
    { label: "Cerrados", status: "Cerrado" },
  ];
  const funnel = funnelStages.map((s, i) => ({
    ...s,
    count: leads.filter((l) => l.status === s.status).length,
    shade: ["rgba(10,10,10,0.85)", "rgba(10,10,10,0.62)", "rgba(10,10,10,0.4)", "#4f46e5"][i],
  }));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  // Mini calendar
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-10 max-w-[1240px]">
      {/* Metric row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <StatCard
            key={s.label} index={i} icon={s.icon} label={s.label} value={s.value}
            hint={<span className="text-[12px] text-[#a1a1aa]">{s.delta}</span>}
          />
        ))}
      </div>

      {/* Opportunities + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Opportunities table (2 cols) */}
        <Card className="lg:col-span-2 p-6">
          <SectionTitle
            title="Oportunidades"
            subtitle="Leads con mayor score, listos para cerrar"
            action={<button onClick={() => onNavigate("crm")} className="text-[13px] font-medium text-[#4f46e5] hover:text-[#4338ca] transition-colors flex items-center gap-1">Ver todas <ArrowRight size={13} /></button>}
          />
          <div className="-mx-2">
            {topLeads.map((l, i) => {
              const amount = l.totalSpent && l.totalSpent > 0 ? l.totalSpent : Math.round(l.score * 1500);
              return (
                <motion.div
                  key={l.id}
                  onClick={() => onNavigate("crm")}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="group flex items-center gap-4 px-2 py-3 rounded-[10px] hover:bg-black/[0.025] cursor-pointer border-b border-black/[0.05] last:border-0"
                >
                  <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-[#0a0a0a] truncate">{l.name}</p>
                    <p className="text-[12px] text-[#a1a1aa] truncate">{l.notes || `${l.origin} · ${l.status}`}</p>
                  </div>
                  {/* score bar */}
                  <div className="hidden sm:flex items-center gap-2 w-24 shrink-0">
                    <div className="flex-1 h-1 rounded-full bg-black/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-[#0a0a0a]" style={{ width: `${l.score}%` }} />
                    </div>
                    <span className="text-[11px] text-[#71717a] tabular-nums w-6 text-right">{l.score}</span>
                  </div>
                  <div className="text-right w-24 shrink-0">
                    <p className="text-[13.5px] font-semibold text-[#0a0a0a] tabular-nums">${amount.toLocaleString("es-AR")}</p>
                    <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                  </div>
                  <ArrowUpRight size={15} className="text-[#d4d4d8] group-hover:text-[#0a0a0a] transition-colors shrink-0" />
                </motion.div>
              );
            })}
            {topLeads.length === 0 && <p className="text-[13px] text-[#a1a1aa] py-10 text-center">Sin leads todavía</p>}
          </div>
        </Card>

        {/* Activity chart */}
        <Card className="p-6 flex flex-col">
          <SectionTitle title="Actividad" subtitle="Últimos 7 días" />
          <div className="text-[30px] font-semibold tracking-tight text-[#0a0a0a] tabular-nums leading-none">
            {days.reduce((a, d) => a + d.count, 0)}
            <span className="text-[13px] font-normal text-[#a1a1aa] ml-2">interacciones</span>
          </div>
          <div className="flex items-end gap-2.5 flex-1 min-h-[150px] mt-6">
            {days.map((d, i) => {
              const isPeak = i === peakIdx && d.count > 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 relative group">
                  <div className="w-full flex flex-col justify-end" style={{ height: "120px" }}>
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }}
                      transition={{ delay: i * 0.05, type: "spring", stiffness: 220, damping: 24 }}
                      className={isPeak ? "w-full rounded-md bg-[#4f46e5]" : "w-full rounded-md bg-black/[0.07] group-hover:bg-black/[0.12] transition-colors"}
                    />
                  </div>
                  <span className="text-[10.5px] text-[#a1a1aa] font-medium capitalize">{d.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Funnel + right rail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel */}
        <Card className="lg:col-span-2 p-6">
          <SectionTitle title="Embudo de ventas" subtitle="Distribución de leads por etapa" />
          <div className="space-y-4">
            {funnel.map((f, i) => (
              <div key={f.label} className="flex items-center gap-4">
                <span className="w-32 text-[13px] text-[#71717a] shrink-0">{f.label}</span>
                <div className="flex-1 h-7 bg-black/[0.03] rounded-md overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${Math.max(4, (f.count / funnelMax) * 100)}%` }}
                    transition={{ delay: i * 0.07, type: "spring", stiffness: 220, damping: 26 }}
                    className="h-full rounded-md"
                    style={{ background: f.shade }}
                  />
                </div>
                <span className="w-8 text-right text-[13px] font-semibold text-[#0a0a0a] tabular-nums shrink-0">{f.count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Promo / AI card */}
        <motion.div
          whileHover={{ y: -1 }} transition={{ duration: 0.2 }}
          className="relative p-6 rounded-[16px] bg-[#0a0a0a] overflow-hidden flex flex-col justify-between min-h-[200px]"
        >
          <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-[#4f46e5]/20 rounded-full blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/10 text-white/80">Agente IA</span>
            <h3 className="text-[18px] font-semibold text-white leading-snug mt-3 tracking-tight">Vendé 24/7 en todos<br />tus canales</h3>
            <p className="text-[13px] text-white/45 mt-2 leading-relaxed">
              WhatsApp, Instagram, Facebook y Email. Probá cómo responde y cierra ventas solo.
            </p>
          </div>
          <Button variant="secondary" className="relative mt-6 w-full !bg-white !text-[#0a0a0a] hover:!bg-white/90 border-0" onClick={() => onNavigate("playground")}>
            <Sparkles size={14} /> Probar ahora
          </Button>
        </motion.div>
      </div>

      {/* Bottom: recent activity + calendar + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 p-6">
          <SectionTitle title="Actividad reciente" action={<button onClick={() => onNavigate("crm")} className="text-[13px] font-medium text-[#4f46e5] hover:text-[#4338ca] transition-colors">Ver todo</button>} />
          <div className="space-y-4">
            {recent.map((l) => (
              <div key={l.id} className="flex items-center gap-3">
                <img src={l.avatar} referrerPolicy="no-referrer" alt={l.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#71717a] leading-snug truncate">
                    <span className="font-medium text-[#0a0a0a]">{l.name}</span>{" "}
                    {l.status === "Cerrado" ? "cerró una compra" : `escribió por ${l.origin}`}
                  </p>
                  <span className="text-[11px] text-[#a1a1aa]">{timeAgo(l.lastInteraction)}</span>
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="text-center py-8"><MessageSquare size={20} className="text-[#d4d4d8] mx-auto mb-2" /><p className="text-[13px] text-[#a1a1aa]">La actividad aparecerá acá</p></div>
            )}
          </div>
        </Card>

        {/* Calendar */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#0a0a0a] capitalize tracking-tight">{monthLabel}</h3>
            <CalendarIcon size={15} className="text-[#a1a1aa]" />
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <span key={i} className="text-[10px] font-medium text-[#a1a1aa] py-1">{d}</span>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === now.getDate();
              return (
                <span key={day} className={`text-[12px] py-1.5 rounded-md cursor-default transition-colors ${
                  isToday ? "bg-[#0a0a0a] text-white font-semibold" : "text-[#71717a] hover:bg-black/[0.04]"
                }`}>
                  {day}
                </span>
              );
            })}
          </div>
        </Card>

        {/* Quick actions */}
        <Card className="p-6">
          <SectionTitle title="Accesos rápidos" action={<AvatarGroup avatars={topLeads.map((l) => l.avatar)} />} />
          <div className="grid grid-cols-1 gap-2.5">
            <QuickAction icon={<MessageSquare size={16} />} label="Probar el agente IA" onClick={() => onNavigate("playground")} />
            <QuickAction icon={<UserPlus size={16} />} label="Agregar un lead" onClick={() => onNavigate("crm")} />
            <QuickAction icon={<Megaphone size={16} />} label="Lanzar campaña" onClick={() => onNavigate("crm")} />
            <QuickAction icon={<Send size={16} />} label="Crear plantilla" onClick={() => onNavigate("integrations")} />
            <QuickAction icon={<BarChart3 size={16} />} label="Ver métricas" onClick={() => onNavigate("analytics")} />
          </div>
        </Card>
      </div>
    </div>
  );
}
