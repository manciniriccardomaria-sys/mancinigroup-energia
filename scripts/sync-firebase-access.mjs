import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseServiceAccount, loadProductionEnv } from "./firebase-env.mjs";

await loadProductionEnv();

if (getApps().length === 0) {
  initializeApp({ credential: cert(firebaseServiceAccount()) });
}

const auth = getAuth();
const firestore = getFirestore();
const userSnapshot = await firestore.collection("appData").doc("users").collection("items").get();
const usersByEmail = new Map(
  userSnapshot.docs.map((snapshot) => {
    const user = snapshot.data();
    return [String(user.email ?? "").trim().toLowerCase(), user];
  })
);

let pageToken;
let synced = 0;
let skipped = 0;

do {
  const page = await auth.listUsers(1000, pageToken);

  for (const authUser of page.users) {
    const email = authUser.email?.trim().toLowerCase();
    const user = email ? usersByEmail.get(email) : undefined;

    if (!email || !user || !user.id || !user.name || !user.role) {
      skipped += 1;
      continue;
    }

    if (user.role === "agent" && !user.sourceId) {
      throw new Error(`Collaboratore ${email} senza fonte collegata.`);
    }

    await firestore.collection("appAccess").doc(authUser.uid).set(
      {
        id: user.id,
        email,
        name: user.name,
        role: user.role,
        sourceId: user.sourceId ?? null,
        active: !authUser.disabled,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    synced += 1;
  }

  pageToken = page.pageToken;
} while (pageToken);

console.log(`Profili di accesso sincronizzati: ${synced}. Account Auth senza utente gestionale: ${skipped}.`);
