import * as XLSX from "xlsx";
import { detectCommodity, normalizePodPdr } from "./normalize";
import type { Commodity, LoadingImportRow } from "./types";

type SheetRow = Record<string, unknown>;

export type ParsedLoadingWorkbook = {
  sheetName: string;
  totalRows: number;
  skippedRows: number;
  rows: LoadingImportRow[];
};

type WorkbookInput = ArrayBuffer | Uint8Array | Buffer;

function workbookReadType(input: WorkbookInput) {
  return input instanceof ArrayBuffer ? "array" : "buffer";
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function valueAsText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).trim();
}

function valueFrom(row: SheetRow, candidates: string[]) {
  const normalizedCandidates = new Set(candidates.map(normalizeHeader));

  for (const [header, value] of Object.entries(row)) {
    if (normalizedCandidates.has(normalizeHeader(header))) {
      return valueAsText(value);
    }
  }

  return "";
}

function normalizeDate(value: string) {
  if (!value) {
    return undefined;
  }

  const italianDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (italianDate) {
    const [, day, month, year] = italianDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  }

  return value;
}

function commodityFromSupply(supplyType: string, podPdr: string): Commodity {
  const normalized = supplyType.trim().toLowerCase();

  if (normalized.includes("gas")) {
    return "gas";
  }

  if (normalized.includes("elettr")) {
    return "luce";
  }

  return detectCommodity(podPdr);
}

function createImportKey(row: {
  idCaricamento: string;
  podPdrNorm: string;
  signedAt?: string;
  offer: string;
}) {
  if (row.idCaricamento) {
    return `id:${row.idCaricamento}`;
  }

  return [row.podPdrNorm, row.signedAt ?? "", row.offer].filter(Boolean).join("|");
}

export function parseCaricamentiWorkbook(buffer: WorkbookInput): ParsedLoadingWorkbook {
  const workbook = XLSX.read(buffer, {
    type: workbookReadType(buffer),
    cellDates: true
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      sheetName: "",
      totalRows: 0,
      skippedRows: 0,
      rows: []
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    defval: "",
    raw: true
  });
  const rows: LoadingImportRow[] = [];
  let skippedRows = 0;

  rawRows.forEach((row, index) => {
    const idCaricamento = valueFrom(row, ["ID CARICAMENTO"]);
    const podPdr = valueFrom(row, ["POD/PDR", "POD PDR", "POD", "PDR"]);
    const podPdrNorm = normalizePodPdr(podPdr);

    if (!podPdrNorm) {
      skippedRows += 1;
      return;
    }

    const offer = valueFrom(row, ["OFFERTA"]);
    const supplyType = valueFrom(row, ["TIPO FORNITURA"]);
    const signedAt = normalizeDate(valueFrom(row, ["DATA FIRMA"]));
    const loadingRow: LoadingImportRow = {
      importKey: createImportKey({ idCaricamento, podPdrNorm, signedAt, offer }),
      rowNumber: index + 2,
      idCaricamento: idCaricamento || undefined,
      status: valueFrom(row, ["STATO CARICAMENTO"]) || undefined,
      agentInCharge: valueFrom(row, ["AGENTE INCARICATO AL CARICAMENTO"]) || undefined,
      agent: valueFrom(row, ["AGENTE"]) || undefined,
      agency: valueFrom(row, ["AGENZIA"]) || undefined,
      representative: valueFrom(row, ["RAPPRESENTANTE"]) || undefined,
      customerName: valueFrom(row, ["CLIENTE"]) || "Cliente senza nome",
      customerType: valueFrom(row, ["TIPO CLIENTE"]) || undefined,
      taxCode: valueFrom(row, ["CF"]) || undefined,
      vat: valueFrom(row, ["PIVA"]) || undefined,
      loadedAt: normalizeDate(valueFrom(row, ["DATA CARICAMENTO"])),
      signedAt,
      offer: offer || undefined,
      paymentType: valueFrom(row, ["TIPO PAGAMENTO"]) || undefined,
      supplyType: supplyType || undefined,
      commodity: commodityFromSupply(supplyType, podPdr),
      podPdr,
      podPdrNorm,
      loadedStatus: valueFrom(row, ["STATO CARICATO"]) || undefined,
      precheckStatus: valueFrom(row, ["STATO PRECHECK"]) || undefined,
      precheckDetail: valueFrom(row, ["DETTAGLIO ESITO PRECHECK"]) || undefined,
      validationDate: normalizeDate(valueFrom(row, ["DATA ULTIMA VALIDAZIONE"])),
      startDate: normalizeDate(valueFrom(row, ["DATA INIZIO"])),
      endDate: normalizeDate(valueFrom(row, ["DATA FINE"])),
      practice: valueFrom(row, ["PRATICA"]) || undefined,
      notes:
        [valueFrom(row, ["NOTE CARICAMENTO"]), valueFrom(row, ["NOTE PDP", "NOTE PdP"])]
          .filter(Boolean)
          .join(" | ") || undefined
    };

    rows.push(loadingRow);
  });

  return {
    sheetName,
    totalRows: rawRows.length,
    skippedRows,
    rows
  };
}
