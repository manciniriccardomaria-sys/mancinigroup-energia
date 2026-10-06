import type { CommissionEntry, CommissionPayment } from "./types";

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
