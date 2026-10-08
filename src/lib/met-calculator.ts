import { lightLossesForOffer, type OfferCatalogItem } from "./offers";
import type { EnergyQuoteInput } from "./quote-calculator";
import type { MarketVariable } from "./types";

export type MetConsumptionMonth = {
  monthKey: string;
  consumption: { total: number; f1?: number; f2?: number; f3?: number };
};

export function metCommission(offer: OfferCatalogItem, annualConsumption: number) {
  return offer.met?.commissionFixed === undefined ? undefined :
    offer.met.commissionFixed + (offer.met.commissionPerUnit ?? 0) * annualConsumption;
}

export function metMonthlyPcv(offer: OfferCatalogItem) {
  return offer.pcv + (offer.met?.monthlyServiceFee ?? 0);
}

function price(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 }).format(value);
}

export function offerPriceLabel(offer: OfferCatalogItem, lossFactor = 1.1) {
  const net = (value: number) => offer.met?.priceBasis === "gross" ? value / lossFactor : value;
  if (offer.met?.energyModel === "cer") {
    return `F1 ${price(net(offer.fixedPrice ?? 0))}; F2/F3 PUN + ${price((offer.met.renewalSpread ?? 0) / lossFactor)} €/kWh, netti`;
  }
  if (offer.fixedPrices) {
    return `F1 ${price(net(offer.fixedPrices.f1))} · F2 ${price(net(offer.fixedPrices.f2))} · F3 ${price(net(offer.fixedPrices.f3))} €/kWh netti`;
  }
  if (offer.pricingType === "fixed") {
    return `${price(net(offer.fixedPrice ?? 0))} ${offer.commodity === "luce" ? "€/kWh" : "€/Smc"}${offer.met && offer.commodity === "luce" ? " netto" : ""}`;
  }
  return `${price(offer.spread)} ${offer.commodity === "luce" ? "€/kWh" : "€/Smc"}`;
}

// Indici storici del periodo di bolletta mantenuti costanti nella proiezione.
// La decorrenza della nuova fornitura determina le fasi e i costi differiti.
export function calculateMetOffer(
  offer: OfferCatalogItem,
  input: EnergyQuoteInput,
  months: MetConsumptionMonth[],
  variables: MarketVariable[],
  lossFactor: number,
  annualConsumption: number
) {
  const terms = offer.met!;
  const losses = lightLossesForOffer(offer);
  const issues: string[] = [];
  const notices = [...(terms.notes ?? [])];
  const start = input.supplyStartDate || input.quoteDate;
  const total = months.reduce((sum, month) => sum + month.consumption.total, 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(new Date(`${start}T12:00:00Z`).getTime())) issues.push("Inserisci la decorrenza della nuova fornitura.");
  if (offer.requiresBands && (input.lightConsumptionMode !== "fasce" || input.lightBandsComplete === false)) {
    issues.push("Questa offerta richiede i consumi F1, F2 e F3 di ogni mese: inserisci anche gli eventuali zeri.");
  }
  if (offer.requiresBands && months.some(month => [month.consumption.f1, month.consumption.f2, month.consumption.f3].some(value => value === undefined || !Number.isFinite(value) || value < 0))) {
    issues.push("I consumi delle tre fasce devono essere numeri non negativi.");
  }
  if (terms.energyModel === "cer" && !input.cerMember) issues.push("Conferma l’adesione a una CER convenzionata per questa offerta.");
  if (terms.energyModel === "cer" && input.lightLossMode !== "bassa") issues.push("L’offerta CER è riservata alle forniture in bassa tensione.");
  if (terms.minAnnualConsumption !== undefined && annualConsumption < terms.minAnnualConsumption) {
    issues.push(`Consumo annuo minimo: ${terms.minAnnualConsumption.toLocaleString("it-IT")} ${offer.commodity === "luce" ? "kWh" : "Smc"}.`);
  }
  if (terms.maxAnnualConsumption !== undefined && annualConsumption > terms.maxAnnualConsumption) {
    issues.push(`Consumo annuo massimo: ${terms.maxAnnualConsumption.toLocaleString("it-IT")} ${offer.commodity === "luce" ? "kWh" : "Smc"}.`);
  }
  const pcs = input.gasPcs ?? 0.03852;
  if (offer.commodity === "gas" && (!Number.isFinite(pcs) || pcs <= 0)) issues.push("Inserisci un PCS gas positivo in GJ/Smc.");
  const pcsFactor = offer.commodity === "gas" ? pcs / (terms.gasPcsReference ?? 0.03852) : 1;
  const index = (key: string, monthKey: string) => {
    const match = variables.find(variable => variable.key === key && variable.monthKey === monthKey);
    if (!match || !Number.isFinite(match.value)) {
      const label = key === "mgp_gas" ? "MGP-GAS (€/Smc)" : key === "m_gas" ? "M-GAS (€/Smc)" : key;
      issues.push(`Manca ${label} per ${monthKey}.`);
      return 0;
    }
    return match.value;
  };
  const afterFixed = (date: string) => {
    const fixedStart = terms.fixedStartDate && start < terms.fixedStartDate ? terms.fixedStartDate : start;
    const end = new Date(`${fixedStart}T12:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + terms.fixedMonths);
    return Number.isFinite(end.getTime()) && date >= end.toISOString().slice(0, 10);
  };
  const fixedLossFactor = losses.fixedPrice ? lossFactor : 1;
  const netLightPrice = (value: number) => terms.priceBasis === "gross" ? value / fixedLossFactor : value;
  const sampledCost = (date: string) => months.reduce((sum, { monthKey, consumption }) => {
    const q = consumption.total;
    const beforeFixed = Boolean(terms.fixedStartDate && date < terms.fixedStartDate);
    const renewal = afterFixed(date);
    let energy = 0;
    if (offer.commodity === "luce") {
      if (beforeFixed || (renewal && !offer.fixedPrices) || terms.energyModel === "cer") {
        if (terms.renewalSpread === undefined) issues.push("Spread dopo il periodo fisso da confermare.");
        const spread = terms.renewalSpread ?? 0;
        const nonHourly = input.lightHourlyMeter === false ? terms.nonHourlySurcharge ?? 0 : 0;
        if (terms.energyModel === "cer" && !renewal) {
          energy = (consumption.f1 ?? 0) * netLightPrice(offer.fixedPrice ?? 0) * fixedLossFactor +
            (consumption.f2 ?? 0) * (index("pun_f2", monthKey) * lossFactor + spread + nonHourly) +
            (consumption.f3 ?? 0) * (index("pun_f3", monthKey) * lossFactor + spread + nonHourly);
        } else if (input.lightConsumptionMode === "fasce") {
          energy = ((consumption.f1 ?? 0) * index("pun_f1", monthKey) +
            (consumption.f2 ?? 0) * index("pun_f2", monthKey) +
            (consumption.f3 ?? 0) * index("pun_f3", monthKey)) * lossFactor + q * (spread + nonHourly);
        } else {
          energy = q * (index("pun_mono", monthKey) * lossFactor + spread + nonHourly);
        }
      } else if (offer.fixedPrices) {
        const delta = renewal ? index("pun_mono", monthKey) - (terms.referenceIndex ?? 0) : 0;
        energy = ((consumption.f1 ?? 0) * (netLightPrice(offer.fixedPrices.f1) + delta) +
          (consumption.f2 ?? 0) * (netLightPrice(offer.fixedPrices.f2) + delta) +
          (consumption.f3 ?? 0) * (netLightPrice(offer.fixedPrices.f3) + delta)) * fixedLossFactor;
      } else {
        energy = q * netLightPrice(offer.fixedPrice ?? 0) * fixedLossFactor;
      }
      // Mantiene capacità, dispacciamento e sbilanciamento del simulatore concordato.
      energy += q * (index("mercato_capacita", monthKey) * (losses.capacity ? lossFactor : 1) +
        index("dispacciamento", monthKey) * (losses.dispatching ? lossFactor : 1) + 0.0014);
    } else {
      let gasPrice = offer.fixedPrice ?? 0;
      if (beforeFixed || renewal) {
        const mGas = index("m_gas", monthKey);
        if (renewal && terms.referenceIndex !== undefined) gasPrice += mGas - terms.referenceIndex;
        else {
          if (terms.renewalSpread === undefined) issues.push("Spread gas dopo il periodo fisso da confermare.");
          gasPrice = mGas + (terms.renewalSpread ?? 0);
        }
      }
      energy = q * (gasPrice + (terms.gasCsc ?? 0) + terms.commercialPerUnit) * pcsFactor;
    }
    if (offer.commodity === "luce") energy += q * terms.commercialPerUnit;
    if (terms.financialRate && (!terms.financialFrom || date >= terms.financialFrom)) {
      energy += q * terms.financialRate * index(offer.commodity === "luce" ? "pun_mono" : "mgp_gas", monthKey);
    }
    return sum + energy;
  }, 0);
  const quotaConsumi = sampledCost(start);
  let annualConsumptionCost = 0;
  for (let i = 0; i < 12; i++) {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + i);
    if (Number.isFinite(date.getTime())) {
      annualConsumptionCost += sampledCost(date.toISOString().slice(0, 10)) / (total || 1) * annualConsumption / 12;
    }
  }
  if (terms.fixedStartDate && start < terms.fixedStartDate) notices.push(`Fase iniziale indicizzata; prezzo fisso dal ${terms.fixedStartDate}.`);
  notices.push("Stima annua con indici del periodo di bolletta mantenuti costanti e decorrenza indicata.");
  if (offer.commodity === "gas" && pcs === terms.gasPcsReference) notices.push("PCS impostato al riferimento CTE: verifica il valore della bolletta.");
  const priceLabel = terms.fixedStartDate && start < terms.fixedStartDate
    ? `${offer.commodity === "luce" ? "PUN con perdite" : "M-GAS"} + ${price(terms.renewalSpread ?? 0)}; fisso dal ${terms.fixedStartDate}`
    : offerPriceLabel(offer, lossFactor);
  return { quotaConsumi, annualConsumptionCost, priceLabel, issues: [...new Set(issues)], notices: [...new Set(notices)] };
}
