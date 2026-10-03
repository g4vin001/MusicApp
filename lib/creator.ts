import { z } from 'zod';
import { csvCell, secondsLabel, type Song } from './contracts';
import { intervalCoverage, scanStats, timelineHits, type ScanJob, type ScanWindow } from './scan';

export const Platforms = z.enum(['youtube', 'twitch', 'other']);
export const Decision = z.object({
  songId: z.string().min(1).max(180),
  action: z.enum(['review', 'licensed', 'replace', 'ignore', 'wrong_match']),
  notes: z.string().max(1000).default(''),
  licenseUrl: z.string().max(1500).refine(v => !v || (() => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } })(), 'Use a complete HTTPS license link.').default(''),
  attribution: z.string().max(1000).default(''),
}).strict();
export type Decision = z.infer<typeof Decision>;
export const CreatorReview = z.object({
  platform: Platforms.default('youtube'), notes: z.string().max(2000).default(''), decisions: z.array(Decision).max(100).default([]),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.decisions.map(d => d.songId)).size !== v.decisions.length) ctx.addIssue({ code: 'custom', message: 'A recording can have only one review decision.' });
  if (v.decisions.some(d => d.action === 'licensed' && !d.notes.trim() && !d.licenseUrl)) ctx.addIssue({ code: 'custom', message: 'Add a license note or evidence link before marking a license noted.' });
});
export type CreatorReview = z.infer<typeof CreatorReview>;
export type ReviewRecord = { review: CreatorReview; revision: number };
export type LicenseNote = { id: string; song: Song; platform: CreatorReview['platform']; notes: string; url: string; attribution: string; updated: number };
export type ReportTrack = { song: Song; windows: ScanWindow[]; samples: number; decision: Decision };
export const actionLabels: Record<Decision['action'], string> = { review: 'Review needed', licensed: 'License noted', replace: 'Replace / mute', ignore: 'Acknowledged', wrong_match: 'Wrong match' };
export const platformLabels = { youtube: 'YouTube', twitch: 'Twitch', other: 'Other / client delivery' };
export const emptyReview = (): CreatorReview => ({ platform: 'youtube', notes: '', decisions: [] });

export function creatorReport(job: ScanJob, review: CreatorReview = emptyReview()) {
  const grouped = new Map<string, ReportTrack>();
  const decisions = new Map(review.decisions.map(d => [d.songId, d]));
  for (const s of job.segments) {
    const song = s.state === 'matched' ? s.result?.song : null;
    if (!song) continue;
    const current = grouped.get(song.id);
    if (current) { current.windows.push({ index: s.index, startMs: s.startMs, endMs: s.endMs }); current.samples++; }
    else grouped.set(song.id, { song, windows: [{ index: s.index, startMs: s.startMs, endMs: s.endMs }], samples: 1,
      decision: decisions.get(song.id) || { songId: song.id, action: 'review', notes: '', licenseUrl: '', attribution: '' } });
  }
  const tracks = [...grouped.values()];
  const stats = scanStats(job);
  const gaps: Pick<ScanWindow, 'startMs' | 'endMs'>[] = [];
  let cursor = 0;
  for (const w of [...job.segments].sort((a, b) => a.startMs - b.startMs)) {
    if (w.startMs > cursor) gaps.push({ startMs: cursor, endMs: w.startMs });
    cursor = Math.max(cursor, w.endMs);
  }
  if (cursor < job.durationMs) gaps.push({ startMs: cursor, endMs: job.durationMs });
  return { filename: job.filename, durationMs: job.durationMs, mode: job.mode, stats, tracks,
    timeline: timelineHits(job.segments), gaps, gapMs: intervalCoverage(gaps),
    unmatched: job.segments.filter(s => s.state === 'no_match'),
    unresolved: job.segments.filter(s => s.state === 'error' || s.state === 'pending' || s.state === 'processing'),
    reviewNeeded: tracks.filter(t => t.decision.action === 'review').length,
    replacements: tracks.filter(t => t.decision.action === 'replace').length,
    wrongMatches: tracks.filter(t => t.decision.action === 'wrong_match').length,
    licenseNotes: tracks.filter(t => t.decision.action === 'licensed').length,
    coveragePercent: Math.round(100 * stats.checkedMs / job.durationMs), platform: review.platform,
    scope: 'Music recognition and creator review. This report does not determine rights, predict platform claims, or certify clearance.',
    rangeNote: 'Ranges are checked windows containing a match, not exact song boundaries.',
  };
}
export type CreatorReport = ReturnType<typeof creatorReport>;
const range = (w: Pick<ScanWindow, 'startMs' | 'endMs'>) => `${secondsLabel(w.startMs / 1000)}–${secondsLabel(w.endMs / 1000)}`;
export function musicCredits(report: CreatorReport) {
  const tracks = report.tracks.filter(t => t.decision.action === 'licensed' && t.decision.attribution.trim());
  return tracks.length ? tracks.map(t => t.decision.attribution.trim()).join('\n\n') : 'No attribution text saved. Add the exact credit required by your music license; title and artist alone may be insufficient.';
}
export function reportText(job: ScanJob, review: CreatorReview) {
  const r = creatorReport(job, review);
  return [`MUSIC REVIEW — ${job.filename}`, `Platform: ${platformLabels[review.platform]}`, `Recognition coverage: ${r.coveragePercent}% (${secondsLabel(r.stats.checkedMs / 1000)} of ${secondsLabel(job.durationMs / 1000)})`,
    `${r.reviewNeeded} recordings need review · ${r.replacements} marked for replacement · ${r.wrongMatches} rejected matches`,
    r.scope, r.rangeNote, '', 'RECORDINGS',
    ...r.tracks.map(t => `${t.song.title} — ${t.song.artist}\n  ${t.windows.map(range).join(', ')} · ${t.samples} observations · ${actionLabels[t.decision.action]}${t.decision.notes ? '\n  Note: ' + t.decision.notes : ''}${t.decision.licenseUrl ? '\n  Evidence: ' + t.decision.licenseUrl : ''}`),
    '', 'SECTIONS STILL TO REVIEW', ...r.gaps.map(w => `${range(w)} · Not sampled`), ...r.unmatched.map(w => `${range(w)} · No match; music may still be present`),
    ...r.unresolved.map(w => `${range(w)} · ${w.state}${w.result?.error ? ': ' + w.result.error : ''}`),
    '', 'PROJECT NOTES', review.notes || 'None', '', 'SAVED ATTRIBUTION TEXT', musicCredits(r),
    '', 'NEXT STEP', platformStep(review.platform),
  ].join('\n');
}
export function reportCSV(job: ScanJob, review: CreatorReview) {
  const r = creatorReport(job, review), decisions = new Map(r.tracks.map(t => [t.song.id, t.decision]));
  const rows: (string | number)[][] = [['File', 'Platform', 'Start seconds', 'End seconds', 'Recognition state', 'Title', 'Artist', 'Decision', 'Review note', 'License evidence', 'Attribution', 'Boundary note']];
  for (const s of job.segments) { const song = s.result?.song, d = song ? decisions.get(song.id) : undefined;
    rows.push([job.filename, platformLabels[review.platform], s.startMs / 1000, s.endMs / 1000, s.state, song?.title || '', song?.artist || '', d ? actionLabels[d.action] : '', d?.notes || s.result?.error || '', d?.licenseUrl || '', d?.attribution || '', r.rangeNote]); }
  for (const w of r.gaps) rows.push([job.filename, platformLabels[review.platform], w.startMs / 1000, w.endMs / 1000, 'not_sampled', '', '', '', 'Listen to this gap manually.', '', '', r.rangeNote]);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function platformStep(platform: CreatorReview['platform']) {
  return platform === 'youtube' ? 'Use YouTube Studio Checks before publishing, and confirm that each music license covers this video and channel.' : platform === 'twitch' ? 'Confirm that each license covers Twitch streams, VODs and clips. Review the recording before making it public.' : 'Confirm the required distribution platforms and music permissions with your client before delivery.';
}
export function answerReport(job: ScanJob, review: CreatorReview, question: string) {
  const r = creatorReport(job, review), q = question.toLowerCase();
  if (/credit|attribution/.test(q)) return musicCredits(r);
  if (/cost|request|budget|minute/.test(q)) return `This scan used ${r.stats.providerCalls} provider requests and reused ${r.stats.cacheHits} cached sections. It checked ${secondsLabel(r.stats.checkedMs / 1000)} of ${secondsLabel(job.durationMs / 1000)}. Full continuous scanning needs up to ${Math.ceil(job.durationMs / 12000)} requests. Estimates are not a provider invoice.`;
  if (/miss|gap|coverage|unrecognized|unmatched/.test(q)) return `${r.coveragePercent}% of the file has a completed recognition check. ${r.gaps.length} unsampled gaps, ${r.unmatched.length} no-match windows and ${r.unresolved.length} unfinished or unresolved windows need listening. No match does not establish absence of music.\n${[...r.gaps.map(w => range(w) + ' · not sampled'), ...r.unmatched.map(w => range(w) + ' · no match'), ...r.unresolved.map(w => range(w) + ' · ' + w.state)].slice(0,25).join('\n')}`;
  if (/handoff|editor|export|summary/.test(q)) return reportText(job, review);
  if (/safe|copyright|claim|publish|license|clearance/.test(q)) return `${r.reviewNeeded} recordings still need a decision; ${r.licenseNotes} have a license note, ${r.replacements} are marked for replacement and ${r.wrongMatches} are rejected matches. Recognition cannot determine permission or predict a platform claim. ${platformStep(review.platform)}`;
  return `${r.tracks.length} different recordings were returned. Review ${r.reviewNeeded} undecided recordings, listen to ${r.unmatched.length} no-match windows and ${r.gaps.length} unsampled gaps, then export your decisions for the editor. A repeated match is additional evidence, not guaranteed accuracy. ${platformStep(review.platform)}`;
}
