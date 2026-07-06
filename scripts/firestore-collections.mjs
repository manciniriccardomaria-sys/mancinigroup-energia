export const FIRESTORE_ROOT_COLLECTION = "appData";

export const storeCollectionKeys = [
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
];

const BATCH_LIMIT = 450;

function itemDocId(key, item) {
  if (typeof item.id === "string" && item.id) {
    return item.id;
  }

  if (key === "productionMetrics" && typeof item.monthKey === "string" && item.monthKey) {
    return item.monthKey;
  }

  throw new Error(`Record senza id nella collezione ${key}.`);
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefined(entry)])
    );
  }

  return value;
}

function emptyStore() {
  return Object.fromEntries(storeCollectionKeys.map((key) => [key, []]));
}

function diffCollection(previous, next, key) {
  const operations = [];
  const previousItems = new Map((previous[key] ?? []).map((item) => [itemDocId(key, item), item]));
  const nextItems = new Map((next[key] ?? []).map((item) => [itemDocId(key, item), item]));

  for (const [id, previousItem] of previousItems) {
    const nextItem = nextItems.get(id);

    if (!nextItem) {
      operations.push({ type: "delete", key, id });
    } else if (JSON.stringify(stripUndefined(previousItem)) !== JSON.stringify(stripUndefined(nextItem))) {
      operations.push({ type: "set", key, id, value: nextItem });
    }
  }

  for (const [id, item] of nextItems) {
    if (!previousItems.has(id)) {
      operations.push({ type: "set", key, id, value: item });
    }
  }

  return operations;
}

async function commitOperations(db, operations) {
  let batch = db.batch();
  let batchSize = 0;

  async function flush() {
    if (batchSize === 0) {
      return;
    }

    await batch.commit();
    batch = db.batch();
    batchSize = 0;
  }

  for (const operation of operations) {
    const ref = db.collection(FIRESTORE_ROOT_COLLECTION).doc(operation.key).collection("items").doc(operation.id);

    if (operation.type === "delete") {
      batch.delete(ref);
    } else {
      batch.set(ref, stripUndefined(operation.value));
    }

    batchSize += 1;

    if (batchSize >= BATCH_LIMIT) {
      await flush();
    }
  }

  await flush();
}

export async function readFirestoreCollections(db) {
  const store = emptyStore();
  let totalRecords = 0;

  for (const key of storeCollectionKeys) {
    const snapshot = await db.collection(FIRESTORE_ROOT_COLLECTION).doc(key).collection("items").get();
    store[key] = snapshot.docs.map((item) => item.data());
    totalRecords += snapshot.size;
  }

  return {
    store,
    totalRecords
  };
}

export async function writeFirestoreCollections(db, nextStore) {
  const { store: previousStore } = await readFirestoreCollections(db);
  const operations = storeCollectionKeys.flatMap((key) => diffCollection(previousStore, nextStore, key));
  await commitOperations(db, operations);
  return operations.length;
}
