import { readFile } from "node:fs/promises";

export const FIREBASE_STORE_COLLECTION = "appState";
export const FIREBASE_STORE_DOCUMENT = "gestionaleEnergia";

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export async function loadProductionEnv() {
  try {
    const raw = await readFile(".env.production.local", "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);

      if (parsed && !process.env[parsed.key]) {
        process.env[parsed.key] = parsed.value;
      }
    }
  } catch {
    // CI/deploy providers usually inject env vars directly.
  }
}

export function firebaseServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (
    !projectId ||
    !clientEmail ||
    !privateKey ||
    clientEmail.startsWith("TODO_") ||
    privateKey.startsWith("TODO_")
  ) {
    throw new Error(
      "Credenziali Firebase mancanti: compila FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY."
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey
  };
}
