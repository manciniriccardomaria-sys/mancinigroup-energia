import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { loadProductionEnv, firebaseServiceAccount } from './firebase-env.mjs';
import { fetchGmeMarkets, mergeMarketResults } from './gme-market-client.mjs';

// This script writes ONLY marketSnapshots/gme. No quote input or saved quote is touched.
async function main() {
  await loadProductionEnv();
  if (process.env.GME_USAGE_AUTHORIZED !== 'true') throw new Error('Attivazione in attesa di autorizzazione GME.');
  if (!process.env.GME_LOGIN || !process.env.GME_PASSWORD) throw new Error('Credenziali GME mancanti.');
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) : firebaseServiceAccount();
  if ((credentials.projectId ?? credentials.project_id) !== 'mancinigroup-energia') throw new Error('Progetto Firebase inatteso.');
  initializeApp({ credential: cert(credentials) });
  const db = getFirestore();
  const ref = db.doc('marketSnapshots/gme');
  const now = new Date();
  let results;
  try {
    results = await fetchGmeMarkets({ login: process.env.GME_LOGIN, password: process.env.GME_PASSWORD,
      product: process.env.GME_GAS_PRODUCT || undefined, now });
  } catch {
    results = { electricity: { error: 'Servizio GME non disponibile.' }, gas: { error: 'Servizio GME non disponibile.' } };
  }
  const state = await db.runTransaction(async transaction => {
    const prior = await transaction.get(ref);
    // Reject late-running jobs rather than overwriting a more recent attempt.
    if (prior.data()?.lastAttemptAt > now.toISOString()) return 'superseded';
    const next = mergeMarketResults(prior.data(), results, now);
    transaction.set(ref, next);
    return next.state;
  });
  console.log(`Cruscotto GME: ${state}.`);
  for (const market of ['electricity', 'gas']) if (results[market]?.error) console.error(`${market}: ${results[market].error}`);
  if (state === 'error' || state === 'partial') process.exitCode = 1;
}

main().catch(() => { console.error('Sincronizzazione GME non completata: verificare autorizzazione, configurazione e disponibilita del servizio.'); process.exitCode = 1; });
