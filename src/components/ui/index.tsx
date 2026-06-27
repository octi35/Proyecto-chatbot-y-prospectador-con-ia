import React from "react";
import { motion, AnimatePresence, type HTMLMotionProps } from "motion/react";
import { AlertCircle, X } from "lucide-react";

/**
 * Reusable UI primitives following the 21st.dev / shadcn philosophy:
 * minimal borders, subtle shadows, zinc neutrals, a single indigo accent,
 * and purposeful spring micro-interactions.
 */

const spring = { type: "spring" as const, stiffness: 400, damping: 28 };

function cx(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

/* ----------------------------- Card ----------------------------- */
interface CardProps extends HTMLMotionProps<"div"> {
  interactive?: boolean;
}
export function Card({ interactive, className, children, ...props }: CardProps) {
  return (
    <motion.div
      whileHover={interactive ? { y: -3 } : undefined}
      transition={spring}
      className={cx(
        "bg-white rounded-2xl shadow-[0_1px_2px_rgba(24,24,27,0.04),0_4px_16px_rgba(24,24,27,0.04)]",
        interactive && "cursor-pointer hover:shadow-[0_8px_30px_rgba(24,24,27,0.08)]",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------- Button ---------------------------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";
interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}
const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800",
  accent: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_6px_16px_-6px_rgba(79,70,229,0.6)]",
  secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
};
export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors cursor-pointer",
        size === "sm" ? "text-[13px] px-3 py-1.5" : "text-sm px-4 py-2.5",
        BTN_VARIANTS[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/* ----------------------------- Badge ---------------------------- */
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
  info: "bg-sky-50 text-sky-600",
  accent: "bg-indigo-50 text-indigo-600",
};
export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

/* --------------------------- StatCard --------------------------- */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: BadgeTone;
  index?: number;
}
export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, hint, tone = "accent", index = 0 }) => {
  const iconTone: Record<BadgeTone, string> = {
    neutral: "bg-zinc-100 text-zinc-500",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-500",
    info: "bg-sky-50 text-sky-600",
    accent: "bg-indigo-50 text-indigo-600",
  };
  return (
    <Card interactive initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, ...spring }} className="p-5">
      <div className="flex items-center justify-between mb-4">
        <span className={cx("w-10 h-10 rounded-xl flex items-center justify-center", iconTone[tone])}>{icon}</span>
        {hint}
      </div>
      <div className="text-[27px] font-semibold tracking-tight text-zinc-900 leading-none tabular-nums">{value}</div>
      <div className="text-[13px] text-zinc-500 mt-1.5">{label}</div>
    </Card>
  );
};

/* --------------------------- SectionHeading -------------------- */
export function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
      {action}
    </div>
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
      {label && <label className="text-[13px] font-medium text-zinc-700 block">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">{icon}</span>}
        <input
          className={cx(
            "w-full bg-white rounded-xl py-2.5 text-[14px] text-zinc-900 placeholder:text-zinc-400 shadow-[0_1px_2px_rgba(24,24,27,0.05)] ring-1 transition-all focus:outline-none focus:ring-2",
            icon ? "pl-10 pr-4" : "px-4",
            error ? "ring-red-300 focus:ring-red-400" : "ring-zinc-200 focus:ring-indigo-400",
            className
          )}
          {...props}
        />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="text-[12px] text-red-500 flex items-center gap-1"
          >
            <AlertCircle size={12} /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------- EmptyState ------------------------- */
export function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}
      className="flex flex-col items-center justify-center text-center py-14 px-6"
    >
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-4">{icon}</div>
      <p className="text-[15px] font-semibold text-zinc-900">{title}</p>
      {description && <p className="text-[13px] text-zinc-500 mt-1.5 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/* ---------------------------- Skeleton -------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse bg-zinc-100 rounded-lg", className)} />;
}

/* ----------------------------- Modal ---------------------------- */
export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={spring}
            className="relative bg-white rounded-2xl shadow-[0_24px_60px_rgba(24,24,27,0.2)] w-full max-w-md overflow-hidden"
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h3 className="text-[16px] font-semibold text-zinc-900">{title}</h3>
                <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"><X size={18} /></button>
              </div>
            )}
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="px-6 py-4 bg-zinc-50 flex justify-end gap-2.5">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
