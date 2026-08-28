import type { Commodity } from "./types";

const monthKeyPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function consumptionMonthFromBillingMonth(billingMonth: string) {
  if (!monthKeyPattern.test(billingMonth)) {
    return undefined;
  }

  const [year, month] = billingMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatConsumptionMonth(monthKey: string) {
  if (!monthKeyPattern.test(monthKey)) {
    return monthKey;
  }

  const [year, month] = monthKey.split("-").map(Number);
  const label = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function agencyMarginHistoryFileName(
  originalName: string,
  commodity: Exclude<Commodity, "non_definito">,
  consumptionMonth: string
) {
  const extension = originalName.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";
  const commodityLabel = commodity === "luce" ? "Luce" : "Gas";
  return `${commodityLabel}_Mese Consumo ${formatConsumptionMonth(consumptionMonth)}${extension}`;
}
