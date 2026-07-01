import React, { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Mail, Lock, ArrowRight, Check, MessageSquare, Zap, ShieldCheck } from "lucide-react";
import { Button } from "./ui";

interface LoginProps {
  onLogin: (email: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setTimeout(() => onLogin(email.trim()), 500);
  };

  return (
    <div className="min-h-screen bg-[#fbfbfb] flex">
      {/* ===== Left brand panel ===== */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] bg-[#0a0a0a] p-14 relative overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[34rem] h-[34rem] bg-[#4f46e5]/20 rounded-full blur-[130px]" />

        {/* Brand */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-white flex items-center justify-center">
            <span className="font-semibold text-[#0a0a0a] text-[15px]">R</span>
          </div>
          <span className="font-semibold text-[15px] text-white tracking-tight">Respondo</span>
        </div>

        {/* Headline */}
        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="text-[32px] font-semibold text-white leading-[1.15] tracking-[-0.02em]"
          >
            Tu vendedor con IA<br />que nunca duerme.
          </motion.h1>
          <p className="text-[15px] text-white/45 mt-4 leading-relaxed max-w-md">
            Atendé WhatsApp, Instagram, Facebook y Email con un agente que responde, califica leads y cierra ventas solo.
          </p>
          <div className="mt-9 space-y-3.5">
            {[
              { icon: <MessageSquare size={14} />, t: "Responde en todos tus canales 24/7" },
              { icon: <Zap size={14} />, t: "Registra y califica cada lead automáticamente" },
              { icon: <ShieldCheck size={14} />, t: "Datos seguros, API oficial de Meta" },
            ].map((f, i) => (
              <motion.div
                key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                className="flex items-center gap-3 text-[14px] text-white/65"
              >
                <span className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center text-white/70 shrink-0">{f.icon}</span>
                {f.t}
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative text-[12px] text-white/35">© {new Date().getFullYear()} Respondo · Chatea menos, vendé más.</p>
      </div>

      {/* ===== Right form ===== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-[340px]"
        >
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-[10px] bg-[#0a0a0a] flex items-center justify-center"><span className="font-semibold text-white text-[15px]">R</span></div>
            <span className="font-semibold text-[15px] text-[#0a0a0a]">Respondo</span>
          </div>

          <h2 className="text-[24px] font-semibold tracking-tight text-[#0a0a0a]">Bienvenido de nuevo</h2>
          <p className="text-[14px] text-[#71717a] mt-1.5">Iniciá sesión para entrar a tu panel.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-[13px] font-medium text-[#0a0a0a] block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] pointer-events-none" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="tu@email.com"
                  className="w-full bg-white border border-black/[0.1] rounded-[10px] pl-10 pr-3.5 h-11 text-[14px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:outline-none focus:border-[#4f46e5] focus:ring-[3px] focus:ring-[#4f46e5]/10 transition-all"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-medium text-[#0a0a0a]">Contraseña</label>
                <button type="button" className="text-[12px] text-[#4f46e5] hover:text-[#4338ca]">¿Olvidaste?</button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] pointer-events-none" />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-black/[0.1] rounded-[10px] pl-10 pr-3.5 h-11 text-[14px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:outline-none focus:border-[#4f46e5] focus:ring-[3px] focus:ring-[#4f46e5]/10 transition-all"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full !h-11 mt-1" disabled={loading}>
              {loading ? "Entrando…" : <>Iniciar sesión <ArrowRight size={15} /></>}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-black/[0.08]" />
            <span className="text-[12px] text-[#a1a1aa]">o</span>
            <div className="flex-1 h-px bg-black/[0.08]" />
          </div>

          <button
            onClick={() => onLogin("demo@respondo.app")}
            className="w-full flex items-center justify-center gap-2 bg-white border border-black/[0.1] hover:bg-[#fafafa] text-[#0a0a0a] text-[14px] font-medium h-11 rounded-[10px] transition-colors cursor-pointer"
          >
            <Sparkles size={15} className="text-[#4f46e5]" /> Entrar con la demo
          </button>

          <p className="text-[12px] text-[#a1a1aa] text-center mt-6 flex items-center justify-center gap-1">
            <Check size={12} className="text-[#16a34a]" /> Sin tarjeta · Configurá tu agente en minutos
          </p>
        </motion.div>
      </div>
    </div>
  );
}
