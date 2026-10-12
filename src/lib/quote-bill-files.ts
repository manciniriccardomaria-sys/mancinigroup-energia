"use client";

import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { firebaseDb, hasFirebaseClientConfig } from "./firebase-client";
import type { QuoteBillAttachment, SessionUser } from "./types";

export const MAX_BILL_BYTES = 10 * 1024 * 1024;
export const MAX_BILL_FILES = 5;
const CHUNK_BYTES = 512 * 1024;
const localFilesEnabled = () => !hasFirebaseClientConfig() || (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_LOCAL_AUTH === "true");

export function validateBillFile(file: Pick<File, "name" | "size" | "type">) {
  if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name) || !["", "application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Carica bollette in PDF, JPG, PNG o WebP.");
  if (!file.size || file.size > MAX_BILL_BYTES) throw new Error("Ogni bolletta deve avere una dimensione compresa tra 1 byte e 10 MB.");
}

function localFile<T>(id: string, mode: "read" | "write" | "delete", value?: Blob): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("mg-energia-quote-bills", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("bills");
    open.onerror = () => reject(new Error("Archivio bollette locale non disponibile."));
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("bills", mode === "read" ? "readonly" : "readwrite");
      const store = transaction.objectStore("bills");
      const request = mode === "read" ? store.get(id) : mode === "delete" ? store.delete(id) : store.put(value, id);
      transaction.oncomplete = () => { db.close(); resolve(request.result as T); };
      transaction.onerror = () => { db.close(); reject(new Error("Operazione sull’archivio bollette non riuscita.")); };
      transaction.onabort = () => { db.close(); reject(new Error("Salvataggio bolletta annullato.")); };
    };
  });
}

function encode(bytes: Uint8Array) {
  let text = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}

export async function deleteQuoteBill(file: QuoteBillAttachment) {
  if (localFilesEnabled()) return localFile(file.id, "delete");
  const db = firebaseDb();
  const ref = doc(db, "quoteBillFiles", file.id);
  const snapshot = await getDocs(collection(ref, "chunks"));
  const batch = writeBatch(db);
  snapshot.docs.forEach((chunk) => batch.delete(chunk.ref));
  batch.delete(ref);
  await batch.commit();
}

export async function uploadQuoteBill(file: File, user: SessionUser, ownerId: string, sourceId?: string): Promise<QuoteBillAttachment> {
  validateBillFile(file);
  const metadata: QuoteBillAttachment = {
    id: `bill_${crypto.randomUUID()}`,
    originalName: file.name,
    mimeType: file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : /\.png$/i.test(file.name) ? "image/png" : /\.webp$/i.test(file.name) ? "image/webp" : "image/jpeg"),
    size: file.size,
    chunkCount: Math.ceil(file.size / CHUNK_BYTES),
    uploadedAt: new Date().toISOString(),
    uploadedBy: user.id
  };
  if (localFilesEnabled()) {
    await localFile(metadata.id, "write", file);
    return metadata;
  }
  const db = firebaseDb();
  const ref = doc(db, "quoteBillFiles", metadata.id);
  await setDoc(ref, { ...metadata, ownerId, sourceId: sourceId ?? null, ready: false });
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Keep each commit well below Firestore's request-size limit.
    for (let start = 0; start < metadata.chunkCount; start += 6) {
      const batch = writeBatch(db);
      for (let index = start; index < Math.min(start + 6, metadata.chunkCount); index++) {
        batch.set(doc(ref, "chunks", String(index)), { data: encode(bytes.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES)) });
      }
      await batch.commit();
    }
    await setDoc(ref, { ready: true }, { merge: true });
    return metadata;
  } catch (error) {
    await deleteQuoteBill(metadata).catch(() => undefined);
    throw error;
  }
}

export async function readQuoteBill(file: QuoteBillAttachment): Promise<Blob> {
  if (localFilesEnabled()) {
    const blob = await localFile<Blob | undefined>(file.id, "read");
    if (!blob) throw new Error("Bolletta non trovata nell’archivio locale.");
    return blob;
  }
  const db = firebaseDb();
  const ref = doc(db, "quoteBillFiles", file.id);
  const manifest = await getDoc(ref);
  const metadata = manifest.data();
  if (!metadata?.ready || !Number.isInteger(metadata.chunkCount) || metadata.chunkCount < 1 || metadata.chunkCount > MAX_BILL_BYTES / CHUNK_BYTES) throw new Error("Bolletta non disponibile o caricamento incompleto.");
  const chunks = await Promise.all(Array.from({ length: metadata.chunkCount }, (_, index) => getDoc(doc(ref, "chunks", String(index)))));
  const parts = chunks.map((chunk) => {
    const encoded = chunk.data()?.data;
    if (!chunk.exists() || typeof encoded !== "string") throw new Error("Bolletta incompleta: manca una parte del file.");
    return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  });
  const blob = new Blob(parts, { type: file.mimeType });
  if (blob.size !== file.size) throw new Error("Il file della bolletta è incompleto.");
  return blob;
}

export async function downloadQuoteBill(file: QuoteBillAttachment, customerName: string) {
  const blob = await readQuoteBill(file);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${customerName.trim()} - ${file.originalName}`.replace(/[/\\]/g, "-");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
