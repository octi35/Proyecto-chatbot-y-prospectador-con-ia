export interface AgentConfig {
  businessName: string;
  businessType: string;
  catalog: string;
  tone: string;
  logoUrl?: string;
  customGreeting?: string;
  autoFollowUpMinutes?: number;
  syncStore?: "Ninguna" | "TiendaNube" | "Shopify" | "WooCommerce" | "MercadoLibre";
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
}

export interface CRMLead {
  id: string;
  name: string;
  phone: string;
  status: "Nuevo" | "Contactado" | "Presupuestado" | "Cerrado";
  origin: "WhatsApp" | "Instagram" | "Facebook";
  lastInteraction: string;
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
