import { AgentConfig } from "./types";

// Default config used on first load before the DB responds.
// Once the user saves via the UI, this is overwritten in Supabase.
export const DEFAULT_CONFIG: AgentConfig = {
  businessName: "Mi Negocio",
  businessType: "",
  tone: "Argentino/Cercano",
  syncStore: "Ninguna",
  customGreeting: "",
  autoFollowUpMinutes: 15,
  catalog: "",
};
