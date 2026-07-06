import { offerCatalog, type OfferCatalogItem } from "./offers";
import type { Commodity, MarketVariable } from "./types";

// Fonte formule: fogli SIMULATORE_LUCE e SIMULATORE_GAS. Il foglio veloce non guida il calcolo.
export type QuoteCommodity = Exclude<Commodity, "non_definito">;
export type QuoteCustomerType = "RES" | "BUS";
export type LightConsumptionMode = "totale" | "fasce";
export type LightLossMode = "bassa" | "media_alta";

export type EnergyQuoteInput = {
  quoteDate: string;
  sourceId?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  commodity: QuoteCommodity;
  customerType: QuoteCustomerType;
  selectedOfferCode?: string;
  monthKey: string;
  secondMonthKey?: string;
  currentAveragePrice: number;
  currentSpend: number;
  currentPcv: number;
  lightConsumptionMode: LightConsumptionMode;
  lightLossMode: LightLossMode;
  consumptionMonth1: number;
  consumptionMonth2: number;
  f1Month1: number;
  f2Month1: number;
  f3Month1: number;
  f1Month2: number;
  f2Month2: number;
  f3Month2: number;
  gasAnnualConsumption: number;
};

export type QuoteOfferResult = {
  code: string;
  offerName: string;
  customerType: QuoteCustomerType;
  pcv: number;
  spread: number;
  quotaConsumi: number;
  annualDifference: number;
  annualSaving: number;
  agencyCommission: number;
  selected: boolean;
};

export type EnergyQuoteCalculation = {
  ready: boolean;
  warnings: string[];
  source: {
    currentAveragePrice: number;
    currentSpend: number;
    currentSpread: number;
    currentPcv: number;
    totalConsumption: number;
    averageMonthlyConsumption: number;
    annualConsumption: number;
    periodCount: number;
  };
  selectedOffer?: QuoteOfferResult;
  offers: QuoteOfferResult[];
};

const LIGHT_IMBALANCE = 0.0014;
const LIGHT_LOW_VOLTAGE_LOSS = 1.104;
const LIGHT_MEDIUM_HIGH_LOSS = 1.038;
const LIGHT_COMMISSION_BASE_SPREAD = 0.006;
const GAS_SYSTEM_OFFSET = 0.026;
const GAS_COMMISSION_BASE_SPREAD = 0.06;
const AGENCY_RATE = 0.3;

const GAS_QUOTE_OFFERS = [
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

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function marketValue(variables: MarketVariable[], key: string, monthKey: string, warnings: string[]) {
  const match = variables.find((variable) => variable.key === key && variable.monthKey === monthKey);

  if (!match) {
    warnings.push(`Manca ${key} per ${monthKey}.`);
    return 0;
  }

  return match.value;
}

function activeMonths(input: EnergyQuoteInput) {
  return [input.monthKey, input.secondMonthKey].filter((monthKey): monthKey is string => Boolean(monthKey));
}

function lightLossFactor(mode: LightLossMode) {
  return mode === "media_alta" ? LIGHT_MEDIUM_HIGH_LOSS : LIGHT_LOW_VOLTAGE_LOSS;
}

function lightMonthConsumption(input: EnergyQuoteInput, index: 0 | 1) {
  if (input.lightConsumptionMode === "fasce") {
    return index === 0
      ? {
          total: input.f1Month1 + input.f2Month1 + input.f3Month1,
          f1: input.f1Month1,
          f2: input.f2Month1,
          f3: input.f3Month1
        }
      : {
          total: input.f1Month2 + input.f2Month2 + input.f3Month2,
          f1: input.f1Month2,
          f2: input.f2Month2,
          f3: input.f3Month2
        };
  }

  const total = index === 0 ? input.consumptionMonth1 : input.consumptionMonth2;

  return {
    total,
    f1: 0,
    f2: 0,
    f3: 0
  };
}

function customerTypeRank(customerType: QuoteCustomerType) {
  return customerType === "RES" ? 0 : 1;
}

function uniqueOffers(commodity: QuoteCommodity) {
  const seen = new Set<string>();
  const sourceOffers = commodity === "gas" ? GAS_QUOTE_OFFERS : offerCatalog;

  return sourceOffers
    .filter((offer) => offer.commodity === commodity)
    .filter((offer) => {
      const key = `${offer.offerEasy}|${offer.pcv}|${offer.spread}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        customerTypeRank(a.customerType) - customerTypeRank(b.customerType) ||
        a.offerEasy.localeCompare(b.offerEasy, "it") ||
        a.spread - b.spread
    );
}

function selectedOffer(
  offers: OfferCatalogItem[],
  selectedOfferCode: string | undefined,
  preferredCustomerType: QuoteCustomerType
) {
  return (
    offers.find((offer) => offer.code === selectedOfferCode) ??
    offers.find((offer) => offer.customerType === preferredCustomerType) ??
    offers[0]
  );
}

function calculateLightQuote(input: EnergyQuoteInput, variables: MarketVariable[]) {
  const warnings: string[] = [];
  const lossFactor = lightLossFactor(input.lightLossMode);
  const months = activeMonths(input);
  const monthConsumptions = months.map((monthKey, index) => {
    const consumption = lightMonthConsumption(input, index as 0 | 1);

    if (
      input.lightConsumptionMode === "totale" &&
      index === 0 &&
      input.secondMonthKey &&
      input.consumptionMonth1 > 0 &&
      input.consumptionMonth2 <= 0
    ) {
      return {
        monthKey,
        consumption: {
          ...consumption,
          total: input.consumptionMonth1 / 2
        }
      };
    }

    if (
      input.lightConsumptionMode === "totale" &&
      index === 1 &&
      input.secondMonthKey &&
      input.consumptionMonth1 > 0 &&
      input.consumptionMonth2 <= 0
    ) {
      return {
        monthKey,
        consumption: {
          ...consumption,
          total: input.consumptionMonth1 / 2
        }
      };
    }

    return {
      monthKey,
      consumption
    };
  });
  const totalConsumption = monthConsumptions.reduce((sum, item) => sum + item.consumption.total, 0);
  const periodCount = monthConsumptions.filter((item) => item.consumption.total > 0).length || 1;
  const marketCost = monthConsumptions.reduce((sum, item) => {
    const capacity = marketValue(variables, "mercato_capacita", item.monthKey, warnings);
    const dispatching = marketValue(variables, "dispacciamento", item.monthKey, warnings);
    const punMono = marketValue(variables, "pun_mono", item.monthKey, warnings);
    const punF1 = marketValue(variables, "pun_f1", item.monthKey, warnings);
    const punF2 = marketValue(variables, "pun_f2", item.monthKey, warnings);
    const punF3 = marketValue(variables, "pun_f3", item.monthKey, warnings);
    const consumption = item.consumption;
    const punCost =
      input.lightConsumptionMode === "fasce"
        ? (consumption.f1 * punF1 + consumption.f2 * punF2 + consumption.f3 * punF3) * lossFactor
        : consumption.total * punMono;

    return (
      sum +
      punCost +
      consumption.total * capacity +
      consumption.total * lossFactor * dispatching +
      consumption.total * LIGHT_IMBALANCE
    );
  }, 0);
  const currentSpend =
    input.currentSpend > 0 ? input.currentSpend : input.currentAveragePrice * totalConsumption;
  const effectiveAveragePrice = totalConsumption > 0 ? currentSpend / totalConsumption : input.currentAveragePrice;
  const currentSpread =
    totalConsumption > 0 ? (currentSpend - marketCost) / (totalConsumption * lossFactor) : 0;
  const referenceMonthlyConsumption = monthConsumptions[0]?.consumption.total ?? 0;
  const annualConsumption = referenceMonthlyConsumption * 12;
  const offers = uniqueOffers("luce");
  const offerToSelect = selectedOffer(offers, input.selectedOfferCode, input.customerType);
  const currentAnnualCommercialCost = input.currentPcv * 12 + annualConsumption * currentSpread;
  const results = offers.map((offer) => {
    const annualCommercialCost = offer.pcv * 12 + annualConsumption * offer.spread;
    const annualDifference = annualCommercialCost - currentAnnualCommercialCost;
    const agencyCommission =
      offer.pcv * 12 * AGENCY_RATE +
      Math.max(0, offer.spread - LIGHT_COMMISSION_BASE_SPREAD) * annualConsumption * AGENCY_RATE;

    return {
      code: offer.code,
      offerName: offer.offerEasy,
      customerType: offer.customerType,
      pcv: offer.pcv,
      spread: offer.spread,
      quotaConsumi: marketCost + totalConsumption * lossFactor * offer.spread,
      annualDifference: round2(annualDifference),
      annualSaving: round2(-annualDifference),
      agencyCommission: round2(agencyCommission),
      selected: offer.code === offerToSelect?.code
    };
  });

  return {
    ready: totalConsumption > 0 && currentSpend > 0 && offers.length > 0 && warnings.length === 0,
    warnings,
    source: {
      currentAveragePrice: effectiveAveragePrice,
      currentSpend: round2(currentSpend),
      currentSpread,
      currentPcv: input.currentPcv,
      totalConsumption,
      averageMonthlyConsumption: referenceMonthlyConsumption,
      annualConsumption,
      periodCount
    },
    selectedOffer: results.find((offer) => offer.selected),
    offers: results
  };
}

function calculateGasQuote(input: EnergyQuoteInput, variables: MarketVariable[]) {
  const warnings: string[] = [];
  const hasAnnualConsumption = input.gasAnnualConsumption > 0;

  if (!hasAnnualConsumption) {
    warnings.push("Inserisci il consumo annuo gas. Se non lo conosci, usa 300 Smc.");
  }

  const months = activeMonths(input);
  const monthConsumptions = months
    .map((monthKey, index) => ({
      monthKey,
      consumption: index === 0 ? input.consumptionMonth1 : input.consumptionMonth2
    }))
    .filter((item) => item.consumption > 0);
  const totalConsumption = monthConsumptions.reduce((sum, item) => sum + item.consumption, 0);
  const periodCount = monthConsumptions.length || 1;
  const psvCost = monthConsumptions.reduce(
    (sum, item) => sum + item.consumption * marketValue(variables, "psv", item.monthKey, warnings),
    0
  );
  const currentSpend =
    input.currentSpend > 0 ? input.currentSpend : input.currentAveragePrice * totalConsumption;
  const effectiveAveragePrice = totalConsumption > 0 ? currentSpend / totalConsumption : input.currentAveragePrice;
  const weightedPsv = totalConsumption > 0 ? psvCost / totalConsumption : 0;
  const currentSpread = effectiveAveragePrice - weightedPsv - GAS_SYSTEM_OFFSET;
  const averageMonthlyConsumption = totalConsumption / periodCount;
  const annualConsumption = hasAnnualConsumption ? input.gasAnnualConsumption : 0;
  const offers = uniqueOffers("gas");
  const offerToSelect = selectedOffer(offers, input.selectedOfferCode, input.customerType);
  const results = offers.map((offer) => {
    const annualDifference =
      (offer.spread - currentSpread) * annualConsumption + (offer.pcv - input.currentPcv) * 12;
    const agencyCommission =
      offer.pcv * 12 * AGENCY_RATE +
      Math.max(0, offer.spread - GAS_COMMISSION_BASE_SPREAD) * annualConsumption * AGENCY_RATE;

    return {
      code: offer.code,
      offerName: offer.offerEasy,
      customerType: offer.customerType,
      pcv: offer.pcv,
      spread: offer.spread,
      quotaConsumi: psvCost + totalConsumption * offer.spread,
      annualDifference: round2(annualDifference),
      annualSaving: round2(-annualDifference),
      agencyCommission: round2(agencyCommission),
      selected: offer.code === offerToSelect?.code
    };
  });

  return {
    ready: totalConsumption > 0 && currentSpend > 0 && offers.length > 0 && warnings.length === 0,
    warnings,
    source: {
      currentAveragePrice: effectiveAveragePrice,
      currentSpend: round2(currentSpend),
      currentSpread,
      currentPcv: input.currentPcv,
      totalConsumption,
      averageMonthlyConsumption,
      annualConsumption,
      periodCount
    },
    selectedOffer: results.find((offer) => offer.selected),
    offers: results
  };
}

export function calculateEnergyQuote(
  input: EnergyQuoteInput,
  variables: MarketVariable[]
): EnergyQuoteCalculation {
  return input.commodity === "gas"
    ? calculateGasQuote(input, variables)
    : calculateLightQuote(input, variables);
}

export function defaultEnergyQuoteInput(input?: Partial<EnergyQuoteInput>): EnergyQuoteInput {
  return {
    quoteDate: input?.quoteDate ?? new Date().toISOString().slice(0, 10),
    sourceId: input?.sourceId,
    firstName: input?.firstName ?? "",
    lastName: input?.lastName ?? "",
    phone: input?.phone ?? "",
    commodity: input?.commodity ?? "luce",
    customerType: input?.customerType ?? "RES",
    selectedOfferCode: input?.selectedOfferCode,
    monthKey: input?.monthKey ?? "",
    secondMonthKey: input?.secondMonthKey ?? "",
    currentAveragePrice: safeNumber(input?.currentAveragePrice ?? 0),
    currentSpend: safeNumber(input?.currentSpend ?? 0),
    currentPcv: safeNumber(input?.currentPcv ?? 0),
    lightConsumptionMode: input?.lightConsumptionMode ?? "totale",
    lightLossMode: input?.lightLossMode ?? "bassa",
    consumptionMonth1: safeNumber(input?.consumptionMonth1 ?? 0),
    consumptionMonth2: safeNumber(input?.consumptionMonth2 ?? 0),
    f1Month1: safeNumber(input?.f1Month1 ?? 0),
    f2Month1: safeNumber(input?.f2Month1 ?? 0),
    f3Month1: safeNumber(input?.f3Month1 ?? 0),
    f1Month2: safeNumber(input?.f1Month2 ?? 0),
    f2Month2: safeNumber(input?.f2Month2 ?? 0),
    f3Month2: safeNumber(input?.f3Month2 ?? 0),
    gasAnnualConsumption: safeNumber(input?.gasAnnualConsumption ?? 0)
  };
}
