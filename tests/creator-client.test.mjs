import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const output = resolve('.sites-runtime/client-tests');
mkdirSync(output, { recursive: true });
for (const name of ['creator-client', 'tester-client']) {
  const source = readFileSync(`lib/${name}.ts`, 'utf8').replace("'./tester-client'", "'./tester-client.mjs'");
  writeFileSync(`${output}/${name}.mjs`, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
}
const { creatorRequest, RequestError } = await import(pathToFileURL(`${output}/creator-client.mjs`));
const { testerHeaders, setTesterKey, clearTesterKey, hasTesterKey } = await import(pathToFileURL(`${output}/tester-client.mjs`));

test('private-access and quota errors preserve their status and useful explanation', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; return Response.json({ error: 'Operator access required.' }, { status: 403 }); });
  await assert.rejects(creatorRequest('/api/insights'), e => e instanceof RequestError && e.status === 403 && e.message === 'Operator access required.');
  assert.equal(requests, 1, 'errors never cause an automatic retry');
});

test('invalid service responses produce readable recovery guidance', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Service unavailable</html>', { status: 503 }));
  await assert.rejects(creatorRequest('/api/creator'), e => e instanceof RequestError && e.status === 503 && /Refresh the saved progress/.test(e.message) && !/JSON|html/.test(e.message));
});

test('interrupted requests retain caller cancellation without retrying a paid operation', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests++;
    return new Promise((resolve, reject) => {
      if (options.signal.aborted) reject(options.signal.reason);
      else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
  });
  const controller = new AbortController();
  const result = creatorRequest('/api/scans/segment', { method: 'POST', signal: controller.signal });
  controller.abort();
  await assert.rejects(result, /Refresh the saved progress/);
  assert.equal(requests, 1);
});

test('network failures do not expose raw technical details or retry automatically', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw new TypeError('fetch failed: internal upstream detail'); });
  await assert.rejects(creatorRequest('/api/creator'), e => /Check your connection/.test(e.message) && !/upstream/.test(e.message));
  assert.equal(requests, 1);
});

test('blocked browser storage keeps public requests usable and explains tester setup', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { get sessionStorage() { throw new DOMException('Blocked', 'SecurityError'); } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  assert.equal(testerHeaders({ Accept: 'application/json' }).get('Accept'), 'application/json');
  assert.equal(testerHeaders().has('X-Tester-Key'), false);
  assert.equal(hasTesterKey(), false);
  assert.doesNotThrow(clearTesterKey);
  assert.throws(() => setTesterKey('fixture'), /blocking session storage/);
});
