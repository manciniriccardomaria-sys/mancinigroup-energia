import * as XLSX from "xlsx";
import { calculateAgencyMarginFromOffer } from "./agency-margin-calculation";
import { detectCommodity, normalizePodPdr } from "./normalize";
import type { AgencyMarginImportRow, Commodity } from "./types";

type CsvRow = Record<string, unknown>;
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

function valueFrom(row: CsvRow, header: string) {
  return cleanText(row[header]);
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

  const rawRows = XLSX.utils.sheet_to_json<CsvRow>(workbook.Sheets[sheetName], {
    defval: "",
    raw: true
  });
  const fallbackMonthKey = options.monthKey ?? monthKeyFromFilename(fileName);
  const rows: AgencyMarginImportRow[] = [];
  let skippedRows = 0;

  rawRows.forEach((row, index) => {
    const podPdr = valueFrom(row, "Fornitura");
    const podPdrNorm = normalizePodPdr(podPdr);

    if (!podPdrNorm) {
      skippedRows += 1;
      return;
    }

    const invoiceNumber = valueFrom(row, "Numero");
    const issuedAt = parseItalianDate(valueFrom(row, "Emissione"));
    const dueAt = parseItalianDate(valueFrom(row, "Scadenza"));
    const offer = valueFrom(row, "Offerta");
    const commodity = options.commodity ?? commodityFromFile(fileName, podPdr);
    const consumption = parseNumber(valueFrom(row, "Consumo"));
    const agencyMargin = calculateAgencyMarginFromOffer({
      offerCode: offer,
      commodity,
      consumption
    });
    const tariff = agencyMargin.tariff;

    rows.push({
      importKey: `invoice:${invoiceNumber || `${fileName}-${index + 2}`}|${podPdrNorm}`,
      rowNumber: index + 2,
      monthKey: options.monthKey ?? monthKeyFromDate(issuedAt) ?? fallbackMonthKey,
      invoiceNumber,
      podPdr,
      podPdrNorm,
      customerName: valueFrom(row, "Rag. soc.") || "Cliente senza nome",
      representative: valueFrom(row, "Rappresentante") || undefined,
      paymentType: valueFrom(row, "Pagamento") || undefined,
      vat: valueFrom(row, "P.iva") || undefined,
      taxCode: valueFrom(row, "Cod. Fis.") || undefined,
      issuedAt,
      dueAt,
      invoiceTotal: parseNumber(valueFrom(row, "Totale")),
      paid: parseNumber(valueFrom(row, "Pagato")),
      balance: parseNumber(valueFrom(row, "Saldo")),
      consumption,
      agent: valueFrom(row, "Agente") || undefined,
      offer: offer || undefined,
      offerEasy: tariff?.offerEasy,
      customerType: tariff?.customerType ?? "non_definito",
      commodity,
      cmor: parseNumber(valueFrom(row, "CMOR")),
      recurringPoint: agencyMargin.recurringPoint,
      recurringConsumption: agencyMargin.recurringConsumption,
      grossMarginAmount: agencyMargin.grossMarginAmount,
      agencyShareRate: agencyMargin.agencyShareRate,
      marginAmount: agencyMargin.marginAmount,
      tariffNote: tariff ? undefined : `Tariffa provvigione agenzia non riconosciuta: ${offer || "offerta vuota"}`
    });
  });

  return {
    totalRows: rawRows.length,
    skippedRows,
    rows
  };
}
