import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Globe,
  Check,
  CheckCircle2,
  XCircle,
  Copy,
  Webhook,
  Terminal,
  Zap,
  Shield,
  MessageSquare,
} from "lucide-react";
import { getHealth, runFollowups, type HealthData } from "../lib/api";

// Integration colors & initials used as logo fallback (no external images)
const INTEGRATION_LIST = [
  {
    name: "TiendaNube",
    category: "E-commerce",
    desc: "Sincroniza stock, precios y genera links de carritos de compra automáticamente.",
    color: "bg-blue-500",
    initials: "TN",
    status: "Conectado",
  },
  {
    name: "Shopify",
    category: "E-commerce",
    desc: "Conexión en tiempo real con catálogo de productos y variantes de talle/color.",
    color: "bg-emerald-600",
    initials: "SH",
    status: "Disponible",
  },
  {
    name: "WooCommerce",
    category: "E-commerce",
    desc: "Sincroniza inventario para sitios WordPress de forma directa y segura.",
    color: "bg-purple-600",
    initials: "WC",
    status: "Disponible",
  },
  {
    name: "Mercado Pago",
    category: "Pagos",
    desc: "Genera links de cobro en pesos (Argentina) directo en el chat para cerrar la venta.",
    color: "bg-sky-500",
    initials: "MP",
    status: "Conectado",
  },
  {
    name: "Google Calendar",
    category: "Calendarios",
    desc: "Permite agendar turnos, reuniones o asesorías directo desde WhatsApp.",
    color: "bg-red-500",
    initials: "GC",
    status: "Conectado",
  },
  {
    name: "Tokko Broker",
    category: "Inmobiliaria",
    desc: "Consulta propiedades disponibles y agenda visitas para inmobiliarias.",
    color: "bg-amber-500",
    initials: "TK",
    status: "Disponible",
  },
  {
    name: "Meta API (Oficial)",
    category: "Mensajería",
    desc: "API Oficial de WhatsApp Business Cloud. Envío masivo sin riesgo de baneo.",
    color: "bg-indigo-600",
    initials: "WA",
    status: "Conectado",
  },
  {
    name: "MercadoLibre",
    category: "Marketplace",
    desc: "Responde consultas y convierte visitas en ventas desde tu tienda MeLi.",
    color: "bg-yellow-400",
    initials: "ML",
    status: "Disponible",
  },
];

export default function WhiteLabelStudio() {
  const [partnerBrand, setPartnerBrand] = useState("Agencia Click Ventas");
  const [partnerDomain, setPartnerDomain] = useState("ia.clickventas.com");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [whiteLabelActive, setWhiteLabelActive] = useState(false);
  const [integrations, setIntegrations] = useState(INTEGRATION_LIST);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [followupMsg, setFollowupMsg] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {});
  }, []);

  const handleRunFollowups = async () => {
    try {
      const result = await runFollowups();
      setFollowupMsg(`✅ ${result.contacted} seguimiento${result.contacted !== 1 ? "s" : ""} enviado${result.contacted !== 1 ? "s" : ""} (${result.totalStale} leads inactivos detectados)`);
    } catch {
      setFollowupMsg("⚠️ Error al ejecutar seguimientos.");
    }
    setTimeout(() => setFollowupMsg(null), 6000);
  };

  const copyWebhook = () => {
    const url = health?.webhookUrl || `${window.location.origin}/webhook/whatsapp`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleToggleIntegration = (name: string) => {
    setIntegrations((prev) =>
      prev.map((it) => {
        if (it.name === name) {
          const nextStatus = it.status === "Conectado" ? "Disponible" : "Conectado";
          return { ...it, status: nextStatus };
        }
        return it;
      })
    );
  };

  const handleSaveWhiteLabel = (e: React.FormEvent) => {
    e.preventDefault();
    setWhiteLabelActive(true);
  };

  const StatusBadge = ({ ok }: { ok: boolean }) =>
    ok ? (
      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={10} /> Conectado
      </span>
    ) : (
      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <XCircle size={10} /> Sin configurar
      </span>
    );

  return (
    <div className="space-y-6">

      {/* Connection status row */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-semibold text-sm text-slate-900 flex items-center gap-2">
            <Webhook size={16} className="text-blue-600" /> Estado de Conexiones
          </h3>
          <span className="text-[10px] text-slate-400">Verificado en el arranque del servidor</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Gemini AI</span>
              <span className="text-[9px] text-slate-500">GEMINI_API_KEY</span>
            </div>
            <StatusBadge ok={health?.integrations.gemini ?? false} />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Supabase DB</span>
              <span className="text-[9px] text-slate-500">SUPABASE_URL / KEY</span>
            </div>
            <StatusBadge ok={health?.integrations.supabase ?? false} />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <span className="text-xs font-bold text-slate-800 block">WhatsApp Meta API</span>
              <span className="text-[9px] text-slate-500">WA_TOKEN / PHONE_ID</span>
            </div>
            <StatusBadge ok={health?.integrations.whatsapp ?? false} />
          </div>
        </div>

        {/* Webhook URL */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            URL del Webhook de WhatsApp (pegar en Meta for Developers)
          </span>
          <div className="flex gap-2">
            <code className="flex-1 bg-slate-900 text-emerald-400 text-[11px] font-mono px-3 py-2 rounded-xl overflow-x-auto whitespace-nowrap">
              {health?.webhookUrl || `${window.location.origin}/webhook/whatsapp`}
            </code>
            <button
              onClick={copyWebhook}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Pegá esta URL en <strong>Meta for Developers → WhatsApp → Configuración del Webhook</strong>. El token de verificación se configura en la variable <code className="bg-slate-100 px-1 rounded">WEBHOOK_VERIFY_TOKEN</code> del servidor.
          </p>
        </div>

        {/* Quick actions row */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={() => setShowSetupGuide((v) => !v)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Terminal size={12} /> {showSetupGuide ? "Ocultar Guía" : "Ver Guía de Configuración"}
          </button>
          <button
            onClick={handleRunFollowups}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Zap size={12} /> Ejecutar Seguimientos
          </button>
        </div>

        {/* Webhook test */}
        <div className="flex gap-2 items-center pt-1">
          <input
            type="tel"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="Número para test (ej: 5491112345678)"
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={async () => {
              if (!testPhone.trim()) return;
              try {
                const r = await fetch("/api/test-webhook", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ phone: testPhone.trim() }),
                });
                const data = await r.json();
                setTestResult(data.ok
                  ? `✅ Mensaje de prueba enviado a ${data.phone}`
                  : `⚠️ ${data.reason || "Sin configuración de WA"}`
                );
              } catch {
                setTestResult("⚠️ Error al conectar con el servidor");
              }
              setTimeout(() => setTestResult(null), 5000);
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
          >
            <MessageSquare size={12} /> Enviar Test WA
          </button>
        </div>
        {testResult && <p className="text-[10px] text-slate-600 font-medium">{testResult}</p>}

        {followupMsg && (
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium">
            {followupMsg}
          </div>
        )}

        {/* Setup guide */}
        {showSetupGuide && (
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 space-y-4 text-[11px] font-mono leading-relaxed">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
              <Shield size={14} className="text-emerald-400" />
              <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">Guía de Configuración — Variables de Entorno</span>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-slate-400 text-[9px] uppercase block mb-1">1. Gemini AI (Google)</span>
                <code className="text-amber-300">GEMINI_API_KEY=AIza…</code>
                <p className="text-slate-500 text-[9px] mt-0.5">Obtené la key en: aistudio.google.com/apikey</p>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] uppercase block mb-1">2. Supabase Database</span>
                <code className="text-amber-300">SUPABASE_URL=https://xxxx.supabase.co</code><br/>
                <code className="text-amber-300">SUPABASE_ANON_KEY=eyJ…</code>
                <p className="text-slate-500 text-[9px] mt-0.5">Supabase → Settings → API → Project URL y anon/public key</p>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] uppercase block mb-1">3. WhatsApp Meta API (para mensajes reales)</span>
                <code className="text-amber-300">WHATSAPP_TOKEN=EAABz…</code><br/>
                <code className="text-amber-300">WHATSAPP_PHONE_NUMBER_ID=1234567890</code><br/>
                <code className="text-amber-300">WHATSAPP_APP_SECRET=abc123…</code><br/>
                <code className="text-amber-300">WEBHOOK_VERIFY_TOKEN=mi-token-secreto</code><br/>
                <code className="text-amber-300">APP_URL=https://tu-dominio.com</code>
                <p className="text-slate-500 text-[9px] mt-0.5">Meta for Developers → WhatsApp → API Setup</p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-700 flex items-start gap-2">
              <MessageSquare size={11} className="text-blue-400 shrink-0 mt-0.5" />
              <span className="text-slate-400 text-[9px]">Creá un archivo <code className="text-slate-200">.env</code> en la raíz del proyecto con estas variables, luego reiniciá el servidor con <code className="text-slate-200">npm run dev</code>.</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

      {/* Integrations Grid Left (7 columns) */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div>
          <h3 className="font-sans font-semibold text-base text-slate-900">Integraciones Nativas</h3>
          <p className="text-xs text-slate-500">Conectá de manera segura las bases de datos de tu tienda e inventario</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {integrations.map((it) => (
            <div
              key={it.name}
              className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 hover:border-slate-300 transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl shrink-0 ${(it as any).color} flex items-center justify-center`}>
                <span className="text-white text-xs font-black">{(it as any).initials}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 block truncate">{it.name}</span>
                  <span className="text-[8px] bg-white text-slate-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider border border-slate-200 font-bold">
                    {it.category}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  {it.desc}
                </p>
                <button
                  onClick={() => handleToggleIntegration(it.name)}
                  className={`mt-2.5 py-1 px-3 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                    it.status === "Conectado"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {it.status === "Conectado" ? "Conectado ✓" : "Conectar +"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* White Label Customizer Right (5 columns) */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
              <Briefcase size={18} />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-sm text-slate-900">Portal White Label / Marca Blanca</h3>
              <p className="text-xs text-slate-500">Revende Respondo bajo tu propia marca de agencia</p>
            </div>
          </div>

          <form onSubmit={handleSaveWhiteLabel} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Nombre de Tu Agencia / Marca</label>
              <input
                type="text"
                value={partnerBrand}
                onChange={(e) => setPartnerBrand(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Ej: Agencia Digital Nova"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Dominio Personalizado (CNAME)</label>
              <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors">
                <span className="bg-slate-100 px-3 py-2 text-xs text-slate-500 font-mono border-r border-slate-250 flex items-center">
                  https://
                </span>
                <input
                  type="text"
                  value={partnerDomain}
                  onChange={(e) => setPartnerDomain(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-800 focus:outline-none"
                  placeholder="ia.tuagencia.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Color Primario del Panel</label>
              <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded-xl p-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs font-mono text-slate-600">{accentColor}</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Guardar y Rebrandear Portal
            </button>
          </form>

          {whiteLabelActive && (
            <div className="p-3.5 bg-purple-50 border border-purple-100 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                Vista de Reventa Activada
              </span>
              <p className="text-[10px] text-purple-900 leading-normal">
                Tus clientes ahora verán el panel con el título <strong className="text-purple-950">{partnerBrand}</strong> y accederán desde el subdominio <strong className="text-purple-950">{partnerDomain}</strong>. El logo original de Respondo ha sido ocultado de sus entornos de producción.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[10px] text-slate-600 leading-relaxed flex items-start gap-2">
          <Globe size={14} className="text-blue-600 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-800 block mb-0.5">Soporte Técnico 24/7 de Marca Blanca:</strong>
            Atendemos a tus clientes en nombre de tu agencia por correo, chat o WhatsApp, resolviendo incidencias sin revelar la marca originaria. Margen de ganancia sugerido para partners: 40% al 60%.
          </span>
        </div>

      </div>

      </div>{/* end lg grid */}
    </div>
  );
}
