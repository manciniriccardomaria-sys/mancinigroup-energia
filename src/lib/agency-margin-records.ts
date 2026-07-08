import type { AgencyMarginImportRow, AgencyMarginRecord } from "./types";

type AgencyMarginValueRow = Pick<
  AgencyMarginImportRow | AgencyMarginRecord,
  "grossMarginAmount" | "marginAmount" | "recurringConsumption" | "consumption" | "invoiceTotal" | "paid" | "balance"
>;

export function hasNegativeAgencyMarginValues(row: AgencyMarginValueRow) {
  return [
    row.grossMarginAmount,
    row.marginAmount,
    row.recurringConsumption,
    row.consumption,
    row.invoiceTotal,
    row.paid,
    row.balance
  ].some((value) => Number.isFinite(value) && value < 0);
}
