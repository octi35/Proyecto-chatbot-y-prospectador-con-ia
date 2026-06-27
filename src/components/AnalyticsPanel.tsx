import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  TrendingUp,
  Clock,
  ShoppingBag,
  Users,
  Sparkles,
  ShieldCheck,
  Zap,
  Award,
  MessageCircle
} from "lucide-react";
import { CRMLead, Campaign, AgentConfig } from "../types";
import { getAnalytics, AnalyticsData } from "../lib/api";

interface AnalyticsPanelProps {
  leads: CRMLead[];
  campaigns: Campaign[];
  config: AgentConfig;
}

export default function AnalyticsPanel({ leads, campaigns, config }: AnalyticsPanelProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Load real aggregated analytics from the database
  useEffect(() => {
    getAnalytics().then(setAnalytics).catch(() => setAnalytics(null));
  }, [leads]);

  // Dynamic calculations from the actual live CRM state
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === "Nuevo").length;
  const contactedLeads = leads.filter(l => l.status === "Contactado").length;
  const budgetedLeads = leads.filter(l => l.status === "Presupuestado").length;
  const closedLeads = leads.filter(l => l.status === "Cerrado").length;
  const totalSalesAmount = leads.reduce((acc, l) => acc + (l.totalSpent || 0), 0);
  const conversionRate = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : "0.0";

  // Average Lead Score
  const avgLeadScore = totalLeads > 0
    ? Math.round(leads.reduce((acc, l) => acc + l.score, 0) / totalLeads)
    : 0;

  // Funnel conversion rates between each stage
  const funnelRates = {
    toContactado: newLeads + contactedLeads > 0 ? Math.round((contactedLeads / (newLeads + contactedLeads)) * 100) : 0,
    toPresupuestado: contactedLeads + budgetedLeads > 0 ? Math.round((budgetedLeads / (contactedLeads + budgetedLeads)) * 100) : 0,
    toCerrado: budgetedLeads + closedLeads > 0 ? Math.round((closedLeads / (budgetedLeads + closedLeads)) * 100) : 0,
  };

  // Active campaign count
  const totalCampaigns = campaigns.length;

  // Real monthly sales from DB (last 6 months); empty until real sales close
  const chartData = analytics?.monthlySales?.length
    ? analytics.monthlySales
    : [
        { month: "Ene", sales: 0 }, { month: "Feb", sales: 0 }, { month: "Mar", sales: 0 },
        { month: "Abr", sales: 0 }, { month: "May", sales: 0 }, { month: "Jun", sales: 0 },
      ];

  const totalConversations = analytics?.totalConversations ?? leads.filter(l => l.conversationHistory.length > 0).length;
  const totalInteractions = analytics?.totalMessages ?? 0;
  const channelCounts = analytics?.channelCounts ?? {};
  const channelValues: number[] = Object.values(channelCounts) as number[];
  const totalChannelLeads: number = channelValues.reduce((a, b) => a + b, 0) || 1;

  // 7-day leads sparkline data
  const leadsPerDay = analytics?.leadsPerDay ?? [];
  const maxDayLeads = Math.max(1, ...leadsPerDay.map((d) => d.count));

  // Leads by category breakdown
  const categoryCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const cat = l.category?.trim() || "Sin categoría";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const categoryEntries = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxCategoryCount = Math.max(1, ...categoryEntries.map(([, c]) => c));
  const CATEGORY_COLORS = ["bg-indigo-500","bg-purple-500","bg-emerald-500","bg-amber-500","bg-pink-500","bg-indigo-500","bg-rose-500","bg-teal-500"];

  // Hourly activity heatmap derived from lead lastInteraction timestamps
  const hourCounts = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: leads.filter((l) => new Date(l.lastInteraction).getHours() === h).length,
  }));
  const maxHourCount = Math.max(1, ...hourCounts.map((h) => h.count));

  // Average AI response time (seconds) from conversation history pairs
  const responseTimes: number[] = [];
  leads.forEach((lead) => {
    const hist = lead.conversationHistory;
    for (let i = 0; i < hist.length - 1; i++) {
      if (hist[i].role === "user" && hist[i + 1].role === "model" && hist[i].timestamp && hist[i + 1].timestamp) {
        const delta = (new Date(hist[i + 1].timestamp).getTime() - new Date(hist[i].timestamp).getTime()) / 1000;
        if (delta > 0 && delta < 300) responseTimes.push(delta);
      }
    }
  });
  const avgResponseTimeSec = responseTimes.length
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null;

  // Dynamic scaling for the SVG vector line chart to support any dynamic CRM values
  const maxVal = Math.max(...chartData.map(d => d.sales)) || 1;
  const points = chartData.map((data, index) => {
    const xPos = 40 + (index * 108);
    const yPos = 210 - (data.sales / maxVal) * 180;
    return { x: xPos, y: yPos };
  });

  const linePath = `M ${points.map(p => `${p.x} ${p.y}`).join(" L ")}`;
  const areaPath = `M 40 210 L ${points.map(p => `${p.x} ${p.y}`).join(" L ")} L 580 210 Z`;

  // Real KPI Cards mapped from live props state
  const METRICS = [
    {
      title: "Prospectos en Embudo",
      value: `${totalLeads} Leads`,
      sub: "Registrados en vivo",
      desc: `Nuevos: ${newLeads} | Contactados: ${contactedLeads} | Presupuestados: ${budgetedLeads}`,
      color: "from-indigo-500 to-indigo-500",
      icon: <Users className="text-indigo-600" size={20} />
    },
    {
      title: "Calificación Promedio",
      value: `${avgLeadScore}%`,
      sub: "Interés de Compra",
      desc: "Puntaje estimado por el modelo de IA basado en los mensajes del cliente.",
      color: "from-purple-500 to-indigo-500",
      icon: <TrendingUp className="text-purple-600" size={20} />
    },
    {
      title: "Facturación Concretada",
      value: `$${totalSalesAmount.toLocaleString("es-AR")} ARS`,
      sub: `${closedLeads} cierres de venta`,
      desc: "Ventas finalizadas y cobradas en el panel de control del CRM.",
      color: "from-emerald-500 to-teal-500",
      icon: <ShoppingBag className="text-emerald-650" size={20} />
    },
    {
      title: "Tasa de Conversión",
      value: `${conversionRate}%`,
      sub: "Eficiencia de Cierre",
      desc: "Porcentaje de prospectos iniciales que concretaron su compra.",
      color: "from-amber-500 to-orange-500",
      icon: <Clock className="text-amber-600" size={20} />
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Live Agent Status Card — minimalist */}
      <div className="bg-white border border-zinc-100 rounded-[24px] p-6 shadow-apple-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-apple-sm">
            <Zap className="text-white" size={24} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold tracking-wide text-indigo-600 block mb-0.5">
              Agente en vivo
            </span>
            <h4 className="font-semibold text-[17px] tracking-tight text-zinc-900">
              {config.businessName || "Respondo AI"} — operando solo
            </h4>
            <p className="text-[12.5px] text-zinc-500 max-w-xl leading-relaxed mt-1">
              Entrenado como experto en <strong className="text-zinc-900 font-semibold">{config.businessType || "tu rubro"}</strong> con tono <strong className="text-zinc-900 font-semibold">{config.tone}</strong>. Responde en milisegundos y deriva al CRM.
            </p>
          </div>
        </div>

        <div className="shrink-0 bg-zinc-50 border border-zinc-100 px-5 py-3 rounded-2xl text-center min-w-[140px]">
          <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wide">Tienda</span>
          <span className="text-[17px] font-bold text-indigo-600 block my-0.5 tracking-tight">
            {config.syncStore || "Nativa"}
          </span>
          <span className="text-[9px] text-zinc-400 block">Sincronización activa</span>
        </div>
      </div>

      {/* Grid of KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((m, index) => (
          <div
            key={index}
            className="bg-white border border-zinc-100 rounded-[20px] p-5 hover:shadow-apple transition-all flex flex-col justify-between shadow-apple-sm"
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-zinc-400">{m.title}</span>
              <div className="p-2 bg-zinc-50 rounded-xl shrink-0">
                {m.icon}
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="font-sans font-black text-2xl text-zinc-900 tracking-tight">
                {m.value}
              </h4>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">
                {m.sub}
              </span>
              <p className="text-[10px] text-zinc-500 leading-normal pt-1 border-t border-zinc-100 mt-2">
                {m.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline health mini-chart */}
      {totalLeads > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-sans font-semibold text-sm text-zinc-800">Salud del Embudo de Ventas</h4>
              <p className="text-xs text-zinc-500">Distribución de {totalLeads} leads por etapa del pipeline</p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-600">{conversionRate}% conv.</span>
          </div>
          <div className="flex gap-2 items-end h-16">
            {(["Nuevo","Contactado","Presupuestado","Cerrado"] as const).map((status) => {
              const count = leads.filter((l) => l.status === status).length;
              const pct = Math.round((count / totalLeads) * 100);
              const colors: Record<string, string> = {
                Nuevo: "bg-sky-400", Contactado: "bg-amber-400",
                Presupuestado: "bg-purple-500", Cerrado: "bg-emerald-500",
              };
              return (
                <div key={status} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-mono text-zinc-500">{count}</span>
                  <div className="w-full flex flex-col justify-end" style={{ height: "48px" }}>
                    <div
                      className={`w-full rounded-t-lg transition-all ${colors[status]}`}
                      style={{ height: `${Math.max(4, pct)}%`, minHeight: count > 0 ? "8px" : "0" }}
                    />
                  </div>
                  <span className="text-[8px] text-zinc-500 text-center leading-tight font-semibold">{status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Funnel conversion rates */}
      {totalLeads > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-sans font-semibold text-sm text-zinc-800">Tasas de Conversión por Etapa</h4>
              <p className="text-xs text-zinc-500">% de leads que avanzan entre cada etapa del embudo</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[
              { label: "Nuevo", count: newLeads, color: "bg-sky-400 text-sky-700" },
              { label: "→ Contactado", rate: funnelRates.toContactado, color: "text-zinc-400" },
              { label: "Contactado", count: contactedLeads, color: "bg-amber-400 text-amber-700" },
              { label: "→ Presupuestado", rate: funnelRates.toPresupuestado, color: "text-zinc-400" },
              { label: "Presupuestado", count: budgetedLeads, color: "bg-purple-500 text-purple-700" },
              { label: "→ Cerrado", rate: funnelRates.toCerrado, color: "text-zinc-400" },
              { label: "Cerrado", count: closedLeads, color: "bg-emerald-500 text-emerald-700" },
            ].map((item, i) =>
              "rate" in item ? (
                <div key={i} className="flex flex-col items-center flex-1 min-w-0">
                  <span className={`text-[10px] font-bold font-mono ${item.rate >= 50 ? "text-emerald-600" : item.rate >= 25 ? "text-amber-600" : "text-red-500"}`}>
                    {item.rate}%
                  </span>
                  <div className="w-full h-0.5 bg-zinc-200 relative">
                    <div className="absolute top-0 right-0 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-zinc-300" />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                  <span className={`text-sm font-black ${item.color.split(" ")[1]}`}>{item.count}</span>
                  <div className={`w-14 h-6 rounded-lg ${item.color.split(" ")[0]} flex items-center justify-center`}>
                    <span className="text-white text-[9px] font-bold">{item.label}</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* 7-day leads sparkline */}
      {leadsPerDay.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-sans font-semibold text-sm text-zinc-800">Leads Captados — Últimos 7 Días</h4>
              <p className="text-xs text-zinc-500">Nuevos prospectos registrados por día en el CRM</p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-600">
              {leadsPerDay.reduce((a, d) => a + d.count, 0)} leads
            </span>
          </div>
          <div className="flex gap-1.5 items-end h-16">
            {leadsPerDay.map((day) => {
              const pct = maxDayLeads > 0 ? Math.round((day.count / maxDayLeads) * 100) : 0;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[9px] font-mono text-zinc-400 group-hover:text-indigo-600 transition-colors">
                    {day.count > 0 ? day.count : ""}
                  </span>
                  <div className="w-full flex flex-col justify-end" style={{ height: "44px" }}>
                    <div
                      className="w-full rounded-t-md bg-indigo-500 group-hover:bg-indigo-600 transition-all"
                      style={{ height: `${Math.max(day.count > 0 ? 12 : 3, pct)}%`, opacity: day.count === 0 ? 0.2 : 1 }}
                    />
                  </div>
                  <span className="text-[8px] font-semibold text-zinc-400">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hourly activity heatmap */}
      {leads.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-sans font-semibold text-sm text-zinc-800">Actividad por Hora del Día</h4>
              <p className="text-xs text-zinc-500">Cuándo tus clientes están más activos (basado en última interacción)</p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-600">
              {leads.length} interacciones
            </span>
          </div>
          <div className="flex gap-0.5 items-end h-12">
            {hourCounts.map(({ hour, count }) => {
              const intensity = count / maxHourCount;
              const isNight = hour < 7 || hour >= 22;
              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                  <div
                    className={`w-full rounded-sm transition-all ${count === 0 ? "bg-zinc-100" : isNight ? "bg-indigo-300" : "bg-indigo-500"}`}
                    style={{ height: `${Math.max(4, intensity * 36)}px`, opacity: count === 0 ? 0.4 : 0.5 + intensity * 0.5 }}
                    title={`${hour}:00 — ${count} lead${count !== 1 ? "s" : ""}`}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                    {hour}h: {count}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 px-0.5">
            <span className="text-[8px] text-zinc-400 font-mono">0h</span>
            <span className="text-[8px] text-zinc-400 font-mono">6h</span>
            <span className="text-[8px] text-zinc-400 font-mono">12h</span>
            <span className="text-[8px] text-zinc-400 font-mono">18h</span>
            <span className="text-[8px] text-zinc-400 font-mono">23h</span>
          </div>
          {maxHourCount > 0 && (
            <p className="text-[9px] text-zinc-400 mt-1.5 text-center">
              Pico: {hourCounts.find(h => h.count === maxHourCount)?.hour}:00 hs
              ({maxHourCount} lead{maxHourCount !== 1 ? "s" : ""})
            </p>
          )}
        </div>
      )}

      {/* Leads by category */}
      {categoryEntries.length > 1 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-sans font-semibold text-sm text-zinc-800">Distribución por Categoría / Interés</h4>
              <p className="text-xs text-zinc-500">Qué productos o servicios generan más consultas</p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-600">{categoryEntries.length} categorías</span>
          </div>
          <div className="space-y-2">
            {categoryEntries.map(([cat, count], i) => {
              const pct = Math.round((count / totalLeads) * 100);
              return (
                <div key={cat} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="font-semibold text-zinc-700 truncate max-w-[60%]">{cat}</span>
                    <span className="font-mono text-zinc-500">{count} lead{count !== 1 ? "s" : ""} · {pct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                      style={{ width: `${Math.max(4, (count / maxCategoryCount) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic SVG Graph Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Interactive Growth Lines */}
        <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="font-sans font-semibold text-sm text-zinc-800">Progreso de Ventas Concretadas</h4>
              <p className="text-xs text-zinc-500">Volumen mensual acumulado de ventas cobradas directamente en tu CRM</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                <span className="text-zinc-600 font-medium">Facturación (ARS)</span>
              </span>
            </div>
          </div>

          {/* SVG Vector Line Chart */}
          <div className="relative h-64 w-full">
            <svg viewBox="0 0 600 240" className="w-full h-full overflow-visible">
              {/* Grid Lines */}
              <line x1="40" y1="30" x2="580" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="80" x2="580" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="130" x2="580" y2="130" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="180" x2="580" y2="180" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="40" y1="210" x2="580" y2="210" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* X Axis Labels */}
              {chartData.map((data, index) => {
                const xPos = 40 + (index * 108);
                return (
                  <text
                    key={index}
                    x={xPos}
                    y="230"
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="middle"
                    className="font-mono font-semibold"
                  >
                    {data.month}
                  </text>
                );
              })}

              {/* Y Axis Labels */}
              <text x="15" y="34" fill="#94a3b8" fontSize="9" textAnchor="start" className="font-mono">{(maxVal / 1000).toFixed(0)}k</text>
              <text x="15" y="84" fill="#94a3b8" fontSize="9" textAnchor="start" className="font-mono">{((maxVal * 0.66) / 1000).toFixed(0)}k</text>
              <text x="15" y="134" fill="#94a3b8" fontSize="9" textAnchor="start" className="font-mono">{((maxVal * 0.33) / 1000).toFixed(0)}k</text>
              <text x="15" y="184" fill="#94a3b8" fontSize="9" textAnchor="start" className="font-mono">0k</text>

              {/* Glistening Area Gradient */}
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* SVG Area */}
              <path
                d={areaPath}
                fill="url(#areaGrad)"
              />

              {/* SVG Line path */}
              <path
                d={linePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Points circles and hover anchors */}
              {chartData.map((data, index) => {
                const xPos = points[index].x;
                const yPos = points[index].y;
                const isHovered = hoveredIndex === index;

                return (
                  <g key={index} className="cursor-pointer">
                    <circle
                      cx={xPos}
                      cy={yPos}
                      r={isHovered ? "7" : "4.5"}
                      fill="#1e40af"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      className="transition-all duration-200"
                    />
                    
                    {/* Hover invisible tracking block */}
                    <rect
                      x={xPos - 30}
                      y="10"
                      width="60"
                      height="200"
                      fill="transparent"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />

                    {/* Dynamic Tooltip on SVG node */}
                    {isHovered && (
                      <g>
                        <rect
                          x={xPos - 60}
                          y={yPos - 38}
                          width="120"
                          height="28"
                          rx="6"
                          fill="#0f172a"
                          stroke="#1e293b"
                          strokeWidth="1"
                        />
                        <text
                          x={xPos}
                          y={yPos - 20}
                          fill="#fff"
                          fontSize="9"
                          textAnchor="middle"
                          className="font-mono font-bold"
                        >
                          ${data.sales.toLocaleString()} ARS
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Actividad real del agente */}
        <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-sans font-semibold text-sm text-zinc-800">Actividad del Agente</h4>
            <p className="text-xs text-zinc-500 mb-6">Métricas reales de conversaciones procesadas por la IA</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-zinc-700 flex items-center gap-1"><MessageCircle size={12} className="text-indigo-600" /> Conversaciones Atendidas</span>
                <span className="text-indigo-600 font-mono font-bold">{totalConversations}</span>
              </div>
              <div className="w-full h-2 bg-zinc-100 border border-zinc-200 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, totalLeads ? (totalConversations / totalLeads) * 100 : 0)}%` }}
                  className="h-full bg-indigo-500 rounded-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-zinc-700">Mensajes Procesados</span>
                <span className="text-indigo-600 font-mono font-bold">{totalInteractions}</span>
              </div>
              <div className="w-full h-2 bg-zinc-100 border border-zinc-200 rounded-full overflow-hidden">
                <div
                  style={{ width: totalInteractions > 0 ? `${Math.min(100, (totalInteractions / Math.max(totalInteractions, 200)) * 100)}%` : "0%" }}
                  className="h-full bg-indigo-500 rounded-full transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-zinc-700">Campañas de Difusión</span>
                <span className="text-emerald-600 font-mono font-bold">{totalCampaigns}</span>
              </div>
              <div className="w-full h-2 bg-zinc-100 border border-zinc-200 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, (totalCampaigns / Math.max(totalCampaigns, 5)) * 100)}%` }}
                  className="h-full bg-emerald-500 rounded-full transition-all"
                />
              </div>
            </div>

            {/* Avg response time */}
            {avgResponseTimeSec !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-zinc-700 flex items-center gap-1"><Clock size={12} className="text-amber-500" /> Tiempo Prom. de Respuesta</span>
                  <span className="text-amber-600 font-mono font-bold">
                    {avgResponseTimeSec < 60 ? `${avgResponseTimeSec}s` : `${Math.round(avgResponseTimeSec / 60)}m`}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-100 border border-zinc-200 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, 100 - (avgResponseTimeSec / 30) * 10)}%` }}
                    className="h-full bg-amber-400 rounded-full"
                  />
                </div>
                <p className="text-[8px] text-zinc-400">Tiempo medido entre mensaje del cliente y respuesta del bot</p>
              </div>
            )}

            {/* Channel Breakdown */}
            {Object.keys(channelCounts).length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Leads por Canal</span>
                {(["WhatsApp","Instagram","Facebook","Email"] as const).map((ch) => {
                  const count: number = (channelCounts[ch] as number | undefined) ?? 0;
                  const pct: number = Math.round((count / totalChannelLeads) * 100);
                  return count > 0 ? (
                    <div key={ch} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-semibold text-zinc-600">{ch}</span>
                        <span className="font-mono text-zinc-500">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all ${ch === "WhatsApp" ? "bg-emerald-500" : ch === "Instagram" ? "bg-pink-500" : ch === "Email" ? "bg-zinc-500" : "bg-indigo-500"}`}
                        />
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 text-xs text-zinc-500 leading-relaxed bg-zinc-50 p-3 rounded-2xl border border-zinc-200/50">
            <span className="font-semibold text-zinc-800 block mb-1">💡 Datos 100% reales</span>
            Todas las métricas provienen de la base de datos (Supabase). El gráfico de ventas se llena a medida que el agente cierra ventas reales.
          </div>
        </div>

      </div>
    </div>
  );
}
