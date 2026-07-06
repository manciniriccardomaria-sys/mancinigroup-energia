"use client";

import {
  collection,
  doc,
  getDocs,
  type Firestore,
  writeBatch
} from "firebase/firestore";
import { createDefaultClientStore, normalizeStore } from "./client-store";
import type { StoreData } from "./types";

const STORE_ROOT = "appData";
const BATCH_LIMIT = 450;

const collectionKeys = [
  "sources",
  "customers",
  "commissionEntries",
  "commissionPayments",
  "commissionRules",
  "productionMetrics",
  "uploadedFiles",
  "loadingRecords",
  "agencyMarginRecords",
  "marketVariables",
  "energyQuotes",
  "users"
] as const satisfies readonly (keyof StoreData)[];

type StoreCollectionKey = (typeof collectionKeys)[number];
type StoreItem = Record<string, unknown>;
type BatchOperation =
  | { type: "delete"; collectionKey: StoreCollectionKey; id: string }
  | { type: "set"; collectionKey: StoreCollectionKey; id: string; value: StoreItem };

function emptyStore(): StoreData {
  return {
    sources: [],
    customers: [],
    commissionEntries: [],
    commissionPayments: [],
    commissionRules: [],
    productionMetrics: [],
    uploadedFiles: [],
    loadingRecords: [],
    agencyMarginRecords: [],
    marketVariables: [],
    energyQuotes: [],
    users: []
  };
}

function itemsFor(store: StoreData, key: StoreCollectionKey) {
  return store[key] as unknown as StoreItem[];
}

function itemDocId(key: StoreCollectionKey, item: StoreItem) {
  if (typeof item.id === "string" && item.id) {
    return item.id;
  }

  if (key === "productionMetrics" && typeof item.monthKey === "string" && item.monthKey) {
    return item.monthKey;
  }

  throw new Error(`Record senza id nella collezione ${key}.`);
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([entryKey, entry]) => [entryKey, stripUndefined(entry)])
    );
  }

  return value;
}

function sameRecord(a: StoreItem | undefined, b: StoreItem) {
  if (!a) {
    return false;
  }

  return JSON.stringify(stripUndefined(a)) === JSON.stringify(stripUndefined(b));
}

function diffCollection(previous: StoreData, next: StoreData, key: StoreCollectionKey) {
  const operations: BatchOperation[] = [];
  const previousItems = new Map(itemsFor(previous, key).map((item) => [itemDocId(key, item), item]));
  const nextItems = new Map(itemsFor(next, key).map((item) => [itemDocId(key, item), item]));

  for (const [id, previousItem] of previousItems) {
    if (!nextItems.has(id)) {
      operations.push({ type: "delete", collectionKey: key, id });
    } else if (!sameRecord(previousItem, nextItems.get(id)!)) {
      operations.push({ type: "set", collectionKey: key, id, value: nextItems.get(id)! });
    }
  }

  for (const [id, item] of nextItems) {
    if (!previousItems.has(id)) {
      operations.push({ type: "set", collectionKey: key, id, value: item });
    }
  }

  return operations;
}

async function commitOperations(db: Firestore, operations: BatchOperation[]) {
  let batch = writeBatch(db);
  let batchSize = 0;

  async function flush() {
    if (batchSize === 0) {
      return;
    }

    await batch.commit();
    batch = writeBatch(db);
    batchSize = 0;
  }

  for (const operation of operations) {
    const ref = doc(db, STORE_ROOT, operation.collectionKey, "items", operation.id);

    if (operation.type === "delete") {
      batch.delete(ref);
    } else {
      batch.set(ref, stripUndefined(operation.value) as Record<string, unknown>);
    }

    batchSize += 1;

    if (batchSize >= BATCH_LIMIT) {
      await flush();
    }
  }

  await flush();
}

export async function readFirestoreStore(db: Firestore, adminEmail?: string) {
  const partial: Partial<StoreData> = {};
  let totalRecords = 0;

  for (const key of collectionKeys) {
    const snapshot = await getDocs(collection(db, STORE_ROOT, key, "items"));
    const rows = snapshot.docs.map((item) => item.data()) as never;
    partial[key] = rows;
    totalRecords += snapshot.size;
  }

  if (totalRecords === 0) {
    return {
      isEmpty: true,
      store: createDefaultClientStore(adminEmail ?? "admin@example.local")
    };
  }

  return {
    isEmpty: false,
    store: normalizeStore(partial, adminEmail)
  };
}

export async function writeFirestoreStore(db: Firestore, previous: StoreData, next: StoreData) {
  const operations = collectionKeys.flatMap((key) => diffCollection(previous, next, key));
  await commitOperations(db, operations);
}

export async function seedFirestoreStore(db: Firestore, store: StoreData) {
  await writeFirestoreStore(db, emptyStore(), store);
}
