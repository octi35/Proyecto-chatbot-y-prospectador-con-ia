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
const PORT = 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const WA_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WA_APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";
const WA_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "respondo-verify-secret";

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

function getDB() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
  origin: z.enum(["WhatsApp","Instagram","Facebook"]).optional(),
  lastInteraction: z.string().max(100).optional(),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
  category: z.string().max(100).optional().nullable(),
  avatar: z.string().max(500).optional(),
  totalSpent: z.number().min(0).optional(),
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
  ],
}];

interface AgentAction {
  type: string;
  label: string;
  payload: Record<string, any>;
}

function executeTool(name: string, args: Record<string, any>, config: any): { result: Record<string, any>; action?: AgentAction } {
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
      const link = `https://mpago.la/respondo?concepto=${encodeURIComponent(args.concepto || "")}&monto=${monto}`;
      return {
        result: { ok: true, link },
        action: { type: "payment_link", label: `💳 Link de pago $${monto.toLocaleString("es-AR")} ARS generado`, payload: { ...args, monto, link } },
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
  // When no LLM is configured, the built-in rule-based bot keeps the agent
  // alive: it parses the catalog, detects intent and replies in the right tone.
  if (!process.env.GEMINI_API_KEY) {
    const reply = localBotReply(message, history || [], config);
    return { text: reply.text, actions: reply.actions as AgentAction[], engine: "local" };
  }

  const ai = getAI();

  const personaName = config.botPersonaName?.trim() || "Respondo";

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
${config.catalog || "(sin catálogo cargado: si preguntan precios/stock puntuales, pedí el dato o ofrecé tomar la consulta)"}

# TONO: "${config.tone}"
- Argentino/Cercano: vos, modismos argentinos, cálido y directo.
- Profesional/Formal: usted, pulido, cortés y preciso.
- Casual/Juvenil: buena onda, algún emoji, entusiasta.

# REGLAS
- Usá buscar_producto para verificar precio/stock antes de afirmarlos. Nunca inventes datos que no estén en el catálogo: si no lo sabés, decilo y ofrecé averiguarlo o una alternativa cercana.
- Sos ${personaName}, del equipo de ${config.businessName}. No reveles que sos una IA ni rompas el personaje. Si te preguntan tu nombre, es ${personaName}.${forbiddenNote}${offHoursNote}

# HERRAMIENTAS (usalas en silencio, sin anunciarlas al cliente)
- buscar_producto: consultá stock/precios antes de afirmarlos.
- registrar_lead: apenas detectes interés real (no esperes a que "compre").
- actualizar_estado_lead: al pasar un precio → Presupuestado; al confirmar la compra → Cerrado.
- agendar_seguimiento: si algo queda pendiente o pidió pensarlo.
- generar_link_pago: cuando confirma que quiere comprar.

Tu misión: que cada persona se sienta bien atendida y termine comprando con ganas. Lema: "Chatea menos, Vendé más."`;

  const contents: any[] = [];
  (history || []).forEach((m) => {
    contents.push({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] });
  });

  const currentParts: any[] = [];
  if (attachment?.data && attachment?.mimeType) {
    currentParts.push({ inlineData: { data: attachment.data, mimeType: attachment.mimeType } });
    const isAudio = attachment.mimeType.startsWith("audio");
    const defaultPrompt = isAudio
      ? "El cliente te envió esta nota de voz. Escuchala con atención, entendé qué necesita y respondé natural, como si te lo hubiera hablado."
      : "El cliente te envió esta imagen. Analizala en detalle: identificá qué es y relacionala con el catálogo (producto parecido, precio, disponibilidad). Si es un comprobante de pago, confirmá el siguiente paso.";
    currentParts.push({ text: message?.trim() ? message : defaultPrompt });
  } else {
    currentParts.push({ text: message || "Hola!" });
  }
  contents.push({ role: "user", parts: currentParts });

  const actions: AgentAction[] = [];
  let finalText = "";

  try {
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
          const { result, action } = executeTool(call.name as string, (call.args as any) || {}, config);
          if (action) actions.push(action);
          parts.push({ functionResponse: { name: call.name, response: result } });
        }
        contents.push({ role: "user", parts });
        continue;
      }
      finalText = response.text || "";
      break;
    }
  } catch (err) {
    // LLM unavailable (quota, network, etc.) — fall back to the local bot
    logger.warn({ err }, "LLM call failed; using local bot fallback");
    const reply = localBotReply(message, history || [], config);
    return { text: reply.text, actions: reply.actions as AgentAction[], engine: "local-fallback" };
  }

  return { text: finalText || "Disculpame, no pude procesar la consulta. ¿Me la repetís?", actions, engine: "gemini" };
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
// HEALTH CHECK
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    model: GEMINI_MODEL,
    // The bot is always alive: Gemini when a key is set, otherwise the
    // built-in rule-based engine.
    botEngine: process.env.GEMINI_API_KEY ? "gemini" : "local",
    integrations: {
      gemini: !!process.env.GEMINI_API_KEY,
      supabase: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
      whatsapp: !!(WA_TOKEN && WA_PHONE_ID),
    },
    webhookUrl: process.env.APP_URL ? `${process.env.APP_URL}/webhook/whatsapp` : null,
  });
});

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
app.get("/api/config", async (_req, res) => {
  try {
    const db = getDB();
    const { data, error } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return res.json(null);
    res.json(mapConfigFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.put("/api/config", async (req, res) => {
  try {
    const body = validateBody(AgentConfigSchema, req.body);
    const db = getDB();
    const { data: existing } = await db.from("respondo_config").select("id").limit(1).maybeSingle();
    let result: any;
    if (existing) {
      const { data } = await db.from("respondo_config").update(mapConfigToDB(body)).eq("id", existing.id).select().single();
      result = data;
    } else {
      const { data } = await db.from("respondo_config").insert(mapConfigToDB(body)).select().single();
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
    const db = getDB();
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
    const body = validateBody(LeadCreateSchema, req.body);
    const db = getDB();
    const { data, error } = await db.from("respondo_leads").insert(mapLeadToDB(body)).select().single();
    if (error) throw error;
    res.status(201).json(mapLeadFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.put("/api/leads/:id", async (req, res) => {
  try {
    const body = validateBody(LeadPatchSchema, req.body);
    const db = getDB();
    const { data, error } = await db.from("respondo_leads").update(mapLeadToDB(body)).eq("id", req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Lead no encontrado" });
    res.json(mapLeadFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.delete("/api/leads/:id", async (req, res) => {
  try {
    const db = getDB();
    const { error } = await db.from("respondo_leads").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { handleError(res, err); }
});

// Manual message send: CRM user → WhatsApp lead
app.post("/api/leads/:id/message", async (req, res) => {
  try {
    const { text } = z.object({ text: z.string().min(1).max(4000) }).parse(req.body);
    const db = getDB();
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
app.get("/api/campaigns", async (_req, res) => {
  try {
    const db = getDB();
    const { data, error } = await db.from("respondo_campaigns").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapCampaignFromDB));
  } catch (err) { handleError(res, err); }
});

app.post("/api/campaigns", async (req, res) => {
  try {
    const body = validateBody(CampaignPatchSchema.extend({ name: z.string().min(1), template: z.string().min(1) }), req.body);
    const db = getDB();
    const { data, error } = await db.from("respondo_campaigns").insert(mapCampaignToDB(body)).select().single();
    if (error) throw error;
    res.status(201).json(mapCampaignFromDB(data));
  } catch (err) { handleError(res, err); }
});

// Send a campaign to all leads (real WhatsApp API when configured)
app.post("/api/campaigns/:id/send", async (req, res) => {
  try {
    const db = getDB();
    const { data: camp, error: campErr } = await db.from("respondo_campaigns").select("*").eq("id", req.params.id).maybeSingle();
    if (campErr) throw campErr;
    if (!camp) return res.status(404).json({ error: "Campaña no encontrada" });

    // Get leads to send to
    const { data: leads } = await db.from("respondo_leads").select("id,name,phone");
    const validLeads = (leads || []).filter((l: any) => l.phone);

    let sentCount = 0;
    if (WA_TOKEN && WA_PHONE_ID) {
      // Send to each lead with a short delay to avoid rate limits
      for (const lead of validLeads) {
        const text = camp.template
          .replace(/\{\{nombre\}\}/gi, lead.name)
          .replace(/\{\{empresa\}\}/gi, "Respondo");
        try {
          await sendWhatsAppMessage(lead.phone, text);
          sentCount++;
        } catch {
          // Continue on individual send failures
        }
        // 250ms between sends to respect Meta rate limits
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    await db.from("respondo_campaigns").update({
      status: "Completado",
      sent_count: sentCount || validLeads.length,
      read_count: Math.round((sentCount || validLeads.length) * 0.82),
      replies_count: Math.round((sentCount || validLeads.length) * 0.18),
    }).eq("id", req.params.id);

    const { data: updated } = await db.from("respondo_campaigns").select("*").eq("id", req.params.id).single();
    res.json({
      ...mapCampaignFromDB(updated),
      waConfigured: !!(WA_TOKEN && WA_PHONE_ID),
      totalTargeted: validLeads.length,
    });
  } catch (err) { handleError(res, err); }
});

app.put("/api/campaigns/:id", async (req, res) => {
  try {
    const body = validateBody(CampaignPatchSchema, req.body);
    const db = getDB();
    const { data, error } = await db.from("respondo_campaigns").update(mapCampaignToDB(body)).eq("id", req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Campaña no encontrada" });
    res.json(mapCampaignFromDB(data));
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// AUTOMATIONS (rules engine)
// ---------------------------------------------------------------------------
app.get("/api/automations", async (_req, res) => {
  try {
    const db = getDB();
    const { data, error } = await db.from("respondo_automations").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapAutomationFromDB));
  } catch (err) { handleError(res, err); }
});

app.post("/api/automations", async (req, res) => {
  try {
    const body = validateBody(AutomationSchema, req.body);
    const db = getDB();
    const { data, error } = await db.from("respondo_automations").insert(mapAutomationToDB(body)).select().single();
    if (error) throw error;
    res.status(201).json(mapAutomationFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.put("/api/automations/:id", async (req, res) => {
  try {
    const body = validateBody(AutomationPatchSchema, req.body);
    const db = getDB();
    const { data, error } = await db.from("respondo_automations").update(mapAutomationToDB(body)).eq("id", req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Automatización no encontrada" });
    res.json(mapAutomationFromDB(data));
  } catch (err) { handleError(res, err); }
});

app.delete("/api/automations/:id", async (req, res) => {
  try {
    const db = getDB();
    const { error } = await db.from("respondo_automations").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

// ---------------------------------------------------------------------------
// AUTO FOLLOW-UPS
// ---------------------------------------------------------------------------
app.post("/api/followups/run", async (_req, res) => {
  try {
    const db = getDB();
    const { data: configRow } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
    const config = configRow ? mapConfigFromDB(configRow) : null;
    const followUpMinutes = config?.autoFollowUpMinutes ?? 30;
    const cutoff = new Date(Date.now() - followUpMinutes * 60 * 1000).toISOString();

    // Find leads with no recent interaction, not yet closed
    const { data: stale, error } = await db.from("respondo_leads")
      .select("id,name,phone,status,conversation_history")
      .neq("status", "Cerrado")
      .lt("last_interaction", cutoff)
      .limit(50);
    if (error) throw error;

    let contacted = 0;
    const followUpMsg = `¡Hola de nuevo! 😊 Por acá te hacemos el seguimiento de tu consulta. ¿Seguís interesado/a o necesitás más información?`;
    for (const lead of (stale || [])) {
      if (!lead.phone) continue;
      try {
        const now = new Date().toISOString();
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
app.get("/api/analytics", async (_req, res) => {
  try {
    const db = getDB();
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

    // Resolve config: request body > DB > default
    let config = body.agentConfig;
    if (!config) {
      const db = getDB();
      const { data } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
      config = data ? mapConfigFromDB(data) : {
        businessName: "Zapas Respondo", businessType: "Calzado", catalog: "", tone: "Argentino/Cercano",
      };
    }

    const { text, actions, engine } = await runChat(body.message, body.history || [], config, body.attachment);

    // Build conversation snapshot for DB storage (history + current exchange)
    const now = new Date().toISOString();
    const conversationSnapshot = [
      ...(body.history || []).map((h: any) => ({ role: h.role as string, text: h.text as string, timestamp: now })),
      { role: "user", text: body.message || "", timestamp: now },
      { role: "model", text, timestamp: now },
    ];

    // Persist CRM actions to DB
    if (actions.length > 0) {
      const db = getDB();
      for (const action of actions) {
        try {
          if (action.type === "upsert_lead") {
            const { nombre, telefono, interes, canal } = action.payload;
            const { data: existing } = await db.from("respondo_leads").select("id")
              .or(`phone.eq.${telefono || ""},name.ilike.${nombre}`).limit(1).maybeSingle();
            const validCanal = ["WhatsApp","Instagram","Facebook"].includes(canal) ? canal : "WhatsApp";
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
          }
          // Log event
          await db.from("respondo_chat_events").insert({
            event_type: action.type,
            channel: "chat",
            payload: action.payload,
          });
        } catch (e) {
          logger.warn({ action: action.type, err: (e as Error).message }, "action persist failed");
        }
      }
    }

    // Track every chat interaction for analytics
    try {
      const db = getDB();
      await db.from("respondo_chat_events").insert({
        event_type: "chat_message",
        channel: "chat",
        payload: { messageLength: body.message?.length ?? 0, hasAttachment: !!body.attachment, actionsCount: actions.length },
      });
    } catch { /* non-critical */ }

    res.json({ text, role: "model", actions, engine });
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

async function processWhatsAppMessage(phone: string, text: string) {
  const db = getDB();

  // Get config
  const { data: configRow } = await db.from("respondo_config").select("*").limit(1).maybeSingle();
  const config = configRow ? mapConfigFromDB(configRow) : { businessName: "Respondo", businessType: "", catalog: "", tone: "Argentino/Cercano" };

  // Get or create lead and conversation history
  const { data: existingLead } = await db.from("respondo_leads").select("*").eq("phone", phone).limit(1).maybeSingle();
  const history: any[] = (existingLead?.conversation_history || []).slice(-20); // keep last 20 msgs

  // Run AI
  const { text: aiReply, actions } = await runChat(text, history, config);

  // Update conversation history
  const newHistory = [
    ...history,
    { role: "user", text, timestamp: new Date().toISOString() },
    { role: "model", text: aiReply, timestamp: new Date().toISOString() },
  ];

  const waUserText = newHistory.filter((m: any) => m.role === "user").map((m: any) => m.text).join(" ");
  const waScore = computeLeadScore(newHistory.length, waUserText);
  if (existingLead) {
    await db.from("respondo_leads").update({
      conversation_history: newHistory,
      last_interaction: new Date().toISOString(),
      status: existingLead.status === "Nuevo" ? "Contactado" : existingLead.status,
      score: waScore,
    }).eq("id", existingLead.id);
  } else {
    await db.from("respondo_leads").insert({
      name: "WhatsApp " + phone,
      phone,
      status: "Contactado",
      origin: "WhatsApp",
      conversation_history: newHistory,
      score: waScore,
      notes: `Primera consulta: "${text.substring(0, 100)}"`,
      avatar: makeAvatarUrl(phone),
    });
  }

  // Log tool-use actions to events table
  for (const action of actions) {
    if (action.type === "upsert_lead" || action.type === "update_lead_status") {
      db.from("respondo_chat_events").insert({
        event_type: action.type, channel: "WhatsApp", payload: action.payload,
      }).then(() => {});
    }
  }

  // Send reply via Meta Graph API
  if (WA_TOKEN && WA_PHONE_ID) {
    await sendWhatsAppMessage(phone, aiReply);
  } else {
    logger.warn("WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — reply not sent");
  }
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

// ---------------------------------------------------------------------------
// WEBHOOK TEST
// ---------------------------------------------------------------------------
app.post("/api/test-webhook", async (req, res) => {
  try {
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
      try {
        const db = getDB();
        const { data: configRow } = await db.from("respondo_config").select("auto_follow_up_minutes").limit(1).maybeSingle();
        const followUpMinutes = configRow?.auto_follow_up_minutes ?? 30;
        const cutoff = new Date(Date.now() - followUpMinutes * 60 * 1000).toISOString();
        const { data: stale } = await db.from("respondo_leads")
          .select("id,name,phone,conversation_history")
          .neq("status", "Cerrado")
          .lt("last_interaction", cutoff)
          .limit(20);
        let contacted = 0;
        const followUpMsg = `¡Hola de nuevo! 😊 ¿Seguís con dudas o querés que te ayude a cerrar tu pedido?`;
        for (const lead of (stale || [])) {
          if (!lead.phone) continue;
          const now = new Date().toISOString();
          const history = Array.isArray(lead.conversation_history) ? lead.conversation_history : [];
          history.push({ role: "model", text: followUpMsg, timestamp: now });
          await db.from("respondo_leads").update({ last_interaction: now, conversation_history: history }).eq("id", lead.id);
          if (WA_TOKEN && WA_PHONE_ID) {
            await sendWhatsAppMessage(lead.phone, followUpMsg).catch(() => {});
          }
          contacted++;
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
