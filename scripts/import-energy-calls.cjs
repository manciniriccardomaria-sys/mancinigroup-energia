const fs = require("node:fs");
const ts = require("typescript");
const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { parseEnergyCallReport, mergeEnergyCalls, isOpenEnergyCall, isTrackedEnergyCall, effectiveCallDate, italyDate } = require("../src/lib/energy-calls.ts");

async function main() {
  const filePath = process.argv[2];
  if (!filePath || filePath.startsWith("--")) throw new Error("Indica il percorso del report Excel.");
  const report = parseEnergyCallReport(fs.readFileSync(filePath), require("node:path").basename(filePath));
  const today = italyDate();
  console.log(JSON.stringify({ totalRows: report.totalRows, calls: report.calls.length, skippedRows: report.skippedRows,
    duplicateRows: report.duplicateRows, missingPhones: report.missingPhones,
    scheduledCalls: report.calls.filter(isTrackedEnergyCall).length,
    excludedBeforeStart: report.calls.filter((call) => !isTrackedEnergyCall(call)).length,
    overdue: report.calls.filter((call) => isOpenEnergyCall(call) && effectiveCallDate(call) < today).length,
    today: report.calls.filter((call) => call.dueDate === today).length,
    future: report.calls.filter((call) => call.dueDate > today).length,
    weekendCalls: report.calls.filter((call) => [0, 6].includes(new Date(`${call.dueDate}T12:00:00Z`).getUTCDay())).length,
    apply: process.argv.includes("--apply") }));
  if (!process.argv.includes("--apply")) return;
  const { loadProductionEnv, firebaseServiceAccount } = await import("./firebase-env.mjs");
  await loadProductionEnv();
  initializeApp({ credential: cert(firebaseServiceAccount()) });
  const db = getFirestore();
  const collection = db.collection("appData").doc("energyCalls").collection("items");
  const previous = await collection.get();
  fs.mkdirSync("backups", { recursive: true });
  const backup = `backups/energy-calls-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(backup, JSON.stringify(previous.docs.map((doc) => doc.data()), null, 2), { mode: 0o600 });
  let written = 0;
  for (let offset = 0; offset < report.calls.length; offset += 100) {
    const incoming = report.calls.slice(offset, offset + 100);
    await db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(...incoming.map((call) => collection.doc(call.id)));
      const existing = snapshots.filter((doc) => doc.exists).map((doc) => doc.data());
      const merged = mergeEnergyCalls(existing, incoming);
      for (const call of merged) transaction.set(collection.doc(call.id), call);
    });
    written += incoming.length;
  }
  const saved = await db.getAll(...report.calls.map((call) => collection.doc(call.id)));
  if (saved.some((doc, index) => !doc.exists || doc.data().dueDate !== report.calls[index].dueDate)) {
    throw new Error("Verifica importazione non riuscita.");
  }
  console.log(JSON.stringify({ written, verified: saved.length, backup }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
