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
  Plus,
  X,
} from "lucide-react";
import { AgentConfig } from "../types";
import CatalogEditor from "./CatalogEditor";

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
  const [quickReplyInput, setQuickReplyInput] = useState("");
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
    <div className="bg-white border border-zinc-100 rounded-[28px] p-6 shadow-apple space-y-6">
      {/* Block title */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-apple-sm">
            <Store size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[19px] tracking-tight text-zinc-900">Entrenamiento del Agente</h3>
            <p className="text-[13px] text-zinc-500">Instruí a tu IA con las reglas de tu negocio</p>
          </div>
        </div>
        <div className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
          isSaving ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isSaving ? "bg-amber-500 animate-bounce" : "bg-emerald-500 animate-pulse"}`}></span>
          {isSaving ? "Guardando…" : "Activo"}
        </div>
      </div>

      {/* Setup Progress Checklist */}
      <div className={`rounded-2xl p-4 space-y-3 border ${completionPct === 100 ? "bg-emerald-50 border-emerald-200" : "bg-indigo-50 border-indigo-100"}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold flex items-center gap-1.5 ${completionPct === 100 ? "text-emerald-700" : "text-indigo-700"}`}>
            {completionPct === 100
              ? <><CheckCircle2 size={14} /> Agente listo para producción</>
              : <><Sparkles size={14} /> Progreso de configuración</>
            }
          </span>
          <span className={`text-sm font-black ${completionPct === 100 ? "text-emerald-700" : "text-indigo-700"}`}>
            {completionPct}%
          </span>
        </div>
        <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden border border-white/40">
          <div
            className={`h-full rounded-full transition-all duration-500 ${completionPct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {checklistItems.map((item) => (
            <div key={item.label} className={`flex items-center gap-1.5 text-[10px] ${item.done ? "text-emerald-700 font-semibold" : "text-zinc-500"}`}>
              {item.done
                ? <CheckCircle2 size={10} className="shrink-0" />
                : <Circle size={10} className="shrink-0 opacity-50" />
              }
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Strict mode — bot answers ONLY from its configured info */}
      <div className={`rounded-2xl p-4 border transition-all ${config.strictMode ? "bg-indigo-600/5 border-indigo-600/30" : "bg-zinc-50 border-zinc-100"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={18} className={config.strictMode ? "text-indigo-600 shrink-0 mt-0.5" : "text-zinc-400 shrink-0 mt-0.5"} />
            <div>
              <span className="text-[13px] font-semibold text-zinc-900 block">Modo estricto — responde 100% sobre tu información</span>
              <p className="text-[11.5px] text-zinc-500 leading-relaxed mt-0.5">
                El agente responde <strong>únicamente</strong> con tu catálogo y datos cargados. No inventa precios,
                stock ni productos. Si no sabe algo, lo dice y ofrece tomar la consulta.
              </p>
            </div>
          </div>
          {/* iOS-style switch */}
          <button
            type="button"
            role="switch"
            aria-checked={!!config.strictMode}
            onClick={() => handleFieldChange("strictMode", !config.strictMode)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer ${config.strictMode ? "bg-indigo-600" : "bg-zinc-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${config.strictMode ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* Preset Loading Pills */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
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
                  ? "bg-indigo-50/70 border-indigo-500 text-indigo-700 font-semibold"
                  : "bg-zinc-50/60 border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:bg-zinc-100/80"
              }`}
            >
              <span className="text-xs font-bold block truncate">{preset.businessName}</span>
              <span className="text-[10px] text-zinc-400 truncate block">{preset.businessType}</span>
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
            <label className="text-xs font-medium text-zinc-500">Nombre de la Empresa</label>
            <input
              type="text"
              value={config.businessName}
              onChange={(e) => handleFieldChange("businessName", e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-colors"
              placeholder="Ej: Tienda de Deportes S.A."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Rubro o Industria</label>
            <input
              type="text"
              value={config.businessType}
              onChange={(e) => handleFieldChange("businessType", e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-colors"
              placeholder="Ej: Indumentaria Masculina"
            />
          </div>
        </div>

        {/* Logo URL */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-medium text-zinc-500">Logo del Negocio (URL)</label>
            {config.logoUrl && (
              <img src={config.logoUrl} alt="Logo preview" className="w-6 h-6 rounded object-cover border border-zinc-200" onError={(e) => (e.currentTarget.style.display = "none")} />
            )}
          </div>
          <input
            type="url"
            value={config.logoUrl || ""}
            onChange={(e) => handleFieldChange("logoUrl", e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-colors"
            placeholder="https://mi-tienda.com/logo.png"
          />
        </div>

        {/* Row 2: Tone & Store Sync */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Tono de Comunicación</label>
            <select
              value={config.tone}
              onChange={(e) => handleFieldChange("tone", e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-colors"
            >
              <option value="Argentino/Cercano">Argentino/Cercano (vos, che, re cálido)</option>
              <option value="Profesional/Formal">Profesional/Formal (usted, neutro)</option>
              <option value="Casual/Juvenil">Casual/Juvenil (tú/vos, emojis, relajado)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 flex items-center">
              Sincronizar Stock & Tienda
            </label>
            <select
              value={config.syncStore}
              onChange={(e) => handleFieldChange("syncStore", e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-colors"
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
            <label className="text-xs font-medium text-zinc-500 flex items-center">
              <MessageSquare size={13} className="mr-1 text-indigo-600" /> Mensaje de Bienvenida Inicial
            </label>
            <span className="text-[10px] text-zinc-400">Se envía ante el saludo del cliente</span>
          </div>
          <textarea
            value={config.customGreeting || ""}
            onChange={(e) => handleFieldChange("customGreeting", e.target.value)}
            rows={2}
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-colors resize-none"
            placeholder="Escribe el mensaje con el que el bot recibirá a tus clientes..."
          />
        </div>

        {/* Catalog — visual product editor */}
        <CatalogEditor
          value={config.catalog || ""}
          onChange={(catalog) => handleFieldChange("catalog", catalog)}
        />

        {/* Auto Follow-up Settings */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Clock size={16} />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-900 block">Seguimientos Automáticos de Conversación</span>
              <p className="text-[10px] text-zinc-500 max-w-xs">Si el cliente consulta y no vuelve a responder, Respondo le recontactará sutilmente.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={config.autoFollowUpMinutes}
              onChange={(e) => handleFieldChange("autoFollowUpMinutes", Number(e.target.value))}
              className="w-16 bg-white border border-zinc-200 rounded-lg p-1.5 text-xs text-center text-zinc-900 font-bold focus:outline-none focus:border-indigo-500"
              min={1}
            />
            <span className="text-xs text-zinc-500">minutos</span>
          </div>
        </div>

        {/* Bot Persona Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 flex items-center gap-1">
              <User size={12} className="text-indigo-600" /> Nombre del Agente IA
            </label>
            <input
              type="text"
              value={config.botPersonaName || ""}
              onChange={(e) => handleFieldChange("botPersonaName", e.target.value)}
              placeholder="Ej: Valentina, Matías, Sofía…"
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-colors"
            />
            <p className="text-[9px] text-zinc-400">Humaniza el chatbot. El cliente ve este nombre en las respuestas.</p>
          </div>

          {/* Working Hours */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 flex items-center gap-1">
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
                className="w-16 bg-white border border-zinc-200 rounded-lg p-1.5 text-xs text-center text-zinc-900 font-bold focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-zinc-400">a</span>
              <input
                type="number"
                value={config.workingHoursEnd ?? ""}
                onChange={(e) => handleFieldChange("workingHoursEnd", e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="23"
                min={0}
                max={23}
                className="w-16 bg-white border border-zinc-200 rounded-lg p-1.5 text-xs text-center text-zinc-900 font-bold focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-zinc-400">hs</span>
            </div>
            <p className="text-[9px] text-zinc-400 leading-tight">Dejá vacío para 24/7. Fuera de horario, el bot avisa al cliente.</p>
          </div>
        </div>

        {/* Forbidden Topics */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 flex items-center gap-1">
            <ShieldAlert size={12} className="text-red-500" /> Temas Prohibidos (restricciones del bot)
          </label>
          <input
            type="text"
            value={config.forbiddenTopics || ""}
            onChange={(e) => handleFieldChange("forbiddenTopics", e.target.value)}
            placeholder="Ej: política, competencia, precios de la competencia, devoluciones…"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-colors"
          />
          <p className="text-[9px] text-zinc-400">Separados por comas. El agente IA se negará a discutir estos temas.</p>
        </div>

        {/* Quick Reply Templates */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-500 flex items-center gap-1">
            <MessageSquare size={12} className="text-indigo-500" /> Respuestas Rápidas (para agentes humanos en CRM)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(config.quickReplies || []).map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-medium px-2 py-1 rounded-full">
                {r}
                <button
                  type="button"
                  onClick={() => {
                    const next = (config.quickReplies || []).filter((_, j) => j !== i);
                    handleFieldChange("quickReplies", next);
                  }}
                  className="text-indigo-400 hover:text-red-500 transition-colors cursor-pointer ml-0.5"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
            {(config.quickReplies || []).length === 0 && (
              <span className="text-[10px] text-zinc-400 italic">Sin respuestas rápidas configuradas.</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={quickReplyInput}
              onChange={(e) => setQuickReplyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && quickReplyInput.trim()) {
                  e.preventDefault();
                  const next = [...(config.quickReplies || []), quickReplyInput.trim()];
                  handleFieldChange("quickReplies", next);
                  setQuickReplyInput("");
                }
              }}
              placeholder="Escribí una respuesta y presioná Enter…"
              className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => {
                if (!quickReplyInput.trim()) return;
                const next = [...(config.quickReplies || []), quickReplyInput.trim()];
                handleFieldChange("quickReplies", next);
                setQuickReplyInput("");
              }}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus size={12} /> Agregar
            </button>
          </div>
          <p className="text-[9px] text-zinc-400">Aparecen como chips clicables en el panel CRM cuando un agente toma control del chat.</p>
        </div>

        {/* System Prompt Preview */}
        <div className="border border-zinc-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPromptPreview((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left"
          >
            <span className="text-xs font-semibold text-zinc-700 flex items-center gap-2">
              <Sparkles size={13} className="text-indigo-600" />
              Vista Previa del Prompt del Sistema (lo que recibe la IA)
            </span>
            {showPromptPreview ? <EyeOff size={13} className="text-zinc-400" /> : <Eye size={13} className="text-zinc-400" />}
          </button>
          {showPromptPreview && (
            <div className="bg-zinc-900 text-emerald-300 text-[10px] font-mono p-4 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border-t border-zinc-200">
              {buildSystemPromptPreview(config)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
