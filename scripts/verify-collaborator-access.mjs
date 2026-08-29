import { cert, getApps as getAdminApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from "firebase/firestore";
import { firebaseServiceAccount, loadProductionEnv } from "./firebase-env.mjs";

await loadProductionEnv();

const serviceAccount = firebaseServiceAccount();
if (getAdminApps().length === 0) {
  initializeAdminApp({ credential: cert(serviceAccount) });
}

const adminFirestore = getAdminFirestore();
const collaboratorSnapshot = await adminFirestore.collection("appAccess").get();
const collaboratorAccess = collaboratorSnapshot.docs.find(
  (snapshot) => snapshot.data().role === "agent" && snapshot.data().active === true
);

if (!collaboratorAccess) {
  throw new Error("Nessun account collaboratore attivo da usare per la verifica.");
}

const profile = collaboratorAccess.data();
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

if (!apiKey || !authDomain || !appId) {
  throw new Error("Configurazione Firebase client incompleta.");
}

const clientApp = initializeClientApp(
  { apiKey, authDomain, appId, projectId: serviceAccount.projectId },
  `access-verification-${Date.now()}`
);
const customToken = await getAdminAuth().createCustomToken(collaboratorAccess.id);
await signInWithCustomToken(getAuth(clientApp), customToken);
const firestore = getFirestore(clientApp);

async function mustAllow(label, operation) {
  try {
    const result = await operation();
    return { label, result };
  } catch (error) {
    throw new Error(`${label} doveva essere consentito: ${error?.code ?? error}`);
  }
}

async function mustDeny(label, operation) {
  try {
    await operation();
    throw new Error(`${label} e stato consentito, ma doveva essere negato.`);
  } catch (error) {
    if (String(error?.message ?? error).includes("doveva essere negato")) throw error;
    if (error?.code !== "permission-denied") {
      throw new Error(`${label} ha restituito un errore inatteso: ${error?.code ?? error}`);
    }
  }
}

const ownSource = await mustAllow("lettura fonte propria", () =>
  getDoc(doc(firestore, "appData", "sources", "items", profile.sourceId))
);
if (!ownSource.result.exists()) throw new Error("La fonte del collaboratore non esiste.");

const ownCustomers = await mustAllow("query clienti propri", () =>
  getDocs(query(collection(firestore, "appData", "customers", "items"), where("sourceId", "==", profile.sourceId)))
);
const ownCommissions = await mustAllow("query provvigioni proprie", () =>
  getDocs(query(collection(firestore, "appData", "commissionEntries", "items"), where("sourceId", "==", profile.sourceId)))
);
await mustAllow("query caricamenti propri", () =>
  getDocs(query(collection(firestore, "appData", "loadingRecords", "items"), where("matchedSourceId", "==", profile.sourceId)))
);
await mustAllow("lettura variabili preventivatore", () =>
  getDocs(collection(firestore, "appData", "marketVariables", "items"))
);
await mustAllow("query preventivi propri", () =>
  getDocs(query(collection(firestore, "appData", "energyQuotes", "items"), where("createdBy", "==", profile.id)))
);

await mustDeny("lettura non filtrata dei clienti", () =>
  getDocs(collection(firestore, "appData", "customers", "items"))
);

const sourceSnapshot = await adminFirestore.collection("appData").doc("sources").collection("items").get();
const otherSource = sourceSnapshot.docs.find((snapshot) => snapshot.id !== profile.sourceId);
if (otherSource) {
  await mustDeny("lettura fonte altrui", () =>
    getDoc(doc(firestore, "appData", "sources", "items", otherSource.id))
  );
}

const ownAgencyRecord = await adminFirestore
  .collection("appData")
  .doc("agencyMarginRecords")
  .collection("items")
  .where("matchedSourceId", "==", profile.sourceId)
  .limit(1)
  .get();
if (ownAgencyRecord.docs[0]) {
  await mustDeny("lettura margine agenzia", () =>
    getDoc(doc(firestore, "appData", "agencyMarginRecords", "items", ownAgencyRecord.docs[0].id))
  );
}

console.log(
  `Verifica collaboratore superata: ${ownCustomers.result.size} clienti e ${ownCommissions.result.size} provvigioni accessibili; dati altrui e margini agenzia negati.`
);
