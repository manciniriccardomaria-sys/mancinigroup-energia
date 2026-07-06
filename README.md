# Gestionale Energia Mancini Service

Gestionale web per la parte energia di Mancini Service, pubblicabile su GitHub Pages.

## Primo MVP

- Login con ruoli `admin`, `frontline`, `agente`.
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
pnpm build:pages
```

## Dati

In sviluppo i dati vengono salvati in `localStorage`.
In produzione dati operativi e import finiscono in Firestore sotto `appData/{sezione}/items/{id}`.

Gli upload vengono letti dal browser, importati subito e poi non conservati come file originale: restano metadati, righe importate, match, totali e storico upload.

La spiegazione funzionale e in `docs/COME_FUNZIONA.md`.
La checklist di go-live e in `docs/GO_LIVE.md`.
