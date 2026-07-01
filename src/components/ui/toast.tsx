import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * Lightweight, dependency-free toast system with a module-level store so any
 * component (or non-React code) can trigger a toast via `toast.success(...)`.
 * Render <Toaster /> once at the app root.
 */

export type ToastTone = "success" | "error" | "info";
interface ToastItem { id: number; tone: ToastTone; title: string; description?: string }

let listeners: ((items: ToastItem[]) => void)[] = [];
let items: ToastItem[] = [];
let seq = 0;

function emit() { listeners.forEach((l) => l([...items])); }
function push(tone: ToastTone, title: string, description?: string) {
  const id = ++seq;
  items = [...items, { id, tone, title, description }];
  emit();
  setTimeout(() => dismiss(id), 4500);
}
function dismiss(id: number) { items = items.filter((t) => t.id !== id); emit(); }

export const toast = {
  success: (title: string, description?: string) => push("success", title, description),
  error: (title: string, description?: string) => push("error", title, description),
  info: (title: string, description?: string) => push("info", title, description),
};

const TONE = {
  success: { icon: <CheckCircle2 size={18} />, chip: "bg-[#e9f8ec] text-[#2f8f4e]" },
  error: { icon: <AlertCircle size={18} />, chip: "bg-[#fdeaea] text-[#c0392b]" },
  info: { icon: <Info size={18} />, chip: "bg-[#eef1fe] text-[#4f6ef7]" },
};

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.push(setList);
    return () => { listeners = listeners.filter((l) => l !== setList); };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 w-[340px] max-w-[calc(100vw-2.5rem)] pointer-events-none">
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const tone = TONE[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="pointer-events-auto bg-white rounded-[18px] p-3.5 flex items-start gap-3 shadow-[0_12px_40px_rgba(15,23,42,0.14)]"
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone.chip}`}>{tone.icon}</span>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[13.5px] font-medium text-[#111111] leading-snug">{t.title}</p>
                {t.description && <p className="text-[12.5px] text-[#6b7280] mt-0.5 leading-snug">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-[#cbd0e0] hover:text-[#6b7280] transition-colors shrink-0 cursor-pointer">
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
