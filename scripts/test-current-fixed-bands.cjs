const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText, filename);
};
const { calculateEnergyQuote, defaultEnergyQuoteInput } = require('../src/lib/quote-calculator.ts');
const { normalizeStore, addEnergyQuoteToStore } = require('../src/lib/client-store.ts');
const { parseQuoteUnitPrice } = require('../src/lib/normalize.ts');
assert.equal(parseQuoteUnitPrice('0,15'), .15);
assert.equal(parseQuoteUnitPrice('0.15'), .15);
assert.equal(parseQuoteUnitPrice(' 0,15 € '), .15);
assert.equal(parseQuoteUnitPrice('0'), 0);
assert.equal(parseQuoteUnitPrice(''), undefined);
assert.ok(Number.isNaN(parseQuoteUnitPrice('abc')));
assert.ok(Number.isNaN(parseQuoteUnitPrice('0,15,2')));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const variables = ['2026-07', '2026-08'].flatMap(monthKey => Object.entries({
  pun_mono: .1, pun_f1: .1, pun_f2: .1, pun_f3: .1, mercato_capacita: .002, dispacciamento: .003
}).map(([key, value]) => ({ key, monthKey, value })));
const bill = defaultEnergyQuoteInput({
  calculationModel: 'catalog', commodity: 'luce', customerType: 'RES', monthKey: '2026-07',
  currentLightPricing: 'fixed_bands', currentFixedF1Price: .1, currentFixedF2Price: .2, currentFixedF3Price: .3,
  currentFixedPricesIncludeLosses: true, currentOtherVariablePrice: .01,
  lightBandsComplete: true, currentPcv: 10, f1Month1: 100, f2Month1: 200, f3Month1: 300,
  // Vecchi valori eventualmente presenti: il costo deve dipendere dai prezzi fissi.
  currentAveragePrice: 999, currentSpend: 999, consumptionMonth1: 999
});
const base = { code: 'proposal', commodity: 'luce', customerType: 'RES', offerEasy: 'Test', pcv: 8, spread: .02 };
const scenarios = [
  { model: 'catalog', mode: 'totale', offer: base, quota: 77.22, saving: 849.36, savingTwo: 539.85 },
  { model: 'catalog', mode: 'fasce', offer: base, quota: 83.22, saving: 777.36, savingTwo: 494.85 },
  { model: 'catalog_fixed', mode: 'totale', offer: { ...base, pricingType: 'fixed', fixedPrice: .15 }, quota: 103.02, saving: 539.76, savingTwo: 346.35 },
  { model: 'catalog_fixed', mode: 'fasce', offer: { ...base, pricingType: 'fixed', fixedPrices: { f1: .12, f2: .14, f3: .16 }, requiresBands: true }, quota: 100.82, saving: 566.16, savingTwo: 362.85 }
];
for (const scenario of scenarios) {
  const input = { ...bill, calculationModel: scenario.model, lightConsumptionMode: scenario.mode };
  const result = calculateEnergyQuote(input, variables, [scenario.offer]);
  assert.equal(result.ready, true, result.warnings.join('; '));
  assert.equal(result.source.totalConsumption, 600);
  assert.equal(result.source.currentSpend, 146); // 100×0,10 + 200×0,20 + 300×0,30 + 600×0,01.
  assert.deepEqual(result.source.currentBandCosts, { f1: 10, f2: 40, f3: 90, other: 6 });
  close(result.source.currentAveragePrice, 146 / 600);
  close(result.selectedOffer.quotaConsumi, scenario.quota);
  close(result.selectedOffer.annualSaving, scenario.saving);
  const two = calculateEnergyQuote({ ...input, secondMonthKey: '2026-08', f1Month2: 25, f2Month2: 50, f3Month2: 75,
    consumptionMonth2: 0 }, variables, [scenario.offer]);
  assert.equal(two.ready, true);
  assert.equal(two.source.currentSpend, 182.5);
  assert.equal(two.source.totalConsumption, 750);
  assert.equal(two.source.annualConsumption, 4500);
  close(two.selectedOffer.annualSaving, scenario.savingTwo);
}
const quote = (overrides = {}, refs = variables) => calculateEnergyQuote({ ...bill, ...overrides }, refs, [base]);
const gross = quote();
const net = quote({ currentFixedPricesIncludeLosses: false });
assert.equal(net.source.currentSpend, 160); // Energia 140×1,10; altri costi 6, senza seconda maggiorazione.
close(net.selectedOffer.annualSaving - gross.selectedOffer.annualSaving, 168);
assert.equal(quote({ currentFixedPricesIncludeLosses: false, lightLossMode: 'media_alta' }).source.currentSpend, 151.32);
assert.equal(quote({ currentFixedF1Price: .15 }).source.currentSpend, 151);
assert.equal(quote({ currentOtherVariablePrice: .02 }).source.currentSpend, 152);
assert.equal(quote({ currentOtherVariablePrice: 0 }).source.currentSpend, 140);
assert.equal(quote({ currentFixedF1Price: 0 }).ready, true);
assert.equal(quote({ currentAveragePrice: 0, currentSpend: 0 }).ready, true);
assert.equal(quote({}, variables.map(item => ({ ...item, value: item.key.startsWith('pun') ? .99 : item.value }))).source.currentSpend, 146);
for (const overrides of [
  { currentFixedF1Price: undefined }, { currentFixedF2Price: undefined }, { currentFixedF3Price: undefined },
  { currentFixedF1Price: -.1 }, { currentFixedF1Price: NaN }, { currentFixedPricesIncludeLosses: undefined },
  { currentOtherVariablePrice: undefined }, { currentOtherVariablePrice: -.01 }, { lightBandsComplete: false },
  { f1Month1: -1 }
]) assert.equal(quote(overrides).ready, false, JSON.stringify(overrides));

const store = normalizeStore({});
addEnergyQuoteToStore(store, { calculationSnapshot: gross, inputSnapshot: bill });
const saved = JSON.parse(JSON.stringify(store.energyQuotes[0]));
assert.equal(saved.inputSnapshot.currentFixedF2Price, .2);
assert.equal(saved.inputSnapshot.currentFixedPricesIncludeLosses, true);
assert.equal(saved.inputSnapshot.currentOtherVariablePrice, .01);
assert.deepEqual(saved.calculationSnapshot.source.currentBandCosts, { f1: 10, f2: 40, f3: 90, other: 6 });
const reopened = defaultEnergyQuoteInput(saved.inputSnapshot);
assert.equal(calculateEnergyQuote(reopened, variables, [base]).source.currentSpend, 146);
quote({ currentFixedF1Price: .5 });
assert.equal(saved.calculationSnapshot.source.currentSpend, 146);
console.log('Current fixed band checks passed: manual F1/F2/F3 prices, four proposed tariff types, one/two months, losses once, separate other costs, missing inputs, PUN independence and saved snapshots.');
