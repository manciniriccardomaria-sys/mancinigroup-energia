import { normalizePodPdr } from "./normalize";
import type { Customer, LoadingRecord } from "./types";

type PhoneRecord = Pick<LoadingRecord, "podPdr" | "phone" | "loadedAt" | "signedAt">;

// Match supply identifiers only. Names and shared contact details are not identifiers.
export function phoneForPod(podPdr: string, records: PhoneRecord[]): string | undefined {
  const pod = normalizePodPdr(podPdr);
  if (!pod) return undefined;
  const candidates = records.filter((record) => normalizePodPdr(record.podPdr) === pod && record.phone?.trim());
  const dateOf = (record: PhoneRecord) => record.loadedAt || record.signedAt || "";
  candidates.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  if (!candidates.length) return undefined;
  const latest = dateOf(candidates[0]);
  const phones = new Map<string, string>();
  for (const record of candidates.filter((candidate) => dateOf(candidate) === latest)) {
    const phone = record.phone!.trim();
    const key = phone.replace(/[^0-9+]/g, "");
    if (key) phones.set(key, phone);
  }
  return phones.size === 1 ? [...phones.values()][0] : undefined;
}

export function associateCustomerPhones(customers: Customer[], records: PhoneRecord[]) {
  for (const customer of customers) {
    if (customer.phone?.trim()) continue;
    const phone = phoneForPod(customer.podPdr, records);
    if (phone) customer.phone = phone;
  }
}
