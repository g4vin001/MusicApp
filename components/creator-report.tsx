'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, Download, LoaderCircle, Play, Save, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { actionLabels, creatorReport, emptyReview, musicCredits, platformLabels, reportCSV, reportText, type CreatorReview, type Decision, type LicenseNote, type ReportTrack, type ReviewRecord } from '@/lib/creator';
import { secondsLabel, type Configuration } from '@/lib/contracts';
import type { ScanJob, ScanWindow } from '@/lib/scan';
import { creatorRequest, downloadReport, productEvent } from '@/lib/creator-client';

type Loaded = ReviewRecord & { library: LicenseNote[] };
type Props = { job: ScanJob; configuration: Configuration | null; onReplay: (window: ScanWindow) => void; canReplay: boolean };
const range = (w: ScanWindow) => `${secondsLabel(w.startMs / 1000)}–${secondsLabel(w.endMs / 1000)}`;
const questions = ['What should I review?', 'What might have been missed?', 'Make an editor handoff', 'How many requests did this use?'];
export function CreatorReport({ job, configuration, onReplay, canReplay }: Props) {
  const [record, setRecord] = useState<ReviewRecord | null>(null), [library, setLibrary] = useState<LicenseNote[]>([]);
  const [platform, setPlatform] = useState<CreatorReview['platform']>('youtube'), [projectNotes, setProjectNotes] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [question, setQuestion] = useState(''), [answer, setAnswer] = useState(''), [answerEngine, setAnswerEngine] = useState(''), [asking, setAsking] = useState(false), [useAI, setUseAI] = useState(false);
  const report = useMemo(() => creatorReport(job, record?.review || emptyReview()), [job, record]);
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await creatorRequest<Loaded>('/api/creator?id=' + job.id); setRecord({ review: r.review, revision: r.revision }); setLibrary(r.library); setPlatform(r.review.platform); setProjectNotes(r.review.notes); }
    catch (e) { setError(e instanceof Error ? e.message : 'Review notes could not load.'); }
    finally { setLoading(false); }
  }, [job.id]);
  useEffect(() => { let active = true; setLoading(true); setRecord(null); setAnswer(''); setMessage('');
    void creatorRequest<Loaded>('/api/creator?id=' + job.id).then(r => { if (active) { setRecord({ review: r.review, revision: r.revision }); setLibrary(r.library); setPlatform(r.review.platform); setProjectNotes(r.review.notes); setError(''); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Review notes could not load.'); }).finally(() => { if (active) setLoading(false); });
    void productEvent('report_opened', job.id);
    return () => { active = false; };
  }, [job.id]);
  async function save(next: CreatorReview, rememberSongId?: string) {
    if (!record || saving) return;
    setSaving(true); setError(''); setMessage('');
    try { const r = await creatorRequest<ReviewRecord & { libraryError: boolean }>('/api/creator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, expectedRevision: record.revision, review: next, ...(rememberSongId ? { rememberSongId } : {}) }) });
      setRecord({ review: r.review, revision: r.revision }); setAnswer('');
      setMessage(r.libraryError ? 'Project saved. The reusable library note could not be saved; try again.' : rememberSongId ? 'Decision and reusable license note saved.' : 'Review saved. Exports now include these decisions.');
      if (rememberSongId && !r.libraryError) { const updated = await creatorRequest<{ library: LicenseNote[] }>('/api/creator'); setLibrary(updated.library); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Keep your notes and try saving again.'); }
    finally { setSaving(false); }
  }
  function saveDecision(decision: Decision, remember: boolean) {
    if (!record) return;
    void save({ ...record.review, decisions: [...record.review.decisions.filter(d => d.songId !== decision.songId), decision] }, remember ? decision.songId : undefined);
  }
  function exportFile(format: 'txt' | 'csv' | 'json' | 'credits') {
    if (!record) return;
    const content = format === 'csv' ? reportCSV(job, record.review) : format === 'json' ? JSON.stringify({ schemaVersion: 1, report, review: record.review }, null, 2) : format === 'credits' ? musicCredits(report) : reportText(job, record.review);
    downloadReport(format === 'credits' ? 'saved-music-credits.txt' : 'music-review.' + format, content, format === 'csv' ? 'text/csv;charset=utf-8' : format === 'json' ? 'application/json' : 'text/plain;charset=utf-8');
    void productEvent('report_exported', job.id, format);
  }
  async function ask(text: string) {
    if (!record || asking || text.trim().length < 2) return;
    setQuestion(text); setAsking(true); setError('');
    try { const r = await creatorRequest<{ answer: string; engine: string; notice?: string }>('/api/creator/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, question: text, useAI }) }); setAnswer(r.answer + (r.notice ? '\n\n' + r.notice : '')); setAnswerEngine(r.engine === 'openai' ? 'AI draft from saved report metadata · verify before using' : 'From your saved report'); }
    catch (e) { setError(e instanceof Error ? e.message : 'The report guide could not respond.'); }
    finally { setAsking(false); }
  }
  return <section className="creator-report" aria-label="Creator music review">
    <div className="section-head"><div><span className="eyebrow">Your creator report</span><h2>Decide what stays in the edit.</h2></div><span className="badge">{!report.tracks.length ? 'Awaiting matches' : report.reviewNeeded ? 'Review in progress' : 'Decisions recorded'}</span></div>
    <div className="report-metrics"><div><strong>{report.tracks.length}</strong><span>recordings returned</span></div><div><strong>{report.reviewNeeded}</strong><span>need a decision</span></div><div><strong>{report.coveragePercent}%</strong><span>recognition coverage</span></div><div><strong>{report.replacements}</strong><span>marked to replace</span></div></div>
    <p className="report-scope">A match is a lead to check. This report does not determine usage rights or predict platform claims.</p>
    {loading && <p role="status" className="row muted"><LoaderCircle size={17} className="animate-spin"/>Loading saved review…</p>}
    {error && <div className="notice error" role="alert">{error} <button className="text-action" disabled={saving || loading} onClick={() => void reload()}>Reload saved review</button></div>}
    {message && <div className="notice" role="status"><Check size={15} className="inline-icon"/>{message}</div>}
    {record && <><div className="review-project"><div><label className="field-label" id="platform-label">Destination</label><Select value={platform} onValueChange={v => setPlatform(v as CreatorReview['platform'])}><SelectTrigger className="field" aria-labelledby="platform-label"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(platformLabels).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><label className="field-label" htmlFor={`project-note-${job.id}`}>Project notes</label><textarea id={`project-note-${job.id}`} className="field" rows={2} maxLength={2000} value={projectNotes} onChange={e => setProjectNotes(e.target.value)} placeholder="Client requirements, edits to make, or delivery notes"/></div><button className="btn secondary" disabled={saving} onClick={() => void save({ ...record.review, platform, notes: projectNotes })}><Save size={16}/>Save project notes</button></div>
      {report.tracks.length ? <div className="review-tracks">{report.tracks.map(track => <TrackReview key={job.id + ':' + track.song.id} track={track} disabled={saving} canReplay={canReplay} onReplay={onReplay} onSave={saveDecision} template={library.find(n => n.song.id === track.song.id && n.platform === record.review.platform)}/>)}</div> : <div className="empty-box"><strong>No recordings to review yet.</strong><p>Finish a section of the scan. No-match sections still need listening.</p></div>}
      <div className="review-gaps"><h3>Listen to the unknown sections</h3><p>{report.gaps.length} unsampled gaps · {report.unmatched.length} no-match windows · {report.unresolved.length} unfinished or unresolved windows</p><div className="gap-list">{[...report.gaps.map(w => ({ ...w, state: 'Not sampled' })), ...report.unmatched.map(w => ({ ...w, state: 'No match' })), ...report.unresolved.map(w => ({ ...w, state: w.state === 'error' ? 'Unresolved' : 'Not finished' }))].sort((a,b) => a.startMs - b.startMs).slice(0,30).map((w,i) => <span className="gap-chip" key={i}>{secondsLabel(w.startMs / 1000)}–{secondsLabel(w.endMs / 1000)} · {w.state}</span>)}</div><p className="small muted">No match does not mean no music. {report.gaps.length + report.unmatched.length + report.unresolved.length > 30 ? 'The full list is included in the report export.' : ''}</p></div>
      <div className="report-export"><h3>Send the saved review to your editor</h3><div className="row">{(['txt', 'csv', 'json'] as const).map(format => <button className="btn secondary" key={format} onClick={() => exportFile(format)} disabled={saving}><Download size={16}/>{format === 'txt' ? 'Editor handoff' : format.toUpperCase()}</button>)}<button className="btn ghost" onClick={() => exportFile('credits')} disabled={saving}><Clipboard size={16}/>Saved credits</button></div><p className="small muted">Exports use saved decisions and include unknown sections. Credits include only the attribution text you entered for tracks with a license note.</p></div>
      <div className="report-guide"><h3>Ask about this report</h3><div className="question-chips">{questions.map(q => <button className="btn ghost" key={q} disabled={asking || saving} onClick={() => void ask(q)}>{q}</button>)}</div><form onSubmit={e => { e.preventDefault(); void ask(question); }}><label className="field-label" htmlFor={`report-question-${job.id}`}>Question</label><div className="search-row"><input className="field" id={`report-question-${job.id}`} value={question} maxLength={600} minLength={2} onChange={e => setQuestion(e.target.value)} placeholder="What still needs review before delivery?" required/><button className="btn" disabled={asking || saving}>{asking ? <LoaderCircle size={17} className="animate-spin"/> : <Send size={17}/>}Ask</button></div>{configuration?.ai && <label className="row ai-opt-in"><Checkbox checked={useAI} onCheckedChange={v => setUseAI(v === true)}/>Use AI to draft the answer from saved titles, timestamps and review notes. Audio is not sent.</label>}</form>{answer && <div className="guide-answer" role="status"><span className="eyebrow">{answerEngine}</span><p>{answer}</p></div>}</div>
      <div className="report-feedback"><span>Did this help you finish the edit?</span>{[['useful', 'Yes, useful'], ['missing_music', 'Missed music'], ['wrong_matches', 'Wrong matches']].map(([value, label]) => <button className="btn ghost" key={value} onClick={async () => { const result = await productEvent('feedback', job.id, value); setMessage(result ? 'Feedback recorded. Thank you.' : 'Feedback could not be recorded. Your project is kept.'); }}>{label}</button>)}</div>
    </>}
  </section>;
}

function TrackReview({ track, disabled, canReplay, onReplay, onSave, template }: { track: ReportTrack; disabled: boolean; canReplay: boolean; onReplay: (w: ScanWindow) => void; onSave: (d: Decision, remember: boolean) => void; template?: LicenseNote }) {
  const [action, setAction] = useState<Decision['action']>(track.decision.action), [notes, setNotes] = useState(track.decision.notes), [url, setURL] = useState(track.decision.licenseUrl), [attribution, setAttribution] = useState(track.decision.attribution), [remember, setRemember] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setAction(track.decision.action); setNotes(track.decision.notes); setURL(track.decision.licenseUrl); setAttribution(track.decision.attribution); }, [track.decision.action, track.decision.notes, track.decision.licenseUrl, track.decision.attribution]);
  const inputId = track.song.id.replace(/[^a-zA-Z0-9]/g, '-');
  return <article className={`review-track review-${track.decision.action}`}>
    <div className="review-track-head"><div><h3>{track.song.title}</h3><p>{track.song.artist}{track.song.album ? ' · ' + track.song.album : ''}</p><span className="small muted">{track.samples === 1 ? 'One matching section · listen to verify' : `${track.samples} matching sections · repeated evidence`}</span></div><button className="btn ghost" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Close notes' : actionLabels[track.decision.action]}</button></div>
    <div className="track-ranges">{track.windows.map(w => <button key={w.index} disabled={!canReplay} className="btn ghost" onClick={() => onReplay(w)}><Play size={13}/>{range(w)}</button>)}</div>
    {expanded && <div className="track-review-form"><div><label className="field-label" id={`action-${inputId}`}>Decision for this recording</label><Select value={action} onValueChange={v => setAction(v as Decision['action'])}><SelectTrigger className="field" aria-labelledby={`action-${inputId}`}><SelectValue/></SelectTrigger><SelectContent>{Object.entries(actionLabels).map(([value,label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><label className="field-label" htmlFor={`note-${inputId}`}>{action === 'licensed' ? 'License scope / evidence note' : 'Review note'}</label><textarea id={`note-${inputId}`} rows={2} className="field" maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder={action === 'licensed' ? 'Provider, license ID, channels/platforms covered, expiry and restrictions' : 'Why to replace it, or what to verify'}/></div>
      {action === 'licensed' && <><div><label className="field-label" htmlFor={`license-${inputId}`}>License evidence link (HTTPS)</label><input id={`license-${inputId}`} className="field" type="url" maxLength={1500} value={url} onChange={e => setURL(e.target.value)} placeholder="https://…"/></div><div><label className="field-label" htmlFor={`credit-${inputId}`}>Exact required attribution</label><textarea id={`credit-${inputId}`} className="field" rows={2} maxLength={1000} value={attribution} onChange={e => setAttribution(e.target.value)} placeholder="Copy the credit required by your license"/></div><label className="row small"><Checkbox checked={remember} onCheckedChange={v => setRemember(v === true)}/>Keep this note in my reusable license notebook</label><p className="small muted">License noted records your evidence. Confirm the recording, platform, channel, expiry and usage terms for each project.</p></>}
      {template && <button className="btn ghost" onClick={() => { setAction('licensed'); setNotes(template.notes); setURL(template.url); setAttribution(template.attribution); }}>Use saved license note · confirm it still applies</button>}
      {action === 'wrong_match' && <p className="small muted">This rejects the provider result for this project. It stays visible in exports and is excluded from saved credits.</p>}
      <button className="btn secondary" disabled={disabled} onClick={() => onSave({ songId: track.song.id, action, notes, licenseUrl: url, attribution }, action === 'licensed' && remember)}><Save size={16}/>Save decision</button>
    </div>}
  </article>;
}
