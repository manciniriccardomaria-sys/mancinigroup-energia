const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const XLSX = require("xlsx");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { energyCallDueDate, parseEnergyCallReport, mergeEnergyCalls, energyCallCalendarDates,
  updateEnergyCall, effectiveCallDate, isOpenEnergyCall, isTrackedEnergyCall, italyDate } = require("../src/lib/energy-calls.ts");
const { normalizeStore } = require("../src/lib/client-store.ts");
const header = ["Contraente", "Age", "Sede", "FQ", "Ap. Cl", "Cp.", "Fonte", "Dt. Prox Scad Quiet", "Iniz. Rapp.", "Cod.Fiscale / P.IVA", "Cellulare", "Tel. Residenza"];
const row = (name, cf, start, mobile = "", phone = "") => [name, "", "", "", "", "", "005", "", start, cf, mobile, phone];
function workbook(rows, date1904 = false) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Report");
  wb.Workbook = { WBProps: { date1904 } };
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
assert.equal(energyCallDueDate("2026-08-31"), "2026-10-30"); // Saturday -> Friday; month end clamped first.
assert.equal(energyCallDueDate("2026-09-01"), "2026-11-02"); // Sunday -> Monday.
assert.equal(energyCallDueDate("2026-09-04"), "2026-11-04");
assert.equal(energyCallDueDate("2023-12-31"), "2024-02-29");
assert.equal(energyCallDueDate("2026-12-31"), "2027-03-01"); // Feb 28 is Sunday.
assert.throws(() => energyCallDueDate("2026-02-30"));
assert.equal(italyDate(new Date("2026-11-02T23:30:00Z")), "2026-11-03");
const parsed = parseEnergyCallReport(workbook([header,
  row("Cliente Uno", "abc001", "03/09/2026", "+39 3331234567"),
  row("Cliente Due", "abc002", "04/09/2026", "", "0801234567"),
  row("Cliente Uno", "ABC001", "03/09/2026"),
  row("Cliente Tre", "abc003", "31/02/2026"),
  row("Cliente Quattro", "", "01/09/2026"),
  row("Cliente Cinque", "abc005", 46266), // Excel serial, 1 September 2026.
]), "fixture.xlsx", "2026-11-02T09:00:00Z");
assert.equal(parsed.calls.length, 3);
assert.equal(parsed.skippedRows, 2);
assert.equal(parsed.duplicateRows, 1);
assert.equal(parsed.missingPhones, 1);
assert.equal(parsed.calls[0].dueDate, "2026-11-03");
assert.equal(parsed.calls[1].phone, "0801234567");
assert.equal(parsed.calls[2].relationshipStartDate, "2026-09-01");
const macDate = parseEnergyCallReport(workbook([header, row("Cliente Mac", "MAC001", 44804)], true), "mac.xlsx");
assert.equal(macDate.calls[0].relationshipStartDate, "2026-09-01");
assert.throws(() => parseEnergyCallReport(workbook([["Wrong header"]]), "bad.xlsx"), /colonna I/);
const store = normalizeStore({ energyCalls: parsed.calls });
const user = { id: "operator", name: "Operatore", role: "operativo" };
const call = store.energyCalls[0];
const historicalCall = { ...call, id: "historical", dueDate: "2026-11-02" };
assert.equal(isTrackedEnergyCall(historicalCall), false);
assert.equal(isOpenEnergyCall(historicalCall), false);
assert.deepEqual(energyCallCalendarDates(historicalCall, "2026-11-03"), []);
assert.deepEqual(energyCallCalendarDates(historicalCall, "2026-12-01"), []);
assert.equal(isTrackedEnergyCall(call), true);
assert.deepEqual(energyCallCalendarDates(call, "2026-11-03"), ["2026-11-03"]);
assert.deepEqual(energyCallCalendarDates(call, "2026-11-04"), ["2026-11-03", "2026-11-04"]);
updateEnergyCall(store, user, call.id, "da_richiamare", "Richiamare la mattina", "2026-11-08", "2026-11-03T10:00:00Z");
assert.equal(call.callbackDate, "2026-11-09");
assert.equal(effectiveCallDate(call), "2026-11-09");
assert.ok(!energyCallCalendarDates(call, "2026-11-04").includes("2026-11-04"));
assert.ok(energyCallCalendarDates(call, "2026-11-10").includes("2026-11-10"));
assert.throws(() => updateEnergyCall(store, user, call.id, "da_richiamare", "", undefined, "2026-11-03T10:00:00Z"), /richiamo valida/);
assert.throws(() => updateEnergyCall(store, user, call.id, "da_richiamare", "", "2026-10-31", "2026-10-31T10:00:00Z"), /già trascorsa/);
assert.throws(() => updateEnergyCall(store, { ...user, role: "frontline" }, call.id, "chiamato", ""), /non consentito/);
const secondImport = parseEnergyCallReport(workbook([header, row("Cliente Uno aggiornato", "ABC001", "03/09/2026", "3339999999")]), "update.xlsx");
const merged = mergeEnergyCalls(store.energyCalls, secondImport.calls);
assert.equal(merged.length, 3); // Missing clients are never deleted.
assert.equal(merged[0].customerName, "Cliente Uno aggiornato");
assert.equal(merged[0].phone, "3339999999");
assert.equal(merged[0].status, "da_richiamare");
assert.equal(merged[0].callbackDate, "2026-11-09");
assert.equal(merged[0].history.length, 1);
assert.equal(merged[0].notes, "Richiamare la mattina");
assert.equal(mergeEnergyCalls(merged, secondImport.calls).length, 3);
const historicalReimport = mergeEnergyCalls([historicalCall], [historicalCall]);
assert.equal(historicalReimport.length, 1);
assert.deepEqual(energyCallCalendarDates(historicalReimport[0], "2026-11-03"), []);
updateEnergyCall(store, user, call.id, "contratto_attivato", "Concluso", undefined, "2026-11-09T10:00:00Z");
assert.equal(isOpenEnergyCall(call), false);
assert.equal(call.callbackDate, undefined);
assert.equal(call.history.length, 2);
assert.ok(energyCallCalendarDates(call, "2026-11-10").includes("2026-11-09"));
assert.ok(energyCallCalendarDates(call, "2026-11-10").includes("2026-11-03"));
assert.ok(!energyCallCalendarDates(call, "2026-11-10").includes("2026-11-10"));
assert.equal(normalizeStore({}).energyCalls.length, 0);
console.log("Calendario Energia: date, weekend, fine mese, import, duplicati, richiami, permessi e storico verificati.");
