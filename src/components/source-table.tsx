import { Check, CircleOff } from "lucide-react";
import { toggleSourceAction } from "@/app/actions";
import { sourceKindLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/normalize";
import type { Source } from "@/lib/types";

export function SourceTable({
  sources,
  canManage
}: Readonly<{ sources: Source[]; canManage: boolean }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Stato</th>
            <th>Creata</th>
            {canManage ? <th>Azioni</th> : null}
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id}>
              <td>
                <strong>{source.name}</strong>
              </td>
              <td>{sourceKindLabels[source.kind]}</td>
              <td>
                <span className={`status-badge ${source.active ? "attivo" : "cessato"}`}>
                  {source.active ? "Attiva" : "Disattivata"}
                </span>
              </td>
              <td>{formatDateTime(source.createdAt)}</td>
              {canManage ? (
                <td>
                  <form action={toggleSourceAction}>
                    <input type="hidden" name="sourceId" value={source.id} />
                    <input type="hidden" name="active" value={String(!source.active)} />
                    <button className="icon-button" type="submit" title="Cambia stato fonte">
                      {source.active ? (
                        <CircleOff size={16} aria-hidden="true" />
                      ) : (
                        <Check size={16} aria-hidden="true" />
                      )}
                    </button>
                  </form>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
