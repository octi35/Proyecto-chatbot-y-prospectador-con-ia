import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check, Copy, ChevronDown, MessageSquare, Send, Loader2,
  ExternalLink, ShieldCheck, Sparkles,
} from "lucide-react";
import { getHealth, type HealthData } from "../lib/api";

// Brand visual identity per channel
const CHANNELS = [
  {
    id: "whatsapp" as const,
    name: "WhatsApp Business",
    tagline: "API Oficial de Meta — envío masivo sin riesgo de baneo",
    gradient: "from-emerald-400 to-green-600",
    soft: "bg-emerald-50 text-emerald-700",
    initials: "WA",
    steps: [
      "Entrá a Meta for Developers y creá una app de tipo Business.",
      "Agregá el producto \"WhatsApp\" y copiá tu Token y Phone Number ID.",
      "Pegá la URL del webhook (abajo) en Configuración → Webhooks y usá el token de verificación.",
      "Cargá WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_APP_SECRET en el .env del servidor.",
    ],
    docUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    envVars: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_APP_SECRET"],
  },
  {
    id: "instagram" as const,
    name: "Instagram Direct",
    tagline: "Respondé DMs y comentarios automáticamente desde tu cuenta",
    gradient: "from-pink-500 via-fuchsia-500 to-purple-600",
    soft: "bg-pink-50 text-pink-700",
    initials: "IG",
    steps: [
      "Conectá tu cuenta de Instagram Business a una página de Facebook.",
      "En Meta for Developers agregá el producto \"Instagram\" a tu app.",
      "Suscribí la app a los webhooks de mensajes de Instagram con la URL de abajo.",
      "Cargá IG_TOKEN y IG_ACCOUNT_ID en el .env del servidor.",
    ],
    docUrl: "https://developers.facebook.com/docs/instagram-api",
    envVars: ["IG_TOKEN", "IG_ACCOUNT_ID"],
  },
  {
    id: "facebook" as const,
    name: "Facebook Messenger",
    tagline: "Atendé a tus clientes desde la página de tu negocio",
    gradient: "from-blue-500 to-blue-700",
    soft: "bg-blue-50 text-blue-700",
    initials: "FB",
    steps: [
      "Creá o elegí la página de Facebook de tu negocio.",
      "En Meta for Developers agregá el producto \"Messenger\" a tu app.",
      "Generá un token de página y suscribí los webhooks con la URL de abajo.",
      "Cargá FB_PAGE_TOKEN y FB_PAGE_ID en el .env del servidor.",
    ],
    docUrl: "https://developers.facebook.com/docs/messenger-platform",
    envVars: ["FB_PAGE_TOKEN", "FB_PAGE_ID"],
  },
];

export default function ChannelConnect() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [expanded, setExpanded] = useState<string | null>("whatsapp");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {});
  }, []);

  const webhookUrl = health?.webhookUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/webhook/whatsapp`;

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    });
  };

  // WhatsApp is the only channel with a server-side status flag today
  const isConnected = (id: string) => (id === "whatsapp" ? !!health?.integrations.whatsapp : false);

  const connectedCount = CHANNELS.filter((c) => isConnected(c.id)).length;

  const runTest = async () => {
    if (!testPhone.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone.trim() }),
      });
      const data = await r.json();
      setTestResult(data.ok ? `✅ Mensaje de prueba enviado a ${data.phone}` : `⚠️ ${data.reason || "WhatsApp no configurado todavía"}`);
    } catch {
      setTestResult("⚠️ No se pudo conectar con el servidor");
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 6000);
    }
  };

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto pt-2 pb-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#0071e3] text-[11px] font-semibold mb-3">
          <Sparkles size={12} /> Conectá en minutos
        </div>
        <h2 className="text-[1.8rem] font-bold tracking-[-0.03em] text-[#1d1d1f]">
          Conectá tus canales
        </h2>
        <p className="text-[15px] text-[#6e6e73] mt-2 leading-relaxed">
          Vinculá WhatsApp, Instagram y Facebook para que tu agente responda en todos lados.
          Seguí los pasos guiados de cada uno — no necesitás saber programar.
        </p>
        <div className="inline-flex items-center gap-2 mt-4 text-[13px] text-[#6e6e73]">
          <span className="font-semibold text-[#1d1d1f]">{connectedCount}/3</span> canales conectados
          <div className="flex gap-1 ml-1">
            {CHANNELS.map((c) => (
              <span key={c.id} className={`w-1.5 h-1.5 rounded-full ${isConnected(c.id) ? "bg-emerald-500" : "bg-slate-300"}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Channel cards */}
      <div className="space-y-3">
        {CHANNELS.map((ch) => {
          const open = expanded === ch.id;
          const connected = isConnected(ch.id);
          return (
            <div
              key={ch.id}
              className={`bg-white border rounded-[22px] overflow-hidden transition-all duration-300 ${open ? "border-slate-200 shadow-apple" : "border-slate-150 shadow-apple-sm"}`}
            >
              {/* Card header */}
              <button
                onClick={() => setExpanded(open ? null : ch.id)}
                className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${ch.gradient} flex items-center justify-center shrink-0 shadow-apple-sm`}>
                  <span className="text-white font-bold text-sm">{ch.initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[15px] text-[#1d1d1f] tracking-tight">{ch.name}</h3>
                    {connected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check size={10} /> Conectado
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#86868b] bg-slate-100 px-2 py-0.5 rounded-full">
                        Sin conectar
                      </span>
                    )}
                  </div>
                  <p className="text-[12.5px] text-[#6e6e73] mt-0.5 truncate">{ch.tagline}</p>
                </div>
                <ChevronDown size={18} className={`text-[#86868b] shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
              </button>

              {/* Expandable guide */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 sm:px-5 pb-5 pt-1 space-y-4 border-t border-slate-100">
                      {/* Steps */}
                      <div className="space-y-2.5 pt-4">
                        {ch.steps.map((step, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span className="w-5 h-5 rounded-full bg-[#0071e3] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-[13px] text-[#1d1d1f] leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>

                      {/* Webhook URL */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">URL del Webhook (pegar en Meta)</label>
                        <div className="flex gap-2">
                          <code className="flex-1 bg-[#1d1d1f] text-emerald-300 text-[11px] font-mono px-3 py-2.5 rounded-xl overflow-x-auto whitespace-nowrap">
                            {webhookUrl}
                          </code>
                          <button
                            onClick={() => copy(webhookUrl, `${ch.id}-url`)}
                            className="px-3.5 py-2.5 bg-[#1d1d1f] hover:bg-[#000] text-white text-[12px] font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                          >
                            {copiedField === `${ch.id}-url` ? <Check size={13} /> : <Copy size={13} />}
                            {copiedField === `${ch.id}-url` ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                      </div>

                      {/* Env vars + verify token */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Variables del .env</label>
                          <div className="flex flex-wrap gap-1.5">
                            {ch.envVars.map((v) => (
                              <button
                                key={v}
                                onClick={() => copy(v, v)}
                                className="text-[10px] font-mono font-medium bg-slate-100 hover:bg-slate-200 text-[#1d1d1f] px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                title="Copiar nombre de la variable"
                              >
                                {copiedField === v ? <Check size={9} /> : <Copy size={9} />} {v}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Token de verificación</label>
                          <div className="flex gap-2">
                            <code className="flex-1 bg-slate-100 text-[#1d1d1f] text-[11px] font-mono px-2.5 py-1.5 rounded-lg truncate">
                              WEBHOOK_VERIFY_TOKEN
                            </code>
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp test */}
                      {ch.id === "whatsapp" && (
                        <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3.5 space-y-2">
                          <span className="text-[12px] font-semibold text-emerald-800 flex items-center gap-1.5">
                            <MessageSquare size={13} /> Probá el envío real
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="tel"
                              value={testPhone}
                              onChange={(e) => setTestPhone(e.target.value)}
                              placeholder="5491112345678"
                              className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-[13px] text-[#1d1d1f] focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              onClick={runTest}
                              disabled={testing || !testPhone.trim()}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[12px] font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                            >
                              {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                              Enviar test
                            </button>
                          </div>
                          {testResult && <p className="text-[11px] text-emerald-800 font-medium">{testResult}</p>}
                        </div>
                      )}

                      {/* Docs link */}
                      <a
                        href={ch.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0071e3] hover:underline"
                      >
                        Ver guía oficial de Meta <ExternalLink size={12} />
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2.5 text-[12px] text-[#6e6e73] bg-white border border-slate-150 rounded-2xl p-4 shadow-apple-sm">
        <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <span>
          <strong className="text-[#1d1d1f]">Tus credenciales nunca tocan el navegador.</strong> Se guardan
          como variables de entorno en el servidor (archivo <code className="bg-slate-100 px-1 rounded">.env</code>),
          igual que las apps profesionales. Reiniciá el servidor después de cargarlas para activar el canal.
        </span>
      </div>
    </div>
  );
}
