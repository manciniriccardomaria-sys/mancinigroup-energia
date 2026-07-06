import { formatDate } from "@/lib/normalize";
import { sourceKindLabels } from "@/lib/labels";
import { sourceMap } from "@/lib/view-model";
import type { LoadingRecord, Source } from "@/lib/types";

function displayDate(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatDate(value);
}

export function LoadingRecordTable({
  records,
  sources
}: Readonly<{ records: LoadingRecord[]; sources: Source[] }>) {
  const sourcesById = sourceMap(sources);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>POD/PDR</th>
            <th>Cliente</th>
            <th>Fonte</th>
            <th>Offerta</th>
            <th>Fornitura</th>
            <th>Stato</th>
            <th>Precheck</th>
            <th>Firma</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={8} className="empty-state">
                Nessun caricamento importato.
              </td>
            </tr>
          ) : (
            records.map((record) => {
              const source = record.matchedSourceId ? sourcesById.get(record.matchedSourceId) : null;

              return (
                <tr key={record.id}>
                  <td>
                    <strong>{record.podPdr}</strong>
                    <small>Riga {record.rowNumber}</small>
                  </td>
                  <td>
                    {record.customerName}
                    <small>{record.customerType || "Tipo cliente non indicato"}</small>
                  </td>
                  <td>
                    {source ? (
                      <>
                        <span className="source-name">{source.name}</span>
                        <small>{sourceKindLabels[source.kind]}</small>
                      </>
                    ) : (
                      <span className="status-badge in_lavorazione">Da abbinare</span>
                    )}
                  </td>
                  <td>{record.offer || "-"}</td>
                  <td className="capitalize">{record.supplyType || record.commodity.replace("_", " ")}</td>
                  <td>{record.status || "-"}</td>
                  <td>{record.precheckStatus || "-"}</td>
                  <td>{displayDate(record.signedAt || record.loadedAt)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
