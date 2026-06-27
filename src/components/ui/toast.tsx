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
  success: { icon: <CheckCircle2 size={18} />, color: "text-emerald-600", ring: "ring-emerald-100" },
  error: { icon: <AlertCircle size={18} />, color: "text-red-600", ring: "ring-red-100" },
  info: { icon: <Info size={18} />, color: "text-indigo-600", ring: "ring-indigo-100" },
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
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`pointer-events-auto bg-white rounded-2xl p-3.5 flex items-start gap-3 shadow-[0_8px_30px_rgba(24,24,27,0.12)] ring-1 ${tone.ring}`}
            >
              <span className={`${tone.color} shrink-0 mt-0.5`}>{tone.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-zinc-900 leading-snug">{t.title}</p>
                {t.description && <p className="text-[12.5px] text-zinc-500 mt-0.5 leading-snug">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-zinc-300 hover:text-zinc-600 transition-colors shrink-0 cursor-pointer">
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
