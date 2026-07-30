import type { AgencyMarginImportRow, AgencyMarginRecord } from "./types";

type AgencyMarginValueRow = Pick<
  AgencyMarginImportRow | AgencyMarginRecord,
  "grossMarginAmount" | "marginAmount" | "recurringConsumption" | "consumption" | "invoiceTotal" | "paid" | "balance"
>;

export function hasNegativeAgencyMarginValues(row: AgencyMarginValueRow) {
  const hasNegativeValue = [
    row.grossMarginAmount,
    row.marginAmount,
    row.recurringConsumption,
    row.consumption,
    row.balance
  ].some((value) => Number.isFinite(value) && value < 0);
  const hasUnpaidOrZeroInvoice = [row.invoiceTotal, row.paid].some(
    (value) => Number.isFinite(value) && value <= 0
  );

  return hasNegativeValue || hasUnpaidOrZeroInvoice;
}
