import React from "react";
import { motion, AnimatePresence, type HTMLMotionProps } from "motion/react";
import { AlertCircle, X, Plus } from "lucide-react";

/**
 * Restrained premium primitives (Linear / Vercel / Stripe caliber).
 * Near-monochrome. One accent (#4f46e5) used sparingly. Depth from
 * hairlines + whisper shadows, generous whitespace, refined type.
 */

const spring = { type: "spring" as const, stiffness: 400, damping: 34 };
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
      whileHover={interactive ? { y: -1 } : undefined}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={cx(
        "bg-white rounded-[16px] border border-black/[0.07] ds-shadow",
        interactive && "cursor-pointer hover:border-black/[0.12]",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------- Button ---------------------------- */
type ButtonVariant = "primary" | "brand" | "secondary" | "ghost";
interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}
const BTN: Record<ButtonVariant, string> = {
  primary: "bg-[#0a0a0a] text-white hover:bg-[#262626]",
  brand: "bg-[#4f46e5] text-white hover:bg-[#4338ca]",
  secondary: "bg-white text-[#0a0a0a] border border-black/[0.09] hover:bg-[#fafafa]",
  ghost: "text-[#71717a] hover:bg-black/[0.04] hover:text-[#0a0a0a]",
};
export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-colors duration-150 cursor-pointer",
        size === "sm" ? "text-[13px] px-3.5 h-8" : "text-[13.5px] px-4 h-10",
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
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";
const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-black/[0.05] text-[#52525b]",
  success: "bg-[#f0fdf4] text-[#16794c] ring-1 ring-[#16794c]/10",
  warning: "bg-[#fefce8] text-[#a16207] ring-1 ring-[#a16207]/10",
  danger: "bg-[#fef2f2] text-[#b91c1c] ring-1 ring-[#b91c1c]/10",
  info: "bg-[#eff6ff] text-[#1d4ed8] ring-1 ring-[#1d4ed8]/10",
  brand: "bg-[#eef1ff] text-[#4f46e5] ring-1 ring-[#4f46e5]/10",
};
export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md", BADGE[tone], className)}>
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
      {label && <label className="text-[13px] font-medium text-[#0a0a0a] block">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] pointer-events-none">{icon}</span>}
        <input
          className={cx(
            "w-full bg-white rounded-[10px] h-10 text-[14px] text-[#0a0a0a] placeholder:text-[#a1a1aa] border transition-all focus:outline-none",
            icon ? "pl-10 pr-3.5" : "px-3.5",
            error ? "border-[#e0a3a3] focus:border-[#d05a5a]" : "border-black/[0.1] focus:border-[#4f46e5] focus:ring-[3px] focus:ring-[#4f46e5]/10",
            className
          )}
          {...props}
        />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="text-[12px] text-[#b91c1c] flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
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
export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, hint, index = 0 }) => (
  <Card initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, ...spring }} className="p-5">
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[#71717a] font-medium flex items-center gap-2">
        <span className="text-[#a1a1aa]">{icon}</span>{label}
      </span>
      {hint}
    </div>
    <div className="text-[30px] font-semibold tracking-tight text-[#0a0a0a] leading-none tabular-nums mt-4">{value}</div>
  </Card>
);

/* ------------------------- SectionTitle ------------------------- */
export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h3 className="text-[15px] font-semibold text-[#0a0a0a] tracking-tight">{title}</h3>
        {subtitle && <p className="text-[13px] text-[#71717a] mt-0.5">{subtitle}</p>}
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
export function AvatarGroup({ avatars, size = 26, max = 4, ring = "ring-white" }: {
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
          className={cx("rounded-full bg-black/[0.05] text-[#71717a] text-[10px] font-semibold flex items-center justify-center ring-2", ring)}>
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
      whileTap={{ scale: 0.98 }} transition={spring} onClick={onClick}
      className="flex items-center gap-2.5 px-3.5 h-11 rounded-[10px] border border-black/[0.07] bg-white hover:bg-[#fafafa] hover:border-black/[0.12] transition-colors cursor-pointer text-left"
    >
      <span className="text-[#71717a]">{icon}</span>
      <span className="text-[13px] font-medium text-[#0a0a0a]">{label}</span>
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
            className="relative bg-white rounded-[16px] border border-black/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.16)] w-full max-w-md overflow-hidden">
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.07]">
                <h3 className="text-[15px] font-semibold text-[#0a0a0a]">{title}</h3>
                <button onClick={onClose} className="text-[#a1a1aa] hover:text-[#0a0a0a] transition-colors cursor-pointer"><X size={18} /></button>
              </div>
            )}
            <div className="px-5 py-5">{children}</div>
            {footer && <div className="px-5 py-4 bg-[#fafafa] border-t border-black/[0.07] flex justify-end gap-2.5">{footer}</div>}
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
      <div className="w-12 h-12 rounded-[12px] border border-black/[0.07] bg-[#fafafa] flex items-center justify-center text-[#a1a1aa] mb-4">{icon}</div>
      <p className="text-[15px] font-semibold text-[#0a0a0a]">{title}</p>
      {description && <p className="text-[13px] text-[#71717a] mt-1.5 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/* ---------------------------- Skeleton -------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse bg-black/[0.05] rounded-md", className)} />;
}

export { Plus };
