import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { deflateRawSync } from 'node:zlib';
import { decodeGmeResponse, electricityQuote, gasQuote, fetchGmeMarkets, mergeMarketResults, romeDay } from './gme-market-client.mjs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { parseMarketSnapshot, quoteIsOld } = require('../src/lib/market-snapshot.ts');

function crc32(content) {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function packed(rows, method = 8) {
  const content = Buffer.from(JSON.stringify(rows));
  const compressed = method === 8 ? deflateRawSync(content) : content;
  const name = Buffer.from('results.json');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(method, 8);
  header.writeUInt32LE(crc32(content), 14); header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(content.length, 22); header.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(method, 10); central.writeUInt32LE(crc32(content), 16);
  central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(header.length + name.length + compressed.length, 16);
  return { FormatType: '.json.zip', ContentResponse: Buffer.concat([header, name, compressed, central, name, end]).toString('base64') };
}
const now = new Date('2026-10-29T12:00:00Z');
const hours = (day, count = 24, price = 120) => Array.from({ length: count }, (_, hour) => ({
  FlowDate: day, Hour: hour + 1, Market: 'MGP', Zone: 'PUN', Price: price
}));
const electricRows = [...hours(20261028), ...hours(20261029, 24, 150), ...hours(20261030, 24, 999),
  ...hours(20261029).map(row => ({ ...row, Zone: 'NORD', Price: 800 }))];
const gasRows = [{ FlowDate: 20261029, Market: 'MGP', Product: 'DAY', AveragePrice: 40, MWhVolumes: 10 },
  { FlowDate: 20261030, Market: 'MGP', Product: 'DAY', AveragePrice: 999, MWhVolumes: 10 }];
assert.equal(romeDay(new Date('2026-10-28T23:30:00Z')), '2026-10-29');
assert.deepEqual(decodeGmeResponse(packed(gasRows)), gasRows);
assert.deepEqual(decodeGmeResponse(packed(gasRows, 0)), gasRows);
assert.throws(() => decodeGmeResponse({ FormatType: '.xml.zip', ContentResponse: '' }));
assert.throws(() => decodeGmeResponse({ FormatType: '.json.zip', ContentResponse: 'bad' }));
assert.throws(() => decodeGmeResponse(packed({ error: 'unexpected' })));
const corrupted = packed(gasRows, 0);
const zip = Buffer.from(corrupted.ContentResponse, 'base64'); zip[45] ^= 1;
assert.throws(() => decodeGmeResponse({ ...corrupted, ContentResponse: zip.toString('base64') }), /Integrita/);

const electricity = electricityQuote(electricRows, now);
assert.equal(electricity.value, 0.15);
assert.equal(electricity.referenceDate, '2026-10-29');
assert.equal(electricityQuote([...hours(20261028), ...hours(20261029, 12)], now).referenceDate, '2026-10-28');
assert.throws(() => electricityQuote(hours(20261029, 24).map(row => ({ ...row, Hour: 1 })), now));
assert.throws(() => electricityQuote(hours(20261029).map(row => ({ ...row, Price: null })), now));
assert.equal(electricityQuote(hours(20260329, 23), new Date('2026-03-29T18:00:00Z')).value, 0.12);
assert.equal(electricityQuote(hours(20261025, 25), new Date('2026-10-25T18:00:00Z')).value, 0.12);
assert.equal(electricityQuote(hours(20261029, 24, -10), now).value, -0.01);
const gas = gasQuote(gasRows, now);
assert.equal(gas.value, 0.428);
assert.equal(gas.referenceDate, '2026-10-29');
assert.throws(() => gasQuote([{ ...gasRows[0], AveragePrice: null }], now));
assert.throws(() => gasQuote([{ ...gasRows[0], MWhVolumes: 0 }], now));
const mixedProducts = [gasRows[0], { ...gasRows[0], Product: 'WEEKEND', AveragePrice: 100 }];
assert.throws(() => gasQuote(mixedProducts, now), /ambigui/);
assert.equal(gasQuote(mixedProducts, now, 'DAY').value, 0.428);

const requests = [];
const fetchImpl = async (url, options) => {
  requests.push({ url, ...options, body: JSON.parse(options.body) });
  const response = url.endsWith('/Auth') ? { Success: true, token: 'test-secret' }
    : packed(JSON.parse(options.body).DataName === 'ME_ZonalPrices' ? electricRows : gasRows);
  return { ok: true, text: async () => JSON.stringify(response) };
};
const results = await fetchGmeMarkets({ login: 'test-login', password: 'test-password', now, fetchImpl });
assert.equal(requests.length, 3);
assert.equal(requests[1].headers.Authorization, 'Bearer test-secret');
assert.deepEqual(requests[1].body.Attributes, { GranularityType: 'PT60' });
assert.equal(requests[2].body.Segment, 'MGP-GAS');
assert.equal(requests[1].body.IntervalEnd, 20261029);
assert.equal(results.gas.quote.value, 0.428);
assert.equal(results.electricity.quote.value, 0.15);
await assert.rejects(fetchGmeMarkets({ login: 'x', password: 'y', now,
  fetchImpl: async () => ({ ok: false, status: 401 }) }), /HTTP 401/);
const previous = mergeMarketResults(undefined, results, now);
const untouched = JSON.stringify(previous);
const failure = mergeMarketResults(previous, { electricity: { error: 'offline' }, gas: { error: 'offline' } }, new Date(now.getTime() + 3600000));
assert.equal(failure.state, 'error');
assert.deepEqual(failure.electricity, electricity);
assert.deepEqual(failure.gas, gas);
assert.equal(JSON.stringify(previous), untouched);
const partial = mergeMarketResults(previous, { electricity: { quote: electricity }, gas: { error: 'offline' } }, now);
assert.equal(partial.state, 'partial');
assert.deepEqual(partial.gas, gas);
const regressed = mergeMarketResults(previous, { electricity: { quote: { ...electricity, referenceDate: '2026-10-28' } } }, now);
assert.equal(regressed.electricity.referenceDate, '2026-10-29');
assert.ok(parseMarketSnapshot(previous));
assert.equal(parseMarketSnapshot({ ...previous, gas: { ...gas, value: 40 } }), undefined);
assert.equal(parseMarketSnapshot({ ...previous, electricity: { ...electricity, referenceDate: '2026-02-30' } }), undefined);
assert.equal(quoteIsOld(electricity, now.getTime()), false);
assert.equal(quoteIsOld(electricity, now.getTime() + 7 * 3600000), true);
console.log('Market prices: API/ZIP validation, daily mean, units, DST, product ambiguity, partial failure, stale data and no regression passed.');
