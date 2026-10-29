"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Flame, Zap } from "lucide-react";
import { firebaseDb, hasFirebaseClientConfig } from "@/lib/firebase-client";
import { formatDate, formatDateTime } from "@/lib/normalize";
import { MARKET_SNAPSHOT_PATH, MARKET_SOURCES, parseMarketSnapshot, quoteIsOld, type MarketSnapshot } from "@/lib/market-snapshot";

export function MarketPricesPanel() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>();
  const [unavailable, setUnavailable] = useState(false);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    if (!hasFirebaseClientConfig()) return;
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    const unsubscribe = onSnapshot(doc(firebaseDb(), MARKET_SNAPSHOT_PATH), result => {
      const parsed = parseMarketSnapshot(result.data());
      setSnapshot(parsed);
      setUnavailable(result.exists() && !parsed);
      setClock(Date.now());
    }, () => setUnavailable(true));
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, []);

  return <section className="market-prices-panel print-hidden" aria-label="Prezzi attuali del mercato energia">
    <div className="section-heading">
      <div><p className="eyebrow">Mercato energia</p><h2>Prezzi di riferimento</h2></div>
      <span className="market-info-label">Solo consultazione</span>
    </div>
    <div className="market-prices-grid">
      {(["electricity", "gas"] as const).map(market => {
        const quote = snapshot?.[market];
        const light = market === "electricity";
        const old = Boolean(quote && (quoteIsOld(quote, clock) || unavailable || snapshot?.[`${market}State`] === "error"));
        return <article className={`market-price-card ${light ? "" : "gas"}`} key={market}>
          <div className="panel-heading"><h3>{light ? "PUN Index GME" : "Gas MGP-GAS"}</h3>{light ? <Zap size={22} /> : <Flame size={22} />}</div>
          <p className="market-price-value">{quote ? new Intl.NumberFormat("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(quote.value) : "—"}<span>{light ? "€/kWh" : "€/Smc"}</span></p>
          {quote ? <>
            <p>{light ? "Media giornaliera" : "Prezzo di riferimento"} del <strong>{formatDate(quote.referenceDate)}</strong>{quote.product ? ` · ${quote.product}` : ""}</p>
            <p className="muted-text">Acquisito il {formatDateTime(quote.fetchedAt)}</p>
            {old && <p className="market-price-status" role="status">Ultimo dato disponibile · aggiornamento in attesa</p>}
          </> : <p className="muted-text" role="status">{unavailable || (snapshot?.state === "error" || snapshot?.state === "partial") ? "Quotazione al momento non disponibile." : "Dati in attesa di attivazione."}</p>}
          <a href={MARKET_SOURCES[market]} target="_blank" rel="noopener noreferrer">Fonte: Gestore dei Mercati Energetici S.p.A.</a>
          {!light && <small>Conversione con PCS di riferimento 0,03852 GJ/Smc.</small>}
        </article>;
      })}
    </div>
    <p className="muted-text">Quotazioni informative. I preventivi usano esclusivamente le medie mensili inserite manualmente.</p>
  </section>;
}
