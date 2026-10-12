import type { PendingEnergyQuote, SessionUser, StoreData } from "./types";
import { isPersonalUser } from "./view-model";

type PendingQuoteInput = Omit<PendingEnergyQuote, "id" | "createdAt" | "createdBy" | "completedQuoteId">;

export function visiblePendingQuotes(store: StoreData, user: SessionUser) {
  return store.pendingEnergyQuotes.filter((quote) => !isPersonalUser(user) || quote.createdBy === user.id);
}

export function savePendingQuote(store: StoreData, user: SessionUser, input: PendingQuoteInput, id?: string) {
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("Inserisci nome e cognome del cliente.");
  if (!["luce", "gas"].includes(input.commodity) || !["RES", "BUS"].includes(input.customerType)) {
    throw new Error("Fornitura o tipologia cliente non valida.");
  }
  const existing = id ? visiblePendingQuotes(store, user).find((quote) => quote.id === id) : undefined;
  if (id && (!existing || existing.completedQuoteId)) throw new Error("Richiesta non disponibile.");
  const sourceId = isPersonalUser(user) ? user.sourceId : input.sourceId;
  const value = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim() || undefined,
    commodity: input.commodity,
    customerType: input.customerType,
    notes: input.notes?.trim() || undefined,
    dueDate: input.dueDate || undefined,
    sourceId
  };
  if (existing) {
    Object.assign(existing, value);
  } else {
    store.pendingEnergyQuotes.unshift({
      ...value,
      id: `pending_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      createdBy: user.id
    });
  }
}

export function completePendingQuote(store: StoreData, user: SessionUser, id: string, quoteId: string) {
  const pending = visiblePendingQuotes(store, user).find((quote) => quote.id === id);
  const saved = store.energyQuotes.find((quote) => quote.id === quoteId && quote.createdBy === user.id);
  if (!pending || pending.completedQuoteId || !saved) throw new Error("Richiesta non disponibile.");
  pending.completedQuoteId = saved.id;
}
