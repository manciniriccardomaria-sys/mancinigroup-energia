export function energyQuoteName(commodity: "luce" | "gas", firstName?: string, lastName?: string) {
  const parts = [firstName, lastName]
    .map(value => (value ?? "").trim().replace(/[^\p{L}\p{N}'’_-]+/gu, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, ""))
    .filter(Boolean);
  return `Preventivo_${commodity === "gas" ? "Gas" : "Luce"}_${parts.join("_") || "Cliente"}`;
}
