import type { Commodity } from "./types";

export type MarketVariableDefinition = {
  key: string;
  label: string;
  commodity: Exclude<Commodity, "non_definito">;
  unit: string;
};

export const marketVariableDefinitions = [
  {
    key: "mercato_capacita",
    label: "Corrispettivo mercato capacita",
    commodity: "luce",
    unit: "€/kWh"
  },
  {
    key: "dispacciamento",
    label: "Dispacciamento",
    commodity: "luce",
    unit: "€/kWh"
  },
  {
    key: "pun_mono",
    label: "PUN mono orario",
    commodity: "luce",
    unit: "€/kWh"
  },
  {
    key: "pun_f1",
    label: "PUN F1",
    commodity: "luce",
    unit: "€/kWh"
  },
  {
    key: "pun_f2",
    label: "PUN F2",
    commodity: "luce",
    unit: "€/kWh"
  },
  {
    key: "pun_f3",
    label: "PUN F3",
    commodity: "luce",
    unit: "€/kWh"
  },
  {
    key: "psv",
    label: "PSV",
    commodity: "gas",
    unit: "€/Smc"
  }
] as const satisfies readonly MarketVariableDefinition[];

export type MarketVariableKey = (typeof marketVariableDefinitions)[number]["key"];

export const marketVariableSeedValues: Array<{
  key: MarketVariableKey;
  monthKey: string;
  value: number;
}> = [
  { key: "mercato_capacita", monthKey: "2026-01", value: 0.012345 },
  { key: "dispacciamento", monthKey: "2026-01", value: 0.010659 },
  { key: "pun_mono", monthKey: "2026-01", value: 0.13266 },
  { key: "pun_f1", monthKey: "2026-01", value: 0.151261 },
  { key: "pun_f2", monthKey: "2026-01", value: 0.137405 },
  { key: "pun_f3", monthKey: "2026-01", value: 0.118292 },
  { key: "mercato_capacita", monthKey: "2026-02", value: 0.008189 },
  { key: "dispacciamento", monthKey: "2026-02", value: 0.010659 },
  { key: "pun_mono", monthKey: "2026-02", value: 0.11441 },
  { key: "pun_f1", monthKey: "2026-02", value: 0.12228 },
  { key: "pun_f2", monthKey: "2026-02", value: 0.11984 },
  { key: "pun_f3", monthKey: "2026-02", value: 0.1053 },
  { key: "mercato_capacita", monthKey: "2026-03", value: 0.004349 },
  { key: "dispacciamento", monthKey: "2026-03", value: 0.010659 },
  { key: "pun_mono", monthKey: "2026-03", value: 0.1434 },
  { key: "pun_f1", monthKey: "2026-03", value: 0.14302 },
  { key: "pun_f2", monthKey: "2026-03", value: 0.15391 },
  { key: "pun_f3", monthKey: "2026-03", value: 0.13809 },
  { key: "mercato_capacita", monthKey: "2026-04", value: 0.003619 },
  { key: "dispacciamento", monthKey: "2026-04", value: 0.0105 },
  { key: "pun_mono", monthKey: "2026-04", value: 0.11947 },
  { key: "pun_f1", monthKey: "2026-04", value: 0.11114 },
  { key: "pun_f2", monthKey: "2026-04", value: 0.13826 },
  { key: "pun_f3", monthKey: "2026-04", value: 0.11663 },
  { key: "mercato_capacita", monthKey: "2026-05", value: 0.008189 },
  { key: "dispacciamento", monthKey: "2026-05", value: 0.0105 },
  { key: "pun_mono", monthKey: "2026-05", value: 0.11935 },
  { key: "pun_f1", monthKey: "2026-05", value: 0.10717 },
  { key: "pun_f2", monthKey: "2026-05", value: 0.13143 },
  { key: "pun_f3", monthKey: "2026-05", value: 0.12081 },
  { key: "mercato_capacita", monthKey: "2025-06", value: 0.007587 },
  { key: "dispacciamento", monthKey: "2025-06", value: 0.008948 },
  { key: "pun_mono", monthKey: "2025-06", value: 0.1178 },
  { key: "pun_f1", monthKey: "2025-06", value: 0.11306 },
  { key: "pun_f2", monthKey: "2025-06", value: 0.12676 },
  { key: "pun_f3", monthKey: "2025-06", value: 0.10363 },
  { key: "mercato_capacita", monthKey: "2025-07", value: 0.021655 },
  { key: "dispacciamento", monthKey: "2025-07", value: 0.0098 },
  { key: "pun_mono", monthKey: "2025-07", value: 0.11313 },
  { key: "pun_f1", monthKey: "2025-07", value: 0.10896 },
  { key: "pun_f2", monthKey: "2025-07", value: 0.1271 },
  { key: "pun_f3", monthKey: "2025-07", value: 0.10849 },
  { key: "mercato_capacita", monthKey: "2025-08", value: 0.0062 },
  { key: "dispacciamento", monthKey: "2025-08", value: 0.0098 },
  { key: "pun_mono", monthKey: "2025-08", value: 0.1087 },
  { key: "pun_f1", monthKey: "2025-08", value: 0.1055 },
  { key: "pun_f2", monthKey: "2025-08", value: 0.1179 },
  { key: "pun_f3", monthKey: "2025-08", value: 0.106 },
  { key: "mercato_capacita", monthKey: "2025-09", value: 0.003631 },
  { key: "dispacciamento", monthKey: "2025-09", value: 0.0098 },
  { key: "pun_mono", monthKey: "2025-09", value: 0.10908 },
  { key: "pun_f1", monthKey: "2025-09", value: 0.10959 },
  { key: "pun_f2", monthKey: "2025-09", value: 0.12093 },
  { key: "pun_f3", monthKey: "2025-09", value: 0.10188 },
  { key: "mercato_capacita", monthKey: "2025-10", value: 0.004275 },
  { key: "dispacciamento", monthKey: "2025-10", value: 0.0098 },
  { key: "pun_mono", monthKey: "2025-10", value: 0.11104 },
  { key: "pun_f1", monthKey: "2025-10", value: 0.11783 },
  { key: "pun_f2", monthKey: "2025-10", value: 0.12166 },
  { key: "pun_f3", monthKey: "2025-10", value: 0.09948 },
  { key: "mercato_capacita", monthKey: "2025-11", value: 0.004275 },
  { key: "dispacciamento", monthKey: "2025-11", value: 0.0098 },
  { key: "pun_mono", monthKey: "2025-11", value: 0.11709 },
  { key: "pun_f1", monthKey: "2025-11", value: 0.12066 },
  { key: "pun_f2", monthKey: "2025-11", value: 0.12448 },
  { key: "pun_f3", monthKey: "2025-11", value: 0.11001 },
  { key: "mercato_capacita", monthKey: "2025-12", value: 0.008189 },
  { key: "dispacciamento", monthKey: "2025-12", value: 0.0098 },
  { key: "pun_mono", monthKey: "2025-12", value: 0.11549 },
  { key: "pun_f1", monthKey: "2025-12", value: 0.13009 },
  { key: "pun_f2", monthKey: "2025-12", value: 0.11998 },
  { key: "pun_f3", monthKey: "2025-12", value: 0.10452 },
  { key: "psv", monthKey: "2026-01", value: 0.404227 },
  { key: "psv", monthKey: "2026-02", value: 0.377233 },
  { key: "psv", monthKey: "2026-03", value: 0.558338 },
  { key: "psv", monthKey: "2026-04", value: 0.493117 },
  { key: "psv", monthKey: "2026-05", value: 0.502398 },
  { key: "psv", monthKey: "2025-06", value: 0.39971 },
  { key: "psv", monthKey: "2025-07", value: 0.392803 },
  { key: "psv", monthKey: "2025-08", value: 0.3771 },
  { key: "psv", monthKey: "2025-09", value: 0.373593 },
  { key: "psv", monthKey: "2025-10", value: 0.353669 },
  { key: "psv", monthKey: "2025-11", value: 0.348704 },
  { key: "psv", monthKey: "2025-12", value: 0.32467 }
];

export function getMarketVariableDefinition(key: string) {
  return marketVariableDefinitions.find((definition) => definition.key === key);
}

export function isMarketVariableKey(key: string): key is MarketVariableKey {
  return Boolean(getMarketVariableDefinition(key));
}
