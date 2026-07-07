import * as XLSX from "xlsx";
import { AGENCY_SHARE_RATE, agencyBaseSpread } from "./agency-margin-calculation";
import { detectCommodity, normalizePodPdr } from "./normalize";
import type { AgencyMarginImportRow, Commodity } from "./types";

type MarginCommodity = Exclude<Commodity, "non_definito">;

type ParseAgencyMarginOptions = {
  monthKey?: string;
  commodity?: MarginCommodity;
};

export type ParsedAgencyMarginCsv = {
  totalRows: number;
  skippedRows: number;
  rows: AgencyMarginImportRow[];
};

type WorkbookInput = ArrayBuffer | Uint8Array | Buffer;

function workbookReadType(input: WorkbookInput) {
  return input instanceof ArrayBuffer ? "array" : "buffer";
}

const monthNames: Record<string, string> = {
  gennaio: "01",
  febbraio: "02",
  marzo: "03",
  aprile: "04",
  maggio: "05",
  giugno: "06",
  luglio: "07",
  agosto: "08",
  settembre: "09",
  ottobre: "10",
  novembre: "11",
  dicembre: "12"
};

function cleanText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).trim();
  return text.toLowerCase() === "null" ? "" : text;
}

function parseNumber(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!cleaned) {
    return 0;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNumericCell(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return cleanText(value) !== "";
}

function parseCellNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  return parseNumber(cleanText(value));
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function normalizeHeader(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function buildHeaderMap(headerRow: unknown[]) {
  const map = new Map<string, number>();

  headerRow.forEach((value, index) => {
    const key = normalizeHeader(value);
    if (key && !map.has(key)) {
      map.set(key, index);
    }
  });

  return map;
}

function headerIndex(headers: Map<string, number>, candidates: string[]) {
  for (const candidate of candidates) {
    const index = headers.get(normalizeHeader(candidate));

    if (index !== undefined) {
      return index;
    }
  }

  return undefined;
}

function valueAt(row: unknown[], index?: number) {
  return index === undefined ? "" : cleanText(row[index]);
}

function numberAt(row: unknown[], index?: number) {
  return index === undefined ? 0 : parseCellNumber(row[index]);
}

function hasValueAt(row: unknown[], index?: number) {
  return index !== undefined && isNumericCell(row[index]);
}

function offerEasyFromName(offer: string) {
  const normalized = normalizeHeader(offer).toUpperCase();

  if (normalized.includes("HOME FAMILY PLUS")) return "Home Family Plus";
  if (normalized.includes("HOME FAMILY")) return "Home Family";
  if (normalized.includes("HOME FIDELITY")) return "Home Fidelity";
  if (normalized.includes("HOME STANDARD")) return "Home Standard";
  if (normalized.includes("HOME BASIC")) return "Home Basic";
  if (normalized.includes("HOME LIGHT")) return "Home Light";
  if (normalized.includes("HOME PLUS")) return "Home Plus";
  if (normalized.includes("BUSINESS FIDELITY 15")) return "Business Fidelity 15";
  if (normalized.includes("BUSINESS FIDELITY 12")) return "Business Fidelity 12";
  if (normalized.includes("BUSINESS FIDELITY")) return "Business Fidelity";
  if (normalized.includes("BUSINESS STANDARD")) return "Business Standard";
  if (normalized.includes("BUSINESS BASIC")) return "Business Basic";
  if (normalized.includes("CONDOMINI STANDARD") || normalized.includes("COND STANDARD")) return "Condomini Standard";
  if (normalized.includes("STUDI PROFESSIONALI")) return "Business Studi Professionali";

  return offer || undefined;
}

function customerTypeFromOffer(offer: string): AgencyMarginImportRow["customerType"] {
  const normalized = normalizeHeader(offer).toUpperCase();

  if (
    normalized.includes("BUSINESS") ||
    normalized.includes("CONDOMINI") ||
    normalized.includes("COND STANDARD") ||
    normalized.includes("STUDI PROFESSIONALI")
  ) {
    return "BUS";
  }

  if (normalized.includes("HOME")) {
    return "RES";
  }

  return "non_definito";
}

function findHeaderRow(matrix: unknown[][]) {
  return matrix.findIndex((row) => {
    const headers = buildHeaderMap(row);
    return (
      headerIndex(headers, ["Fornitura", "POD", "PDR", "POD/PDR"]) !== undefined &&
      headerIndex(headers, ["Consumo", "Consumi"]) !== undefined
    );
  });
}

function emptyToUndefined(value: string) {
  return value || undefined;
}

function marginFromValues(input: {
  commodity: Commodity;
  consumption: number;
  gross?: number;
  pcv?: number;
  spread?: number;
  recurringConsumption?: number;
}) {
  if (input.pcv !== undefined && input.spread !== undefined && input.commodity !== "non_definito") {
    const recurringConsumption = input.consumption * (input.spread - agencyBaseSpread(input.commodity));
    const grossMarginAmount = input.pcv + recurringConsumption;

    return {
      recurringPoint: round4(input.pcv),
      recurringConsumption: round4(recurringConsumption),
      grossMarginAmount: round4(grossMarginAmount),
      marginAmount: roundCurrency(grossMarginAmount * AGENCY_SHARE_RATE),
      tariffNote: undefined
    };
  }

  if (input.gross !== undefined) {
    const recurringPoint = input.pcv ?? 0;
    const recurringConsumption = input.recurringConsumption ?? input.gross - recurringPoint;

    return {
      recurringPoint: round4(recurringPoint),
      recurringConsumption: round4(recurringConsumption),
      grossMarginAmount: round4(input.gross),
      marginAmount: roundCurrency(input.gross * AGENCY_SHARE_RATE),
      tariffNote: undefined
    };
  }

  if (input.pcv !== undefined && input.recurringConsumption !== undefined) {
    const grossMarginAmount = input.pcv + input.recurringConsumption;

    return {
      recurringPoint: round4(input.pcv),
      recurringConsumption: round4(input.recurringConsumption),
      grossMarginAmount: round4(grossMarginAmount),
      marginAmount: roundCurrency(grossMarginAmount * AGENCY_SHARE_RATE),
      tariffNote: undefined
    };
  }

  return {
    recurringPoint: 0,
    recurringConsumption: 0,
    grossMarginAmount: 0,
    marginAmount: 0,
    tariffNote: "Dati provvigione agenzia mancanti: servono colonna D oppure PCV e spread nel file importato."
  };
}

function parseItalianDate(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) {
    return undefined;
  }

  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function monthKeyFromDate(value?: string) {
  return value?.slice(0, 7);
}

function monthKeyFromFilename(fileName: string) {
  const normalized = fileName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const [name, month] of Object.entries(monthNames)) {
    const match = normalized.match(new RegExp(`${name}(\\d{2}|\\d{4})`));
    if (!match) {
      continue;
    }

    const yearValue = match[1];
    const year = yearValue.length === 2 ? `20${yearValue}` : yearValue;
    return `${year}-${month}`;
  }

  return new Date().toISOString().slice(0, 7);
}

function commodityFromFile(fileName: string, podPdr: string): Commodity {
  const upperName = fileName.toUpperCase();

  if (upperName.includes("GAS")) {
    return "gas";
  }

  if (upperName.includes("LUCE") || upperName.includes("EE")) {
    return "luce";
  }

  return detectCommodity(podPdr);
}

export function parseAgencyMarginCsv(
  buffer: WorkbookInput,
  fileName: string,
  options: ParseAgencyMarginOptions = {}
): ParsedAgencyMarginCsv {
  const workbook = XLSX.read(buffer, {
    type: workbookReadType(buffer),
    raw: true
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      totalRows: 0,
      skippedRows: 0,
      rows: []
    };
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    blankrows: false,
    defval: "",
    header: 1,
    raw: true
  });
  const fallbackMonthKey = options.monthKey ?? monthKeyFromFilename(fileName);
  const rows: AgencyMarginImportRow[] = [];
  let skippedRows = 0;
  const headerRowIndex = findHeaderRow(matrix);

  if (headerRowIndex >= 0) {
    const headers = buildHeaderMap(matrix[headerRowIndex] ?? []);
    const indexes = {
      invoiceNumber: headerIndex(headers, ["Numero", "N. Fattura", "Numero fattura"]),
      podPdr: headerIndex(headers, ["Fornitura", "POD", "PDR", "POD/PDR"]),
      representative: headerIndex(headers, ["Rappresentante"]),
      customerName: headerIndex(headers, ["Rag. soc.", "Rag soc", "Ragione sociale", "Cliente", "Nome cliente"]),
      paymentType: headerIndex(headers, ["Pagamento", "Tipo pagamento"]),
      vat: headerIndex(headers, ["P.iva", "P iva", "Partita iva"]),
      taxCode: headerIndex(headers, ["Cod. Fis.", "Cod fis", "Codice fiscale"]),
      issuedAt: headerIndex(headers, ["Emissione", "Data emissione"]),
      dueAt: headerIndex(headers, ["Scadenza", "Data scadenza"]),
      invoiceTotal: headerIndex(headers, ["Totale", "Totale fattura"]),
      paid: headerIndex(headers, ["Pagato"]),
      balance: headerIndex(headers, ["Saldo"]),
      consumption: headerIndex(headers, ["Consumo", "Consumi"]),
      agent: headerIndex(headers, ["Agente", "Subagente"]),
      offer: headerIndex(headers, ["Offerta", "Nome offerta"]),
      cmor: headerIndex(headers, ["CMOR"]),
      gross: headerIndex(headers, ["D", "Colonna D", "Margine 100", "Margine agenzia 100", "Provvigione agenzia 100", "Totale provvigione"]),
      pcv: headerIndex(headers, ["PCV", "PCV mensile", "Pcv"]),
      spread: headerIndex(headers, ["Spread"]),
      recurringConsumption: headerIndex(headers, ["F", "Colonna F", "Quota spread", "Quota consumo", "Quota consumi"])
    };

    for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
      const row = matrix[index] ?? [];
      const podPdr = valueAt(row, indexes.podPdr);
      const podPdrNorm = normalizePodPdr(podPdr);

      if (!podPdrNorm) {
        skippedRows += 1;
        continue;
      }

      const invoiceNumber = valueAt(row, indexes.invoiceNumber);
      const issuedAt = parseItalianDate(valueAt(row, indexes.issuedAt));
      const dueAt = parseItalianDate(valueAt(row, indexes.dueAt));
      const offer = valueAt(row, indexes.offer);
      const commodity = options.commodity ?? commodityFromFile(fileName, podPdr);
      const consumption = numberAt(row, indexes.consumption);
      const gross = hasValueAt(row, indexes.gross) ? numberAt(row, indexes.gross) : undefined;
      const pcv = hasValueAt(row, indexes.pcv) ? numberAt(row, indexes.pcv) : undefined;
      const spread = hasValueAt(row, indexes.spread) ? numberAt(row, indexes.spread) : undefined;
      const recurringConsumption = hasValueAt(row, indexes.recurringConsumption)
        ? numberAt(row, indexes.recurringConsumption)
        : undefined;
      const margin = marginFromValues({
        commodity,
        consumption,
        gross,
        pcv,
        spread,
        recurringConsumption
      });

      rows.push({
        importKey: `invoice:${invoiceNumber || `${fileName}-${index + 1}`}|${podPdrNorm}`,
        rowNumber: index + 1,
        monthKey: options.monthKey ?? monthKeyFromDate(issuedAt) ?? fallbackMonthKey,
        invoiceNumber,
        podPdr,
        podPdrNorm,
        customerName: valueAt(row, indexes.customerName) || "Cliente senza nome",
        representative: emptyToUndefined(valueAt(row, indexes.representative)),
        paymentType: emptyToUndefined(valueAt(row, indexes.paymentType)),
        vat: emptyToUndefined(valueAt(row, indexes.vat)),
        taxCode: emptyToUndefined(valueAt(row, indexes.taxCode)),
        issuedAt,
        dueAt,
        invoiceTotal: numberAt(row, indexes.invoiceTotal),
        paid: numberAt(row, indexes.paid),
        balance: numberAt(row, indexes.balance),
        consumption,
        agent: emptyToUndefined(valueAt(row, indexes.agent)),
        offer: emptyToUndefined(offer),
        offerEasy: offerEasyFromName(offer),
        customerType: customerTypeFromOffer(offer),
        commodity,
        cmor: numberAt(row, indexes.cmor),
        recurringPoint: margin.recurringPoint,
        recurringConsumption: margin.recurringConsumption,
        grossMarginAmount: margin.grossMarginAmount,
        agencyShareRate: AGENCY_SHARE_RATE,
        marginAmount: margin.marginAmount,
        tariffNote: margin.tariffNote
      });
    }
  } else {
    matrix.forEach((row, index) => {
      const podPdr = valueAt(row, 0);
      const podPdrNorm = normalizePodPdr(podPdr);

      if (!podPdrNorm) {
        skippedRows += 1;
        return;
      }

      const offer = valueAt(row, 8);
      const commodity = options.commodity ?? commodityFromFile(fileName, podPdr);
      const consumption = numberAt(row, 6);
      const gross = hasValueAt(row, 3) ? numberAt(row, 3) : undefined;
      const pcv = hasValueAt(row, 4) ? numberAt(row, 4) : undefined;
      const recurringConsumption = hasValueAt(row, 5) ? numberAt(row, 5) : undefined;
      const margin = marginFromValues({
        commodity,
        consumption,
        gross,
        pcv,
        recurringConsumption
      });

      rows.push({
        importKey: `margin:${fallbackMonthKey}:${index + 1}|${podPdrNorm}`,
        rowNumber: index + 1,
        monthKey: fallbackMonthKey,
        invoiceNumber: "",
        podPdr,
        podPdrNorm,
        customerName: valueAt(row, 1) || "Cliente senza nome",
        representative: emptyToUndefined(valueAt(row, 2)),
        invoiceTotal: 0,
        paid: 0,
        balance: 0,
        consumption,
        agent: emptyToUndefined(valueAt(row, 7)),
        offer: emptyToUndefined(offer),
        offerEasy: offerEasyFromName(offer),
        customerType: customerTypeFromOffer(offer),
        commodity,
        cmor: 0,
        recurringPoint: margin.recurringPoint,
        recurringConsumption: margin.recurringConsumption,
        grossMarginAmount: margin.grossMarginAmount,
        agencyShareRate: AGENCY_SHARE_RATE,
        marginAmount: margin.marginAmount,
        tariffNote: margin.tariffNote
      });
    });
  }

  return {
    totalRows: matrix.length,
    skippedRows,
    rows
  };
}
