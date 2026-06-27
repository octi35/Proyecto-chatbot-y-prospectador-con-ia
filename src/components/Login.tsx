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
    // No real auth backend yet — accept any credentials (demo) and persist
    setTimeout(() => onLogin(email.trim()), 600);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* ===== Left brand panel ===== */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] bg-zinc-900 p-12 relative overflow-hidden">
        <div className="absolute -top-24 -left-16 w-[32rem] h-[32rem] bg-indigo-600/25 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[26rem] h-[26rem] bg-violet-600/15 rounded-full blur-[120px]" />

        {/* Brand */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[11px] bg-indigo-600 flex items-center justify-center">
            <span className="font-semibold text-white text-base">R</span>
          </div>
          <span className="font-semibold text-[16px] text-white tracking-tight">Respondo</span>
        </div>

        {/* Headline */}
        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="text-[34px] font-semibold text-white leading-[1.15] tracking-tight"
          >
            Tu vendedor con IA que<br />nunca duerme.
          </motion.h1>
          <p className="text-[15px] text-zinc-400 mt-4 leading-relaxed max-w-md">
            Atendé WhatsApp, Instagram, Facebook y Email con un agente que responde, califica leads y cierra ventas solo.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: <MessageSquare size={15} />, t: "Responde en todos tus canales 24/7" },
              { icon: <Zap size={15} />, t: "Registra y califica cada lead automáticamente" },
              { icon: <ShieldCheck size={15} />, t: "Datos seguros, API oficial de Meta" },
            ].map((f, i) => (
              <motion.div
                key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-3 text-[14px] text-zinc-300"
              >
                <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-indigo-300 shrink-0">{f.icon}</span>
                {f.t}
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative text-[12px] text-zinc-500">© {new Date().getFullYear()} Respondo · Chatea menos, vendé más.</p>
      </div>

      {/* ===== Right form ===== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-[11px] bg-indigo-600 flex items-center justify-center"><span className="font-semibold text-white">R</span></div>
            <span className="font-semibold text-[16px] text-zinc-900">Respondo</span>
          </div>

          <h2 className="text-[26px] font-semibold tracking-tight text-zinc-900">Bienvenido de nuevo</h2>
          <p className="text-[14px] text-zinc-500 mt-1.5">Iniciá sesión para entrar a tu panel.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-[13px] font-medium text-zinc-700 block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="tu@email.com"
                  className="w-full bg-white rounded-xl pl-10 pr-4 py-2.5 text-[14px] text-zinc-900 placeholder:text-zinc-400 shadow-[0_1px_2px_rgba(24,24,27,0.05)] ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-medium text-zinc-700">Contraseña</label>
                <button type="button" className="text-[12px] text-indigo-600 hover:text-indigo-500">¿Olvidaste?</button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white rounded-xl pl-10 pr-4 py-2.5 text-[14px] text-zinc-900 placeholder:text-zinc-400 shadow-[0_1px_2px_rgba(24,24,27,0.05)] ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                />
              </div>
            </div>

            <Button type="submit" variant="accent" className="w-full py-2.5 mt-2" disabled={loading}>
              {loading ? "Entrando…" : <>Iniciar sesión <ArrowRight size={15} /></>}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-[12px] text-zinc-400">o</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          <button
            onClick={() => onLogin("demo@respondo.app")}
            className="w-full flex items-center justify-center gap-2 bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 text-zinc-700 text-[14px] font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Sparkles size={15} className="text-indigo-500" /> Entrar con la demo
          </button>

          <p className="text-[12px] text-zinc-400 text-center mt-6 flex items-center justify-center gap-1">
            <Check size={12} className="text-emerald-500" /> Sin tarjeta · Configurá tu agente en minutos
          </p>
        </motion.div>
      </div>
    </div>
  );
}
