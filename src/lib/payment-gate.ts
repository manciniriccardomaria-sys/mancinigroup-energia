import type { CommissionEntry, CommissionPayment, Source } from "./types";

export function commissionPaymentMonths(sourceId: string, entries: CommissionEntry[], payments: CommissionPayment[], today: string) {
  const cents = (amount: number) => Math.round(amount * 100);
  const monthly = new Map<string, number>();
  for (const entry of entries) {
    if (entry.sourceId !== sourceId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.dueMonth) || entry.dueMonth > today.slice(0, 7)) continue;
    monthly.set(entry.dueMonth, (monthly.get(entry.dueMonth) ?? 0) + cents(entry.amount));
  }
  let available = payments.filter(payment => payment.sourceId === sourceId && (!payment.paidAt || payment.paidAt <= today))
    .reduce((sum, payment) => sum + cents(payment.amount), 0);
  available += [...monthly.values()].reduce((sum, amount) => sum + Math.max(0, -amount), 0);
  const result = new Map<string, { paid: number; due: number }>();
  // Payments have no structured month allocation: settle the oldest months
  // first, matching the outstanding-commission alerts.
  for (const [month, amount] of [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (amount <= 0) continue;
    const paid = Math.min(amount, Math.max(0, available));
    available -= paid;
    result.set(month, { paid: paid / 100, due: (amount - paid) / 100 });
  }
  return result;
}

// Payments have no structured allocation to months: cover the oldest balances first.
export function unpaidCommissionAlerts(sources: Source[], entries: CommissionEntry[], payments: CommissionPayment[], today: string) {
  const round = (value: number) => Math.round(value * 100);
  return sources.flatMap((source) => {
    const monthly = new Map<string, number>();
    for (const entry of entries) {
      if (entry.sourceId !== source.id || !/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.dueMonth) || entry.dueMonth > today.slice(0, 7)) continue;
      monthly.set(entry.dueMonth, (monthly.get(entry.dueMonth) ?? 0) + round(entry.amount));
    }
    const paid = payments.filter((payment) => payment.sourceId === source.id && (!payment.paidAt || payment.paidAt <= today));
    const paidCents = paid.reduce((sum, payment) => sum + round(payment.amount), 0);
    const balanceCents = [...monthly.values()].reduce((sum, amount) => sum + amount, 0) - paidCents;
    if (balanceCents <= 0) return [];

    // Negative adjustments reduce the outstanding balance as credits.
    let covered = paidCents + [...monthly.values()].reduce((sum, amount) => sum + Math.max(0, -amount), 0);
    const oldestUnpaidMonth = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).find(([, amount]) => {
      if (amount <= 0) return false;
      covered -= amount;
      return covered < 0;
    })?.[0];
    if (!oldestUnpaidMonth) return [];
    const latestPayment = paid.filter((payment) => payment.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(payment.paidAt))
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0]?.paidAt;
    return [{ source, balance: balanceCents / 100, oldestUnpaidMonth, latestPayment,
      quarterlyDueDate: latestPayment ? addCalendarMonths(latestPayment, 3) : undefined }];
  }).sort((a, b) => a.oldestUnpaidMonth.localeCompare(b.oldestUnpaidMonth) || b.balance - a.balance || a.source.name.localeCompare(b.source.name, "it"));
}

export function addCalendarMonths(date: string, months: number) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function paymentGate(sourceId: string, entries: CommissionEntry[], payments: CommissionPayment[], today: string) {
  const paid = payments.filter((payment) => payment.sourceId === sourceId && payment.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(payment.paidAt) && payment.paidAt <= today);
  const latest = [...paid].sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0];
  if (!latest) return undefined;
  const dueDate = addCalendarMonths(latest.paidAt, 3);
  const firstMonth = addCalendarMonths(latest.paidAt.slice(0, 7) + "-01", 1).slice(0, 7);
  const months = [0, 1, 2].map((offset) => addCalendarMonths(firstMonth + "-01", offset).slice(0, 7));
  const actual = entries.filter((entry) => entry.sourceId === sourceId && /^\d{4}-\d{2}$/.test(entry.dueMonth));
  const round = (value: number) => Math.round(value * 100) / 100;
  const matured = actual.filter((entry) => entry.dueMonth <= today.slice(0, 7)).reduce((sum, entry) => sum + entry.amount, 0);
  const totalPaid = paid.reduce((sum, payment) => sum + payment.amount, 0);
  return { latestPayment: latest.paidAt, dueDate, overdue: today >= dueDate, months,
    balance: round(Math.max(0, matured - totalPaid)),
    monthly: months.map((month) => ({ month,
      amount: round(actual.filter((entry) => entry.dueMonth === month && month <= today.slice(0, 7)).reduce((sum, entry) => sum + entry.amount, 0))
    })) };
}
