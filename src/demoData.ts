import { CRMLead, Campaign } from "./types";
import { makeAvatarUrl } from "./lib/avatar";

// Realistic sample data so the dashboard/CRM/analytics never look empty
// (used when the DB is unreachable or the account has no leads yet).
const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

function lead(p: Partial<CRMLead> & { name: string }): CRMLead {
  return {
    id: `demo-${p.name.toLowerCase().replace(/\s+/g, "-")}`,
    phone: "",
    status: "Nuevo",
    origin: "WhatsApp",
    lastInteraction: ago(60),
    createdAt: ago(120),
    score: 60,
    notes: "",
    avatar: makeAvatarUrl(p.name),
    totalSpent: 0,
    conversationHistory: [],
    ...p,
  };
}

export const DEMO_LEADS: CRMLead[] = [
  lead({ name: "Martina Gómez", origin: "WhatsApp", status: "Cerrado", score: 96, totalSpent: 145000, category: "Zapatillas", lastInteraction: ago(35), createdAt: ago(40),
    notes: "Compró Adidas Ultraboost talle 38. Pagó por transferencia.",
    conversationHistory: [
      { role: "user", text: "Hola! tenés las ultraboost en 38?", timestamp: ago(50) },
      { role: "model", text: "¡Hola Martina! Sí, las tenemos en 38. Salen $145.000. ¿Te las reservo?", timestamp: ago(49) },
      { role: "user", text: "dale, las quiero", timestamp: ago(40) },
    ] }),
  lead({ name: "Joaquín Pérez", origin: "Instagram", status: "Presupuestado", score: 88, totalSpent: 0, category: "Camperas", lastInteraction: ago(15), createdAt: ago(90),
    notes: "Interesado en campera de cuero. Le pasé precio, lo está pensando." }),
  lead({ name: "Valentina Ruiz", origin: "WhatsApp", status: "Contactado", score: 79, category: "Calzado", lastInteraction: ago(8), createdAt: ago(45),
    notes: "Preguntó por botines, sigue charlando con el bot." }),
  lead({ name: "Lucas Fernández", origin: "Facebook", status: "Nuevo", score: 72, lastInteraction: ago(5), createdAt: ago(5),
    notes: "Recién consultó por envíos al interior." }),
  lead({ name: "Sofía Castro", origin: "Email", status: "Cerrado", score: 94, totalSpent: 98000, category: "Accesorios", lastInteraction: ago(180), createdAt: ago(300),
    notes: "Compra recurrente. Cliente VIP." }),
  lead({ name: "Mateo Díaz", origin: "Instagram", status: "Presupuestado", score: 85, category: "Zapatillas", lastInteraction: ago(25), createdAt: ago(70),
    notes: "Quiere Nike Air Max, consultó cuotas." }),
  lead({ name: "Camila Torres", origin: "WhatsApp", status: "Contactado", score: 68, lastInteraction: ago(120), createdAt: ago(130),
    notes: "Consulta general de catálogo." }),
  lead({ name: "Benjamín Silva", origin: "WhatsApp", status: "Nuevo", score: 61, lastInteraction: ago(2), createdAt: ago(2),
    notes: "Acaba de escribir por una promo." }),
];

export const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: "demo-camp-1", name: "Hot Sale Lanzamiento", template: "¡Hola {{nombre}}! 🔥 Arrancó el Hot Sale con 30% off. ¿Querés que te muestre lo nuevo?",
    segment: "Todos los contactos", status: "Completado",
    sentCount: 320, readCount: 268, repliesCount: 74, dateCreated: ago(2880),
  },
  {
    id: "demo-camp-2", name: "Recordatorio carritos", template: "Hola {{nombre}}, ¿seguís interesado/a? Te guardo el producto un ratito más 😊",
    segment: "Carritos abandonados", status: "Completado",
    sentCount: 95, readCount: 71, repliesCount: 22, dateCreated: ago(5760),
  },
];
