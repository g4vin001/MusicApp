'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Clipboard, Download, LoaderCircle, Music2, Play, Save, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { actionLabels, CreatorReview, creatorReport, emptyReview, musicCredits, platformLabels, reportCSV, reportText, type Decision, type LicenseNote, type ReportTrack, type ReviewRecord } from '@/lib/creator';
import { safeLink, secondsLabel, type Configuration } from '@/lib/contracts';
import type { ScanJob, ScanWindow } from '@/lib/scan';
import { creatorRequest, downloadReport, productEvent } from '@/lib/creator-client';

type Loaded = ReviewRecord & { library: LicenseNote[] };
type Props = { job: ScanJob; configuration: Configuration | null; onReplay: (window: ScanWindow) => void; canReplay: boolean; externallyLocked?: boolean; onDirtyChange?: (dirty: boolean) => void };
const range = (w: Pick<ScanWindow, 'startMs' | 'endMs'>) => `${secondsLabel(w.startMs / 1000)}–${secondsLabel(w.endMs / 1000)}`;
const questions = ['What should I review?', 'What might have been missed?', 'Make an editor handoff', 'How many requests did this use?'];

export function CreatorReport({ job, configuration, onReplay, canReplay, externallyLocked = false, onDirtyChange }: Props) {
  const [record, setRecord] = useState<ReviewRecord | null>(null);
  const [draft, setDraft] = useState<CreatorReview>(emptyReview);
  const [library, setLibrary] = useState<LicenseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [answerEngine, setAnswerEngine] = useState('');
  const [asking, setAsking] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const saveLock = useRef(false);
  const mounted = useRef(true);
  const loadSequence = useRef(0);
  const fieldId = useId();
  const report = useMemo(() => creatorReport(job, draft), [job, draft]);
  const dirty = !!record && JSON.stringify(draft) !== JSON.stringify(record.review);
  const unknown = useMemo(() => [
    ...report.gaps.map(w => ({ ...w, index: -1, label: 'Not sampled' })),
    ...report.unmatched.map(w => ({ ...w, label: 'No match' })),
    ...report.unresolved.map(w => ({ ...w, label: w.state === 'error' ? 'Unresolved' : 'Not finished' })),
  ].sort((a, b) => a.startMs - b.startMs), [report]);

  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true); setError('');
    try {
      const r = await creatorRequest<Loaded>('/api/creator?id=' + job.id);
      if (!mounted.current || sequence !== loadSequence.current) return;
      setRecord({ review: r.review, revision: r.revision }); setDraft(r.review); setLibrary(r.library); setAnswer('');
    } catch (e) { if (mounted.current && sequence === loadSequence.current) setError(e instanceof Error ? e.message : 'Review notes could not load.'); }
    finally { if (mounted.current && sequence === loadSequence.current) setLoading(false); }
  }, [job.id]);
  useEffect(() => {
    mounted.current = true; setRecord(null); setDraft(emptyReview()); setMessage(''); setAnswer('');
    void reload(); void productEvent('report_opened', job.id);
    return () => { mounted.current = false; loadSequence.current++; };
  }, [job.id, reload]);
  useEffect(() => { onDirtyChange?.(dirty); return () => { onDirtyChange?.(false); }; }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function changeDecision(next: Decision) {
    setDraft(previous => ({ ...previous, decisions: [...previous.decisions.filter(d => d.songId !== next.songId), next] }));
    setMessage(''); setExportMessage('');
  }

  async function save(rememberSongId?: string) {
    if (!record || saveLock.current || loading || externallyLocked) return;
    const parsed = CreatorReview.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Check your review notes before saving.'); return; }
    saveLock.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const r = await creatorRequest<ReviewRecord & { libraryError: boolean }>('/api/creator', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, expectedRevision: record.revision, review: parsed.data, ...(rememberSongId ? { rememberSongId } : {}) }),
      });
      if (!mounted.current) return;
      setRecord({ review: r.review, revision: r.revision }); setDraft(r.review); setAnswer('');
      setMessage(r.libraryError ? 'Review saved. The notebook note could not be saved; try that again.' : rememberSongId ? 'Review and reusable license note saved.' : 'All changes saved. Your exports are up to date.');
      if (rememberSongId && !r.libraryError) {
        try { const updated = await creatorRequest<{ library: LicenseNote[] }>('/api/creator'); if (mounted.current) setLibrary(updated.library); }
        catch { /* The confirmed review and notebook save are already complete. */ }
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Your edits are still here. Try saving again.'); }
    finally { saveLock.current = false; if (mounted.current) setSaving(false); }
  }

  function exportFile(format: 'txt' | 'csv' | 'json' | 'credits') {
    if (!record || dirty || saving || externallyLocked) return;
    const savedReport = creatorReport(job, record.review);
    const content = format === 'csv' ? reportCSV(job, record.review) : format === 'json' ? JSON.stringify({ schemaVersion: 1, report: savedReport, review: record.review }, null, 2) : format === 'credits' ? musicCredits(savedReport) : reportText(job, record.review);
    downloadReport(format === 'credits' ? 'saved-music-credits.txt' : 'music-review.' + format, content, format === 'csv' ? 'text/csv;charset=utf-8' : format === 'json' ? 'application/json' : 'text/plain;charset=utf-8');
    setExportMessage('Download prepared. Check your browser’s downloads.');
    void productEvent('report_exported', job.id, format);
  }
  async function copyHandoff() {
    if (!record || dirty || saving || externallyLocked) return;
    try { await navigator.clipboard.writeText(reportText(job, record.review)); setExportMessage('Editor handoff copied to your clipboard.'); void productEvent('report_exported', job.id, 'txt'); }
    catch { setExportMessage('Clipboard access is unavailable. Use Download handoff instead.'); }
  }
  async function ask(text: string) {
    if (!record || asking || dirty || saving || externallyLocked || text.trim().length < 2) return;
    setQuestion(text); setAsking(true); setError('');
    try {
      const r = await creatorRequest<{ answer: string; engine: string; notice?: string }>('/api/creator/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, question: text, useAI }) });
      if (!mounted.current) return;
      setAnswer(r.answer + (r.notice ? '\n\n' + r.notice : '')); setAnswerEngine(r.engine === 'openai' ? 'AI draft · check before using' : 'From your saved report');
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'The report guide could not respond.'); }
    finally { if (mounted.current) setAsking(false); }
  }
  const editingLocked = saving || externallyLocked;
  const exportDisabled = dirty || editingLocked || loading;
  const completed = report.stats.completed === report.stats.total;
  const status = !report.tracks.length ? completed ? 'No matches returned' : 'Waiting for matches' : report.reviewNeeded ? `${report.reviewNeeded} to review` : 'Decisions recorded';

  return <section className="creator-report" aria-label="Creator music review" aria-busy={loading}>
    <div className="section-head"><div><span className="eyebrow">03 · Review &amp; export</span><h2>Your music decision list</h2></div><span className={`badge review-status ${report.reviewNeeded ? 'needs-review' : ''}`}>{status}</span></div>
    <div className="report-metrics"><div><strong>{report.tracks.length}</strong><span>recordings returned</span></div><div><strong>{report.reviewNeeded}</strong><span>need a decision</span></div><div><strong>{report.coveragePercent}%</strong><span>audio checked</span></div><div><strong>{report.replacements}</strong><span>marked to replace</span></div></div>
    <p className="report-scope">Listen to confirm each match. Recognition does not establish music rights or predict platform claims.</p>
    {loading && <div className="loading-review" role="status"><span className="row"><LoaderCircle size={17} className="animate-spin"/>Loading your saved review…</span><div className="skeleton-line"/><div className="skeleton-line short"/></div>}
    {error && <div className="notice error" role="alert"><span>{error}</span><button className="btn ghost" disabled={saving || loading || externallyLocked} onClick={() => dirty ? setDiscardOpen(true) : void reload()}>Reload saved review</button>{dirty && <span className="small">Reloading replaces your unsaved edits.</span>}</div>}
    {message && <div className="notice saved-message" role="status"><Check size={17}/>{message}</div>}
    {record && !loading && <>
      <div className="review-project">
        <div><label className="field-label" id={`platform-${fieldId}`}>Destination</label><Select value={draft.platform} disabled={editingLocked} onValueChange={v => { setDraft(previous => ({ ...previous, platform: v as CreatorReview['platform'] })); setMessage(''); }}><SelectTrigger className="field" aria-labelledby={`platform-${fieldId}`}><SelectValue/></SelectTrigger><SelectContent>{Object.entries(platformLabels).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="field-label" htmlFor={`project-note-${fieldId}`}>Project notes <span className="muted">Optional</span></label><textarea id={`project-note-${fieldId}`} className="field" rows={2} maxLength={2000} disabled={editingLocked} value={draft.notes} onChange={e => { setDraft(previous => ({ ...previous, notes: e.target.value })); setMessage(''); }} placeholder="Client requirements or changes to make"/></div>
      </div>
      <div className="review-savebar"><span className={`row ${dirty ? 'unsaved-label' : 'muted'}`} role="status">{saving ? <LoaderCircle size={16} className="animate-spin"/> : !dirty ? <Check size={16}/> : <Save size={16}/>} {saving ? 'Saving your review…' : dirty ? 'You have unsaved changes' : 'Review is up to date'}</span><button className="btn" disabled={!dirty || editingLocked} onClick={() => void save()}><Save size={16}/>{saving ? 'Saving…' : 'Save changes'}</button></div>
      {report.tracks.length ? <div className="review-tracks">{report.tracks.map((track, index) => <TrackReview key={job.id + ':' + track.song.id} track={track} savedDecision={record.review.decisions.find(d => d.songId === track.song.id)} initiallyExpanded={index === 0 && track.decision.action === 'review'} disabled={editingLocked} canReplay={canReplay} onReplay={onReplay} onChange={changeDecision} onSave={remember => void save(remember ? track.song.id : undefined)} template={library.find(n => n.song.id === track.song.id && n.platform === draft.platform)}/>)}</div> : <div className="empty-box report-empty"><Music2 size={26}/><strong>{completed ? 'No recordings identified in the checked sections.' : 'Matches will appear as sections finish.'}</strong><p>{completed ? 'Replay the unknown sections below. Try a clearer part in the single-song finder if you can hear music.' : 'You can add project notes while the scan runs.'}</p>{completed && <a href="/find" className="btn ghost">Try the song finder</a>}</div>}
      <div className="review-gaps"><div className="row between"><h3>Sections to listen to</h3><span className="badge neutral-badge">{unknown.length} sections</span></div><p>{report.gaps.length} not sampled · {report.unmatched.length} no match · {report.unresolved.length} unfinished or unresolved</p>
        {unknown.length ? <><div className="gap-list">{unknown.slice(0, 12).map(w => <button className={`gap-chip ${canReplay ? 'replay-gap' : ''}`} key={w.label + ':' + w.startMs} disabled={!canReplay} onClick={() => onReplay(w)} aria-label={`Play ${range(w)}: ${w.label}`}>{canReplay && <Play size={13}/>}<span>{range(w)}</span><span className="gap-state">{w.label}</span></button>)}</div>{unknown.length > 12 && <details className="more-gaps"><summary>Show {unknown.length - 12} more sections</summary><div className="gap-list">{unknown.slice(12).map(w => <button className="gap-chip" key={w.label + ':' + w.startMs} disabled={!canReplay} onClick={() => onReplay(w)} aria-label={`Play ${range(w)}: ${w.label}`}><span>{range(w)}</span><span className="gap-state">{w.label}</span></button>)}</div></details>}<p className="small muted">{canReplay ? 'Select a section to replay it. ' : 'Choose the original recording again to replay these sections. '}No match can still contain music.</p></> : <p className="coverage-complete"><Check size={17}/>No unsampled gaps or unresolved sections remain. Silence may have been skipped; check each returned match before delivery.</p>}
      </div>
      <div className="report-export"><span className="eyebrow">Editor handoff</span><h3>Take the review into your edit</h3><p className="small muted">Includes saved decisions, checked timestamps, and sections that still need listening.{!completed && ' This scan is unfinished; the export will be a partial report.'}</p>
        {dirty && <p className="export-save-hint"><Save size={16}/>Save your changes above to include them in the handoff.</p>}
        <div className="export-primary"><button className="btn" onClick={() => exportFile('txt')} disabled={exportDisabled}><Download size={16}/>Download handoff</button><button className="btn secondary" onClick={() => void copyHandoff()} disabled={exportDisabled}><Clipboard size={16}/>Copy handoff</button></div>
        <div className="export-secondary"><span className="small muted">Other formats</span>{(['csv', 'json'] as const).map(format => <button className="btn ghost" key={format} onClick={() => exportFile(format)} disabled={exportDisabled}>{format.toUpperCase()}</button>)}<button className="btn ghost" onClick={() => exportFile('credits')} disabled={exportDisabled || !report.tracks.some(t => t.decision.action === 'licensed' && t.decision.attribution.trim())}>Saved credits</button></div>
        <p className="small muted">Credits contain the exact attribution you entered for recordings with a license note.</p>
        {exportMessage && <p className="export-status" role="status">{exportMessage}</p>}
      </div>
      <details className="report-guide"><summary><div><h3>Help with this report</h3><p className="small muted">Understand the gaps, summarize decisions, or check request usage.</p></div><ChevronDown size={19}/></summary><div className="question-chips">{questions.map(q => <button className="btn ghost" key={q} disabled={asking || exportDisabled} onClick={() => void ask(q)}>{q}</button>)}</div>
        <form onSubmit={e => { e.preventDefault(); void ask(question); }}><label className="field-label" htmlFor={`report-question-${fieldId}`}>Your question</label><div className="search-row"><input className="field" id={`report-question-${fieldId}`} value={question} maxLength={600} minLength={2} disabled={asking || exportDisabled} onChange={e => setQuestion(e.target.value)} placeholder="What still needs review before delivery?" required/><button className="btn" disabled={asking || exportDisabled || question.trim().length < 2}>{asking ? <LoaderCircle size={17} className="animate-spin"/> : <Send size={17}/>} {asking ? 'Preparing…' : 'Ask'}</button></div>{configuration?.ai && <label className="row ai-opt-in"><Checkbox checked={useAI} disabled={asking || exportDisabled} onCheckedChange={v => setUseAI(v === true)}/>Use AI to draft from saved titles, timestamps, and notes. Audio is not sent.</label>}{dirty && <p className="small unsaved-label">Save your changes before asking about the updated review.</p>}</form>
        {asking && <p className="row small muted" role="status"><LoaderCircle size={16} className="animate-spin"/>Preparing an answer from the saved report…</p>}
        {answer && <div className="guide-answer" role="status"><span className="eyebrow">{answerEngine}</span><p>{answer}</p></div>}
      </details>
      <div className="report-feedback"><span>Did this help with your edit?</span>{[['useful', 'Useful'], ['missing_music', 'Missed music'], ['wrong_matches', 'Wrong matches']].map(([value, label]) => <button className="btn ghost" aria-pressed={feedback === value} disabled={sendingFeedback || feedback === value} key={value} onClick={async () => { setSendingFeedback(true); const result = await productEvent('feedback', job.id, value); if (mounted.current) { if (result) setFeedback(value); setMessage(result ? 'Feedback recorded. Thank you.' : 'Feedback could not be recorded. Your review is kept.'); setSendingFeedback(false); } }}>{feedback === value && <Check size={14}/>} {label}</button>)}</div>
    </>}
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reload the saved review?</AlertDialogTitle><AlertDialogDescription>This replaces the edits you have not saved with the latest saved decisions. Your current draft will be discarded.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => void reload()}>Reload saved review</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

type TrackProps = {
  track: ReportTrack; savedDecision?: Decision; initiallyExpanded: boolean; disabled: boolean; canReplay: boolean;
  onReplay: (w: ScanWindow) => void; onChange: (decision: Decision) => void; onSave: (remember: boolean) => void; template?: LicenseNote;
};
function TrackReview({ track, savedDecision, initiallyExpanded, disabled, canReplay, onReplay, onChange, onSave, template }: TrackProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const inputId = useId();
  const decision = track.decision;
  const dirty = savedDecision ? JSON.stringify(decision) !== JSON.stringify(savedDecision) : decision.action !== 'review' || !!decision.notes || !!decision.licenseUrl || !!decision.attribution;
  const art = safeLink(track.song.artwork);
  const needsEvidence = decision.action === 'licensed' && !decision.notes.trim() && !decision.licenseUrl.trim();
  function change(partial: Partial<Decision>) { onChange({ ...decision, ...partial }); }
  return <article className={`review-track review-${decision.action}`}>
    <div className="review-track-head"><div className="track-identity">{art ? <img className="review-art" src={art} alt="" width={52} height={52} loading="lazy" referrerPolicy="no-referrer"/> : <span className="review-art art-placeholder"><Music2 size={22}/></span>}<div><h3>{track.song.title}</h3><p>{track.song.artist}{track.song.album ? ' · ' + track.song.album : ''}</p><span className="small muted">{track.samples === 1 ? 'One matching section · listen to confirm' : `${track.samples} matching sections`}</span></div></div><div className="track-edit-action">{dirty && <span className="small unsaved-label">Unsaved</span>}<button className="btn ghost" aria-expanded={expanded} aria-controls={`track-form-${inputId}`} onClick={() => setExpanded(v => !v)}><span>{actionLabels[decision.action]}</span><ChevronDown size={15} className={expanded ? 'rotate-chevron' : ''}/></button></div></div>
    <div className="track-ranges">{track.windows.map(w => <button key={w.index} disabled={!canReplay} className="btn ghost" onClick={() => onReplay(w)} aria-label={`Play ${track.song.title} at ${range(w)}`}><Play size={13}/>{range(w)}</button>)}</div>
    <div id={`track-form-${inputId}`} hidden={!expanded}>
      <div className="track-review-form">
        <div><label className="field-label" id={`action-${inputId}`}>Decision</label><Select value={decision.action} disabled={disabled} onValueChange={v => change({ action: v as Decision['action'] })}><SelectTrigger className="field" aria-labelledby={`action-${inputId}`}><SelectValue/></SelectTrigger><SelectContent>{Object.entries(actionLabels).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="field-label" htmlFor={`note-${inputId}`}>{decision.action === 'licensed' ? 'License scope or evidence note' : 'Review note'}</label><textarea id={`note-${inputId}`} rows={2} className="field" maxLength={1000} disabled={disabled} value={decision.notes} onChange={e => change({ notes: e.target.value })} placeholder={decision.action === 'licensed' ? 'License provider, covered channels, expiry, and restrictions' : 'What should the editor check or change?'}/></div>
        {decision.action === 'licensed' && <><div><label className="field-label" htmlFor={`license-${inputId}`}>License evidence link <span className="muted">HTTPS</span></label><input id={`license-${inputId}`} className="field" type="url" maxLength={1500} disabled={disabled} value={decision.licenseUrl} onChange={e => change({ licenseUrl: e.target.value })} placeholder="https://…"/></div><div><label className="field-label" htmlFor={`credit-${inputId}`}>Exact required attribution <span className="muted">Optional</span></label><textarea id={`credit-${inputId}`} className="field" rows={2} maxLength={1000} disabled={disabled} value={decision.attribution} onChange={e => change({ attribution: e.target.value })} placeholder="Paste the credit required by your license"/></div><div className="track-wide"><p className={`small ${needsEvidence ? 'unsaved-label' : 'muted'}`}>{needsEvidence ? 'Add a license note or evidence link before saving.' : 'Confirm the recording, destination, channel, and license terms. Use Save review & notebook note to keep this evidence for future projects.'}</p></div></>}
        {template && <button className="btn ghost track-wide" disabled={disabled} onClick={() => change({ action: 'licensed', notes: template.notes, licenseUrl: template.url, attribution: template.attribution })}>Use saved license note</button>}
        {decision.action === 'wrong_match' && <p className="small muted track-wide">The rejected result stays in the handoff so your editor can see the correction. It is excluded from saved credits.</p>}
        <div className="track-wide row track-save-row"><button className="btn secondary" disabled={disabled || needsEvidence || !dirty} onClick={() => onSave(false)}><Save size={16}/>{disabled ? 'Please wait…' : 'Save review changes'}</button>{decision.action === 'licensed' && <button className="btn ghost" disabled={disabled || needsEvidence} onClick={() => onSave(true)}><Save size={16}/>Save review &amp; notebook note</button>}<span className="small muted">Saves all current project edits.</span></div>
      </div>
    </div>
  </article>;
}
