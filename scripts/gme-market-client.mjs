import { inflateRawSync } from 'node:zlib';

const BASE_URL = 'https://api.mercatoelettrico.org/request/api/v1';
const MAX_BYTES = 8 * 1024 * 1024;

// GME returns base64 ZIP, with one JSON file. Never extract files to disk.
export function decodeGmeResponse(response) {
  if (response?.FormatType !== '.json.zip' || typeof response.ContentResponse !== 'string' ||
      response.ContentResponse.length > MAX_BYTES * 2) throw new Error('Formato risposta GME non valido.');
  const zip = Buffer.from(response.ContentResponse, 'base64');
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i + 20) === zip.length) { end = i; break; }
  }
  if (end < 0 || zip.readUInt16LE(end + 4) !== 0 || zip.readUInt16LE(end + 6) !== 0 ||
      zip.readUInt16LE(end + 10) !== 1) throw new Error('Archivio GME non valido.');
  const central = zip.readUInt32LE(end + 16);
  if (central + 46 > end || zip.readUInt32LE(central) !== 0x02014b50) throw new Error('Indice ZIP non valido.');
  const flags = zip.readUInt16LE(central + 8);
  const method = zip.readUInt16LE(central + 10);
  const compressedSize = zip.readUInt32LE(central + 20);
  const size = zip.readUInt32LE(central + 24);
  const filenameLength = zip.readUInt16LE(central + 28);
  const filename = zip.toString('utf8', central + 46, central + 46 + filenameLength);
  const local = zip.readUInt32LE(central + 42);
  if (flags & 1 || size > MAX_BYTES || compressedSize > MAX_BYTES || !filename.endsWith('.json') ||
      local + 30 > central || zip.readUInt32LE(local) !== 0x04034b50) throw new Error('Contenuto ZIP non valido.');
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  if (start + compressedSize > central) throw new Error('Archivio ZIP incompleto.');
  const compressed = zip.subarray(start, start + compressedSize);
  const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed, { maxOutputLength: MAX_BYTES }) : undefined;
  if (!content || content.length !== size) throw new Error('Compressione ZIP non supportata.');
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  if (((crc ^ 0xffffffff) >>> 0) !== zip.readUInt32LE(central + 16)) throw new Error('Integrita ZIP non valida.');
  const rows = JSON.parse(content.toString('utf8').replace(/^\uFEFF/, ''));
  if (!Array.isArray(rows)) throw new Error('Schema dati GME inatteso: previsto elenco JSON.');
  return rows;
}

function isoDay(value) {
  const raw = String(value);
  if (!/^\d{8}$/.test(raw)) return undefined;
  const day = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
  const time = Date.parse(day);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day ? day : undefined;
}

export function romeDay(now) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function expectedHours(day) {
  const midnight = Date.parse(day);
  const offset = value => {
    const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
      .formatToParts(value).find(part => part.type === 'timeZoneName').value;
    const match = zone.match(/GMT([+-])(\d{2}):(\d{2})/);
    return match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '+' ? 1 : -1) : 0;
  };
  return 24 + (offset(midnight) - offset(midnight + 86400000)) / 60;
}

export function electricityQuote(rows, now = new Date()) {
  const today = romeDay(now);
  const days = new Map();
  for (const row of rows) {
    const day = isoDay(row.FlowDate);
    if (row.Market !== 'MGP' || row.Zone !== 'PUN' || !day || day > today) continue;
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(row);
  }
  for (const day of [...days.keys()].sort().reverse()) {
    const items = days.get(day);
    const hours = items.map(item => item.Hour);
    const count = expectedHours(day);
    // Do not show a partial day's mean, a zonal price, or tomorrow's price as today's.
    if (items.length !== count || new Set(hours).size !== count ||
        !items.every(item => Number.isInteger(item.Hour) && item.Hour >= 1 && item.Hour <= count &&
          typeof item.Price === 'number' && Number.isFinite(item.Price))) continue;
    const originalEuroMwh = items.reduce((sum, item) => sum + item.Price, 0) / count;
    return { referenceDate: day, fetchedAt: now.toISOString(), originalEuroMwh, value: originalEuroMwh / 1000 };
  }
  throw new Error('Nessuna giornata PUN completa disponibile.');
}

export function gasQuote(rows, now = new Date(), product) {
  const today = romeDay(now);
  const days = new Map();
  for (const row of rows) {
    const day = isoDay(row.FlowDate);
    if (row.Market !== 'MGP' || !day || day > today || (product && row.Product !== product)) continue;
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(row);
  }
  for (const day of [...days.keys()].sort().reverse()) {
    const items = days.get(day);
    // Never average different overlapping gas products into a made-up index.
    if (items.length !== 1) throw new Error('Prodotti gas ambigui: specificare GME_GAS_PRODUCT dopo verifica con GME.');
    const item = items[0];
    if (typeof item.Product !== 'string' || !item.Product || typeof item.AveragePrice !== 'number' ||
        !Number.isFinite(item.AveragePrice) || typeof item.MWhVolumes !== 'number' || !Number.isFinite(item.MWhVolumes) || item.MWhVolumes <= 0) continue;
    return { referenceDate: day, fetchedAt: now.toISOString(), originalEuroMwh: item.AveragePrice,
      value: item.AveragePrice * 0.0107, product: item.Product };
  }
  throw new Error('Nessun prezzo MGP-GAS con scambi disponibile.');
}

async function post(endpoint, body, token, fetchImpl) {
  const response = await fetchImpl(`${BASE_URL}/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Servizio GME: HTTP ${response.status}.`);
  const text = await response.text();
  if (text.length > MAX_BYTES * 2) throw new Error('Risposta GME troppo grande.');
  return JSON.parse(text);
}

export async function fetchGmeMarkets({ login, password, product, now = new Date(), fetchImpl = fetch }) {
  if (!login || !password) throw new Error('Credenziali GME mancanti.');
  const auth = await post('Auth', { Login: login, Password: password }, undefined, fetchImpl);
  if (auth.Success !== true || typeof auth.token !== 'string' || !auth.token) throw new Error('Autenticazione GME non riuscita.');
  const from = new Date(now.getTime() - 7 * 86400000);
  const interval = { Platform: 'PublicMarketResults', IntervalStart: Number(romeDay(from).replaceAll('-', '')),
    IntervalEnd: Number(romeDay(now).replaceAll('-', '')) };
  const results = {};
  for (const market of ['electricity', 'gas']) {
    try {
      const response = await post('RequestData', { ...interval,
        DataName: market === 'electricity' ? 'ME_ZonalPrices' : 'GAS_ContinuousTrading',
        Segment: market === 'electricity' ? 'MGP' : 'MGP-GAS',
        Attributes: market === 'electricity' ? { GranularityType: 'PT60' } : {}
      }, auth.token, fetchImpl);
      const rows = decodeGmeResponse(response);
      results[market] = { quote: market === 'electricity' ? electricityQuote(rows, now) : gasQuote(rows, now, product) };
    } catch (error) {
      // Never put the remote response, a password or a bearer token into logs/Firestore.
      results[market] = { error: error instanceof Error && error.message.startsWith('Prodotti gas ambigui') ? error.message : 'Dati GME non disponibili o non validi.' };
    }
  }
  return results;
}

export function mergeMarketResults(previous, results, now = new Date()) {
  const next = { version: 1, lastAttemptAt: now.toISOString() };
  let successes = 0;
  for (const market of ['electricity', 'gas']) {
    const quote = results[market]?.quote;
    const prior = previous?.[market];
    if (quote && (!prior || quote.referenceDate >= prior.referenceDate)) { next[market] = quote; successes++; }
    else if (prior) next[market] = prior;
    next[`${market}State`] = quote && (!prior || quote.referenceDate >= prior.referenceDate) ? 'ok' : 'error';
  }
  next.state = successes === 2 ? 'ok' : successes === 1 ? 'partial' : 'error';
  return next;
}
