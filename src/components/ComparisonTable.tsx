import React from "react";
import { Check, X, ShieldAlert, Sparkles, Zap, Award } from "lucide-react";

export default function ComparisonTable() {
  const ROWS = [
    {
      feature: "Tipo de respuestas",
      bot: "Predefinidas, rígidas y basadas en botones fijos",
      respondo: "Contextuales, inteligentes y fluidas con Procesamiento del Lenguaje Natural",
      isRespondoWin: true
    },
    {
      feature: "Entrenamiento",
      bot: "Carga manual de palabras clave y flujos rígidos por el usuario",
      respondo: "Entrenado a medida por especialistas de Respondo con tu catálogo y PDFs",
      isRespondoWin: true
    },
    {
      feature: "Integración de datos",
      bot: "Nula o muy limitada",
      respondo: "Conexión directa en tiempo real con stock de tiendas (TiendaNube, Shopify, etc.)",
      isRespondoWin: true
    },
    {
      feature: "Comprensión de audios (WhatsApp)",
      bot: "No entiende audios (pide escribir en texto)",
      respondo: "Transcribe y comprende audios enviados por los clientes de forma nativa",
      isRespondoWin: true
    },
    {
      feature: "Interpretación de imágenes",
      bot: "No comprende fotos ni comprobantes de pago",
      respondo: "Analiza imágenes adjuntas enviadas por el cliente (ej: fotos de productos)",
      isRespondoWin: true
    },
    {
      feature: "CRM Nativo de Ventas",
      bot: "No tiene (requiere contratar herramientas adicionales)",
      respondo: "Incluye embudo de ventas, etiquetas, listas de difusión y notas internas",
      isRespondoWin: true
    },
    {
      feature: "Seguimientos Automáticos",
      bot: "No recontacta proactivamente ante abandonos",
      respondo: "Recontacta automáticamente de manera amigable para recuperar ventas",
      isRespondoWin: true
    },
    {
      feature: "Envíos Masivos Seguros",
      bot: "No soporta o arriesga bloqueos por usar herramientas no oficiales",
      respondo: "Envíos masivos 100% seguros a través de la API Oficial de Meta (WhatsApp Business)",
      isRespondoWin: true
    },
    {
      feature: "Optimización de Meta Ads",
      bot: "Sin conexión con publicidad",
      respondo: "Meta Conversions API (CAPI) nativa para optimizar el CPA de tus campañas",
      isRespondoWin: true
    },
    {
      feature: "Modelo de Soporte y Setup",
      bot: "Autoservicio (el cliente configura todo solo)",
      respondo: "Modelo 'Llave en Mano' (nuestro equipo configura, entrena y optimiza todo)",
      isRespondoWin: true
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
      
      {/* Table Header Introduction */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="font-sans font-semibold text-lg text-slate-900 flex items-center">
            <Zap className="text-blue-600 mr-2" size={18} /> ¿Por qué Respondo es Diferente?
          </h3>
          <p className="text-xs text-slate-500">Comparativa técnica contra chatbots convencionales del mercado</p>
        </div>
        <div className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[11px] font-semibold flex items-center">
          <Sparkles size={11} className="mr-1" /> Inteligencia Artificial de Última Generación
        </div>
      </div>

      {/* Comparison Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <th className="py-3 px-4 w-[25%]">Característica</th>
              <th className="py-3 px-4 w-[35%]">Chatbot Estándar</th>
              <th className="py-3 px-4 bg-blue-50/50 text-blue-750 border-l border-r border-t border-blue-200/50 w-[40%] rounded-t-xl">
                <span className="flex items-center gap-1">
                  <Award size={12} className="text-blue-600" /> Respondo AI
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {ROWS.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50 transition-colors">
                {/* Feature Column */}
                <td className="py-3.5 px-4 font-semibold text-slate-800">
                  {row.feature}
                </td>

                {/* Standard Bot Column */}
                <td className="py-3.5 px-4 text-slate-500 flex items-start gap-2">
                  <X size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <span>{row.bot}</span>
                </td>

                {/* Respondo Column */}
                <td className="py-3.5 px-4 bg-blue-50/20 border-l border-r border-blue-200/10 text-slate-700">
                  <div className="flex items-start gap-2 font-medium">
                    <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>{row.respondo}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trust Quote Footer */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-slate-500">
        <div>
          <span className="font-semibold text-slate-800 block mb-0.5">Modelo de Implementación "Llave en Mano"</span>
          <p className="text-[11px] text-slate-500">No tenés que configurar nada. Nuestro equipo de ingenieros en prompts se encarga del entrenamiento y puesta en marcha completa de tu agente de IA.</p>
        </div>
        <a
          href="https://wa.me/5491100000000?text=Hola!%20Quiero%20activar%20Respondo%20para%20mi%20negocio."
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
        >
          Iniciar Setup por WhatsApp
        </a>
      </div>

    </div>
  );
}
