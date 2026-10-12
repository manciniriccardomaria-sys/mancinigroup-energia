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
const fixed = require('./fixtures/fixed-excel-cases.json');
const variable = require('./fixtures/variable-before-fixed.json');
assert.equal(fixed.sha256, reference.sha256);
let comparisons = 0;
for (const scenario of fixed.cases) {
  const result = calculateEnergyQuote(defaultEnergyQuoteInput(scenario.input), []);
  assert.equal(result.ready, true, `${scenario.name}: ${result.warnings.join('; ')}`);
  for (const [row, expected] of Object.entries(scenario.expected)) {
    const offer = result.offers.find((item) => item.code.endsWith(`_${row}`));
    assert.ok(offer, `${scenario.name}, row ${row}`);
    if (typeof expected === 'string') {
      assert.equal(offer.available, false);
      assert.ok(offer.issues.some((issue) => issue.includes('Calcolo non disponibile')));
      continue;
    }
    assert.equal(offer.available, true, `${scenario.name}, row ${row}: ${offer.issues}`);
    assert.ok(Math.abs(offer.annualDifferenceExact - expected) < 1e-9, `${scenario.name}, row ${row}: ${offer.annualDifferenceExact} != Excel ${expected}`);
    assert.equal(offer.annualDifference, Math.round((expected + Number.EPSILON) * 100) / 100);
    assert.equal(offer.quotaConsumiKnown, false);
    assert.equal(offer.commissionKnown, false);
    comparisons++;
  }
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
const model = excelModel({ Test: { A1: '=IF(1=1,12,#REF!)', A2: '=1/0', A3: '=SUM(B1:B3)', B1: 0, B2: 5, B3: null } });
assert.equal(model.number('Test', 'A1'), 12);
assert.equal(model.number('Test', 'A3'), 5);
assert.throws(() => model.number('Test', 'A2'), (error) => error instanceof ExcelFormulaError && error.code === '#DIV/0!');
console.log(`Fixed Excel checks passed: ${comparisons} worksheet outputs, ${variable.cases.length} unchanged variable scenarios, missing inputs and incomplete references.`);
