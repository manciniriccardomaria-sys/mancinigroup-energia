import type { EnergyQuoteCalculation, QuoteOfferResult } from "./quote-calculator";

// Use the saved comparison basis, including for fixed gas quotes based on a
// full year. Older snapshots without costs retain their unavailable status.
export function quoteCostComparison(calculation: EnergyQuoteCalculation, offer: QuoteOfferResult | undefined = calculation.selectedOffer) {
  const annual = calculation.source.costBasis === "annual";
  const months = Math.max(1, calculation.source.periodCount);
  const currentCostKnown = annual || calculation.source.totalConsumption > 0;
  const proposedCostKnown = Boolean(offer) && offer?.quotaConsumiKnown !== false && offer?.available !== false;
  const currentCost = calculation.source.currentSpend + calculation.source.currentPcv * months;
  const proposedCost = offer ? offer.quotaConsumi + offer.pcv * months : 0;
  return { annual, currentCostKnown, proposedCostKnown, currentCost, proposedCost, saving: currentCost - proposedCost };
}
