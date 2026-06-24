import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  Phone,
  Video,
  MoreVertical,
  Mic,
  Image as ImageIcon,
  CheckCheck,
  User,
  Bot,
  Play,
  Pause,
  Upload,
  Sparkles,
  HelpCircle,
  MessageCircle,
  Trash2,
  ChevronRight,
  FileAudio
} from "lucide-react";
import { ChatMessage, AgentConfig } from "../types";

// High-quality sample products for image analysis
const MOCK_IMAGES = [
  {
    name: "Zapas Running Rojas",
    url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=80",
    description: "Zapatillas deportivas de running de alta performance."
  },
  {
    name: "Campera de Cuero Negra",
    url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&auto=format&fit=crop&q=80",
    description: "Campera de abrigo de cuero genuino, talle L."
  },
  {
    name: "Smartwatch Elegante",
    url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80",
    description: "Reloj inteligente blanco con sensor cardíaco."
  }
];

// Pre-configured LATAM audio inquiries to simulate the voice note transcription feature
const VOICE_SCENARIOS = [
  {
    text: "¿Hola qué tal? Quería consultar si tienen talle 42 de las zapas Nike rojas y cuánto sale el envío a Almagro.",
    duration: "0:09",
    label: "Consulta de Stock y Envío"
  },
  {
    text: "Hola che, me interesa la campera de cuero. ¿Me pasás las medidas del talle L y qué colores les quedan?",
    duration: "0:07",
    label: "Medidas y Colores Campera"
  },
  {
    text: "Buenas, quería saber qué formas de pago aceptan. ¿Tienen cuotas sin interés con Mercado Pago?",
    duration: "0:08",
    label: "Métodos de Pago y Cuotas"
  }
];

interface ChatSimulatorProps {
  config: AgentConfig;
  onLeadMessageAdded?: (messageText: string, role: "user" | "model") => void;
}

export default function ChatSimulator({ config, onLeadMessageAdded }: ChatSimulatorProps) {
  const [platform, setPlatform] = useState<"whatsapp" | "instagram">("whatsapp");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-1",
      role: "model",
      text: config.customGreeting || `¡Hola! Bienvenido a ${config.businessName}. ¿En qué te puedo asesorar hoy?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "read"
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showVoiceScenarios, setShowVoiceScenarios] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const timerRef = useRef<any>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Sync greeting when agent config changes
  useEffect(() => {
    setMessages([
      {
        id: "initial-1",
        role: "model",
        text: config.customGreeting || `¡Hola! Bienvenido a ${config.businessName}. ¿En qué te puedo asesorar hoy?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "read"
      }
    ]);
  }, [config.customGreeting, config.businessName]);

  const addMessage = (role: "user" | "model", text: string, extra?: Partial<ChatMessage>) => {
    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: role === "user" ? "sending" : "read",
      ...extra
    };

    setMessages((prev) => [...prev, newMsg]);
    if (onLeadMessageAdded) {
      onLeadMessageAdded(text, role);
    }
    return newMsg;
  };

  const updateMessageStatus = (id: string, status: "sent" | "read") => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m))
    );
  };

  // Main controller to interact with the backend Gemini model
  const sendMessageToAgent = async (
    userText: string,
    historyList: ChatMessage[],
    attachmentPayload?: { type: "audio" | "image"; data: string; mimeType: string }
  ) => {
    setIsLoading(true);
    try {
      // Map ChatMessage structure to server historical structure
      const formattedHistory = historyList.map((m) => ({
        role: m.role,
        text: m.text
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: formattedHistory,
          agentConfig: config,
          attachment: attachmentPayload
        })
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor");
      }

      const data = await response.json();
      addMessage("model", data.text);
    } catch (error) {
      console.error(error);
      addMessage("model", "Che, disculpame pero se me complicó la conexión temporalmente. ¿Me podrías repetir la pregunta?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText("");

    const userMsg = addMessage("user", textToSend);
    setTimeout(() => updateMessageStatus(userMsg.id, "sent"), 300);
    setTimeout(() => updateMessageStatus(userMsg.id, "read"), 800);

    // Save previous history
    const historySnapshot = [...messages];
    await sendMessageToAgent(textToSend, historySnapshot);
  };

  // Handles simulated voice notes from scenarios
  const handleSelectVoiceScenario = async (scenario: typeof VOICE_SCENARIOS[0]) => {
    setShowVoiceScenarios(false);
    
    // Add voice note bubble to chat
    const userMsg = addMessage("user", scenario.text, {
      isAudio: true,
      audioDuration: scenario.duration
    });

    setTimeout(() => updateMessageStatus(userMsg.id, "sent"), 300);
    setTimeout(() => updateMessageStatus(userMsg.id, "read"), 800);

    // Prompt context: translate audio context
    const transcriptText = `[Nota de voz transcrita]: ${scenario.text}`;
    await sendMessageToAgent(transcriptText, [...messages]);
  };

  // Handles uploading images or selecting mock ones
  const handleSelectMockImage = async (img: typeof MOCK_IMAGES[0]) => {
    setShowImageOptions(false);

    // Convert URL to Base64 to simulate real image analysis
    try {
      setIsLoading(true);
      const res = await fetch(img.url);
      const blob = await res.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(",")[1];
        
        setIsLoading(false);
        const userMsg = addMessage("user", `Me interesa este artículo: ${img.name}`, {
          isImage: true,
          imageUrl: img.url
        });

        setTimeout(() => updateMessageStatus(userMsg.id, "sent"), 300);
        setTimeout(() => updateMessageStatus(userMsg.id, "read"), 800);

        await sendMessageToAgent(
          `Me interesa este artículo: ${img.name}. Decime si tenés stock, precio y detalles de este producto por favor.`,
          [...messages],
          {
            type: "image",
            data: base64data,
            mimeType: "image/jpeg"
          }
        );
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Error converting image:", err);
      setIsLoading(false);
    }
  };

  // Handle uploading real user file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64data = (reader.result as string).split(",")[1];
      const objectUrl = URL.createObjectURL(file);

      setShowImageOptions(false);
      const userMsg = addMessage("user", `Te mando la foto del producto`, {
        isImage: true,
        imageUrl: objectUrl
      });

      setTimeout(() => updateMessageStatus(userMsg.id, "sent"), 300);
      setTimeout(() => updateMessageStatus(userMsg.id, "read"), 800);

      await sendMessageToAgent(
        `Te mando esta imagen. Decime el precio o decime si me podés asesorar con esto que ves acá, por favor.`,
        [...messages],
        {
          type: "image",
          data: base64data,
          mimeType: file.type
        }
      );
    };
    reader.readAsDataURL(file);
  };

  // Simulated recording (failsafe for iframes/permissions)
  const startSimulatedRecording = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopSimulatedRecording = async () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    
    const minutes = Math.floor(recordingSeconds / 60);
    const secs = recordingSeconds % 60;
    const durationStr = `${minutes}:${secs < 10 ? "0" : ""}${secs}`;

    // A fun mock recording transcription
    const mockTranscripts = [
      "Hola buenas, quería preguntar si tienen la campera negra disponible en talle M y si hacen envíos a domicilio.",
      "Buenas, vi su catálogo de productos y quería consultar el precio de las zapatillas deportivas rojas.",
      "Hola, quería saber si tienen stock de los productos que publicaron y si puedo pagar en efectivo al recibir."
    ];
    const transcriptText = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];

    const userMsg = addMessage("user", transcriptText, {
      isAudio: true,
      audioDuration: durationStr
    });

    setTimeout(() => updateMessageStatus(userMsg.id, "sent"), 300);
    setTimeout(() => updateMessageStatus(userMsg.id, "read"), 800);

    await sendMessageToAgent(`[Nota de voz grabada de ${durationStr}]: ${transcriptText}`, [...messages]);
  };

  const clearChat = () => {
    setMessages([
      {
        id: "initial-1",
        role: "model",
        text: config.customGreeting || `¡Hola! Bienvenido a ${config.businessName}. ¿En qué te puedo asesorar hoy?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "read"
      }
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm max-w-sm mx-auto w-full relative">
      {/* Platform Selector & Header */}
      <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between z-10">
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setPlatform("whatsapp")}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
              platform === "whatsapp"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            WhatsApp
          </button>
          <button
            onClick={() => setPlatform("instagram")}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
              platform === "instagram"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Instagram
          </button>
        </div>
        
        <button
          onClick={clearChat}
          title="Reiniciar Conversación"
          className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Simulated Device Frame Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between text-slate-800 shadow-sm border-b border-slate-200 z-10 bg-white`}
      >
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-inner ${
              platform === "whatsapp" ? "bg-emerald-600" : "bg-blue-600"
            }`}>
              {config.businessName.substring(0, 2).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
          </div>
          <div>
            <h4 className="font-semibold text-sm leading-tight text-slate-900">{config.businessName}</h4>
            <div className="flex items-center space-x-1">
              <Sparkles size={10} className="text-blue-600 animate-pulse-slow" />
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">
                Respondo AI 24/7
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3.5 text-slate-400">
          <Phone size={16} className="cursor-pointer hover:text-slate-700" />
          <Video size={17} className="cursor-pointer hover:text-slate-700" />
          <MoreVertical size={16} className="cursor-pointer hover:text-slate-700" />
        </div>
      </div>

      {/* Chat History Canvas */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3.5 relative"
        style={{
          backgroundImage:
            platform === "whatsapp"
              ? "radial-gradient(#cbd5e1 0.5px, transparent 0.5px), radial-gradient(#cbd5e1 0.5px, #f8fafc 0.5px)"
              : "none",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 10px 10px",
          backgroundColor: platform === "whatsapp" ? "#f8fafc" : "#ffffff"
        }}
      >
        <div className="mx-auto max-w-[85%] bg-white/95 backdrop-blur-md rounded-xl p-2.5 text-center text-[11px] text-slate-500 border border-slate-200 mb-4 shadow-sm">
          💡 <span className="font-semibold text-slate-700">Demostración interactiva:</span> Podés escribir libremente, subir imágenes o enviar notas de voz simuladas. El agente responderá basándose en el catálogo y reglas de negocio configurados a la izquierda.
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isUser ? "justify-end" : "justify-start"} items-end space-x-2`}
              >
                {!isUser && (
                  <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <Bot size={12} className="text-blue-600" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl p-3 shadow-sm relative group ${
                    isUser
                      ? platform === "whatsapp"
                        ? "bg-[#DCF8C6] text-slate-800 rounded-tr-none border border-[#c2e7af]"
                        : "bg-blue-600 text-white rounded-tr-none"
                      : platform === "whatsapp"
                      ? "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                      : "bg-slate-100 text-slate-800 rounded-tl-none"
                  }`}
                >
                  {/* Image Attachment inside Bubble */}
                  {msg.isImage && msg.imageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-slate-200 max-h-48 bg-slate-50 flex items-center justify-center">
                      <img
                        referrerPolicy="no-referrer"
                        src={msg.imageUrl}
                        alt="Enviado por cliente"
                        className="object-cover w-full h-full max-h-40"
                      />
                    </div>
                  )}

                  {/* Audio/Voice Note Bubble inside Chat */}
                  {msg.isAudio ? (
                    <div className="flex items-center space-x-3 py-1 px-0.5">
                      <button
                        onClick={() =>
                          setPlayingAudioId(playingAudioId === msg.id ? null : msg.id)
                        }
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm cursor-pointer ${
                          isUser ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                        }`}
                      >
                        {playingAudioId === msg.id ? (
                          <Pause size={14} fill="currentColor" />
                        ) : (
                          <Play size={14} fill="currentColor" className="ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-[120px]">
                        {/* Fake animated audio waveform */}
                        <div className="flex items-end space-x-0.5 h-6 mb-1">
                          {[...Array(14)].map((_, i) => (
                            <span
                              key={i}
                              style={{
                                height: playingAudioId === msg.id 
                                  ? `${Math.max(15, Math.floor(Math.random() * 95))}%` 
                                  : "20%"
                              }}
                              className={`w-0.5 rounded-full transition-all duration-300 ${
                                isUser ? "bg-slate-700" : "bg-blue-600"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between items-center text-[9px] opacity-75">
                          <span className="flex items-center space-x-0.5">
                            <Mic size={9} />
                            <span>Mensaje de voz</span>
                          </span>
                          <span>{msg.audioDuration || "0:05"}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-normal leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  )}

                  {/* Bubble Footer Info */}
                  <div className="flex items-center justify-end space-x-1 mt-1 opacity-70 text-[9px] text-right select-none">
                    <span>{msg.timestamp}</span>
                    {isUser && (
                      <span>
                        {msg.status === "sending" && <span className="text-slate-400">...</span>}
                        {msg.status === "sent" && <CheckCheck size={11} className="text-slate-400" />}
                        {msg.status === "read" && <CheckCheck size={11} className="text-blue-500" />}
                      </span>
                    )}
                  </div>

                  {/* Special capability pill */}
                  {msg.isAudio && !isUser && (
                    <span className="absolute -bottom-2 -left-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[8px] font-mono tracking-wide scale-90 flex items-center gap-0.5 shadow-sm">
                      <FileAudio size={8} /> Voz Interpretada
                    </span>
                  )}
                  {msg.isImage && !isUser && (
                    <span className="absolute -bottom-2 -left-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[8px] font-mono tracking-wide scale-90 flex items-center gap-0.5 shadow-sm">
                      <ImageIcon size={8} /> Imagen Analizada
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start items-end space-x-2">
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Bot size={12} className="text-blue-600 animate-bounce" />
            </div>
            <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl rounded-tl-none p-3.5 shadow-sm flex items-center space-x-1.5">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Panel: Image Selectors */}
      <AnimatePresence>
        {showImageOptions && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-16 left-4 right-4 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xl z-20 space-y-3"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800">
                Simular envío de imagen
              </span>
              <button
                onClick={() => setShowImageOptions(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            
            {/* Custom file uploader */}
            <label className="flex flex-col items-center justify-center h-20 border border-dashed border-slate-200 hover:border-blue-400 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-all text-center">
              <Upload size={18} className="text-slate-400 mb-1" />
              <span className="text-[10px] font-medium text-slate-600">Subir foto desde tu dispositivo</span>
              <span className="text-[8px] text-slate-400 mt-0.5">Soporta PNG, JPG, WEBP</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <div className="space-y-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                O elegir un producto muestra
              </span>
              <div className="grid grid-cols-3 gap-2">
                {MOCK_IMAGES.map((img) => (
                  <button
                    key={img.name}
                    onClick={() => handleSelectMockImage(img)}
                    className="p-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-400 text-left transition-all overflow-hidden relative group cursor-pointer"
                  >
                    <div className="w-full h-10 rounded overflow-hidden mb-1 relative bg-black">
                      <img
                        referrerPolicy="no-referrer"
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <span className="text-[9px] font-medium text-slate-600 truncate block leading-tight">
                      {img.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Panel: Voice Scenarios */}
      <AnimatePresence>
        {showVoiceScenarios && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-16 left-4 right-4 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xl z-20 space-y-3.5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800">
                Simular envío de nota de voz
              </span>
              <button
                onClick={() => setShowVoiceScenarios(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {/* Quick Record simulated button */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full bg-red-500 shrink-0 ${isRecording ? "animate-ping" : ""}`} />
                <span className="text-[11px] font-medium text-slate-600">
                  {isRecording ? `Grabando... ${recordingSeconds}s` : "Micrófono Simulador"}
                </span>
              </div>
              <button
                type="button"
                onClick={isRecording ? stopSimulatedRecording : startSimulatedRecording}
                className={`px-3 py-1 text-[10px] rounded-lg font-semibold transition-all cursor-pointer ${
                  isRecording 
                    ? "bg-red-600 hover:bg-red-700 text-white" 
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isRecording ? "Detener y Enviar" : "Grabar Audio"}
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                O elegir consulta pre-grabada (LATAM)
              </span>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {VOICE_SCENARIOS.map((sc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectVoiceScenario(sc)}
                    className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-slate-100/80 text-left transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                        {sc.label}
                      </span>
                      <p className="text-[9px] text-slate-500 truncate">
                        "{sc.text}"
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 text-slate-400 group-hover:text-blue-600">
                      <span className="text-[8px] font-mono">{sc.duration}</span>
                      <ChevronRight size={12} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Form Bottom Bar */}
      <form
        onSubmit={handleSendText}
        className={`p-3 bg-white border-t border-slate-200 flex items-center space-x-2 z-10 ${
          isRecording ? "bg-red-50/50" : ""
        }`}
      >
        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowImageOptions(!showImageOptions);
              setShowVoiceScenarios(false);
            }}
            className={`p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer ${
              showImageOptions ? "text-blue-600 bg-blue-50" : ""
            }`}
            title="Enviar imagen"
          >
            <ImageIcon size={17} />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowVoiceScenarios(!showVoiceScenarios);
              setShowImageOptions(false);
            }}
            className={`p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer ${
              showVoiceScenarios ? "text-emerald-600 bg-emerald-50" : ""
            }`}
            title="Enviar nota de voz"
          >
            <Mic size={17} />
          </button>
        </div>

        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs">
            <span className="flex items-center space-x-1.5 animate-pulse">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span className="font-semibold text-[11px]">GRABANDO SIMULADOR: {recordingSeconds}s</span>
            </span>
            <button
              type="button"
              onClick={stopSimulatedRecording}
              className="text-[10px] font-bold text-red-700 hover:text-red-900 uppercase tracking-wider cursor-pointer"
            >
              ENVIAR
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribí un mensaje..."
            className="flex-1 bg-slate-50 border border-slate-200 text-slate-850 text-xs rounded-full py-2 px-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder:text-slate-400"
          />
        )}

        <button
          type="submit"
          disabled={!inputText.trim() || isLoading || isRecording}
          className={`p-2.5 rounded-full text-white transition-all shadow-sm cursor-pointer ${
            !inputText.trim() || isLoading
              ? "bg-slate-100 text-slate-300 cursor-not-allowed"
              : platform === "whatsapp"
              ? "bg-emerald-600 hover:bg-emerald-700 hover:scale-105 active:scale-95"
              : "bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95"
          }`}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
