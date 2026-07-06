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

const { store, totalRecords } = await readFirestoreCollections(getFirestore());

if (totalRecords === 0) {
  throw new Error("Store Firestore vuoto: esegui prima il seed iniziale.");
}

await mkdir("backups", { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = `backups/firestore-store-${stamp}.json`;

await writeFile(outputPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
console.log(`Backup Firestore salvato in ${outputPath}`);
