import { readFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseServiceAccount, loadProductionEnv } from "./firebase-env.mjs";
import { writeFirestoreCollections } from "./firestore-collections.mjs";

const shouldWrite = process.argv.includes("--yes");
const storePath = process.argv.find((arg) => arg.startsWith("--store="))?.slice("--store=".length) ?? "data/store.json";

if (!shouldWrite) {
  console.error("Operazione annullata: aggiungi --yes per scrivere lo store su Firestore.");
  process.exit(1);
}

await loadProductionEnv();

const serviceAccount = firebaseServiceAccount();
const raw = await readFile(storePath, "utf8");
const store = JSON.parse(raw);

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const writeCount = await writeFirestoreCollections(getFirestore(), JSON.parse(JSON.stringify(store)));

console.log(`Store caricato su Firestore: ${serviceAccount.projectId}/appData (${writeCount} scritture)`);
