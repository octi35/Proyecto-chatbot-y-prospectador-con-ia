import React, { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Mail, Lock, ArrowRight, Check, MessageSquare, Zap, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "./ui";
import { authLogin, authSignup } from "../lib/api";

interface LoginProps {
  onLogin: (email: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = mode === "login"
        ? await authLogin(email.trim(), password)
        : await authSignup(email.trim(), password);
      if (result.needsEmailConfirm) {
        setNotice("Cuenta creada. Revisá tu email para confirmarla y después iniciá sesión.");
        setMode("login");
        return;
      }
      onLogin(email.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc] flex">
      {/* ===== Left brand panel ===== */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] bg-[#111111] p-14 relative overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[34rem] h-[34rem] bg-[#4f6ef7]/20 rounded-full blur-[130px]" />

        {/* Brand */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-white flex items-center justify-center">
            <span className="font-semibold text-[#111111] text-[15px]">R</span>
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
            <div className="w-9 h-9 rounded-[10px] bg-[#111111] flex items-center justify-center"><span className="font-semibold text-white text-[15px]">R</span></div>
            <span className="font-semibold text-[15px] text-[#111111]">Respondo</span>
          </div>

          <h2 className="text-[24px] font-semibold tracking-tight text-[#111111]">
            {mode === "login" ? "Bienvenido de nuevo" : "Creá tu cuenta"}
          </h2>
          <p className="text-[14px] text-[#6b7280] mt-1.5">
            {mode === "login" ? "Iniciá sesión para entrar a tu panel." : "Registrate gratis y configurá tu agente IA."}
          </p>

          {notice && (
            <div className="mt-4 flex items-start gap-2 bg-[#e9f8ec] text-[#2f8f4e] text-[13px] rounded-[14px] px-3.5 py-2.5 leading-snug">
              <Check size={14} className="shrink-0 mt-0.5" /> {notice}
            </div>
          )}
          {error && (
            <div className="mt-4 flex items-start gap-2 bg-[#fdeaea] text-[#c0392b] text-[13px] rounded-[14px] px-3.5 py-2.5 leading-snug">
              <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-[13px] font-medium text-[#111111] block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="tu@email.com"
                  className="w-full bg-white border border-black/[0.1] rounded-[10px] pl-10 pr-3.5 h-11 text-[14px] text-[#111111] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#4f6ef7] focus:ring-[3px] focus:ring-[#4f6ef7]/10 transition-all"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-medium text-[#111111]">Contraseña</label>
                <button type="button" className="text-[12px] text-[#4f6ef7] hover:text-[#3b5bdb]">¿Olvidaste?</button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"}
                  className="w-full bg-white border border-black/[0.1] rounded-[10px] pl-10 pr-3.5 h-11 text-[14px] text-[#111111] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#4f6ef7] focus:ring-[3px] focus:ring-[#4f6ef7]/10 transition-all"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full !h-11 mt-1" disabled={loading}>
              {loading
                ? (mode === "login" ? "Entrando…" : "Creando cuenta…")
                : <>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"} <ArrowRight size={15} /></>}
            </Button>
          </form>

          <p className="text-[13px] text-[#6b7280] text-center mt-4">
            {mode === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setNotice(null); }}
              className="text-[#4f6ef7] hover:text-[#3b5bdb] font-medium cursor-pointer"
            >
              {mode === "login" ? "Registrate gratis" : "Iniciá sesión"}
            </button>
          </p>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-black/[0.08]" />
            <span className="text-[12px] text-[#9ca3af]">o</span>
            <div className="flex-1 h-px bg-black/[0.08]" />
          </div>

          <button
            onClick={() => onLogin("demo@respondo.app")}
            className="w-full flex items-center justify-center gap-2 bg-white border border-black/[0.1] hover:bg-[#f3f5fb] text-[#111111] text-[14px] font-medium h-11 rounded-[10px] transition-colors cursor-pointer"
          >
            <Sparkles size={15} className="text-[#4f6ef7]" /> Entrar con la demo
          </button>

          <p className="text-[12px] text-[#9ca3af] text-center mt-6 flex items-center justify-center gap-1">
            <Check size={12} className="text-[#16a34a]" /> Sin tarjeta · Configurá tu agente en minutos
          </p>
        </motion.div>
      </div>
    </div>
  );
}
