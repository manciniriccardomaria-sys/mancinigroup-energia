import type { PendingEnergyQuote, PendingQuoteStatus, SessionUser, StoreData } from "./types";
import { isPersonalUser } from "./view-model";
import { addCustomerToStore } from "./client-store";
import { normalizePodPdr } from "./normalize";

type PendingQuoteInput = Pick<PendingEnergyQuote, "firstName" | "lastName" | "phone" | "commodity" | "customerType" | "sourceId" | "notes" | "dueDate" | "attachments">;

export const pendingQuoteStatusLabels: Record<PendingQuoteStatus, string> = {
  da_preventivare: "Da preventivare",
  preventivato: "Preventivato",
  inviato_alla_fonte: "Inviato alla fonte",
  convertito: "Convertito"
};

export function pendingQuoteStatus(quote: PendingEnergyQuote): PendingQuoteStatus {
  return quote.status ?? (quote.completedQuoteId ? "preventivato" : "da_preventivare");
}

export function visiblePendingQuotes(store: StoreData, user: SessionUser) {
  return store.pendingEnergyQuotes.filter((quote) => !isPersonalUser(user) || quote.createdBy === user.id);
}

export function savePendingQuote(store: StoreData, user: SessionUser, input: PendingQuoteInput, id?: string) {
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("Inserisci nome e cognome del cliente.");
  if (!["luce", "gas"].includes(input.commodity) || !["RES", "BUS"].includes(input.customerType)) {
    throw new Error("Fornitura o tipologia cliente non valida.");
  }
  const existing = id ? visiblePendingQuotes(store, user).find((quote) => quote.id === id) : undefined;
  if (id && !existing) throw new Error("Richiesta non disponibile.");
  if (existing?.convertedCustomerId && (existing.sourceId !== (isPersonalUser(user) ? user.sourceId : input.sourceId) || existing.commodity !== input.commodity)) {
    throw new Error("Fonte e fornitura di un preventivo convertito non possono essere modificate.");
  }
  const sourceId = isPersonalUser(user) ? user.sourceId : input.sourceId;
  if (sourceId && !store.sources.some((source) => source.id === sourceId && source.active)) throw new Error("Seleziona una fonte attiva.");
  const value = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim() || undefined,
    commodity: input.commodity,
    customerType: input.customerType,
    notes: input.notes?.trim() || undefined,
    dueDate: input.dueDate || undefined,
    sourceId,
    attachments: input.attachments ?? existing?.attachments ?? [],
    updatedAt: new Date().toISOString()
  };
  if (existing) {
    Object.assign(existing, value);
    return existing;
  }
  const quote: PendingEnergyQuote = {
    ...value,
    id: `pending_${crypto.randomUUID()}`,
    status: "da_preventivare",
    createdAt: new Date().toISOString(),
    createdBy: user.id
  };
  store.pendingEnergyQuotes.unshift(quote);
  return quote;
}

export function setPendingQuoteStatus(store: StoreData, user: SessionUser, id: string, status: PendingQuoteStatus) {
  const pending = visiblePendingQuotes(store, user).find((quote) => quote.id === id);
  if (!pending || !Object.hasOwn(pendingQuoteStatusLabels, status)) throw new Error("Richiesta o stato non disponibile.");
  if (status === "convertito") throw new Error("Per convertire il preventivo inserisci il POD o PDR.");
  if (pendingQuoteStatus(pending) === "convertito") throw new Error("Il preventivo è già collegato a un contratto.");
  if (status === "inviato_alla_fonte" && !store.sources.some((source) => source.id === pending.sourceId && source.active)) throw new Error("Assegna una fonte attiva prima di segnare il preventivo come inviato.");
  pending.status = status;
  pending.updatedAt = new Date().toISOString();
}

export function completePendingQuote(store: StoreData, user: SessionUser, id: string, quoteId: string) {
  const pending = visiblePendingQuotes(store, user).find((quote) => quote.id === id);
  const saved = store.energyQuotes.find((quote) => quote.id === quoteId && quote.createdBy === user.id);
  if (!pending || !saved || saved.commodity !== pending.commodity) throw new Error("Richiesta non disponibile.");
  const previousStatus = pendingQuoteStatus(pending);
  pending.completedQuoteId = saved.id;
  if (previousStatus === "da_preventivare") pending.status = "preventivato";
  pending.updatedAt = new Date().toISOString();
}

export function convertPendingQuote(store: StoreData, user: SessionUser, id: string, podPdr: string) {
  if (isPersonalUser(user)) throw new Error("La conversione del contratto è a cura della sede.");
  const pending = visiblePendingQuotes(store, user).find((quote) => quote.id === id);
  if (!pending || pendingQuoteStatus(pending) === "convertito") throw new Error("Richiesta non disponibile o già convertita.");
  const code = podPdr.replace(/\s/g, "").toUpperCase();
  if (pending.commodity === "luce" ? !/^IT\d{3}E\d{8}[A-Z0-9]?$/.test(code) : !/^\d{14}$/.test(code)) {
    throw new Error(pending.commodity === "luce" ? "Inserisci un POD valido (es. IT001E12345678)." : "Inserisci un PDR di 14 cifre.");
  }
  const source = store.sources.find((item) => item.id === pending.sourceId && item.active);
  if (!source || (isPersonalUser(user) && source.id !== user.sourceId)) throw new Error("Assegna una fonte attiva prima della conversione.");
  const normalized = normalizePodPdr(code);
  let customer = store.customers.find((item) => item.podPdrNorm === normalized);
  if (customer && customer.sourceId !== source.id) throw new Error("Il POD/PDR è già associato a un’altra fonte. Verifica l’abbinamento in Associa prima di procedere.");
  if (!customer) {
    addCustomerToStore(store, {
      podPdr: code,
      name: `${pending.firstName} ${pending.lastName}`,
      sourceId: source.id,
      offer: store.energyQuotes.find((quote) => quote.id === pending.completedQuoteId)?.selectedOfferName,
      notes: pending.notes,
      createdBy: user.id
    });
    customer = store.customers.find((item) => item.podPdrNorm === normalized)!;
    customer.status = "in_lavorazione";
    customer.commodity = pending.commodity;
  }
  pending.podPdr = code;
  pending.convertedCustomerId = customer.id;
  pending.convertedAt = new Date().toISOString();
  pending.updatedAt = pending.convertedAt;
  pending.status = "convertito";
}
