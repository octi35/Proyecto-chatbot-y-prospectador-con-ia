import React from "react";
import { motion, AnimatePresence, type HTMLMotionProps } from "motion/react";
import { AlertCircle, X, Plus } from "lucide-react";

/**
 * SaaS premium 2026 primitives (Salesforce / Linear / Stripe caliber).
 * Blanco frío + tarjetas flotantes 22px con sombra susurrada. Un acento azul
 * (#4f6ef7) usado con moderación. Botones/badges pill. Inputs sin borde.
 */

const spring = { type: "spring" as const, stiffness: 400, damping: 32 };
export function cx(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

/* ----------------------------- Card ----------------------------- */
interface CardProps extends HTMLMotionProps<"div"> {
  interactive?: boolean;
}
export function Card({ interactive, className, children, ...props }: CardProps) {
  return (
    <motion.div
      whileHover={interactive ? { y: -2 } : undefined}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={cx(
        "bg-white rounded-[22px] shadow-card",
        interactive && "cursor-pointer hover:shadow-card-hover",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------- Button ---------------------------- */
type ButtonVariant = "primary" | "brand" | "accent" | "yellow" | "secondary" | "outline" | "ghost";
interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}
const BTN: Record<ButtonVariant, string> = {
  primary:   "bg-[#101010] text-white hover:bg-[#232323]",
  brand:     "bg-[#4f6ef7] text-white hover:bg-[#3b5bdb]",
  accent:    "bg-[#4f6ef7] text-white hover:bg-[#3b5bdb]",
  yellow:    "bg-[#ffd84d] text-[#101010] hover:brightness-95",
  secondary: "bg-[#f3f5fb] text-[#111111] hover:bg-[#eaedf6]",
  outline:   "bg-white text-[#111111] ring-1 ring-[#ececec] hover:bg-[#f3f5fb]",
  ghost:     "text-[#6b7280] hover:bg-black/[0.04] hover:text-[#111111]",
};
export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-150 cursor-pointer",
        size === "sm" ? "text-[13px] px-4 h-[34px]" : size === "lg" ? "text-[14px] px-6 h-12" : "text-[13.5px] px-5 h-[42px]",
        BTN[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/* ----------------------------- Badge ---------------------------- */
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "accent" | "yellow" | "green" | "sky" | "dark";
const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-[#f3f5fb] text-[#4b5563]",
  success: "bg-[#e9f8ec] text-[#2f8f4e]",
  green:   "bg-[#e9f8ec] text-[#2f8f4e]",
  warning: "bg-[#fff6d6] text-[#a16207]",
  yellow:  "bg-[#fff6d6] text-[#a16207]",
  danger:  "bg-[#fdeaea] text-[#c0392b]",
  info:    "bg-[#eef1fe] text-[#3b5bdb]",
  brand:   "bg-[#eef1fe] text-[#4f6ef7]",
  accent:  "bg-[#eef1fe] text-[#4f6ef7]",
  sky:     "bg-[#e3f3fd] text-[#2596d6]",
  dark:    "bg-[#101010] text-white",
};
export function Badge({ tone = "neutral", dot, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full", BADGE[tone], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

/* ----------------------------- Field ---------------------------- */
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  className?: string;
}
export function Field({ label, error, icon, className, ...props }: FieldProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-[13px] font-medium text-[#111111] block">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none">{icon}</span>}
        <input
          className={cx(
            "w-full bg-[#f3f5fb] rounded-[14px] h-11 text-[14px] text-[#111111] placeholder:text-[#9ca3af] border-0 outline-none transition-all focus:bg-[#eef1fe] focus:ring-2",
            icon ? "pl-11 pr-4" : "px-4",
            error ? "ring-2 ring-[#e0a3a3]" : "focus:ring-[#4f6ef7]/25",
            className
          )}
          {...props}
        />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="text-[12px] text-[#c0392b] flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------- StatCard --------------------------- */
type ChipTone = "neutral" | "brand" | "accent" | "yellow" | "green" | "sky" | "dark" | "success" | "warning" | "danger" | "info";
const CHIP: Record<ChipTone, string> = {
  neutral: "bg-[#eef1fe] text-[#4f6ef7]",
  brand:   "bg-[#eef1fe] text-[#4f6ef7]",
  accent:  "bg-[#eef1fe] text-[#4f6ef7]",
  info:    "bg-[#eef1fe] text-[#4f6ef7]",
  yellow:  "bg-[#fff3c4] text-[#a16207]",
  warning: "bg-[#fff3c4] text-[#a16207]",
  green:   "bg-[#e9f8ec] text-[#2f8f4e]",
  success: "bg-[#e9f8ec] text-[#2f8f4e]",
  sky:     "bg-[#e3f3fd] text-[#2596d6]",
  dark:    "bg-[#101010] text-white",
  danger:  "bg-[#fdeaea] text-[#c0392b]",
};
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: ChipTone;
  index?: number;
}
export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, hint, tone = "neutral", index = 0 }) => (
  <Card initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, ...spring }} className="p-5">
    <div className="flex items-start justify-between">
      <span className={cx("w-11 h-11 rounded-2xl flex items-center justify-center", CHIP[tone])}>{icon}</span>
      {hint}
    </div>
    <div className="text-[28px] font-semibold tracking-tight text-[#111111] leading-none tabular-nums mt-5">{value}</div>
    <div className="text-[13px] text-[#6b7280] mt-1.5">{label}</div>
  </Card>
);

/* ------------------------- SectionTitle ------------------------- */
export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h3 className="text-[15px] font-semibold text-[#111111] tracking-tight">{title}</h3>
        {subtitle && <p className="text-[13px] text-[#6b7280] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
// Back-compat alias
export const SectionHeading = ({ title, action }: { title: string; action?: React.ReactNode }) => (
  <SectionTitle title={title} action={action} />
);

/* -------------------------- AvatarGroup ------------------------- */
export function AvatarGroup({ avatars, size = 28, max = 4, ring = "ring-white" }: {
  avatars: string[]; size?: number; max?: number; ring?: string;
}) {
  const shown = avatars.slice(0, max);
  const extra = avatars.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((a, i) => (
        <img key={i} src={a} referrerPolicy="no-referrer" alt="" style={{ width: size, height: size, marginLeft: i === 0 ? 0 : -size / 3 }}
          className={cx("rounded-full object-cover ring-2", ring)} />
      ))}
      {extra > 0 && (
        <span style={{ width: size, height: size, marginLeft: -size / 3 }}
          className={cx("rounded-full bg-[#101010] text-white text-[10px] font-semibold flex items-center justify-center ring-2", ring)}>
          +{extra}
        </span>
      )}
    </div>
  );
}

/* -------------------------- QuickAction ------------------------- */
export function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <motion.button
      whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }} transition={spring} onClick={onClick}
      className="flex items-center gap-3 px-3.5 h-12 rounded-[14px] bg-[#f3f5fb] hover:bg-[#eef1fe] transition-colors cursor-pointer text-left w-full"
    >
      <span className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#4f6ef7] shrink-0 shadow-float">{icon}</span>
      <span className="text-[13px] font-medium text-[#111111]">{label}</span>
    </motion.button>
  );
}

/* ----------------------------- Modal ---------------------------- */
export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
          <motion.div initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }} transition={spring}
            className="relative bg-white rounded-[22px] shadow-[0_24px_60px_rgba(15,23,42,0.22)] w-full max-w-md overflow-hidden">
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#ececec]">
                <h3 className="text-[15px] font-semibold text-[#111111]">{title}</h3>
                <button onClick={onClose} className="text-[#9ca3af] hover:text-[#111111] transition-colors cursor-pointer"><X size={18} /></button>
              </div>
            )}
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="px-6 py-4 bg-[#f7f8fc] border-t border-[#ececec] flex justify-end gap-2.5">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* --------------------------- EmptyState ------------------------- */
export function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-[#f3f5fb] flex items-center justify-center text-[#9ca3af] mb-4">{icon}</div>
      <p className="text-[15px] font-semibold text-[#111111]">{title}</p>
      {description && <p className="text-[13px] text-[#6b7280] mt-1.5 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/* ---------------------------- Skeleton -------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse bg-[#f3f5fb] rounded-xl", className)} />;
}

export { Plus };
