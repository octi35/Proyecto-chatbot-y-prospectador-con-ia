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
  origin: "WhatsApp" | "Instagram" | "Facebook";
  lastInteraction: string;
  createdAt?: string;
  score: number; // 0-100 lead score
  notes: string;
  category?: string;
  avatar: string;
  totalSpent?: number;
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
}
