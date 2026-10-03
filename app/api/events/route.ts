import { z } from 'zod';
import { identity, json, now, readJSON, reserve, sameOrigin } from '@/lib/server';
import { ownedScan } from '@/lib/scan-store';
import { recordEvent } from '@/lib/product-events';
const Input = z.object({ kind: z.enum(['studio_opened', 'report_opened', 'report_exported', 'feedback']), jobId: z.string().uuid().optional(), value: z.enum(['', 'useful', 'missing_music', 'wrong_matches', 'txt', 'csv', 'json', 'credits']).default('') }).strict().refine(v => v.kind === 'feedback' ? ['useful', 'missing_music', 'wrong_matches'].includes(v.value) : v.kind === 'report_exported' ? ['txt', 'csv', 'json', 'credits'].includes(v.value) : v.value === '', 'Invalid event detail.');
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request not allowed.' }, 403);
  const who = await identity(request);
  try {
    const parsed = Input.safeParse(await readJSON(request, 1000));
    if (!parsed.success) return json({ error: 'Invalid event.' }, 400, who.cookie);
    const input = parsed.data;
    if (input.kind !== 'studio_opened' && (!input.jobId || !await ownedScan(input.jobId, who.owner))) return json({ error: 'Project unavailable.' }, 404, who.cookie);
    const id = who.owner + ':event:' + crypto.randomUUID();
    if (!await reserve({ id, kind: 'event', owner: who.owner, ip: who.ip, digest: '', global: 100000, user: 200, perIP: 500, window: 86400 })) return json({ error: 'Event limit reached.' }, 429, who.cookie);
    const unique = input.kind === 'studio_opened' ? String(Math.floor(now() / 86400)) : input.kind === 'report_opened' ? input.jobId : input.kind === 'feedback' ? input.jobId + ':' + input.value : '';
    await recordEvent(who.owner, input.kind, input.jobId || '', input.value, unique);
    return json({ ok: true }, 200, who.cookie);
  } catch { return json({ error: 'Event unavailable.' }, 503, who.cookie); }
}
