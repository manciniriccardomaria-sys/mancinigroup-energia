import type { AgencyMarginRecord, Source, StoreData } from "./types";

export type ProjectedCommission = {
  sourceId: string;
  monthKey: string;
  amount: number;
};

function isFullMonthKey(value?: string) {
  return /^\d{4}-\d{2}$/.test(value ?? "");
}

function monthRange(startMonthKey: string, endMonthKey: string) {
  if (!isFullMonthKey(startMonthKey) || !isFullMonthKey(endMonthKey) || startMonthKey > endMonthKey) return [];
  const [startYear, startMonth] = startMonthKey.split("-").map(Number);
  const [endYear, endMonth] = endMonthKey.split("-").map(Number);
  const months: string[] = [];
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(endYear, endMonth - 1, 1));

  while (cursor <= end) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export function addMonthsToForecastMonth(monthKey: string, months: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + months);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDistance(startMonthKey: string, currentMonthKey: string) {
  const [startYear, startMonth] = startMonthKey.split("-").map(Number);
  const [currentYear, currentMonth] = currentMonthKey.split("-").map(Number);
  return (currentYear - startYear) * 12 + (currentMonth - startMonth);
}

function isHomeOffer(offer?: string) {
  return (offer ?? "").toUpperCase().startsWith("HOME");
}

function isBusinessOffer(offer?: string) {
  const normalized = (offer ?? "").toUpperCase();
  return normalized.startsWith("BUSINESS") || normalized.includes("CONDOMINI STANDARD") || normalized.includes("COND. STANDARD");
}

function fixedHomeAmount(offer?: string) {
  const normalized = (offer ?? "").toUpperCase();
  if (normalized.includes("HOME FAMILY")) return 15;
  if (normalized.includes("HOME FIDELITY")) return 20;
  return 25;
}

function frontlineBusinessAmount(agencyAmount: number) {
  if (agencyAmount >= 30 && agencyAmount <= 150) return 25;
  if (agencyAmount > 150 && agencyAmount <= 500) return 30;
  if (agencyAmount > 500 && agencyAmount <= 1000) return 50;
  if (agencyAmount > 1000) return 100;
  return 0;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function simulateFutureCommissions(input: {
  records: AgencyMarginRecord[];
  customers: StoreData["customers"];
  sources: Source[];
  cutoffMonthKey: string;
  projectionEndMonthKey: string;
}) {
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const customerByPod = new Map(input.customers.map((customer) => [customer.podPdrNorm, customer]));
  const recordsByPod = new Map<string, AgencyMarginRecord[]>();

  for (const record of input.records) {
    if (!record.podPdrNorm || !isFullMonthKey(record.monthKey)) continue;
    const group = recordsByPod.get(record.podPdrNorm) ?? [];
    group.push(record);
    recordsByPod.set(record.podPdrNorm, group);
  }

  const latestImportedMonthKey = input.records.map((record) => record.monthKey).filter(isFullMonthKey).sort().at(-1);
  const activeThresholdMonthKey = latestImportedMonthKey ? addMonthsToForecastMonth(latestImportedMonthKey, -2) : "";
  const futureMonths = monthRange(addMonthsToForecastMonth(input.cutoffMonthKey, 1), input.projectionEndMonthKey);
  const projections: ProjectedCommission[] = [];

  for (const [podPdrNorm, records] of recordsByPod.entries()) {
    const sorted = records.slice().sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const firstMonthKey = sorted[0]?.monthKey;
    const lastRecord = sorted.at(-1);
    const lastMonthKey = lastRecord?.monthKey;
    const customer = customerByPod.get(podPdrNorm);
    const source = sourceById.get(customer?.sourceId ?? lastRecord?.matchedSourceId ?? "");
    const offer = lastRecord?.offerEasy ?? lastRecord?.offer ?? customer?.offer;

    if (!firstMonthKey || !lastMonthKey || !lastRecord || !source || source.kind === "sede") continue;

    const isStillActive = customer?.status !== "cessato" && (!activeThresholdMonthKey || lastMonthKey >= activeThresholdMonthKey);
    const firstFixedDueMonthKey = addMonthsToForecastMonth(firstMonthKey, 10);
    if (!isStillActive && monthDistance(firstMonthKey, lastMonthKey) < 10) continue;

    if (source.kind === "collaboratore" && isBusinessOffer(offer)) {
      if (!isStillActive) continue;
      const latestGenerated = sorted
        .filter((record) => record.commissionKind === "business_coll_monthly" && record.commissionAmount !== undefined)
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0];
      const amount = latestGenerated?.commissionAmount ?? roundCurrency(lastRecord.marginAmount * 0.5);
      if (amount > 0) futureMonths.forEach((monthKey) => projections.push({ sourceId: source.id, monthKey, amount }));
      continue;
    }

    if (!isHomeOffer(offer) && !(source.kind === "frontline" && isBusinessOffer(offer))) continue;
    if (!isStillActive && lastMonthKey < firstFixedDueMonthKey) continue;

    const amount = isHomeOffer(offer) ? fixedHomeAmount(offer) : frontlineBusinessAmount(lastRecord.marginAmount);
    if (amount <= 0) continue;

    const generatedFixedMonths = sorted
      .filter((record) => record.commissionStatus === "generata" && (record.commissionKind === "home_once" || record.commissionKind === "business_fl_once"))
      .map((record) => record.monthKey)
      .sort((a, b) => b.localeCompare(a));
    let nextDueMonthKey = generatedFixedMonths[0]
      ? addMonthsToForecastMonth(generatedFixedMonths[0], 12)
      : firstFixedDueMonthKey;

    while (nextDueMonthKey <= input.cutoffMonthKey) nextDueMonthKey = addMonthsToForecastMonth(nextDueMonthKey, 12);
    while (nextDueMonthKey <= input.projectionEndMonthKey) {
      if (isStillActive || nextDueMonthKey <= lastMonthKey) projections.push({ sourceId: source.id, monthKey: nextDueMonthKey, amount });
      nextDueMonthKey = addMonthsToForecastMonth(nextDueMonthKey, 12);
    }
  }

  return projections;
}
