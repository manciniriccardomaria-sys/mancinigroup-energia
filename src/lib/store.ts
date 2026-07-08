import "server-only";

import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { hashPassword } from "./passwords";
import { hasNegativeAgencyMarginValues } from "./agency-margin-records";
import { getFirebaseDb, isFirebaseBackendEnabled } from "./firebase-admin";
import { getMarketVariableDefinition, marketVariableSeedValues } from "./market-variables";
import { detectCommodity, normalizePodPdr, slugify } from "./normalize";
import type {
  AgencyMarginImportResult,
  AgencyMarginImportRow,
  AgencyMarginRecord,
  CommissionEntry,
  CommissionPayment,
  CommissionRule,
  Commodity,
  Customer,
  EnergyQuote,
  LoadingImportResult,
  LoadingImportRow,
  LoadingRecord,
  MarketVariable,
  ProductionMetric,
  Source,
  SourceKind,
  StoreData,
  UploadedFileRecord,
  UploadCategory,
  User,
  UserRole
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const FIREBASE_STORE_COLLECTION = "appState";
const FIREBASE_STORE_DOCUMENT = "gestionaleEnergia";
const FIXED_COMMISSION_MATURITY_MONTHS = 10;

const seedSources: Array<{ name: string; kind: SourceKind }> = [
  { name: "Valeria", kind: "frontline" },
  { name: "Rossella", kind: "frontline" },
  { name: "Nicole", kind: "frontline" },
  { name: "Marina", kind: "frontline" },
  { name: "Isa", kind: "frontline" },
  { name: "Angela", kind: "frontline" },
  { name: "Maria", kind: "frontline" },
  { name: "Aldo", kind: "collaboratore" },
  { name: "Angelo", kind: "collaboratore" },
  { name: "Beppe", kind: "collaboratore" },
  { name: "Davide", kind: "collaboratore" },
  { name: "Federica", kind: "collaboratore" },
  { name: "Gaetano", kind: "collaboratore" },
  { name: "Ivana", kind: "collaboratore" },
  { name: "Luca", kind: "collaboratore" },
  { name: "Marco", kind: "collaboratore" },
  { name: "Maurizio", kind: "collaboratore" },
  { name: "Pasquale", kind: "collaboratore" },
  { name: "Riccardo", kind: "collaboratore" },
  { name: "Silvia", kind: "collaboratore" },
  { name: "MG Corso", kind: "sede" },
  { name: "MG Berlinguer", kind: "sede" },
  { name: "MG Terlizzi", kind: "sede" }
];

const seedCommissionTotals: Array<{ name: string; amount: number; paid: number }> = [
  { name: "Aldo", amount: 101.11, paid: 0 },
  { name: "Angela", amount: 120, paid: 60 },
  { name: "Davide", amount: 888.19, paid: 0 },
  { name: "Isa", amount: 30, paid: 0 },
  { name: "Marco", amount: 15, paid: 0 },
  { name: "Maria", amount: 105, paid: 0 },
  { name: "Marina", amount: 425, paid: 210 },
  { name: "Maurizio", amount: 75.56, paid: 0 },
  { name: "Nicole", amount: 170, paid: 140 },
  { name: "Pasquale", amount: 1635.99, paid: 0 },
  { name: "Riccardo", amount: 357.66, paid: 0 },
  { name: "Rossella", amount: 170, paid: 0 },
  { name: "Silvia", amount: 482.65, paid: 300 },
  { name: "Valeria", amount: 30, paid: 30 },
  { name: "Ivana", amount: 60, paid: 0 },
  { name: "Angelo", amount: 75.39, paid: 0 },
  { name: "Federica", amount: 0, paid: 0 }
];

const seedCommissionRules: Array<
  Omit<CommissionRule, "id" | "createdAt" | "createdBy">
> = [
  {
    name: "Residenziale Home Family",
    sourceKind: "tutte",
    customerType: "RES",
    offerName: "Home Family",
    calculationType: "fixed_amount",
    amount: 15,
    effectiveFrom: "2025-01-01",
    notes: "Gettone fisso dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi"
  },
  {
    name: "Residenziale Home Fidelity",
    sourceKind: "tutte",
    customerType: "RES",
    offerName: "Home Fidelity",
    calculationType: "fixed_amount",
    amount: 20,
    effectiveFrom: "2025-01-01",
    notes: "Gettone fisso dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi"
  },
  {
    name: "Business collaboratore",
    sourceKind: "collaboratore",
    customerType: "BUS",
    offerName: "Business",
    calculationType: "margin_percentage",
    amount: 0,
    percentage: 50,
    effectiveFrom: "2025-01-01",
    notes:
      "Business collaboratore: 50% della provvigione agenzia mensile, dal primo mese in Provvigioni agenzia"
  },
  {
    name: "Business frontline",
    sourceKind: "frontline",
    customerType: "BUS",
    offerName: "Business",
    calculationType: "fixed_amount",
    amount: 25,
    effectiveFrom: "2025-01-01",
    notes:
      "Business frontline: gettone dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi; 25/30/50/100 in base alla provvigione agenzia"
  },
  {
    name: "Home Basic",
    sourceKind: "tutte",
    customerType: "RES",
    offerName: "Home Basic",
    calculationType: "fixed_amount",
    amount: 25,
    effectiveFrom: "2025-01-01",
    notes: "Gettone fisso dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi"
  },
  {
    name: "Home Standard",
    sourceKind: "tutte",
    customerType: "RES",
    offerName: "Home Standard",
    calculationType: "fixed_amount",
    amount: 25,
    effectiveFrom: "2025-01-01",
    notes: "Gettone fisso dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi"
  },
  {
    name: "Home Family Plus",
    sourceKind: "tutte",
    customerType: "RES",
    offerName: "Home Family Plus",
    calculationType: "fixed_amount",
    amount: 15,
    effectiveFrom: "2025-01-01",
    notes: "Gettone fisso dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi; trattata come Home Family"
  },
  {
    name: "Condomini collaboratore",
    sourceKind: "collaboratore",
    customerType: "BUS",
    offerName: "Condomini Standard",
    calculationType: "margin_percentage",
    amount: 0,
    percentage: 50,
    effectiveFrom: "2025-01-01",
    notes:
      "Condomini collaboratore: 50% della provvigione agenzia mensile, dal primo mese in Provvigioni agenzia"
  },
  {
    name: "Condomini frontline",
    sourceKind: "frontline",
    customerType: "BUS",
    offerName: "Condomini Standard",
    calculationType: "fixed_amount",
    amount: 25,
    effectiveFrom: "2025-01-01",
    notes:
      "Condomini frontline: gettone dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi; 25/30/50/100 in base alla provvigione agenzia"
  }
];

const seedProductionMetrics: ProductionMetric[] = [
  { monthKey: "2025-03", luce: 5, gas: 1, total: 6, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2025-04", luce: 23, gas: 10, total: 33, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2025-05", luce: 54, gas: 25, total: 79, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2025-06", luce: 23, gas: 10, total: 33, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2025-07", luce: 23, gas: 13, total: 36, inValidation: 0, blocked: 2, exited: 0 },
  { monthKey: "2025-08", luce: 4, gas: 1, total: 5, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2025-09", luce: 16, gas: 3, total: 19, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2025-10", luce: 5, gas: 2, total: 7, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2025-11", luce: 11, gas: 4, total: 15, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2025-12", luce: 10, gas: 5, total: 15, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2026-01", luce: 13, gas: 7, total: 20, inValidation: 0, blocked: 0, exited: 0 },
  { monthKey: "2026-02", luce: 12, gas: 2, total: 14, inValidation: 1, blocked: 0, exited: 0 },
  { monthKey: "2026-03", luce: 6, gas: 0, total: 6, inValidation: 10, blocked: 0, exited: 0 },
  { monthKey: "2026-04", luce: 0, gas: 0, total: 0, inValidation: 1, blocked: 0, exited: 0 }
];

function sourceId(name: string) {
  return `src_${slugify(name)}`;
}

function marketVariableId(key: string, monthKey: string) {
  return `var_${slugify(`${key}-${monthKey}`)}`;
}

function legacyMarketSeedFixes() {
  return marketVariableSeedValues
    .filter((seed) => /^2026-0[1-5]$/.test(seed.monthKey))
    .map((seed) => ({
      ...seed,
      legacyMonthKey: seed.monthKey.replace("2026-", "2025-")
    }));
}

function isSameSeedValue(value: number, seedValue: number) {
  return Math.abs(value - seedValue) < 0.000000001;
}

function hasLegacyMarketSeedVariables(variables: MarketVariable[]) {
  return legacyMarketSeedFixes().some((fix) =>
    variables.some(
      (variable) =>
        variable.key === fix.key &&
        variable.monthKey === fix.legacyMonthKey &&
        isSameSeedValue(variable.value, fix.value)
    )
  );
}

function migrateLegacyMarketVariableYears(variables: MarketVariable[]) {
  for (const fix of legacyMarketSeedFixes()) {
    const legacyIndex = variables.findIndex(
      (variable) =>
        variable.key === fix.key &&
        variable.monthKey === fix.legacyMonthKey &&
        isSameSeedValue(variable.value, fix.value)
    );

    if (legacyIndex === -1) {
      continue;
    }

    const existingNew = variables.some(
      (variable) => variable.key === fix.key && variable.monthKey === fix.monthKey
    );

    if (existingNew) {
      variables.splice(legacyIndex, 1);
      continue;
    }

    variables[legacyIndex] = {
      ...variables[legacyIndex],
      id: marketVariableId(fix.key, fix.monthKey),
      monthKey: fix.monthKey
    };
  }
}

function createSource(name: string, kind: SourceKind, createdAt: string): Source {
  return {
    id: sourceId(name),
    name,
    kind,
    active: true,
    createdAt
  };
}

function createUser(
  email: string,
  name: string,
  role: UserRole,
  password: string,
  createdAt: string,
  sourceName?: string
): User {
  return {
    id: `usr_${slugify(email)}`,
    email,
    name,
    role,
    sourceId: sourceName ? sourceId(sourceName) : undefined,
    passwordHash: hashPassword(password),
    createdAt
  };
}

function sourceRole(kind: SourceKind): CommissionEntry["role"] {
  if (kind === "frontline") {
    return "FL";
  }

  if (kind === "sede") {
    return "SEDE";
  }

  return "COLL";
}

function addMonthsToMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeyFromDate(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : undefined;
}

function monthDistance(startMonthKey: string, currentMonthKey: string) {
  const [startYear, startMonth] = startMonthKey.split("-").map(Number);
  const [currentYear, currentMonth] = currentMonthKey.split("-").map(Number);
  return (currentYear - startYear) * 12 + (currentMonth - startMonth);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function splitCustomerName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      customerName: value.trim(),
      customerSurname: undefined
    };
  }

  const customerSurname = parts.pop();

  return {
    customerName: parts.join(" "),
    customerSurname
  };
}

function isBusinessOffer(offerEasy?: string) {
  const normalized = offerEasy?.toUpperCase() ?? "";
  return (
    normalized.startsWith("BUSINESS") ||
    normalized.includes("CONDOMINI STANDARD") ||
    normalized.includes("COND. STANDARD")
  );
}

function isHomeOffer(offerEasy?: string) {
  return (offerEasy?.toUpperCase() ?? "").startsWith("HOME");
}

function homeCommissionAmount(offerEasy?: string) {
  const normalized = offerEasy?.toUpperCase() ?? "";

  if (normalized.includes("HOME FAMILY")) {
    return 15;
  }

  if (normalized.includes("HOME FIDELITY")) {
    return 20;
  }

  return 25;
}

function frontlineBusinessCommissionAmount(agencyAmount: number) {
  if (agencyAmount >= 0 && agencyAmount <= 150) {
    return 25;
  }

  if (agencyAmount > 150 && agencyAmount <= 500) {
    return 30;
  }

  if (agencyAmount > 500 && agencyAmount <= 1000) {
    return 50;
  }

  if (agencyAmount > 1000) {
    return 100;
  }

  return 0;
}

function isWithinTwelveMonths(previousMonthKey: string, currentMonthKey: string) {
  const delta = monthDistance(previousMonthKey, currentMonthKey);
  return delta >= 0 && delta < 12;
}

function firstPresenceMonthForPod(input: {
  podPdrNorm: string;
  currentMonthKey: string;
  agencyRecords: AgencyMarginRecord[];
  loadingRecords: LoadingRecord[];
  customer?: Customer;
}) {
  const monthKeys = [input.currentMonthKey];

  for (const record of input.agencyRecords) {
    if (record.podPdrNorm === input.podPdrNorm) {
      monthKeys.push(record.monthKey);
    }
  }

  for (const record of input.loadingRecords) {
    if (record.podPdrNorm !== input.podPdrNorm) {
      continue;
    }

    const monthKey =
      monthKeyFromDate(record.signedAt) ??
      monthKeyFromDate(record.loadedAt) ??
      monthKeyFromDate(record.importedAt);

    if (monthKey) {
      monthKeys.push(monthKey);
    }
  }

  const customerMonthKey = monthKeyFromDate(input.customer?.createdAt);
  if (customerMonthKey) {
    monthKeys.push(customerMonthKey);
  }

  return monthKeys.sort()[0] ?? input.currentMonthKey;
}

function hasFixedCommissionInLastTwelveMonths(input: {
  records: AgencyMarginRecord[];
  record: AgencyMarginRecord;
  ownRecordId?: string;
}) {
  return input.records.some((record) => {
    if (record.id === input.ownRecordId) {
      return false;
    }

    const isFixedCommission =
      record.commissionKind === "home_once" ||
      record.commissionKind === "business_fl_once" ||
      (!record.commissionKind &&
        (isHomeOffer(record.offerEasy) ||
          (isBusinessOffer(record.offerEasy) &&
            record.commissionAmount !== roundCurrency(record.marginAmount * 0.5))));
    const sameFixedFamily =
      (isHomeOffer(input.record.offerEasy) && isHomeOffer(record.offerEasy)) ||
      (isBusinessOffer(input.record.offerEasy) && isBusinessOffer(record.offerEasy));

    return (
      record.podPdrNorm === input.record.podPdrNorm &&
      record.commissionStatus === "generata" &&
      record.commissionAmount !== undefined &&
      isFixedCommission &&
      isWithinTwelveMonths(record.monthKey, input.record.monthKey) &&
      sameFixedFamily
    );
  });
}

function commissionAmountFromAppsScriptRules(input: {
  record: AgencyMarginRecord;
  sourceKind: SourceKind;
  allRecords: AgencyMarginRecord[];
  firstPresenceMonthKey: string;
  ownRecordId?: string;
}) {
  const role = input.sourceKind === "frontline" ? "FL" : input.sourceKind === "collaboratore" ? "COLL" : "";

  if (!role) {
    return {
      status: "regola_mancante" as const
    };
  }

  const isHome = isHomeOffer(input.record.offerEasy);
  const isBusiness = isBusinessOffer(input.record.offerEasy);

  if (isBusiness && role === "COLL") {
    return {
      status: "generata" as const,
      kind: "business_coll_monthly" as const,
      amount: roundCurrency(input.record.marginAmount * 0.5)
    };
  }

  if (isHome || (isBusiness && role === "FL")) {
    const monthsFromFirstPresence = monthDistance(
      input.firstPresenceMonthKey,
      input.record.monthKey
    );

    if (monthsFromFirstPresence < FIXED_COMMISSION_MATURITY_MONTHS) {
      return {
        status: "in_maturazione" as const
      };
    }

    const alreadyPaid = hasFixedCommissionInLastTwelveMonths({
      records: input.allRecords,
      record: input.record,
      ownRecordId: input.ownRecordId
    });

    if (alreadyPaid) {
      return {
        status: "anticipata" as const
      };
    }

    if (isHome) {
      return {
        status: "generata" as const,
        kind: "home_once" as const,
        amount: homeCommissionAmount(input.record.offerEasy)
      };
    }

    return {
      status: "generata" as const,
      kind: "business_fl_once" as const,
      amount: frontlineBusinessCommissionAmount(input.record.marginAmount)
    };
  }

  return {
    status: "regola_mancante" as const
  };
}

function refreshLoadingMatches(
  records: LoadingRecord[],
  podPdrNorm: string,
  customerId: string,
  sourceIdValue: string,
  matchedAt: string
) {
  for (const record of records) {
    if (record.podPdrNorm !== podPdrNorm) {
      continue;
    }

    record.matchedCustomerId = customerId;
    record.matchedSourceId = sourceIdValue;
    record.matchedAt = matchedAt;
  }
}

function refreshAgencyMarginMatches(
  records: AgencyMarginRecord[],
  podPdrNorm: string,
  customerId: string,
  sourceIdValue: string,
  matchedAt: string
) {
  for (const record of records) {
    if (record.podPdrNorm !== podPdrNorm) {
      continue;
    }

    record.matchedCustomerId = customerId;
    record.matchedSourceId = sourceIdValue;
    record.matchedAt = matchedAt;
  }
}

function seedCommissionEntries(sources: Source[], createdAt: string): CommissionEntry[] {
  return seedCommissionTotals
    .filter((item) => item.amount > 0)
    .map((item) => {
      const source = sources.find((candidate) => candidate.id === sourceId(item.name));

      return {
        id: `com_seed_${slugify(item.name)}_2026`,
        sourceId: source?.id ?? sourceId(item.name),
        role: sourceRole(source?.kind ?? "collaboratore"),
        dueMonth: "2026",
        amount: item.amount,
        importedFrom: "Elaboratore Provvigioni 2026",
        createdAt
      };
    });
}

function seedCommissionPayments(createdBy: string, createdAt: string): CommissionPayment[] {
  return seedCommissionTotals
    .filter((item) => item.paid > 0)
    .map((item) => ({
      id: `pay_seed_${slugify(item.name)}_2026`,
      sourceId: sourceId(item.name),
      amount: item.paid,
      paidAt: "2026-07-02",
      period: "2026",
      notes: "Importato dal riepilogo pagate del foglio 2026",
      createdAt,
      createdBy
    }));
}

function seedRules(createdBy: string, createdAt: string): CommissionRule[] {
  return seedCommissionRules.map((rule) => ({
    ...rule,
    id: `rule_seed_${slugify(rule.name)}_${rule.effectiveFrom}`,
    createdAt,
    createdBy
  }));
}

function seedMarketVariables(updatedBy: string, createdAt: string): MarketVariable[] {
  return marketVariableSeedValues.map((seed) => {
    const definition = getMarketVariableDefinition(seed.key);

    return {
      id: marketVariableId(seed.key, seed.monthKey),
      key: seed.key,
      label: definition?.label ?? seed.key,
      commodity: definition?.commodity ?? "luce",
      monthKey: seed.monthKey,
      value: seed.value,
      unit: definition?.unit ?? "",
      createdAt,
      updatedAt: createdAt,
      updatedBy
    };
  });
}

async function defaultStore(): Promise<StoreData> {
  const now = new Date().toISOString();
  const sources = seedSources.map((source) => createSource(source.name, source.kind, now));
  const adminUser = createUser(
    "manciniriccardomaria@gmail.com",
    "Riccardo Mancini",
    "admin",
    "change-in-firebase-auth",
    now
  );

  return {
    sources,
    customers: [],
    commissionEntries: seedCommissionEntries(sources, now),
    commissionPayments: seedCommissionPayments(adminUser.id, now),
    commissionRules: seedRules(adminUser.id, now),
    productionMetrics: seedProductionMetrics,
    marketVariables: seedMarketVariables(adminUser.id, now),
    energyQuotes: [],
    uploadedFiles: [],
    loadingRecords: [],
    agencyMarginRecords: [],
    users: [
      adminUser,
      createUser("valeria@mancinigroup.org", "Valeria", "frontline", "change-in-firebase-auth", now, "Valeria"),
      createUser("riccardo@mancinigroup.org", "Riccardo", "agent", "change-in-firebase-auth", now, "Riccardo")
    ]
  };
}

function needsMigration(data: Partial<StoreData>) {
  return (
    !Array.isArray(data.sources) ||
    !Array.isArray(data.customers) ||
    !Array.isArray(data.users) ||
    !Array.isArray(data.uploadedFiles) ||
    !Array.isArray(data.commissionEntries) ||
    !Array.isArray(data.commissionPayments) ||
    !Array.isArray(data.commissionRules) ||
    !Array.isArray(data.productionMetrics) ||
    !Array.isArray(data.marketVariables) ||
    !Array.isArray(data.energyQuotes) ||
    (Array.isArray(data.marketVariables) && hasLegacyMarketSeedVariables(data.marketVariables)) ||
    marketVariableSeedValues.some(
      (seed) =>
        !data.marketVariables?.some(
          (variable) => variable.key === seed.key && variable.monthKey === seed.monthKey
        )
    ) ||
    !Array.isArray(data.loadingRecords) ||
    !Array.isArray(data.agencyMarginRecords)
  );
}

function migrateStore(data: Partial<StoreData>): StoreData {
  const base = data as StoreData;
  const now = new Date().toISOString();
  const adminId =
    base.users?.find((user) => user.role === "admin")?.id ?? "usr_admin-mancinigroup-org";

  base.sources ??= seedSources.map((source) => createSource(source.name, source.kind, now));
  base.customers ??= [];
  base.users ??= [];
  base.uploadedFiles ??= [];
  base.commissionEntries ??= seedCommissionEntries(base.sources, now);
  base.commissionPayments ??= seedCommissionPayments(adminId, now);
  base.commissionRules ??= seedRules(adminId, now);
  base.productionMetrics ??= seedProductionMetrics;
  base.marketVariables ??= [];
  base.energyQuotes ??= [];
  base.loadingRecords ??= [];
  base.agencyMarginRecords ??= [];
  migrateLegacyMarketVariableYears(base.marketVariables);

  for (const record of base.agencyMarginRecords) {
    if (!record.grossMarginAmount) {
      record.grossMarginAmount = record.marginAmount;
      record.agencyShareRate = 0.6;
      record.marginAmount = roundCurrency(record.grossMarginAmount * record.agencyShareRate);
    }

    record.agencyShareRate ??= 0.6;
  }

  for (const rule of base.commissionRules) {
    rule.calculationType ??= "fixed_amount";

    if (rule.name === "Business Fidelity" && rule.amount === 7.9) {
      rule.name = "Business collaboratore";
      rule.sourceKind = "collaboratore";
      rule.offerName = "Business";
      rule.calculationType = "margin_percentage";
      rule.amount = 0;
      rule.percentage = 50;
      rule.maxAmount = undefined;
      rule.notes =
        "Business collaboratore: 50% della provvigione agenzia mensile, ogni mese";
    }

    if (
      [
        "Residenziale Home Family",
        "Residenziale Home Fidelity",
        "Home Basic",
        "Home Standard",
        "Home Family Plus"
      ].includes(rule.name)
    ) {
      rule.notes = "Gettone fisso dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi";
    }

    if (rule.name === "Business frontline" || rule.name === "Condomini frontline") {
      rule.notes =
        "Gettone dopo 10 mesi di presenza, poi ricorrente ogni 12 mesi; scaglioni 25/30/50/100 in base alla provvigione agenzia";
    }

    if (rule.name === "Business collaboratore" || rule.name === "Condomini collaboratore") {
      rule.notes =
        "50% della provvigione agenzia mensile, dal primo mese in Provvigioni agenzia";
    }

    if (rule.name === "Business collaboratore" || rule.name === "Condomini collaboratore") {
      rule.percentage = 50;
      rule.maxAmount = undefined;
    }
  }

  for (const seed of seedRules(adminId, now)) {
    const exists = base.commissionRules.some(
      (rule) => rule.name === seed.name && rule.effectiveFrom === seed.effectiveFrom
    );

    if (!exists) {
      base.commissionRules.push(seed);
    }
  }

  const existingMarketVariables = new Set(
    base.marketVariables.map((variable) => `${variable.key}|${variable.monthKey}`)
  );

  for (const seed of seedMarketVariables(adminId, now)) {
    const fingerprint = `${seed.key}|${seed.monthKey}`;

    if (!existingMarketVariables.has(fingerprint)) {
      base.marketVariables.push(seed);
      existingMarketVariables.add(fingerprint);
    }
  }

  base.marketVariables.sort(
    (a, b) =>
      b.monthKey.localeCompare(a.monthKey) ||
      a.commodity.localeCompare(b.commodity) ||
      a.label.localeCompare(b.label, "it")
  );

  return base;
}

async function ensureStoreFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_PATH, "utf8");
  } catch {
    await writeStore(await defaultStore());
  }
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function readFirebaseStore(): Promise<StoreData> {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase backend non attivo.");
  }

  const ref = db.collection(FIREBASE_STORE_COLLECTION).doc(FIREBASE_STORE_DOCUMENT);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    const initial = await defaultStore();
    await ref.set(stripUndefined(initial));
    return initial;
  }

  const parsed = snapshot.data() as Partial<StoreData>;
  const shouldPersist = needsMigration(parsed);
  const store = migrateStore(parsed);

  if (shouldPersist) {
    await ref.set(stripUndefined(store));
  }

  return store;
}

async function writeFirebaseStore(data: StoreData) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase backend non attivo.");
  }

  await db
    .collection(FIREBASE_STORE_COLLECTION)
    .doc(FIREBASE_STORE_DOCUMENT)
    .set(stripUndefined(data));
}

export async function readStore(): Promise<StoreData> {
  if (isFirebaseBackendEnabled()) {
    return readFirebaseStore();
  }

  await ensureStoreFile();
  const raw = await readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoreData>;
  const shouldPersist = needsMigration(parsed);
  const store = migrateStore(parsed);

  if (shouldPersist) {
    await writeStore(store);
  }

  return store;
}

export async function writeStore(data: StoreData) {
  if (isFirebaseBackendEnabled()) {
    await writeFirebaseStore(data);
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  const tempPath = `${STORE_PATH}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, STORE_PATH);
}

export async function findUserByEmail(email: string) {
  const store = await readStore();
  return store.users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase()) ?? null;
}

export async function findUserById(id: string) {
  const store = await readStore();
  return store.users.find((user) => user.id === id) ?? null;
}

export async function addUser(input: {
  email: string;
  name: string;
  role: UserRole;
  password: string;
  sourceId?: string;
}) {
  const store = await readStore();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password.trim();

  if (!email || !email.includes("@")) {
    throw new Error("Inserisci una email valida.");
  }

  if (!name) {
    throw new Error("Inserisci il nome utente.");
  }

  if (password.length < 8) {
    throw new Error("La password deve avere almeno 8 caratteri.");
  }

  const duplicate = store.users.some((user) => user.email.toLowerCase() === email);
  if (duplicate) {
    throw new Error("Esiste gia un utente con questa email.");
  }

  const source =
    input.sourceId && input.role !== "admin" && input.role !== "operativo"
      ? store.sources.find((item) => item.id === input.sourceId && item.active)
      : undefined;

  if (input.role !== "admin" && input.role !== "operativo" && !source) {
    throw new Error("Collega l'utente a una fonte attiva.");
  }

  const user = createUser(email, name, input.role, password, new Date().toISOString());
  user.sourceId = source?.id;

  store.users.push(user);
  await writeStore(store);
  return user;
}

export async function addSource(input: { name: string; kind: SourceKind }) {
  const store = await readStore();
  const name = input.name.trim();
  const exists = store.sources.some((source) => source.name.toLowerCase() === name.toLowerCase());

  if (exists) {
    throw new Error("Fonte gia presente.");
  }

  store.sources.push(createSource(name, input.kind, new Date().toISOString()));
  await writeStore(store);
}

export async function setSourceActive(sourceIdValue: string, active: boolean) {
  const store = await readStore();
  const source = store.sources.find((item) => item.id === sourceIdValue);

  if (!source) {
    throw new Error("Fonte non trovata.");
  }

  source.active = active;
  await writeStore(store);
}

export async function addCustomer(input: {
  podPdr: string;
  name: string;
  sourceId: string;
  offer?: string;
  notes?: string;
  createdBy: string;
}) {
  const store = await readStore();
  const podPdr = input.podPdr.trim();
  const podPdrNorm = normalizePodPdr(podPdr);
  const customerName = input.name.trim();

  if (!podPdrNorm) {
    throw new Error("Inserisci un POD/PDR valido.");
  }

  if (!customerName) {
    throw new Error("Inserisci il nome cliente.");
  }

  const source = store.sources.find((item) => item.id === input.sourceId && item.active);
  if (!source) {
    throw new Error("Seleziona una fonte attiva.");
  }

  const duplicate = store.customers.some((customer) => customer.podPdrNorm === podPdrNorm);
  if (duplicate) {
    throw new Error("Questo POD/PDR e gia stato inserito.");
  }

  const customer: Customer = {
    id: `cli_${randomUUID()}`,
    podPdr,
    podPdrNorm,
    name: customerName,
    sourceId: source.id,
    commodity: detectCommodity(podPdr),
    status: "attivo",
    offer: input.offer?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy
  };

  store.customers.unshift(customer);
  refreshLoadingMatches(store.loadingRecords, podPdrNorm, customer.id, source.id, customer.createdAt);
  refreshAgencyMarginMatches(
    store.agencyMarginRecords,
    podPdrNorm,
    customer.id,
    source.id,
    customer.createdAt
  );
  await writeStore(store);
}

export async function reassignCustomer(customerId: string, sourceIdValue: string) {
  const store = await readStore();
  const customer = store.customers.find((item) => item.id === customerId);
  const source = store.sources.find((item) => item.id === sourceIdValue && item.active);

  if (!customer) {
    throw new Error("Cliente non trovato.");
  }

  if (!source) {
    throw new Error("Fonte non trovata.");
  }

  customer.sourceId = source.id;
  refreshLoadingMatches(store.loadingRecords, customer.podPdrNorm, customer.id, source.id, new Date().toISOString());
  refreshAgencyMarginMatches(
    store.agencyMarginRecords,
    customer.podPdrNorm,
    customer.id,
    source.id,
    new Date().toISOString()
  );
  await writeStore(store);
}

export async function setCustomerStatus(customerId: string, status: Customer["status"]) {
  const store = await readStore();
  const customer = store.customers.find((item) => item.id === customerId);

  if (!customer) {
    throw new Error("Cliente non trovato.");
  }

  customer.status = status;
  await writeStore(store);
}

export async function addUploadedFile(input: {
  originalName: string;
  storedName: string;
  storageMode?: UploadedFileRecord["storageMode"];
  category: UploadCategory;
  referenceMonth?: string;
  commodity?: Commodity;
  mimeType: string;
  size: number;
  uploadedBy: string;
}): Promise<UploadedFileRecord> {
  const store = await readStore();
  const record: UploadedFileRecord = {
    id: `upl_${randomUUID()}`,
    originalName: input.originalName,
    storedName: input.storedName,
    storageMode: input.storageMode,
    category: input.category,
    referenceMonth: input.referenceMonth,
    commodity: input.commodity,
    mimeType: input.mimeType,
    size: input.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy
  };

  store.uploadedFiles.unshift(record);
  await writeStore(store);
  return record;
}

export async function importLoadingRecords(input: {
  uploadedFileId: string;
  rows: LoadingImportRow[];
  totalRows: number;
  skippedRows: number;
}): Promise<LoadingImportResult> {
  const store = await readStore();
  const now = new Date().toISOString();
  const customerByPod = new Map(store.customers.map((customer) => [customer.podPdrNorm, customer]));
  const existingByKey = new Map(store.loadingRecords.map((record) => [record.importKey, record]));
  const nextRecords = [...store.loadingRecords];
  let importedRows = 0;
  let updatedRows = 0;
  let matchedRows = 0;

  for (const row of input.rows) {
    const customer = customerByPod.get(row.podPdrNorm);
    const existing = existingByKey.get(row.importKey);
    const record: LoadingRecord = {
      ...row,
      id: existing?.id ?? `car_${randomUUID()}`,
      uploadedFileId: input.uploadedFileId,
      matchedCustomerId: customer?.id,
      matchedSourceId: customer?.sourceId,
      matchedAt: customer ? now : undefined,
      importedAt: existing?.importedAt ?? now
    };

    if (customer) {
      matchedRows += 1;
    }

    if (existing) {
      const index = nextRecords.findIndex((item) => item.id === existing.id);
      if (index >= 0) {
        nextRecords[index] = record;
      }
      updatedRows += 1;
    } else {
      nextRecords.unshift(record);
      importedRows += 1;
    }
  }

  store.loadingRecords = nextRecords.sort((a, b) => {
    const aDate = a.signedAt || a.loadedAt || a.importedAt;
    const bDate = b.signedAt || b.loadedAt || b.importedAt;
    return bDate.localeCompare(aDate);
  });

  await writeStore(store);

  return {
    totalRows: input.totalRows,
    importedRows,
    updatedRows,
    skippedRows: input.skippedRows,
    matchedRows,
    unmatchedRows: input.rows.length - matchedRows
  };
}

export async function importAgencyMarginRecords(input: {
  uploadedFileId: string;
  rows: AgencyMarginImportRow[];
  totalRows: number;
  skippedRows: number;
}): Promise<AgencyMarginImportResult> {
  const store = await readStore();
  const now = new Date().toISOString();
  const uploadedFile = store.uploadedFiles.find((file) => file.id === input.uploadedFileId);
  const customerByPod = new Map(store.customers.map((customer) => [customer.podPdrNorm, customer]));
  const sourceById = new Map(store.sources.map((source) => [source.id, source]));
  const existingByKey = new Map(store.agencyMarginRecords.map((record) => [record.importKey, record]));
  const nextRecords = [...store.agencyMarginRecords];
  const nextEntries = [...store.commissionEntries];
  let importedRows = 0;
  let updatedRows = 0;
  let matchedRows = 0;
  let generatedCommissionRows = 0;
  let anticipatedRows = 0;
  let maturingRows = 0;
  let missingTariffRows = 0;
  let missingRuleRows = 0;
  let negativeRows = 0;
  let totalMargin = 0;
  let totalGeneratedCommissions = 0;

  function removeExistingCommission(entryId?: string) {
    if (!entryId) {
      return;
    }

    const entryIndex = nextEntries.findIndex((entry) => entry.id === entryId);
    if (entryIndex >= 0) {
      nextEntries.splice(entryIndex, 1);
    }
  }

  for (const row of input.rows) {
    const existing = existingByKey.get(row.importKey);

    if (hasNegativeAgencyMarginValues(row)) {
      negativeRows += 1;
      removeExistingCommission(existing?.commissionEntryId);

      if (existing) {
        const index = nextRecords.findIndex((item) => item.id === existing.id);
        if (index >= 0) {
          nextRecords.splice(index, 1);
          updatedRows += 1;
        }
      }

      continue;
    }

    const customer = customerByPod.get(row.podPdrNorm);
    const source = customer ? sourceById.get(customer.sourceId) : undefined;
    let commissionStatus: AgencyMarginRecord["commissionStatus"] = customer
      ? "regola_mancante"
      : "da_abbinare";
    let commissionAmount: number | undefined;
    let commissionEntryId: string | undefined = existing?.commissionEntryId;
    let commissionKind: AgencyMarginRecord["commissionKind"];

    if (customer) {
      matchedRows += 1;
    }

    if (row.tariffNote) {
      commissionStatus = "tariffa_mancante";
      missingTariffRows += 1;
      removeExistingCommission(commissionEntryId);
      commissionEntryId = undefined;
    } else if (source) {
      const recordForCalculation: AgencyMarginRecord = {
        ...row,
        id: existing?.id ?? `mag_${randomUUID()}`,
        uploadedFileId: input.uploadedFileId,
        matchedCustomerId: customer?.id,
        matchedSourceId: source.id,
        matchedAt: now,
        commissionEntryId,
        commissionAmount,
        commissionStatus,
        importedAt: existing?.importedAt ?? now
      };
      const calculation = commissionAmountFromAppsScriptRules({
        record: recordForCalculation,
        sourceKind: source.kind,
        allRecords: nextRecords,
        firstPresenceMonthKey: firstPresenceMonthForPod({
          podPdrNorm: row.podPdrNorm,
          currentMonthKey: row.monthKey,
          agencyRecords: nextRecords,
          loadingRecords: store.loadingRecords,
          customer
        }),
        ownRecordId: existing?.id
      });

      commissionStatus = calculation.status;

      if (calculation.status === "regola_mancante") {
        missingRuleRows += 1;
        removeExistingCommission(commissionEntryId);
        commissionEntryId = undefined;
      } else if (calculation.status === "anticipata") {
        anticipatedRows += 1;
        removeExistingCommission(commissionEntryId);
        commissionEntryId = undefined;
      } else if (calculation.status === "in_maturazione") {
        maturingRows += 1;
        removeExistingCommission(commissionEntryId);
        commissionEntryId = undefined;
      } else {
        commissionAmount = calculation.amount ?? 0;
        commissionKind = calculation.kind;
        commissionEntryId = commissionEntryId ?? `com_margin_${randomUUID()}`;
        const names = splitCustomerName(row.customerName);
        const entry: CommissionEntry = {
          id: commissionEntryId,
          sourceId: source.id,
          role: sourceRole(source.kind),
          pod: row.podPdrNorm,
          customerName: names.customerName,
          customerSurname: names.customerSurname,
          type: row.customerType === "non_definito" ? undefined : row.customerType,
          competenceMonth: addMonthsToMonthKey(row.monthKey, -1),
          dueMonth: row.monthKey,
          amount: commissionAmount,
          importedFrom: uploadedFile
            ? `Provvigioni agenzia: ${uploadedFile.originalName}`
            : "Provvigioni agenzia",
          createdAt: now
        };
        const entryIndex = nextEntries.findIndex((candidate) => candidate.id === entry.id);
        if (entryIndex >= 0) {
          nextEntries[entryIndex] = entry;
        } else {
          nextEntries.unshift(entry);
        }

        generatedCommissionRows += 1;
        totalGeneratedCommissions += commissionAmount ?? 0;
      }
    } else if (!customer) {
      removeExistingCommission(commissionEntryId);
      commissionEntryId = undefined;
    }

    const record: AgencyMarginRecord = {
      ...row,
      id: existing?.id ?? `mag_${randomUUID()}`,
      uploadedFileId: input.uploadedFileId,
      matchedCustomerId: customer?.id,
      matchedSourceId: source?.id,
      matchedAt: source ? now : undefined,
      commissionEntryId,
      commissionAmount,
      commissionKind,
      commissionStatus,
      importedAt: existing?.importedAt ?? now
    };

    totalMargin += record.marginAmount;

    if (existing) {
      const index = nextRecords.findIndex((item) => item.id === existing.id);
      if (index >= 0) {
        nextRecords[index] = record;
      }
      updatedRows += 1;
    } else {
      nextRecords.unshift(record);
      importedRows += 1;
    }
  }

  store.agencyMarginRecords = nextRecords.sort((a, b) => {
    const dateCompare = b.monthKey.localeCompare(a.monthKey);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return b.importedAt.localeCompare(a.importedAt);
  });
  store.commissionEntries = nextEntries;

  await writeStore(store);

  return {
    totalRows: input.totalRows,
    importedRows,
    updatedRows,
    skippedRows: input.skippedRows + negativeRows,
    matchedRows,
    unmatchedRows: input.rows.length - negativeRows - matchedRows,
    generatedCommissionRows,
    anticipatedRows,
    maturingRows,
    missingTariffRows,
    missingRuleRows,
    totalMargin: roundCurrency(totalMargin),
    totalGeneratedCommissions: roundCurrency(totalGeneratedCommissions)
  };
}

export async function addCommissionRule(input: {
  name: string;
  sourceKind: CommissionRule["sourceKind"];
  customerType: CommissionRule["customerType"];
  offerName: string;
  calculationType: CommissionRule["calculationType"];
  amount: number;
  percentage?: number;
  maxAmount?: number;
  effectiveFrom: string;
  notes?: string;
  createdBy: string;
}) {
  const store = await readStore();
  const name = input.name.trim();
  const offerName = input.offerName.trim();

  if (!name) {
    throw new Error("Inserisci il nome della regola.");
  }

  if (!offerName) {
    throw new Error("Inserisci il nome offerta o criterio.");
  }

  if (input.calculationType === "fixed_amount" && (!Number.isFinite(input.amount) || input.amount < 0)) {
    throw new Error("Inserisci un importo provvigionale valido.");
  }

  if (
    input.calculationType === "margin_percentage" &&
    (!Number.isFinite(input.percentage) || !input.percentage || input.percentage <= 0)
  ) {
    throw new Error("Inserisci una percentuale provvigione agenzia valida.");
  }

  if (!input.effectiveFrom) {
    throw new Error("Inserisci la data di validita.");
  }

  const rule: CommissionRule = {
    id: `rule_${randomUUID()}`,
    name,
    sourceKind: input.sourceKind,
    customerType: input.customerType,
    offerName,
    calculationType: input.calculationType,
    amount: Math.round(input.amount * 100) / 100,
    percentage:
      input.calculationType === "margin_percentage" && input.percentage
        ? Math.round(input.percentage * 100) / 100
        : undefined,
    maxAmount:
      input.maxAmount && input.maxAmount > 0 ? Math.round(input.maxAmount * 100) / 100 : undefined,
    effectiveFrom: input.effectiveFrom,
    notes: input.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy
  };

  store.commissionRules.unshift(rule);
  await writeStore(store);
}

export async function addCommissionPayment(input: {
  sourceId: string;
  amount: number;
  paidAt: string;
  period?: string;
  notes?: string;
  createdBy: string;
}) {
  const store = await readStore();
  const source = store.sources.find((item) => item.id === input.sourceId);

  if (!source) {
    throw new Error("Fonte non trovata.");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Inserisci un importo pagato valido.");
  }

  const payment: CommissionPayment = {
    id: `pay_${randomUUID()}`,
    sourceId: source.id,
    amount: Math.round(input.amount * 100) / 100,
    paidAt: input.paidAt || new Date().toISOString().slice(0, 10),
    period: input.period?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy
  };

  store.commissionPayments.unshift(payment);
  await writeStore(store);
}

export async function upsertMarketVariable(input: {
  key: string;
  monthKey: string;
  value: number;
  notes?: string;
  updatedBy: string;
}) {
  const definition = getMarketVariableDefinition(input.key);

  if (!definition) {
    throw new Error("Voce variabile non valida.");
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.monthKey)) {
    throw new Error("Mese non valido.");
  }

  if (!Number.isFinite(input.value)) {
    throw new Error("Inserisci un valore valido.");
  }

  const store = await readStore();
  const now = new Date().toISOString();
  const existing = store.marketVariables.find(
    (variable) => variable.key === input.key && variable.monthKey === input.monthKey
  );

  if (existing) {
    existing.label = definition.label;
    existing.commodity = definition.commodity;
    existing.value = input.value;
    existing.unit = definition.unit;
    existing.notes = input.notes?.trim() || existing.notes;
    existing.updatedAt = now;
    existing.updatedBy = input.updatedBy;
  } else {
    store.marketVariables.push({
      id: marketVariableId(input.key, input.monthKey),
      key: input.key,
      label: definition.label,
      commodity: definition.commodity,
      monthKey: input.monthKey,
      value: input.value,
      unit: definition.unit,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      updatedBy: input.updatedBy
    });
  }

  store.marketVariables.sort(
    (a, b) =>
      b.monthKey.localeCompare(a.monthKey) ||
      a.commodity.localeCompare(b.commodity) ||
      a.label.localeCompare(b.label, "it")
  );

  await writeStore(store);
}

export async function addEnergyQuote(input: Omit<EnergyQuote, "id" | "createdAt">) {
  const store = await readStore();
  const createdAt = new Date().toISOString();
  const quote: EnergyQuote = {
    ...input,
    id: `quote_${randomUUID()}`,
    createdAt
  };

  store.energyQuotes.unshift(quote);
  await writeStore(store);
  return quote;
}
