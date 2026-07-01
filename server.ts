import express from "express";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import helmet from "helmet";
import cors from "cors";
import pino from "pino";
import { z, ZodError } from "zod";
import { localBotReply } from "./botEngine";
import { formatTranscript, extractJsonArray, extractJsonObject, isInside24hWindow } from "./serverHelpers";

dotenv.config();

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

// Compute lead score from conversation depth + purchase-intent keywords
function computeLeadScore(conversationLength: number, userMessages: string): number {
  const HIGH_INTENT = ["precio","cuánto","costo","comprar","reservar","disponible","quiero","necesito","envío","delivery","talle","color","stock","modelo","foto","medida"];
  const VERY_HIGH_INTENT = ["pago","transferencia","confirmar","efectivo","tarjeta","cuotas","link de pago","pagar","saldo","factura"];
  const msgLower = userMessages.toLowerCase();
  const highMatches = HIGH_INTENT.filter((kw) => msgLower.includes(kw)).length;
  const veryHighMatches = VERY_HIGH_INTENT.filter((kw) => msgLower.includes(kw)).length;
  const intentBoost = Math.min(25, highMatches * 3 + veryHighMatches * 7);
  return Math.min(98, 55 + Math.floor(conversationLength * 2.5) + intentBoost);
}

function makeAvatarUrl(name: string): string {
  const COLORS = ["#3b82f6","#8b5cf6","#ec4899","#10b981","#f59e0b","#6366f1","#ef4444","#14b8a6"];
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").substring(0, 2).toUpperCase() || "?";
  const color = COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="${color}"/><text x="20" y="26" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="white" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ---------------------------------------------------------------------------
// LOGGER
// ---------------------------------------------------------------------------
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino/file", options: { destination: 1 } }
    : undefined,
});

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const WA_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WA_APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";
const WA_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "respondo-verify-secret";
// Facebook Messenger + Instagram Direct (Meta Graph API, page-based)
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN || "";
const IG_TOKEN = process.env.IG_TOKEN || "";
// Email channel (outbound via Resend API — dependency-free)
const EMAIL_USER = process.env.EMAIL_USER || "";          // the "from" address shown to clients
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";  // outbound transactional email

// ---------------------------------------------------------------------------
// CLIENTS (lazy)
// ---------------------------------------------------------------------------
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required");
    _ai = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
  }
  return _ai;
}

// Server-privileged client. Uses the service role key when provided (bypasses
// RLS for webhooks/schedulers); falls back to the anon key otherwise.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
function getDB() {
  if (!SUPABASE_URL || !(SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);
}

// Mercado Pago: real checkout links when MP_ACCESS_TOKEN is set
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
async function createMercadoPagoLink(concepto: string, monto: number): Promise<string> {
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    body: JSON.stringify({
      items: [{ title: concepto || "Compra", quantity: 1, unit_price: monto, currency_id: "ARS" }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Mercado Pago HTTP ${res.status}: ${detail.slice(0, 150)}`);
  }
  const data: any = await res.json();
  return data.init_point || data.sandbox_init_point;
}

// ---------------------------------------------------------------------------
// ZOD SCHEMAS
// ---------------------------------------------------------------------------
const AgentConfigSchema = z.object({
  businessName: z.string().min(1).max(200),
  businessType: z.string().max(200).default(""),
  catalog: z.string().max(10000).default(""),
  tone: z.string().max(100).default("Argentino/Cercano"),
  logoUrl: z.string().url().optional().or(z.literal("")),
  customGreeting: z.string().max(500).optional(),
  autoFollowUpMinutes: z.number().int().positive().max(10080).optional(),
  syncStore: z.enum(["Ninguna","TiendaNube","Shopify","WooCommerce","MercadoLibre"]).optional(),
  botPersonaName: z.string().max(100).optional(),
  forbiddenTopics: z.string().max(1000).optional(),
  workingHoursStart: z.number().int().min(0).max(23).optional(),
  workingHoursEnd: z.number().int().min(0).max(23).optional(),
  quickReplies: z.array(z.string().max(200)).max(20).optional(),
  strictMode: z.boolean().optional(),
});

const ChatSchema = z.object({
  message: z.string().max(4000).default(""),
  history: z.array(z.object({ role: z.enum(["user","model"]), text: z.string().max(4000) })).max(100).optional(),
  agentConfig: AgentConfigSchema.optional(),
  attachment: z.object({ data: z.string(), mimeType: z.string().max(100) }).optional(),
});

const LeadPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional(),
  status: z.enum(["Nuevo","Contactado","Presupuestado","Cerrado"]).optional(),
  origin: z.enum(["WhatsApp","Instagram","Facebook","Email"]).optional(),
  lastInteraction: z.string().max(100).optional(),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
  category: z.string().max(100).optional().nullable(),
  avatar: z.string().max(500).optional(),
  totalSpent: z.number().min(0).optional(),
  aiPaused: z.boolean().optional(),
  assignedTo: z.string().max(200).optional().nullable(),
  conversationHistory: z.array(z.object({
    role: z.enum(["user","model"]),
    text: z.string(),
    timestamp: z.string(),
  })).optional(),
});

const LeadCreateSchema = LeadPatchSchema.extend({
  name: z.string().min(1).max(200),
});

const CampaignPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  template: z.string().max(2000).optional(),
  segment: z.string().max(200).optional(),
  status: z.enum(["Borrador","Enviando","Completado"]).optional(),
  sentCount: z.number().int().min(0).optional(),
  readCount: z.number().int().min(0).optional(),
  repliesCount: z.number().int().min(0).optional(),
  dateCreated: z.string().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  mediaUrl: z.string().url().optional().nullable().or(z.literal("")),
  mediaType: z.enum(["image","video","document"]).optional().nullable(),
});

const AutomationSchema = z.object({
  name: z.string().min(1).max(200),
  enabled: z.boolean().optional(),
  trigger: z.enum(["new_lead","lead_stale","high_score","status_closed","keyword_match"]),
  triggerValue: z.string().max(200).optional().nullable(),
  action: z.enum(["send_followup","notify","move_stage","tag_lead"]),
  actionValue: z.string().max(500).optional().nullable(),
});

const AutomationPatchSchema = AutomationSchema.partial();

// ---------------------------------------------------------------------------
// DB MAPPING HELPERS
// ---------------------------------------------------------------------------
function mapLeadFromDB(row: any) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    status: row.status,
    origin: row.origin,
    lastInteraction: row.last_interaction,
    createdAt: row.created_at ?? undefined,
    score: row.score,
    notes: row.notes,
    category: row.category ?? undefined,
    avatar: row.avatar,
    totalSpent: parseFloat(row.total_spent) || 0,
    aiPaused: row.ai_paused ?? false,
    assignedTo: row.assigned_to ?? undefined,
    conversationHistory: row.conversation_history || [],
  };
}

function mapLeadToDB(data: any) {
  const out: any = {};
  if (data.name !== undefined) out.name = data.name;
  if (data.phone !== undefined) out.phone = data.phone;
  if (data.status !== undefined) out.status = data.status;
  if (data.origin !== undefined) out.origin = data.origin;
  if (data.lastInteraction !== undefined) out.last_interaction = data.lastInteraction;
  if (data.score !== undefined) out.score = data.score;
  if (data.notes !== undefined) out.notes = data.notes;
  if (data.category !== undefined) out.category = data.category;
  if (data.avatar !== undefined) out.avatar = data.avatar;
  if (data.totalSpent !== undefined) out.total_spent = data.totalSpent;
  if (data.aiPaused !== undefined) out.ai_paused = data.aiPaused;
  if (data.assignedTo !== undefined) out.assigned_to = data.assignedTo || null;
  if (data.conversationHistory !== undefined) out.conversation_history = data.conversationHistory;
  return out;
}

function mapCampaignFromDB(row: any) {
  return {
    id: row.id,
    name: row.name,
    template: row.template,
    segment: row.segment,
    status: row.status,
    sentCount: row.sent_count,
    readCount: row.read_count,
    repliesCount: row.replies_count,
    dateCreated: row.date_created,
    scheduledAt: row.scheduled_at ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaType: row.media_type ?? undefined,
  };
}

function mapCampaignToDB(data: any) {
  const out: any = {};
  if (data.name !== undefined) out.name = data.name;
  if (data.template !== undefined) out.template = data.template;
  if (data.segment !== undefined) out.segment = data.segment;
  if (data.status !== undefined) out.status = data.status;
  if (data.sentCount !== undefined) out.sent_count = data.sentCount;
  if (data.readCount !== undefined) out.read_count = data.readCount;
  if (data.repliesCount !== undefined) out.replies_count = data.repliesCount;
  if (data.dateCreated !== undefined) out.date_created = data.dateCreated;
  if (data.scheduledAt !== undefined) out.scheduled_at = data.scheduledAt || null;
  if (data.mediaUrl !== undefined) out.media_url = data.mediaUrl || null;
  if (data.mediaType !== undefined) out.media_type = data.mediaType || null;
  return out;
}

function mapAutomationFromDB(row: any) {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    trigger: row.trigger,
    triggerValue: row.trigger_value ?? undefined,
    action: row.action,
    actionValue: row.action_value ?? undefined,
    timesTriggered: row.times_triggered ?? 0,
  };
}

function mapAutomationToDB(data: any) {
  const out: any = {};
  if (data.name !== undefined) out.name = data.name;
  if (data.enabled !== undefined) out.enabled = data.enabled;
  if (data.trigger !== undefined) out.trigger = data.trigger;
  if (data.triggerValue !== undefined) out.trigger_value = data.triggerValue || null;
  if (data.action !== undefined) out.action = data.action;
  if (data.actionValue !== undefined) out.action_value = data.actionValue || null;
  return out;
}

function mapConfigFromDB(row: any) {
  return {
    businessName: row.business_name,
    businessType: row.business_type,
    catalog: row.catalog,
    tone: row.tone,
    logoUrl: row.logo_url ?? undefined,
    customGreeting: row.custom_greeting ?? undefined,
    autoFollowUpMinutes: row.auto_follow_up_minutes,
    syncStore: row.sync_store,
    botPersonaName: row.bot_persona_name ?? undefined,
    forbiddenTopics: row.forbidden_topics ?? undefined,
    workingHoursStart: row.working_hours_start ?? undefined,
    workingHoursEnd: row.working_hours_end ?? undefined,
    quickReplies: row.quick_replies?.length ? row.quick_replies : undefined,
    strictMode: row.strict_mode ?? undefined,
  };
}

function mapConfigToDB(data: any) {
  const out: any = {};
  if (data.businessName !== undefined) out.business_name = data.businessName;
  if (data.businessType !== undefined) out.business_type = data.businessType;
  if (data.catalog !== undefined) out.catalog = data.catalog;
  if (data.tone !== undefined) out.tone = data.tone;
  if (data.logoUrl !== undefined) out.logo_url = data.logoUrl || null;
  if (data.customGreeting !== undefined) out.custom_greeting = data.customGreeting || null;
  if (data.autoFollowUpMinutes !== undefined) out.auto_follow_up_minutes = data.autoFollowUpMinutes;
  if (data.syncStore !== undefined) out.sync_store = data.syncStore;
  if (data.botPersonaName !== undefined) out.bot_persona_name = data.botPersonaName || null;
  if (data.forbiddenTopics !== undefined) out.forbidden_topics = data.forbiddenTopics || null;
  if (data.workingHoursStart !== undefined) out.working_hours_start = data.workingHoursStart;
  if (data.workingHoursEnd !== undefined) out.working_hours_end = data.workingHoursEnd;
  if (data.quickReplies !== undefined) out.quick_replies = data.quickReplies;
  if (data.strictMode !== undefined) out.strict_mode = data.strictMode;
  return out;
}

// ---------------------------------------------------------------------------
// TOOL-USE (Function Calling)
// ---------------------------------------------------------------------------
const TOOL_DECLARATIONS: any = [{
  functionDeclarations: [
    {
      name: "buscar_producto",
      description: "Busca un producto o servicio en el catálogo del negocio para confirmar precio, talles, colores y disponibilidad. Usala SIEMPRE antes de afirmar stock o precios.",
      parameters: {
        type: "OBJECT",
        properties: {
          consulta: { type: "STRING", description: "Producto o característica que busca el cliente." },
        },
        required: ["consulta"],
      },
    },
    {
      name: "registrar_lead",
      description: "Registra o actualiza un prospecto en el CRM cuando un cliente nuevo muestra interés real.",
      parameters: {
        type: "OBJECT",
        properties: {
          nombre:  { type: "STRING", description: "Nombre del cliente." },
          telefono:{ type: "STRING", description: "Teléfono del cliente. Opcional." },
          interes: { type: "STRING", description: "Resumen breve de qué le interesa." },
          canal:   { type: "STRING", description: "Canal de origen.", enum: ["WhatsApp","Instagram","Facebook"] },
        },
        required: ["nombre", "interes"],
      },
    },
    {
      name: "actualizar_estado_lead",
      description: "Mueve a un prospecto por el embudo de ventas según el avance de la conversación.",
      parameters: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING", description: "Nombre del prospecto." },
          estado: { type: "STRING", enum: ["Nuevo","Contactado","Presupuestado","Cerrado"] },
          nota:   { type: "STRING", description: "Nota corta. Opcional." },
        },
        required: ["nombre", "estado"],
      },
    },
    {
      name: "agendar_seguimiento",
      description: "Agenda un recordatorio de seguimiento para retomar el contacto más tarde.",
      parameters: {
        type: "OBJECT",
        properties: {
          nombre:  { type: "STRING", description: "Nombre del cliente." },
          cuando:  { type: "STRING", description: "Momento del seguimiento." },
          motivo:  { type: "STRING", description: "Motivo del seguimiento." },
        },
        required: ["cuando", "motivo"],
      },
    },
    {
      name: "generar_link_pago",
      description: "Genera un link de Mercado Pago para cerrar la venta.",
      parameters: {
        type: "OBJECT",
        properties: {
          concepto: { type: "STRING", description: "Descripción de lo que se cobra." },
          monto:    { type: "NUMBER", description: "Monto total en ARS." },
        },
        required: ["concepto", "monto"],
      },
    },
    {
      name: "calificar_lead",
      description: "Asigná o actualizá el puntaje de intención de compra del prospecto (0 a 100) según las señales de la conversación. Alto (85-100) si pide precio/pago/reserva/stock puntual; medio (60-84) si compara o muestra interés; bajo (<60) si duda o se aleja.",
      parameters: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING", description: "Nombre del prospecto." },
          score:  { type: "NUMBER", description: "Puntaje de intención de compra, 0 a 100." },
          motivo: { type: "STRING", description: "Motivo breve del puntaje. Opcional." },
        },
        required: ["nombre", "score"],
      },
    },
    {
      name: "etiquetar_lead",
      description: "Asigná una categoría/etiqueta al prospecto según lo que le interesa (producto, servicio o segmento). Ayuda a segmentar el CRM para campañas.",
      parameters: {
        type: "OBJECT",
        properties: {
          nombre:    { type: "STRING", description: "Nombre del prospecto." },
          categoria: { type: "STRING", description: "Categoría o interés principal (ej: Calzado, VIP, Delivery)." },
        },
        required: ["nombre", "categoria"],
      },
    },
    {
      name: "enviar_foto",
      description: "Envía al cliente la foto de un producto del catálogo (solo si el producto tiene foto cargada). Usala cuando el cliente pide ver el producto o cuando mostrar la foto ayuda a cerrar la venta.",
      parameters: {
        type: "OBJECT",
        properties: {
          producto: { type: "STRING", description: "Nombre del producto cuya foto querés mandar." },
        },
        required: ["producto"],
      },
    },
  ],
}];

interface AgentAction {
  type: string;
  label: string;
  payload: Record<string, any>;
}

async function executeTool(name: string, args: Record<string, any>, config: any): Promise<{ result: Record<string, any>; action?: AgentAction }> {
  switch (name) {
    case "buscar_producto": {
      const query = String(args.consulta || "").toLowerCase();
      const terms = query.split(/\s+/).filter((w) => w.length > 2);
      const lines = String(config.catalog || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
      const matches = lines.filter((line: string) => terms.some((t) => line.toLowerCase().includes(t)));
      if (!matches.length) return { result: { encontrado: false, mensaje: "No se encontró ese producto. Ofrecé la alternativa más cercana." } };
      return { result: { encontrado: true, coincidencias: matches } };
    }
    case "registrar_lead": {
      const canal = args.canal || "WhatsApp";
      return {
        result: { ok: true, mensaje: `Prospecto "${args.nombre}" registrado.` },
        action: { type: "upsert_lead", label: `🆕 Lead registrado: "${args.nombre}" (${args.interes})`, payload: { ...args, canal } },
      };
    }
    case "actualizar_estado_lead": {
      return {
        result: { ok: true, mensaje: `Estado de "${args.nombre}" → "${args.estado}".` },
        action: { type: "update_lead_status", label: `📈 "${args.nombre}" movido → ${args.estado}`, payload: args },
      };
    }
    case "agendar_seguimiento": {
      return {
        result: { ok: true, mensaje: `Seguimiento agendado: ${args.cuando}.` },
        action: { type: "schedule_followup", label: `⏰ Seguimiento (${args.cuando}): ${args.motivo}`, payload: args },
      };
    }
    case "generar_link_pago": {
      const monto = Number(args.monto) || 0;
      let link: string;
      let real = false;
      if (MP_ACCESS_TOKEN && monto > 0) {
        try {
          link = await createMercadoPagoLink(String(args.concepto || "Compra"), monto);
          real = true;
        } catch (e) {
          logger.warn({ err: (e as Error).message }, "Mercado Pago preference failed; using placeholder link");
          link = `https://mpago.la/respondo?concepto=${encodeURIComponent(args.concepto || "")}&monto=${monto}`;
        }
      } else {
        link = `https://mpago.la/respondo?concepto=${encodeURIComponent(args.concepto || "")}&monto=${monto}`;
      }
      return {
        result: { ok: true, link, nota: real ? "Link de pago real de Mercado Pago." : "Link de ejemplo (configurá MP_ACCESS_TOKEN para cobrar de verdad)." },
        action: { type: "payment_link", label: `💳 Link de pago $${monto.toLocaleString("es-AR")} ARS ${real ? "(Mercado Pago)" : "(simulado)"}`, payload: { ...args, monto, link, real } },
      };
    }
    case "enviar_foto": {
      const consulta = String(args.producto || "").toLowerCase();
      const terms = consulta.split(/\s+/).filter((w) => w.length > 2);
      // Search the RAW catalog (it still contains the {foto:URL} markers)
      const lines = String(config.catalog || "").split("\n");
      const line = lines.find((l: string) => terms.some((t) => l.toLowerCase().includes(t)));
      const m = line?.match(/\{foto:([^}]+)\}/i);
      if (!m) return { result: { ok: false, mensaje: "Ese producto no tiene foto cargada en el catálogo. Avisale al cliente con naturalidad." } };
      const url = m[1].trim();
      return {
        result: { ok: true, mensaje: "Foto enviada al cliente por el canal." },
        action: { type: "send_image", label: `🖼️ Foto enviada: ${String(args.producto).slice(0, 60)}`, payload: { url, producto: args.producto } },
      };
    }
    case "calificar_lead": {
      const score = Math.max(0, Math.min(100, Math.round(Number(args.score) || 0)));
      return {
        result: { ok: true, mensaje: `Score de "${args.nombre}" → ${score}.` },
        action: { type: "score_lead", label: `🎯 "${args.nombre}" calificado: ${score}/100${args.motivo ? " — " + args.motivo : ""}`, payload: { ...args, score } },
      };
    }
    case "etiquetar_lead": {
      return {
        result: { ok: true, mensaje: `Categoría de "${args.nombre}" → ${args.categoria}.` },
        action: { type: "tag_lead", label: `🏷️ "${args.nombre}" etiquetado: ${args.categoria}`, payload: args },
      };
    }
    default:
      return { result: { error: `Herramienta desconocida: ${name}` } };
  }
}

// ---------------------------------------------------------------------------
// CORE CHAT FUNCTION (reused by /api/chat and WhatsApp webhook)
// ---------------------------------------------------------------------------
async function runChat(
  message: string,
  history: { role: string; text: string }[],
  config: any,
  attachment?: { data: string; mimeType: string }
): Promise<{ text: string; actions: AgentAction[]; engine?: string }> {
  const personaName = config.botPersonaName?.trim() || "Respondo";
  // Strip visual-editor photo markers so the model doesn't waste tokens on URLs
  const catalogText = String(config.catalog || "").replace(/\s*\{foto:[^}]+\}/gi, "");

  // Working hours check
  let offHoursNote = "";
  if (config.workingHoursStart !== undefined && config.workingHoursEnd !== undefined) {
    const currentHour = new Date().getHours();
    const inHours = currentHour >= config.workingHoursStart && currentHour < config.workingHoursEnd;
    if (!inHours) {
      offHoursNote = `\nIMPORTANTE: Estás FUERA DEL HORARIO DE ATENCIÓN (${config.workingHoursStart}:00 a ${config.workingHoursEnd}:00 hs). Avisá al cliente que no hay atención ahora y cuándo volverá a haber.`;
    }
  }

  const forbiddenNote = config.forbiddenTopics
    ? `\nTEMAS PROHIBIDOS — NUNCA los discutas: ${config.forbiddenTopics}. Si preguntan, decí que no es algo que puedas tratar.`
    : "";

  const strictNote = config.strictMode
    ? `\nMODO ESTRICTO ACTIVO — Respondé ÚNICAMENTE con la información del catálogo y los datos del negocio cargados acá arriba. Está PROHIBIDO inventar productos, precios, stock, promociones o datos que no figuren explícitamente. Si te preguntan algo que no está en tu información, decí con amabilidad que no contás con ese dato y ofrecé tomar la consulta o derivar a una persona del equipo. No respondas temas ajenos al negocio.`
    : "";

  const systemInstruction = `Sos ${personaName}, asesor/a de ventas experto/a de "${config.businessName}" (rubro: ${config.businessType || "general"}). Atendés por WhatsApp, Instagram y Facebook.

# QUIÉN SOS
Sos una persona real del equipo: cálida, perspicaz y genuinamente útil. Pensás antes de responder, entendés lo que la persona NECESITA (no solo lo que pide), y conversás con naturalidad e inteligencia —como el mejor vendedor del local, no como un bot con respuestas enlatadas. Tenés criterio propio: podés comparar opciones, dar recomendaciones honestas, manejar objeciones con empatía y explicar con claridad cuando hace falta.

# CÓMO PENSás (antes de cada respuesta)
1. ¿Qué quiere lograr esta persona realmente? ¿En qué etapa de la compra está (curioseando, comparando, decidida)?
2. ¿Qué información del catálogo es relevante? ¿Hay una opción que le conviene más aunque no la haya pedido?
3. ¿Cuál es el próximo paso natural para acercarla a la compra, sin presionar?

# CÓMO CONVERSás
- Hablá natural, como un humano que sabe del tema. Nada de sonar a folleto ni repetir muletillas.
- Largo adaptativo: en WhatsApp sé breve y al grano (1-4 oraciones); pero si la consulta es compleja (comparar productos, explicar, asesorar una decisión), extendete lo necesario y usá viñetas o pasos. Priorizá ser CLARO y ÚTIL por sobre ser corto.
- Hacé UNA pregunta a la vez para entender mejor (talle, presupuesto, uso, gusto).
- Vendé asesorando: mostrá el valor real, sugerí lo que mejor le sirve, sé honesto/a si algo no le conviene. La confianza vende más que la insistencia.
- Manejá objeciones (precio, dudas, "lo pienso") con empatía: entendé el motivo, aportá valor o una alternativa, y dejá la puerta abierta.
- Cerrá con naturalidad cuando hay interés: "¿Te lo reservo?", "¿Coordinamos el pago así te lo aseguro?".

# CONTENIDO MULTIMEDIA
- IMÁGENES: analizá en detalle lo que el cliente manda. Si es un producto, identificá qué es (tipo, color, modelo, estado) y relacionalo con el catálogo: "Esto se parece a X que tenemos en $...". Si es un comprobante de pago, agradecé y confirmá el siguiente paso. Si es una captura/pregunta, respondé lo que se ve.
- AUDIOS: escuchá la nota de voz, entendé el pedido y respondé como si te lo hubieran hablado. Si no se entiende algo puntual, pedí que lo aclare con amabilidad.

# CATÁLOGO (tu fuente de verdad para precios y stock)
${catalogText || "(sin catálogo cargado: si preguntan precios/stock puntuales, pedí el dato o ofrecé tomar la consulta)"}

# TONO: "${config.tone}"
- Argentino/Cercano: vos, modismos argentinos, cálido y directo.
- Profesional/Formal: usted, pulido, cortés y preciso.
- Casual/Juvenil: buena onda, algún emoji, entusiasta.

# REGLAS
- Usá buscar_producto para verificar precio/stock antes de afirmarlos. Nunca inventes datos que no estén en el catálogo: si no lo sabés, decilo y ofrecé averiguarlo o una alternativa cercana.
- Sos ${personaName}, del equipo de ${config.businessName}. No reveles que sos una IA ni rompas el personaje. Si te preguntan tu nombre, es ${personaName}.${strictNote}${forbiddenNote}${offHoursNote}

# HERRAMIENTAS (usalas en silencio, sin anunciarlas al cliente)
- buscar_producto: consultá stock/precios antes de afirmarlos.
- registrar_lead: apenas detectes interés real (no esperes a que "compre").
- actualizar_estado_lead: al pasar un precio → Presupuestado; al confirmar la compra → Cerrado.
- agendar_seguimiento: si algo queda pendiente o pidió pensarlo.
- generar_link_pago: cuando confirma que quiere comprar.
- calificar_lead: actualizá el puntaje de intención (0-100) cada vez que cambian las señales de compra (pide precio/pago/stock = alto; duda o se va = bajo).
- etiquetar_lead: categorizá el interés del cliente (producto/servicio/segmento) para segmentar el CRM.
- enviar_foto: mandá la foto del producto cuando el cliente pide verlo o cuando la imagen ayuda a cerrar (solo productos con foto en el catálogo). Avisale con naturalidad: "te paso la foto".

# PARA VENDER MÁS (regla de oro)
- Avanzá SIEMPRE al próximo paso: no cierres una respuesta sin una pregunta o una propuesta que acerque la compra.
- Capturá datos temprano: si no tenés el nombre, pedilo con naturalidad y registrá el lead apenas haya interés.
- Upsell / cross-sell: sugerí un complemento o una mejor opción cuando aporta valor real (nunca inventes productos).
- Urgencia honesta: mencioná stock limitado, promo vigente o beneficio por pago hoy SOLO si figura en tu información.
- Recuperá conversaciones frías: si retomás un chat, referí lo último que habló el cliente.
- Pedí la venta cuando hay interés: "¿Te lo reservo?", "¿Coordinamos el pago así te lo aseguro?".
- Calificá y etiquetá en silencio con las herramientas para que el equipo priorice a los más calientes.

Tu misión: que cada persona se sienta bien atendida y termine comprando con ganas. Lema: "Chatea menos, Vendé más."`;

  const isAudio = !!attachment?.mimeType?.startsWith("audio");
  const defaultMediaPrompt = isAudio
    ? "El cliente te envió esta nota de voz. Escuchala con atención, entendé qué necesita y respondé natural, como si te lo hubiera hablado."
    : "El cliente te envió esta imagen. Analizala en detalle: identificá qué es y relacionala con el catálogo (producto parecido, precio, disponibilidad). Si es un comprobante de pago, confirmá el siguiente paso.";
  const userText = attachment ? (message?.trim() ? message : defaultMediaPrompt) : (message || "Hola!");

  // -------------------------------------------------------------------------
  // PROVIDER CHAIN: Gemini (primary) → OpenRouter (fallback) → local bot
  // -------------------------------------------------------------------------
  if (process.env.GEMINI_API_KEY) {
    try {
      return await runGemini(systemInstruction, history, userText, attachment, config);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Gemini failed; trying next provider");
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await runOpenRouter(systemInstruction, history, userText, attachment);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "OpenRouter failed; using local bot");
    }
  }

  // Last resort: the built-in rule-based bot keeps the agent alive.
  const reply = localBotReply(message, history || [], config);
  return { text: reply.text, actions: reply.actions as AgentAction[], engine: "local" };
}

// Gemini provider (with function-calling tool loop)
async function runGemini(
  systemInstruction: string,
  history: { role: string; text: string }[],
  userText: string,
  attachment: { data: string; mimeType: string } | undefined,
  config: any
): Promise<{ text: string; actions: AgentAction[]; engine: string }> {
  const ai = getAI();
  const contents: any[] = [];
  (history || []).forEach((m) => {
    contents.push({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] });
  });

  const currentParts: any[] = [];
  if (attachment?.data && attachment?.mimeType) {
    currentParts.push({ inlineData: { data: attachment.data, mimeType: attachment.mimeType } });
  }
  currentParts.push({ text: userText });
  contents.push({ role: "user", parts: currentParts });

  const actions: AgentAction[] = [];
  let finalText = "";

  for (let i = 0; i < 5; i++) {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: { systemInstruction, temperature: 0.8, topP: 0.95, tools: TOOL_DECLARATIONS },
    });

    const calls = response.functionCalls;
    if (calls && calls.length > 0) {
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent);
      const parts: any[] = [];
      for (const call of calls) {
        const { result, action } = await executeTool(call.name as string, (call.args as any) || {}, config);
        if (action) actions.push(action);
        parts.push({ functionResponse: { name: call.name, response: result } });
      }
      contents.push({ role: "user", parts });
      continue;
    }
    finalText = response.text || "";
    break;
  }

  return { text: finalText || "Disculpame, no pude procesar la consulta. ¿Me la repetís?", actions, engine: "gemini" };
}

// OpenRouter provider (OpenAI-compatible). Text + vision fallback; no
// function-calling, so CRM actions are not emitted on this path.
async function runOpenRouter(
  systemInstruction: string,
  history: { role: string; text: string }[],
  userText: string,
  attachment: { data: string; mimeType: string } | undefined
): Promise<{ text: string; actions: AgentAction[]; engine: string }> {
  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";
  const messages: any[] = [{ role: "system", content: systemInstruction }];
  (history || []).forEach((m) => {
    messages.push({ role: m.role === "user" ? "user" : "assistant", content: m.text });
  });

  // Vision: attach images as data URIs (audio isn't supported on this path)
  if (attachment?.data && attachment.mimeType.startsWith("image")) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: `data:${attachment.mimeType};base64,${attachment.data}` } },
      ],
    });
  } else {
    messages.push({ role: "user", content: userText });
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.APP_URL || "https://respondo.app",
      "X-Title": "Respondo",
    },
    body: JSON.stringify({ model, messages, temperature: 0.8 }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("OpenRouter returned empty content");
  return { text, actions: [], engine: "openrouter" };
}

// ---------------------------------------------------------------------------
// LIGHTWEIGHT LLM TEXT HELPER (no tools) — used for summaries, suggested
// replies and lead analysis. Same provider chain: Gemini → OpenRouter.
// ---------------------------------------------------------------------------
async function runLLMText(systemInstruction: string, prompt: string): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { systemInstruction, temperature: 0.4, topP: 0.9 },
      });
      const text = response.text || "";
      if (text.trim()) return text.trim();
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "runLLMText: Gemini failed, trying OpenRouter");
    }
  }
  if (process.env.OPENROUTER_API_KEY) {
    const model = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.APP_URL || "https://respondo.app",
        "X-Title": "Respondo",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });
    if (res.ok) {
      const data: any = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      if (text.trim()) return text.trim();
    }
  }
  throw new Error("No hay proveedor de IA disponible (configurá GEMINI_API_KEY u OPENROUTER_API_KEY)");
}

// (formatTranscript / extractJsonArray / extractJsonObject viven en
// serverHelpers.ts para poder testearlos)

// Craft a personalized follow-up message for a lead that went quiet, using the
// conversation context. Falls back to a warm generic message if AI is unavailable.
async function craftFollowUp(lead: { name?: string; status?: string; conversation_history?: any[] }, config: any): Promise<string> {
  const persona = config?.botPersonaName?.trim() || "Respondo";
  const business = config?.businessName || "el negocio";
  const hist = Array.isArray(lead.conversation_history) ? lead.conversation_history : [];
  const transcript = formatTranscript(hist).slice(-1500);
  const fallback = `¡Hola${lead.name ? " " + lead.name : ""}! 😊 Te escribo de ${business} para retomar tu consulta. ¿Seguís interesado/a o querés que te ayude a avanzar?`;
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) return fallback;
  // Stage-aware angle: a quoted lead is a "abandoned cart" — recover the sale
  const stageNote = lead.status === "Presupuestado"
    ? "IMPORTANTE: este cliente YA recibió precio/presupuesto y no concretó (carrito abandonado). Recuperá la venta: recordale lo que le cotizaste, resolvé la traba probable (precio, dudas) y ofrecé cerrarla hoy (reserva, medio de pago o beneficio si figura en la info del negocio)."
    : lead.status === "Contactado"
    ? "Este cliente mostró interés pero todavía no recibió precio. Retomá su consulta puntual y acercalo a pedir el presupuesto."
    : "";
  try {
    const system = `Sos ${persona}, vendedor/a de ${business}. Escribís por WhatsApp, en español rioplatense, cálido, humano y breve.`;
    const prompt = `El cliente${lead.name ? " " + lead.name : ""} dejó de responder. ${stageNote} Escribí UN solo mensaje de seguimiento corto (1-2 oraciones), personalizado según la conversación, que retome el interés puntual que mostró y proponga el próximo paso para avanzar la venta, sin sonar insistente ni robótico. No uses comillas, no firmes, no te presentes de nuevo.\n\n${transcript ? "CONVERSACIÓN PREVIA:\n" + transcript : "(Todavía no hay mensajes; hacé un seguimiento cálido y genérico.)"}`;
    const text = await runLLMText(system, prompt);
    return text.replace(/^["']|["']$/g, "").trim() || fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// EXPRESS APP
// ---------------------------------------------------------------------------
const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // Vite dev needs inline scripts
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));

// Request logger (lightweight)
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, "req");
  next();
});

// In-memory rate limiter (per IP + path prefix). Protects auth brute-force
// and AI-endpoint abuse without external dependencies.
const rlBuckets = new Map<string, { n: number; reset: number }>();
function rateLimit(max: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip}:${req.baseUrl || req.path}`;
    const now = Date.now();
    const bucket = rlBuckets.get(key);
    if (!bucket || now > bucket.reset) {
      rlBuckets.set(key, { n: 1, reset: now + windowMs });
      return next();
    }
    if (++bucket.n > max) {
      return res.status(429).json({ error: "Demasiadas solicitudes. Esperá un momento y volvé a intentar." });
    }
    next();
  };
}
// Periodic cleanup so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rlBuckets) if (now > v.reset) rlBuckets.delete(k);
}, 60_000).unref?.();

app.use("/api/auth", rateLimit(15, 60_000));
app.use("/api/chat", rateLimit(30, 60_000));
app.use("/api/ai", rateLimit(30, 60_000));

// Zod error handler
function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

function handleError(res: express.Response, err: any) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos", details: err.flatten() });
  }
  // Supabase/Postgrest errors are plain objects with message/details/hint/code
  const msg = err?.message || err?.error_description || (err instanceof Error ? err.message : JSON.stringify(err));
  logger.error({ message: err?.message, code: err?.code, details: err?.details, hint: err?.hint }, "request error");
  return res.status(500).json({ error: msg, code: err?.code });
}

// ---------------------------------------------------------------------------
// AUTH (Supabase Auth) — real sessions + per-user data isolation.
// Authenticated API requests run against Supabase WITH the user's JWT, so the
// RLS policies (owner_id = auth.uid()) enforce isolation at the DB level.
// ---------------------------------------------------------------------------
interface AuthedUser { id: string; email?: string; token: string }

async function getUserFromReq(req: express.Request): Promise<AuthedUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  try {
    const { data, error } = await getDB().auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email ?? undefined, token };
  } catch { return null; }
}

// Per-request client that queries AS the user (RLS owner policies apply)
function getDBAs(user: AuthedUser) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${user.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Guard: resolves the user or replies 401. Usage: const user = await requireUser(req, res); if (!user) return;
async function requireUser(req: express.Request, res: express.Response): Promise<AuthedUser | null> {
  const user = await getUserFromReq(req);
  if (!user) { res.status(401).json({ error: "No autenticado" }); return null; }
  return user;
}

const CredsSchema = z.object({ email: z.string().email(), password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres") });
const sessionOut = (s: any) => ({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at });

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password } = CredsSchema.parse(req.body);
    const { data, error } = await getDB().auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    if (!data.session) return res.json({ ok: true, needsEmailConfirm: true, user: { id: data.user?.id, email } });
    res.json({ ok: true, session: sessionOut(data.session), user: { id: data.user!.id, email } });
  } catch (err) { handleError(res, err); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = CredsSchema.parse(req.body);
    const { data, error } = await getDB().auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message });
    res.json({ ok: true, session: sessionOut(data.session), user: { id: data.user.id, email: data.user.email } });
  } catch (err) { handleError(res, err); }
});

app.post("/api/auth/refresh", async (req, res) => {
  try {
    const refresh_token = String(req.body?.refresh_token || "");
    if (!refresh_token) return res.status(400).json({ error: "refresh_token requerido" });
    const { data, error } = await getDB().auth.refreshSession({ refresh_token });
    if (error || !data.session) return res.status(401).json({ error: error?.message || "Sesión expirada" });
    res.json({ ok: true, session: sessionOut(data.session), user: { id: data.user?.id, email: data.user?.email } });
  } catch (err) { handleError(res, err); }
});

app.get("/api/auth/me", async (req, res) => {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "No autenticado" });
  res.json({ id: user.id, email: user.email });
});

// One-time adoption of pre-auth data: rows created before multi-account have
// owner_id NULL; the first user to claim them becomes their owner.
app.post("/api/auth/claim-legacy", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDB(); // anon client can see/patch null-owner rows
    const tables = ["respondo_config","respondo_leads","respondo_campaigns","respondo_automations","respondo_wa_templates","respondo_chat_events"];
    let claimed = 0;
    for (const t of tables) {
      const { data } = await db.from(t).update({ owner_id: user.id }).is("owner_id", null).select("id");
      claimed += (data || []).length;
    }
    res.json({ ok: true, claimed });
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// HEALTH CHECK
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    model: GEMINI_MODEL,
    // The bot is always alive: Gemini → OpenRouter → built-in local engine.
    botEngine: process.env.GEMINI_API_KEY ? "gemini" : process.env.OPENROUTER_API_KEY ? "openrouter" : "local",
    integrations: {
      gemini: !!process.env.GEMINI_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      supabase: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
      whatsapp: !!(WA_TOKEN && WA_PHONE_ID),
      facebook: !!FB_PAGE_TOKEN,
      instagram: !!(IG_TOKEN || FB_PAGE_TOKEN),
      email: !!process.env.EMAIL_USER,
    },
    webhookUrl: process.env.APP_URL ? `${process.env.APP_URL}/webhook/whatsapp` : null,
    messengerWebhookUrl: process.env.APP_URL ? `${process.env.APP_URL}/webhook/messenger` : null,
  });
});

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
app.get("/api/config", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return res.json(null);
    res.json(mapConfigFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.put("/api/config", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const body = validateBody(AgentConfigSchema, req.body);
    const db = getDBAs(user);
    const { data: existing } = await db.from("respondo_config").select("id").limit(1).maybeSingle();
    let result: any;
    if (existing) {
      const { data } = await db.from("respondo_config").update(mapConfigToDB(body)).eq("id", existing.id).select().single();
      result = data;
    } else {
      const { data } = await db.from("respondo_config").insert({ ...mapConfigToDB(body), owner_id: user.id }).select().single();
      result = data;
    }
    res.json(mapConfigFromDB(result));
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// LEADS
// ---------------------------------------------------------------------------
app.get("/api/leads", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    let query = db.from("respondo_leads").select("*").order("created_at", { ascending: false });
    // ?since=ISO8601 — return only leads created/updated after that timestamp
    const since = req.query.since as string | undefined;
    if (since) query = query.gte("updated_at", since);
    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(mapLeadFromDB));
  } catch (err) { handleError(res, err); }
});

app.post("/api/leads", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const body = validateBody(LeadCreateSchema, req.body);
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_leads").insert({ ...mapLeadToDB(body), owner_id: user.id }).select().single();
    if (error) throw error;
    res.status(201).json(mapLeadFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.put("/api/leads/:id", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const body = validateBody(LeadPatchSchema, req.body);
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_leads").update(mapLeadToDB(body)).eq("id", req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Lead no encontrado" });
    res.json(mapLeadFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.delete("/api/leads/:id", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { error } = await db.from("respondo_leads").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { handleError(res, err); }
});

// Manual message send: CRM user → WhatsApp lead
app.post("/api/leads/:id/message", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const { text } = z.object({ text: z.string().min(1).max(4000) }).parse(req.body);
    const db = getDBAs(user);
    const { data: lead } = await db.from("respondo_leads").select("phone,conversation_history").eq("id", req.params.id).maybeSingle();
    if (!lead?.phone) return res.status(400).json({ error: "El lead no tiene teléfono registrado" });

    // Append message to conversation history
    const now = new Date().toISOString();
    const history = Array.isArray(lead.conversation_history) ? lead.conversation_history : [];
    history.push({ role: "model", text, timestamp: now });
    await db.from("respondo_leads").update({ conversation_history: history, last_interaction: now }).eq("id", req.params.id);

    // Send via WhatsApp API (only if configured)
    if (WA_TOKEN && WA_PHONE_ID) {
      await sendWhatsAppMessage(lead.phone, text);
      res.json({ ok: true, sent: true });
    } else {
      res.json({ ok: true, sent: false, note: "WhatsApp no configurado — mensaje guardado en historial únicamente" });
    }
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// CAMPAIGNS
// ---------------------------------------------------------------------------
app.get("/api/campaigns", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_campaigns").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapCampaignFromDB));
  } catch (err) { handleError(res, err); }
});

app.post("/api/campaigns", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const body = validateBody(CampaignPatchSchema.extend({ name: z.string().min(1), template: z.string().min(1) }), req.body);
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_campaigns").insert({ ...mapCampaignToDB(body), owner_id: user.id }).select().single();
    if (error) throw error;
    res.status(201).json(mapCampaignFromDB(data));
  } catch (err) { handleError(res, err); }
});

// Send a campaign to all leads (real WhatsApp API when configured)
app.post("/api/campaigns/:id/send", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { data: camp, error: campErr } = await db.from("respondo_campaigns").select("*").eq("id", req.params.id).maybeSingle();
    if (campErr) throw campErr;
    if (!camp) return res.status(404).json({ error: "Campaña no encontrada" });

    // Optional Meta-approved template for leads OUTSIDE the 24h window
    const templateName = typeof req.body?.templateName === "string" ? req.body.templateName.trim() : "";
    const templateLang = typeof req.body?.templateLang === "string" ? req.body.templateLang.trim() : "es_AR";

    // Business name for {{empresa}} replacement
    const { data: cfgRow } = await db.from("respondo_config").select("business_name").limit(1).maybeSingle();
    const businessName = cfgRow?.business_name || "Respondo";

    // Get leads to send to (history needed for the 24h-window check)
    const { data: leads } = await db.from("respondo_leads").select("id,name,phone,conversation_history");
    const validLeads = (leads || []).filter((l: any) => l.phone);

    let sentCount = 0;
    let skippedOutsideWindow = 0;
    if (WA_TOKEN && WA_PHONE_ID) {
      for (const lead of validLeads) {
        const text = camp.template
          .replace(/\{\{nombre\}\}/gi, lead.name)
          .replace(/\{\{empresa\}\}/gi, businessName);
        try {
          if (isInside24hWindow(lead.conversation_history)) {
            // Free-form message allowed inside the 24h service window
            await sendWhatsAppMessage(lead.phone, text);
            sentCount++;
          } else if (templateName) {
            // Outside the window Meta only allows approved templates
            await sendWhatsAppTemplate(lead.phone, templateName, templateLang, [lead.name]);
            sentCount++;
          } else {
            skippedOutsideWindow++;
          }
        } catch {
          // Continue on individual send failures
        }
        // 250ms between sends to respect Meta rate limits
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    // Honest metrics: only sent_count is real; read/replies stay 0 until
    // delivery-status webhooks are wired.
    await db.from("respondo_campaigns").update({
      status: "Completado",
      sent_count: sentCount,
      read_count: 0,
      replies_count: 0,
    }).eq("id", req.params.id);

    const { data: updated } = await db.from("respondo_campaigns").select("*").eq("id", req.params.id).single();
    res.json({
      ...mapCampaignFromDB(updated),
      waConfigured: !!(WA_TOKEN && WA_PHONE_ID),
      totalTargeted: validLeads.length,
      skippedOutsideWindow,
      windowNote: skippedOutsideWindow > 0
        ? `${skippedOutsideWindow} lead(s) fuera de la ventana de 24h de Meta — necesitan una plantilla aprobada (elegí una en Envíos Masivos).`
        : undefined,
    });
  } catch (err) { handleError(res, err); }
});

app.put("/api/campaigns/:id", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const body = validateBody(CampaignPatchSchema, req.body);
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_campaigns").update(mapCampaignToDB(body)).eq("id", req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Campaña no encontrada" });
    res.json(mapCampaignFromDB(data));
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// AUTOMATIONS (rules engine)
// ---------------------------------------------------------------------------
app.get("/api/automations", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_automations").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapAutomationFromDB));
  } catch (err) { handleError(res, err); }
});

app.post("/api/automations", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const body = validateBody(AutomationSchema, req.body);
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_automations").insert({ ...mapAutomationToDB(body), owner_id: user.id }).select().single();
    if (error) throw error;
    res.status(201).json(mapAutomationFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.put("/api/automations/:id", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const body = validateBody(AutomationPatchSchema, req.body);
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_automations").update(mapAutomationToDB(body)).eq("id", req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Automatización no encontrada" });
    res.json(mapAutomationFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.delete("/api/automations/:id", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { error } = await db.from("respondo_automations").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// WHATSAPP TEMPLATES (Meta-approved message templates)
// ---------------------------------------------------------------------------
const TemplateSchema = z.object({
  name: z.string().min(1).max(200),
  language: z.string().max(10).optional(),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
  body: z.string().min(1).max(2000),
  status: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA"]).optional(),
});

function mapTemplateFromDB(r: any) {
  return {
    id: r.id, name: r.name, language: r.language, category: r.category,
    body: r.body, status: r.status, createdAt: r.created_at,
  };
}

app.get("/api/templates", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_wa_templates").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapTemplateFromDB));
  } catch (err) { handleError(res, err); }
});

app.post("/api/templates", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const body = validateBody(TemplateSchema, req.body);
    const db = getDBAs(user);
    const { data, error } = await db.from("respondo_wa_templates").insert({
      name: body.name, language: body.language || "es_AR",
      category: body.category || "MARKETING", body: body.body,
      status: body.status || "PENDIENTE",
      owner_id: user.id,
    }).select().single();
    if (error) throw error;
    res.status(201).json(mapTemplateFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.put("/api/templates/:id", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const body = validateBody(TemplateSchema.partial(), req.body);
    const db = getDBAs(user);
    const patch: any = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.language !== undefined) patch.language = body.language;
    if (body.category !== undefined) patch.category = body.category;
    if (body.body !== undefined) patch.body = body.body;
    if (body.status !== undefined) patch.status = body.status;
    const { data, error } = await db.from("respondo_wa_templates").update(patch).eq("id", req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Plantilla no encontrada" });
    res.json(mapTemplateFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.delete("/api/templates/:id", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { error } = await db.from("respondo_wa_templates").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// AUTO FOLLOW-UPS
// ---------------------------------------------------------------------------
app.post("/api/followups/run", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { data: configRow } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
    const config = configRow ? mapConfigFromDB(configRow) : null;
    const followUpMinutes = config?.autoFollowUpMinutes ?? 30;
    const cutoff = new Date(Date.now() - followUpMinutes * 60 * 1000).toISOString();

    // Find leads with no recent interaction, not yet closed
    const { data: stale, error } = await db.from("respondo_leads")
      .select("id,name,phone,status,ai_paused,conversation_history")
      .neq("status", "Cerrado")
      .lt("last_interaction", cutoff)
      .limit(50);
    if (error) throw error;

    let contacted = 0;
    for (const lead of (stale || [])) {
      if (!lead.phone) continue;
      if ((lead as any).ai_paused) continue; // human took over — stay silent
      try {
        const now = new Date().toISOString();
        // Personalized, AI-crafted follow-up based on the conversation context
        const followUpMsg = await craftFollowUp(lead, config);
        const history = Array.isArray(lead.conversation_history) ? lead.conversation_history : [];
        history.push({ role: "model", text: followUpMsg, timestamp: now });
        await db.from("respondo_leads").update({
          last_interaction: now,
          conversation_history: history,
        }).eq("id", lead.id);
        if (WA_TOKEN && WA_PHONE_ID) {
          await sendWhatsAppMessage(lead.phone, followUpMsg);
        }
        contacted++;
      } catch { /* skip individual failures */ }
    }
    res.json({ ok: true, contacted, totalStale: (stale || []).length, followUpMinutes });
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// ANALYTICS (real aggregation from DB)
// ---------------------------------------------------------------------------
app.get("/api/analytics", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { data: leads, error } = await db.from("respondo_leads")
      .select("status,total_spent,updated_at,created_at,origin,conversation_history");
    if (error) throw error;

    const { count: eventCount } = await db.from("respondo_chat_events")
      .select("*", { count: "exact", head: true });

    const monthLabels = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const now = new Date();
    const months: { key: string; label: string; sales: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabels[d.getMonth()], sales: 0 });
    }

    let totalConversations = 0;
    let totalMessages = 0;
    const channelCounts: Record<string, number> = {};

    for (const l of (leads || [])) {
      const hist = Array.isArray((l as any).conversation_history) ? (l as any).conversation_history : [];
      if (hist.length > 0) totalConversations++;
      totalMessages += hist.length;
      const origin = (l as any).origin || "WhatsApp";
      channelCounts[origin] = (channelCounts[origin] || 0) + 1;

      if ((l as any).status === "Cerrado") {
        const d = new Date((l as any).updated_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const m = months.find((mm) => mm.key === key);
        if (m) m.sales += parseFloat((l as any).total_spent) || 0;
      }
    }

    // Leads per day for the last 7 days
    const todayDate = new Date();
    const leadsPerDay: { date: string; label: string; count: number }[] = [];
    const DAY_LABELS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      leadsPerDay.push({ date: d.toISOString().split("T")[0], label: DAY_LABELS[d.getDay()], count: 0 });
    }
    for (const l of (leads || [])) {
      const createdAt = (l as any).created_at;
      if (!createdAt) continue;
      const dateStr = new Date(createdAt).toISOString().split("T")[0];
      const entry = leadsPerDay.find((d) => d.date === dateStr);
      if (entry) entry.count++;
    }

    res.json({
      monthlySales: months.map((m) => ({ month: m.label, sales: m.sales })),
      totalConversations,
      totalMessages,
      totalEvents: eventCount || 0,
      channelCounts,
      leadsPerDay,
    });
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// CHAT (AI with tool-use)
// ---------------------------------------------------------------------------
app.post("/api/chat", async (req, res) => {
  try {
    const body = validateBody(ChatSchema, req.body);
    // Optional auth: authed users chat against THEIR config and persist to THEIR data;
    // unauthenticated (demo) chats use the provided/default config and persist nothing.
    const user = await getUserFromReq(req);

    // Resolve config: request body > (authed) user's DB config > default
    let config = body.agentConfig;
    if (!config && user) {
      const db = getDBAs(user);
      const { data } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
      if (data) config = mapConfigFromDB(data);
    }
    if (!config) {
      config = { businessName: "Zapas Respondo", businessType: "Calzado", catalog: "", tone: "Argentino/Cercano" };
    }

    const { text, actions, engine } = await runChat(body.message, body.history || [], config, body.attachment);

    // Build conversation snapshot for DB storage (history + current exchange)
    const now = new Date().toISOString();
    const conversationSnapshot = [
      ...(body.history || []).map((h: any) => ({ role: h.role as string, text: h.text as string, timestamp: now })),
      { role: "user", text: body.message || "", timestamp: now },
      { role: "model", text, timestamp: now },
    ];

    // Persist CRM actions to DB (only for authenticated users, into THEIR data)
    if (actions.length > 0 && user) {
      const db = getDBAs(user);
      for (const action of actions) {
        try {
          if (action.type === "upsert_lead") {
            const { nombre, telefono, interes, canal } = action.payload;
            const { data: existing } = await db.from("respondo_leads").select("id")
              .or(`phone.eq.${telefono || ""},name.ilike.${nombre}`).limit(1).maybeSingle();
            const validCanal = ["WhatsApp","Instagram","Facebook","Email"].includes(canal) ? canal : "WhatsApp";
            const userMsgText = conversationSnapshot.filter(m => m.role === "user").map(m => m.text).join(" ");
            const dynamicScore = computeLeadScore(conversationSnapshot.length, userMsgText);
            if (existing) {
              await db.from("respondo_leads").update({
                notes: interes,
                last_interaction: now,
                conversation_history: conversationSnapshot,
                score: dynamicScore,
              }).eq("id", existing.id);
            } else {
              await db.from("respondo_leads").insert({
                name: nombre || "Cliente sin identificar",
                phone: telefono || "",
                status: "Nuevo",
                origin: validCanal,
                notes: interes || "",
                score: dynamicScore,
                avatar: makeAvatarUrl(nombre || "?"),
                conversation_history: conversationSnapshot,
                owner_id: user.id,
              });
            }
          } else if (action.type === "update_lead_status") {
            const { nombre, estado, nota } = action.payload;
            const { data: lead } = await db.from("respondo_leads").select("id").ilike("name", nombre).limit(1).maybeSingle();
            if (lead) {
              const patch: any = { status: estado, last_interaction: new Date().toISOString() };
              if (nota) patch.notes = nota;
              await db.from("respondo_leads").update(patch).eq("id", lead.id);
            }
          } else if (action.type === "score_lead") {
            const { nombre, score } = action.payload;
            const { data: lead } = await db.from("respondo_leads").select("id").ilike("name", nombre).limit(1).maybeSingle();
            if (lead) await db.from("respondo_leads").update({ score: Math.max(0, Math.min(100, Math.round(Number(score) || 0))) }).eq("id", lead.id);
          } else if (action.type === "tag_lead") {
            const { nombre, categoria } = action.payload;
            const { data: lead } = await db.from("respondo_leads").select("id").ilike("name", nombre).limit(1).maybeSingle();
            if (lead && categoria) await db.from("respondo_leads").update({ category: String(categoria) }).eq("id", lead.id);
          }
          // Log event
          await db.from("respondo_chat_events").insert({
            event_type: action.type,
            channel: "chat",
            payload: action.payload,
            owner_id: user.id,
          });
        } catch (e) {
          logger.warn({ action: action.type, err: (e as Error).message }, "action persist failed");
        }
      }
    }

    // Track every chat interaction for analytics (authed users only)
    if (user) {
      try {
        const db = getDBAs(user);
        await db.from("respondo_chat_events").insert({
          event_type: "chat_message",
          channel: "chat",
          payload: { messageLength: body.message?.length ?? 0, hasAttachment: !!body.attachment, actionsCount: actions.length },
          owner_id: user.id,
        });
      } catch { /* non-critical */ }
    }

    res.json({ text, role: "model", actions, engine });
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// AI ASSIST — conversation summary + suggested replies (powers the inbox
// "Resumen" and the suggested-reply chips when a human takes over a chat).
// Uses the same Gemini → OpenRouter provider chain.
// ---------------------------------------------------------------------------
app.post("/api/ai/summary", async (req, res) => {
  try {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const name = String(req.body?.name || "el cliente");
    if (history.length === 0) return res.json({ summary: "Todavía no hay mensajes para resumir." });
    const transcript = formatTranscript(history);
    const system = "Sos un asistente que resume conversaciones de atención al cliente para un equipo de ventas. Escribís en español rioplatense, claro y conciso.";
    const prompt = `Resumí esta conversación con ${name} en 2-3 oraciones. Enfocate en: qué necesita el cliente, qué se le ofreció, y cuál es el próximo paso pendiente. No uses viñetas, escribí un párrafo corto.\n\nCONVERSACIÓN:\n${transcript}`;
    const summary = await runLLMText(system, prompt);
    res.json({ summary });
  } catch (err) { handleError(res, err); }
});

app.post("/api/ai/suggest", async (req, res) => {
  try {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (history.length === 0) return res.json({ suggestions: [] });
    const transcript = formatTranscript(history);
    const system = "Sos un asesor de ventas experto. Escribís en español rioplatense, cálido y natural.";
    const prompt = `Basándote en esta conversación, sugerí 3 respuestas breves (1-2 oraciones cada una) que el agente humano podría enviarle AHORA al cliente para avanzar la venta. Devolvé SOLO un array JSON de 3 strings en español, sin texto adicional.\n\nCONVERSACIÓN:\n${transcript}`;
    const raw = await runLLMText(system, prompt);
    const suggestions = extractJsonArray(raw).slice(0, 3);
    res.json({ suggestions });
  } catch (err) { handleError(res, err); }
});

// AI INSIGHTS — analyzes the whole lead portfolio (sentiment + actionable
// highlights + a recommendation). Powers the "Análisis con IA" card in Métricas.
app.get("/api/ai/insights", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { data: leadsRaw } = await db.from("respondo_leads")
      .select("name,status,score,notes,category,origin,conversation_history,last_interaction")
      .order("last_interaction", { ascending: false })
      .limit(40);
    const rows = leadsRaw || [];
    if (rows.length === 0) {
      return res.json({ sentiment: { positive: 0, neutral: 0, negative: 0 }, highlights: [], recommendation: "Todavía no hay leads para analizar." });
    }

    const sample = rows.slice(0, 20);
    const digest = sample.map((l: any) => {
      const hist = Array.isArray(l.conversation_history) ? l.conversation_history : [];
      const lastUser = [...hist].reverse().find((m: any) => m.role === "user");
      return `- ${l.name} [${l.status}, score ${l.score}${l.category ? ", " + l.category : ""}]: ${String(lastUser?.text || l.notes || "sin mensajes").slice(0, 140)}`;
    }).join("\n");
    const statusCounts = rows.reduce((acc: any, l: any) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});

    const system = "Sos un analista de ventas que interpreta la cartera de leads de un negocio. Respondés SIEMPRE en JSON válido, en español rioplatense.";
    const prompt = `Analizá esta cartera de ${rows.length} leads y su actividad reciente. Distribución por etapa: ${JSON.stringify(statusCounts)}.

LEADS RECIENTES:
${digest}

Devolvé SOLO un objeto JSON con esta forma exacta (sin texto extra):
{
  "sentiment": { "positive": <int>, "neutral": <int>, "negative": <int> },
  "highlights": ["<hallazgo accionable 1>", "<hallazgo 2>", "<hallazgo 3>"],
  "recommendation": "<una acción concreta para vender más, 1-2 oraciones>"
}
Los tres números de sentiment deben sumar ${sample.length} (cantidad de leads analizados).`;
    const raw = await runLLMText(system, prompt);
    const parsed = extractJsonObject(raw);
    if (!parsed || !parsed.sentiment) {
      return res.json({ sentiment: { positive: 0, neutral: 0, negative: 0 }, highlights: [], recommendation: raw.slice(0, 240) });
    }
    res.json({
      sentiment: {
        positive: Number(parsed.sentiment.positive) || 0,
        neutral: Number(parsed.sentiment.neutral) || 0,
        negative: Number(parsed.sentiment.negative) || 0,
      },
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map((x: any) => String(x)).slice(0, 4) : [],
      recommendation: String(parsed.recommendation || ""),
      analyzed: sample.length,
    });
  } catch (err) { handleError(res, err); }
});

// AI CAMPAIGN GENERATOR — writes a ready-to-send broadcast (name + message)
// from the user's business config, catalog and goal. Powers "Generar con IA".
app.post("/api/ai/campaign", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const objetivo = String(req.body?.objetivo || "reactivar clientes y vender más").slice(0, 300);
    const segmento = String(req.body?.segmento || "Todos los contactos").slice(0, 200);
    const db = getDBAs(user);
    const { data: cfgRow } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
    const cfg = cfgRow ? mapConfigFromDB(cfgRow) : { businessName: "Mi Negocio", businessType: "", catalog: "", tone: "Argentino/Cercano" };
    const catalogText = String(cfg.catalog || "").replace(/\s*\{foto:[^}]+\}/gi, "").slice(0, 2500);

    const system = `Sos un experto en marketing por WhatsApp para negocios de LATAM. Escribís campañas que venden sin sonar spam. Respondés SIEMPRE en JSON válido.`;
    const prompt = `Negocio: ${cfg.businessName} (${cfg.businessType || "general"}). Tono: ${cfg.tone}.
Objetivo de la campaña: ${objetivo}
Segmento: ${segmento}
${catalogText ? "CATÁLOGO REAL (usalo para ofertas concretas, no inventes):\n" + catalogText : "(sin catálogo — mantené la oferta genérica)"}

Escribí una campaña de difusión por WhatsApp. Reglas: máx 500 caracteres, usá {{nombre}} para personalizar y {{empresa}} para el negocio, un solo emoji o dos, llamado a la acción claro (que respondan el mensaje). Devolvé SOLO este JSON:
{ "name": "<nombre interno corto de la campaña>", "template": "<mensaje listo para enviar>" }`;
    const raw = await runLLMText(system, prompt);
    const parsed = extractJsonObject(raw);
    if (!parsed?.template) return res.status(502).json({ error: "La IA no devolvió una campaña válida. Probá de nuevo." });
    res.json({ name: String(parsed.name || "Campaña IA").slice(0, 120), template: String(parsed.template).slice(0, 1000) });
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// CATALOG SYNC — pulls real products from the connected store and rewrites
// config.catalog. Works when the store credentials are present in .env.
// ---------------------------------------------------------------------------
app.post("/api/catalog/sync", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const db = getDBAs(user);
    const { data: cfgRow } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
    if (!cfgRow) return res.status(400).json({ error: "Configurá tu negocio primero (Estudio IA)." });
    const store = String(cfgRow.sync_store || "Ninguna");

    let items: { name: string; price: number | string; stock?: number | null }[] = [];

    if (store === "TiendaNube") {
      const storeId = process.env.TIENDANUBE_STORE_ID, token = process.env.TIENDANUBE_TOKEN;
      if (!storeId || !token) return res.status(400).json({ error: "Faltan TIENDANUBE_STORE_ID y TIENDANUBE_TOKEN en el .env" });
      const r = await fetch(`https://api.tiendanube.com/v1/${storeId}/products?per_page=50`, {
        headers: { Authentication: `bearer ${token}`, "User-Agent": "Respondo (respondo.app)" },
      });
      if (!r.ok) return res.status(502).json({ error: `TiendaNube respondió ${r.status}` });
      const products: any[] = await r.json();
      items = products.map((p) => ({
        name: p.name?.es || Object.values(p.name || {})[0] || "Producto",
        price: p.variants?.[0]?.price ?? "?",
        stock: p.variants?.reduce((a: number, v: any) => a + (v.stock ?? 0), 0),
      }));
    } else if (store === "Shopify") {
      const shop = process.env.SHOPIFY_STORE, token = process.env.SHOPIFY_TOKEN;
      if (!shop || !token) return res.status(400).json({ error: "Faltan SHOPIFY_STORE y SHOPIFY_TOKEN en el .env" });
      const r = await fetch(`https://${shop}/admin/api/2024-01/products.json?limit=50`, {
        headers: { "X-Shopify-Access-Token": token },
      });
      if (!r.ok) return res.status(502).json({ error: `Shopify respondió ${r.status}` });
      const data: any = await r.json();
      items = (data.products || []).map((p: any) => ({
        name: p.title,
        price: p.variants?.[0]?.price ?? "?",
        stock: p.variants?.reduce((a: number, v: any) => a + (v.inventory_quantity ?? 0), 0),
      }));
    } else if (store === "WooCommerce") {
      const url = process.env.WOO_URL, key = process.env.WOO_KEY, secret = process.env.WOO_SECRET;
      if (!url || !key || !secret) return res.status(400).json({ error: "Faltan WOO_URL, WOO_KEY y WOO_SECRET en el .env" });
      const r = await fetch(`${url.replace(/\/$/, "")}/wp-json/wc/v3/products?per_page=50&consumer_key=${key}&consumer_secret=${secret}`);
      if (!r.ok) return res.status(502).json({ error: `WooCommerce respondió ${r.status}` });
      const products: any[] = await r.json();
      items = products.map((p) => ({ name: p.name, price: p.price || "?", stock: p.stock_quantity }));
    } else {
      return res.status(400).json({ error: `Elegí una tienda en "Sincronizar Stock & Tienda" (actual: ${store}). MercadoLibre todavía no está soportado.` });
    }

    if (items.length === 0) return res.status(404).json({ error: "La tienda no devolvió productos." });

    const catalog = items
      .map((i) => `- ${i.name}: $${i.price}${i.stock !== undefined && i.stock !== null ? ` (stock: ${i.stock})` : ""}`)
      .join("\n");
    await db.from("respondo_config").update({ catalog }).eq("id", cfgRow.id);

    res.json({ ok: true, store, imported: items.length, catalog });
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// WHATSAPP META API WEBHOOK
// ---------------------------------------------------------------------------
// GET: webhook verification challenge from Meta
app.get("/webhook/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WA_VERIFY_TOKEN) {
    logger.info("WhatsApp webhook verified");
    return res.status(200).send(challenge);
  }
  logger.warn({ mode, token }, "WhatsApp webhook verification failed");
  res.status(403).json({ error: "Verification failed" });
});

// POST: incoming messages from Meta
app.post("/webhook/whatsapp", async (req, res) => {
  // Signature verification (when app secret is configured)
  if (WA_APP_SECRET) {
    const sig = String(req.headers["x-hub-signature-256"] || "");
    const rawBody = JSON.stringify(req.body);
    const expected = "sha256=" + crypto.createHmac("sha256", WA_APP_SECRET).update(rawBody).digest("hex");
    if (sig !== expected) {
      logger.warn("Invalid WhatsApp signature");
      return res.status(403).json({ error: "Invalid signature" });
    }
  }

  // Always acknowledge receipt immediately (Meta requires it)
  res.status(200).json({ status: "received" });

  const body = req.body as any;
  if (body?.object !== "whatsapp_business_account") return;

  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      const messages: any[] = change?.value?.messages || [];
      for (const msg of messages) {
        // Only handle text and audio transcripts for now
        let userText = "";
        if (msg.type === "text") {
          userText = msg.text?.body || "";
        } else if (msg.type === "audio") {
          userText = "[Nota de voz recibida. Responde indicando que podés ayudar por texto mientras procesamos el audio.]";
        } else {
          continue; // Skip other types
        }

        const from = String(msg.from);
        logger.info({ from, type: msg.type }, "WhatsApp message received");

        // Process in background (don't block the 200 response)
        processWhatsAppMessage(from, userText).catch((e) =>
          logger.error({ err: e.message, from }, "WhatsApp processing error")
        );
      }
    }
  }
});

type Channel = "WhatsApp" | "Instagram" | "Facebook" | "Email";

// Unified inbound-message handler for every Meta channel. Looks the lead up
// by its per-channel external id (phone for WhatsApp, PSID for Messenger/IG),
// runs the AI, persists the conversation, and sends the reply back.
async function processInboundMessage(opts: {
  channel: Channel;
  externalId: string;
  text: string;
  send: (text: string) => Promise<void>;
  sendImage?: (url: string, caption?: string) => Promise<void>;
}) {
  const { channel, externalId, text, send, sendImage } = opts;
  const db = getDB();

  // Config
  const { data: configRow } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
  const config = configRow ? mapConfigFromDB(configRow) : { businessName: "Respondo", businessType: "", catalog: "", tone: "Argentino/Cercano" };

  // Find the lead by external id within the same channel. WhatsApp also matches
  // by phone for backwards compatibility with leads created before external_id.
  let existingLead: any = null;
  {
    const { data } = await db.from("respondo_leads").select("*")
      .eq("external_id", externalId).eq("origin", channel).limit(1).maybeSingle();
    existingLead = data;
  }
  if (!existingLead && channel === "WhatsApp") {
    const { data } = await db.from("respondo_leads").select("*").eq("phone", externalId).limit(1).maybeSingle();
    existingLead = data;
  }

  const history: any[] = (existingLead?.conversation_history || []).slice(-20);

  // HUMAN HANDOFF: if a human took over this chat, store the inbound message
  // and notify — the AI stays silent until re-activated from the inbox.
  if (existingLead?.ai_paused) {
    const nowPaused = new Date().toISOString();
    const pausedHistory = [...(existingLead.conversation_history || []), { role: "user", text, timestamp: nowPaused }];
    await db.from("respondo_leads").update({
      conversation_history: pausedHistory,
      last_interaction: nowPaused,
    }).eq("id", existingLead.id);
    db.from("respondo_chat_events").insert({
      event_type: "human_needed", channel,
      payload: { leadId: existingLead.id, name: existingLead.name, text: text.slice(0, 200) },
      owner_id: existingLead.owner_id ?? null,
    }).then(() => {});
    logger.info({ leadId: existingLead.id, channel }, "AI paused for lead — inbound stored, no auto-reply");
    return;
  }

  // Run AI
  const { text: aiReply, actions } = await runChat(text, history, config);

  const now = new Date().toISOString();
  const newHistory = [
    ...history,
    { role: "user", text, timestamp: now },
    { role: "model", text: aiReply, timestamp: now },
  ];
  const userMsgs = newHistory.filter((m: any) => m.role === "user").map((m: any) => m.text).join(" ");
  const score = computeLeadScore(newHistory.length, userMsgs);

  if (existingLead) {
    await db.from("respondo_leads").update({
      conversation_history: newHistory,
      last_interaction: now,
      status: existingLead.status === "Nuevo" ? "Contactado" : existingLead.status,
      score,
      external_id: existingLead.external_id || externalId,
    }).eq("id", existingLead.id);
  } else {
    await db.from("respondo_leads").insert({
      name: `${channel} ${externalId.slice(-6)}`,
      phone: channel === "WhatsApp" ? externalId : "",
      external_id: externalId,
      status: "Contactado",
      origin: channel,
      // Inbound channel leads belong to the connected business (config owner)
      owner_id: (configRow as any)?.owner_id ?? null,
      conversation_history: newHistory,
      score,
      notes: `Primera consulta: "${text.substring(0, 100)}"`,
      avatar: makeAvatarUrl(externalId),
    });
  }

  // Log tool-use actions + apply AI score/tag to the current lead
  for (const action of actions) {
    if (["upsert_lead", "update_lead_status", "score_lead", "tag_lead"].includes(action.type)) {
      db.from("respondo_chat_events").insert({
        event_type: action.type, channel, payload: action.payload,
      }).then(() => {});
    }
    try {
      if (action.type === "score_lead") {
        const s = Math.max(0, Math.min(100, Math.round(Number(action.payload.score) || 0)));
        await db.from("respondo_leads").update({ score: s }).eq("external_id", externalId);
      } else if (action.type === "tag_lead" && action.payload.categoria) {
        await db.from("respondo_leads").update({ category: String(action.payload.categoria) }).eq("external_id", externalId);
      }
    } catch { /* non-critical */ }
  }

  // Reply via the channel-specific sender
  try {
    await send(aiReply);
  } catch (e) {
    logger.error({ err: (e as Error).message, channel }, "channel reply failed");
  }

  // Product photos requested by the AI (enviar_foto tool) go out after the text
  if (sendImage) {
    for (const action of actions) {
      if (action.type === "send_image" && action.payload?.url) {
        await sendImage(String(action.payload.url), String(action.payload.producto || "")).catch((e) =>
          logger.warn({ err: (e as Error).message }, "channel image send failed"));
      }
    }
  }
}

// Thin wrapper kept for the WhatsApp webhook
async function processWhatsAppMessage(phone: string, text: string) {
  await processInboundMessage({
    channel: "WhatsApp",
    externalId: phone,
    text,
    sendImage: async (url, caption) => {
      if (WA_TOKEN && WA_PHONE_ID) await sendWhatsAppImage(phone, url, caption);
    },
    send: async (reply) => {
      if (WA_TOKEN && WA_PHONE_ID) await sendWhatsAppMessage(phone, reply);
      else logger.warn("WHATSAPP_TOKEN/PHONE_ID not set — reply not sent");
    },
  });
}

async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logger.error({ status: res.status, err }, "Meta API send failed");
  } else {
    logger.info({ to }, "WhatsApp reply sent");
  }
}

// Send an image (product photo) via WhatsApp Cloud API
async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string) {
  const url = `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, ...(caption ? { caption } : {}) },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logger.error({ status: res.status, err }, "WhatsApp image send failed");
  } else {
    logger.info({ to }, "WhatsApp image sent");
  }
}

// Send a Meta-approved template message (required OUTSIDE the 24h window)
async function sendWhatsAppTemplate(to: string, templateName: string, langCode = "es_AR", bodyParams: string[] = []) {
  const url = `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: langCode },
        ...(bodyParams.length ? { components: [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: t })) }] } : {}),
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logger.error({ status: res.status, err, templateName }, "WhatsApp template send failed");
    throw new Error(`Template send failed (${res.status})`);
  }
  logger.info({ to, templateName }, "WhatsApp template sent");
}

// (isInside24hWindow vive en serverHelpers.ts para poder testearlo)

// Send a message via the Messenger Send API (used for both Facebook Messenger
// and Instagram Direct — they share the same endpoint and token model).
async function sendMessengerMessage(recipientId: string, text: string, token: string) {
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logger.error({ status: res.status, err }, "Messenger send failed");
  } else {
    logger.info({ recipientId }, "Messenger reply sent");
  }
}

// ---------------------------------------------------------------------------
// FACEBOOK MESSENGER + INSTAGRAM DIRECT WEBHOOK (shared page webhook)
// ---------------------------------------------------------------------------
// GET: verification challenge (reuses the same verify token as WhatsApp)
app.get("/webhook/messenger", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WA_VERIFY_TOKEN) {
    logger.info("Messenger/Instagram webhook verified");
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: "Verification failed" });
});

// POST: incoming messages. Meta sends object="page" for Messenger and
// object="instagram" for Instagram Direct, both with entry[].messaging[].
app.post("/webhook/messenger", async (req, res) => {
  if (WA_APP_SECRET) {
    const sig = String(req.headers["x-hub-signature-256"] || "");
    const expected = "sha256=" + crypto.createHmac("sha256", WA_APP_SECRET).update(JSON.stringify(req.body)).digest("hex");
    if (sig !== expected) {
      logger.warn("Invalid Messenger signature");
      return res.status(403).json({ error: "Invalid signature" });
    }
  }

  res.status(200).json({ status: "received" }); // ack immediately

  const body = req.body as any;
  const channel: Channel = body?.object === "instagram" ? "Instagram" : "Facebook";
  const token = channel === "Instagram" ? (IG_TOKEN || FB_PAGE_TOKEN) : FB_PAGE_TOKEN;

  for (const entry of (body?.entry || [])) {
    for (const event of (entry.messaging || [])) {
      // Ignore echoes (our own outgoing messages) and non-message events
      if (event?.message?.is_echo) continue;
      const senderId = event?.sender?.id;
      const text = event?.message?.text;
      if (!senderId || !text) continue;

      logger.info({ senderId, channel }, "Messenger/IG message received");
      processInboundMessage({
        channel,
        externalId: String(senderId),
        text,
        send: async (reply) => {
          if (token) await sendMessengerMessage(String(senderId), reply, token);
          else logger.warn(`${channel} token not set — reply not sent`);
        },
      }).catch((e) => logger.error({ err: e.message, channel }, "Messenger processing error"));
    }
  }
});

// ---------------------------------------------------------------------------
// EMAIL CHANNEL (inbound webhook + outbound via Resend API)
// ---------------------------------------------------------------------------
// Send an email reply. Uses Resend's HTTP API so no SMTP dependency is needed.
async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY || !EMAIL_USER) {
    logger.warn("RESEND_API_KEY/EMAIL_USER not set — email reply not sent");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_USER,
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    logger.error({ status: res.status, err: err.slice(0, 200) }, "Resend email send failed");
  } else {
    logger.info({ to }, "Email reply sent");
  }
}

// Inbound email webhook. Compatible with common inbound-parse providers
// (SendGrid, Mailgun, Resend, Postmark) — we read sender, subject and text
// from the most common field names.
app.post("/webhook/email", async (req, res) => {
  res.status(200).json({ status: "received" }); // ack immediately

  const b = req.body as any;
  const from: string = b.from || b.sender || b.From || b["from_email"] || "";
  const subjectIn: string = b.subject || b.Subject || "Tu consulta";
  const text: string = b.text || b["body-plain"] || b.plain || b.TextBody || b.html || "";

  // Extract a bare email address from a "Name <email>" header
  const emailMatch = String(from).match(/[\w.+-]+@[\w.-]+\.\w+/);
  const senderEmail = emailMatch ? emailMatch[0] : String(from).trim();
  if (!senderEmail || !text) {
    logger.warn({ from }, "Email webhook missing sender or text");
    return;
  }

  logger.info({ senderEmail }, "Email message received");
  processInboundMessage({
    channel: "Email",
    externalId: senderEmail,
    text: String(text).slice(0, 4000),
    send: async (reply) => {
      const subject = subjectIn.toLowerCase().startsWith("re:") ? subjectIn : `Re: ${subjectIn}`;
      await sendEmail(senderEmail, subject, reply);
    },
  }).catch((e) => logger.error({ err: e.message }, "Email processing error"));
});

// ---------------------------------------------------------------------------
// WEBHOOK TEST
// ---------------------------------------------------------------------------
app.post("/api/test-webhook", async (req, res) => {
  try {
    const user = await requireUser(req, res); if (!user) return;
    const { phone } = z.object({ phone: z.string().min(7).max(20) }).parse(req.body);
    if (!WA_TOKEN || !WA_PHONE_ID) {
      return res.json({ ok: false, reason: "WhatsApp no configurado (WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID faltante)" });
    }
    await sendWhatsAppMessage(phone, "✅ Test de integración Respondo ↔ WhatsApp exitoso. ¡El agente está listo para operar!");
    res.json({ ok: true, phone });
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// VITE MIDDLEWARE & STATIC SERVING
// ---------------------------------------------------------------------------
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createVite } = await import("vite");
    const vite = await createVite({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
    logger.info("Vite dev middleware mounted");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
    logger.info("Serving static assets");
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info({ port: PORT, model: GEMINI_MODEL }, "Respondo server running");
  });

  // Auto-run follow-ups every 30 minutes (only when WhatsApp is configured)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    setInterval(async () => {
      // Auto follow-ups only fire when a real channel can send them
      if (!(WA_TOKEN && WA_PHONE_ID)) return;
      try {
        const db = getDB();
        // Multi-account: run follow-ups per business (each config row = one account)
        const { data: configRows } = await db.from("respondo_config").select("*");
        let contacted = 0;
        for (const configRow of (configRows || [])) {
          const cfg = mapConfigFromDB(configRow);
          const followUpMinutes = cfg?.autoFollowUpMinutes ?? 30;
          const cutoff = new Date(Date.now() - followUpMinutes * 60 * 1000).toISOString();
          let staleQuery = db.from("respondo_leads")
            .select("id,name,phone,status,ai_paused,conversation_history")
            .neq("status", "Cerrado")
            .lt("last_interaction", cutoff)
            .limit(20);
          staleQuery = (configRow as any).owner_id
            ? staleQuery.eq("owner_id", (configRow as any).owner_id)
            : staleQuery.is("owner_id", null);
          const { data: stale } = await staleQuery;
          for (const lead of (stale || [])) {
            if (!lead.phone) continue;
            if ((lead as any).ai_paused) continue; // human took over — stay silent
            // Meta rule: free-form messages only inside the 24h service window
            if (!isInside24hWindow(lead.conversation_history)) continue;
            const now = new Date().toISOString();
            // Personalized, AI-crafted follow-up per lead (stage-aware: quoted
            // leads get an abandoned-cart recovery angle)
            const followUpMsg = await craftFollowUp(lead, cfg);
            const history = Array.isArray(lead.conversation_history) ? lead.conversation_history : [];
            history.push({ role: "model", text: followUpMsg, timestamp: now });
            await db.from("respondo_leads").update({ last_interaction: now, conversation_history: history }).eq("id", lead.id);
            await sendWhatsAppMessage(lead.phone, followUpMsg).catch(() => {});
            contacted++;
          }
        }
        if (contacted > 0) logger.info({ contacted }, "Auto follow-ups sent");
      } catch (e) {
        logger.warn({ err: (e as Error).message }, "Auto follow-up run failed");
      }
    }, 30 * 60 * 1000); // every 30 minutes
    logger.info("Auto follow-up scheduler started (30 min interval)");
  }
};

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
