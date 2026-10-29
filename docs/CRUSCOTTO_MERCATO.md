# Cruscotto informativo del mercato energia

Il cruscotto mostra un prezzo luce e un prezzo gas, con data del dato, acquisizione e fonte. Nessuna AI partecipa all'aggiornamento. `marketSnapshots/gme` è separato da `appData/marketVariables/items`: il preventivatore legge soltanto le medie mensili manuali. Il cruscotto appare in Home e nel preventivatore, senza entrare nella stampa del preventivo.

## Fonte e significato

Implementazione secondo la [guida tecnica API GME](https://gme.mercatoelettrico.org/Portals/0/Documents/it-IT/20251015Manuale_tecnico_API.pdf), sezioni 1–3, 5.14 e 5.52.

- Luce: `ME_ZonalPrices`, segmento MGP, zona PUN, granularità PT60. Si usa la media aritmetica della giornata completa più recente, con data di consegna non successiva a oggi in Europe/Rome. Il prezzo in €/MWh è diviso per 1.000. Si gestiscono giornate di 23/24/25 ore; dati incompleti e prezzi di altre zone sono esclusi.
- Gas: `GAS_ContinuousTrading`, segmento MGP-GAS, campo AveragePrice, conversione €/MWh × 0,0107 al PCS di riferimento di 0,03852 GJ/Smc. Si mostra il prodotto e la sua data di flusso. Se GME restituisce più prodotti per la stessa data, il processo richiede la scelta esplicita di `GME_GAS_PRODUCT`, da confermare con GME. Nessuna media artificiale di prodotti sovrapposti.

Questo gas è MGP-GAS, non il PSV mensile del preventivatore. Non si mostrano valori sintetici, né si copiano i valori manuali nei riquadri in assenza di accesso.

## Attivazione

Il 29 ottobre 2026 è stata inviata tramite Gmail una richiesta a SupportoAPI@mercatoelettrico.org (oggetto: “Accesso API e autorizzazione per cruscotto informativo interno — Mancini Group”). La richiesta riguarda credenziali, licenza aziendale, costi, serie e quote. Non sono state accettate condizioni o spese. Non è stato sottoscritto il modulo societario, che richiede dichiarazioni e firma del rappresentante.

L'integrazione è preparata ma la risposta reale non è ancora stata verificata: mancano le credenziali e l'autorizzazione. Il processo è disattivato finché la variabile repository GME_ENABLED non è true. Dopo l'abilitazione verificare i payload reali e confrontare i due prezzi con le pagine GME prima di considerare concluso il collaudo.

Configurazione GitHub Actions:

- Secrets GME_LOGIN e GME_PASSWORD.
- Secret FIREBASE_MARKET_SERVICE_ACCOUNT_JSON: service account dedicato, con permessi minimi necessari alla scrittura Firestore. Mai credenziali nel frontend o nel repository.
- Variabile GME_GAS_PRODUCT se necessaria.
- Variabile GME_ENABLED=true solo dopo l'autorizzazione per l'uso previsto.

Pubblicare le regole Firestore aggiornate prima dell'interfaccia: solo utenti attivi possono leggere il singolo documento; dal browser non sono consentite scritture. Non modificare le raccolte del preventivatore per alimentare il cruscotto.

La workflow `.github/workflows/sync-market-prices.yml` esegue il codice ogni quattro ore (al minuto 17, UTC); gli orari GitHub possono subire ritardi. Disponibile anche l'avvio manuale. Non vengono creati task o automazioni della chat. La UI riceve gli aggiornamenti Firestore e segnala dati acquisiti da più di sei ore, dati di riferimento vecchi o l'errore dell'ultimo aggiornamento; conserva sempre l'ultimo prezzo valido.

In locale: configurare le credenziali server e GME_USAGE_AUTHORIZED=true, poi `pnpm market:sync`. Controlli: `pnpm test:market-prices`, `pnpm test:met`, `pnpm typecheck`, `pnpm lint`, `pnpm build:pages`. I test del connettore usano risposte simulate: non provano l'accesso GME reale.
