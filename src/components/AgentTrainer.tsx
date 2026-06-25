import React, { useState, useRef } from "react";
import {
  Sparkles,
  Store,
  MessageSquare,
  Clock,
  ShoppingBag,
  User,
  ShieldAlert,
  Eye,
  EyeOff,
  Sun,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { AgentConfig } from "../types";

// Predefined business presets for instant loading
const BUSINESS_PRESETS = [
  {
    businessName: "Zapas Outlet Argentina",
    businessType: "Zapatillas y Calzado Deportivo",
    tone: "Argentino/Cercano",
    syncStore: "TiendaNube" as const,
    customGreeting: "¡Hola che! Qué bueno que nos contactes. Comentame qué talle y modelo de zapas estás buscando hoy y te digo el stock al toque. 🔥",
    autoFollowUpMinutes: 15,
    catalog: `- Nike Air Max 90: $120.000 (Talles 39 al 44, colores Negro y Blanco. Envíos gratis).
- Adidas Forum Low: $115.000 (Talles 37 al 43, color Blanco puro).
- Puma Suede Classic: $90.000 (Talles 36 al 45, color Azul Marino y Negro).
- Oferta Especial: 15% de descuento adicional pagando en efectivo o transferencia bancaria.`
  },
  {
    businessName: "Kyoto Sushi Express",
    businessType: "Gastronomía y Delivery",
    tone: "Casual/Juvenil",
    syncStore: "WooCommerce" as const,
    customGreeting: "¡Hola, hola! 🍣 ¿Antojo de sushi hoy? Decime qué te tienta o pedime que te recomiende un combo especial para tu noche.",
    autoFollowUpMinutes: 10,
    catalog: `- Combo Kyoto 15 Piezas: $18.500 (Salmón variadito, rolls y niguiris).
- Combo Veggie Zen 15 Piezas: $15.000 (Rolls de palta, pepino, queso crema y mango).
- Hot Rolls fritos (5 unidades): $6.500.
- Delivery gratis en zona de Palermo, Belgrano y Colegiales. Envíos a otros barrios desde $1.500.`
  },
  {
    businessName: "Inmobiliaria del Parque",
    businessType: "Inmuebles y Bienes Raíces",
    tone: "Profesional/Formal",
    syncStore: "Ninguna" as const,
    customGreeting: "Estimado/a, le damos la bienvenida a Inmobiliaria del Parque. ¿Está buscando alquilar, vender o comprar una propiedad? Indíquenos las especificaciones para asesorarle.",
    autoFollowUpMinutes: 30,
    catalog: `- Alquiler Depto 2 Ambientes en Caballito: $450.000/mes + expensas. (Balcón, muy luminoso, se aceptan mascotas).
- Venta Casa en Barrio Cerrado Pilar: U$D 185.000. (4 ambientes, 3 dormitorios, piscina, jardín de 500m2).
- Requisitos alquiler: Garantía propietaria o seguro de caución (Finaer/Premia), mes de depósito y recibo de sueldo de inquilino.`
  },
  {
    businessName: "Bella Estética & Spa",
    businessType: "Salud, Belleza y Bienestar",
    tone: "Argentino/Cercano",
    syncStore: "Shopify" as const,
    customGreeting: "¡Hola linda! ✨ Bienvenida a Bella Estética. ¿Buscabas agendar un turno para depilación, limpieza facial o masajes corporales?",
    autoFollowUpMinutes: 20,
    catalog: `- Limpieza Facial Profunda con Hidratación: $22.000. (Duración 60 min).
- Depilación Definitiva Soprano Ice (Sesión cuerpo entero): $35.000.
- Masaje Relajante Descontracturante con Piedras Calientes: $25.000. (Duración 50 min).
- Turnos: Se agendan de Lunes a Sábados de 9 a 20 hs. Requiere seña de $5.000 para reservar.`
  }
];

interface AgentTrainerProps {
  config: AgentConfig;
  onChange: (newConfig: AgentConfig) => void;
}

export default function AgentTrainer({ config, onChange }: AgentTrainerProps) {
  const [successMsg, setSuccessMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildSystemPromptPreview = (cfg: AgentConfig): string => {
    const lines: string[] = [];
    lines.push(`Sos ${cfg.botPersonaName || "un asistente virtual"}, el agente de ventas IA de "${cfg.businessName || "este negocio"}".`);
    lines.push(`Rubro: ${cfg.businessType || "(sin definir)"}.`);
    lines.push(`Tono de comunicación: ${cfg.tone}.`);
    if (cfg.customGreeting) lines.push(`\nSaludo inicial: "${cfg.customGreeting}"`);
    if (cfg.catalog) lines.push(`\nCatálogo y reglas:\n${cfg.catalog.split("\n").map(l => `  ${l}`).join("\n")}`);
    if (cfg.forbiddenTopics) lines.push(`\nTemas PROHIBIDOS (nunca discutas): ${cfg.forbiddenTopics}`);
    if (cfg.workingHoursStart !== undefined && cfg.workingHoursEnd !== undefined) {
      lines.push(`\nHorario de atención: ${cfg.workingHoursStart}:00 a ${cfg.workingHoursEnd}:00 hs.`);
    }
    lines.push(`\nTenés acceso a herramientas CRM: registrar_lead, actualizar_estado_lead, agendar_seguimiento, generar_link_pago, buscar_producto.`);
    return lines.join("\n");
  };

  // Setup completion checklist
  const checklistItems = [
    { label: "Nombre del negocio", done: !!config.businessName && config.businessName !== "Mi Negocio", weight: 15 },
    { label: "Rubro / Industria", done: !!config.businessType, weight: 10 },
    { label: "Catálogo cargado", done: config.catalog?.trim().length > 30, weight: 30 },
    { label: "Saludo inicial", done: !!config.customGreeting, weight: 15 },
    { label: "Nombre del bot", done: !!config.botPersonaName, weight: 10 },
    { label: "Logo del negocio", done: !!config.logoUrl, weight: 10 },
    { label: "Horario de atención", done: config.workingHoursStart !== undefined, weight: 10 },
  ];
  const completionPct = checklistItems.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);

  const handleFieldChange = (key: keyof AgentConfig, value: any) => {
    setIsSaving(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    onChange({ ...config, [key]: value });
    saveTimerRef.current = setTimeout(() => {
      setIsSaving(false);
      setSuccessMsg("Configuración guardada.");
      setTimeout(() => setSuccessMsg(""), 2000);
    }, 1000);
  };

  const loadPreset = (preset: typeof BUSINESS_PRESETS[0]) => {
    onChange(preset);
    setSuccessMsg(`Preset "${preset.businessName}" cargado y guardado.`);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
      {/* Block title */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Store size={20} />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-lg text-slate-900">Entrenamiento del Agente</h3>
            <p className="text-xs text-slate-500">Instruye a tu IA con las reglas de tu negocio</p>
          </div>
        </div>
        <div className={`flex items-center space-x-1 px-2.5 py-1 border rounded-full text-xs font-semibold transition-all ${
          isSaving
            ? "bg-amber-50 text-amber-700 border-amber-100"
            : "bg-emerald-50 text-emerald-700 border-emerald-100"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isSaving ? "bg-amber-500 animate-bounce" : "bg-emerald-500 animate-pulse"}`}></span>
          {isSaving ? "Guardando…" : "Respondo Engine Active"}
        </div>
      </div>

      {/* Setup Progress Checklist */}
      <div className={`rounded-2xl p-4 space-y-3 border ${completionPct === 100 ? "bg-emerald-50 border-emerald-200" : "bg-blue-50/60 border-blue-200"}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold flex items-center gap-1.5 ${completionPct === 100 ? "text-emerald-700" : "text-blue-800"}`}>
            {completionPct === 100
              ? <><CheckCircle2 size={14} /> Agente listo para producción</>
              : <><Sparkles size={14} /> Progreso de configuración</>
            }
          </span>
          <span className={`text-sm font-black ${completionPct === 100 ? "text-emerald-700" : "text-blue-700"}`}>
            {completionPct}%
          </span>
        </div>
        <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden border border-white/40">
          <div
            className={`h-full rounded-full transition-all duration-500 ${completionPct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {checklistItems.map((item) => (
            <div key={item.label} className={`flex items-center gap-1.5 text-[10px] ${item.done ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
              {item.done
                ? <CheckCircle2 size={10} className="shrink-0" />
                : <Circle size={10} className="shrink-0 opacity-50" />
              }
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Preset Loading Pills */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Cargar Plantillas de Negocio de Ejemplo (Presets LATAM)
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {BUSINESS_PRESETS.map((preset) => (
            <button
              key={preset.businessName}
              onClick={() => loadPreset(preset)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                config.businessName === preset.businessName
                  ? "bg-blue-50/70 border-blue-500 text-blue-700 font-semibold"
                  : "bg-slate-50/60 border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-100/80"
              }`}
            >
              <span className="text-xs font-bold block truncate">{preset.businessName}</span>
              <span className="text-[10px] text-slate-400 truncate block">{preset.businessType}</span>
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-medium text-center animate-pulse">
          {successMsg}
        </div>
      )}

      {/* Trainer Form Fields */}
      <div className="space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Nombre de la Empresa</label>
            <input
              type="text"
              value={config.businessName}
              onChange={(e) => handleFieldChange("businessName", e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="Ej: Tienda de Deportes S.A."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Rubro o Industria</label>
            <input
              type="text"
              value={config.businessType}
              onChange={(e) => handleFieldChange("businessType", e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="Ej: Indumentaria Masculina"
            />
          </div>
        </div>

        {/* Logo URL */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-medium text-slate-500">Logo del Negocio (URL)</label>
            {config.logoUrl && (
              <img src={config.logoUrl} alt="Logo preview" className="w-6 h-6 rounded object-cover border border-slate-200" onError={(e) => (e.currentTarget.style.display = "none")} />
            )}
          </div>
          <input
            type="url"
            value={config.logoUrl || ""}
            onChange={(e) => handleFieldChange("logoUrl", e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            placeholder="https://mi-tienda.com/logo.png"
          />
        </div>

        {/* Row 2: Tone & Store Sync */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Tono de Comunicación</label>
            <select
              value={config.tone}
              onChange={(e) => handleFieldChange("tone", e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            >
              <option value="Argentino/Cercano">Argentino/Cercano (vos, che, re cálido)</option>
              <option value="Profesional/Formal">Profesional/Formal (usted, neutro)</option>
              <option value="Casual/Juvenil">Casual/Juvenil (tú/vos, emojis, relajado)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 flex items-center">
              Sincronizar Stock & Tienda
            </label>
            <select
              value={config.syncStore}
              onChange={(e) => handleFieldChange("syncStore", e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            >
              <option value="Ninguna">Ninguna (Carga Manual)</option>
              <option value="TiendaNube">TiendaNube (Sincronización Aut.)</option>
              <option value="Shopify">Shopify (Sincronización Aut.)</option>
              <option value="WooCommerce">WooCommerce (Sincronización Aut.)</option>
              <option value="MercadoLibre">Mercado Libre (Sincronización Aut.)</option>
            </select>
          </div>
        </div>

        {/* Row 3: Auto follow up & custom greetings */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-xs font-medium text-slate-500 flex items-center">
              <MessageSquare size={13} className="mr-1 text-blue-600" /> Mensaje de Bienvenida Inicial
            </label>
            <span className="text-[10px] text-slate-400">Se envía ante el saludo del cliente</span>
          </div>
          <textarea
            value={config.customGreeting || ""}
            onChange={(e) => handleFieldChange("customGreeting", e.target.value)}
            rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
            placeholder="Escribe el mensaje con el que el bot recibirá a tus clientes..."
          />
        </div>

        {/* Catalog and Knowledge Database */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-medium text-slate-500 flex items-center">
              <ShoppingBag size={13} className="mr-1 text-blue-600" /> Catálogo de Productos y Reglas de Negocio
            </label>
            <span className="text-[10px] text-slate-400">El núcleo de respuestas del bot</span>
          </div>
          <textarea
            value={config.catalog}
            onChange={(e) => handleFieldChange("catalog", e.target.value)}
            rows={7}
            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-y leading-relaxed"
            placeholder="Define aquí tus productos, precios, stock, políticas de envío, métodos de pago aceptados y cualquier otra regla relevante."
          />
        </div>

        {/* Auto Follow-up Settings */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Clock size={16} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Seguimientos Automáticos de Conversación</span>
              <p className="text-[10px] text-slate-500 max-w-xs">Si el cliente consulta y no vuelve a responder, Respondo le recontactará sutilmente.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={config.autoFollowUpMinutes}
              onChange={(e) => handleFieldChange("autoFollowUpMinutes", Number(e.target.value))}
              className="w-16 bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-center text-slate-800 font-bold focus:outline-none focus:border-blue-500"
              min={1}
            />
            <span className="text-xs text-slate-500">minutos</span>
          </div>
        </div>

        {/* Bot Persona Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <User size={12} className="text-blue-600" /> Nombre del Agente IA
            </label>
            <input
              type="text"
              value={config.botPersonaName || ""}
              onChange={(e) => handleFieldChange("botPersonaName", e.target.value)}
              placeholder="Ej: Valentina, Matías, Sofía…"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            <p className="text-[9px] text-slate-400">Humaniza el chatbot. El cliente ve este nombre en las respuestas.</p>
          </div>

          {/* Working Hours */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <Sun size={12} className="text-amber-500" /> Horario de Atención
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.workingHoursStart ?? ""}
                onChange={(e) => handleFieldChange("workingHoursStart", e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="0"
                min={0}
                max={23}
                className="w-16 bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-center text-slate-800 font-bold focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-400">a</span>
              <input
                type="number"
                value={config.workingHoursEnd ?? ""}
                onChange={(e) => handleFieldChange("workingHoursEnd", e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="23"
                min={0}
                max={23}
                className="w-16 bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-center text-slate-800 font-bold focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-400">hs</span>
            </div>
            <p className="text-[9px] text-slate-400 leading-tight">Dejá vacío para 24/7. Fuera de horario, el bot avisa al cliente.</p>
          </div>
        </div>

        {/* Forbidden Topics */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <ShieldAlert size={12} className="text-red-500" /> Temas Prohibidos (restricciones del bot)
          </label>
          <input
            type="text"
            value={config.forbiddenTopics || ""}
            onChange={(e) => handleFieldChange("forbiddenTopics", e.target.value)}
            placeholder="Ej: política, competencia, precios de la competencia, devoluciones…"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          <p className="text-[9px] text-slate-400">Separados por comas. El agente IA se negará a discutir estos temas.</p>
        </div>

        {/* System Prompt Preview */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPromptPreview((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <Sparkles size={13} className="text-blue-600" />
              Vista Previa del Prompt del Sistema (lo que recibe la IA)
            </span>
            {showPromptPreview ? <EyeOff size={13} className="text-slate-400" /> : <Eye size={13} className="text-slate-400" />}
          </button>
          {showPromptPreview && (
            <div className="bg-slate-900 text-emerald-300 text-[10px] font-mono p-4 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border-t border-slate-200">
              {buildSystemPromptPreview(config)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
