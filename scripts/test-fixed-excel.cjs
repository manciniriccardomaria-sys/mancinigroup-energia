const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText, filename);
};
const { calculateEnergyQuote, defaultEnergyQuoteInput } = require('../src/lib/quote-calculator.ts');
const { defaultQuoteOffers } = require('../src/lib/offers.ts');
const { excelModel, ExcelFormulaError } = require('../src/lib/excel-formulas.ts');
const { fixedExcelReference: reference } = require('../src/lib/fixed-excel-reference.ts');
const { quoteCostComparison } = require('../src/lib/quote-costs.ts');
const fixed = require('./fixtures/fixed-excel-cases.json');
const variable = require('./fixtures/variable-before-fixed.json');
assert.equal(fixed.sha256, reference.sha256);
let comparisons = 0;
// These worksheet branches inflated current costs by clamping their residual
// to zero, or used empty band cells for a monoraria quote. Costs now drive savings.
const correctedCases = new Set(['luce-bus-luglio-2-mesi', 'luce-res-residuo-zero', 'luce-res-monoraria', 'luce-bus-monoraria']);
for (const scenario of fixed.cases) {
  const result = calculateEnergyQuote(defaultEnergyQuoteInput(scenario.input), []);
  assert.equal(result.ready, scenario.name !== 'luce-bus-monoraria', `${scenario.name}: ${result.warnings.join('; ')}`);
  for (const [row, expected] of Object.entries(scenario.expected)) {
    const offer = result.offers.find((item) => item.code.endsWith(`_${row}`));
    assert.ok(offer, `${scenario.name}, row ${row}`);
    if (typeof expected === 'string' || scenario.name === 'luce-bus-monoraria') {
      assert.equal(offer.available, false);
      assert.equal(offer.quotaConsumiKnown, false);
      assert.ok(offer.issues.some((issue) => issue.includes('F1, F2 e F3')));
      continue;
    }
    assert.equal(offer.available, true, `${scenario.name}, row ${row}: ${offer.issues}`);
    if (!correctedCases.has(scenario.name)) {
      assert.ok(Math.abs(offer.annualDifferenceExact - expected) < 1e-9, `${scenario.name}, row ${row}: ${offer.annualDifferenceExact} != Excel ${expected}`);
      assert.equal(offer.annualDifference, Math.round((expected + Number.EPSILON) * 100) / 100);
      comparisons++;
    }
    assert.equal(offer.quotaConsumiKnown, true);
    assert.equal(offer.commissionKnown, false);
    const costs = quoteCostComparison(result, offer);
    assert.equal(costs.proposedCostKnown, true);
    assert.equal(costs.currentCostKnown, true);
    assert.ok(Math.abs(offer.annualDifferenceExact + costs.saving * 12 / result.source.periodCount) < 1e-9);
  }
}
// Independent cost examples from the tariff table: price × consumption,
// ancillary components, then monthly PCV × the comparison's months.
const costCases = [
  ['luce-res-1-mese', 50, 19.9289, 42, 23.4289, 222.85],
  ['luce-res-1-mese', 53, 14.77977268, 42, 23.77977268, 218.64],
  ['luce-res-2-mesi', 50, 199.289, 324, 206.289, 706.27],
  ['luce-bus-1-mese', 50, 466.860911, 614.75, 481.860911, 1594.67],
  ['luce-bus-luglio-2-mesi', 50, 313.136, 324, 343.136, -114.82],
  ['luce-res-residuo-zero', 51, 21.1289, 24, 29.1289, -61.55],
  ['luce-res-monoraria', 50, 19.9289, 42, 23.4289, 222.85],
  ['gas-res', 33, 747, 1020, 801, 219],
  ['gas-bus', 33, 4125, 4620, 4341, 279],
  ['gas-res-pcv-zero', 33, 896.4, 840, 950.4, -110.4]
];
for (const [name, row, quota, current, proposed, saving] of costCases) {
  const input = fixed.cases.find(scenario => scenario.name === name).input;
  const result = calculateEnergyQuote(defaultEnergyQuoteInput(input), []);
  const offer = result.offers.find(offer => offer.code.endsWith(`_${row}`));
  const costs = quoteCostComparison(result, offer);
  assert.ok(Math.abs(offer.quotaConsumi - quota) < 1e-9, `${name}: quota consumi`);
  assert.ok(Math.abs(costs.currentCost - current) < 1e-9, `${name}: costo attuale`);
  assert.ok(Math.abs(costs.proposedCost - proposed) < 1e-9, `${name}: costo proposto`);
  assert.equal(offer.annualSaving, saving, `${name}: risparmio`);
  assert.deepEqual(quoteCostComparison(JSON.parse(JSON.stringify(result)), offer), costs, 'Saved costs');
  assert.equal(costs.annual, input.commodity === 'gas');
}
const catalog = defaultQuoteOffers().filter((offer) => !offer.met);
for (const scenario of variable.cases) {
  const result = calculateEnergyQuote(defaultEnergyQuoteInput(scenario.input), variable.variables, catalog);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), scenario.expected, `Variable regression: ${scenario.name}`);
}
const gas = fixed.cases.find((scenario) => scenario.name === 'gas-res').input;
assert.equal(calculateEnergyQuote(defaultEnergyQuoteInput({ ...gas, gasAnnualConsumption: 0 }), []).ready, false);
assert.equal(calculateEnergyQuote(defaultEnergyQuoteInput({ ...gas, gasAnnualConsumption: 1, currentAveragePrice: .752, currentPcv: 4.5 }), []).selectedOffer.annualDifference, -.01);
assert.equal(calculateEnergyQuote(defaultEnergyQuoteInput({ ...gas, gasAnnualConsumption: 1, currentAveragePrice: .742, currentPcv: 4.5 }), []).selectedOffer.annualDifference, .01);
const light = fixed.cases[0].input;
assert.equal(calculateEnergyQuote(defaultEnergyQuoteInput({ ...light, excelCurrentF1Price: undefined }), []).ready, false);
assert.equal(calculateEnergyQuote(defaultEnergyQuoteInput({ ...light, excelConsumptionF1: undefined }), []).ready, false);
assert.equal(calculateEnergyQuote(defaultEnergyQuoteInput({ ...light, monthKey: '' }), []).ready, false);
assert.equal(calculateEnergyQuote(defaultEnergyQuoteInput({ ...light, excelConsumptionF1: 0 }), []).ready, true);
const incomplete = calculateEnergyQuote(defaultEnergyQuoteInput({ ...gas, selectedOfferCode: 'EXCEL_FIXED_GAS_RES_38' }), []);
assert.equal(incomplete.ready, false);
assert.equal(quoteCostComparison(incomplete).proposedCostKnown, false);
const legacyGas = calculateEnergyQuote(defaultEnergyQuoteInput(gas), []);
delete legacyGas.source.costBasis;
legacyGas.source.currentSpend = 0;
legacyGas.source.periodCount = 1;
legacyGas.selectedOffer.quotaConsumiKnown = false;
assert.equal(quoteCostComparison(legacyGas).currentCostKnown, false);
assert.equal(quoteCostComparison(legacyGas).proposedCostKnown, false);
const mono = fixed.cases.find(scenario => scenario.name === 'luce-res-monoraria').input;
const withStaleBands = calculateEnergyQuote(defaultEnergyQuoteInput({ ...mono, excelConsumptionF1: 999, excelConsumptionF2: 888, excelConsumptionF3: 777 }), []);
assert.equal(withStaleBands.selectedOffer.quotaConsumi, 19.9289);
assert.equal(withStaleBands.selectedOffer.annualSaving, 222.85);
assert.equal(calculateEnergyQuote(defaultEnergyQuoteInput({ ...gas, gasAnnualConsumption: Infinity }), []).ready, false);
const model = excelModel({ Test: { A1: '=IF(1=1,12,#REF!)', A2: '=1/0', A3: '=SUM(B1:B3)', B1: 0, B2: 5, B3: null } });
assert.equal(model.number('Test', 'A1'), 12);
assert.equal(model.number('Test', 'A3'), 5);
assert.throws(() => model.number('Test', 'A2'), (error) => error instanceof ExcelFormulaError && error.code === '#DIV/0!');
console.log(`Fixed cost checks passed: ${costCases.length} cost examples, ${comparisons} consistent worksheet outputs, ${variable.cases.length} unchanged variable scenarios, saved costs, missing bands and incomplete references.`);
