import { formatEuro } from "./normalize";
import { quoteSavingForPeriod, type EnergyQuoteCalculation, type EnergyQuoteInput, type QuoteOfferResult } from "./quote-calculator";

// Il risparmio è positivo quando la proposta costa meno dell'offerta attuale.
export function formatSavingImpact(value: number) {
  return `${value > 0 ? "+" : ""}${formatEuro(value)}`;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function quotePeriodComparison(
  calculation: EnergyQuoteCalculation,
  input: Pick<EnergyQuoteInput, "calculationModel" | "commodity">,
  offer: QuoteOfferResult | undefined = calculation.selectedOffer
) {
  const periodCount = Math.max(1, calculation.source.periodCount);
  const historical = input.calculationModel === "fixed_excel";
  const annualOnly = historical && input.commodity === "gas";
  const currentCost = historical && calculation.source.totalConsumption === 0 ? undefined
    : roundCurrency(calculation.source.currentSpend + calculation.source.currentPcv * periodCount);
  const proposedCost = !offer || offer.quotaConsumiKnown === false || offer.available === false ? undefined
    : roundCurrency(offer.quotaConsumi + offer.pcv * periodCount);
  const saving = !offer || offer.available === false ? undefined : historical
    ? roundCurrency(annualOnly ? offer.annualSaving : quoteSavingForPeriod(offer.annualSaving, periodCount))
    : currentCost === undefined || proposedCost === undefined ? undefined : roundCurrency(currentCost - proposedCost);
  return { currentCost, proposedCost, saving, annualOnly };
}
