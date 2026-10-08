// Dry run by default. --apply creates only missing MET offers, leaving overrides intact.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { isDeepStrictEqual } = require('node:util');
const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, filename);
};
const { defaultQuoteOffers } = require('../src/lib/offers.ts');
async function main() {
  const { loadProductionEnv, firebaseServiceAccount } = await import('./firebase-env.mjs');
  await loadProductionEnv();
  initializeApp({ credential: cert(firebaseServiceAccount()) });
  const db = getFirestore();
  const collection = db.collection('appData').doc('managedOffers').collection('items');
  const snapshot = await collection.get();
  const existing = new Map(snapshot.docs.map(doc => [doc.data().code, doc]));
  const catalog = JSON.parse(JSON.stringify(defaultQuoteOffers().filter(offer => offer.supplier === 'MET')));
  const additions = catalog.filter(offer => !existing.has(offer.code));
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', total: catalog.length, additions: additions.length, existingPreserved: catalog.length - additions.length, offers: additions.map(offer => ({ code: offer.code, name: offer.offerEasy, requiresBands: !!offer.requiresBands, commissionConfirmed: offer.met.commissionFixed !== undefined })) }, null, 2));
  if (!process.argv.includes('--apply') || !additions.length) return;
  const backupDirectory = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(backupDirectory, `managed-offers-before-met-${timestamp}.json`), JSON.stringify(snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })), null, 2));
  const batch = db.batch();
  for (const offer of additions) batch.create(collection.doc(offer.id), offer);
  await batch.commit();
  const verified = await collection.get();
  for (const offer of additions) {
    const saved = verified.docs.find(doc => doc.id === offer.id)?.data();
    if (!isDeepStrictEqual(saved, offer)) {
      throw new Error(`Verifica fallita: ${offer.code}`);
    }
  }
  console.log(`Caricate e verificate ${additions.length} offerte MET; conservate ${snapshot.size} offerte preesistenti.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
