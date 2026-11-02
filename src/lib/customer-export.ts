import { utils, type WorkBook } from "xlsx";
import type { Customer, Source } from "./types";
import { customerStatusLabels, sourceKindLabels } from "./labels";
import { formatDateTime } from "./normalize";

type CustomerExportRow = {
  customer: Customer;
  source?: Source;
  lifeStatus: "attivo" | "uscito";
  entryInfo: { label: string; detail: string };
  fiscalId?: string;
  practiceStatus?: string;
  value: number;
};

export function createCustomersWorkbook(rows: CustomerExportRow[], personal: boolean): WorkBook {
  const header = [
    "Cliente", "POD/PDR", "Tipologia", "CF / P.IVA", "Fonte", "Tipo fonte", "Offerta",
    personal ? "Le tue provvigioni (€)" : "Valore cliente (€)",
    "Stato", "Stato gestionale", "Stato pratica", "Data entrata", "Origine data entrata", "Creato"
  ];
  const worksheet = utils.aoa_to_sheet([
    header,
    ...rows.map(({ customer, source, lifeStatus, entryInfo, fiscalId, practiceStatus, value }) => [
      customer.name, customer.podPdr,
      customer.commodity === "luce" ? "Luce" : customer.commodity === "gas" ? "Gas" : "Non definito",
      fiscalId ?? "", source?.name ?? "", source ? sourceKindLabels[source.kind] : "", customer.offer ?? "", value,
      lifeStatus === "attivo" ? "Attivo" : "Uscito", customerStatusLabels[customer.status],
      practiceStatus ?? "", entryInfo.label, entryInfo.detail, formatDateTime(customer.createdAt)
    ])
  ]);
  worksheet["!cols"] = [32, 22, 16, 22, 30, 18, 32, 24, 14, 20, 24, 18, 30, 24]
    .map((wch) => ({ wch }));
  worksheet["!autofilter"] = { ref: worksheet["!ref"]! };
  for (let index = 0; index < rows.length; index += 1) {
    worksheet[utils.encode_cell({ r: index + 1, c: 7 })].z = '#,##0.00 "€"';
  }
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Clienti");
  return workbook;
}
