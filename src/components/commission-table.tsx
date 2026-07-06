import { sourceKindLabels } from "@/lib/labels";
import { formatDate, formatEuro } from "@/lib/normalize";
import type { CommissionPayment, Source } from "@/lib/types";

type CommissionRow = {
  source: Source;
  total: number;
  paid: number;
  due: number;
};

export function CommissionTable({ rows }: Readonly<{ rows: CommissionRow[] }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fonte</th>
            <th>Ruolo</th>
            <th>Maturato</th>
            <th>Pagato</th>
            <th>Da pagare</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty-state">
                Nessuna provvigione presente.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.source.id}>
                <td>
                  <strong>{row.source.name}</strong>
                </td>
                <td>{sourceKindLabels[row.source.kind]}</td>
                <td>{formatEuro(row.total)}</td>
                <td>{formatEuro(row.paid)}</td>
                <td>
                  <strong>{formatEuro(row.due)}</strong>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentTable({
  payments,
  sources
}: Readonly<{ payments: CommissionPayment[]; sources: Source[] }>) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fonte</th>
            <th>Importo</th>
            <th>Data pagamento</th>
            <th>Periodo</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty-state">
                Nessun pagamento registrato.
              </td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr key={payment.id}>
                <td>
                  <strong>{sourceById.get(payment.sourceId)?.name ?? "Fonte mancante"}</strong>
                </td>
                <td>{formatEuro(payment.amount)}</td>
                <td>{formatDate(payment.paidAt)}</td>
                <td>{payment.period || "-"}</td>
                <td>{payment.notes || "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
