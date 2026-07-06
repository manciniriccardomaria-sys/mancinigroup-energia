import { findOfferByCode, type OfferCatalogItem } from "./offers";
import type { Commodity } from "./types";

export const AGENCY_SHARE_RATE = 0.6;

const LIGHT_AGENCY_BASE_SPREAD = 0.006;
const GAS_AGENCY_BASE_SPREAD = 0.05;

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function agencyBaseSpread(commodity: Commodity) {
  if (commodity === "luce") {
    return LIGHT_AGENCY_BASE_SPREAD;
  }

  if (commodity === "gas") {
    return GAS_AGENCY_BASE_SPREAD;
  }

  return 0;
}

export function calculateAgencyMarginFromOffer(input: {
  offerCode: string;
  commodity: Commodity;
  consumption: number;
}): {
  tariff?: OfferCatalogItem;
  recurringPoint: number;
  recurringConsumption: number;
  grossMarginAmount: number;
  agencyShareRate: number;
  marginAmount: number;
} {
  const tariff = findOfferByCode(input.offerCode, input.commodity);

  if (!tariff) {
    return {
      recurringPoint: 0,
      recurringConsumption: 0,
      grossMarginAmount: 0,
      agencyShareRate: AGENCY_SHARE_RATE,
      marginAmount: 0
    };
  }

  const baseSpread = agencyBaseSpread(input.commodity);
  const recurringPoint = tariff.pcv;
  const recurringConsumption = input.consumption * (tariff.spread - baseSpread);
  const grossMarginAmount = recurringPoint + recurringConsumption;

  return {
    tariff,
    recurringPoint: roundCurrency(recurringPoint),
    recurringConsumption: roundCurrency(recurringConsumption),
    grossMarginAmount: roundCurrency(grossMarginAmount),
    agencyShareRate: AGENCY_SHARE_RATE,
    marginAmount: roundCurrency(grossMarginAmount * AGENCY_SHARE_RATE)
  };
}
