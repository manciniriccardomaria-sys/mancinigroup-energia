import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { addMonthsToForecastMonth, simulateFutureCommissions } from "../src/lib/commission-forecast.ts";
import { firebaseServiceAccount, loadProductionEnv } from "./firebase-env.mjs";

await loadProductionEnv();
if (getApps().length === 0) initializeApp({ credential: cert(firebaseServiceAccount()) });

const firestore = getFirestore();
const items = (key) => firestore.collection("appData").doc(key).collection("items");
const [sourcesSnapshot, customersSnapshot, agencySnapshot, existingSnapshot] = await Promise.all([
  items("sources").get(),
  items("customers").get(),
  items("agencyMarginRecords").get(),
  items("commissionForecasts").get()
]);
const now = new Date();
const cutoffMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const projections = simulateFutureCommissions({
  records: agencySnapshot.docs.map((snapshot) => snapshot.data()),
  customers: customersSnapshot.docs.map((snapshot) => snapshot.data()),
  sources: sourcesSnapshot.docs.map((snapshot) => snapshot.data()),
  cutoffMonthKey,
  projectionEndMonthKey: addMonthsToForecastMonth(cutoffMonthKey, 12)
});
const totals = new Map();

for (const projection of projections) {
  const key = `${projection.sourceId}|${projection.monthKey}`;
  totals.set(key, (totals.get(key) ?? 0) + projection.amount);
}

const generatedAt = new Date().toISOString();
const writer = firestore.bulkWriter();
for (const snapshot of existingSnapshot.docs) writer.delete(snapshot.ref);
for (const [key, amount] of totals.entries()) {
  const [sourceId, monthKey] = key.split("|");
  const id = `forecast_${sourceId}_${monthKey}`;
  writer.set(items("commissionForecasts").doc(id), {
    id,
    sourceId,
    monthKey,
    amount: Math.round((amount + Number.EPSILON) * 100) / 100,
    generatedAt
  });
}
await writer.close();

console.log(`Forecast personali ricostruiti: ${totals.size} totali fonte/mese.`);
