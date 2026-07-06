# Go-live Gestionale Energia

## Scelta deploy

Il gestionale viene esportato come sito statico Next.js e pubblicato su GitHub Pages con dominio:

```text
energia.mancinigroup.org
```

In produzione non usa Server Actions, cookie server o Firebase Admin SDK nel browser. La app parla direttamente con Firebase dal client usando Firebase Auth e Firestore.

## Stato Firebase

- Progetto creato: `mancinigroup-energia`.
- Project number: `235122307355`.
- Web app creata: `energia-web`.
- Firebase config web pronta per le variabili `NEXT_PUBLIC_FIREBASE_*`.
- Service account creato: `gestionale-energia-app@mancinigroup-energia.iam.gserviceaccount.com`.
- Credenziali service account salvate solo in `.env.production.local`, ignorato da git.
- Firestore API e Datastore API abilitate.
- Firestore database da creare nel piano gratuito Spark, senza PITR o backup automatici avanzati.

## Creazione Firestore gratuita

Eseguire:

```bash
pnpm exec firebase firestore:databases:create '(default)' \
  --project mancinigroup-energia \
  --location eur3 \
  --edition standard

pnpm firebase:deploy-rules -- --project mancinigroup-energia
pnpm firebase:push-store -- --yes
pnpm firebase:backup
```

Se Google chiede billing durante la creazione, controllare di non aver attivato funzioni come PITR, backup schedulati o database aggiuntivi. Il primo database Firestore del progetto puo usare quota gratuita; le funzioni di disaster recovery avanzate richiedono billing.

Lo store viene salvato in collezioni Firestore separate sotto:

```text
appData/{sezione}/items/{id}
```

## Firebase Auth

In Firebase Console:

1. Aprire `Authentication`.
2. Abilitare provider `Email/Password`.
3. Creare l'utente admin:

```text
manciniriccardomaria@gmail.com
```

La password va impostata in Firebase Auth. Nel codice pubblico non deve esistere nessuna password di produzione.

In alternativa, dopo aver abilitato Auth e creato Firestore, usare lo script locale:

```bash
pnpm firebase:create-user -- \
  --email=manciniriccardomaria@gmail.com \
  --password='PASSWORD_DA_FIREBASE_AUTH' \
  --name='Riccardo Mancini' \
  --role=admin
```

## GitHub Pages

Nel repository GitHub:

1. `Settings -> Pages`.
2. Source: `GitHub Actions`.
3. Custom domain: `energia.mancinigroup.org`.
4. Enforce HTTPS attivo appena disponibile.

Nel DNS del dominio creare il record:

```text
energia CNAME <utente-o-organizzazione-github>.github.io
```

Il file `public/CNAME` e lo script `scripts/prepare-github-pages.mjs` scrivono gia `energia.mancinigroup.org` nell'artifact.

## GitHub Secrets

In `Settings -> Secrets and variables -> Actions` inserire:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mancinigroup-energia.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mancinigroup-energia
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mancinigroup-energia.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=235122307355
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Queste sono chiavi web Firebase pubbliche. Non inserire mai `FIREBASE_PRIVATE_KEY` o service account nei secret usati dalla build Pages.

## Test reale maggio 2026

File usati:

- `Export Caricamenti al 30-06-2026.xlsx`.
- `PROV_LUCE_MAGGIO26.csv`.
- `PROV_GAS_MAGGIO26.csv`.
- Google Sheet `Caricamenti_Totale`, tab `Memoria Fonte POD`.

Risultato:

- Pre-associazioni importate da `Memoria Fonte POD`: 273.
- Righe memoria saltate senza fonte valida: 20.
- Nuova fonte aggiunta da memoria: `Michele`.
- Righe provvigioni maggio 2026: 385.
- Righe abbinate a fonte: 361.
- Righe da abbinare: 24.
- Provvigioni agenzia maggio 2026: 2.242,20 euro.
- Provvigioni fonte generate: 2.449,40 euro.
- Righe in maturazione: 93.
- Righe anticipate: 96.
- Righe con regola mancante: 3.

Prima del go-live operativo bisogna controllare le 24 righe da abbinare e le 3 con regola mancante.

## Build locale

```bash
pnpm lint
pnpm typecheck
pnpm build:pages
```

L'output statico viene creato in `out/` e non va versionato.
