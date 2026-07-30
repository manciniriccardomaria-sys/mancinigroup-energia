import type { AgencyMarginImportRow, AgencyMarginRecord } from "./types";

type AgencyMarginValueRow = Pick<
  AgencyMarginImportRow | AgencyMarginRecord,
  | "grossMarginAmount"
  | "marginAmount"
  | "recurringConsumption"
  | "consumption"
  | "invoiceTotal"
  | "invoiceTotalAvailable"
  | "paid"
  | "paidAvailable"
  | "balance"
>;

export function hasNegativeAgencyMarginValues(row: AgencyMarginValueRow) {
  const hasNegativeValue = [
    row.grossMarginAmount,
    row.marginAmount,
    row.recurringConsumption,
    row.consumption,
    row.balance
  ].some((value) => Number.isFinite(value) && value < 0);
  const hasUnpaidOrZeroInvoice = [
    { available: row.invoiceTotalAvailable, value: row.invoiceTotal },
    { available: row.paidAvailable, value: row.paid }
  ].some(
    ({ available, value }) => available === true && Number.isFinite(value) && value <= 0
  );

  return hasNegativeValue || hasUnpaidOrZeroInvoice;
}
