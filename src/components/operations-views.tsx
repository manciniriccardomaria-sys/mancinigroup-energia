"use client";

import { useState, type FormEvent } from "react";
import { BadgeEuro, ClipboardList, Tags } from "lucide-react";
import type { ManagedOffer } from "@/lib/offers";
import type { CustomerTicket, SessionUser, StoreData } from "@/lib/types";
import { formatDate, formatEuro, normalizePodPdr, parseEuro } from "@/lib/normalize";
import { isPersonalUser } from "@/lib/view-model";
import { paymentGate } from "@/lib/payment-gate";

type Props = { store: StoreData; user: SessionUser; mutateStore: (change: (draft: StoreData) => void, message: string) => Promise<boolean> };
const statuses: Record<CustomerTicket["status"], string> = { aperta: "Aperta", in_lavorazione: "In lavorazione", risolta: "Risolta", chiusa: "Chiusa" };
const dateToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());

export function TicketsView({ store, user, mutateStore }: Props) {
  const [editing, setEditing] = useState<CustomerTicket>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("tutti");
  const [error, setError] = useState("");
  const tickets = store.customerTickets.filter((ticket) => (!isPersonalUser(user) || ticket.sourceId === user.sourceId)
    && (status === "tutti" || ticket.status === status)
    && `${ticket.firstName} ${ticket.lastName} ${ticket.podPdr} ${ticket.problem}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    if (!["firstName", "lastName", "podPdr", "openedAt", "problem"].every((key) => value(key))) {
      setError("Compila tutti i campi obbligatori."); return;
    }
    const timestamp = new Date().toISOString();
    const ticket: CustomerTicket = { id: editing?.id ?? crypto.randomUUID(), firstName: value("firstName"), lastName: value("lastName"),
      podPdr: normalizePodPdr(value("podPdr")), openedAt: value("openedAt"), problem: value("problem"), status: value("status") as CustomerTicket["status"],
      sourceId: isPersonalUser(user) ? user.sourceId : value("sourceId") || undefined,
      createdBy: editing?.createdBy ?? user.id, createdAt: editing?.createdAt ?? timestamp, updatedAt: timestamp };
    const success = await mutateStore((draft) => {
      const index = draft.customerTickets.findIndex((item) => item.id === ticket.id);
      if (index >= 0) draft.customerTickets[index] = ticket; else draft.customerTickets.unshift(ticket);
    }, editing ? "Ticket aggiornato." : "Ticket aperto.");
    if (success) { setEditing(undefined); form.reset(); setError(""); }
  }
  return <>
    <section className="panel"><div className="panel-heading"><h2>{editing ? "Modifica ticket" : "Apri una problematica cliente"}</h2><ClipboardList /></div>
      <form key={editing?.id ?? "new"} className="form-grid compact" onSubmit={(event) => void submit(event)}>
        <label>Nome<input name="firstName" required defaultValue={editing?.firstName} /></label>
        <label>Cognome<input name="lastName" required defaultValue={editing?.lastName} /></label>
        <label>POD / PDR<input name="podPdr" required defaultValue={editing?.podPdr} /></label>
        <label>Data apertura<input name="openedAt" type="date" required defaultValue={editing?.openedAt ?? dateToday()} /></label>
        {!isPersonalUser(user) && <label>Fonte<select name="sourceId" defaultValue={editing?.sourceId ?? ""}><option value="">Senza fonte</option>{store.sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>}
        <label>Stato<select name="status" defaultValue={editing?.status ?? "aperta"}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="wide-field">Problematica<textarea name="problem" required rows={4} defaultValue={editing?.problem} /></label>
        {error && <p role="alert">{error}</p>}
        <button className="primary-button" type="submit">{editing ? "Salva modifiche" : "Apri ticket"}</button>
        {editing && <button className="secondary-button" type="button" onClick={() => setEditing(undefined)}>Annulla</button>}
      </form>
    </section>
    <section className="table-section operations-table"><h2>Ticket clienti ({tickets.length})</h2>
      <div className="operations-filters"><label>Cerca cliente, POD/PDR o problema<input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Stato<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="tutti">Tutti</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>POD/PDR</th><th>Apertura</th><th>Problematica</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>
        {tickets.map((ticket) => <tr key={ticket.id}><td>{ticket.firstName} {ticket.lastName}</td><td>{ticket.podPdr}</td><td>{formatDate(ticket.openedAt)}</td><td className="ticket-problem">{ticket.problem}</td><td><span className="status-badge">{statuses[ticket.status]}</span></td><td><button className="secondary-button" onClick={() => { setEditing(ticket); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Gestisci</button></td></tr>)}
        {!tickets.length && <tr><td colSpan={6} className="empty-state">Nessun ticket trovato.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}

export function ManagedOffersView({ store, user, mutateStore }: Props) {
  const canManage = user.role === "admin" || user.role === "operativo";
  const [editing, setEditing] = useState<ManagedOffer>();
  const [pricing, setPricing] = useState("variable");
  const [commodity, setCommodity] = useState("luce");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  function reset() { setEditing(undefined); setPricing("variable"); setCommodity("luce"); setError(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const numeric = (key: string) => parseEuro(value(key));
    const code = value("code");
    if (store.managedOffers.some((offer) => offer.code.toLowerCase() === code.toLowerCase() && offer.id !== editing?.id)) { setError("Codice offerta già presente."); return; }
    const numbers = [numeric("pcv"), numeric(pricing === "fixed" ? "fixedPrice" : "spread"), numeric("commissionRate"), numeric("commissionBaseSpread")];
    if (!code || !value("offerEasy") || numbers.some((number) => !Number.isFinite(number) || number < 0) || numeric("commissionRate") > 100 || (value("fixedAgencyCommission") && (!Number.isFinite(numeric("fixedAgencyCommission")) || numeric("fixedAgencyCommission") < 0))) { setError("Inserisci nome, codice e importi validi. La percentuale deve essere tra 0 e 100."); return; }
    const offer: ManagedOffer = { id: editing?.id ?? crypto.randomUUID(), code, offerEasy: value("offerEasy"), commodity: commodity as ManagedOffer["commodity"], customerType: value("customerType") as ManagedOffer["customerType"], pricingType: pricing as ManagedOffer["pricingType"],
      pcv: numeric("pcv"), spread: pricing === "variable" ? numeric("spread") : 0, fixedPrice: pricing === "fixed" ? numeric("fixedPrice") : undefined,
      commissionRate: numeric("commissionRate") / 100, commissionBaseSpread: numeric("commissionBaseSpread"), fixedAgencyCommission: value("fixedAgencyCommission") ? numeric("fixedAgencyCommission") : undefined, active: value("active") === "true" };
    const success = await mutateStore((draft) => {
      const index = draft.managedOffers.findIndex((item) => item.id === offer.id);
      if (index >= 0) draft.managedOffers[index] = offer; else draft.managedOffers.push(offer);
    }, "Offerta salvata.");
    if (success) { reset(); form.reset(); }
  }
  const offers = store.managedOffers.filter((offer) => `${offer.offerEasy} ${offer.code}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    {canManage && <section className="panel"><div className="panel-heading"><h2>{editing ? "Modifica offerta" : "Aggiungi offerta"}</h2><Tags /></div>
      <p className="muted-text">Luce: prezzo fisso in €/kWh oppure PUN + spread. Gas: prezzo fisso in €/Smc oppure PSV + spread. PCV mensile; oneri e perdite seguono le impostazioni del preventivatore.</p>
      <form key={editing?.id ?? "new"} className="form-grid compact" onSubmit={(event) => void submit(event)}>
        <label>Nome offerta<input name="offerEasy" required defaultValue={editing?.offerEasy} /></label><label>Codice offerta<input name="code" required defaultValue={editing?.code} /></label>
        <label>Fornitura<select value={commodity} onChange={(event) => setCommodity(event.target.value)}><option value="luce">Luce</option><option value="gas">Gas</option></select></label>
        <label>Cliente<select name="customerType" defaultValue={editing?.customerType ?? "RES"}><option value="RES">Residenziale</option><option value="BUS">Business</option></select></label>
        <label>Tipo prezzo<select value={pricing} onChange={(event) => setPricing(event.target.value)}><option value="variable">Variabile ({commodity === "luce" ? "PUN" : "PSV"} + spread)</option><option value="fixed">Fisso</option></select></label>
        <label>{pricing === "fixed" ? "Prezzo fisso" : "Spread"} ({commodity === "luce" ? "€/kWh" : "€/Smc"})<input name={pricing === "fixed" ? "fixedPrice" : "spread"} type="number" min="0" step="0.000001" required defaultValue={pricing === "fixed" ? editing?.fixedPrice : editing?.spread} key={`${editing?.id}-${pricing}`} /></label>
        <label>PCV (€/mese)<input name="pcv" type="number" min="0" step="0.01" required defaultValue={editing?.pcv} /></label>
        <label>Stato<select name="active" defaultValue={String(editing?.active ?? true)}><option value="true">Attiva</option><option value="false">Disattiva</option></select></label>
        <label>Quota agenzia (%)<input name="commissionRate" type="number" min="0" max="100" step="0.01" required defaultValue={(editing?.commissionRate ?? 0.3) * 100} /></label>
        <label>Soglia spread provvigionale ({commodity === "luce" ? "€/kWh" : "€/Smc"})<input key={commodity} name="commissionBaseSpread" type="number" min="0" step="0.000001" required defaultValue={editing?.commissionBaseSpread ?? (commodity === "luce" ? 0.006 : 0.06)} /></label>
        <label>Provvigione annua fissa agenzia (€; facoltativa)<input name="fixedAgencyCommission" type="number" min="0" step="0.01" defaultValue={editing?.fixedAgencyCommission} /></label>
        <p className="muted-text wide-field">La provvigione fissa, se inserita, sostituisce la formula su PCV e spread. Per le offerte fisse, senza questo importo, la quota agenzia si applica alla PCV.</p>
        {error && <p role="alert">{error}</p>}<button className="primary-button" type="submit">Salva offerta</button>{editing && <button className="secondary-button" type="button" onClick={reset}>Annulla</button>}
      </form></section>}
    <section className="table-section operations-table"><h2>Offerte ({offers.length})</h2><label>Cerca offerta<input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="table-wrap"><table><thead><tr><th>Offerta / codice</th><th>Fornitura</th><th>Cliente</th><th>Tipo</th><th>Prezzo / spread</th><th>PCV mensile</th><th>Stato</th>{canManage && <th>Azioni</th>}</tr></thead><tbody>
        {offers.map((offer) => <tr key={offer.id}><td>{offer.offerEasy}<small className="offer-code">{offer.code}</small></td><td>{offer.commodity}</td><td>{offer.customerType}</td><td>{offer.pricingType === "fixed" ? "Fisso" : `${offer.commodity === "luce" ? "PUN" : "PSV"} + spread`}</td><td>{offer.pricingType === "fixed" ? offer.fixedPrice : offer.spread} {offer.commodity === "luce" ? "€/kWh" : "€/Smc"}</td><td>{formatEuro(offer.pcv)}</td><td>{offer.active ? "Attiva" : "Disattiva"}</td>{canManage && <td><div className="operations-actions"><button className="secondary-button" onClick={() => { setEditing(offer); setPricing(offer.pricingType ?? "variable"); setCommodity(offer.commodity); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Modifica</button><button className="secondary-button" onClick={() => void mutateStore((draft) => { const item = draft.managedOffers.find((item) => item.id === offer.id); if (item) item.active = !item.active; }, offer.active ? "Offerta disattivata." : "Offerta attivata.")}>{offer.active ? "Disattiva" : "Attiva"}</button></div></td>}</tr>)}
        {!offers.length && <tr><td colSpan={canManage ? 8 : 7} className="empty-state">Nessuna offerta trovata.</td></tr>}
      </tbody></table></div></section>
  </>;
}

export function PaymentGateBadge({ sourceId, store, date, forecasts }: { sourceId: string; store: StoreData; date: string; forecasts: { sourceId: string; monthKey: string; amount: number }[] }) {
  const gate = paymentGate(sourceId, store.commissionEntries, store.commissionPayments, date);
  if (!gate) return null;
  const forecastUntilDue = forecasts.filter((entry) => entry.sourceId === sourceId && entry.monthKey > date.slice(0, 7) && entry.monthKey <= gate.dueDate.slice(0, 7)).reduce((sum, entry) => sum + entry.amount, 0);
  return <span className={`payment-gate ${gate.overdue ? "due" : "pending"}`}>
    <button type="button" className="payment-gate-trigger" aria-describedby={`payment-gate-${sourceId}`} aria-label={`Pagamento trimestrale ${gate.overdue ? "in scadenza" : "previsto"} il ${formatDate(gate.dueDate)}`}><BadgeEuro size={18} /></button>
    <span id={`payment-gate-${sourceId}`} className="payment-gate-tooltip" role="tooltip"><strong>{gate.overdue ? "Pagamento trimestrale da verificare" : "Prossimo pagamento trimestrale"}</strong>
      <span>Ultimo pagamento: {formatDate(gate.latestPayment)}</span><span>Scadenza: {formatDate(gate.dueDate)}</span><small>Mesi successivi all’ultimo pagamento:</small>
      {gate.monthly.map(({ month, amount }) => { const forecast = forecasts.filter((entry) => entry.sourceId === sourceId && entry.monthKey === month && month > date.slice(0, 7)).reduce((sum, entry) => sum + entry.amount, 0);
        return <span key={month}>{month}: {formatEuro(amount)} maturati{forecast > 0 ? ` · ${formatEuro(forecast)} previsti` : ""}</span>; })}
      <span>Totale maturato nei tre mesi: {formatEuro(gate.monthly.reduce((sum, row) => sum + row.amount, 0))}</span>
      <span>Totale previsto nei tre mesi: {formatEuro(forecasts.filter((entry) => entry.sourceId === sourceId && gate.months.includes(entry.monthKey) && entry.monthKey > date.slice(0, 7)).reduce((sum, entry) => sum + entry.amount, 0))}</span>
      <strong>Saldo da pagare oggi: {formatEuro(gate.balance)}</strong>
      {!gate.overdue && <strong>Saldo previsto alla scadenza: {formatEuro(gate.balance + forecastUntilDue)}</strong>}<small>Saldo complessivo maturato meno pagamenti, inclusi eventuali arretrati. Le previsioni non sono ancora da pagare.</small>
    </span>
  </span>;
}
