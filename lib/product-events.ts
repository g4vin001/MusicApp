import { db, digest, now } from './server';
export async function recordEvent(owner: string, kind: string, jobId = '', value = '', unique = '') {
  const id = await digest([owner, kind, jobId, unique || crypto.randomUUID()].join(':'));
  await db().batch([
    db().prepare('INSERT INTO product_events(id,owner,kind,job_id,value,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id, owner, kind, jobId, value, now()),
    db().prepare('DELETE FROM product_events WHERE id IN (SELECT id FROM product_events WHERE created<? LIMIT 100)').bind(now() - 90 * 86400),
    db().prepare('DELETE FROM license_notes WHERE id IN (SELECT id FROM license_notes WHERE updated<? LIMIT 100)').bind(now() - 365 * 86400),
  ]);
}
