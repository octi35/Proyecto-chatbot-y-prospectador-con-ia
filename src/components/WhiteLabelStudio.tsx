import React, { useState } from "react";
import { 
  Briefcase, 
  Settings, 
  Upload, 
  Globe, 
  Check, 
  Sparkles, 
  Code, 
  ShoppingBag, 
  CreditCard, 
  Calendar, 
  HelpCircle,
  Building
} from "lucide-react";

// List of integrations from the product specifications
const INTEGRATION_LIST = [
  {
    name: "TiendaNube",
    category: "E-commerce",
    desc: "Sincroniza stock, precios y genera links de carritos de compra automáticamente.",
    logo: "https://images.unsplash.com/photo-1472851294608-062f824d296e?w=80&auto=format&fit=crop&q=80",
    status: "Conectado"
  },
  {
    name: "Shopify",
    category: "E-commerce",
    desc: "Conexión en tiempo real con catálogo de productos y variantes de talle/color.",
    logo: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&auto=format&fit=crop&q=80",
    status: "Disponible"
  },
  {
    name: "WooCommerce",
    category: "E-commerce",
    desc: "Sincroniza inventario para sitios WordPress de forma directa y segura.",
    logo: "https://images.unsplash.com/photo-1563013544-824ae1d704d3?w=80&auto=format&fit=crop&q=80",
    status: "Disponible"
  },
  {
    name: "Mercado Pago",
    category: "Pagos",
    desc: "Genera links de cobro en pesos (Argentina) directo en el chat para cerrar la venta.",
    logo: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=80&auto=format&fit=crop&q=80",
    status: "Conectado"
  },
  {
    name: "Google Calendar",
    category: "Calendarios",
    desc: "Permite agendar turnos, reuniones o asesorías directo desde WhatsApp.",
    logo: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=80&auto=format&fit=crop&q=80",
    status: "Conectado"
  },
  {
    name: "Tokko Broker",
    category: "Inmobiliaria",
    desc: "Consulta propiedades disponibles y agenda visitas para inmobiliarias.",
    logo: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=80&auto=format&fit=crop&q=80",
    status: "Disponible"
  },
  {
    name: "Meta API (Oficial)",
    category: "Mensajería",
    desc: "API Oficial de WhatsApp Business Cloud. Envío masivo sin riesgo de baneo.",
    logo: "https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=80&auto=format&fit=crop&q=80",
    status: "Conectado"
  },
  {
    name: "Model Context Protocol",
    category: "Protocolo IA",
    desc: "Integración segura con bases de datos y ERPs de la empresa utilizando MCP.",
    logo: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=80&auto=format&fit=crop&q=80",
    status: "Conectado"
  }
];

export default function WhiteLabelStudio() {
  const [partnerBrand, setPartnerBrand] = useState("Agencia Click Ventas");
  const [partnerDomain, setPartnerDomain] = useState("ia.clickventas.com");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [whiteLabelActive, setWhiteLabelActive] = useState(false);
  const [integrations, setIntegrations] = useState(INTEGRATION_LIST);

  const handleToggleIntegration = (name: string) => {
    setIntegrations((prev) =>
      prev.map((it) => {
        if (it.name === name) {
          const nextStatus = it.status === "Conectado" ? "Disponible" : "Conectado";
          return { ...it, status: nextStatus };
        }
        return it;
      })
    );
  };

  const handleSaveWhiteLabel = (e: React.FormEvent) => {
    e.preventDefault();
    setWhiteLabelActive(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Integrations Grid Left (7 columns) */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div>
          <h3 className="font-sans font-semibold text-base text-slate-900">Integraciones Nativas</h3>
          <p className="text-xs text-slate-500">Conectá de manera segura las bases de datos de tu tienda e inventario</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {integrations.map((it) => (
            <div
              key={it.name}
              className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 hover:border-slate-300 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white border border-slate-200">
                <img
                  referrerPolicy="no-referrer"
                  src={it.logo}
                  alt={it.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 block truncate">{it.name}</span>
                  <span className="text-[8px] bg-white text-slate-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider border border-slate-200 font-bold">
                    {it.category}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  {it.desc}
                </p>
                <button
                  onClick={() => handleToggleIntegration(it.name)}
                  className={`mt-2.5 py-1 px-3 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                    it.status === "Conectado"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {it.status === "Conectado" ? "Conectado ✓" : "Conectar +"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* White Label Customizer Right (5 columns) */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
              <Briefcase size={18} />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-sm text-slate-900">Portal White Label / Marca Blanca</h3>
              <p className="text-xs text-slate-500">Revende Respondo bajo tu propia marca de agencia</p>
            </div>
          </div>

          <form onSubmit={handleSaveWhiteLabel} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Nombre de Tu Agencia / Marca</label>
              <input
                type="text"
                value={partnerBrand}
                onChange={(e) => setPartnerBrand(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Ej: Agencia Digital Nova"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Dominio Personalizado (CNAME)</label>
              <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors">
                <span className="bg-slate-100 px-3 py-2 text-xs text-slate-500 font-mono border-r border-slate-250 flex items-center">
                  https://
                </span>
                <input
                  type="text"
                  value={partnerDomain}
                  onChange={(e) => setPartnerDomain(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-800 focus:outline-none"
                  placeholder="ia.tuagencia.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Color Primario del Panel</label>
              <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded-xl p-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs font-mono text-slate-600">{accentColor}</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Guardar y Rebrandear Portal
            </button>
          </form>

          {whiteLabelActive && (
            <div className="p-3.5 bg-purple-50 border border-purple-100 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                Vista de Reventa Activada
              </span>
              <p className="text-[10px] text-purple-900 leading-normal">
                Tus clientes ahora verán el panel con el título <strong className="text-purple-950">{partnerBrand}</strong> y accederán desde el subdominio <strong className="text-purple-950">{partnerDomain}</strong>. El logo original de Respondo ha sido ocultado de sus entornos de producción.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[10px] text-slate-600 leading-relaxed flex items-start gap-2">
          <Globe size={14} className="text-blue-600 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-800 block mb-0.5">Soporte Técnico 24/7 de Marca Blanca:</strong>
            Atendemos a tus clientes en nombre de tu agencia por correo, chat o WhatsApp, resolviendo incidencias sin revelar la marca originaria. Margen de ganancia sugerido para partners: 40% al 60%.
          </span>
        </div>

      </div>

    </div>
  );
}
