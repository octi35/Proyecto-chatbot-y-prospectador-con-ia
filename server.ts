import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "20mb" })); // Support base64 image uploads

const PORT = 3000;

// Model is configurable; default to a valid, current Gemini Flash model.
// NOTE: "gemini-3.5-flash" does not exist and fails against the live API.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ---------------------------------------------------------------------------
// TOOL-USE (Function Calling)
// ---------------------------------------------------------------------------
// The agent can call these tools mid-conversation. "Read" tools (buscar_producto)
// run server-side against the business catalog. "Action" tools return structured
// intents that the frontend applies to the CRM. When a real DB is wired up, the
// same intents can be persisted server-side without touching the agent logic.
const TOOL_DECLARATIONS: any = [
  {
    functionDeclarations: [
      {
        name: "buscar_producto",
        description:
          "Busca un producto o servicio en el catálogo del negocio para confirmar precio, talles, colores y disponibilidad. Usala SIEMPRE antes de afirmar stock o precios.",
        parameters: {
          type: "OBJECT",
          properties: {
            consulta: {
              type: "STRING",
              description:
                "Producto o característica que busca el cliente (ej: 'Nike Air Max talle 42', 'campera de cuero L').",
            },
          },
          required: ["consulta"],
        },
      },
      {
        name: "registrar_lead",
        description:
          "Registra o actualiza un prospecto en el CRM cuando un cliente nuevo muestra interés real (pide precio, stock, quiere comprar o deja sus datos).",
        parameters: {
          type: "OBJECT",
          properties: {
            nombre: { type: "STRING", description: "Nombre del cliente. Si no lo sabés, usá 'Cliente sin identificar'." },
            telefono: { type: "STRING", description: "Teléfono del cliente si lo proporcionó. Opcional." },
            interes: { type: "STRING", description: "Resumen breve de qué producto/servicio le interesa." },
            canal: {
              type: "STRING",
              description: "Canal de origen del contacto.",
              enum: ["WhatsApp", "Instagram", "Facebook"],
            },
          },
          required: ["nombre", "interes"],
        },
      },
      {
        name: "actualizar_estado_lead",
        description:
          "Mueve a un prospecto por el embudo de ventas según el avance de la conversación (ej: tras enviar presupuesto, o al concretar la compra).",
        parameters: {
          type: "OBJECT",
          properties: {
            nombre: { type: "STRING", description: "Nombre del prospecto a actualizar." },
            estado: {
              type: "STRING",
              description: "Nuevo estado en el embudo.",
              enum: ["Nuevo", "Contactado", "Presupuestado", "Cerrado"],
            },
            nota: { type: "STRING", description: "Nota corta del motivo del cambio. Opcional." },
          },
          required: ["nombre", "estado"],
        },
      },
      {
        name: "agendar_seguimiento",
        description:
          "Agenda un recordatorio de seguimiento para retomar el contacto con el cliente más tarde (ej: cuando pide que le escriban después o queda algo pendiente).",
        parameters: {
          type: "OBJECT",
          properties: {
            nombre: { type: "STRING", description: "Nombre del cliente." },
            cuando: { type: "STRING", description: "Momento del seguimiento (ej: 'mañana 10am', 'en 2 horas')." },
            motivo: { type: "STRING", description: "Motivo del seguimiento." },
          },
          required: ["cuando", "motivo"],
        },
      },
      {
        name: "generar_link_pago",
        description:
          "Genera un link de pago de Mercado Pago para cerrar la venta cuando el cliente confirma que quiere comprar.",
        parameters: {
          type: "OBJECT",
          properties: {
            concepto: { type: "STRING", description: "Descripción de lo que se cobra (ej: 'Nike Air Max 90 talle 42')." },
            monto: { type: "NUMBER", description: "Monto total en ARS." },
          },
          required: ["concepto", "monto"],
        },
      },
    ],
  },
];

interface AgentAction {
  type: string;
  label: string;
  payload: Record<string, any>;
}

// Executes a tool. Returns the result given back to the model, and optionally a
// structured action for the frontend to apply to the CRM.
function executeTool(
  name: string,
  args: Record<string, any>,
  config: any
): { result: Record<string, any>; action?: AgentAction } {
  switch (name) {
    case "buscar_producto": {
      const query = String(args.consulta || "").toLowerCase();
      const terms = query.split(/\s+/).filter((w) => w.length > 2);
      const lines = String(config.catalog || "")
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean);
      const matches = lines.filter((line: string) => {
        const lower = line.toLowerCase();
        return terms.some((t) => lower.includes(t));
      });
      if (matches.length === 0) {
        return {
          result: {
            encontrado: false,
            mensaje: "No se encontró ese producto en el catálogo actual. Ofrecé la alternativa más parecida.",
          },
        };
      }
      return { result: { encontrado: true, coincidencias: matches } };
    }

    case "registrar_lead": {
      const canal = args.canal || "WhatsApp";
      return {
        result: { ok: true, mensaje: `Prospecto "${args.nombre}" registrado en el CRM.` },
        action: {
          type: "upsert_lead",
          label: `🆕 Agente registró el lead "${args.nombre}" (${args.interes})`,
          payload: { ...args, canal },
        },
      };
    }

    case "actualizar_estado_lead": {
      return {
        result: { ok: true, mensaje: `Estado de "${args.nombre}" actualizado a "${args.estado}".` },
        action: {
          type: "update_lead_status",
          label: `📈 Agente movió a "${args.nombre}" → ${args.estado}`,
          payload: args,
        },
      };
    }

    case "agendar_seguimiento": {
      return {
        result: { ok: true, mensaje: `Seguimiento agendado: ${args.cuando}.` },
        action: {
          type: "schedule_followup",
          label: `⏰ Seguimiento agendado (${args.cuando}): ${args.motivo}`,
          payload: args,
        },
      };
    }

    case "generar_link_pago": {
      const monto = Number(args.monto) || 0;
      const link = `https://mpago.la/respondo?concepto=${encodeURIComponent(
        args.concepto || ""
      )}&monto=${monto}`;
      return {
        result: { ok: true, link },
        action: {
          type: "payment_link",
          label: `💳 Link de pago generado por $${monto.toLocaleString("es-AR")} ARS`,
          payload: { ...args, monto, link },
        },
      };
    }

    default:
      return { result: { error: `Herramienta desconocida: ${name}` } };
  }
}

// Lazy initialize Gemini client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 2. API: Respondo Chat Simulation Agent
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, agentConfig, attachment } = req.body;

    // Validate config
    const config = agentConfig || {
      businessName: "Zapas Respondo",
      businessType: "Calzado y Zapatillas",
      catalog: "- Nike Air Max 90: $120.000 (Talles 38-44, Color Negro y Blanco)\n- Adidas Forum Low: $110.000 (Talles 37-43, Color Blanco)\n- Puma Classic: $85.000 (Talles 36-44, Color Gamuza Negra)\n- Envío gratis en CABA y GBA.",
      tone: "Argentino/Cercano"
    };

    const ai = getGeminiClient();

    // Construct the customized system instruction based on agent config
    const systemInstruction = `Eres "Respondo", un agente de IA experto entrenado a medida para el negocio "${config.businessName}" (Rubro: ${config.businessType}).
Tu objetivo principal es chatear de forma natural, responder consultas de clientes, asesorar sobre productos/servicios y cerrar ventas de manera fluida y persuasiva en canales de mensajería (WhatsApp, Instagram o Facebook).

INFORMACIÓN DEL NEGOCIO:
- Nombre de la Empresa: ${config.businessName}
- Rubro/Giro: ${config.businessType}
- Catálogo de Productos/Servicios y Precios:
${config.catalog}

REGLAS DE TONO Y COMUNICACIÓN (TONO ACTUAL: "${config.tone}"):
- Si el tono es "Argentino/Cercano": Habla de "vos", usa modismos argentinos naturales y respetuosos (ej: "¡Hola! ¿Cómo andás?", "Che", "Mirá", "Dale", "Buenísimo", "Tollazo", "En un toque"), sé sumamente cálido, amigable, directo y persuasivo. Recuerda: "Chatea menos, Vendé más".
- Si el tono es "Profesional/Formal": Usa un lenguaje pulido, habla de "usted" o "tú" de manera formal, sé muy cortés, claro, estructurado y educado.
- Si el tono es "Casual/Juvenil": Sé súper buena onda, usa "tú" o "vos" de forma relajada, emoticones modernos, lenguaje directo, ameno y entusiasta.

DIRECTIVAS DE VENTA Y REGLAS DE NEGOCIO:
1. Sé conciso y dinámico: En WhatsApp la gente prefiere mensajes de 2 a 3 oraciones cortas. Evita bloques de texto gigantes.
2. Si te preguntan por un producto que está en el catálogo, indica el precio, sus características y ofrece reservarlo, coordinar el envío o agregarlo al pedido de forma proactiva.
3. Si te preguntan por algo que NO está en el catálogo, di amablemente que por el momento no lo tienes disponible pero ofréceles la alternativa más cercana o pregúntales qué talle/estilo buscan.
4. Intenta guiar al cliente hacia el cierre de la venta, agendar una cita o coordinar la entrega de manera natural pero persuasiva (ej: "¿Te parece que te guarde las talle 40?", "¿Querés que coordinemos el envío hoy mismo?", etc.).
5. Si el cliente envía un "Audio" (se enviará como transcripción de audio) o una "Imagen", responde interpretando el contenido de forma brillante y natural.
6. NO rompas el personaje. Eres un agente humano del equipo de ${config.businessName}, no un modelo de lenguaje de IA.

HERRAMIENTAS DISPONIBLES (úsalas proactivamente, sin avisar al cliente que usás "herramientas"):
- buscar_producto: consultá SIEMPRE el catálogo antes de afirmar precio, stock o talles.
- registrar_lead: registrá al cliente en el CRM apenas muestre interés real (pide precio/stock o quiere comprar).
- actualizar_estado_lead: movelo por el embudo (a "Presupuestado" al pasar precio, a "Cerrado" al concretar la venta).
- agendar_seguimiento: si queda algo pendiente o el cliente pide que le escriban después.
- generar_link_pago: cuando el cliente confirma la compra, generá el link de Mercado Pago y compartilo.
Usá las herramientas de forma natural dentro de la conversación; después de usarlas, respondé al cliente como lo haría un vendedor humano.

Lema de Respondo: "Chatea menos, Vendé más." Actúa siempre con este objetivo en mente.`;

    // Map conversation history to Gemini structure
    const contents: any[] = [];

    // Add prior history
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      });
    }

    // Add current user turn
    const currentParts: any[] = [];

    // Check for attachment
    if (attachment && attachment.data && attachment.mimeType) {
      currentParts.push({
        inlineData: {
          data: attachment.data, // base64 payload
          mimeType: attachment.mimeType
        }
      });
      
      // If it's an image, we can add a clarifying prompt if message is empty
      const promptText = message || "Analiza esta imagen y responde según las reglas de tu negocio.";
      currentParts.push({ text: promptText });
    } else {
      currentParts.push({ text: message || "Hola!" });
    }

    contents.push({
      role: "user",
      parts: currentParts
    });

    // Function-calling loop: keep resolving tool calls until the model returns
    // a final natural-language reply (capped to avoid runaway loops).
    const collectedActions: AgentAction[] = [];
    let finalText = "";
    const MAX_TOOL_ITERATIONS = 5;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction,
          temperature: 0.8,
          topP: 0.95,
          tools: TOOL_DECLARATIONS,
        },
      });

      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        // Append the model's tool-call turn so the conversation stays coherent.
        const modelContent = response.candidates?.[0]?.content;
        if (modelContent) contents.push(modelContent);

        // Execute every requested tool and feed the results back to the model.
        const functionResponseParts: any[] = [];
        for (const call of functionCalls) {
          const { result, action } = executeTool(
            call.name as string,
            (call.args as Record<string, any>) || {},
            config
          );
          if (action) collectedActions.push(action);
          functionResponseParts.push({
            functionResponse: { name: call.name, response: result },
          });
        }
        contents.push({ role: "user", parts: functionResponseParts });
        continue; // ask the model again with the tool results in context
      }

      // No tool calls -> this is the final answer.
      finalText = response.text || "";
      break;
    }

    const textResponse =
      finalText || "Disculpame, no pude comprender. ¿Me podrías repetir la consulta?";

    res.json({
      text: textResponse,
      role: "model",
      actions: collectedActions,
    });

  } catch (error: any) {
    console.error("Error in /api/chat endpoint:", error);
    res.status(500).json({
      error: "Ocurrió un error al procesar la respuesta de la IA.",
      details: error.message
    });
  }
});

// Vite Middleware & Static Asset Serving Setup
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    // Dynamically import Vite for development environment
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving built static assets in production.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Respondo Server is running on http://localhost:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start Respondo server:", err);
});
