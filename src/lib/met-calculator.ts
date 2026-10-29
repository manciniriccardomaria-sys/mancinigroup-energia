import { lightLossesForOffer, type OfferCatalogItem } from "./offers";
import { metOfferCatalog } from "./met-offers";
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
  if (offer.met) {
    if (offer.commodity === "luce" && offer.met.priceBasis === "net") {
      return `PUN + ${price(offer.spread)} €/kWh, netti`;
    }
    return `${offer.commodity === "luce" ? "PUN con perdite" : "PSV"} + ${price(offer.spread)} ${offer.commodity === "luce" ? "€/kWh" : "€/Smc"}`;
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
  const variable = offer.pricingType === "variable";
  // Anche gli override salvati prima dell'introduzione della regola usano
  // il periodo di preventivazione del catalogo, conservando i propri prezzi.
  const fixedPeriodOnly = (metOfferCatalog.find(item => item.code === offer.code)?.met?.quotePeriod ?? terms.quotePeriod) === "fixed";
  const losses = lightLossesForOffer(offer);
  const issues: string[] = [];
  const notices = (terms.notes ?? [])
    .filter(note => !fixedPeriodOnly || note !== "Fase iniziale indicizzata per consumi prima del 01/01/2027.")
    .map(note => offer.commodity === "gas" ? note.replace(/MGP-GAS|M-GAS/g, "PSV") : note);
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
  if (variable && offer.commodity === "luce" && offer.customerType === "RES" && input.lightLossMode !== "bassa") {
    issues.push("L’offerta è riservata alle forniture domestiche in bassa tensione.");
  }
  // Calendar Fix è preventivabile anche sotto 200.000 kWh/anno,
  // comprese le offerte salvate con il precedente minimo CTE.
  const calendarFix = offer.code === "026846ENFFL46XX289CALENDFIXEEE24";
  if (!calendarFix && terms.minAnnualConsumption !== undefined && annualConsumption < terms.minAnnualConsumption) {
    issues.push(`Consumo annuo minimo: ${terms.minAnnualConsumption.toLocaleString("it-IT")} ${offer.commodity === "luce" ? "kWh" : "Smc"}.`);
  }
  // Il limite Business Power Fix è rimosso anche dagli override già salvati.
  const businessPowerFix = offer.code === "026846ENFFL46XX289BUSINESSEEFIXX" ||
    offer.code === "026846ENFFL46XX289BUSINESSEFIX24";
  if (!businessPowerFix && terms.maxAnnualConsumption !== undefined && annualConsumption > terms.maxAnnualConsumption) {
    issues.push(`Consumo annuo massimo: ${terms.maxAnnualConsumption.toLocaleString("it-IT")} ${offer.commodity === "luce" ? "kWh" : "Smc"}.`);
  }
  const pcs = input.gasPcs ?? 0.03852;
  if (offer.commodity === "gas" && (!Number.isFinite(pcs) || pcs <= 0)) issues.push("Inserisci un PCS gas positivo in GJ/Smc.");
  const pcsFactor = offer.commodity === "gas" ? pcs / (terms.gasPcsReference ?? 0.03852) : 1;
  const index = (key: string, monthKey: string) => {
    const match = variables.find(variable => variable.key === key && variable.monthKey === monthKey);
    if (!match || !Number.isFinite(match.value)) {
      const label = key === "psv" ? "PSV (€/Smc)" : key;
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
    const beforeFixed = !fixedPeriodOnly && Boolean(terms.fixedStartDate && date < terms.fixedStartDate);
    const renewal = !variable && !fixedPeriodOnly && afterFixed(date);
    let energy = 0;
    if (offer.commodity === "luce") {
      if (variable || beforeFixed || (renewal && !offer.fixedPrices) || terms.energyModel === "cer") {
        if (!variable && terms.renewalSpread === undefined) issues.push("Spread dopo il periodo fisso da confermare.");
        const spread = variable ? offer.spread * (losses.spread ? lossFactor : 1) : terms.renewalSpread ?? 0;
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
      // Le CTE MET business includono già lo sbilanciamento nel prezzo energia.
      // La componente AGF di 0,0014 €/kWh non va aggiunta una seconda volta.
      const imbalance = offer.customerType === "BUS" ? 0 : 0.0014;
      energy += q * (index("mercato_capacita", monthKey) * (losses.capacity ? lossFactor : 1) +
        index("dispacciamento", monthKey) * (losses.dispatching ? lossFactor : 1) + imbalance);
    } else {
      let gasPrice = offer.fixedPrice ?? 0;
      if (variable) {
        gasPrice = index("psv", monthKey) + offer.spread;
      } else if (beforeFixed || renewal) {
        const psv = index("psv", monthKey);
        if (renewal && terms.referenceIndex !== undefined) gasPrice += psv - terms.referenceIndex;
        else {
          if (terms.renewalSpread === undefined) issues.push("Spread gas dopo il periodo fisso da confermare.");
          gasPrice = psv + (terms.renewalSpread ?? 0);
        }
      }
      energy = q * (gasPrice + (terms.gasCsc ?? 0) + terms.commercialPerUnit) * pcsFactor;
    }
    if (offer.commodity === "luce") energy += q * terms.commercialPerUnit;
    if (terms.financialRate && (!terms.financialFrom || date >= terms.financialFrom)) {
      energy += q * terms.financialRate * index(offer.commodity === "luce" ? "pun_mono" : "psv", monthKey);
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
  if (fixedPeriodOnly) notices.push(`Preventivo riferito al prezzo fisso dei ${terms.fixedMonths} mesi; periodi indicizzati esclusi dalla stima.`);
  else if (terms.fixedStartDate && start < terms.fixedStartDate) notices.push(`Fase iniziale indicizzata; prezzo fisso dal ${terms.fixedStartDate}.`);
  notices.push("Stima annua con indici del periodo di bolletta mantenuti costanti.");
  if (offer.commodity === "gas") notices.push("Indice gas per la stima: PSV medio mensile inserito manualmente.");
  if (offer.commodity === "gas" && pcs === terms.gasPcsReference) notices.push("PCS impostato al riferimento CTE: verifica il valore della bolletta.");
  const priceLabel = !fixedPeriodOnly && terms.fixedStartDate && start < terms.fixedStartDate
    ? `${offer.commodity === "luce" ? "PUN con perdite" : "PSV"} + ${price(terms.renewalSpread ?? 0)}; fisso dal ${terms.fixedStartDate}`
    : offerPriceLabel(offer, lossFactor);
  return { quotaConsumi, annualConsumptionCost, priceLabel, issues: [...new Set(issues)], notices: [...new Set(notices)] };
}
