import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseServiceAccount, loadProductionEnv } from "./firebase-env.mjs";

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

await loadProductionEnv();

const email = argValue("email")?.trim().toLowerCase();
const password = argValue("password");
const name = argValue("name")?.trim();
const role = argValue("role")?.trim() ?? "agent";
const sourceId = argValue("sourceId")?.trim();
const authOnly = process.argv.includes("--auth-only");

if (!email || !password || !name) {
  throw new Error(
    "Uso: pnpm firebase:create-user -- --email=nome@example.com --password='PasswordSicura' --name='Nome' --role=admin|frontline|agent|operativo [--sourceId=src_nome] [--auth-only]"
  );
}

if (!["admin", "frontline", "agent", "operativo"].includes(role)) {
  throw new Error("Ruolo non valido. Usa admin, frontline, agent o operativo.");
}

const serviceAccount = firebaseServiceAccount();

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const auth = getAuth();
let authUser;

try {
  authUser = await auth.getUserByEmail(email);
  authUser = await auth.updateUser(authUser.uid, {
    displayName: name,
    password
  });
} catch (error) {
  if (error?.code !== "auth/user-not-found") {
    throw error;
  }

  authUser = await auth.createUser({
    email,
    password,
    displayName: name,
    emailVerified: true
  });
}

if (!authOnly) {
  const firestore = getFirestore();
  const userId = `usr_${slugify(email)}`;
  const userDoc = {
    id: userId,
    email,
    name,
    role,
    passwordHash: "firebase-auth",
    createdAt: new Date().toISOString()
  };

  if (role !== "admin" && role !== "operativo" && sourceId) {
    userDoc.sourceId = sourceId;
  }

  if (role === "agent" || role === "frontline") {
    if (!sourceId) {
      throw new Error(`Il ruolo ${role} richiede --sourceId.`);
    }

    const sourceSnapshot = await firestore
      .collection("appData")
      .doc("sources")
      .collection("items")
      .doc(sourceId)
      .get();
    const expectedKind = role === "agent" ? "collaboratore" : "frontline";

    if (!sourceSnapshot.exists || sourceSnapshot.data()?.kind !== expectedKind) {
      throw new Error(`La fonte ${sourceId} deve essere attiva e di tipo ${expectedKind}.`);
    }
  }

  await firestore
    .collection("appData")
    .doc("users")
    .collection("items")
    .doc(userId)
    .set(userDoc, { merge: true });

  await firestore.collection("appAccess").doc(authUser.uid).set(
    {
      id: userId,
      email,
      name,
      role,
      sourceId: userDoc.sourceId ?? null,
      active: true,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

console.log(`Utente Firebase pronto: ${authUser.email} (${authUser.uid})`);
