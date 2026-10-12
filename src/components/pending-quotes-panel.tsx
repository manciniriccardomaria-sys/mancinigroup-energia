"use client";

import { useState, type FormEvent } from "react";
import { Calculator, ClipboardList, Plus } from "lucide-react";
import { formatDate, normalizePodPdr } from "@/lib/normalize";
import { convertPendingQuote, pendingQuoteStatus, pendingQuoteStatusLabels, savePendingQuote, setPendingQuoteStatus, visiblePendingQuotes } from "@/lib/pending-quotes";
import { deleteQuoteBill, MAX_BILL_FILES, uploadQuoteBill, validateBillFile } from "@/lib/quote-bill-files";
import { activeSourcesForUser, isPersonalUser } from "@/lib/view-model";
import type { PendingEnergyQuote, PendingQuoteStatus, QuoteBillAttachment, SessionUser, StoreData } from "@/lib/types";
import { QuoteBillAttachments } from "./quote-bill-attachments";

type Props = {
  store: StoreData;
  user: SessionUser;
  mutateStore: (change: (draft: StoreData) => void, message: string) => Promise<boolean>;
  onPrepare: (quote: PendingEnergyQuote) => void;
};

export function PendingQuotesPanel({ store, user, mutateStore, onPrepare }: Props) {
  const [editing, setEditing] = useState<PendingEnergyQuote | "new">();
  const [files, setFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PendingQuoteStatus | "tutti">("tutti");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [converting, setConverting] = useState<PendingEnergyQuote>();
  const [podPdr, setPodPdr] = useState("");
  const requests = visiblePendingQuotes(store, user);
  const filtered = requests.filter((quote) => (statusFilter === "tutti" || pendingQuoteStatus(quote) === statusFilter)
    && `${quote.firstName} ${quote.lastName} ${quote.phone ?? ""} ${quote.notes ?? ""} ${quote.podPdr ?? ""} ${store.sources.find((source) => source.id === quote.sourceId)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || b.createdAt.localeCompare(a.createdAt));
  const current = editing && editing !== "new" ? editing : undefined;
  const sources = activeSourcesForUser(user, store.sources);
  const matchedCustomer = converting && podPdr.trim() ? store.customers.find((customer) => customer.podPdrNorm === normalizePodPdr(podPdr)) : undefined;
  const differentSource = matchedCustomer && matchedCustomer.sourceId !== converting?.sourceId;

  function edit(quote: PendingEnergyQuote | "new") {
    setEditing(quote); setFiles([]); setError(""); setConverting(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const uploaded: QuoteBillAttachment[] = [];
    setSaving(true); setError("");
    try {
      const firstName = String(data.get("firstName") ?? "").trim();
      const lastName = String(data.get("lastName") ?? "").trim();
      if (!firstName || !lastName) throw new Error("Inserisci nome e cognome del cliente.");
      if ((current?.attachments?.length ?? 0) + files.length > MAX_BILL_FILES) throw new Error("Puoi allegare fino a cinque bollette per preventivo.");
      files.forEach(validateBillFile);
      const sourceId = isPersonalUser(user) ? user.sourceId : String(data.get("sourceId") ?? current?.sourceId ?? "") || undefined;
      for (const file of files) uploaded.push(await uploadQuoteBill(file, user, current?.createdBy ?? user.id, sourceId));
      const saved = await mutateStore((draft) => savePendingQuote(draft, user, {
        firstName, lastName,
        phone: String(data.get("phone") ?? ""),
        commodity: String(data.get("commodity") ?? current?.commodity ?? "luce") as PendingEnergyQuote["commodity"],
        customerType: String(data.get("customerType")) as PendingEnergyQuote["customerType"],
        sourceId,
        dueDate: String(data.get("dueDate") ?? ""),
        notes: String(data.get("notes") ?? ""),
        attachments: [...(current?.attachments ?? []), ...uploaded]
      }, current?.id), current ? "Richiesta e bollette aggiornate." : "Preventivo da preparare inserito.");
      if (saved) { setEditing(undefined); setFiles([]); }
      else await Promise.allSettled(uploaded.map(deleteQuoteBill));
    } catch (problem) {
      await Promise.allSettled(uploaded.map(deleteQuoteBill));
      setError(problem instanceof Error ? problem.message : "Caricamento bollette non riuscito.");
    } finally { setSaving(false); }
  }

  async function changeStatus(quote: PendingEnergyQuote, status: PendingQuoteStatus) {
    setError("");
    if (status === "convertito") { setConverting(quote); setPodPdr(quote.podPdr ?? ""); setEditing(undefined); return; }
    setSaving(true);
    try { await mutateStore((draft) => setPendingQuoteStatus(draft, user, quote.id, status), "Stato del preventivo aggiornato."); }
    finally { setSaving(false); }
  }

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!converting) return;
    setSaving(true); setError("");
    try {
      const saved = await mutateStore((draft) => convertPendingQuote(draft, user, converting.id, podPdr), "Preventivo convertito: contratto associato alla fonte.");
      if (saved) setConverting(undefined);
    } finally { setSaving(false); }
  }

  return (
    <section className="panel pending-quotes-panel print-hidden" aria-labelledby="pending-quotes-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><ClipboardList size={16} aria-hidden="true" /> Richieste e bollette</p>
          <h2 id="pending-quotes-title">Preventivi da gestire ({requests.length})</h2>
          <p className="muted-text">Carica le bollette e segui il preventivo fino alla conversione.</p>
        </div>
        <button className="primary-button" disabled={saving} type="button" onClick={() => edit("new")}><Plus size={18} aria-hidden="true" /> Aggiungi preventivo da fare</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {editing && <form className="pending-quote-form" key={current?.id ?? "new"} onSubmit={submit}>
        <h3>{current ? "Modifica richiesta" : "Nuovo preventivo da fare"}</h3>
        <fieldset disabled={saving}>
        <div className="pending-quote-fields">
          <label>Nome<input name="firstName" required defaultValue={current?.firstName} /></label>
          <label>Cognome<input name="lastName" required defaultValue={current?.lastName} /></label>
          <label>Telefono<input name="phone" type="tel" defaultValue={current?.phone} /></label>
          <label>Fornitura<select name="commodity" disabled={Boolean(current?.convertedCustomerId)} defaultValue={current?.commodity ?? "luce"}><option value="luce">Luce</option><option value="gas">Gas</option></select></label>
          <label>Tipologia cliente<select name="customerType" defaultValue={current?.customerType ?? "RES"}><option value="RES">Residenziale</option><option value="BUS">Business</option></select></label>
          {!isPersonalUser(user) && <label>Fonte<select name="sourceId" disabled={Boolean(current?.convertedCustomerId)} defaultValue={current?.sourceId ?? ""}><option value="">Da assegnare</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>}
          <label>Da fare entro<input name="dueDate" type="date" defaultValue={current?.dueDate} /></label>
          <label className="pending-quote-notes">Bollette da preventivare<input name="bills" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); setError(""); }} /><small>PDF, JPG, PNG o WebP · massimo 10 MB per file e cinque bollette per richiesta. Nome e cognome sono quelli inseriti sopra.</small></label>
          {files.length > 0 && <p className="pending-quote-notes">Da caricare: {files.map((file) => file.name).join(", ")}</p>}
          {current?.attachments?.length ? <div className="pending-quote-notes"><p>Bollette già caricate</p><QuoteBillAttachments quote={current} /></div> : null}
          <label className="pending-quote-notes">Note<textarea name="notes" rows={3} placeholder="Dati da recuperare, dettagli della richiesta…" defaultValue={current?.notes} /></label>
        </div>
        <div className="operations-actions"><button className="primary-button" type="submit">{saving ? "Caricamento e salvataggio…" : "Salva richiesta"}</button><button className="secondary-button" type="button" onClick={() => { setEditing(undefined); setFiles([]); }}>Annulla</button></div>
        </fieldset>
      </form>}
      {converting && <form className="pending-quote-form" onSubmit={convert}>
        <h3>Converti il preventivo di {converting.firstName} {converting.lastName}</h3>
        <p>Fonte: <strong>{store.sources.find((source) => source.id === converting.sourceId)?.name ?? "Da assegnare"}</strong></p>
        <label>{converting.commodity === "luce" ? "POD del contratto" : "PDR del contratto"}<input required disabled={saving} value={podPdr} onChange={(event) => setPodPdr(event.target.value)} placeholder={converting.commodity === "luce" ? "IT001E12345678" : "14 cifre"} /></label>
        <p className="muted-text">Il contratto sarà associato alla fonte e riconosciuto nei caricamenti successivi.</p>
        {matchedCustomer && <p role={differentSource ? "alert" : undefined}>{differentSource ? "Questo POD/PDR è già associato a un’altra fonte: verifica l’abbinamento in Associa." : `Contratto già presente: ${matchedCustomer.name}. Verrà collegato senza creare duplicati.`}</p>}
        {!converting.sourceId && <p role="alert">Assegna una fonte dalla modifica della richiesta prima di convertire.</p>}
        <div className="operations-actions"><button className="primary-button" disabled={saving || Boolean(differentSource) || !converting.sourceId} type="submit">{saving ? "Conversione…" : "Conferma conversione"}</button><button className="secondary-button" disabled={saving} type="button" onClick={() => setConverting(undefined)}>Annulla</button></div>
      </form>}
      <div className="operations-filters">
        <label>Cerca cliente, fonte, POD/PDR o note<input value={search} onChange={(event) => setSearch(event.target.value)} type="search" /></label>
        <label>Stato<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="tutti">Tutti</option>{Object.entries(pendingQuoteStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Fornitura</th><th>Fonte</th><th>Bollette</th><th>Stato</th><th>Da fare entro</th><th>Note</th><th>Azioni</th></tr></thead><tbody>
        {filtered.map((quote) => <tr key={quote.id}>
          <td><strong>{quote.firstName} {quote.lastName}</strong><small>{quote.phone || (quote.customerType === "RES" ? "Residenziale" : "Business")}</small></td>
          <td>{quote.commodity === "luce" ? "Luce" : "Gas"}{quote.podPdr && <small>{quote.podPdr}</small>}</td>
          <td>{store.sources.find((source) => source.id === quote.sourceId)?.name || "Da assegnare"}</td>
          <td><QuoteBillAttachments quote={quote} /></td>
          <td><select aria-label={`Stato di ${quote.firstName} ${quote.lastName}`} value={pendingQuoteStatus(quote)} disabled={saving || Boolean(converting) || pendingQuoteStatus(quote) === "convertito"} onChange={(event) => void changeStatus(quote, event.target.value as PendingQuoteStatus)}>{Object.entries(pendingQuoteStatusLabels).map(([status, label]) => <option key={status} value={status} disabled={status === "convertito" && isPersonalUser(user)}>{label}</option>)}</select>{isPersonalUser(user) && pendingQuoteStatus(quote) !== "convertito" && <small>Conversione a cura della sede.</small>}</td>
          <td>{quote.dueDate ? formatDate(quote.dueDate) : "—"}</td><td className="pending-quote-note-cell">{quote.notes || "—"}</td>
          <td><div className="operations-actions">{pendingQuoteStatus(quote) !== "convertito" && <button className="primary-button" disabled={saving || Boolean(converting)} type="button" onClick={() => onPrepare(quote)}><Calculator size={16} aria-hidden="true" />{quote.completedQuoteId ? "Rivedi" : "Prepara"}</button>}<button className="secondary-button" disabled={saving} type="button" onClick={() => edit(quote)}>Modifica</button></div></td>
        </tr>)}
        {!filtered.length && <tr><td colSpan={8} className="empty-state">{requests.length ? "Nessuna richiesta trovata." : "Nessun preventivo da fare. Aggiungi una richiesta per iniziare."}</td></tr>}
      </tbody></table></div>
    </section>
  );
}
