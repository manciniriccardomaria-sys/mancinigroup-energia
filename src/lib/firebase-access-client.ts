"use client";

import { deleteApp, FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
  type User as FirebaseUser
} from "firebase/auth";
import { doc, writeBatch } from "firebase/firestore";
import { firebaseDb, firebaseSecondaryApp } from "./firebase-client";
import type { User } from "./types";

function accessCreationError(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error ? error : new Error("Creazione accesso non riuscita.");
  }

  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Questa email e gia registrata in Firebase.",
    "auth/invalid-credential":
      "Questa email esiste gia in Firebase: inserisci la password corretta per collegarla al gestionale.",
    "auth/invalid-email": "Inserisci un indirizzo email valido.",
    "auth/network-request-failed": "Connessione non disponibile. Riprova tra poco.",
    "auth/operation-not-allowed": "La creazione degli account email e password non e abilitata in Firebase.",
    "auth/too-many-requests": "Troppi tentativi. Attendi qualche minuto e riprova.",
    "auth/weak-password": "Scegli una password di almeno 6 caratteri."
  };

  return new Error(messages[error.code] ?? error.message);
}

export async function provisionFirebaseUserAccess(user: User, password: string) {
  if (password.length < 6) {
    throw new Error("Scegli una password di almeno 6 caratteri.");
  }

  const db = firebaseDb();
  const secondaryApp = firebaseSecondaryApp(
    `access-provision-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const secondaryAuth = getAuth(secondaryApp);
  let authUser: FirebaseUser | null = null;
  let createdNewAccount = false;

  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, user.email, password);
      authUser = credential.user;
      createdNewAccount = true;
    } catch (error) {
      if (!(error instanceof FirebaseError) || error.code !== "auth/email-already-in-use") {
        throw error;
      }

      const credential = await signInWithEmailAndPassword(secondaryAuth, user.email, password);
      authUser = credential.user;
    }

    await updateProfile(authUser, { displayName: user.name });

    const userDocument: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: "firebase-auth",
      createdAt: user.createdAt
    };

    if (user.sourceId) {
      userDocument.sourceId = user.sourceId;
    }

    const batch = writeBatch(db);
    batch.set(doc(db, "appData", "users", "items", user.id), userDocument);
    batch.set(doc(db, "appAccess", authUser.uid), {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sourceId: user.sourceId ?? null,
      active: true,
      updatedAt: new Date().toISOString()
    });
    await batch.commit();
  } catch (error) {
    if (createdNewAccount && authUser) {
      try {
        await deleteUser(authUser);
      } catch {
        // Il profilo Firestore non e stato creato; un eventuale account orfano resta privo di accesso.
      }
    }

    throw accessCreationError(error);
  } finally {
    await deleteApp(secondaryApp);
  }
}
