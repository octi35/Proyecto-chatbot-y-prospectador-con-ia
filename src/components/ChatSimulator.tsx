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
  const [platform, setPlatform] = useState<"whatsapp" | "instagram" | "facebook">("whatsapp");
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
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Map from message id → HTMLAudioElement so each voice note has its own player
  const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const STORAGE_KEY = "respondo_chat_session";

  const botName = config.botPersonaName?.trim() || "Respondo AI";
  // Restore messages from sessionStorage on mount, or show greeting if none
  const greetingText = config.customGreeting || `¡Hola! Bienvenido a ${config.businessName}. Soy ${botName}. ¿En qué te puedo asesorar hoy?`;
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch { /* ignore */ }
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

  // Persist messages to sessionStorage on every change
  useEffect(() => {
    if (messages.length > 1) {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
    }
  }, [messages]);

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
      setIsLoading(false);
      // Stream the reply with a live typewriter effect (like ChatGPT)
      await typeOutModelMessage(data.text || "", actions.length ? { actions } : undefined);
      if (actions.length && onAgentActions) onAgentActions(actions);
      setQuickReplies(generateQuickReplies(data.text || "", historyList.length));
    } catch (err) {
      setIsLoading(false);
      addMessage("model", "Se cortó la conexión por un momento. ¿Me repetís la consulta?");
    }
  };

  // Reveal a model reply progressively for a real "typing live" feel.
  const typeOutModelMessage = (fullText: string, extra?: Partial<ChatMessage>) =>
    new Promise<void>((resolve) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const base: ChatMessage = {
        id, role: "model", text: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "read",
      };
      setMessages((prev) => [...prev, base]);

      // Reveal a few characters per tick; pace scales so long replies don't drag
      const chars = Math.max(1, Math.round(fullText.length / 90));
      let i = 0;
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      typewriterRef.current = setInterval(() => {
        i = Math.min(fullText.length, i + chars);
        const slice = fullText.slice(0, i);
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: slice } : m)));
        if (i >= fullText.length) {
          if (typewriterRef.current) clearInterval(typewriterRef.current);
          // Attach actions once fully revealed and record in the lead history
          if (extra) setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...extra } : m)));
          if (onLeadMessageAdded) onLeadMessageAdded(fullText, "model");
          resolve();
        }
      }, 18);
    });

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
      const caption = inputText.trim();
      setInputText("");
      const msg = addMessage("user", caption || "📷 Foto enviada", { isImage: true, imageUrl: objectUrl });
      setTimeout(() => updateStatus(msg.id, "sent"), 300);
      setTimeout(() => updateStatus(msg.id, "read"), 800);
      await callChatAPI(
        caption, // optional caption; empty lets the server's image instruction guide analysis
        [...messages],
        { data: base64, mimeType: file.type }
      );
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Pick the best recording format the browser supports AND Gemini accepts.
  // Gemini understands ogg/mp3/wav/aac/flac (not webm), so we prefer ogg.
  const pickAudioMime = (): { recorderMime: string; geminiMime: string } => {
    const candidates: { recorderMime: string; geminiMime: string }[] = [
      { recorderMime: "audio/ogg;codecs=opus", geminiMime: "audio/ogg" },
      { recorderMime: "audio/ogg", geminiMime: "audio/ogg" },
      { recorderMime: "audio/mp4", geminiMime: "audio/mp4" },
      { recorderMime: "audio/webm;codecs=opus", geminiMime: "audio/ogg" }, // webm/opus ≈ ogg/opus payload
      { recorderMime: "audio/webm", geminiMime: "audio/ogg" },
    ];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.recorderMime)) return c;
    }
    return { recorderMime: "", geminiMime: "audio/ogg" }; // let the browser choose its default
  };

  // Real microphone recording with MediaRecorder
  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { recorderMime, geminiMime } = pickAudioMime();
      const recorder = recorderMime
        ? new MediaRecorder(stream, { mimeType: recorderMime })
        : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || recorderMime || "audio/ogg" });
        const durationStr = `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`;
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          const url = URL.createObjectURL(blob);
          const msg = addMessage("user", "🎤 Nota de voz", { isAudio: true, audioDuration: durationStr });
          audioMapRef.current.set(msg.id, new Audio(url));
          setTimeout(() => updateStatus(msg.id, "sent"), 300);
          setTimeout(() => updateStatus(msg.id, "read"), 800);
          await callChatAPI(
            "", // let the server's audio-specific instruction guide Gemini
            [...messages],
            { data: base64, mimeType: geminiMime }
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
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    audioMapRef.current.clear();
    setPlayingAudioId(null);
    setQuickReplies([]);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setMessages([{
      id: "initial-1",
      role: "model",
      text: greetingText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "read",
    }]);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[22px] overflow-hidden ds-shadow max-w-sm mx-auto w-full relative">

      {/* Platform selector */}
      <div className="bg-[#fafafa] p-3 border-b border-[#e4e4e7] flex items-center justify-between z-10">
        <div className="flex bg-[#f4f4f5] p-0.5 rounded-lg border border-[#e4e4e7]">
          {(["whatsapp","instagram","facebook"] as const).map((p) => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                platform === p
                  ? p === "whatsapp" ? "bg-[#4caf4c] text-white shadow-sm"
                  : p === "instagram" ? "bg-gradient-to-r from-pink-500 to-[#4338ca] text-white shadow-sm"
                  : "bg-blue-700 text-white shadow-sm"
                  : "text-[#71717a] hover:text-[#0a0a0a]"
              }`}>
              {p === "whatsapp" ? "WhatsApp" : p === "instagram" ? "Instagram" : "Facebook"}
            </button>
          ))}
        </div>
        <button onClick={clearChat} title="Reiniciar chat"
          className="p-1 text-[#a1a1aa] hover:text-[#d9534f] transition-colors rounded-lg hover:bg-[#f4f4f5] cursor-pointer">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Chat header */}
      <div className="px-4 py-3 flex items-center justify-between text-[#27272a] shadow-sm border-b border-[#e4e4e7] z-10 bg-white">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-inner ${platform === "whatsapp" ? "bg-[#4caf4c]" : platform === "facebook" ? "bg-blue-700" : "bg-gradient-to-br from-pink-500 to-[#4338ca]"}`}>
              {config.businessName.substring(0, 2).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#7dd87d] border-2 border-white rounded-full" />
          </div>
          <div>
            <h4 className="font-semibold text-sm leading-tight text-[#0a0a0a]">{config.businessName}</h4>
            <div className="flex items-center space-x-1">
              <Sparkles size={10} className="text-[#4f46e5] animate-pulse" />
              <span className="text-[10px] text-[#71717a] font-medium tracking-wide">{botName} · Gemini AI</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3.5 text-[#a1a1aa]">
          <Phone size={16} className="cursor-pointer hover:text-[#3f3f46]" />
          <Video size={17} className="cursor-pointer hover:text-[#3f3f46]" />
          <MoreVertical size={16} className="cursor-pointer hover:text-[#3f3f46]" />
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
          backgroundColor: platform === "whatsapp" ? "#f8fafc" : platform === "facebook" ? "#f0f2f5" : "#ffffff",
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
                  <div className="w-6 h-6 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] flex items-center justify-center shrink-0">
                    <Bot size={12} className="text-[#4f46e5]" />
                  </div>
                )}

                <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm relative ${
                  isUser
                    ? platform === "whatsapp" ? "bg-[#DCF8C6] text-[#27272a] rounded-tr-none border border-[#c2e7af]"
                    : platform === "instagram" ? "bg-gradient-to-r from-pink-500 to-[#4338ca] text-white rounded-tr-none"
                    : "bg-blue-700 text-white rounded-tr-none"
                    : platform === "whatsapp" ? "bg-white text-[#27272a] border border-[#e4e4e7] rounded-tl-none" : "bg-[#f4f4f5] text-[#27272a] rounded-tl-none"
                }`}>

                  {/* Image */}
                  {msg.isImage && msg.imageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-[#e4e4e7] max-h-48 bg-[#fafafa]">
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
                          isUser ? "bg-[#4caf4c] hover:bg-[#3f9f3f] text-white" : "bg-[#e4e4e7] hover:bg-[#d4d4d8] text-[#3f3f46]"
                        }`}>
                        {playingAudioId === msg.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                      </button>
                      <div className="flex-1 min-w-[120px]">
                        <div className="flex items-end space-x-0.5 h-6 mb-1">
                          {[...Array(14)].map((_, i) => (
                            <span key={i}
                              style={{ height: playingAudioId === msg.id ? `${20 + ((i * 7) % 80)}%` : "20%" }}
                              className={`w-0.5 rounded-full transition-all duration-300 ${isUser ? "bg-[#3f3f46]" : "bg-[#4f46e5]"}`} />
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
                    <div className="mt-2 pt-2 border-t border-[#f4f4f5] space-y-1">
                      {msg.actions.map((a, i) => (
                        <div key={i} className="flex items-start gap-1 px-1.5 py-1 bg-[#f5f6ff] border border-[#eef1ff] rounded-lg text-[9px] text-blue-700 leading-snug">
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
                        {msg.status === "sending" && <span className="text-[#a1a1aa]">···</span>}
                        {msg.status === "sent" && <CheckCheck size={11} className="text-[#a1a1aa]" />}
                        {msg.status === "read" && <CheckCheck size={11} className="text-[#4338ca]" />}
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
            <div className="w-6 h-6 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] flex items-center justify-center shrink-0">
              <Bot size={12} className="text-[#4f46e5] animate-bounce" />
            </div>
            <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl rounded-tl-none p-3.5 shadow-sm flex items-center space-x-1.5">
              <span className="w-2 h-2 bg-[#4f46e5] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-[#4f46e5] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-[#4f46e5] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image upload panel */}
      <AnimatePresence>
        {showImagePanel && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-16 left-4 right-4 bg-[#f4f4f5] border border-transparent rounded-2xl p-4 shadow-xl z-20 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#f4f4f5]">
              <span className="text-xs font-semibold text-[#27272a]">Enviar imagen</span>
              <button onClick={() => setShowImagePanel(false)} className="text-[10px] text-[#a1a1aa] hover:text-[#52525b] cursor-pointer">Cerrar</button>
            </div>
            <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-[#e4e4e7] hover:border-blue-400 rounded-xl cursor-pointer bg-[#fafafa] hover:bg-[#f5f6ff]/30 transition-all text-center">
              <Upload size={20} className="text-[#a1a1aa] mb-1.5" />
              <span className="text-xs font-medium text-[#52525b]">Seleccionar imagen</span>
              <span className="text-[9px] text-[#a1a1aa] mt-0.5">PNG, JPG, WEBP — la IA la analizará</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic error */}
      {micError && (
        <div className="mx-3 mb-1 px-3 py-1.5 bg-[#fdecec] border border-red-200 rounded-xl text-[10px] text-[#c33b37]">
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
                    ? "bg-[#eafaea] border-emerald-200 text-[#3f9f3f] hover:bg-[#dcf5dc]"
                    : "bg-[#f5f6ff] border-blue-200 text-blue-700 hover:bg-[#eef1ff]"
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
        className={`p-3 bg-white border-t border-[#e4e4e7] flex items-center space-x-2 z-10 ${isRecording ? "bg-[#fdecec]/40" : ""}`}>
        <div className="flex items-center space-x-1 shrink-0">
          <button type="button"
            onClick={() => { setShowImagePanel((v) => !v); setMicError(null); }}
            className={`p-2 rounded-full text-[#a1a1aa] hover:text-[#52525b] transition-colors hover:bg-[#f4f4f5] cursor-pointer ${showImagePanel ? "text-[#4f46e5] bg-[#f5f6ff]" : ""}`}
            title="Enviar imagen">
            <ImageIcon size={17} />
          </button>

          {isRecording ? (
            <button type="button" onClick={stopRecording}
              className="p-2 rounded-full bg-[#d9534f] text-white hover:bg-[#c33b37] cursor-pointer animate-pulse"
              title="Detener y enviar">
              <StopCircle size={17} />
            </button>
          ) : (
            <button type="button" onClick={startRecording}
              className="p-2 rounded-full text-[#a1a1aa] hover:text-[#4caf4c] transition-colors hover:bg-[#eafaea] cursor-pointer"
              title="Grabar nota de voz">
              <Mic size={17} />
            </button>
          )}
        </div>

        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-full bg-[#fdecec] border border-red-200 text-[#c33b37] text-xs">
            <span className="flex items-center gap-1.5 animate-pulse font-semibold text-[11px]">
              <span className="w-2 h-2 bg-[#e26562] rounded-full" />
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
            className="flex-1 bg-[#fafafa] border border-[#e4e4e7] text-slate-850 text-xs rounded-full py-2 px-4 focus:outline-none focus:border-[#4338ca] focus:bg-white transition-colors placeholder:text-[#a1a1aa]" />
        )}

        <button type="submit" disabled={!inputText.trim() || isLoading || isRecording}
          className={`p-2.5 rounded-full text-white transition-all shadow-sm cursor-pointer ${
            !inputText.trim() || isLoading
              ? "bg-[#f4f4f5] text-[#d4d4d8] cursor-not-allowed"
              : platform === "whatsapp" ? "bg-[#4caf4c] hover:bg-[#3f9f3f] hover:scale-105 active:scale-95"
              : platform === "facebook" ? "bg-blue-700 hover:bg-blue-800 hover:scale-105 active:scale-95"
              : "bg-gradient-to-r from-pink-500 to-[#4338ca] hover:from-pink-600 hover:to-purple-700 hover:scale-105 active:scale-95"
          }`}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
