const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, filename);
};
const { calculateEnergyQuote, defaultEnergyQuoteInput } = require('../src/lib/quote-calculator.ts');
const { defaultQuoteOffers, normalizeManagedOffers } = require('../src/lib/offers.ts');
const { metOfferCatalog } = require('../src/lib/met-offers.ts');
const { normalizeStore, addEnergyQuoteToStore } = require('../src/lib/client-store.ts');
const { offerPriceLabel } = require('../src/lib/met-calculator.ts');
const find = name => metOfferCatalog.find(offer => offer.offerEasy === `MET ${name}`);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const variables = Object.entries({
  pun_mono: 0.15704, pun_f1: 0.1542, pun_f2: 0.1693, pun_f3: 0.1522,
  mercato_capacita: 0.024466, dispacciamento: 0.010501,
  psv: 0.60661, m_gas: 0.52, mgp_gas: 0.5 // Gas: fixture, non valori storici reali.
}).map(([key, value]) => ({ key, monthKey: '2026-07', value }));
const bill = defaultEnergyQuoteInput({
  quoteDate: '2026-10-08', commodity: 'luce', customerType: 'BUS', monthKey: '2026-07',
  currentAveragePrice: 0.226239, currentPcv: 18,
  consumptionMonth1: 2742.1, lightConsumptionMode: 'fasce', lightBandsComplete: true,
  f1Month1: 611.2, f2Month1: 1271.6, f3Month1: 859.3
});
const quote = (offer, input = bill, refs = variables) => calculateEnergyQuote(input, refs, [offer]);

assert.equal(metOfferCatalog.length, 21);
assert.equal(metOfferCatalog.filter(offer => offer.commodity === 'luce').length, 13);
assert.equal(metOfferCatalog.filter(offer => offer.commodity === 'gas').length, 8);
assert.equal(new Set(metOfferCatalog.map(offer => offer.code)).size, 21);
assert.equal(metOfferCatalog.filter(offer => offer.requiresBands).length, 7);
assert.ok(metOfferCatalog.every(offer => offer.code.startsWith('026846') && offer.met.sourceFile.endsWith('.pdf')));
assert.equal(metOfferCatalog.filter(offer => offer.met.commissionFixed === undefined).length, 2);

// Prezzi netti originali CTE, con pesi reali della bolletta La Deliziosa.
const business24 = find('BUSINESS POWER FIX 24 MESI');
assert.deepEqual(business24.fixedPrices, { f1: 0.1651, f2: 0.1713, f3: 0.1519 });
const result = quote(business24);
assert.equal(result.ready, true);
close(result.selectedOffer.quotaConsumi, 610.88607459);
assert.equal(result.selectedOffer.annualSaving, 113.81);
assert.equal(result.selectedOffer.agencyCommission, 105.81);
assert.equal(result.selectedOffer.commissionKnown, true);
assert.match(result.selectedOffer.priceLabel, /F1 0,1651.*F2 0,1713.*F3 0,1519/);
// Il 2% è dell'indice mensile: non un importo fisso di 0,02 €/kWh.
const withoutFinance = quote({ ...business24, met: { ...business24.met, financialRate: 0 } });
close(result.selectedOffer.quotaConsumi - withoutFinance.selectedOffer.quotaConsumi, 8.61238768);
const reshuffled = quote(business24, { ...bill, f1Month1: 859.3, f3Month1: 611.2 });
assert.notEqual(reshuffled.selectedOffer.quotaConsumi, result.selectedOffer.quotaConsumi);
assert.equal(quote(business24, { ...bill, lightConsumptionMode: 'totale' }).ready, false);
assert.equal(quote(business24, { ...bill, lightBandsComplete: false }).ready, false);
assert.equal(quote(business24, { ...bill, f1Month1: -1 }).ready, false);
assert.equal(quote(business24, { ...bill, f1Month1: 0 }).ready, true); // Zero dichiarato valido.
const missingMonth = quote(business24, { ...bill, secondMonthKey: '2026-08', f1Month2: 1, f2Month2: 2, f3Month2: 3 });
assert.equal(missingMonth.ready, false);
assert.equal(missingMonth.warnings.length, new Set(missingMonth.warnings).size);
assert.ok(missingMonth.warnings.some(message => message.includes('2026-08')));
assert.equal(quote(business24, { ...bill, f1Month1: 5000 }).ready, false); // Limite 50.000/anno.

// Prezzo monorario lordo CTE: conversione al netto e applicazione singola delle perdite.
const family = find('FAMILY POWER FIX');
const homeInput = { ...bill, customerType: 'RES', lightConsumptionMode: 'totale', consumptionMonth1: 100 };
const home = quote(family, homeInput);
assert.equal(home.ready, true);
close(home.selectedOffer.quotaConsumi, 22.45171);
assert.equal(home.selectedOffer.pcv, 4.5); // 3,50 + servizio app 1.
assert.equal(home.selectedOffer.agencyCommission, 20);
assert.match(offerPriceLabel(family), /0,170091.*netto/);
close(quote(family, { ...homeInput, lightConsumptionMode: 'fasce', f1Month1: 10, f2Month1: 20, f3Month1: 70 }).selectedOffer.quotaConsumi, home.selectedOffer.quotaConsumi);
close(quote(family, { ...homeInput, lightLossMode: 'media_alta' }).selectedOffer.quotaConsumi, 22.3866038);
// Un prezzo singolo netto generico vale per tutte le fasce.
const generic = { code: 'single', offerEasy: 'Single', commodity: 'luce', customerType: 'RES', pcv: 5, spread: 0, pricingType: 'fixed', fixedPrice: 0.17 };
close(quote(generic, homeInput).selectedOffer.quotaConsumi, quote(generic, { ...homeInput, lightConsumptionMode: 'fasce', f1Month1: 10, f2Month1: 20, f3Month1: 70 }).selectedOffer.quotaConsumi);

// I costi CGF concordati sono omessi; le offerte restano simulabili e hanno una nota.
const one = quote(find('ONE POWER'));
assert.equal(one.ready, true);
assert.equal(one.selectedOffer.agencyCommission, 38.23);
assert.ok(one.selectedOffer.notices.some(note => note.includes('CGF')));
const calendar = find('CALENDAR FIX POWER 24 MESI');
assert.equal(quote(calendar).ready, false); // Cliente sotto il minimo CTE.
const largeClient = { ...bill, f1Month1: 20000, f2Month1: 30000, f3Month1: 50000 };
assert.equal(quote(calendar, largeClient).ready, true);
const calendarNoFinance = { ...calendar, met: { ...calendar.met, financialRate: 0 } };
close(quote(calendar, largeClient).selectedOffer.quotaConsumi, quote(calendarNoFinance, largeClient).selectedOffer.quotaConsumi);
close(quote(calendar, { ...largeClient, supplyStartDate: '2028-01-01' }).selectedOffer.quotaConsumi - quote(calendarNoFinance, { ...largeClient, supplyStartDate: '2028-01-01' }).selectedOffer.quotaConsumi, 314.08);

// ProMETto: prima del 2027 a indice, dopo al prezzo già scontato. Nessun secondo -30%.
const pro = find('4 HOME POWER FIX 24 ProMETto');
const proBefore = quote(pro, homeInput);
close(proBefore.selectedOffer.quotaConsumi, 23.81611);
assert.equal(proBefore.selectedOffer.commissionKnown, false);
assert.match(proBefore.selectedOffer.priceLabel, /fisso dal 2027-01-01/);
const proAfter = quote(pro, { ...homeInput, supplyStartDate: '2027-01-01' });
close(proAfter.selectedOffer.quotaConsumi, 16.21171);
assert.equal(proBefore.selectedOffer.annualSaving, 126.13); // 3 mesi indicizzati, 9 fissi + PCV.
close(quote(pro, { ...homeInput, lightHourlyMeter: false }).selectedOffer.quotaConsumi - proBefore.selectedOffer.quotaConsumi, 0.3);

// CER mista: solo F1 fissa, F2/F3 indicizzate, requisiti e rilevazione oraria.
const cer = find('CER MAKE ENERGY TOGETHER');
const cerInput = { ...homeInput, lightConsumptionMode: 'fasce', f1Month1: 10, f2Month1: 20, f3Month1: 70, cerMember: true };
const cerResult = quote(cer, cerInput);
close(cerResult.selectedOffer.quotaConsumi, 21.02271);
assert.equal(cerResult.ready, true);
assert.equal(quote(cer, { ...cerInput, cerMember: false }).ready, false);
assert.equal(quote(cer, { ...cerInput, lightLossMode: 'media_alta' }).ready, false);
close(quote(cer, { ...cerInput, lightHourlyMeter: false }).selectedOffer.quotaConsumi - cerResult.selectedOffer.quotaConsumi, 0.27);

// Gas: indice finanziario distinto da PSV, CSC e adeguamento PCS.
const gasInput = { ...homeInput, commodity: 'gas', customerType: 'BUS', gasAnnualConsumption: 1200, gasPcs: 0.03852, currentAveragePrice: 1, currentPcv: 18 };
const gas24 = find('BUSINESS GAS FIX 24 MESI');
const gas = quote(gas24, gasInput);
assert.equal(gas.ready, true);
close(gas.selectedOffer.quotaConsumi, 72.96);
assert.equal(gas.selectedOffer.annualSaving, 324.48);
assert.equal(gas.selectedOffer.agencyCommission, 68);
close(quote(gas24, { ...gasInput, gasPcs: 0.03852 * 1.1 }).selectedOffer.quotaConsumi, 80.156);
const noMgp = variables.filter(variable => variable.key !== 'mgp_gas');
assert.equal(quote(gas24, gasInput, noMgp).ready, false);
assert.match(quote(gas24, gasInput, noMgp).warnings.join(' '), /MGP-GAS/);
assert.equal(quote(gas24, { ...gasInput, gasPcs: 0 }).ready, false);
assert.equal(quote(find('FAMILY GAS FIX'), { ...gasInput, customerType: 'RES' }, noMgp).ready, true);
const gasPro = find('4 HOME GAS FIX 24 ProMETto');
close(quote(gasPro, { ...gasInput, customerType: 'RES' }).selectedOffer.quotaConsumi, 67);
assert.equal(quote(gasPro, { ...gasInput, customerType: 'RES' }, variables.filter(item => item.key !== 'm_gas')).ready, false);
const gasProAfter = quote(gasPro, { ...gasInput, customerType: 'RES', supplyStartDate: '2027-01-01' }, noMgp);
assert.equal(gasProAfter.ready, true);
close(gasProAfter.selectedOffer.quotaConsumi, 48.7);
assert.equal(gasProAfter.selectedOffer.commissionKnown, false);

// Una MET incompleta non blocca le altre offerte; override e snapshot persistono.
const agf = defaultQuoteOffers().find(offer => offer.code === 'AGF_GAS_MANCINI GROUP_BUSINESS FIDELITY');
assert.equal(calculateEnergyQuote({ ...gasInput, selectedOfferCode: agf.code }, noMgp).ready, true);
const managed = defaultQuoteOffers().find(offer => offer.code === business24.code);
assert.equal(normalizeManagedOffers([{ ...managed, active: false }]).filter(offer => offer.supplier === 'MET').length, 21);
assert.equal(normalizeManagedOffers([{ ...managed, active: false }]).find(offer => offer.id === managed.id).active, false);
const store = normalizeStore({});
addEnergyQuoteToStore(store, { calculationSnapshot: result, inputSnapshot: bill });
const archived = JSON.parse(JSON.stringify(store.energyQuotes[0]));
assert.equal(archived.calculationSnapshot.selectedOffer.priceLabel, result.selectedOffer.priceLabel);
assert.equal(archived.inputSnapshot.lightBandsComplete, true);
assert.equal(archived.calculationSnapshot.selectedOffer.agencyCommission, 105.81);
console.log('MET checks passed: 21 CTE, net/gross losses, weighted bands, fees, direct commissions, eligibility, phases, gas indices/PCS, snapshots.');
