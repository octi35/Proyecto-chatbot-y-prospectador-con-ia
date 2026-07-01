import React from "react";
import { motion, AnimatePresence, type HTMLMotionProps } from "motion/react";
import { AlertCircle, X, Plus } from "lucide-react";

/**
 * Premium design-system primitives (Salesforce-style reference).
 * Palette: bg #F7F8FC · card #FFF · ink #111 · muted #6B7280 · line #ECECEC
 * Accents: brand #4F6EF7 · yellow #FFD84D · black #101010 · sky #8FD4F8 · green #7DD87D
 * Cards: radius 22px, shadow 0 10px 35px rgba(0,0,0,.05), hover translateY(-2px).
 */

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };
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
        "bg-white rounded-[22px] ds-shadow",
        interactive && "cursor-pointer hover:ds-shadow-hover",
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
  primary: "bg-[#101010] text-white hover:brightness-125",
  brand: "bg-[#4f6ef7] text-white hover:brightness-110",
  secondary: "bg-[#f3f4f8] text-[#111] hover:bg-[#e9ebf2]",
  ghost: "text-[#6b7280] hover:bg-[#f3f4f8] hover:text-[#111]",
};
export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 cursor-pointer",
        size === "sm" ? "text-[13px] px-4 h-9" : "text-[14px] px-5 h-[42px]",
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
  neutral: "bg-[#f3f4f8] text-[#6b7280]",
  success: "bg-[#eafaea] text-[#3f9f3f]",
  warning: "bg-[#fff7e0] text-[#a67c00]",
  danger: "bg-[#fdecec] text-[#d9534f]",
  info: "bg-[#e8f6fe] text-[#3a9fd4]",
  brand: "bg-[#eef1fe] text-[#4f6ef7]",
};
export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full", BADGE[tone], className)}>
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
      {label && <label className="text-[13px] font-medium text-[#111] block">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9aa0ab] pointer-events-none">{icon}</span>}
        <input
          className={cx(
            "w-full bg-[#f3f4f8] rounded-[14px] py-2.5 text-[14px] text-[#111] placeholder:text-[#9aa0ab] transition-all focus:outline-none focus:ring-2",
            icon ? "pl-11 pr-4" : "px-4",
            error ? "ring-2 ring-[#f3b0ae]" : "ring-0 focus:ring-[#c9d3fd]",
            className
          )}
          {...props}
        />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="text-[12px] text-[#d9534f] flex items-center gap-1">
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
const ICON_TONE: Record<BadgeTone, string> = {
  neutral: "bg-[#f3f4f8] text-[#6b7280]",
  success: "bg-[#eafaea] text-[#3f9f3f]",
  warning: "bg-[#fff7e0] text-[#a67c00]",
  danger: "bg-[#fdecec] text-[#d9534f]",
  info: "bg-[#e8f6fe] text-[#3a9fd4]",
  brand: "bg-[#eef1fe] text-[#4f6ef7]",
};
export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, hint, tone = "brand", index = 0 }) => (
  <Card interactive initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, ...spring }} className="p-6">
    <div className="flex items-center justify-between mb-5">
      <span className={cx("w-11 h-11 rounded-2xl flex items-center justify-center", ICON_TONE[tone])}>{icon}</span>
      {hint}
    </div>
    <div className="text-[28px] font-semibold tracking-tight text-[#111] leading-none tabular-nums">{value}</div>
    <div className="text-[13px] text-[#6b7280] mt-2">{label}</div>
  </Card>
);

/* ------------------------- SectionTitle ------------------------- */
export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <h3 className="text-[16px] font-semibold text-[#111]">{title}</h3>
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
          className={cx("rounded-full bg-[#f3f4f8] text-[#6b7280] text-[10px] font-semibold flex items-center justify-center ring-2", ring)}>
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
      whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={spring} onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#f7f8fc] hover:bg-[#eef1fe] transition-colors cursor-pointer group"
    >
      <span className="w-10 h-10 rounded-xl bg-white ds-shadow flex items-center justify-center text-[#4f6ef7] group-hover:scale-105 transition-transform">{icon}</span>
      <span className="text-[12px] font-medium text-[#111]">{label}</span>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={spring}
            className="relative bg-white rounded-[22px] ds-shadow-hover w-full max-w-md overflow-hidden">
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#ececec" }}>
                <h3 className="text-[16px] font-semibold text-[#111]">{title}</h3>
                <button onClick={onClose} className="text-[#9aa0ab] hover:text-[#111] transition-colors cursor-pointer"><X size={18} /></button>
              </div>
            )}
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="px-6 py-4 bg-[#f7f8fc] flex justify-end gap-2.5">{footer}</div>}
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-[#f3f4f8] flex items-center justify-center text-[#9aa0ab] mb-4">{icon}</div>
      <p className="text-[15px] font-semibold text-[#111]">{title}</p>
      {description && <p className="text-[13px] text-[#6b7280] mt-1.5 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/* ---------------------------- Skeleton -------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse bg-[#f3f4f8] rounded-lg", className)} />;
}

export { Plus };
