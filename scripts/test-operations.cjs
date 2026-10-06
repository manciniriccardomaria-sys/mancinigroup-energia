const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, filename);
};
const { calculateEnergyQuote, defaultEnergyQuoteInput } = require('../src/lib/quote-calculator.ts');
const { offerCatalog, defaultQuoteOffers, normalizeManagedOffers } = require('../src/lib/offers.ts');
const { paymentGate, addCalendarMonths } = require('../src/lib/payment-gate.ts');
const { normalizeStore, addEnergyQuoteToStore } = require('../src/lib/client-store.ts');

const variables = ['pun_mono', 'pun_f1', 'pun_f2', 'pun_f3', 'mercato_capacita', 'dispacciamento', 'psv'].map((key) => ({
  key, monthKey: '2026-01', value: key.startsWith('pun') ? 0.1 : key === 'psv' ? 0.3 : key === 'mercato_capacita' ? 0.002 : 0.003
}));
const input = defaultEnergyQuoteInput({ commodity: 'luce', monthKey: '2026-01', consumptionMonth1: 100, currentSpend: 25, currentPcv: 10, customerType: 'RES' });
const base = { id: 'test', code: 'test', offerEasy: 'Test', commodity: 'luce', customerType: 'RES', pcv: 8, spread: 0.02, active: true };
const variable = calculateEnergyQuote(input, variables, [base]);
assert.equal(variable.ready, true);
assert.equal(variable.selectedOffer.quotaConsumi, 12.8792);
assert.equal(variable.selectedOffer.agencyCommission, 33.84);
const fixed = calculateEnergyQuote(input, variables, [{ ...base, pricingType: 'fixed', fixedPrice: 0.15, fixedAgencyCommission: 45 }]);
assert.ok(Math.abs(fixed.selectedOffer.quotaConsumi - 17.2312) < 1e-9);
assert.equal(fixed.selectedOffer.agencyCommission, 45);
assert.ok(fixed.selectedOffer.annualSaving < variable.selectedOffer.annualSaving);
const lowFixed = calculateEnergyQuote(input, variables, [{ ...base, pricingType: 'fixed', fixedPrice: 0.05 }]);
assert.ok(lowFixed.selectedOffer.annualSaving > variable.selectedOffer.annualSaving);
assert.equal(calculateEnergyQuote(input, variables, [{ ...base, active: false }]).ready, false);
assert.equal(calculateEnergyQuote(input, variables, [{ ...base, customerType: 'BUS' }]).offers.length, 0);
const gasInput = { ...input, commodity: 'gas', gasAnnualConsumption: 1200 };
const gasFixed = calculateEnergyQuote(gasInput, variables, [{ ...base, commodity: 'gas', pricingType: 'fixed', fixedPrice: 0.4 }]);
assert.equal(gasFixed.selectedOffer.quotaConsumi, 40);
const gasVariable = calculateEnergyQuote(gasInput, variables, [{ ...base, commodity: 'gas', spread: 0.1 }]);
assert.equal(gasVariable.selectedOffer.quotaConsumi, 40);
assert.equal(gasFixed.selectedOffer.annualSaving, gasVariable.selectedOffer.annualSaving);

const defaults = defaultQuoteOffers();
assert.ok(offerCatalog.every((offer) => defaults.some((item) => item.code === offer.code)));
const override = { ...defaults[0], active: false };
assert.equal(normalizeManagedOffers([override]).length, defaults.length);
assert.equal(normalizeManagedOffers([override]).find((offer) => offer.id === override.id).active, false);
assert.equal(normalizeStore({ managedOffers: [override] }).managedOffers.length, defaults.length);
const store = normalizeStore({});
addEnergyQuoteToStore(store, { ...input, calculationSnapshot: fixed, inputSnapshot: input });
const archived = JSON.parse(JSON.stringify(store.energyQuotes[0]));
base.pcv = 999;
assert.equal(archived.calculationSnapshot.selectedOffer.pcv, 8);
assert.equal(archived.calculationSnapshot.selectedOffer.fixedPrice, 0.15);

assert.equal(paymentGate('source', [], [], '2026-06-01'), undefined);
assert.equal(addCalendarMonths('2026-01-31', 3), '2026-04-30');
assert.equal(addCalendarMonths('2023-11-30', 3), '2024-02-29');
const payments = [{ sourceId: 'source', paidAt: '2026-01-31', amount: 100 }, { sourceId: 'source', paidAt: '2026-07-01', amount: 999 }];
const entries = [{ sourceId: 'source', dueMonth: '2026-01', amount: 100 }, { sourceId: 'source', dueMonth: '2026-02', amount: 50 }, { sourceId: 'source', dueMonth: '2026-03', amount: 80 }, { sourceId: 'source', dueMonth: '2026-04', amount: 20 }, { sourceId: 'source', dueMonth: '2026-05', amount: 300 }, { sourceId: 'other', dueMonth: '2026-02', amount: 1000 }, { sourceId: 'source', dueMonth: '2025', amount: 1000 }];
const gate = paymentGate('source', entries, payments, '2026-04-30');
assert.equal(gate.dueDate, '2026-04-30');
assert.equal(gate.overdue, true);
assert.equal(gate.balance, 150);
assert.deepEqual(gate.months, ['2026-02', '2026-03', '2026-04']);
assert.equal(gate.monthly.reduce((sum, row) => sum + row.amount, 0), 150);
assert.equal(paymentGate('source', entries, payments, '2026-03-15').overdue, false);
assert.equal(paymentGate('source', entries, payments, '2026-03-15').balance, 130);
const restarted = paymentGate('source', entries, [...payments, { sourceId: 'source', paidAt: '2026-04-30', amount: 150 }], '2026-04-30');
assert.equal(restarted.dueDate, '2026-07-30');
assert.equal(restarted.balance, 0);
console.log('Operations regression checks passed: pricing, catalog overrides, archived values, quarterly gates.');
