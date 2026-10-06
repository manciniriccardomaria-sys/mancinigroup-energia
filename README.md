# Gestionale Energia Mancini Service

Gestionale web per la parte energia di Mancini Service, pubblicabile su GitHub Pages.

## Primo MVP

- Login con ruoli `admin`, `frontline`, `collaboratore` e `operativo`.
- Home operativa con upload file e pulsante preventivatore.
- Inserimento diretto di cliente e numero `POD/PDR` in pagina dedicata.
- Pagine dedicate per clienti, fonti, provvigioni e regole provvigionali.
- Pagina admin `Utenti` per creare accessi reali e collegarli alle fonti.
- Assegnazione obbligatoria alla `Fonte`.
- Fonti modificabili per tipo: `Collaboratore`, `Frontline`, `Sede MG`.
- Sedi gia presenti: `MG Corso`, `MG Berlinguer`, `MG Terlizzi`.
- Provvigioni modellate come maturato, pagato manuale e da pagare.
- Regole provvigionali versionate con data di validita.
- Andamento mese per mese di luce/gas, in validazione, bloccati e usciti.
- Nessuna dipendenza dal foglio `Preventivi`.
- Nessuna logica legata a `Distribuzione Provvigioni 2025`.

## Credenziali locali

In sviluppo (`pnpm dev`) e attivo un fallback locale con `.env.local`.

| Ruolo | Email | Password |
| --- | --- | --- |
| Admin | `manciniriccardomaria@gmail.com` | qualsiasi password non vuota in sviluppo |

## Avvio

```bash
pnpm install
pnpm dev
```

In produzione configurare:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mancinigroup-energia.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mancinigroup-energia
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mancinigroup-energia.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=235122307355
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

La copia locale `.env.production.local` e ignorata da git e contiene la service account solo per gli script di seed/backup.
Non usare la service account nel deploy GitHub Pages.

Comandi utili:

```bash
pnpm firebase:login
pnpm firebase:deploy-rules
pnpm firebase:push-store -- --yes
pnpm firebase:backup
pnpm firebase:sync-access
pnpm build:pages
```

Per creare un accesso collaboratore completo (Firebase Auth, profilo gestionale e permessi sulla propria fonte):

```bash
pnpm firebase:create-user -- --email=nome@example.com --password='PasswordSicura' --name='Nome Cognome' --role=agent --sourceId=src_nome
```

Il valore interno `agent` resta invariato per compatibilita con i dati storici, ma nell'interfaccia e mostrato come `Collaboratore`.

## Dati

In sviluppo i dati vengono salvati in `localStorage`.
In produzione dati operativi e import finiscono in Firestore sotto `appData/{sezione}/items/{id}`.
I profili autorizzativi sono salvati in `appAccess/{firebaseUid}`; collaboratori e frontline possono leggere soltanto clienti, caricamenti, provvigioni personali e forecast collegati alla propria fonte. Le vecchie righe annuali senza mese/POD e i margini dell'agenzia non vengono esposti nei portali personali.

Gli upload vengono letti dal browser, importati subito e poi non conservati come file originale: restano metadati, righe importate, match, totali e storico upload.

La spiegazione funzionale e in `docs/COME_FUNZIONA.md`.
La checklist di go-live e in `docs/GO_LIVE.md`.

## Preventivi, ticket, offerte e pagamenti trimestrali

- **Preventivi salvati**: ricerca, filtro luce/gas, dettaglio, stampa e creazione di un nuovo preventivo dai dati archiviati. I nuovi preventivi conservano il calcolo originale; quelli storici mostrano i valori già salvati.
- **Ticket clienti**: nome, cognome, POD/PDR, data apertura, problematica e stato (Aperta inizialmente, In lavorazione, Risolta, Chiusa). È possibile modificare i ticket e filtrarli per stato. I profili personali vedono soltanto i ticket della propria fonte.
- **Offerte**: admin e operativo possono aggiungere/modificare/attivare/disattivare tariffe. Il preventivatore usa solo offerte attive della fornitura e tipologia cliente selezionate. Prezzi fissi in €/kWh (luce) o €/Smc (gas); variabili PUN/PSV + spread, con PCV mensile e parametri provvigionali. Le condizioni iniziali del preventivatore sono mantenute come catalogo predefinito, con modifiche persistenti in `managedOffers`.
- **Provvigioni**: l’icona accanto alla fonte compare dal primo pagamento positivo registrato. Passando il mouse, mettendola a fuoco o toccandola si vedono ultimo pagamento, scadenza a tre mesi di calendario (fine mese adattato), i tre mesi successivi al mese pagato e il saldo attuale. Il saldo comprende eventuali arretrati e sottrae i pagamenti effettivi; forecast e maturato restano distinti. Ogni nuovo pagamento sposta la scadenza. Le righe senza mese completo e i pagamenti futuri sono esclusi.

Verifica funzionale: `node scripts/test-operations.cjs`. Prima di distribuire questa versione pubblicare anche le regole Firestore aggiornate, che autorizzano le raccolte `customerTickets` e `managedOffers`.
