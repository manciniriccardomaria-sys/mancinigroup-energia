const fs = require("node:fs");
const ts = require("typescript");
const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { parseCaricamentiWorkbook } = require("../src/lib/import-caricamenti.ts");
const { phoneForPod } = require("../src/lib/customer-phone.ts");
const { createLoadingImportKey } = require("../src/lib/loading-records.ts");

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath || sourcePath.startsWith("--")) throw new Error("Indica il file Caricamenti da usare.");
  const { loadProductionEnv, firebaseServiceAccount } = await import("./firebase-env.mjs");
  await loadProductionEnv();
  initializeApp({ credential: cert(firebaseServiceAccount()) });
  const db = getFirestore();
  const rows = parseCaricamentiWorkbook(fs.readFileSync(sourcePath)).rows;
  const [customers, loading] = await Promise.all(["customers", "loadingRecords"].map((key) =>
    db.collection("appData").doc(key).collection("items").get()
  ));
  const byImportKey = new Map();
  for (const row of rows) {
    const key = createLoadingImportKey(row);
    byImportKey.set(key, [...(byImportKey.get(key) ?? []), row]);
  }
  const updates = [];
  let matched = 0;
  let existingPhones = 0;
  for (const doc of customers.docs) {
    const value = doc.data();
    const phone = phoneForPod(value.podPdr, rows);
    if (phone) matched += 1;
    if (value.phone?.trim()) { existingPhones += 1; continue; }
    if (phone) updates.push({ doc, phone, kind: "customers" });
  }
  for (const doc of loading.docs) {
    const value = doc.data();
    if (value.phone?.trim()) continue;
    const phone = phoneForPod(value.podPdr, byImportKey.get(createLoadingImportKey(value)) ?? []);
    if (phone) updates.push({ doc, phone, kind: "loadingRecords" });
  }
  const summary = {
    sourceRows: rows.length, sourceRowsWithPhone: rows.filter((row) => row.phone).length,
    customers: customers.size, matchedByPod: matched, existingPhones,
    customersToUpdate: updates.filter((item) => item.kind === "customers").length,
    loadingRecordsToUpdate: updates.filter((item) => item.kind === "loadingRecords").length,
    customersWithoutUnambiguousSourcePhone: customers.size - matched,
    apply: process.argv.includes("--apply")
  };
  console.log(JSON.stringify(summary));
  if (!summary.apply || !updates.length) return;
  fs.mkdirSync("backups", { recursive: true });
  const backup = `backups/customer-phones-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(backup, JSON.stringify(updates.map(({ doc }) => ({ path: doc.ref.path, data: doc.data() })), null, 2), { mode: 0o600 });
  let updated = 0;
  for (let index = 0; index < updates.length; index += 100) {
    const group = updates.slice(index, index + 100);
    updated += await db.runTransaction(async (transaction) => {
      const current = await transaction.getAll(...group.map(({ doc }) => doc.ref));
      let count = 0;
      current.forEach((doc, position) => {
        if (!doc.exists || doc.data().phone?.trim()) return;
        transaction.update(doc.ref, { phone: group[position].phone });
        count += 1;
      });
      return count;
    });
  }
  const verified = await db.getAll(...updates.map(({ doc }) => doc.ref));
  const missing = verified.filter((doc) => !doc.data()?.phone?.trim()).length;
  if (missing) throw new Error(`Verifica fallita: ${missing} record senza telefono.`);
  console.log(JSON.stringify({ updated, verified: verified.length, backup }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
