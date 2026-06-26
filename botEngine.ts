// ---------------------------------------------------------------------------
// LOCAL BOT ENGINE
// ---------------------------------------------------------------------------
// A self-contained, rule-based sales bot that works WITHOUT any external LLM.
// It parses the catalog, detects user intent, and crafts tone-aware replies,
// emitting the same CRM actions (lead registration, payment links) the
// Gemini path produces. When GEMINI_API_KEY is configured, the LLM takes over
// and this engine becomes the graceful fallback — so the bot is always "alive".
// ---------------------------------------------------------------------------

export interface BotAction {
  type: "upsert_lead" | "update_lead_status" | "schedule_followup" | "payment_link";
  label: string;
  payload: Record<string, any>;
}

export interface BotReply {
  text: string;
  actions: BotAction[];
}

export interface BotConfig {
  businessName?: string;
  businessType?: string;
  catalog?: string;
  tone?: string;
  customGreeting?: string;
  botPersonaName?: string;
  forbiddenTopics?: string;
  workingHoursStart?: number;
  workingHoursEnd?: number;
}

interface Product {
  name: string;
  price: number;
  priceText: string;
  attributes: string;
  raw: string;
}

// ---------------------------------------------------------------------------
// Catalog parsing
// ---------------------------------------------------------------------------
export function parseCatalog(catalog: string): Product[] {
  const lines = (catalog || "")
    .replace(/\s*\{foto:[^}]+\}/gi, "") // drop visual-editor photo markers
    .split("\n")
    .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);

  return lines.map((raw) => {
    // Name is everything before the first colon (if any)
    const colonIdx = raw.indexOf(":");
    const name = colonIdx > -1 ? raw.slice(0, colonIdx).trim() : raw.trim();
    const rest = colonIdx > -1 ? raw.slice(colonIdx + 1).trim() : "";

    // Price: first $-number found
    const priceMatch = rest.match(/\$\s?([\d.]+)/) || raw.match(/\$\s?([\d.]+)/);
    const priceText = priceMatch ? priceMatch[0].trim() : "";
    const price = priceMatch ? parseInt(priceMatch[1].replace(/\./g, ""), 10) || 0 : 0;

    // Attributes: text inside parentheses, or rest after the price
    const parenMatch = rest.match(/\(([^)]+)\)/);
    const attributes = parenMatch ? parenMatch[1].trim() : rest.replace(priceText, "").trim();

    return { name, price, priceText, attributes, raw };
  });
}

// Score how well a product matches the user's words
function matchProduct(products: Product[], message: string): Product | null {
  const msg = message.toLowerCase();
  const words = msg.split(/\s+/).filter((w) => w.length > 2);
  let best: { p: Product; score: number } | null = null;

  for (const p of products) {
    const hay = `${p.name} ${p.attributes}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (hay.includes(w)) score += w.length >= 4 ? 2 : 1;
    }
    // Strong boost when a full word of the product name appears
    for (const nameWord of p.name.toLowerCase().split(/\s+/)) {
      if (nameWord.length > 2 && msg.includes(nameWord)) score += 3;
    }
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best ? best.p : null;
}

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------
type Intent =
  | "greeting"
  | "price"
  | "availability"
  | "purchase"
  | "payment"
  | "shipping"
  | "thanks"
  | "goodbye"
  | "forbidden"
  | "unknown";

const KEYWORDS: Record<Exclude<Intent, "forbidden" | "unknown">, string[]> = {
  greeting: ["hola", "buenas", "buen día", "buen dia", "buenos días", "buenas tardes", "buenas noches", "qué tal", "que tal", "holis", "ola"],
  price: ["precio", "cuánto", "cuanto", "sale", "vale", "cuesta", "costo", "valor", "$"],
  availability: ["tenés", "tenes", "hay", "stock", "disponible", "queda", "talle", "talles", "color", "colores", "modelo", "medida", "número", "numero", "tienen"],
  purchase: ["quiero", "comprar", "lo llevo", "la llevo", "dame", "reservar", "reservá", "me lo llevo", "lo quiero", "me interesa", "necesito"],
  payment: ["pagar", "pago", "transferencia", "tarjeta", "efectivo", "cuotas", "link de pago", "abonar", "seña", "señar"],
  shipping: ["envío", "envio", "delivery", "mandar", "llega", "enviás", "envias", "domicilio", "correo", "retiro"],
  thanks: ["gracias", "genial", "buenísimo", "buenisimo", "perfecto", "dale gracias"],
  goodbye: ["chau", "adiós", "adios", "nada más", "nada mas", "listo", "después veo", "despues veo", "lo pienso"],
};

function detectIntent(message: string, forbiddenTopics?: string): Intent {
  const msg = message.toLowerCase();

  // Forbidden topics take precedence
  if (forbiddenTopics) {
    const topics = forbiddenTopics.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (topics.some((t) => t && msg.includes(t))) return "forbidden";
  }

  // Priority order: purchase/payment intents matter most for sales
  const order: Exclude<Intent, "forbidden" | "unknown">[] = [
    "payment", "purchase", "price", "availability", "shipping", "greeting", "thanks", "goodbye",
  ];
  for (const intent of order) {
    if (KEYWORDS[intent].some((kw) => msg.includes(kw))) return intent;
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Tone-aware phrasing helpers
// ---------------------------------------------------------------------------
type Tone = "argentino" | "formal" | "casual";

function resolveTone(tone?: string): Tone {
  const t = (tone || "").toLowerCase();
  if (t.includes("formal") || t.includes("profesional")) return "formal";
  if (t.includes("casual") || t.includes("juvenil")) return "casual";
  return "argentino";
}

function closingPhrase(tone: Tone): string {
  switch (tone) {
    case "formal": return "¿Desea que se lo reserve?";
    case "casual": return "¿Te lo aparto? 🙌";
    default: return "¿Te lo reservo así te lo aseguro?";
  }
}

function emoji(tone: Tone, e: string): string {
  return tone === "formal" ? "" : ` ${e}`;
}

// ---------------------------------------------------------------------------
// Main entry: generate a reply from a single user message + history
// ---------------------------------------------------------------------------
export function localBotReply(
  message: string,
  history: { role: string; text: string }[],
  config: BotConfig
): BotReply {
  const tone = resolveTone(config.tone);
  const persona = config.botPersonaName?.trim() || "Respondo";
  const business = config.businessName || "nuestro negocio";
  const products = parseCatalog(config.catalog || "");
  const actions: BotAction[] = [];

  // Off-hours awareness
  let offHoursPrefix = "";
  if (config.workingHoursStart !== undefined && config.workingHoursEnd !== undefined) {
    const h = new Date().getHours();
    const inHours = h >= config.workingHoursStart && h < config.workingHoursEnd;
    if (!inHours) {
      offHoursPrefix = tone === "formal"
        ? `Le informo que en este momento estamos fuera del horario de atención (${config.workingHoursStart}:00 a ${config.workingHoursEnd}:00 hs), pero le respondo igual. `
        : `Te aviso que ahora estamos fuera de horario (${config.workingHoursStart} a ${config.workingHoursEnd} hs), pero te ayudo igual.${emoji(tone, "🙂")} `;
    }
  }

  const intent = detectIntent(message, config.forbiddenTopics);
  // Match against the current message; if nothing matches, fall back to the
  // most recently discussed product so short follow-ups keep their context.
  const matched = matchProduct(products, message) || lastProductFromHistory(history, products);
  const isFirstTurn = history.filter((m) => m.role === "user").length === 0;
  // Name detection should also consider the current message
  const historyWithCurrent = [...history, { role: "user", text: message }];

  let text = "";

  switch (intent) {
    case "forbidden": {
      text = tone === "formal"
        ? "Disculpe, ese no es un tema que pueda tratar. ¿Puedo ayudarle con nuestros productos o servicios?"
        : `Uh, eso no es algo que pueda tratar.${emoji(tone, "🙏")} Pero contame qué estás buscando y te ayudo con eso.`;
      break;
    }

    case "greeting": {
      const greet = config.customGreeting?.trim();
      if (greet && isFirstTurn) {
        text = greet;
      } else {
        text = tone === "formal"
          ? `¡Hola! Soy ${persona}, de ${business}. ¿En qué puedo asesorarle hoy?`
          : tone === "casual"
          ? `¡Holaa!${emoji(tone, "👋")} Soy ${persona} de ${business}. ¿Qué andás buscando?`
          : `¡Hola! Soy ${persona} de ${business}. Contame qué estás buscando y te ayudo al toque.`;
      }
      break;
    }

    case "price": {
      if (matched) {
        text = matched.priceText
          ? `${matched.name} sale ${matched.priceText}.${matched.attributes ? ` ${capitalize(matched.attributes)}.` : ""} ${closingPhrase(tone)}`
          : `Por ${matched.name} dejame confirmarte el precio. ¿Querés que te lo aparte mientras tanto?`;
        registerInterest(actions, historyWithCurrent, `Consultó precio de ${matched.name}`);
      } else {
        text = catalogHighlights(products, tone, "¿De cuál querés saber el precio?");
      }
      break;
    }

    case "availability": {
      if (matched) {
        text = `¡Sí! Tenemos ${matched.name}.${matched.attributes ? ` ${capitalize(matched.attributes)}.` : ""} ${matched.priceText ? `Sale ${matched.priceText}. ` : ""}${closingPhrase(tone)}`;
        registerInterest(actions, historyWithCurrent, `Consultó disponibilidad de ${matched.name}`);
      } else if (products.length) {
        text = catalogHighlights(products, tone, "¿Cuál te interesa?");
      } else {
        text = tone === "formal"
          ? "Cuénteme qué producto busca y verifico la disponibilidad."
          : "Decime qué estás buscando y te chequeo el stock.";
      }
      break;
    }

    case "purchase": {
      const prod = matched || products[0];
      if (prod) {
        text = tone === "formal"
          ? `¡Excelente elección! ${prod.name}${prod.priceText ? ` (${prod.priceText})` : ""}. Para avanzar, ¿me indica su nombre y cómo prefiere abonar?`
          : `¡Genial!${emoji(tone, "🔥")} Te reservo ${prod.name}${prod.priceText ? ` (${prod.priceText})` : ""}. Pasame tu nombre y coordinamos el pago. ¿Transferencia o efectivo?`;
        registerInterest(actions, historyWithCurrent, `Quiere comprar ${prod.name}`, "Presupuestado");
      } else {
        text = tone === "formal"
          ? "Con gusto. ¿Qué producto desea adquirir?"
          : "¡Buenísimo! ¿Cuál te llevás?";
      }
      break;
    }

    case "payment": {
      const prod = matched || products[0];
      const monto = prod?.price || 0;
      const concepto = prod?.name || "Compra";
      const link = `https://mpago.la/respondo?concepto=${encodeURIComponent(concepto)}&monto=${monto}`;
      if (monto > 0) {
        text = tone === "formal"
          ? `Perfecto. Aquí tiene el link de pago seguro por ${prod?.priceText || `$${monto}`}: ${link}`
          : `¡Listo!${emoji(tone, "💳")} Te paso el link de pago seguro por ${prod?.priceText || `$${monto}`}: ${link}`;
        actions.push({
          type: "payment_link",
          label: `💳 Link de pago $${monto.toLocaleString("es-AR")} ARS generado`,
          payload: { concepto, monto, link },
        });
        registerInterest(actions, historyWithCurrent, `Solicitó link de pago de ${concepto}`, "Presupuestado");
      } else {
        text = tone === "formal"
          ? "¿Por cuál producto desea realizar el pago?"
          : "¿Por cuál producto querés que te pase el link de pago?";
      }
      break;
    }

    case "shipping": {
      // Look for a shipping sentence inside any single product's attributes,
      // splitting by sentence so we don't bleed into the next product's text.
      let shipInfo = "";
      for (const p of products) {
        const sentence = p.attributes
          .split(/[.,]/)
          .map((s) => s.trim())
          .find((s) => /env[ií]o|delivery/i.test(s));
        if (sentence) { shipInfo = sentence; break; }
      }
      text = shipInfo
        ? capitalize(shipInfo) + "."
        : tone === "formal"
        ? "Realizamos envíos. Indíqueme su localidad y le confirmo el costo y el tiempo de entrega."
        : `¡Sí, hacemos envíos!${emoji(tone, "📦")} Decime tu zona y te confirmo costo y demora.`;
      break;
    }

    case "thanks": {
      text = tone === "formal"
        ? "¡A usted! Quedo a disposición para lo que necesite."
        : `¡De nada!${emoji(tone, "😊")} Cualquier cosa me escribís.`;
      break;
    }

    case "goodbye": {
      text = tone === "formal"
        ? "¡Que tenga un excelente día! Aquí estaré cuando lo necesite."
        : `¡Dale, cualquier cosa estoy acá!${emoji(tone, "👋")} Que andes bien.`;
      break;
    }

    default: {
      // Unknown — try to be helpful with the catalog, otherwise ask to clarify
      if (matched) {
        text = `Sobre ${matched.name}: ${matched.priceText ? `${matched.priceText}. ` : ""}${matched.attributes ? `${capitalize(matched.attributes)}. ` : ""}${closingPhrase(tone)}`;
        registerInterest(actions, historyWithCurrent, `Preguntó por ${matched.name}`);
      } else if (products.length) {
        text = catalogHighlights(products, tone, "¿Sobre cuál querés que te cuente?");
      } else {
        text = tone === "formal"
          ? "Disculpe, ¿podría darme más detalle de lo que busca?"
          : `Mmm, contame un poco más así te ayudo bien.${emoji(tone, "🙂")}`;
      }
      break;
    }
  }

  return { text: (offHoursPrefix + text).trim(), actions };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function catalogHighlights(products: Product[], tone: Tone, suffix: string): string {
  if (!products.length) {
    return tone === "formal" ? "¿Qué producto está buscando?" : "¿Qué estás buscando?";
  }
  const top = products.slice(0, 3).map((p) => `• ${p.name}${p.priceText ? ` (${p.priceText})` : ""}`).join("\n");
  const intro = tone === "formal" ? "Estos son algunos de nuestros productos:" : "Te tiro algunas opciones:";
  return `${intro}\n${top}\n${suffix}`;
}

// Try to extract a customer name from history, then register/advance the lead
function registerInterest(
  actions: BotAction[],
  history: { role: string; text: string }[],
  interes: string,
  estado?: string
) {
  // Avoid duplicate lead registration within one reply
  if (actions.some((a) => a.type === "upsert_lead")) {
    if (estado) {
      const nombre = guessName(history);
      actions.push({
        type: "update_lead_status",
        label: `📈 "${nombre}" movido → ${estado}`,
        payload: { nombre, estado },
      });
    }
    return;
  }
  const nombre = guessName(history);
  actions.push({
    type: "upsert_lead",
    label: `🆕 Lead registrado: "${nombre}" (${interes})`,
    payload: { nombre, interes, canal: "WhatsApp" },
  });
  if (estado) {
    actions.push({
      type: "update_lead_status",
      label: `📈 "${nombre}" movido → ${estado}`,
      payload: { nombre, estado },
    });
  }
}

// Naive name extraction: look for "me llamo X" / "soy X" patterns (most
// recent first, so a name given later in the chat wins).
function guessName(history: { role: string; text: string }[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== "user") continue;
    const match = m.text.match(/(?:me llamo|soy|mi nombre es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i);
    if (match) return capitalize(match[1]);
  }
  return "Cliente WhatsApp";
}

// Find the most recently mentioned product across the conversation, so that
// short context-free follow-ups ("cuánto sale?") resolve to the right item.
function lastProductFromHistory(
  history: { role: string; text: string }[],
  products: Product[]
): Product | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const hit = matchProduct(products, m.text);
    if (hit) return hit;
  }
  return null;
}
