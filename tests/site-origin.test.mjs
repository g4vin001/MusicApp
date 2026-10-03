import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const output = resolve('.runtime/site-origin-tests');
mkdirSync(output, { recursive: true });
globalThis.__siteOriginTestEnv = {};
writeFileSync(output + '/server.mjs', 'export function variable(name) { return globalThis.__siteOriginTestEnv[name] || ""; }');
for (const [path, name] of [['lib/site-origin.ts', 'site-origin'], ['app/robots.ts', 'robots'], ['app/sitemap.ts', 'sitemap']]) {
  const source = readFileSync(path, 'utf8').replaceAll("'./server'", "'./server.mjs'").replaceAll("'@/lib/site-origin'", "'./site-origin.mjs'");
  writeFileSync(output + '/' + name + '.mjs', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
}
const { parseSiteOrigin } = await import(pathToFileURL(output + '/site-origin.mjs'));
const { default: robots } = await import(pathToFileURL(output + '/robots.mjs'));
const { default: sitemap } = await import(pathToFileURL(output + '/sitemap.mjs'));

test('configured HTTPS origins are normalized', () => {
  assert.equal(parseSiteOrigin(' https://studio.example.com/ ').href, 'https://studio.example.com/');
});

test('invalid, credentialed and non-origin settings never become canonical URLs', () => {
  for (const value of ['', 'not-a-url', 'http://studio.example.com', 'https://name:password@studio.example.com', 'https://studio.example.com/private', 'https://studio.example.com/?token=secret', 'https://studio.example.com/#fragment']) {
    assert.equal(parseSiteOrigin(value), null);
  }
});

test('metadata routes use the configured external origin and omit unset sitemap links', () => {
  globalThis.__siteOriginTestEnv.PUBLIC_SITE_URL = '';
  assert.equal(robots().sitemap, undefined);
  assert.deepEqual(sitemap(), []);
  globalThis.__siteOriginTestEnv.PUBLIC_SITE_URL = 'https://studio.example.com';
  assert.equal(robots().sitemap, 'https://studio.example.com/sitemap.xml');
  assert.equal(sitemap().length, 7);
  assert.ok(sitemap().every(entry => new URL(entry.url).origin === 'https://studio.example.com'));
});
