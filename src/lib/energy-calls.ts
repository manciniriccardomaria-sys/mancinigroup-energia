import * as XLSX from "xlsx";
import { addCalendarMonths } from "./payment-gate";
import type { EnergyCall, EnergyCallStatus, SessionUser, StoreData } from "./types";

// Fixed launch date: calls created from earlier relationships must not become
// a historical backlog, including when the same report is imported again.
export const ENERGY_CALL_TRACKING_START = "2026-11-02";

export function isTrackedEnergyCall(call: EnergyCall) {
  return call.dueDate >= ENERGY_CALL_TRACKING_START;
}

export const energyCallStatuses: Record<EnergyCallStatus, string> = {
  da_chiamare: "Da chiamare",
  chiamato: "Chiamato",
  da_richiamare: "Da richiamare",
  non_raggiungibile: "Non raggiungibile",
  non_interessato: "Non interessato",
  preventivo_richiesto: "Preventivo richiesto",
  contratto_attivato: "Contratto attivato"
};

export function italyDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(date);
}

export function validCallDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shiftCallDay(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayCallDate(value: string) {
  if (!validCallDate(value)) throw new Error("Data chiamata non valida.");
  const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
  return shiftCallDay(value, weekday === 6 ? -1 : weekday === 0 ? 1 : 0);
}

export function energyCallDueDate(startDate: string) {
  if (!validCallDate(startDate)) throw new Error("Data inizio rapporto non valida.");
  return weekdayCallDate(addCalendarMonths(startDate, 2));
}

export function effectiveCallDate(call: EnergyCall) {
  return call.status === "da_richiamare" && call.callbackDate ? call.callbackDate : call.dueDate;
}

export function isOpenEnergyCall(call: EnergyCall) {
  return isTrackedEnergyCall(call) && ["da_chiamare", "da_richiamare", "non_raggiungibile"].includes(call.status);
}

export function energyCallCalendarDates(call: EnergyCall, today: string) {
  if (!isTrackedEnergyCall(call)) return [];
  return [...new Set([
    call.dueDate,
    ...(call.history ?? []).flatMap((action) => [italyDate(new Date(action.at)), action.callbackDate ?? ""]),
    call.status === "da_richiamare" ? call.callbackDate ?? "" : "",
    isOpenEnergyCall(call) && effectiveCallDate(call) <= today ? today : ""
  ].filter((date) => date && date >= ENERGY_CALL_TRACKING_START))];
}

function normalized(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function reportDate(value: unknown, date1904: boolean) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value, { date1904 });
    if (!parsed) return "";
    return `${parsed.y.toString().padStart(4, "0")}-${parsed.m.toString().padStart(2, "0")}-${parsed.d.toString().padStart(2, "0")}`;
  }
  const text = normalized(value);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : text;
}

export type EnergyCallReport = { calls: EnergyCall[]; totalRows: number; skippedRows: number; duplicateRows: number; missingPhones: number };

export function parseEnergyCallReport(input: Uint8Array | ArrayBuffer, fileName: string, now = new Date().toISOString()): EnergyCallReport {
  const workbook = XLSX.read(input, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Il file non contiene fogli.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const headers = rows[0]?.map(normalized);
  if (headers?.[0] !== "Contraente" || headers?.[8] !== "Iniz. Rapp.") {
    throw new Error("Usa il report clienti con Contraente in colonna A e Iniz. Rapp. in colonna I.");
  }
  const column = (name: string) => {
    const index = headers.indexOf(name);
    if (index < 0) throw new Error(`Colonna mancante: ${name}.`);
    return index;
  };
  const fiscalColumn = column("Cod.Fiscale / P.IVA");
  const sourceColumn = column("Fonte");
  const mobileColumn = column("Cellulare");
  const phoneColumn = column("Tel. Residenza");
  const endColumn = headers.indexOf("Dt. Fine Rapporto");
  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  const calls = new Map<string, EnergyCall>();
  let skippedRows = 0;
  let duplicateRows = 0;
  const nonemptyRows = rows.slice(1).filter((row) => row.some((value) => normalized(value)));
  for (const row of nonemptyRows) {
    const customerName = normalized(row[0]);
    const fiscalCode = normalized(row[fiscalColumn]).replace(/\s/g, "").toUpperCase();
    const startDate = reportDate(row[8], date1904);
    // A fiscal identity is mandatory: never merge two people by name alone.
    if (!customerName || !fiscalCode || !validCallDate(startDate)) { skippedRows++; continue; }
    const key = `${fiscalCode}:${startDate}`;
    const id = `energy_${encodeURIComponent(key)}`;
    const mobile = normalized(row[mobileColumn]);
    const landline = normalized(row[phoneColumn]);
    if (calls.has(id)) { duplicateRows++; continue; }
    const endDate = endColumn >= 0 ? reportDate(row[endColumn], date1904) : "";
    calls.set(id, {
      id, customerName, fiscalCode, phone: mobile || landline, alternatePhone: mobile && landline !== mobile ? landline : "",
      source: normalized(row[sourceColumn]), relationshipStartDate: startDate,
      ...(validCallDate(endDate) ? { relationshipEndDate: endDate } : {}),
      dueDate: energyCallDueDate(startDate), status: "da_chiamare", notes: "", history: [], importedFrom: fileName, importedAt: now
    });
  }
  return { calls: [...calls.values()], totalRows: nonemptyRows.length, skippedRows, duplicateRows,
    missingPhones: [...calls.values()].filter((call) => !call.phone).length };
}

export function mergeEnergyCalls(existing: EnergyCall[], incoming: EnergyCall[]) {
  const byId = new Map(existing.map((call) => [call.id, call]));
  for (const call of incoming) {
    const previous = byId.get(call.id);
    byId.set(call.id, previous ? { ...call, status: previous.status, notes: previous.notes, history: previous.history,
      ...(previous.callbackDate ? { callbackDate: previous.callbackDate } : {}),
      phone: call.phone || previous.phone, alternatePhone: call.alternatePhone || previous.alternatePhone } : call);
  }
  return [...byId.values()];
}

export function updateEnergyCall(store: StoreData, user: SessionUser, id: string, status: EnergyCallStatus, notes: string, callbackDate?: string, at = new Date().toISOString()) {
  if (user.role !== "admin" && user.role !== "operativo") throw new Error("Accesso al calendario non consentito.");
  if (!Object.hasOwn(energyCallStatuses, status)) throw new Error("Esito non valido.");
  const call = store.energyCalls.find((item) => item.id === id);
  if (!call) throw new Error("Chiamata non trovata.");
  if (status === "da_richiamare" && (!callbackDate || !validCallDate(callbackDate) || callbackDate < italyDate(new Date(at)))) {
    throw new Error("Indica una data di richiamo valida, da oggi in avanti.");
  }
  const callback = status === "da_richiamare" ? weekdayCallDate(callbackDate!) : undefined;
  if (callback && callback < italyDate(new Date(at))) throw new Error("Il richiamo cadrebbe in una data già trascorsa. Scegli il prossimo giorno lavorativo.");
  call.status = status;
  call.notes = notes.trim();
  if (callback) call.callbackDate = callback; else delete call.callbackDate;
  call.history.push({ status, notes: call.notes, ...(callback ? { callbackDate: callback } : {}), at, by: user.name });
}
