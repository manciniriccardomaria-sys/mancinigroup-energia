import type { MarketSnapshot } from "./market-snapshot";

// Temporary, verified manual observation. This module is used only by the display panel.
// Delivery date 29/10; MGP-GAS session 28/10, product MGP-2026-10-29.
export const manualMarketSnapshot: MarketSnapshot = {
  version: 1,
  state: "awaiting_access",
  electricity: {
    referenceDate: "2026-10-29", sessionDate: "2026-10-28",
    fetchedAt: "2026-10-29T15:25:43Z", acquisition: "manual",
    originalEuroMwh: 278.47, value: 0.27847
  },
  gas: {
    referenceDate: "2026-10-29", sessionDate: "2026-10-28",
    fetchedAt: "2026-10-29T15:25:43Z", acquisition: "manual", product: "MGP-2026-10-29",
    originalEuroMwh: 105.578, value: 1.1296846
  }
};

export function marketSnapshotForDisplay(live?: MarketSnapshot): MarketSnapshot {
  const display: MarketSnapshot = { ...live, version: 1, state: live?.state ?? "awaiting_access" };
  for (const market of ["electricity", "gas"] as const) {
    const temporary = manualMarketSnapshot[market];
    const incoming = live?.[market];
    display[market] = incoming && (!temporary || incoming.referenceDate >= temporary.referenceDate) ? incoming : temporary;
  }
  return display;
}
