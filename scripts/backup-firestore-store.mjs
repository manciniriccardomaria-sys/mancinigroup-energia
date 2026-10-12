import { mkdir, writeFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseServiceAccount, loadProductionEnv } from "./firebase-env.mjs";
import { readFirestoreCollections } from "./firestore-collections.mjs";

await loadProductionEnv();

const serviceAccount = firebaseServiceAccount();

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();
const { store, totalRecords } = await readFirestoreCollections(db);

if (totalRecords === 0) {
  throw new Error("Store Firestore vuoto: esegui prima il seed iniziale.");
}

await mkdir("backups", { recursive: true });

// Bill payloads are kept outside the main store so ordinary page loads only
// fetch their metadata. Include the payloads in the backup for recovery.
const billManifests = await db.collection("quoteBillFiles").get();
const quoteBillFiles = [];
for (const manifest of billManifests.docs) {
  const chunks = await manifest.ref.collection("chunks").get();
  quoteBillFiles.push({ ...manifest.data(), chunks: chunks.docs.map((chunk) => ({ id: chunk.id, ...chunk.data() })) });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = `backups/firestore-store-${stamp}.json`;

await writeFile(outputPath, `${JSON.stringify({ ...store, quoteBillFiles }, null, 2)}\n`, "utf8");
console.log(`Backup Firestore salvato in ${outputPath}`);
