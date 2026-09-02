import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseServiceAccount, loadProductionEnv } from "./firebase-env.mjs";

const TARGET_FILE = "Export Caricamenti al 31-08-2026.csv";
const shouldWrite = process.argv.includes("--yes");

function correctedStartDate(value) {
  const match = value?.match(/^(\d{4})-01-(0[2-9]|1[0-2])$/);
  return match ? `${match[1]}-${match[2]}-01` : null;
}

await loadProductionEnv();

if (getApps().length === 0) {
  initializeApp({ credential: cert(firebaseServiceAccount()) });
}

const firestore = getFirestore();
const uploadsSnapshot = await firestore
  .collection("appData")
  .doc("uploadedFiles")
  .collection("items")
  .where("originalName", "==", TARGET_FILE)
  .get();
const uploadIds = new Set(uploadsSnapshot.docs.map((snapshot) => snapshot.id));

if (uploadIds.size === 0) {
  throw new Error(`Nessun upload trovato per ${TARGET_FILE}.`);
}

const loadingSnapshot = await firestore
  .collection("appData")
  .doc("loadingRecords")
  .collection("items")
  .get();
const corrections = loadingSnapshot.docs.flatMap((snapshot) => {
  const value = snapshot.data();
  const startDate = uploadIds.has(value.uploadedFileId)
    ? correctedStartDate(value.startDate)
    : null;

  return startDate && startDate !== value.startDate
    ? [{ snapshot, previousStartDate: value.startDate, startDate }]
    : [];
});

const summary = new Map();
for (const correction of corrections) {
  const key = `${correction.previousStartDate} -> ${correction.startDate}`;
  summary.set(key, (summary.get(key) ?? 0) + 1);
}

console.log(`Correzioni individuate: ${corrections.length}`);
for (const [mapping, count] of [...summary].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${mapping}: ${count}`);
}

if (!shouldWrite) {
  console.log("Anteprima completata. Ripeti con --yes per applicare le correzioni.");
  process.exit(0);
}

for (let index = 0; index < corrections.length; index += 450) {
  const batch = firestore.batch();

  for (const correction of corrections.slice(index, index + 450)) {
    batch.update(correction.snapshot.ref, { startDate: correction.startDate });
  }

  await batch.commit();
}

console.log(`Correzioni applicate: ${corrections.length}`);
