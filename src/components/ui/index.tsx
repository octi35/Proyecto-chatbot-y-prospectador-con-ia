import React from "react";
import { motion, type HTMLMotionProps } from "motion/react";

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
