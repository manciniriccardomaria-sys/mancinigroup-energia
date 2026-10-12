"use client";

import { useState, type FormEvent } from "react";
import { Calculator, ClipboardList, Plus } from "lucide-react";
import { formatDate } from "@/lib/normalize";
import { savePendingQuote, visiblePendingQuotes } from "@/lib/pending-quotes";
import { activeSourcesForUser, isPersonalUser } from "@/lib/view-model";
import type { PendingEnergyQuote, SessionUser, StoreData } from "@/lib/types";

type Props = {
  store: StoreData;
  user: SessionUser;
  mutateStore: (change: (draft: StoreData) => void, message: string) => Promise<boolean>;
  onPrepare: (quote: PendingEnergyQuote) => void;
};

export function PendingQuotesPanel({ store, user, mutateStore, onPrepare }: Props) {
  const [editing, setEditing] = useState<PendingEnergyQuote | "new">();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const requests = visiblePendingQuotes(store, user).filter((quote) => !quote.completedQuoteId);
  const filtered = requests.filter((quote) => `${quote.firstName} ${quote.lastName} ${quote.phone ?? ""} ${quote.notes ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || b.createdAt.localeCompare(a.createdAt));
  const current = editing && editing !== "new" ? editing : undefined;
  const sources = activeSourcesForUser(user, store.sources);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const saved = await mutateStore((draft) => savePendingQuote(draft, user, {
        firstName: String(data.get("firstName") ?? ""),
        lastName: String(data.get("lastName") ?? ""),
        phone: String(data.get("phone") ?? ""),
        commodity: String(data.get("commodity")) as PendingEnergyQuote["commodity"],
        customerType: String(data.get("customerType")) as PendingEnergyQuote["customerType"],
        sourceId: String(data.get("sourceId") ?? "") || undefined,
        dueDate: String(data.get("dueDate") ?? ""),
        notes: String(data.get("notes") ?? "")
      }, current?.id), current ? "Richiesta aggiornata." : "Preventivo da fare inserito.");
      if (saved) setEditing(undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel pending-quotes-panel print-hidden" aria-labelledby="pending-quotes-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><ClipboardList size={16} aria-hidden="true" /> Da preparare</p>
          <h2 id="pending-quotes-title">Preventivi da fare ({requests.length})</h2>
          <p className="muted-text">Inserisci le richieste e apri il preventivatore quando sei pronto.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => setEditing("new")}><Plus size={18} aria-hidden="true" /> Aggiungi preventivo da fare</button>
      </div>
      {editing && <form className="pending-quote-form" key={current?.id ?? "new"} onSubmit={submit}>
        <h3>{current ? "Modifica richiesta" : "Nuovo preventivo da fare"}</h3>
        <div className="pending-quote-fields">
          <label>Nome<input name="firstName" required defaultValue={current?.firstName} /></label>
          <label>Cognome<input name="lastName" required defaultValue={current?.lastName} /></label>
          <label>Telefono<input name="phone" type="tel" defaultValue={current?.phone} /></label>
          <label>Fornitura<select name="commodity" defaultValue={current?.commodity ?? "luce"}><option value="luce">Luce</option><option value="gas">Gas</option></select></label>
          <label>Tipologia cliente<select name="customerType" defaultValue={current?.customerType ?? "RES"}><option value="RES">Residenziale</option><option value="BUS">Business</option></select></label>
          {!isPersonalUser(user) && <label>Fonte<select name="sourceId" defaultValue={current?.sourceId ?? ""}><option value="">Da assegnare</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>}
          <label>Da fare entro<input name="dueDate" type="date" defaultValue={current?.dueDate} /></label>
          <label className="pending-quote-notes">Note<textarea name="notes" rows={3} placeholder="Dati da recuperare, dettagli della richiesta…" defaultValue={current?.notes} /></label>
        </div>
        <div className="operations-actions"><button className="primary-button" disabled={saving} type="submit">{saving ? "Salvataggio…" : "Salva richiesta"}</button><button className="secondary-button" disabled={saving} type="button" onClick={() => setEditing(undefined)}>Annulla</button></div>
      </form>}
      {requests.length > 0 && <label className="pending-quote-search">Cerca cliente, telefono o note<input value={search} onChange={(event) => setSearch(event.target.value)} type="search" /></label>}
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefono</th><th>Fornitura</th><th>Fonte</th><th>Da fare entro</th><th>Note</th><th>Azioni</th></tr></thead><tbody>
        {filtered.map((quote) => <tr key={quote.id}>
          <td><strong>{quote.firstName} {quote.lastName}</strong><small>{quote.customerType === "RES" ? "Residenziale" : "Business"}</small></td>
          <td>{quote.phone || "—"}</td><td>{quote.commodity === "luce" ? "Luce" : "Gas"}</td>
          <td>{store.sources.find((source) => source.id === quote.sourceId)?.name || "Da assegnare"}</td>
          <td>{quote.dueDate ? formatDate(quote.dueDate) : "—"}</td><td className="pending-quote-note-cell">{quote.notes || "—"}</td>
          <td><div className="operations-actions"><button className="primary-button" type="button" onClick={() => onPrepare(quote)}><Calculator size={16} aria-hidden="true" /> Prepara</button><button className="secondary-button" type="button" onClick={() => setEditing(quote)}>Modifica</button></div></td>
        </tr>)}
        {!filtered.length && <tr><td colSpan={7} className="empty-state">{requests.length ? "Nessuna richiesta trovata." : "Nessun preventivo da fare. Aggiungi una richiesta per iniziare."}</td></tr>}
      </tbody></table></div>
    </section>
  );
}
