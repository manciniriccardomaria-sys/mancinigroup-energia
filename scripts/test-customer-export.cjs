const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const XLSX = require("xlsx");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { createCustomersWorkbook } = require("../src/lib/customer-export.ts");
const row = {
  customer: {
    name: "=SUM(1,2)", podPdr: "00123456789012", commodity: "gas",
    status: "in_lavorazione", createdAt: "2026-11-02T08:00:00Z"
  },
  source: { name: "Fonte di prova", kind: "collaboratore" },
  lifeStatus: "attivo", fiscalId: "00123456789", value: 123.45,
  entryInfo: { label: "01/11/2026", detail: "Data inizio" }
};
const second = {
  ...row, customer: { ...row.customer, name: "Altro cliente", podPdr: "IT001E12345678", status: "cessato" },
  source: undefined, fiscalId: undefined, lifeStatus: "uscito", value: 0
};
const workbook = createCustomersWorkbook([second, row], false);
const parsed = XLSX.read(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), { type: "buffer", cellNF: true });
assert.deepEqual(parsed.SheetNames, ["Clienti"]);
const sheet = parsed.Sheets.Clienti;
assert.equal(sheet.A2.v, "Altro cliente", "Keep the displayed ordering");
assert.equal(sheet.A3.v, row.customer.name);
assert.equal(sheet.A3.t, "s");
assert.equal(sheet.A3.f, undefined, "Customer text must never become an Excel formula");
assert.equal(sheet.B3.v, "00123456789012", "Preserve leading zeros in PDR");
assert.equal(sheet.B3.t, "s");
assert.equal(sheet.D3.v, "00123456789", "Preserve leading zeros in tax IDs");
assert.equal(sheet.D3.t, "s");
assert.equal(sheet.H3.v, 123.45);
assert.equal(sheet.H3.t, "n", "Amounts remain usable in Excel calculations");
assert.ok(sheet.H3.z.includes("€"));
assert.equal(sheet.H2.v, 0);
assert.equal(sheet.I2.v, "Uscito");
assert.equal(sheet.J3.v, "In lavorazione");
assert.equal(sheet["!autofilter"].ref, "A1:N3");
const personal = createCustomersWorkbook([row], true).Sheets.Clienti;
assert.equal(personal.H1.v, "Le tue provvigioni (€)");
assert.equal(personal["!ref"], "A1:N2", "Export only the supplied visible rows");
assert.equal(createCustomersWorkbook([], false).Sheets.Clienti["!ref"], "A1:N1");
console.log("Customer Excel export tests passed.");
