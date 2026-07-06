import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function isFirebaseBackendEnabled() {
  return process.env.DATA_BACKEND === "firebase";
}

export function getFirebaseDb() {
  if (!isFirebaseBackendEnabled()) {
    return null;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase non configurato: mancano project id, client email o private key.");
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }

  return getFirestore();
}
