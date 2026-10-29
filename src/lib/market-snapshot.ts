// Informational quotes are deliberately outside StoreData/marketVariables.
export type MarketQuote = {
  referenceDate: string;
  fetchedAt: string;
  value: number;
  originalEuroMwh: number;
  product?: string;
};

export type MarketSnapshot = {
  version: 1;
  state: "awaiting_access" | "ok" | "partial" | "error";
  lastAttemptAt?: string;
  electricity?: MarketQuote;
  gas?: MarketQuote;
  electricityState?: "ok" | "error";
  gasState?: "ok" | "error";
};

export const MARKET_SNAPSHOT_PATH = "marketSnapshots/gme";
export const MARKET_SOURCES = {
  electricity: "https://gme.mercatoelettrico.org/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN",
  gas: "https://gme.mercatoelettrico.org/it-it/Home/Esiti/Gas/MGP-GAS/Esiti/NegoziazioneContinua"
};

function validQuote(value: unknown, factor: number): value is MarketQuote {
  if (!value || typeof value !== "object") return false;
  const quote = value as Partial<MarketQuote>;
  const day = quote.referenceDate;
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day &&
    typeof quote.fetchedAt === "string" && Number.isFinite(Date.parse(quote.fetchedAt)) &&
    typeof quote.value === "number" && Number.isFinite(quote.value) &&
    typeof quote.originalEuroMwh === "number" && Number.isFinite(quote.originalEuroMwh) &&
    Math.abs(quote.value - quote.originalEuroMwh * factor) < 1e-8 &&
    (quote.product === undefined || typeof quote.product === "string");
}

export function parseMarketSnapshot(value: unknown): MarketSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = value as Partial<MarketSnapshot>;
  if (snapshot.version !== 1 || !["awaiting_access", "ok", "partial", "error"].includes(snapshot.state ?? "")) return undefined;
  if (snapshot.electricity !== undefined && !validQuote(snapshot.electricity, 0.001)) return undefined;
  if (snapshot.gas !== undefined && !validQuote(snapshot.gas, 0.0107)) return undefined;
  if (snapshot.lastAttemptAt !== undefined && !Number.isFinite(Date.parse(snapshot.lastAttemptAt))) return undefined;
  if ([snapshot.electricityState, snapshot.gasState].some(state => state !== undefined && state !== "ok" && state !== "error")) return undefined;
  return snapshot as MarketSnapshot;
}

export function quoteIsOld(quote: MarketQuote, now: number) {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  return now - Date.parse(quote.fetchedAt) > 6 * 60 * 60 * 1000 ||
    Date.parse(today) - Date.parse(quote.referenceDate) > 24 * 60 * 60 * 1000;
}
