import { ArrowRightLeft, Check } from "lucide-react";
import { reassignCustomerAction, setCustomerStatusAction } from "@/app/actions";
import { customerStatusLabels, sourceKindLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/normalize";
import { customerSource } from "@/lib/view-model";
import type { Customer, CustomerStatus, Source } from "@/lib/types";

const statuses: CustomerStatus[] = ["attivo", "in_lavorazione", "cessato"];

export function CustomerTable({
  customers,
  sources,
  canManage
}: Readonly<{ customers: Customer[]; sources: Source[]; canManage: boolean }>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>POD/PDR</th>
            <th>Cliente</th>
            <th>Fonte</th>
            <th>Tipo</th>
            <th>Stato</th>
            <th>Offerta</th>
            <th>Inserito</th>
            {canManage ? <th>Azioni</th> : null}
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td colSpan={canManage ? 8 : 7} className="empty-state">
                Nessuna associazione POD/PDR inserita.
              </td>
            </tr>
          ) : (
            customers.map((customer) => {
              const source = customerSource(customer, sources);

              return (
                <tr key={customer.id}>
                  <td>
                    <strong>{customer.podPdr}</strong>
                  </td>
                  <td>{customer.name}</td>
                  <td>
                    <span className="source-name">{source?.name ?? "Fonte mancante"}</span>
                    {source ? <small>{sourceKindLabels[source.kind]}</small> : <small>Da verificare</small>}
                  </td>
                  <td className="capitalize">{customer.commodity.replace("_", " ")}</td>
                  <td>
                    <span className={`status-badge ${customer.status}`}>
                      {customerStatusLabels[customer.status]}
                    </span>
                  </td>
                  <td>{customer.offer || "-"}</td>
                  <td>{formatDateTime(customer.createdAt)}</td>
                  {canManage ? (
                    <td>
                      <div className="row-actions">
                        <form action={reassignCustomerAction} className="inline-form">
                          <input type="hidden" name="customerId" value={customer.id} />
                          <select name="sourceId" defaultValue={customer.sourceId} title="Fonte">
                            {sources
                              .filter((sourceItem) => sourceItem.active)
                              .map((sourceItem) => (
                                <option key={sourceItem.id} value={sourceItem.id}>
                                  {sourceItem.name}
                                </option>
                              ))}
                          </select>
                          <button className="icon-button" type="submit" title="Riassegna fonte">
                            <ArrowRightLeft size={16} aria-hidden="true" />
                          </button>
                        </form>

                        <form action={setCustomerStatusAction} className="inline-form">
                          <input type="hidden" name="customerId" value={customer.id} />
                          <select name="status" defaultValue={customer.status} title="Stato">
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {customerStatusLabels[status]}
                              </option>
                            ))}
                          </select>
                          <button className="icon-button" type="submit" title="Aggiorna stato">
                            <Check size={16} aria-hidden="true" />
                          </button>
                        </form>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
