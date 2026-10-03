import { z } from 'zod';
import { SongSchema } from '@/lib/contracts';
import { CreatorReview, type LicenseNote } from '@/lib/creator';
import { readReview } from '@/lib/creator-store';
import { db, digest, identity, json, now, readJSON, sameOrigin } from '@/lib/server';
import { ownedScan, readScan } from '@/lib/scan-store';
import { recordEvent } from '@/lib/product-events';

async function library(owner: string): Promise<LicenseNote[]> {
  const rows = await db().prepare('SELECT id,song,platform,notes,url,attribution,updated FROM license_notes WHERE owner=? AND updated>? ORDER BY updated DESC LIMIT 100').bind(owner, now() - 365 * 86400).all<Omit<LicenseNote, 'song'> & { song: string }>();
  return rows.results.map(r => ({ ...r, song: SongSchema.parse(JSON.parse(r.song)) }));
}
export async function GET(request: Request) {
  const who = await identity(request);
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ library: await library(who.owner) }, 200, who.cookie);
    const row = await ownedScan(id, who.owner);
    if (!row) return json({ error: 'This project is unavailable or has expired.' }, 404, who.cookie);
    return json({ ...readReview(row), library: await library(who.owner) }, 200, who.cookie);
  } catch { return json({ error: 'Review notes could not be loaded. Your scan results are kept.' }, 503, who.cookie); }
}
const SaveInput = z.object({ id: z.string().uuid(), expectedRevision: z.number().int().min(0), review: CreatorReview, rememberSongId: z.string().max(180).optional() }).strict();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request not allowed.' }, 403);
  const who = await identity(request);
  try {
    const parsed = SaveInput.safeParse(await readJSON(request, 300000));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || 'Invalid review.' }, 400, who.cookie);
    const input = parsed.data, row = await ownedScan(input.id, who.owner);
    if (!row) return json({ error: 'This project is unavailable or has expired.' }, 404, who.cookie);
    const job = await readScan(row), tracks = new Map(job.segments.flatMap(s => s.state === 'matched' && s.result?.song ? [[s.result.song.id, s.result.song] as const] : []));
    if (input.review.decisions.some(d => !tracks.has(d.songId))) return json({ error: 'A review decision must refer to a recording in this scan.' }, 400, who.cookie);
    const remembered = input.review.decisions.find(d => d.songId === input.rememberSongId);
    if (input.rememberSongId && (!remembered || remembered.action !== 'licensed')) return json({ error: 'Only a license note can be saved to the reusable library.' }, 400, who.cookie);
    const changed = await db().prepare('UPDATE scan_jobs SET review=?,review_revision=review_revision+1 WHERE id=? AND owner=? AND expires>? AND review_revision=? RETURNING review_revision').bind(JSON.stringify(input.review), input.id, who.owner, now(), input.expectedRevision).first<{ review_revision: number }>();
    if (!changed) return json({ error: 'This project was changed in another tab. Reload the saved review before editing.', code: 'REVIEW_CONFLICT' }, 409, who.cookie);
    let libraryError = false;
    if (remembered) {
      try { await db().batch([
        db().prepare('INSERT INTO license_notes(id,owner,song,platform,notes,url,attribution,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET song=excluded.song,notes=excluded.notes,url=excluded.url,attribution=excluded.attribution,updated=excluded.updated').bind(await digest(who.owner + ':' + remembered.songId + ':' + input.review.platform), who.owner, JSON.stringify(tracks.get(remembered.songId)), input.review.platform, remembered.notes, remembered.licenseUrl, remembered.attribution, now()),
        db().prepare('DELETE FROM license_notes WHERE owner=? AND id NOT IN (SELECT id FROM license_notes WHERE owner=? ORDER BY updated DESC LIMIT 100)').bind(who.owner, who.owner),
      ]); } catch { libraryError = true; }
    }
    await recordEvent(who.owner, 'review_saved', input.id, '', String(changed.review_revision)).catch(() => {});
    return json({ review: input.review, revision: changed.review_revision, libraryError }, 200, who.cookie);
  } catch (e) { return json({ error: e instanceof SyntaxError || (e instanceof Error && e.message === 'BODY_TOO_LARGE') ? 'Invalid review data.' : 'The review could not be saved. Keep your notes and try again.' }, e instanceof SyntaxError ? 400 : 503, who.cookie); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request not allowed.' }, 403);
  const who = await identity(request);
  try { const id = new URL(request.url).searchParams.get('noteId') || ''; await db().prepare('DELETE FROM license_notes WHERE id=? AND owner=?').bind(id, who.owner).run(); return json({ ok: true }, 200, who.cookie); }
  catch { return json({ error: 'The license note could not be deleted.' }, 503, who.cookie); }
}
