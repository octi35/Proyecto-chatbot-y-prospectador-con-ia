import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send, Phone, Video, MoreVertical, Mic, Image as ImageIcon,
  CheckCheck, Bot, Play, Pause, Upload, Sparkles,
  Trash2, Zap, Square, StopCircle,
} from "lucide-react";
import { ChatMessage, AgentConfig, AgentAction } from "../types";

interface ChatSimulatorProps {
  config: AgentConfig;
  onLeadMessageAdded?: (messageText: string, role: "user" | "model") => void;
  onAgentActions?: (actions: AgentAction[]) => void;
}

export default function ChatSimulator({ config, onLeadMessageAdded, onAgentActions }: ChatSimulatorProps) {
  const [platform, setPlatform] = useState<"whatsapp" | "instagram">("whatsapp");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Map from message id → HTMLAudioElement so each voice note has its own player
  const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Set initial greeting only once on mount (or when chat is manually cleared)
  const greetingText = config.customGreeting || `¡Hola! Bienvenido a ${config.businessName}. ¿En qué te puedo asesorar hoy?`;
  useEffect(() => {
    setMessages([{
      id: "initial-1",
      role: "model",
      text: greetingText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "read",
    }]);
  // We intentionally only run this on mount; config changes don't reset an ongoing chat
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const addMessage = (role: "user" | "model", text: string, extra?: Partial<ChatMessage>) => {
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: role === "user" ? "sending" : "read",
      ...extra,
    };
    setMessages((prev) => [...prev, msg]);
    if (onLeadMessageAdded) onLeadMessageAdded(text, role);
    return msg;
  };

  const updateStatus = (id: string, status: "sent" | "read") => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
  };

  const callChatAPI = async (
    userText: string,
    historyList: ChatMessage[],
    attachment?: { data: string; mimeType: string }
  ) => {
    setIsLoading(true);
    setQuickReplies([]); // Clear while loading
    try {
      const history = historyList.map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history, agentConfig: config, attachment }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const actions: AgentAction[] = Array.isArray(data.actions) ? data.actions : [];
      addMessage("model", data.text, actions.length ? { actions } : undefined);
      if (actions.length && onAgentActions) onAgentActions(actions);
      // Generate contextual quick replies based on the AI reply content
      setQuickReplies(generateQuickReplies(data.text, historyList.length));
    } catch (err) {
      addMessage("model", "Se cortó la conexión por un momento. ¿Me repetís la consulta?");
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuickReplies = (aiReply: string, historyLength: number): string[] => {
    const lower = aiReply.toLowerCase();
    if (lower.includes("talle") || lower.includes("número") || lower.includes("talla")) {
      return ["Talle 38", "Talle 40", "Talle 42"];
    }
    if (lower.includes("envío") || lower.includes("delivery") || lower.includes("mando")) {
      return ["¿Hacen envíos al interior?", "¿Cuánto tarda?", "Quiero coordinar el envío"];
    }
    if (lower.includes("precio") || lower.includes("costo") || lower.includes("vale")) {
      return ["¿Hay descuento por efectivo?", "¿Aceptan cuotas?", "Me interesa, lo quiero"];
    }
    if (lower.includes("reserv") || lower.includes("apartá") || lower.includes("separarlo")) {
      return ["Sí, lo reservo", "¿Cómo pago?", "¿Tienen otro color?"];
    }
    if (historyLength === 0) {
      return ["¿Qué tienen disponible?", "Quiero ver el catálogo", "¿Cuáles son los precios?"];
    }
    return [];
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");
    setQuickReplies([]);
    const msg = addMessage("user", text);
    setTimeout(() => updateStatus(msg.id, "sent"), 300);
    setTimeout(() => updateStatus(msg.id, "read"), 800);
    await callChatAPI(text, [...messages]);
  };

  const handleQuickReply = async (text: string) => {
    setQuickReplies([]);
    const msg = addMessage("user", text);
    setTimeout(() => updateStatus(msg.id, "sent"), 300);
    setTimeout(() => updateStatus(msg.id, "read"), 800);
    await callChatAPI(text, [...messages]);
  };

  // Real image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const objectUrl = URL.createObjectURL(file);
      setShowImagePanel(false);
      const msg = addMessage("user", "Te mando una imagen para que me asesores.", { isImage: true, imageUrl: objectUrl });
      setTimeout(() => updateStatus(msg.id, "sent"), 300);
      setTimeout(() => updateStatus(msg.id, "read"), 800);
      await callChatAPI(
        "Te mando esta imagen. Decime si tenés algo parecido, el precio o cómo me podés ayudar.",
        [...messages],
        { data: base64, mimeType: file.type }
      );
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Real microphone recording with MediaRecorder
  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const durationStr = `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`;
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          const url = URL.createObjectURL(blob);
          const msg = addMessage("user", "[Nota de voz]", { isAudio: true, audioDuration: durationStr });
          audioMapRef.current.set(msg.id, new Audio(url));
          setTimeout(() => updateStatus(msg.id, "sent"), 300);
          setTimeout(() => updateStatus(msg.id, "read"), 800);
          await callChatAPI(
            "[Nota de voz del cliente. Procesa el audio adjunto y responde naturalmente.]",
            [...messages],
            { data: base64, mimeType: "audio/webm" }
          );
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      setMicError("No se pudo acceder al micrófono. Verificá los permisos del navegador.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const clearChat = () => {
    audioMapRef.current.clear();
    setPlayingAudioId(null);
    setQuickReplies([]);
    setMessages([{
      id: "initial-1",
      role: "model",
      text: config.customGreeting || `¡Hola! Bienvenido a ${config.businessName}. ¿En qué te puedo asesorar hoy?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "read",
    }]);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm max-w-sm mx-auto w-full relative">

      {/* Platform selector */}
      <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between z-10">
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          {(["whatsapp","instagram"] as const).map((p) => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                platform === p ? (p === "whatsapp" ? "bg-emerald-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm") : "text-slate-500 hover:text-slate-900"
              }`}>
              {p === "whatsapp" ? "WhatsApp" : "Instagram"}
            </button>
          ))}
        </div>
        <button onClick={clearChat} title="Reiniciar chat"
          className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-slate-100 cursor-pointer">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Chat header */}
      <div className="px-4 py-3 flex items-center justify-between text-slate-800 shadow-sm border-b border-slate-200 z-10 bg-white">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-inner ${platform === "whatsapp" ? "bg-emerald-600" : "bg-blue-600"}`}>
              {config.businessName.substring(0, 2).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <h4 className="font-semibold text-sm leading-tight text-slate-900">{config.businessName}</h4>
            <div className="flex items-center space-x-1">
              <Sparkles size={10} className="text-blue-600 animate-pulse" />
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">Respondo AI · Gemini</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3.5 text-slate-400">
          <Phone size={16} className="cursor-pointer hover:text-slate-700" />
          <Video size={17} className="cursor-pointer hover:text-slate-700" />
          <MoreVertical size={16} className="cursor-pointer hover:text-slate-700" />
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 relative"
        style={{
          backgroundImage: platform === "whatsapp"
            ? "radial-gradient(#cbd5e1 0.5px, transparent 0.5px), radial-gradient(#cbd5e1 0.5px, #f8fafc 0.5px)"
            : "none",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 10px 10px",
          backgroundColor: platform === "whatsapp" ? "#f8fafc" : "#ffffff",
        }}>

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isUser ? "justify-end" : "justify-start"} items-end space-x-2`}>

                {!isUser && (
                  <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <Bot size={12} className="text-blue-600" />
                  </div>
                )}

                <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm relative ${
                  isUser
                    ? platform === "whatsapp" ? "bg-[#DCF8C6] text-slate-800 rounded-tr-none border border-[#c2e7af]" : "bg-blue-600 text-white rounded-tr-none"
                    : platform === "whatsapp" ? "bg-white text-slate-800 border border-slate-200 rounded-tl-none" : "bg-slate-100 text-slate-800 rounded-tl-none"
                }`}>

                  {/* Image */}
                  {msg.isImage && msg.imageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-slate-200 max-h-48 bg-slate-50">
                      <img src={msg.imageUrl} alt="Imagen enviada" className="object-cover w-full h-full max-h-40" />
                    </div>
                  )}

                  {/* Audio bubble */}
                  {msg.isAudio ? (
                    <div className="flex items-center space-x-3 py-1 px-0.5">
                      <button
                        onClick={() => {
                          const player = audioMapRef.current.get(msg.id);
                          if (playingAudioId === msg.id) {
                            player?.pause();
                            setPlayingAudioId(null);
                          } else {
                            // Pause any currently playing audio
                            if (playingAudioId) audioMapRef.current.get(playingAudioId)?.pause();
                            player?.play().catch(() => {});
                            if (player) player.onended = () => setPlayingAudioId(null);
                            setPlayingAudioId(msg.id);
                          }
                        }}
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm cursor-pointer ${
                          isUser ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                        }`}>
                        {playingAudioId === msg.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                      </button>
                      <div className="flex-1 min-w-[120px]">
                        <div className="flex items-end space-x-0.5 h-6 mb-1">
                          {[...Array(14)].map((_, i) => (
                            <span key={i}
                              style={{ height: playingAudioId === msg.id ? `${20 + ((i * 7) % 80)}%` : "20%" }}
                              className={`w-0.5 rounded-full transition-all duration-300 ${isUser ? "bg-slate-700" : "bg-blue-600"}`} />
                          ))}
                        </div>
                        <div className="flex justify-between items-center text-[9px] opacity-75">
                          <span className="flex items-center gap-0.5"><Mic size={9} /> Nota de voz</span>
                          <span>{msg.audioDuration || "0:00"}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-normal leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {/* Agent actions chips */}
                  {!isUser && msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                      {msg.actions.map((a, i) => (
                        <div key={i} className="flex items-start gap-1 px-1.5 py-1 bg-blue-50 border border-blue-100 rounded-lg text-[9px] text-blue-700 leading-snug">
                          <Zap size={9} className="shrink-0 mt-0.5" />
                          <span className="font-medium">{a.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bubble footer */}
                  <div className="flex items-center justify-end space-x-1 mt-1 opacity-70 text-[9px] select-none">
                    <span>{msg.timestamp}</span>
                    {isUser && (
                      <>
                        {msg.status === "sending" && <span className="text-slate-400">···</span>}
                        {msg.status === "sent" && <CheckCheck size={11} className="text-slate-400" />}
                        {msg.status === "read" && <CheckCheck size={11} className="text-blue-500" />}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isLoading && (
          <div className="flex justify-start items-end space-x-2">
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Bot size={12} className="text-blue-600 animate-bounce" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none p-3.5 shadow-sm flex items-center space-x-1.5">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image upload panel */}
      <AnimatePresence>
        {showImagePanel && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-16 left-4 right-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-xl z-20 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800">Enviar imagen</span>
              <button onClick={() => setShowImagePanel(false)} className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer">Cerrar</button>
            </div>
            <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition-all text-center">
              <Upload size={20} className="text-slate-400 mb-1.5" />
              <span className="text-xs font-medium text-slate-600">Seleccionar imagen</span>
              <span className="text-[9px] text-slate-400 mt-0.5">PNG, JPG, WEBP — la IA la analizará</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic error */}
      {micError && (
        <div className="mx-3 mb-1 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-[10px] text-red-700">
          {micError}
        </div>
      )}

      {/* Quick reply chips */}
      <AnimatePresence>
        {quickReplies.length > 0 && !isLoading && !isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="px-3 pb-2 flex flex-wrap gap-1.5"
          >
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => handleQuickReply(reply)}
                className={`text-[10px] font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                  platform === "whatsapp"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                }`}
              >
                {reply}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <form onSubmit={handleSendText}
        className={`p-3 bg-white border-t border-slate-200 flex items-center space-x-2 z-10 ${isRecording ? "bg-red-50/40" : ""}`}>
        <div className="flex items-center space-x-1 shrink-0">
          <button type="button"
            onClick={() => { setShowImagePanel((v) => !v); setMicError(null); }}
            className={`p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer ${showImagePanel ? "text-blue-600 bg-blue-50" : ""}`}
            title="Enviar imagen">
            <ImageIcon size={17} />
          </button>

          {isRecording ? (
            <button type="button" onClick={stopRecording}
              className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 cursor-pointer animate-pulse"
              title="Detener y enviar">
              <StopCircle size={17} />
            </button>
          ) : (
            <button type="button" onClick={startRecording}
              className="p-2 rounded-full text-slate-400 hover:text-emerald-600 transition-colors hover:bg-emerald-50 cursor-pointer"
              title="Grabar nota de voz">
              <Mic size={17} />
            </button>
          )}
        </div>

        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs">
            <span className="flex items-center gap-1.5 animate-pulse font-semibold text-[11px]">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              GRABANDO {recordingSeconds}s
            </span>
            <button type="button" onClick={stopRecording}
              className="text-[10px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1">
              <Square size={10} fill="currentColor" /> Enviar
            </button>
          </div>
        ) : (
          <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribí un mensaje…"
            className="flex-1 bg-slate-50 border border-slate-200 text-slate-850 text-xs rounded-full py-2 px-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder:text-slate-400" />
        )}

        <button type="submit" disabled={!inputText.trim() || isLoading || isRecording}
          className={`p-2.5 rounded-full text-white transition-all shadow-sm cursor-pointer ${
            !inputText.trim() || isLoading
              ? "bg-slate-100 text-slate-300 cursor-not-allowed"
              : platform === "whatsapp" ? "bg-emerald-600 hover:bg-emerald-700 hover:scale-105 active:scale-95" : "bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95"
          }`}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
