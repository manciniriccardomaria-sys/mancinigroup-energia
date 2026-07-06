import type { AgencyMarginImportRow, Commodity } from "./types";

type OfferCustomerType = AgencyMarginImportRow["customerType"];

export type OfferCatalogItem = {
  code: string;
  commodity: Exclude<Commodity, "non_definito">;
  offerEasy: string;
  customerType: Exclude<OfferCustomerType, "non_definito">;
  pcv: number;
  spread: number;
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
