import type { AgencyMarginImportRow, AgencyMarginRecord } from "./types";

type AgencyMarginValueRow = Pick<
  AgencyMarginImportRow | AgencyMarginRecord,
  | "invoiceTotal"
  | "invoiceTotalAvailable"
  | "paid"
  | "paidAvailable"
>;

export function hasNonPositiveAgencyMarginInvoice(row: AgencyMarginValueRow) {
  return [
    { available: row.invoiceTotalAvailable, value: row.invoiceTotal },
    { available: row.paidAvailable, value: row.paid }
  ].some(({ available, value }) => available === true && Number.isFinite(value) && value <= 0);
}
