"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Flame, Zap } from "lucide-react";
import { firebaseDb, hasFirebaseClientConfig } from "@/lib/firebase-client";
import { manualMarketSnapshot, marketSnapshotForDisplay } from "@/lib/market-manual-snapshot";
import { formatDate, formatDateTime } from "@/lib/normalize";
import { MARKET_SNAPSHOT_PATH, MARKET_SOURCES, parseMarketSnapshot, quoteIsOld, type MarketSnapshot } from "@/lib/market-snapshot";

export function MarketPricesPanel() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(manualMarketSnapshot);
  const [unavailable, setUnavailable] = useState(false);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    if (!hasFirebaseClientConfig()) return;
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    const unsubscribe = onSnapshot(doc(firebaseDb(), MARKET_SNAPSHOT_PATH), result => {
      const parsed = parseMarketSnapshot(result.data());
      setSnapshot(marketSnapshotForDisplay(parsed));
      setUnavailable(result.exists() && !parsed);
      setClock(Date.now());
    }, () => setUnavailable(true));
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, []);

  return <section className="market-prices-panel print-hidden" aria-label="Prezzi attuali del mercato energia">
    <div className="market-prices-grid">
      {(["electricity", "gas"] as const).map(market => {
        const quote = snapshot?.[market];
        const light = market === "electricity";
        const manual = quote?.acquisition === "manual";
        const details = quote ? `${light ? "Media giornaliera" : "Prezzo di riferimento"} · ${quote.originalEuroMwh} €/MWh${quote.product ? ` · ${quote.product}` : ""}${quote.sessionDate ? ` · sessione ${formatDate(quote.sessionDate)}` : ""} · Acquisito il ${formatDateTime(quote.fetchedAt)}${light ? "" : " · PCS 0,03852 GJ/Smc"}` : undefined;
        const old = Boolean(quote && (quoteIsOld(quote, clock) || (!manual && (unavailable || snapshot?.[`${market}State`] === "error"))));
        return <article className={`market-price-card ${light ? "" : "gas"}`} key={market}>
          <div className="market-price-main" title={details}>
          <div className="market-price-title">{light ? <Zap size={17} /> : <Flame size={17} />}<h3>{light ? "PUN Index GME" : "Gas MGP-GAS"}</h3></div>
          <p className="market-price-value">{quote ? new Intl.NumberFormat("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(quote.value) : "—"}<span>{light ? "€/kWh" : "€/Smc"}</span></p>
          </div>
          <div className="market-price-meta">
            {quote ? <><span title={details}>Al {formatDate(quote.referenceDate)}</span>{manual && <span>Rilevazione manuale</span>}</> : <span role="status">{unavailable || (snapshot?.state === "error" || snapshot?.state === "partial") ? "Dato non disponibile" : "In attesa di attivazione"}</span>}
            <a href={MARKET_SOURCES[market]} title="Fonte: Gestore dei Mercati Energetici S.p.A." target="_blank" rel="noopener noreferrer">Fonte GME</a>
          </div>
          {old && <p className="market-price-status" role="status">Ultimo dato disponibile · aggiornamento in attesa</p>}
        </article>;
      })}
    </div>
    <p className="muted-text">Solo consultazione · I preventivi usano le medie mensili manuali.</p>
  </section>;
}
