import type { AgencyMarginImportRow, Commodity } from "./types";
import { metOfferCatalog } from "./met-offers";

type OfferCustomerType = AgencyMarginImportRow["customerType"];

export const defaultLightLosses = {
  punMono: false,
  punBands: true,
  spread: true,
  fixedPrice: true,
  dispatching: true,
  capacity: false
};

export type LightLossConfiguration = typeof defaultLightLosses;

export type BandPrices = { f1: number; f2: number; f3: number };
export type MetOfferTerms = {
  sourceFile: string;
  conditionDate: string;
  fixedMonths: number;
  priceBasis: "net" | "gross";
  fixedStartDate?: string;
  energyModel?: "cer";
  nonHourlySurcharge?: number;
  commercialPerUnit: number;
  monthlyServiceFee: number;
  financialRate?: number;
  financialFrom?: string;
  gasCsc?: number;
  gasPcsReference?: number;
  minAnnualConsumption?: number;
  maxAnnualConsumption?: number;
  renewalSpread?: number;
  referenceIndex?: number;
  commissionFixed?: number;
  commissionPerUnit?: number;
  notes?: string[];
};

export function lightLossesForOffer(offer: { lightLosses?: Partial<LightLossConfiguration> }): LightLossConfiguration {
  return { ...defaultLightLosses, ...offer.lightLosses };
}

export type OfferCatalogItem = {
  code: string;
  commodity: Exclude<Commodity, "non_definito">;
  offerEasy: string;
  customerType: Exclude<OfferCustomerType, "non_definito">;
  pcv: number;
  spread: number;
  pricingType?: "fixed" | "variable";
  fixedPrice?: number;
  active?: boolean;
  commissionRate?: number;
  commissionBaseSpread?: number;
  fixedAgencyCommission?: number;
  lightLosses?: Partial<LightLossConfiguration>;
  supplier?: "AGF" | "MET";
  fixedPrices?: BandPrices;
  requiresBands?: boolean;
  met?: MetOfferTerms;
};

export const offerCatalog: OfferCatalogItem[] = [
  {
    code: "AGF_EE_MANCINI GROUP_BUSINESS BASIC",
    commodity: "luce",
    offerEasy: "Business Basic",
    customerType: "BUS",
    pcv: 12,
    spread: 0.02
  },
  {
    code: "AGF_EE_MANCINI GROUP_BUSINESS FIDELITY",
    commodity: "luce",
    offerEasy: "Business Fidelity",
    customerType: "BUS",
    pcv: 12,
    spread: 0.018
  },
  {
    code: "AGF_EE_MANCINI GROUP_BUSINESS FIDELITY 15",
    commodity: "luce",
    offerEasy: "Business Fidelity 15",
    customerType: "BUS",
    pcv: 12,
    spread: 0.015
  },
  {
    code: "AGF_EE_MANCINI GROUP_COND. STANDARD_2025",
    commodity: "luce",
    offerEasy: "Condomini Standard",
    customerType: "BUS",
    pcv: 14,
    spread: 0.03
  },
  {
    code: "AGF_EE_MANCINI GROUP_HOME FAMILY",
    commodity: "luce",
    offerEasy: "Home Family",
    customerType: "RES",
    pcv: 6,
    spread: 0.015
  },
  {
    code: "AGF_EE_MANCINI GROUP_HOME FIDELITY",
    commodity: "luce",
    offerEasy: "Home Fidelity",
    customerType: "RES",
    pcv: 8.5,
    spread: 0.02
  },
  {
    code: "AGF_EE_MANCINI GROUP_HOME BASIC",
    commodity: "luce",
    offerEasy: "Home Basic",
    customerType: "RES",
    pcv: 10,
    spread: 0.025
  },
  {
    code: "AGF_EE_MANCINI GROUP_HOME PLUS",
    commodity: "luce",
    offerEasy: "Home Plus",
    customerType: "RES",
    pcv: 12,
    spread: 0.035
  },
  {
    code: "AGF_EE_MANCINI GROUP_HOME STANDARD",
    commodity: "luce",
    offerEasy: "Home Standard",
    customerType: "RES",
    pcv: 10,
    spread: 0.03
  },
  {
    code: "AGF_EE_MANCINI GROUP_RIS_STUDI PROFESSIONALI",
    commodity: "luce",
    offerEasy: "Ris Studi Professionali",
    customerType: "BUS",
    pcv: 10,
    spread: 0.02
  },
  {
    code: "AGF_EE_RAGNO_BUSINESS FIDELITY",
    commodity: "luce",
    offerEasy: "Business Fidelity",
    customerType: "BUS",
    pcv: 12,
    spread: 0.018
  },
  {
    code: "AGF_EE_RAGNO_BUSINESS FIDELITY 12_2025",
    commodity: "luce",
    offerEasy: "Business Fidelity 15",
    customerType: "BUS",
    pcv: 12,
    spread: 0.015
  },
  {
    code: "AGF_EE_RAGNO_BUSINESS FIDELITY_2025",
    commodity: "luce",
    offerEasy: "Business Fidelity",
    customerType: "BUS",
    pcv: 12,
    spread: 0.018
  },
  {
    code: "AGF_EE_RAGNO_HOME FAMILY",
    commodity: "luce",
    offerEasy: "Home Family",
    customerType: "RES",
    pcv: 6,
    spread: 0.015
  },
  {
    code: "AGF_EE_RAGNO_HOME FAMILY_2025",
    commodity: "luce",
    offerEasy: "Home Family",
    customerType: "RES",
    pcv: 6,
    spread: 0.015
  },
  {
    code: "AGF_EE_RAGNO_HOME FIDELITY",
    commodity: "luce",
    offerEasy: "Home Fidelity",
    customerType: "RES",
    pcv: 8.5,
    spread: 0.02
  },
  {
    code: "AGF_EE_RAGNO_HOME FIDELITY_2025",
    commodity: "luce",
    offerEasy: "Home Fidelity",
    customerType: "RES",
    pcv: 8.5,
    spread: 0.02
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME FAMILY",
    commodity: "gas",
    offerEasy: "Home Family",
    customerType: "RES",
    pcv: 8,
    spread: 0.08
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME FIDELITY",
    commodity: "gas",
    offerEasy: "Home Fidelity",
    customerType: "RES",
    pcv: 8,
    spread: 0.109
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME BASIC",
    commodity: "gas",
    offerEasy: "Home Basic",
    customerType: "RES",
    pcv: 10,
    spread: 0.129
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME LIGHT",
    commodity: "gas",
    offerEasy: "Home Light",
    customerType: "RES",
    pcv: 8,
    spread: 0.129
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME PLUS",
    commodity: "gas",
    offerEasy: "Home Plus",
    customerType: "RES",
    pcv: 12,
    spread: 0.149
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME STANDARD",
    commodity: "gas",
    offerEasy: "Home Standard",
    customerType: "RES",
    pcv: 12,
    spread: 0.129
  },
  {
    code: "AGF_GAS_MANCINI GROUP_BUSINESS BASIC",
    commodity: "gas",
    offerEasy: "Business Basic",
    customerType: "BUS",
    pcv: 10,
    spread: 0.129
  },
  {
    code: "AGF_GAS_MANCINI GROUP_BUSINESS FIDELITY",
    commodity: "gas",
    offerEasy: "Business Fidelity",
    customerType: "BUS",
    pcv: 12,
    spread: 0.109
  },
  {
    code: "AGF_GAS_MANCINI GROUP_BUSINESS STANDARD",
    commodity: "gas",
    offerEasy: "Business Standard",
    customerType: "BUS",
    pcv: 10,
    spread: 0.15
  },
  {
    code: "AGF_GAS_RAGNO_HOME FAMILY PLUS_2025",
    commodity: "gas",
    offerEasy: "Home Family Plus",
    customerType: "RES",
    pcv: 12,
    spread: 0.08
  },
  {
    code: "AGF_GAS_RAGNO_HOME FIDELITY",
    commodity: "gas",
    offerEasy: "Home Fidelity",
    customerType: "RES",
    pcv: 8,
    spread: 0.109
  },
  {
    code: "AGF_GAS_RAGNO_HOME FIDELITY_2025",
    commodity: "gas",
    offerEasy: "Home Fidelity",
    customerType: "RES",
    pcv: 8,
    spread: 0.109
  },
  {
    code: "AGF_GAS_MANCINI GROUP_COND. STANDARD_2025",
    commodity: "gas",
    offerEasy: "Condomini Standard",
    customerType: "BUS",
    pcv: 16,
    spread: 0.22
  }
];

export function normalizeOfferCode(value: string) {
  return value
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\s*_\s*/g, "_")
    .trim();
}

export function findOfferByCode(code: string, commodity?: Commodity) {
  const normalizedCode = normalizeOfferCode(code);
  const candidates = offerCatalog.filter((offer) => !commodity || offer.commodity === commodity);

  return (
    candidates.find((offer) => normalizeOfferCode(offer.code) === normalizedCode) ??
    candidates
      .slice()
      .sort((a, b) => b.code.length - a.code.length)
      .find((offer) => normalizedCode.includes(normalizeOfferCode(offer.code)))
  );
}

export function summarizeOfferCatalog() {
  return offerCatalog.reduce(
    (summary, offer) => {
      summary.total += 1;
      summary[offer.commodity] += 1;
      summary[offer.customerType] += 1;
      return summary;
    },
    { total: 0, luce: 0, gas: 0, RES: 0, BUS: 0 }
  );
}

export const gasQuoteOffers = [
  {
    code: "AGF_GAS_MANCINI GROUP_HOME FAMILY",
    commodity: "gas",
    offerEasy: "Home Family",
    customerType: "RES",
    pcv: 8,
    spread: 0.09
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME FIDELITY",
    commodity: "gas",
    offerEasy: "Home Fidelity",
    customerType: "RES",
    pcv: 8,
    spread: 0.109
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME BASIC",
    commodity: "gas",
    offerEasy: "Home Basic",
    customerType: "RES",
    pcv: 8,
    spread: 0.129
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME STANDARD",
    commodity: "gas",
    offerEasy: "Home Standard",
    customerType: "RES",
    pcv: 10,
    spread: 0.129
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME PLUS_0.129",
    commodity: "gas",
    offerEasy: "Home Plus",
    customerType: "RES",
    pcv: 12,
    spread: 0.129
  },
  {
    code: "AGF_GAS_MANCINI GROUP_HOME PLUS",
    commodity: "gas",
    offerEasy: "Home Plus",
    customerType: "RES",
    pcv: 12,
    spread: 0.149
  },
  {
    code: "AGF_GAS_MANCINI GROUP_BUSINESS FIDELITY",
    commodity: "gas",
    offerEasy: "Business Fidelity",
    customerType: "BUS",
    pcv: 12,
    spread: 0.109
  },
  {
    code: "AGF_GAS_MANCINI GROUP_BUSINESS BASIC",
    commodity: "gas",
    offerEasy: "Business Basic",
    customerType: "BUS",
    pcv: 12,
    spread: 0.129
  }
] satisfies OfferCatalogItem[];

export type ManagedOffer = OfferCatalogItem & { id: string; active: boolean };

export function defaultQuoteOffers(): ManagedOffer[] {
  const catalog = new Map(offerCatalog.map((offer) => [offer.code, offer]));
  for (const offer of gasQuoteOffers) catalog.set(offer.code, offer);
  return [
    ...[...catalog.values()].map((offer): ManagedOffer => ({
      ...offer, id: offer.code, active: true, pricingType: "variable"
    })),
    ...metOfferCatalog.map((offer): ManagedOffer => ({ ...offer, id: offer.code, active: offer.active ?? true }))
  ];
}

// Firestore stores only changed records: retain untouched defaults when reading overrides.
export function normalizeManagedOffers(offers: ManagedOffer[] = []): ManagedOffer[] {
  const merged = new Map(defaultQuoteOffers().map((offer) => [offer.id, offer]));
  for (const offer of offers) merged.set(offer.id, offer);
  return [...merged.values()];
}
