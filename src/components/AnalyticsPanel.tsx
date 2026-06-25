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
      color: "from-blue-500 to-indigo-500",
      icon: <Users className="text-blue-600" size={20} />
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
      
      {/* Real Live Agent Operational Status Card */}
      <div className="relative bg-gradient-to-r from-slate-50 via-white to-blue-50/40 border border-slate-200 rounded-3xl p-6 overflow-hidden shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Abstract background light */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        <div className="flex items-center space-x-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 p-0.5 shadow-sm flex items-center justify-center shrink-0">
            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
              <Zap className="text-blue-600" size={28} />
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-blue-600 block mb-0.5">
              Estado de tu Agente en Vivo
            </span>
            <h4 className="font-sans font-bold text-lg md:text-xl text-slate-900">
              {config.businessName || "Respondo AI"} — Operando de forma autónoma
            </h4>
            <p className="text-xs text-slate-600 max-w-xl leading-relaxed mt-1">
              Tu agente de inteligencia artificial está entrenado como un experto en <strong className="text-blue-600 font-semibold">{config.businessType}</strong> usando el tono <strong className="text-slate-700 font-semibold">{config.tone}</strong>. Resuelve dudas del catálogo en milisegundos y deriva automáticamente las consultas complejas al CRM.
            </p>
          </div>
        </div>

        <div className="shrink-0 relative z-10 bg-white border border-slate-200 px-4 py-3 rounded-2xl text-center shadow-sm min-w-[150px]">
          <span className="text-[10px] text-slate-500 block font-semibold uppercase tracking-wider">Tienda</span>
          <span className="font-sans text-lg font-black text-blue-600 block my-0.5">
            {config.syncStore || "Nativa"}
          </span>
          <span className="text-[9px] text-slate-400 block">Sincronización Activa</span>
        </div>
      </div>

      {/* Grid of KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((m, index) => (
          <div
            key={index}
            className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between shadow-sm"
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-slate-500">{m.title}</span>
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg shrink-0">
                {m.icon}
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="font-sans font-black text-2xl text-slate-900 tracking-tight">
                {m.value}
              </h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                {m.sub}
              </span>
              <p className="text-[10px] text-slate-500 leading-normal pt-1 border-t border-slate-100 mt-2">
                {m.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic SVG Graph Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Interactive Growth Lines */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="font-sans font-semibold text-sm text-slate-800">Progreso de Ventas Concretadas</h4>
              <p className="text-xs text-slate-500">Volumen mensual acumulado de ventas cobradas directamente en tu CRM</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                <span className="text-slate-600 font-medium">Facturación (ARS)</span>
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
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-sans font-semibold text-sm text-slate-800">Actividad del Agente</h4>
            <p className="text-xs text-slate-500 mb-6">Métricas reales de conversaciones procesadas por la IA</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1"><MessageCircle size={12} className="text-blue-600" /> Conversaciones Atendidas</span>
                <span className="text-blue-600 font-mono font-bold">{totalConversations}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, totalLeads ? (totalConversations / totalLeads) * 100 : 0)}%` }}
                  className="h-full bg-blue-500 rounded-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-700">Mensajes Procesados</span>
                <span className="text-indigo-600 font-mono font-bold">{totalInteractions}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, (totalInteractions / 100) * 100)}%` }}
                  className="h-full bg-indigo-500 rounded-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-700">Campañas de Difusión</span>
                <span className="text-emerald-600 font-mono font-bold">{totalCampaigns}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, (totalCampaigns / 5) * 100)}%` }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
            <span className="font-semibold text-slate-800 block mb-1">💡 Datos 100% reales</span>
            Todas las métricas provienen de la base de datos (Supabase). El gráfico de ventas se llena a medida que el agente cierra ventas reales.
          </div>
        </div>

      </div>
    </div>
  );
}
