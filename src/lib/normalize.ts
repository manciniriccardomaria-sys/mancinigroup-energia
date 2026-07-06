import type { Commodity } from "./types";

export function normalizePodPdr(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  if (/^\d+$/.test(normalized)) {
    return normalized.replace(/^0+/, "") || "0";
  }

  return normalized;
}

export function detectCommodity(podPdr: string): Commodity {
  const normalized = normalizePodPdr(podPdr);

  if (normalized.startsWith("IT")) {
    return "luce";
  }

  if (/^\d{8,20}$/.test(normalized)) {
    return "gas";
  }

  return "non_definito";
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

export function parseEuro(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
