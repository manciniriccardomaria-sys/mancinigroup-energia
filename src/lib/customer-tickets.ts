import type { Customer } from "./types";

export const ticketProblems = [
  "cessazione",
  "voltura",
  "subentro",
  "attivazione",
  "credito",
  "dilazione",
  "sollecito pagamento",
  "rid non andato a buon fine"
] as const;

export function ticketCustomerDefaults(customer: Customer) {
  const parts = customer.name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts.pop()! : "";
  return { firstName: parts.join(" "), lastName, podPdr: customer.podPdr, sourceId: customer.sourceId };
}
