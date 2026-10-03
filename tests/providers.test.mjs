import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const output = resolve('.runtime/provider-tests');
mkdirSync(output, { recursive: true });
for (const [path, name] of [['lib/contracts.ts', 'contracts'], ['lib/providers.ts', 'providers']]) {
  const source = readFileSync(path, 'utf8').replace(/(['"])\.\/contracts\1/g, (_, quote) => quote + './contracts.mjs' + quote);
  writeFileSync(output + '/' + name + '.mjs', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
}
const { AudDProviderError, AudDRecognizer } = await import(pathToFileURL(output + '/providers.mjs'));
const originalFetch = globalThis.fetch;
const clip = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });

async function providerError(payload, status = 200) {
  globalThis.fetch = async () => Response.json(payload, { status });
  try {
    await new AudDRecognizer('private-token').recognize({ file: clip });
    assert.fail('expected provider error');
  } catch (error) {
    assert.ok(error instanceof AudDProviderError);
    return error;
  }
}

await test('AudD provider adapter', async t => {
  await t.test('normalizes a successful match', async () => {
    globalThis.fetch = async () => Response.json({ status: 'success', result: { title: 'Fixture Song', artist: 'Fixture Artist', spotify: { id: 'fixture', external_urls: { spotify: 'https://open.spotify.com/track/fixture' } } } });
    const song = await new AudDRecognizer('private-token').recognize({ file: clip });
    assert.equal(song.title, 'Fixture Song');
    assert.equal(song.artist, 'Fixture Artist');
    assert.equal(song.id, 'audd:fixture');
  });

  await t.test('routes video pages to one bounded enterprise section', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://enterprise.audd.io/');
      assert.equal(options.body.get('limit'), '1');
      assert.equal(options.body.get('skip_first_seconds'), '30');
      return Response.json({status:'success', result:[{songs:[{title:'Fixture soundtrack',artist:'Composer',score:100}]}]});
    };
    const song = await new AudDRecognizer('private-token').recognize({url:'https://www.youtube.com/watch?v=0jXTBAGv9ZQ',startSeconds:30});
    assert.equal(song.title, 'Fixture soundtrack');
  });
  await t.test('enterprise empty songs are no-match', async () => {
    globalThis.fetch = async () => Response.json({status:'success',result:[{songs:[]}]});
    assert.equal(await new AudDRecognizer('private-token').recognize({url:'https://youtu.be/0jXTBAGv9ZQ'}), null);
  });
  await t.test('enterprise malformed response is an error', async () => {
    globalThis.fetch = async () => Response.json({status:'success',result:[{}]});
    await assert.rejects(() => new AudDRecognizer('private-token').recognize({url:'https://youtu.be/0jXTBAGv9ZQ'}), error => error.kind === 'invalid_result');
  });

  await t.test('keeps successful no-match distinct from an error', async () => {
    globalThis.fetch = async () => Response.json({ status: 'success', result: null });
    assert.equal(await new AudDRecognizer('private-token').recognize({ file: clip }), null);
  });

  await t.test('classifies blocked provider requests separately from no-match', async () => {
    assert.equal((await providerError({status:'error',error:{error_code:19}})).kind, 'blocked');
  });

  await t.test('classifies authentication failures', async () => {
    const error = await providerError({ status: 'error', error: { error_code: 900, error_message: 'invalid token' }, request_id: 'req-auth' });
    assert.equal(error.kind, 'authentication');
    assert.equal(error.providerCode, 900);
    assert.equal(error.requestId, 'req-auth');
  });

  await t.test('classifies provider quota failures', async () => {
    const error = await providerError({ status: 'error', error: { error_code: 902 } });
    assert.equal(error.kind, 'quota');
  });

  await t.test('classifies rejected audio', async () => {
    const error = await providerError({ status: 'error', error: { error_code: 500 } });
    assert.equal(error.kind, 'invalid_audio');
  });

  await t.test('classifies HTTP rate limits even without a provider code', async () => {
    const error = await providerError({ status: 'error', error: {} }, 429);
    assert.equal(error.kind, 'rate_limit');
    assert.equal(error.httpStatus, 429);
  });

  await t.test('classifies malformed provider responses', async () => {
    globalThis.fetch = async () => new Response('not json', { status: 502 });
    await assert.rejects(() => new AudDRecognizer('private-token').recognize({ file: clip }), error => error instanceof AudDProviderError && error.kind === 'unavailable');
  });

  await t.test('classifies network failures without leaking the token', async () => {
    globalThis.fetch = async () => { throw new Error('socket closed'); };
    await assert.rejects(() => new AudDRecognizer('private-token').recognize({ file: clip }), error => error instanceof AudDProviderError && error.kind === 'network' && !error.message.includes('private-token'));
  });
});

globalThis.fetch = originalFetch;
