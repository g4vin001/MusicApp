import { db, identity, json, now, variable } from '@/lib/server';
export async function GET(request: Request) {
  const who = await identity(request);
  if (!who.tester) return json({ error: 'Operator access required. Enable tester mode with your access key.' }, 403, who.cookie);
  try {
    const cutoff = now() - 30 * 86400;
    const [events, jobs, requests, total, returning] = await Promise.all([
      db().prepare('SELECT kind,value,COUNT(*) AS count,COUNT(DISTINCT owner) AS visitors FROM product_events WHERE created>? GROUP BY kind,value ORDER BY kind,value').bind(cutoff).all<{ kind: string; value: string; count: number; visitors: number }>(),
      db().prepare(`SELECT COUNT(DISTINCT j.id) AS projects,COUNT(s.ordinal) AS sections,
        COALESCE(SUM(s.state='matched'),0) AS matched,COALESCE(SUM(s.state='no_match'),0) AS no_match,COALESCE(SUM(s.state='error'),0) AS unresolved
        FROM scan_jobs j LEFT JOIN scan_segments s ON s.job_id=j.id WHERE j.created>? AND j.expires>?`).bind(cutoff, now()).first(),
      db().prepare(`SELECT kind,COUNT(*) AS requests,COALESCE(SUM(response IS NOT NULL),0) AS finished FROM operations
        WHERE kind IN ('recognize','recognize_test','creator_ai') AND created>? GROUP BY kind`).bind(now() - 86400).all(),
      db().prepare('SELECT id,used FROM recognition_meter').all(),
      db().prepare(`SELECT COUNT(*) AS visitors FROM (SELECT owner FROM product_events WHERE kind='studio_opened' AND created>? GROUP BY owner HAVING COUNT(*)>1)`).bind(cutoff).first(),
    ]);
    return json({ periodDays: 30, events: events.results, jobs, last24Hours: requests.results, cumulativeMeters: total.results, returning,
      aiEnabled: !!variable('OPENAI_API_KEY') && variable('CREATOR_AI_ENABLED') === 'true',
      notes: ['Event data covers the last 30 days and is retained for 90 days. Scan outcomes cover only projects still retained (7 days).', 'Anonymous browser collections are not verified people. Tester traffic is included in project and event totals; recognition tester calls are separated.', 'A match is not a correct-match benchmark. Feedback is self-reported. No revenue, payment conversion or provider billing is measured.'] }, 200, who.cookie);
  } catch { return json({ error: 'Product metrics could not be loaded.' }, 503, who.cookie); }
}
