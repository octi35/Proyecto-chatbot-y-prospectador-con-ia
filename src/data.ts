import { AgentConfig, CRMLead, Campaign } from "./types";

export const DEFAULT_CONFIG: AgentConfig = {
  businessName: "Zapas Outlet Argentina",
  businessType: "Zapatillas y Calzado Deportivo",
  tone: "Argentino/Cercano",
  syncStore: "TiendaNube",
  customGreeting: "¡Hola che! Qué bueno que nos contactes. Comentame qué talle y modelo de zapas estás buscando hoy y te digo el stock al toque. 🔥",
  autoFollowUpMinutes: 15,
  catalog: `- Nike Air Max 90: $120.000 (Talles 39 al 44, colores Negro y Blanco. Envíos gratis).
- Adidas Forum Low: $115.000 (Talles 37 al 43, color Blanco puro).
- Puma Suede Classic: $90.000 (Talles 36 al 45, color Azul Marino y Negro).
- Oferta Especial: 15% de descuento adicional pagando en efectivo o transferencia bancaria.`
};

export const INITIAL_LEADS: CRMLead[] = [
  {
    id: "lead-1",
    name: "Agustín Almendra",
    phone: "+54 9 11 5829-4100",
    status: "Nuevo",
    origin: "WhatsApp",
    lastInteraction: "Hace 2 min",
    score: 92,
    notes: "Interesado en Nike Air Max 90 Negras talle 42. Preguntó por envíos a Caballito.",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80",
    totalSpent: 0,
    conversationHistory: [
      { role: "user", text: "Hola che, ¿tenés stock de las Nike Air Max negras en talle 42?", timestamp: "10:42 AM" },
      { role: "model", text: "¡Hola Agustín! Sí, las tengo en stock ahora mismo. ¿Querés que te las reserve?", timestamp: "10:43 AM" },
      { role: "user", text: "Buenísimo, ¿hacen envíos a Caballito hoy y cuánto saldría?", timestamp: "10:45 AM" }
    ]
  },
  {
    id: "lead-2",
    name: "Valeria Mazza",
    phone: "+54 9 11 3290-5020",
    status: "Contactado",
    origin: "Instagram",
    lastInteraction: "Hace 15 min",
    score: 85,
    notes: "Consultó medidas de campera de cuero L. Muy interesada, espera cobrar mañana.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    totalSpent: 0,
    conversationHistory: [
      { role: "user", text: "Hola! ¿Me pasarías las medidas de hombros y mangas de la campera L?", timestamp: "10:15 AM" },
      { role: "model", text: "Hola Valeria. Sí, el talle L tiene 48cm de hombros y 64cm de mangas. Te va a quedar genial.", timestamp: "10:16 AM" }
    ]
  },
  {
    id: "lead-3",
    name: "Bautista Spinelli",
    phone: "+54 9 341 680-3211",
    status: "Presupuestado",
    origin: "Facebook",
    lastInteraction: "Hace 1 hora",
    score: 74,
    notes: "Pidió presupuesto para Combo Kyoto 15 para evento corporativo.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    totalSpent: 0,
    conversationHistory: [
      { role: "user", text: "Buenas, necesito cotización de un catering de sushi para 15 personas.", timestamp: "09:30 AM" },
      { role: "model", text: "¡Hola Bautista! Qué gusto saludarte. Te envié el pack de eventos de Kyoto. ¿Querés coordinar?", timestamp: "09:32 AM" }
    ]
  },
  {
    id: "lead-4",
    name: "Micaela Tinelli",
    phone: "+54 9 261 411-9230",
    status: "Cerrado",
    origin: "WhatsApp",
    lastInteraction: "Ayer",
    score: 100,
    notes: "Compró 1 par de Adidas Forum Low. Pagó con Mercado Pago. Envío despachado por Correo Argentino.",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
    totalSpent: 115000,
    conversationHistory: [
      { role: "user", text: "Quiero comprar las Adidas Forum blancas en talle 38.", timestamp: "Ayer" },
      { role: "model", text: "¡Dale Mica! Te paso el link de Mercado Pago para concretar.", timestamp: "Ayer" },
      { role: "user", text: "Listo, ya te transferí $115.000. Te paso mis datos de envío.", timestamp: "Ayer" }
    ]
  }
];

export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: "camp-1",
    name: "Promo Invierno 20% OFF",
    template: "¡Hola {{nombre}}! ❄️ Se vino el frío y en {{empresa}} tenemos una sorpresa. Comprando cualquier campera hoy tenés un 20% de descuento automático. ¿Te interesa ver los modelos que quedan en stock?",
    segment: "Interesados en Camperas (Talle L)",
    status: "Completado",
    sentCount: 185,
    readCount: 172,
    repliesCount: 43,
    dateCreated: "2026-06-20"
  },
  {
    id: "camp-2",
    name: "Recuperación de Carritos Abandonados",
    template: "Hola {{nombre}}, ¿cómo andás? Vimos que dejaste tu pedido a medias en nuestra tienda. 🛒 Te guardamos el stock de tu producto por 24 hs adicionales. ¿Querés que te ayudemos a concretar la compra con envío gratis?",
    segment: "Clientes con Carrito Incompleto",
    status: "Borrador",
    sentCount: 0,
    readCount: 0,
    repliesCount: 0,
    dateCreated: "2026-06-23"
  }
];
