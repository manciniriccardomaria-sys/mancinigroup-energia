import type { CustomerStatus, SourceKind, UploadCategory, UserRole } from "./types";

export const sourceKindLabels: Record<SourceKind, string> = {
  collaboratore: "Collaboratore",
  frontline: "Frontline",
  sede: "Sede MG"
};

export const userRoleLabels: Record<UserRole, string> = {
  admin: "Admin",
  frontline: "Frontline",
  agent: "Agente",
  operativo: "Operativo"
};

export const customerStatusLabels: Record<CustomerStatus, string> = {
  attivo: "Attivo",
  in_lavorazione: "In lavorazione",
  cessato: "Cessato"
};

export const uploadCategoryLabels: Record<UploadCategory, string> = {
  caricamenti: "Caricamenti",
  margini_agenzia: "Provvigioni agenzia per calcolo fonti",
  altro: "Altro"
};
