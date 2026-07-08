import type {
  AgencyMarginRecord,
  CommissionEntry,
  CommissionPayment,
  Customer,
  LoadingRecord,
  ProductionMetric,
  SessionUser,
  Source,
  StoreData
} from "./types";
import { hasNegativeAgencyMarginValues } from "./agency-margin-records";

export function sourceMap(sources: Source[]) {
  return new Map(sources.map((source) => [source.id, source]));
}

export function visibleCustomers(user: SessionUser, store: StoreData) {
  if (user.role === "admin" || user.role === "frontline") {
    return store.customers;
  }

  return store.customers.filter((customer) => customer.sourceId === user.sourceId);
}

export function visibleLoadingRecords(user: SessionUser, store: StoreData) {
  if (user.role === "agent" && user.sourceId) {
    return store.loadingRecords.filter((record) => record.matchedSourceId === user.sourceId);
  }

  return store.loadingRecords;
}

export function visibleAgencyMarginRecords(user: SessionUser, store: StoreData) {
  const records =
    user.role === "agent" && user.sourceId
      ? store.agencyMarginRecords.filter((record) => record.matchedSourceId === user.sourceId)
      : store.agencyMarginRecords;

  return records.filter((record) => !hasNegativeAgencyMarginValues(record));
}

export function summarizeAgencyMargins(records: AgencyMarginRecord[]) {
  return records.reduce(
    (summary, record) => {
      if (hasNegativeAgencyMarginValues(record)) {
        return summary;
      }

      summary.totalMargin += record.marginAmount;
      summary.totalInvoices += record.invoiceTotal;

      if (record.commodity === "luce") {
        summary.luceMargin += record.marginAmount;
      } else if (record.commodity === "gas") {
        summary.gasMargin += record.marginAmount;
      }

      if (record.commissionStatus === "generata") {
        summary.generatedCommissions += record.commissionAmount ?? 0;
      } else if (record.commissionStatus === "anticipata") {
        summary.anticipatedRows += 1;
      } else if (record.commissionStatus === "in_maturazione") {
        summary.maturingRows += 1;
      } else if (record.commissionStatus === "da_abbinare") {
        summary.unmatchedRows += 1;
      } else if (record.commissionStatus === "tariffa_mancante") {
        summary.missingTariffRows += 1;
      } else if (record.commissionStatus === "regola_mancante") {
        summary.missingRuleRows += 1;
      }

      return summary;
    },
    {
      totalMargin: 0,
      totalInvoices: 0,
      luceMargin: 0,
      gasMargin: 0,
      generatedCommissions: 0,
      anticipatedRows: 0,
      maturingRows: 0,
      unmatchedRows: 0,
      missingTariffRows: 0,
      missingRuleRows: 0
    }
  );
}

export function customerSource(customer: Customer, sources: Source[]) {
  return sourceMap(sources).get(customer.sourceId) ?? null;
}

export function activeSourcesForUser(user: SessionUser, sources: Source[]) {
  const active = sources.filter((source) => source.active);

  if (user.role === "agent" && user.sourceId) {
    return active.filter((source) => source.id === user.sourceId);
  }

  return active;
}

export function visibleSourcesForUser(user: SessionUser, sources: Source[]) {
  if (user.role === "agent" && user.sourceId) {
    return sources.filter((source) => source.id === user.sourceId);
  }

  return sources;
}

export function visibleCommissionEntries(user: SessionUser, store: StoreData) {
  if (user.role === "agent" && user.sourceId) {
    return store.commissionEntries.filter((entry) => entry.sourceId === user.sourceId);
  }

  return store.commissionEntries;
}

export function visibleCommissionPayments(user: SessionUser, store: StoreData) {
  if (user.role === "agent" && user.sourceId) {
    return store.commissionPayments.filter((payment) => payment.sourceId === user.sourceId);
  }

  return store.commissionPayments;
}

export function summarizeCommissionRows(
  entries: CommissionEntry[],
  payments: CommissionPayment[],
  sources: Source[]
) {
  return sources
    .map((source) => {
      const total = entries
        .filter((entry) => entry.sourceId === source.id)
        .reduce((sum, entry) => sum + entry.amount, 0);
      const paid = payments
        .filter((payment) => payment.sourceId === source.id)
        .reduce((sum, payment) => sum + payment.amount, 0);

      return {
        source,
        total,
        paid,
        due: Math.max(0, total - paid)
      };
    })
    .filter((row) => row.total > 0 || row.paid > 0)
    .sort((a, b) => b.due - a.due || a.source.name.localeCompare(b.source.name, "it"));
}

function monthKeyFromDate(value?: string) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return null;
}

function includesStatus(value: string | undefined, needles: string[]) {
  const normalized = value?.toLowerCase() ?? "";
  return needles.some((needle) => normalized.includes(needle));
}

function isBlockedLoading(record: LoadingRecord) {
  return includesStatus(record.status, ["blocc"]) || includesStatus(record.precheckStatus, ["blocc"]);
}

function isExitedLoading(record: LoadingRecord) {
  return Boolean(record.endDate) || includesStatus(record.status, ["cess", "annull", "uscit"]);
}

function isInValidationLoading(record: LoadingRecord) {
  if (isBlockedLoading(record) || isExitedLoading(record)) {
    return false;
  }

  return (
    includesStatus(record.status, ["attivazione", "validazione"]) ||
    Boolean(record.precheckStatus && !includesStatus(record.precheckStatus, ["ok"]))
  );
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    month: "short",
    year: "2-digit"
  }).format(new Date(year, month - 1, 1));
}

export function monthlyPerformance(
  customers: Customer[],
  entries: CommissionEntry[],
  productionMetrics: ProductionMetric[] = [],
  loadingRecords: LoadingRecord[] = []
) {
  const buckets = new Map<
    string,
    {
      monthKey: string;
      label: string;
      luce: number;
      gas: number;
      nonDefinito: number;
      totalContracts: number;
      inValidation: number;
      blocked: number;
      exited: number;
      commissions: number;
    }
  >();

  function ensure(monthKey: string) {
    const existing = buckets.get(monthKey);
    if (existing) {
      return existing;
    }

    const row = {
      monthKey,
      label: monthLabel(monthKey),
      luce: 0,
      gas: 0,
      nonDefinito: 0,
      totalContracts: 0,
      inValidation: 0,
      blocked: 0,
      exited: 0,
      commissions: 0
    };

    buckets.set(monthKey, row);
    return row;
  }

  if (loadingRecords.length > 0) {
    for (const record of loadingRecords) {
      const monthKey =
        monthKeyFromDate(record.signedAt) ??
        monthKeyFromDate(record.loadedAt) ??
        monthKeyFromDate(record.importedAt);
      if (!monthKey) {
        continue;
      }

      const row = ensure(monthKey);
      row.totalContracts += 1;

      if (record.commodity === "luce") {
        row.luce += 1;
      } else if (record.commodity === "gas") {
        row.gas += 1;
      } else {
        row.nonDefinito += 1;
      }

      if (isInValidationLoading(record)) {
        row.inValidation += 1;
      }

      if (isBlockedLoading(record)) {
        row.blocked += 1;
      }

      if (isExitedLoading(record)) {
        row.exited += 1;
      }
    }
  } else {
    for (const metric of productionMetrics) {
      const row = ensure(metric.monthKey);
      row.luce = metric.luce;
      row.gas = metric.gas;
      row.totalContracts = metric.total;
      row.inValidation = metric.inValidation;
      row.blocked = metric.blocked;
      row.exited = metric.exited;
    }

    for (const customer of customers) {
      const monthKey = monthKeyFromDate(customer.createdAt);
      if (!monthKey) {
        continue;
      }

      const row = ensure(monthKey);

      if (productionMetrics.length === 0) {
        row.totalContracts += 1;

        if (customer.commodity === "luce") {
          row.luce += 1;
        } else if (customer.commodity === "gas") {
          row.gas += 1;
        } else {
          row.nonDefinito += 1;
        }
      }

      if (customer.status === "cessato") {
        row.exited += 1;
      }
    }
  }

  for (const entry of entries) {
    const monthKey = monthKeyFromDate(entry.dueMonth) ?? monthKeyFromDate(entry.competenceMonth);
    if (!monthKey) {
      continue;
    }

    ensure(monthKey).commissions += entry.amount;
  }

  return [...buckets.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey)).slice(0, 12);
}
