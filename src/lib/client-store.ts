import { getMarketVariableDefinition, marketVariableSeedValues } from "./market-variables";
import { detectCommodity, normalizePodPdr, slugify } from "./normalize";
import type {
  AgencyMarginImportResult,
  AgencyMarginImportRow,
  AgencyMarginRecord,
  CommissionEntry,
  CommissionPayment,
  CommissionRule,
  Customer,
  CustomerStatus,
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

const seedCommissionRules: Array<Omit<CommissionRule, "id" | "createdAt" | "createdBy">> = [
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
    notes: "50% della provvigione agenzia mensile, dal primo mese in Provvigioni agenzia"
  },
  {
    name: "Business frontline",
    sourceKind: "frontline",
    customerType: "BUS",
    offerName: "Business",
    calculationType: "fixed_amount",
    amount: 25,
    effectiveFrom: "2025-01-01",
    notes: "Gettone dopo 10 mesi, poi ricorrente ogni 12 mesi; scaglioni 25/30/50/100"
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
    notes: "Trattata come Home Family"
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
    notes: "50% della provvigione agenzia mensile"
  },
  {
    name: "Condomini frontline",
    sourceKind: "frontline",
    customerType: "BUS",
    offerName: "Condomini Standard",
    calculationType: "fixed_amount",
    amount: 25,
    effectiveFrom: "2025-01-01",
    notes: "Gettone dopo 10 mesi, poi ricorrente ogni 12 mesi; scaglioni 25/30/50/100"
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

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sourceId(name: string) {
  return `src_${slugify(name)}`;
}

function marketVariableId(key: string, monthKey: string) {
  return `var_${slugify(`${key}-${monthKey}`)}`;
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

function createUserMetadata(input: {
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  sourceId?: string;
}): User {
  return {
    id: `usr_${slugify(input.email)}`,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    sourceId: input.sourceId,
    passwordHash: "firebase-auth",
    createdAt: input.createdAt
  };
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

export function createDefaultClientStore(adminEmail: string, adminName = "Admin Energia"): StoreData {
  const createdAt = nowIso();
  const sources = seedSources.map((source) => createSource(source.name, source.kind, createdAt));
  const adminUser = createUserMetadata({
    email: adminEmail,
    name: adminName,
    role: "admin",
    createdAt
  });

  return {
    sources,
    customers: [],
    commissionEntries: [],
    commissionPayments: [],
    commissionRules: seedRules(adminUser.id, createdAt),
    productionMetrics: seedProductionMetrics,
    marketVariables: seedMarketVariables(adminUser.id, createdAt),
    energyQuotes: [],
    uploadedFiles: [],
    loadingRecords: [],
    agencyMarginRecords: [],
    users: [adminUser]
  };
}

export function normalizeStore(data: Partial<StoreData>, adminEmail?: string): StoreData {
  const base = data as StoreData;
  const fallback = adminEmail ? createDefaultClientStore(adminEmail) : createDefaultClientStore("admin@example.local");

  base.sources ??= fallback.sources;
  base.customers ??= [];
  base.commissionEntries ??= [];
  base.commissionPayments ??= [];
  base.commissionRules ??= fallback.commissionRules;
  base.productionMetrics ??= fallback.productionMetrics;
  base.uploadedFiles ??= [];
  base.loadingRecords ??= [];
  base.agencyMarginRecords ??= [];
  base.marketVariables ??= fallback.marketVariables;
  base.energyQuotes ??= [];
  base.users ??= fallback.users;

  return base;
}

export function cloneStore(store: StoreData): StoreData {
  return JSON.parse(JSON.stringify(store)) as StoreData;
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
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sourceRole(kind: SourceKind): CommissionEntry["role"] {
  if (kind === "frontline") return "FL";
  if (kind === "sede") return "SEDE";
  return "COLL";
}

function splitCustomerName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return { customerName: value.trim(), customerSurname: undefined };
  }

  const customerSurname = parts.pop();
  return { customerName: parts.join(" "), customerSurname };
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
  if (normalized.includes("HOME FAMILY")) return 15;
  if (normalized.includes("HOME FIDELITY")) return 20;
  return 25;
}

function frontlineBusinessCommissionAmount(agencyAmount: number) {
  if (agencyAmount >= 0 && agencyAmount <= 150) return 25;
  if (agencyAmount > 150 && agencyAmount <= 500) return 30;
  if (agencyAmount > 500 && agencyAmount <= 1000) return 50;
  if (agencyAmount > 1000) return 100;
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
    if (record.podPdrNorm !== input.podPdrNorm) continue;
    const monthKey =
      monthKeyFromDate(record.signedAt) ??
      monthKeyFromDate(record.loadedAt) ??
      monthKeyFromDate(record.importedAt);
    if (monthKey) monthKeys.push(monthKey);
  }

  const customerMonthKey = monthKeyFromDate(input.customer?.createdAt);
  if (customerMonthKey) monthKeys.push(customerMonthKey);

  return monthKeys.sort()[0] ?? input.currentMonthKey;
}

function hasFixedCommissionInLastTwelveMonths(input: {
  records: AgencyMarginRecord[];
  record: AgencyMarginRecord;
  ownRecordId?: string;
}) {
  return input.records.some((record) => {
    if (record.id === input.ownRecordId) return false;

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

function commissionAmountFromRules(input: {
  record: AgencyMarginRecord;
  sourceKind: SourceKind;
  allRecords: AgencyMarginRecord[];
  firstPresenceMonthKey: string;
  ownRecordId?: string;
}) {
  const role = input.sourceKind === "frontline" ? "FL" : input.sourceKind === "collaboratore" ? "COLL" : "";
  if (!role) return { status: "regola_mancante" as const };

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
    const monthsFromFirstPresence = monthDistance(input.firstPresenceMonthKey, input.record.monthKey);

    if (monthsFromFirstPresence < FIXED_COMMISSION_MATURITY_MONTHS) {
      return { status: "in_maturazione" as const };
    }

    if (
      hasFixedCommissionInLastTwelveMonths({
        records: input.allRecords,
        record: input.record,
        ownRecordId: input.ownRecordId
      })
    ) {
      return { status: "anticipata" as const };
    }

    if (isHome) {
      return { status: "generata" as const, kind: "home_once" as const, amount: homeCommissionAmount(input.record.offerEasy) };
    }

    return {
      status: "generata" as const,
      kind: "business_fl_once" as const,
      amount: frontlineBusinessCommissionAmount(input.record.marginAmount)
    };
  }

  return { status: "regola_mancante" as const };
}

function refreshLoadingMatches(records: LoadingRecord[], podPdrNorm: string, customerId: string, sourceIdValue: string, matchedAt: string) {
  for (const record of records) {
    if (record.podPdrNorm === podPdrNorm) {
      record.matchedCustomerId = customerId;
      record.matchedSourceId = sourceIdValue;
      record.matchedAt = matchedAt;
    }
  }
}

function refreshAgencyMarginMatches(records: AgencyMarginRecord[], podPdrNorm: string, customerId: string, sourceIdValue: string, matchedAt: string) {
  for (const record of records) {
    if (record.podPdrNorm === podPdrNorm) {
      record.matchedCustomerId = customerId;
      record.matchedSourceId = sourceIdValue;
      record.matchedAt = matchedAt;
    }
  }
}

export function addSourceToStore(store: StoreData, input: { name: string; kind: SourceKind }) {
  const name = input.name.trim();
  if (!name) throw new Error("Inserisci il nome fonte.");
  if (store.sources.some((source) => source.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Fonte gia presente.");
  }
  store.sources.push(createSource(name, input.kind, nowIso()));
}

export function setSourceActiveInStore(store: StoreData, sourceIdValue: string, active: boolean) {
  const source = store.sources.find((item) => item.id === sourceIdValue);
  if (!source) throw new Error("Fonte non trovata.");
  source.active = active;
}

export function addUserToStore(
  store: StoreData,
  input: { email: string; name: string; role: UserRole; sourceId?: string }
) {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Inserisci una email valida.");
  if (!input.name.trim()) throw new Error("Inserisci il nome utente.");
  if (store.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("Esiste gia un utente con questa email.");
  }

  const source = input.sourceId ? store.sources.find((item) => item.id === input.sourceId && item.active) : undefined;
  if (input.role !== "admin" && !source) throw new Error("Collega l'utente a una fonte attiva.");

  store.users.push(
    createUserMetadata({
      email,
      name: input.name,
      role: input.role,
      sourceId: source?.id,
      createdAt: nowIso()
    })
  );
}

export function addCustomerToStore(
  store: StoreData,
  input: { podPdr: string; name: string; sourceId: string; offer?: string; notes?: string; createdBy: string }
) {
  const podPdr = input.podPdr.trim();
  const podPdrNorm = normalizePodPdr(podPdr);
  const customerName = input.name.trim();
  if (!podPdrNorm) throw new Error("Inserisci un POD/PDR valido.");
  if (!customerName) throw new Error("Inserisci il nome cliente.");
  if (store.customers.some((customer) => customer.podPdrNorm === podPdrNorm)) {
    throw new Error("Questo POD/PDR e gia stato inserito.");
  }
  const source = store.sources.find((item) => item.id === input.sourceId && item.active);
  if (!source) throw new Error("Seleziona una fonte attiva.");

  const createdAt = nowIso();
  const customer: Customer = {
    id: randomId("cli"),
    podPdr,
    podPdrNorm,
    name: customerName,
    sourceId: source.id,
    commodity: detectCommodity(podPdr),
    status: "attivo",
    offer: input.offer?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt,
    createdBy: input.createdBy
  };

  store.customers.unshift(customer);
  refreshLoadingMatches(store.loadingRecords, podPdrNorm, customer.id, source.id, createdAt);
  refreshAgencyMarginMatches(store.agencyMarginRecords, podPdrNorm, customer.id, source.id, createdAt);
}

export function reassignCustomerInStore(store: StoreData, customerId: string, sourceIdValue: string) {
  const customer = store.customers.find((item) => item.id === customerId);
  const source = store.sources.find((item) => item.id === sourceIdValue && item.active);
  if (!customer) throw new Error("Cliente non trovato.");
  if (!source) throw new Error("Fonte non trovata.");
  customer.sourceId = source.id;
  const matchedAt = nowIso();
  refreshLoadingMatches(store.loadingRecords, customer.podPdrNorm, customer.id, source.id, matchedAt);
  refreshAgencyMarginMatches(store.agencyMarginRecords, customer.podPdrNorm, customer.id, source.id, matchedAt);
}

export function setCustomerStatusInStore(store: StoreData, customerId: string, status: CustomerStatus) {
  const customer = store.customers.find((item) => item.id === customerId);
  if (!customer) throw new Error("Cliente non trovato.");
  customer.status = status;
}

export function addUploadedFileToStore(
  store: StoreData,
  input: {
    originalName: string;
    category: UploadCategory;
    mimeType: string;
    size: number;
    uploadedBy: string;
    referenceMonth?: string;
    commodity?: UploadedFileRecord["commodity"];
  }
) {
  const record: UploadedFileRecord = {
    id: randomId("upl"),
    originalName: input.originalName,
    storedName: `metadata-only_${Date.now()}_${input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
    storageMode: "metadata_only",
    category: input.category,
    referenceMonth: input.referenceMonth,
    commodity: input.commodity,
    mimeType: input.mimeType || "application/octet-stream",
    size: input.size,
    uploadedAt: nowIso(),
    uploadedBy: input.uploadedBy
  };

  store.uploadedFiles.unshift(record);
  return record;
}

export function importLoadingRecordsToStore(
  store: StoreData,
  input: { uploadedFileId: string; rows: LoadingImportRow[]; totalRows: number; skippedRows: number }
): LoadingImportResult {
  const now = nowIso();
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
      id: existing?.id ?? randomId("car"),
      uploadedFileId: input.uploadedFileId,
      matchedCustomerId: customer?.id,
      matchedSourceId: customer?.sourceId,
      matchedAt: customer ? now : undefined,
      importedAt: existing?.importedAt ?? now
    };

    if (customer) matchedRows += 1;

    if (existing) {
      const index = nextRecords.findIndex((item) => item.id === existing.id);
      if (index >= 0) nextRecords[index] = record;
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

  return {
    totalRows: input.totalRows,
    importedRows,
    updatedRows,
    skippedRows: input.skippedRows,
    matchedRows,
    unmatchedRows: input.rows.length - matchedRows
  };
}

export function importAgencyMarginRecordsToStore(
  store: StoreData,
  input: { uploadedFileId: string; rows: AgencyMarginImportRow[]; totalRows: number; skippedRows: number }
): AgencyMarginImportResult {
  const now = nowIso();
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
  let totalMargin = 0;
  let totalGeneratedCommissions = 0;

  function removeExistingCommission(entryId?: string) {
    if (!entryId) return;
    const index = nextEntries.findIndex((entry) => entry.id === entryId);
    if (index >= 0) nextEntries.splice(index, 1);
  }

  for (const row of input.rows) {
    const customer = customerByPod.get(row.podPdrNorm);
    const source = customer ? sourceById.get(customer.sourceId) : undefined;
    const existing = existingByKey.get(row.importKey);
    let commissionStatus: AgencyMarginRecord["commissionStatus"] = customer ? "regola_mancante" : "da_abbinare";
    let commissionAmount: number | undefined;
    let commissionEntryId: string | undefined = existing?.commissionEntryId;
    let commissionKind: AgencyMarginRecord["commissionKind"];

    if (customer) matchedRows += 1;

    if (row.tariffNote) {
      commissionStatus = "tariffa_mancante";
      missingTariffRows += 1;
      removeExistingCommission(commissionEntryId);
      commissionEntryId = undefined;
    } else if (source) {
      const recordForCalculation: AgencyMarginRecord = {
        ...row,
        id: existing?.id ?? randomId("mag"),
        uploadedFileId: input.uploadedFileId,
        matchedCustomerId: customer?.id,
        matchedSourceId: source.id,
        matchedAt: now,
        commissionEntryId,
        commissionAmount,
        commissionKind,
        commissionStatus,
        importedAt: existing?.importedAt ?? now
      };
      const firstPresenceMonthKey = firstPresenceMonthForPod({
        podPdrNorm: row.podPdrNorm,
        currentMonthKey: row.monthKey,
        agencyRecords: nextRecords,
        loadingRecords: store.loadingRecords,
        customer
      });
      const result = commissionAmountFromRules({
        record: recordForCalculation,
        sourceKind: source.kind,
        allRecords: nextRecords,
        firstPresenceMonthKey,
        ownRecordId: existing?.id
      });

      commissionStatus = result.status;

      if (result.status === "generata") {
        commissionAmount = result.amount;
        commissionKind = result.kind;
        generatedCommissionRows += 1;
        totalGeneratedCommissions += result.amount;

        if (commissionEntryId) {
          removeExistingCommission(commissionEntryId);
        }

        const { customerName, customerSurname } = splitCustomerName(row.customerName);
        commissionEntryId = randomId("com");
        nextEntries.push({
          id: commissionEntryId,
          sourceId: source.id,
          role: sourceRole(source.kind),
          pod: row.podPdr,
          customerName,
          customerSurname,
          type: row.customerType === "BUS" ? "BUS" : "RES",
          competenceMonth: row.monthKey,
          dueMonth: row.monthKey,
          amount: result.amount,
          importedFrom: `Provvigioni agenzia ${row.monthKey}`,
          createdAt: now
        });
      } else {
        removeExistingCommission(commissionEntryId);
        commissionEntryId = undefined;
        if (result.status === "anticipata") anticipatedRows += 1;
        if (result.status === "in_maturazione") maturingRows += 1;
        if (result.status === "regola_mancante") missingRuleRows += 1;
      }
    }

    const record: AgencyMarginRecord = {
      ...row,
      id: existing?.id ?? randomId("mag"),
      uploadedFileId: input.uploadedFileId,
      matchedCustomerId: customer?.id,
      matchedSourceId: source?.id,
      matchedAt: customer ? now : undefined,
      commissionEntryId,
      commissionAmount,
      commissionKind,
      commissionStatus,
      importedAt: existing?.importedAt ?? now
    };

    totalMargin += row.marginAmount;

    if (existing) {
      const index = nextRecords.findIndex((item) => item.id === existing.id);
      if (index >= 0) nextRecords[index] = record;
      updatedRows += 1;
    } else {
      nextRecords.unshift(record);
      importedRows += 1;
    }
  }

  store.agencyMarginRecords = nextRecords.sort(
    (a, b) => b.monthKey.localeCompare(a.monthKey) || b.importedAt.localeCompare(a.importedAt)
  );
  store.commissionEntries = nextEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    totalRows: input.totalRows,
    importedRows,
    updatedRows,
    skippedRows: input.skippedRows,
    matchedRows,
    unmatchedRows: input.rows.length - matchedRows,
    generatedCommissionRows,
    anticipatedRows,
    maturingRows,
    missingTariffRows,
    missingRuleRows,
    totalMargin: roundCurrency(totalMargin),
    totalGeneratedCommissions: roundCurrency(totalGeneratedCommissions)
  };
}

export function addCommissionPaymentToStore(
  store: StoreData,
  input: { sourceId: string; amount: number; paidAt: string; period?: string; notes?: string; createdBy: string }
) {
  const source = store.sources.find((item) => item.id === input.sourceId);
  if (!source) throw new Error("Fonte non trovata.");
  if (!input.amount || input.amount <= 0) throw new Error("Inserisci un importo valido.");
  if (!input.paidAt) throw new Error("Inserisci la data pagamento.");

  store.commissionPayments.unshift({
    id: randomId("pay"),
    sourceId: source.id,
    amount: roundCurrency(input.amount),
    paidAt: input.paidAt,
    period: input.period?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: nowIso(),
    createdBy: input.createdBy
  });
}

export function addCommissionRuleToStore(
  store: StoreData,
  input: Omit<CommissionRule, "id" | "createdAt" | "createdBy"> & { createdBy: string }
) {
  if (!input.name.trim()) throw new Error("Inserisci il nome regola.");
  if (!input.offerName.trim()) throw new Error("Inserisci il nome offerta.");
  if (!input.effectiveFrom) throw new Error("Inserisci la data valida da.");

  store.commissionRules.unshift({
    id: randomId("rule"),
    name: input.name.trim(),
    sourceKind: input.sourceKind,
    customerType: input.customerType,
    offerName: input.offerName.trim(),
    calculationType: input.calculationType,
    amount: roundCurrency(input.amount),
    percentage: input.percentage,
    maxAmount: input.maxAmount,
    notes: input.notes?.trim() || undefined,
    effectiveFrom: input.effectiveFrom,
    createdAt: nowIso(),
    createdBy: input.createdBy
  });
}

export function upsertMarketVariableToStore(
  store: StoreData,
  input: { key: string; monthKey: string; value: number; notes?: string; updatedBy: string }
) {
  const definition = getMarketVariableDefinition(input.key);
  if (!definition) throw new Error("Variabile non valida.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.monthKey)) throw new Error("Mese non valido.");

  const existing = store.marketVariables.find(
    (variable) => variable.key === input.key && variable.monthKey === input.monthKey
  );
  const updatedAt = nowIso();

  if (existing) {
    existing.value = input.value;
    existing.notes = input.notes?.trim() || undefined;
    existing.updatedAt = updatedAt;
    existing.updatedBy = input.updatedBy;
    return;
  }

  store.marketVariables.unshift({
    id: marketVariableId(input.key, input.monthKey),
    key: input.key,
    label: definition.label,
    commodity: definition.commodity,
    monthKey: input.monthKey,
    value: input.value,
    unit: definition.unit,
    notes: input.notes?.trim() || undefined,
    createdAt: updatedAt,
    updatedAt,
    updatedBy: input.updatedBy
  });
}

export function addEnergyQuoteToStore(store: StoreData, input: Omit<EnergyQuote, "id" | "createdAt">) {
  store.energyQuotes.unshift({
    ...input,
    id: randomId("quote"),
    createdAt: nowIso()
  });
}
