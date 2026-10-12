const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const records = new Map();
let failNextChunkBatch = false;
let largestBatch = 0;
const ref = (path) => ({ path, id: path.split('/').at(-1) });
const snapshot = (reference) => ({ ref: reference, exists: () => records.has(reference.path), data: () => records.get(reference.path) });
const firestore = {
  doc: (root, ...parts) => ref([root.path, ...parts].filter(Boolean).join('/')),
  collection: (root, ...parts) => ref([root.path, ...parts].filter(Boolean).join('/')),
  setDoc: async (reference, value, options) => records.set(reference.path, options?.merge ? { ...records.get(reference.path), ...value } : value),
  getDoc: async (reference) => snapshot(reference),
  getDocs: async (reference) => ({ docs: [...records.keys()].filter(key => key.startsWith(reference.path + '/') && !key.slice(reference.path.length + 1).includes('/')).map(key => snapshot(ref(key))) }),
  writeBatch: () => {
    const changes = [];
    return {
      set: (reference, value) => changes.push({ reference, value }),
      delete: (reference) => changes.push({ reference }),
      commit: async () => {
        if (failNextChunkBatch && changes.some(change => change.value)) { failNextChunkBatch = false; throw Error('Simulated network failure'); }
        const bytes = Buffer.byteLength(JSON.stringify(changes));
        assert.ok(bytes < 10 * 1024 * 1024, 'Writes must remain below the Firestore commit limit');
        largestBatch = Math.max(largestBatch, bytes);
        for (const { reference, value } of changes) if (value) records.set(reference.path, value); else records.delete(reference.path);
      }
    };
  }
};
const originalLoad = Module._load;
Module._load = function(request, parent, ...args) {
  if (request === 'firebase/firestore') return firestore;
  if (request === './firebase-client' && parent.filename.endsWith('quote-bill-files.ts')) return { firebaseDb: () => ({}), hasFirebaseClientConfig: () => true };
  return originalLoad.call(this, request, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}).outputText, filename);
const { uploadQuoteBill, readQuoteBill, deleteQuoteBill, validateBillFile, MAX_BILL_BYTES } = require('../src/lib/quote-bill-files.ts');
(async () => {
  const bytes = new Uint8Array(MAX_BILL_BYTES);
  for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
  const user = { id: 'admin', role: 'admin' };
  const file = new File([bytes], 'bolletta.pdf', { type: 'application/pdf' });
  const uploaded = await uploadQuoteBill(file, user, 'agent-owner', 'source');
  assert.equal(uploaded.chunkCount, 20);
  assert.equal(records.get(`quoteBillFiles/${uploaded.id}`).ownerId, 'agent-owner');
  assert.equal(records.size, 21);
  assert.deepEqual(new Uint8Array(await (await readQuoteBill(uploaded)).arrayBuffer()), bytes);
  records.delete(`quoteBillFiles/${uploaded.id}/chunks/2`);
  await assert.rejects(() => readQuoteBill(uploaded), /incompleta/);
  await deleteQuoteBill(uploaded);
  assert.equal(records.size, 0);
  failNextChunkBatch = true;
  await assert.rejects(() => uploadQuoteBill(file, user, 'agent-owner', 'source'), /network/);
  assert.equal(records.size, 0, 'Failed uploads must remove their manifest and parts');
  assert.throws(() => validateBillFile({name:'bill.html',size:100,type:'text/html'}));
  assert.throws(() => validateBillFile({name:'bill.pdf',size:MAX_BILL_BYTES+1,type:'application/pdf'}));
  assert.throws(() => validateBillFile({name:'bill.pdf',size:0,type:'application/pdf'}));
  validateBillFile({name:'bill.jpg',size:100,type:''});
  console.log(`Quote bill checks passed: 10 MB binary round trip, bounded commits (${largestBatch} bytes), incomplete files, failed-upload cleanup and file validation.`);
})().catch(error => { console.error(error); process.exit(1); });
