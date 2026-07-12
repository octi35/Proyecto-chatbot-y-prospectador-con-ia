import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download, Copy, MessageCircle } from "lucide-react";
import { toast } from "./ui/toast";

const STORAGE_KEY = "respondo_wa_qr_number";
const DEFAULT_GREETING = "¡Hola! Quiero hacer una consulta 😊";

// Digits-only, like Meta expects (country code included, no + or spaces)
const digits = (s: string) => s.replace(/\D/g, "");

/**
 * QR generator for the business's WhatsApp: print it at the store, add it to
 * Instagram bio or flyers — customers scan it and land straight in a chat the
 * AI agent answers. Pure client-side (qrcode lib), nothing leaves the browser.
 */
export default function WhatsAppQR() {
  const [number, setNumber] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
  });
  const [greeting, setGreeting] = useState(DEFAULT_GREETING);
  const [qrUrl, setQrUrl] = useState<string>("");

  const waLink = useMemo(() => {
    const n = digits(number);
    if (n.length < 8) return "";
    return `https://wa.me/${n}?text=${encodeURIComponent(greeting.trim() || DEFAULT_GREETING)}`;
  }, [number, greeting]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, number); } catch { /* ignore */ }
    if (!waLink) { setQrUrl(""); return; }
    QRCode.toDataURL(waLink, { width: 480, margin: 2, color: { dark: "#0a0a0a", light: "#ffffff" } })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));
  }, [waLink, number]);

  const download = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = "qr-whatsapp-respondo.png";
    a.click();
    toast.success("QR descargado", "Imprimilo en tu local o subilo a tus redes.");
  };

  const copyLink = async () => {
    if (!waLink) return;
    try {
      await navigator.clipboard.writeText(waLink);
      toast.success("Link copiado", "Pegalo en tu bio de Instagram, web o donde quieras.");
    } catch {
      toast.error("No se pudo copiar", waLink);
    }
  };

  return (
    <div className="bg-white rounded-[16px] p-6 shadow-card">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-[14px] bg-[#101010] flex items-center justify-center text-white shadow-card">
          <QrCode size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-[18px] tracking-tight text-[#111111]">QR de tu WhatsApp</h3>
          <p className="text-[12.5px] text-[#6b7280]">Tus clientes lo escanean y le escriben directo a tu agente. Ideal para el mostrador, folletos y redes.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-5 items-start">
        {/* Config */}
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[#6b7280] block mb-1.5">Tu número de WhatsApp (con código de país)</label>
            <input
              type="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ej: 54 9 11 1234 5678"
              className="w-full bg-[#f4f4f5] border border-transparent rounded-[12px] px-4 h-11 text-[14px] text-[#111111] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#4f6ef7] transition-colors"
            />
            <p className="text-[10.5px] text-[#9ca3af] mt-1">Es el número conectado a tu agente. Solo números — los espacios y guiones se ignoran.</p>
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#6b7280] block mb-1.5">Mensaje con el que arranca el chat</label>
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              maxLength={120}
              className="w-full bg-[#f4f4f5] border border-transparent rounded-[12px] px-4 h-11 text-[14px] text-[#111111] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#4f6ef7] transition-colors"
            />
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={download}
              disabled={!qrUrl}
              className="flex-1 h-10 rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] disabled:opacity-40 text-white text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Download size={15} /> Descargar QR
            </button>
            <button
              onClick={copyLink}
              disabled={!waLink}
              className="flex-1 h-10 rounded-[10px] bg-white border border-black/[0.1] hover:bg-[#fafafa] disabled:opacity-40 text-[#111111] text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Copy size={15} /> Copiar link
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center justify-center bg-[#f7f8fc] rounded-[14px] p-6 min-h-[240px]">
          {qrUrl ? (
            <>
              <img src={qrUrl} alt="QR de WhatsApp del negocio" className="w-44 h-44 rounded-lg bg-white p-2 shadow-card" />
              <p className="text-[11.5px] text-[#6b7280] mt-3 flex items-center gap-1.5">
                <MessageCircle size={12} className="text-[#4caf4c]" /> Escanealo con tu cámara para probarlo
              </p>
            </>
          ) : (
            <div className="text-center">
              <QrCode size={36} className="text-[#d4d4d8] mx-auto mb-2" />
              <p className="text-[13px] text-[#9ca3af] max-w-[220px]">Ingresá tu número y el QR aparece acá al instante.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
