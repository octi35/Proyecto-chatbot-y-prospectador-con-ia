import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "20mb" })); // Support base64 image uploads

const PORT = 3000;

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

    // Call generateContent using gemini-3.5-flash
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    const textResponse = response.text || "Disculpame, no pude comprender. ¿Me podrías repetir la consulta?";

    res.json({
      text: textResponse,
      role: "model",
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
