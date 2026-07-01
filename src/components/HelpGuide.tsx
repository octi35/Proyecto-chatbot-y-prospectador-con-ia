import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, Store, Plug, MessageSquare, ChevronDown, ArrowRight,
  BookOpen, Bot, Users, Zap,
} from "lucide-react";
import { Card, Badge, SectionHeading } from "./ui";

interface HelpGuideProps {
  onNavigate: (tab: string) => void;
}

const STEPS = [
  {
    n: 1, icon: <Store size={18} />, tone: "accent" as const, tab: "playground",
    title: "Entrená a tu agente",
    desc: "Cargá tu catálogo, el tono y las reglas del negocio en Estudio IA. Cuanta más info, mejor vende.",
    cta: "Ir a Estudio IA",
  },
  {
    n: 2, icon: <Plug size={18} />, tone: "success" as const, tab: "integrations",
    title: "Conectá tus canales",
    desc: "Vinculá WhatsApp, Instagram, Facebook y Email con la guía paso a paso. Sin saber programar.",
    cta: "Ir a Integraciones",
  },
  {
    n: 3, icon: <Users size={18} />, tone: "warning" as const, tab: "crm",
    title: "Mirá entrar los leads",
    desc: "El agente registra y califica cada conversación en el CRM. Tomá el control cuando quieras.",
    cta: "Ir al CRM",
  },
];

const FAQ = [
  { q: "¿Necesito saber programar?", a: "No. Configurás todo desde el panel: catálogo, tono, canales y reglas. Las integraciones tienen guías paso a paso con todo listo para copiar y pegar." },
  { q: "¿En qué canales responde el agente?", a: "WhatsApp, Instagram, Facebook Messenger y Email. Todos comparten el mismo cerebro de IA y registran los leads en un solo CRM." },
  { q: "¿Qué pasa si la IA no sabe algo?", a: "Con el Modo Estricto activado, el agente responde solo con tu información cargada y nunca inventa precios ni stock. Si no sabe algo, lo dice y ofrece tomar la consulta." },
  { q: "¿Puedo intervenir una conversación?", a: "Sí. Desde el CRM podés tomar el control de cualquier chat, escribir vos mismo y volver a activar la IA cuando quieras." },
  { q: "¿Mis datos están seguros?", a: "Sí. Las credenciales se guardan como variables de entorno en el servidor (nunca en el navegador) y los datos viven en Supabase. WhatsApp usa la API oficial de Meta." },
];

export default function HelpGuide({ onNavigate }: HelpGuideProps) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center pt-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#4f6ef7] bg-[#f5f6ff] px-3 py-1 rounded-full mb-4"
        >
          <BookOpen size={13} /> Centro de ayuda
        </motion.div>
        <h1 className="text-[30px] font-semibold tracking-tight text-[#111111]">¿Cómo funciona Respondo?</h1>
        <p className="text-[15px] text-[#6b7280] mt-3 max-w-xl mx-auto leading-relaxed">
          Poné a tu agente de ventas a trabajar en 3 pasos. Te lleva menos de lo que pensás.
        </p>
      </div>

      {/* Steps */}
      <div className="grid md:grid-cols-3 gap-5">
        {STEPS.map((s, i) => (
          <Card key={s.n} interactive index={i} className="p-6 flex flex-col" onClick={() => onNavigate(s.tab)}>
            <div className="flex items-center justify-between mb-4">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                s.tone === "accent" ? "bg-[#f5f6ff] text-[#4f6ef7]" : s.tone === "success" ? "bg-[#eafaea] text-[#4caf4c]" : "bg-[#fff7e0] text-[#b8860b]"
              }`}>{s.icon}</span>
              <span className="text-[28px] font-semibold text-[#f4f4f5] leading-none">{s.n}</span>
            </div>
            <h3 className="text-[16px] font-semibold text-[#111111]">{s.title}</h3>
            <p className="text-[13.5px] text-[#6b7280] mt-1.5 leading-relaxed flex-1">{s.desc}</p>
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#4f6ef7] mt-4">
              {s.cta} <ArrowRight size={14} />
            </span>
          </Card>
        ))}
      </div>

      {/* Quick tips */}
      <Card className="p-6">
        <SectionHeading title="Consejos para vender más" />
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
          {[
            { icon: <Bot size={15} />, t: "Dale un nombre humano a tu bot", d: "Genera más confianza y cierra mejor." },
            { icon: <Zap size={15} />, t: "Activá los seguimientos automáticos", d: "Recuperá leads que quedaron sin responder." },
            { icon: <MessageSquare size={15} />, t: "Cargá respuestas rápidas", d: "Para cuando tomás el control del chat." },
            { icon: <Sparkles size={15} />, t: "Usá el Modo Estricto", d: "Que el agente nunca invente datos." },
          ].map((tip, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#f4f4f5] text-[#6b7280] flex items-center justify-center shrink-0">{tip.icon}</span>
              <div>
                <p className="text-[13.5px] font-medium text-[#111111]">{tip.t}</p>
                <p className="text-[12.5px] text-[#6b7280] mt-0.5">{tip.d}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* FAQ */}
      <div>
        <SectionHeading title="Preguntas frecuentes" />
        <div className="space-y-2.5">
          {FAQ.map((item, i) => (
            <Card key={i} className="overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
              >
                <span className="text-[14px] font-medium text-[#111111]">{item.q}</span>
                <ChevronDown size={17} className={`text-[#9ca3af] shrink-0 transition-transform duration-300 ${open === i ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-4 text-[13.5px] text-[#6b7280] leading-relaxed">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA footer */}
      <Card className="p-6 bg-[#111111] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <h3 className="text-[16px] font-semibold text-white">¿Listo para empezar?</h3>
          <p className="text-[13px] text-[#9ca3af] mt-1">Configurá tu agente y empezá a recibir leads hoy.</p>
        </div>
        <button
          onClick={() => onNavigate("playground")}
          className="bg-[#4f6ef7] hover:bg-[#3b5bdb] text-white text-[14px] font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <Sparkles size={15} /> Entrenar mi agente
        </button>
      </Card>
    </div>
  );
}
