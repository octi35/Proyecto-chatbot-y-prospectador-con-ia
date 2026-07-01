export interface AgentConfig {
  businessName: string;
  businessType: string;
  catalog: string;
  tone: string;
  logoUrl?: string;
  customGreeting?: string;
  autoFollowUpMinutes?: number;
  syncStore?: "Ninguna" | "TiendaNube" | "Shopify" | "WooCommerce" | "MercadoLibre";
  botPersonaName?: string;     // AI agent's human name, e.g. "Valentina"
  forbiddenTopics?: string;    // Comma-separated topics the AI must never discuss
  workingHoursStart?: number;  // 0-23 hour when bot starts (undefined = 24/7)
  workingHoursEnd?: number;    // 0-23 hour when bot ends (undefined = 24/7)
  quickReplies?: string[];     // Preset quick-reply chips shown to human agents in CRM
  strictMode?: boolean;        // When true, the bot answers ONLY from the configured catalog/info
}

// Structured action the agent performed via tool-use. The backend returns these
// alongside its reply; the frontend applies them to the CRM.
export interface AgentAction {
  type: "upsert_lead" | "update_lead_status" | "schedule_followup" | "payment_link";
  label: string;
  payload: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  isAudio?: boolean;
  audioDuration?: string;
  isImage?: boolean;
  imageUrl?: string;
  status?: "sending" | "sent" | "read";
  actions?: AgentAction[];
}

export interface CRMLead {
  id: string;
  name: string;
  phone: string;
  status: "Nuevo" | "Contactado" | "Presupuestado" | "Cerrado";
  origin: "WhatsApp" | "Instagram" | "Facebook" | "Email";
  lastInteraction: string;
  createdAt?: string;
  score: number; // 0-100 lead score
  notes: string;
  category?: string;
  avatar: string;
  totalSpent?: number;
  aiPaused?: boolean;      // true = a human took over; the AI stays silent
  assignedTo?: string;     // human agent handling this chat
  conversationHistory: { role: "user" | "model"; text: string; timestamp: string }[];
}

export interface Campaign {
  id: string;
  name: string;
  template: string;
  segment: string;
  status: "Borrador" | "Enviando" | "Completado";
  sentCount: number;
  readCount: number;
  repliesCount: number;
  dateCreated: string;
  scheduledAt?: string;  // ISO datetime for scheduled campaigns
  mediaUrl?: string;     // Optional image/video URL to attach
  mediaType?: string;    // "image" | "video" | "document"
}

// WhatsApp message template (Meta-approved for outbound campaigns).
export interface WaTemplate {
  id: string;
  name: string;
  language: string;   // e.g. es_AR, es_MX, en_US
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  body: string;       // may include {{1}}, {{2}} variables
  status: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  createdAt?: string;
}

// Lightweight automation rule: when a TRIGGER fires, run an ACTION.
export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: "new_lead" | "lead_stale" | "high_score" | "status_closed" | "keyword_match";
  triggerValue?: string;   // e.g. keyword for keyword_match, score threshold, hours for stale
  action: "send_followup" | "notify" | "move_stage" | "tag_lead";
  actionValue?: string;    // e.g. target stage, message template, tag/category
  timesTriggered?: number;
}
