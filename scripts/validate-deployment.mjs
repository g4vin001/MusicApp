import { readFileSync } from 'node:fs';

const source = JSON.parse(readFileSync(new URL('../wrangler.json', import.meta.url), 'utf8'));
const built = JSON.parse(readFileSync(new URL('../dist/server/wrangler.json', import.meta.url), 'utf8'));
const binding = source.d1_databases?.find(entry => entry.binding === 'DB');
const deployed = built.d1_databases?.find(entry => entry.binding === 'DB');
if (!binding?.database_id || /^00000000-/.test(binding.database_id)) {
  throw new Error('Create a Cloudflare D1 database and replace the placeholder database_id in wrangler.json. Deploy to Cloudflare provisions it automatically.');
}
if (deployed?.database_id !== binding.database_id || built.name !== source.name) {
  throw new Error('The build does not match wrangler.json. Run pnpm build after configuring the Worker and database.');
}
if (JSON.stringify(built.vars) !== JSON.stringify(source.vars)) {
  throw new Error('The built settings are stale. Run pnpm build before deploying.');
}
console.log('Standalone Worker and database configuration verified.');
