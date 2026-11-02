"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Phone, Upload } from "lucide-react";
import { addCalendarMonths } from "@/lib/payment-gate";
import { formatDate, formatDateTime } from "@/lib/normalize";
import { effectiveCallDate, energyCallCalendarDates, energyCallStatuses, isOpenEnergyCall, italyDate, mergeEnergyCalls, parseEnergyCallReport, shiftCallDay, updateEnergyCall, type EnergyCallReport } from "@/lib/energy-calls";
import type { EnergyCall, EnergyCallStatus, SessionUser, StoreData } from "@/lib/types";

type Props = { store: StoreData; user: SessionUser; mutateStore: (change: (draft: StoreData) => void, message: string) => Promise<boolean> };
const displayDay = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("it-IT", { ...options, timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));

export function EnergyCallCalendar({ store, user, mutateStore }: Props) {
  const today = italyDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("tutti");
  const [source, setSource] = useState("");
  const [showConverted, setShowConverted] = useState(false);
  const [report, setReport] = useState<EnergyCallReport>();
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sources = [...new Set(store.energyCalls.map((call) => call.source))].filter(Boolean).sort();
  const calls = useMemo(() => store.energyCalls.filter((call) =>
    (!source || call.source === source) && (status === "tutti" || call.status === status) &&
    `${call.customerName} ${call.fiscalCode} ${call.phone} ${call.alternatePhone}`.toLocaleLowerCase("it").includes(search.trim().toLocaleLowerCase("it"))
  ), [store.energyCalls, source, status, search]);
  const counts = new Map<string, number>();
  for (const call of calls) for (const date of energyCallCalendarDates(call, today)) counts.set(date, (counts.get(date) ?? 0) + 1);
  const overdue = calls.filter((call) => isOpenEnergyCall(call) && effectiveCallDate(call) < today).length;
  const converted = calls.filter((call) => call.status === "contratto_attivato");
  const selectedCalls = (showConverted ? converted : calls.filter((call) => energyCallCalendarDates(call, today).includes(selectedDate)))
    .slice().sort((a, b) => effectiveCallDate(a).localeCompare(effectiveCallDate(b)) || a.customerName.localeCompare(b.customerName, "it"));
  const firstWeekday = (new Date(`${month}T12:00:00Z`).getUTCDay() + 6) % 7;
  const firstDay = shiftCallDay(month, -firstWeekday);
  const lastDay = shiftCallDay(addCalendarMonths(month, 1), -1);
  const dayCount = Math.ceil((firstWeekday + Number(lastDay.slice(8))) / 7) * 7;
  const days = Array.from({ length: dayCount }, (_, index) => shiftCallDay(firstDay, index));

  if (user.role !== "admin" && user.role !== "operativo") return null;

  function goToday() { setSelectedDate(today); setMonth(`${today.slice(0, 7)}-01`); setShowConverted(false); }

  async function readReport(file?: File) {
    setError(""); setReport(undefined); setFileName("");
    if (!file) return;
    setBusy(true);
    try {
      const parsed = parseEnergyCallReport(await file.arrayBuffer(), file.name);
      if (!parsed.calls.length) throw new Error("Nessun cliente con codice fiscale e data inizio rapporto validi.");
      setReport(parsed); setFileName(file.name);
    } catch (error) { setError(error instanceof Error ? error.message : "Lettura del file non riuscita."); }
    finally { setBusy(false); }
  }

  async function importReport() {
    if (!report) return;
    setBusy(true);
    try {
      const success = await mutateStore((draft) => { draft.energyCalls = mergeEnergyCalls(draft.energyCalls, report.calls); },
        `Report importato: ${report.calls.length} chiamate. Esiti, richiami e storico precedenti conservati.`);
      if (success) { setReport(undefined); setFileName(""); }
    } finally { setBusy(false); }
  }

  return <section className="panel energy-call-calendar">
    <div className="panel-heading"><div><h2><CalendarDays size={25} /> Calendario chiamate</h2>
      <p className="muted-text">Energia · Chiamata a due mesi dall’inizio rapporto. Sabato al venerdì, domenica al lunedì.</p></div>
      <span className="status-badge">{store.energyCalls.length} clienti</span></div>
    <details className="energy-call-import"><summary><Upload size={17} /> Importa / aggiorna report clienti</summary>
      <p className="muted-text">Usa il report con “Iniz. Rapp.” in colonna I. Ogni cliente genera una chiamata; gli aggiornamenti conservano esiti, note e richiami. I clienti assenti dal nuovo report restano nello storico.</p>
      <label>Report Excel<input type="file" accept=".xlsx,.xls" disabled={busy} onChange={(event) => void readReport(event.target.files?.[0])} /></label>
      {report && <div className="energy-call-preview"><strong>{fileName}</strong>
        <p>{report.totalRows} righe · {report.calls.length} chiamate · {report.skippedRows} righe non valide · {report.duplicateRows} duplicati · {report.missingPhones} senza telefono</p>
        <button className="primary-button" disabled={busy} onClick={() => void importReport()}>{busy ? "Importazione…" : "Importa chiamate"}</button></div>}
    </details>
    {error && <p className="alert error" role="alert">{error}</p>}
    <div className="energy-call-layout">
      <aside className="energy-call-sidebar">
        <div className="energy-call-month"><button className="icon-button" aria-label="Mese precedente" onClick={() => setMonth(addCalendarMonths(month, -1))}><ChevronLeft /></button>
          <h3>{displayDay(month, { month: "long", year: "numeric" })}</h3>
          <button className="icon-button" aria-label="Mese successivo" onClick={() => setMonth(addCalendarMonths(month, 1))}><ChevronRight /></button></div>
        <div className="energy-call-days" aria-label="Calendario mensile">
          {["L", "M", "M", "G", "V", "S", "D"].map((day, index) => <span className="energy-call-weekday" key={index}>{day}</span>)}
          {days.map((date) => <button key={date} type="button" className={`energy-call-day${date.slice(0, 7) !== month.slice(0, 7) ? " outside-month" : ""}${date === selectedDate && !showConverted ? " selected" : ""}${date === today ? " today" : ""}`}
            aria-label={`${displayDay(date, { day: "numeric", month: "long", year: "numeric" })}, ${counts.get(date) ?? 0} chiamate`}
            aria-pressed={date === selectedDate && !showConverted} onClick={() => { setSelectedDate(date); setShowConverted(false); }}>
            <span>{Number(date.slice(8))}</span>{counts.has(date) && <small>{counts.get(date)}</small>}</button>)}
        </div>
        <button className="secondary-button" onClick={goToday}>Vai a oggi</button>
        <button className="energy-call-summary overdue" onClick={goToday}><Clock3 size={21} /><span><strong>{overdue} arretrate</strong><small>Visibili selezionando oggi</small></span></button>
        <button className="energy-call-summary converted" onClick={() => setShowConverted((value) => !value)} aria-pressed={showConverted}><span><strong>{converted.length} contratti attivati</strong><small>Mostra la lista</small></span><ChevronRight size={20} /></button>
      </aside>
      <div className="energy-call-detail">
        <div className="energy-call-filters"><div><h3>{showConverted ? "Contratti attivati" : displayDay(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3><p className="muted-text">{selectedCalls.length} chiamate mostrate</p></div>
          <label>Cerca cliente<input type="search" placeholder="Nome, telefono o codice fiscale" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label>Esito<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="tutti">Tutti gli esiti</option>{Object.entries(energyCallStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Fonte<select value={source} onChange={(event) => setSource(event.target.value)}><option value="">Tutte le fonti</option>{sources.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <p className="muted-text energy-call-history-hint">Le chiamate restano nella data prevista e nelle date delle azioni registrate. I richiami compaiono anche nella nuova data; le chiamate ancora aperte e scadute sono visibili oggi.</p>
        {!selectedCalls.length && <div className="empty-state">{store.energyCalls.length ? "Nessuna chiamata per questa selezione." : "Importa il report clienti per popolare il calendario."}</div>}
        <div className="energy-call-list">{selectedCalls.map((call) => <EnergyCallCard key={call.id} call={call} today={today} user={user} mutateStore={mutateStore} />)}</div>
      </div>
    </div>
  </section>;
}

function EnergyCallCard({ call, today, user, mutateStore }: { call: EnergyCall; today: string } & Pick<Props, "user" | "mutateStore">) {
  const [status, setStatus] = useState(call.status);
  const [notes, setNotes] = useState(call.notes);
  const [callbackDate, setCallbackDate] = useState(call.callbackDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const overdue = isOpenEnergyCall(call) && effectiveCallDate(call) < today;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await mutateStore((draft) => updateEnergyCall(draft, user, call.id, status, notes, callbackDate), "Esito chiamata salvato.");
    } catch (error) { setError(error instanceof Error ? error.message : "Salvataggio non riuscito."); }
    finally { setSaving(false); }
  }
  return <article className={`energy-call-card${overdue ? " overdue" : ""}`}>
    <div className="energy-call-card-heading"><h3>{call.customerName}</h3><span className="status-badge">{energyCallStatuses[call.status]}</span>{overdue && <span className="energy-call-overdue-label">Arretrata · {formatDate(effectiveCallDate(call))}</span>}</div>
    <div className="energy-call-metadata"><span><strong>Data prevista:</strong> {formatDate(call.dueDate)}</span><span><strong>Inizio rapporto:</strong> {formatDate(call.relationshipStartDate)}</span><span><strong>Fonte:</strong> {call.source || "—"}</span>
      <span><strong>CF / P. IVA:</strong> {call.fiscalCode}</span>{call.relationshipEndDate && <span><strong>Fine rapporto:</strong> {formatDate(call.relationshipEndDate)}</span>}
      {call.status === "da_richiamare" && call.callbackDate && <span><strong>Richiamo:</strong> {formatDate(call.callbackDate)}</span>}</div>
    <div className="energy-call-phones">{[call.phone, call.alternatePhone].filter(Boolean).map((phone, index) => <a className="primary-button" href={`tel:${phone.replace(/[^+\d]/g, "")}`} key={index}><Phone size={18} /> {phone}</a>)}{!call.phone && <span className="muted-text">Telefono non presente nel report</span>}</div>
    <details className="energy-call-manage"><summary>Gestisci chiamata</summary>
      <form onSubmit={(event) => void submit(event)} className="form-grid compact">
        <label>Esito<select value={status} onChange={(event) => setStatus(event.target.value as EnergyCallStatus)}>{Object.entries(energyCallStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {status === "da_richiamare" && <label>Data richiamo<input type="date" min={today} required value={callbackDate} onChange={(event) => setCallbackDate(event.target.value)} /><small>Sabato anticipato al venerdì, domenica al lunedì.</small></label>}
        <label className="wide-field">Note<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {error && <p role="alert" className="alert error">{error}</p>}
        <button className="primary-button" disabled={saving} type="submit">{saving ? "Salvataggio…" : "Salva esito"}</button>
      </form>
    </details>
    {call.notes && <p className="energy-call-notes">{call.notes}</p>}
    {!!call.history.length && <details className="energy-call-history"><summary>Storico ({call.history.length})</summary><ol>{call.history.slice().reverse().map((action, index) => <li key={index}><strong>{energyCallStatuses[action.status]}</strong> · {formatDateTime(action.at)} · {action.by}{action.callbackDate && <> · Richiamo {formatDate(action.callbackDate)}</>}{action.notes && <p>{action.notes}</p>}</li>)}</ol></details>}
  </article>;
}
