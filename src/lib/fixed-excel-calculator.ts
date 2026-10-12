import { fixedExcelReference as reference } from "./fixed-excel-reference";
import { excelModel } from "./excel-formulas";
import type { EnergyQuoteCalculation, EnergyQuoteInput, QuoteOfferResult } from "./quote-calculator";

export const FIXED_EXCEL_FILE = reference.fileName;
export const FIXED_EXCEL_SHA256 = reference.sha256;
const LIGHT = "SIMULATORE_LUCE FISSO";
const GAS = "SIMULATORE_GAS FISSO";
const months = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];
const currencyPrecision = new Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits: 2 });
const rounded = (value: number) => Number(currencyPrecision.format(value)) || 0;
const monthName = (key?: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key ?? "") ? months[Number(key!.slice(5)) - 1] : null;

export function calculateFixedExcelQuote(input: EnergyQuoteInput): EnergyQuoteCalculation {
  const light = input.commodity === "luce";
  const sheet = light ? LIGHT : GAS;
  const warnings: string[] = [];
  const overrides: Record<string, number | string | null> = {
    E4: input.currentAveragePrice,
    F4: input.currentPcv,
    [light ? "D26" : "D32"]: input.customerType === "RES" ? "RESIDENZIALE" : "BUSINESS"
  };
  if (!(input.currentAveragePrice > 0)) warnings.push("Inserisci il prezzo medio della quota consumi della bolletta.");
  if (!Number.isFinite(input.currentPcv) || input.currentPcv < 0) warnings.push("Inserisci una PCV mensile non negativa.");
  const periodCount = light ? 1 + Number(Boolean(input.secondMonthKey)) : 1;
  // The gas sheet uses annual consumption only; monthly quantities from the
  // other mode must not become a fictional gas bill on screen or in print.
  let totalConsumption = 0;
  if (light) {
    overrides.E6 = monthName(input.monthKey);
    overrides.F6 = monthName(input.secondMonthKey);
    overrides.E8 = input.lightConsumptionMode === "fasce" ? "A FASCE" : "MONORARIA";
    overrides.E11 = input.excelCurrentMonoPrice ?? null;
    overrides.F11 = input.excelMonoConsumption ?? null;
    for (const [cell, field] of [["E14", "excelCurrentF1Price"], ["E15", "excelCurrentF2Price"], ["E16", "excelCurrentF3Price"], ["F14", "excelConsumptionF1"], ["F15", "excelConsumptionF2"], ["F16", "excelConsumptionF3"]] as const) overrides[cell] = input[field] ?? null;
    if (!overrides.E6 || (input.secondMonthKey && !overrides.F6)) warnings.push("Seleziona i mesi della bolletta.");
    const required = input.lightConsumptionMode === "fasce"
      ? ["excelCurrentF1Price", "excelCurrentF2Price", "excelCurrentF3Price", "excelConsumptionF1", "excelConsumptionF2", "excelConsumptionF3"] as const
      : ["excelCurrentMonoPrice", "excelMonoConsumption"] as const;
    if (required.some((field) => input[field] === undefined || !Number.isFinite(input[field]) || input[field]! < 0)) {
      warnings.push("Compila prezzi e consumi del periodo, inserendo anche gli eventuali zeri.");
    }
    totalConsumption = input.lightConsumptionMode === "fasce"
      ? (input.excelConsumptionF1 ?? 0) + (input.excelConsumptionF2 ?? 0) + (input.excelConsumptionF3 ?? 0)
      : input.excelMonoConsumption ?? 0;
    if (!(totalConsumption > 0)) warnings.push("Inserisci i consumi del periodo.");
  } else {
    overrides.E8 = input.gasAnnualConsumption;
    if (!(input.gasAnnualConsumption > 0)) warnings.push("Inserisci il consumo annuo gas.");
  }
  const model = excelModel(reference.sheets, { [sheet]: overrides });
  const rows = light ? [50, 51, 52, ...(input.customerType === "RES" ? [53] : [])] : [33, 34, ...(input.customerType === "RES" ? [35, 36, 37, 38] : [])];
  const offers: QuoteOfferResult[] = rows.map((row) => {
    const code = `EXCEL_FIXED_${input.commodity.toUpperCase()}_${input.customerType}_${row}`;
    const differenceCell = `${light ? "H" : "G"}${row}`;
    const issues: string[] = [];
    const notices: string[] = [];
    if (!light && row === 38) issues.push("Condizioni tariffarie incomplete: offerta da verificare.");
    let annualDifference = 0, pcv = 0, fixedPrice = 0;
    try {
      pcv = model.number(sheet, `E${row}`);
      // Business light price labels contain the text "A FASCE" in F50:F52;
      // this label must not prevent evaluating the valid H-column formula.
      const priceValue = model.value(sheet, `F${row}`);
      fixedPrice = typeof priceValue === "number" ? priceValue : 0;
      annualDifference = model.number(sheet, differenceCell);
    } catch {
      issues.push("Calcolo non disponibile: dati dell’offerta da verificare.");
    }
    if (light && input.lightConsumptionMode === "totale") notices.push("Confronto monorario da verificare prima dell’utilizzo.");
    if (!light && row >= 35) notices.push("Verifica la corrispondenza tra l’offerta selezionata e le condizioni tariffarie.");
    const name = model.value(sheet, `D${row}`);
    const priceText = (value: number) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 }).format(value);
    const tariffRow = row - 23;
    const priceLabel = light && input.customerType === "BUS"
      ? `F1 ${priceText(model.number(sheet, `E${tariffRow}`))} · F2 ${priceText(model.number(sheet, `F${tariffRow}`))} · F3 ${priceText(model.number(sheet, `G${tariffRow}`))} €/kWh`
      : `${priceText(fixedPrice)} ${light ? "€/kWh" : "€/Smc"}`;
    return {
      code,
      offerName: String(name ?? "Riga incompleta"),
      customerType: input.customerType,
      pcv,
      spread: 0,
      pricingType: "fixed",
      fixedPrice,
      priceLabel,
      quotaConsumi: 0,
      quotaConsumiKnown: false,
      tariffKnown: light || row !== 38,
      annualDifference: rounded(annualDifference),
      annualDifferenceExact: annualDifference,
      annualSaving: rounded(-annualDifference),
      agencyCommission: 0,
      commissionKnown: false,
      available: issues.length === 0,
      issues,
      notices,
      excelDifferenceCell: `${sheet}!${differenceCell}`,
      selected: code === input.selectedOfferCode
    };
  });
  if (!offers.some((offer) => offer.selected)) offers[0].selected = true;
  const selectedOffer = offers.find((offer) => offer.selected)!;
  warnings.push(...(selectedOffer.issues ?? []));
  return {
    ready: warnings.length === 0,
    warnings,
    source: {
      currentAveragePrice: input.currentAveragePrice,
      currentSpend: rounded(input.currentAveragePrice * totalConsumption),
      currentSpread: 0,
      currentPcv: input.currentPcv,
      totalConsumption,
      averageMonthlyConsumption: totalConsumption / periodCount,
      annualConsumption: light ? totalConsumption / periodCount * 12 : input.gasAnnualConsumption,
      periodCount
    },
    selectedOffer,
    offers
  };
}
