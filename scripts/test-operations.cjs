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
assert.ok(Math.abs(variable.selectedOffer.quotaConsumi - 12.87) < 1e-9);
assert.equal(variable.selectedOffer.agencyCommission, 67.68);
assert.equal(variable.selectedOffer.annualSaving, 169.56);
const fixed = calculateEnergyQuote(input, variables, [{ ...base, pricingType: 'fixed', fixedPrice: 0.15, fixedAgencyCommission: 45 }]);
assert.ok(Math.abs(fixed.selectedOffer.quotaConsumi - 17.17) < 1e-9);
assert.equal(fixed.selectedOffer.agencyCommission, 45);
assert.equal(fixed.selectedOffer.annualSaving, 117.96);
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

// PUN monorario AGF senza perdite; spread e dispacciamento con perdite al 10%.
const zeroSpread = calculateEnergyQuote(input, variables, [{ ...base, spread: 0 }]);
assert.ok(Math.abs(zeroSpread.selectedOffer.quotaConsumi - 10.67) < 1e-9);
const bandInput = { ...input, lightConsumptionMode: 'fasce', f1Month1: 20, f2Month1: 30, f3Month1: 50 };
const bands = calculateEnergyQuote(bandInput, variables, [base]);
assert.ok(Math.abs(bands.selectedOffer.quotaConsumi - 13.87) < 1e-9);
// Prezzo fisso già lordo: nessuna seconda maggiorazione; sbilanciamento invariato.
const grossFixed = calculateEnergyQuote(input, variables, [{ ...base, pricingType: 'fixed', fixedPrice: 0.15, lightLosses: { fixedPrice: false, dispatching: false } }]);
assert.ok(Math.abs(grossFixed.selectedOffer.quotaConsumi - 15.64) < 1e-9);
assert.equal(grossFixed.selectedOffer.lightLosses.fixedPrice, false);
assert.equal(grossFixed.selectedOffer.annualSaving, 136.32);
const grossSpread = calculateEnergyQuote(input, variables, [{ ...base, lightLosses: { spread: false } }]);
assert.ok(Math.abs(grossSpread.selectedOffer.quotaConsumi - 12.67) < 1e-9);
assert.ok(grossSpread.selectedOffer.annualSaving > variable.selectedOffer.annualSaving);
const changedComponents = calculateEnergyQuote(input, variables, [{ ...base, lightLosses: { punMono: true, capacity: true } }]);
assert.ok(Math.abs(changedComponents.selectedOffer.quotaConsumi - 13.89) < 1e-9);
const netBands = calculateEnergyQuote(bandInput, variables, [{ ...base, lightLosses: { punBands: false } }]);
assert.ok(Math.abs(netBands.selectedOffer.quotaConsumi - 12.87) < 1e-9);
const mediumVoltage = calculateEnergyQuote({ ...input, lightLossMode: 'media_alta' }, variables, [base]);
assert.ok(Math.abs(mediumVoltage.selectedOffer.quotaConsumi - 12.7274) < 1e-9);
// Due offerte identiche con trattamento perdite diverso devono restare confrontabili.
assert.equal(calculateEnergyQuote(input, variables, [base, { ...base, code: 'gross', lightLosses: { spread: false } }]).offers.length, 2);

// La Deliziosa: l'input della bolletta, le variabili caricate e il risparmio
// mensile completo devono produrre lo stesso risparmio quando annualizzati.
const julyVariables = Object.entries({
  pun_mono: 0.15704, pun_f1: 0.1542, pun_f2: 0.1693, pun_f3: 0.1522,
  mercato_capacita: 0.024466, dispacciamento: 0.010501
}).map(([key, value]) => ({ key, monthKey: '2026-07', value }));
const billInput = defaultEnergyQuoteInput({
  commodity: 'luce', customerType: 'BUS', monthKey: '2026-07',
  consumptionMonth1: 2742.1, currentAveragePrice: 0.226239, currentSpend: 0, currentPcv: 18
});
const fidelity = defaultQuoteOffers().find(offer => offer.code === 'AGF_EE_MANCINI GROUP_BUSINESS FIDELITY 15');
const bill = calculateEnergyQuote(billInput, julyVariables, [fidelity]);
assert.equal(bill.selectedOffer.annualSaving, 574.85);
assert.equal(bill.selectedOffer.annualDifference, -574.85);
assert.equal(bill.selectedOffer.agencyCommission, 264.09);
assert.ok(Math.abs(bill.selectedOffer.quotaConsumi - 578.46546391) < 1e-9);
const monthlyBillSaving = 2742.1 * 0.226239 + 18 - bill.selectedOffer.quotaConsumi - 12;
assert.equal(bill.selectedOffer.annualSaving, Math.round(monthlyBillSaving * 12 * 100) / 100);
const costlyOffer = calculateEnergyQuote(input, variables, [{ ...base, pcv: 40 }]);
assert.equal(costlyOffer.selectedOffer.annualSaving, -214.44);
const twoMonthVariables = [...variables, ...variables.map(item => ({ ...item, monthKey: '2026-02' }))];
const twoMonths = calculateEnergyQuote({ ...input, secondMonthKey: '2026-02', consumptionMonth2: 100, currentSpend: 50 }, twoMonthVariables, [base]);
assert.equal(twoMonths.selectedOffer.annualSaving, variable.selectedOffer.annualSaving);

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
