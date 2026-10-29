const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText, filename);
};
const { calculateEnergyQuote, defaultEnergyQuoteInput } = require('../src/lib/quote-calculator.ts');
const { defaultQuoteOffers, lightLossesForOffer } = require('../src/lib/offers.ts');
const { excelModel } = require('../src/lib/excel-formulas.ts');
const { fixedExcelReference: reference } = require('../src/lib/fixed-excel-reference.ts');
const { normalizeStore, addEnergyQuoteToStore } = require('../src/lib/client-store.ts');
const { formatSavingImpact, quotePeriodComparison } = require('../src/lib/quote-presentation.ts');
const fixture = require('./fixtures/fixed-excel-cases.json');
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
const catalog = defaultQuoteOffers();
const variables = ['2026-07', '2026-08'].flatMap(monthKey => Object.entries({
  pun_mono: .15, pun_f1: .14, pun_f2: .17, pun_f3: .13,
  mercato_capacita: .02, dispacciamento: .01, psv: .6, m_gas: .5, mgp_gas: .5
}).map(([key, value]) => ({ key, value, monthKey })));
const base = defaultEnergyQuoteInput({
  calculationModel: 'catalog_fixed', quoteDate: '2026-10-20', supplyStartDate: '2026-10-20',
  commodity: 'luce', customerType: 'RES', monthKey: '2026-07',
  currentAveragePrice: .4, currentPcv: 12, consumptionMonth1: 100,
  lightConsumptionMode: 'fasce', lightBandsComplete: true,
  f1Month1: 50, f2Month1: 30, f3Month1: 20, gasAnnualConsumption: 1200
});

// Confronto con le formule originali H50/G33. Si sostituiscono solo i parametri:
// listino, PCV completa, perdite, indici e componenti accessorie delle CTE correnti.
// La fonte originale e le fixture ricalcolate indipendentemente restano intatte.
let parityChecks = 0;
for (const commodity of ['luce', 'gas']) {
  const sheet = commodity === 'luce' ? 'SIMULATORE_LUCE FISSO' : 'SIMULATORE_GAS FISSO';
  for (const customerType of ['RES', 'BUS']) {
    const staticOffers = catalog.filter(offer => offer.commodity === commodity && offer.customerType === customerType &&
      offer.pricingType === 'fixed' && offer.met && !offer.met.fixedStartDate && !offer.met.energyModel &&
      !offer.met.financialFrom);
    for (const offer of staticOffers) {
      for (const monthCount of [1, 2]) {
        for (const currentPcv of [0, 12]) {
          const input = { ...base, commodity, customerType, currentPcv, selectedOfferCode: offer.code,
            secondMonthKey: monthCount === 2 ? '2026-08' : '',
            f1Month2: monthCount === 2 ? 25 : 0, f2Month2: monthCount === 2 ? 15 : 0, f3Month2: monthCount === 2 ? 10 : 0,
            consumptionMonth2: monthCount === 2 ? 50 : 0, currentAveragePrice: commodity === 'gas' ? 1 : .4 };
          const result = calculateEnergyQuote(input, variables, catalog);
          assert.equal(result.ready, true, `${offer.offerEasy}: ${result.warnings}`);
          const terms = offer.met;
          const pcv = offer.pcv + terms.monthlyServiceFee;
          let overrides;
          if (commodity === 'luce') {
            const losses = lightLossesForOffer(offer);
            const fixedLoss = losses.fixedPrice ? 1.1 : 1;
            const prices = offer.fixedPrices ?? { f1: offer.fixedPrice, f2: offer.fixedPrice, f3: offer.fixedPrice };
            const net = value => terms.priceBasis === 'gross' ? value / fixedLoss : value;
            overrides = {
              E4: input.currentAveragePrice, F4: currentPcv,
              E6: 'LUGLIO', F6: monthCount === 2 ? 'AGOSTO' : null, E8: 'A FASCE', E21: 1.1,
              E14: .2, E15: .22, E16: .18,
              F14: input.f1Month1 + input.f1Month2, F15: input.f2Month1 + input.f2Month2, F16: input.f3Month1 + input.f3Month2,
              E27: net(prices.f1) * fixedLoss / 1.1, F27: net(prices.f2) * fixedLoss / 1.1, G27: net(prices.f3) * fixedLoss / 1.1,
              H27: pcv,
              I27: terms.commercialPerUnit + (terms.financialRate ?? 0) * .15 + (customerType === 'BUS' ? 0 : .0014),
              G15: .02 * (losses.capacity ? 1.1 : 1), G16: .01 * (losses.dispatching ? 1.1 : 1)
            };
          } else {
            overrides = {
              // Il foglio sottrae 0,015 dal prezzo medio: neutralizziamo questa
              // rettifica nei soli parametri del confronto con le CTE del catalogo.
              E4: input.currentAveragePrice + .015, F4: currentPcv, E8: input.gasAnnualConsumption,
              E33: pcv, F33: offer.fixedPrice + (terms.gasCsc ?? 0) + terms.commercialPerUnit + (terms.financialRate ?? 0) * .6
            };
          }
          const expected = excelModel(reference.sheets, { [sheet]: overrides }).number(sheet, commodity === 'luce' ? 'H50' : 'G33');
          assert.equal(result.selectedOffer.annualDifference, money(expected), `${offer.offerEasy}, ${monthCount} mesi, PCV ${currentPcv}`);
          near(result.selectedOffer.annualSaving, money(-expected), offer.offerEasy);
          parityChecks++;
        }
      }
    }
  }
}
assert.ok(parityChecks >= 60);

// Stessi dati, selezione coerente in UI e salvataggio, aggiornamenti del catalogo.
const family = catalog.find(offer => offer.offerEasy === 'MET FAMILY POWER FIX');
const monorary = { ...base, lightConsumptionMode: 'totale', selectedOfferCode: family.code };
const first = calculateEnergyQuote(monorary, variables, catalog);
assert.equal(first.ready, true);
assert.ok(first.offers.every(offer => offer.pricingType === 'fixed'));
assert.ok(calculateEnergyQuote({ ...base, calculationModel: 'catalog' }, variables, catalog).offers.every(offer => offer.pricingType !== 'fixed'));
const updated = catalog.map(offer => offer.code === family.code ? { ...offer, fixedPrice: offer.fixedPrice + .01, pcv: offer.pcv + 1 } : offer);
const next = calculateEnergyQuote(monorary, variables, updated);
near(first.selectedOffer.annualSaving - next.selectedOffer.annualSaving, 24, 'Aggiornamento prezzo lordo + PCV');
assert.ok(!calculateEnergyQuote(monorary, variables, [{ ...family, active: false }]).ready);
assert.ok(!calculateEnergyQuote(monorary, variables.filter(item => item.key !== 'dispacciamento'), catalog).ready);

// Due mesi con consumi diversi: consumo totale / mesi, senza usare solo il primo.
const twoMonths = calculateEnergyQuote({ ...monorary, secondMonthKey: '2026-08', consumptionMonth2: 200 }, variables, catalog);
assert.equal(twoMonths.source.annualConsumption, 1800);
near(twoMonths.selectedOffer.annualSaving, money((.4 * 300 - twoMonths.selectedOffer.quotaConsumi) * 6 + (12 - twoMonths.selectedOffer.pcv) * 12), 'Annualizzazione');
// Regressione prospetto: quota proposta maggiore = maggior costo del periodo,
// includendo entrambe le PCV per tutti i mesi, anche se uno snapshot storico
// riporta una proiezione annua che attraversa fasi tariffarie diverse.
const screenshotCalculation = { ...twoMonths,
  source: { ...twoMonths.source, currentSpend: 126.66, currentPcv: 11.89, periodCount: 2 },
  selectedOffer: { ...twoMonths.selectedOffer, quotaConsumi: 161.69, pcv: 12, annualSaving: 26.29 } };
assert.deepEqual(quotePeriodComparison(screenshotCalculation, base), {
  currentCost: 150.44, proposedCost: 185.69, saving: -35.25, annualOnly: false
});
assert.match(formatSavingImpact(-35.25), /^-35,25/);
assert.match(formatSavingImpact(26.29), /^\+26,29/);
assert.doesNotMatch(formatSavingImpact(0), /^[+-]/);
const period = quotePeriodComparison(twoMonths, base);
near(period.saving, money(period.currentCost - period.proposedCost), 'Totali confrontati del periodo');
assert.ok(Math.abs(period.saving * 6 - twoMonths.selectedOffer.annualSaving) <= .03);
const unknownCost = { ...screenshotCalculation, selectedOffer: { ...screenshotCalculation.selectedOffer, quotaConsumiKnown: false } };
assert.equal(quotePeriodComparison(unknownCost, base).saving, undefined);
assert.equal(quotePeriodComparison({ ...screenshotCalculation, selectedOffer: undefined }, base).saving, undefined);
assert.equal(quotePeriodComparison(screenshotCalculation, { calculationModel: 'fixed_excel', commodity: 'luce' }).saving, 4.38);
assert.equal(quotePeriodComparison(screenshotCalculation, { calculationModel: 'fixed_excel', commodity: 'gas' }).saving, 26.29);
// ProMETto corretta: stesso periodo fisso per quota proposta e proiezione annua.
const pro = catalog.find(offer => offer.offerEasy === 'MET 4 HOME POWER FIX 24 ProMETto');
const proInput = { ...base, lightConsumptionMode: 'totale', selectedOfferCode: pro.code,
  consumptionMonth1: 300, consumptionMonth2: 371.5, secondMonthKey: '2026-08', currentSpend: 126.66, currentPcv: 11.89 };
const proCalculation = calculateEnergyQuote(proInput, variables, catalog);
assert.equal(proCalculation.ready, true);
const proPeriod = quotePeriodComparison(proCalculation, proInput);
assert.ok(proPeriod.saving > 0);
assert.ok(Math.abs(proPeriod.saving * 6 - proCalculation.selectedOffer.annualSaving) <= .03);
const business = catalog.find(offer => offer.offerEasy === 'MET BUSINESS POWER FIX 24 MESI');
assert.equal(calculateEnergyQuote({ ...base, customerType: 'BUS', lightBandsComplete: false, selectedOfferCode: business.code }, variables, catalog).ready, false);
assert.equal(calculateEnergyQuote({ ...base, customerType: 'BUS', selectedOfferCode: business.code, lightConsumptionMode: 'totale' }, variables, catalog).ready, false);

// Prezzo fisso gas generico: stesso confronto fra costi del periodo e annui.
const gasOffer = { code: 'fixed-gas', offerEasy: 'Gas', commodity: 'gas', customerType: 'RES', pcv: 8, spread: 0, pricingType: 'fixed', fixedPrice: .7 };
const gas = calculateEnergyQuote({ ...monorary, commodity: 'gas', currentAveragePrice: 1, gasAnnualConsumption: 1200 }, variables, [gasOffer]);
assert.equal(gas.selectedOffer.annualSaving, 408);
const store = normalizeStore({});
addEnergyQuoteToStore(store, { calculationSnapshot: first, inputSnapshot: monorary });
const snapshot = JSON.parse(JSON.stringify(store.energyQuotes[0]));
assert.equal(snapshot.inputSnapshot.calculationModel, 'catalog_fixed');
assert.equal(snapshot.calculationSnapshot.selectedOffer.fixedPrice, family.fixedPrice);
assert.notEqual(snapshot.calculationSnapshot.selectedOffer.annualSaving, next.selectedOffer.annualSaving);

// Differenze rispetto all'Excel non normalizzato: documentate, mai occultate.
const rawInput = fixture.cases.find(item => item.name === 'luce-res-1-mese').input;
const raw = calculateEnergyQuote(defaultEnergyQuoteInput(rawInput), []);
const worksheet = excelModel(reference.sheets, { 'SIMULATORE_LUCE FISSO': {
  E4: rawInput.currentAveragePrice, F4: rawInput.currentPcv, E6: 'AGOSTO', E8: 'MONORARIA', E11: .2, F11: 100
} });
const changedWorksheet = excelModel(reference.sheets, { 'SIMULATORE_LUCE FISSO': {
  E4: rawInput.currentAveragePrice, F4: rawInput.currentPcv, E6: 'AGOSTO', E8: 'MONORARIA', E11: .2, F11: 100, E33: .9
} });
// Nel ramo monorario H50 usa le celle delle fasce vuote e ignora il nuovo prezzo.
assert.equal(worksheet.number('SIMULATORE_LUCE FISSO', 'H50'), changedWorksheet.number('SIMULATORE_LUCE FISSO', 'H50'));
const plain = defaultEnergyQuoteInput({ ...base, ...rawInput, calculationModel: 'catalog_fixed',
  selectedOfferCode: family.code, f1Month1: 50, f2Month1: 30, f3Month1: 20 });
const august = variables.filter(item => item.monthKey === '2026-08');
// Variabili dell'Excel originale, lette senza modificarne il foglio.
const original = excelModel(reference.sheets, {});
const originalVariables = august.map(item => ({ ...item, value: item.key === 'mercato_capacita'
  ? original.number('PUN', 'C11') : item.key === 'dispacciamento' ? original.number('PUN', 'D11') : item.value }));
const current = calculateEnergyQuote(plain, originalVariables, catalog);
console.log(`Fixed catalog checks passed: ${parityChecks} confronti Excel con parametri allineati; catalogo attivo, aggiornamenti, monoraria, fasce obbligatorie, annualizzazione, gas e snapshot.`);
console.log(`Esempio FAMILY, 100 kWh: risparmio annuo Excel originale ${raw.selectedOffer.annualSaving.toFixed(2)} EUR; catalogo corrente ${current.selectedOffer.annualSaving.toFixed(2)} EUR. Listino e condizioni diversi: non è parità dei dati.`);
