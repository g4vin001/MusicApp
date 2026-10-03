'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Check, Download, FolderOpen, LoaderCircle, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SongCard } from '@/components/song-card';
import { prepareClip } from '@/lib/audio';
import { secondsLabel, type Configuration } from '@/lib/contracts';
import { intervalCoverage, planScan, scanCSV, scanStats, timelineHits, type ScanAllowance, type ScanInput, type ScanJob, type ScanSummary, type ScanWindow } from '@/lib/scan';
import { CreatorReport } from '@/components/creator-report';
import { creatorRequest } from '@/lib/creator-client';

type Props = { audio: AudioBuffer | null; sourceURL: string; fileHash: string; filename: string; configuration: Configuration | null; locked: boolean; onChooseFile: () => void; onBusyChange: (running: boolean) => void; onComplete: () => void; creator?: boolean };
type JobResponse = { job: ScanJob; allowance: ScanAllowance };
const request = creatorRequest;
function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const label = (ms: number) => secondsLabel(ms / 1000);
const stateLabels = { pending: 'Not checked', processing: 'Processing', matched: 'Match', no_match: 'No match', silent: 'Silence skipped', error: 'Unresolved' };

export function ScanWorkspace({ audio, sourceURL, fileHash, filename, configuration, locked, onChooseFile, onBusyChange, onComplete, creator = false }: Props) {
  const [mode, setMode] = useState<ScanInput['mode']>('survey');
  const [samples, setSamples] = useState(2);
  const [available, setAvailable] = useState<ScanAllowance | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [reviewSession, setReviewSession] = useState(0);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [jobs, setJobs] = useState<ScanSummary[]>([]);
  const [job, setJob] = useState<ScanJob | null>(null);
  const [running, setRunning] = useState(false);
  const [pauseRequested, setPauseRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const player = useRef<HTMLAudioElement>(null);
  const executing = useRef(false), stop = useRef(false), mounted = useRef(true);
  const selectionSequence = useRef(0);
  const maxSamples = configuration?.tester ? 100 : Math.min(20, configuration?.dailyLimit || 5);
  const effectiveSamples = Math.min(samples, maxSamples);
  const durationMs = audio ? Math.min(1_200_000, Math.round(audio.duration * 1000)) : 0;
  const plan = useMemo(() => durationMs >= 2000 ? planScan(durationMs, mode, effectiveSamples) : [], [durationMs, mode, effectiveSamples]);
  const stats = job ? scanStats(job) : null;
  const hits = useMemo(() => job ? timelineHits(job.segments) : [], [job]);
  const sameFile = !!job && fileHash === job.fileHash && !!audio;
  const remaining = available?.remaining ?? configuration?.remainingScans ?? 0;
  const refresh = useCallback(async () => {
    try {
      const response = await request<{ jobs: ScanSummary[]; allowance: ScanAllowance }>('/api/scans');
      if (!mounted.current) return;
      setJobs(response.jobs); setAvailable(response.allowance); setHistoryError('');
    } catch { if (mounted.current) setHistoryError('Saved scans could not be loaded. Your current review is kept.'); }
    finally { if (mounted.current) setHistoryLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current = true; }; }, []);
  useEffect(() => { if (!locked) void refresh(); }, [locked, refresh, configuration?.tester]);
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  function guardNavigation(action: () => void) {
    if (reviewDirty) setPendingNavigation(() => action);
    else action();
  }
  const update = (response: JobResponse) => { if (mounted.current) { setJob(response.job); setAvailable(response.allowance); } };
  async function openJob(id: string) {
    if (executing.current || locked) return;
    const sequence = ++selectionSequence.current;
    setLoading(true); setError(''); setNotice(''); setSelected(null);
    try { const response = await request<JobResponse>('/api/scans?id=' + encodeURIComponent(id)); if (mounted.current && sequence === selectionSequence.current) update(response); }
    catch (e) { if (mounted.current && sequence === selectionSequence.current) setError(e instanceof Error ? e.message : 'Could not load the scan.'); }
    finally { if (mounted.current && sequence === selectionSequence.current) setLoading(false); }
  }
  async function run(initial: ScanJob) {
    if (!audio || fileHash !== initial.fileHash) { setError('Choose the same original file to resume. Your saved results are still available.'); return; }
    if (executing.current) return;
    executing.current = true; stop.current = false; setPauseRequested(false); setRunning(true); onBusyChange(true); setError(''); setNotice('');
    let current = initial;
    try {
      const latest = await request<JobResponse>('/api/scans?id=' + current.id); current = latest.job; update(latest);
      for (let index = 0; index < current.segments.length; index++) {
        if (stop.current || !mounted.current) break;
        const segment = current.segments[index];
        if (segment.state === 'processing') { setNotice('Another request is finishing this section. Refresh progress shortly; it will not be sent twice.'); break; }
        if (segment.state !== 'pending') continue;
        const clip = await prepareClip(audio, segment.startMs / 1000, 1, false, (segment.endMs - segment.startMs) / 1000, true);
        if (stop.current || !mounted.current) break;
        const response = await request<JobResponse>(`/api/scans/segment?id=${current.id}&index=${index}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav', 'X-Source-SHA256': fileHash }, body: clip });
        current = response.job; update(response);
        if (current.segments[index].state === 'processing') { setNotice('This section is still processing. Refresh progress before continuing.'); break; }
      }
      if (mounted.current) {
        const done = scanStats(current);
        if (done.completed === done.total) setNotice(done.errors ? 'Scan finished with unresolved sections. They are marked in the timeline.' : 'The planned sections are finished. Review the coverage and matches below.');
        else if (stop.current) setNotice('Paused. Completed sections are saved; resume with this same file.');
      }
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'The connection was interrupted. Your saved progress is kept.');
        try { update(await request<JobResponse>('/api/scans?id=' + current.id)); } catch { /* Keep the last visible progress. */ }
      }
    } finally {
      executing.current = false;
      if (mounted.current) { setRunning(false); setPauseRequested(false); onBusyChange(false); onComplete(); void refresh(); }
    }
  }
  async function start() {
    if (!audio || !fileHash || locked || loading || executing.current) return;
    setLoading(true); onBusyChange(true); setError(''); setNotice(''); setSelected(null);
    try {
      const input: ScanInput = { id: crypto.randomUUID(), fileHash, filename: filename.slice(0, 180), durationMs, mode, samples: effectiveSamples };
      const response = await request<JobResponse>('/api/scans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      update(response); await run(response.job);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the scan.'); void refresh(); }
    finally { setLoading(false); onBusyChange(false); }
  }
  async function remove() {
    if (!job || executing.current) return;
    setLoading(true);
    try { await request('/api/scans?id=' + job.id, { method: 'DELETE' }); setJob(null); setNotice('Scan deleted. Saved finds and reusable license notes are kept separately.'); void refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete the scan.'); }
    finally { setLoading(false); }
  }
  function jump(window: ScanWindow) {
    setSelected(window.index);
    if (!sameFile || !player.current) return;
    player.current.currentTime = window.startMs / 1000;
    void player.current.play().catch(() => setNotice('Use the audio player to replay this section.'));
  }
  const selectedSegment = job?.segments.find(s => s.index === selected);
  const configured = configuration !== null;
  const allowanceLabel = !configured ? 'Checking scan allowance…' : configuration.tester ? 'Tester mode · recognition quota bypassed' : `${remaining} recognition requests available`;
  const expiresLabel = job ? new Date(job.expires * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '';
  return <section className="section scan-workspace" id="scan" aria-label="Video song timeline">
    <div className="section-head"><div><span className="eyebrow">{creator ? '02 · Check the coverage' : 'Music throughout a recording'}</span><h2>{creator ? 'Scan your recording' : 'Build a song timeline'}</h2></div><span className="pill allowance-pill" role="status"><AudioLines size={15}/>{allowanceLabel}</span></div>
    <div className="scan-layout">
      <div className="panel scan-planner">
        <div className="row between"><h3>{audio ? 'Choose how much to check' : 'Scan coverage'}</h3>{(audio || !creator) && <button className="btn ghost" onClick={onChooseFile} disabled={locked || loading}><FolderOpen size={16}/>{audio ? 'Change file' : 'Choose file'}</button>}</div>
        {audio ? <><p className="scan-filename">{filename}</p><p className="small muted">{label(durationMs)} · original speed · your full file stays on this device</p>
          <Tabs value={mode} onValueChange={value => setMode(value as ScanInput['mode'])}><TabsList className="scan-mode-tabs" aria-label="Scan coverage"><TabsTrigger value="survey" disabled={locked || loading}>Quick survey</TabsTrigger><TabsTrigger value="continuous" disabled={locked || loading}>Continuous scan</TabsTrigger></TabsList></Tabs>
          <p className="scan-mode-description">{mode === 'survey' ? 'A quick first pass: checks short sections across the recording. Music between them can be missed.' : 'Checks consecutive sections across the full duration. Uses more requests and can still miss music.'}</p>
          {mode === 'survey' && <div className="scan-samples"><label htmlFor="scan-samples" className="field-label">Up to {effectiveSamples} sections</label><Slider id="scan-samples" aria-label="Number of survey sections" min={1} max={Math.max(2, maxSamples)} step={1} value={[effectiveSamples]} onValueChange={v => setSamples(Math.min(v[0], maxSamples))} disabled={locked || loading || maxSamples < 2}/></div>}
          <div className="coverage-rail planned" aria-label={`Planned coverage: ${Math.round(intervalCoverage(plan) / durationMs * 100)} percent`}>{plan.map(w => <span key={w.index} style={{ left: `${100 * w.startMs / durationMs}%`, width: `${100 * (w.endMs - w.startMs) / durationMs}%` }}/>)}</div><div className="row between micro muted"><span>0:00</span><span>{label(durationMs)}</span></div>
          <dl className="scan-estimate"><div><dt>Maximum requests</dt><dd>{plan.length}</dd></div><div><dt>Audio to check</dt><dd>{label(intervalCoverage(plan))} <span>of {label(durationMs)}</span></dd></div></dl>
          {!configuration?.tester && plan.length > remaining && <p className="scan-warning" role="status">This plan needs up to {plan.length} requests; {remaining} are available. {mode === 'continuous' ? 'Choose a survey or a shorter recording.' : 'Reduce the section count or return when the allowance recovers.'}</p>}
          {configuration && !configuration.recognition && <p className="small muted">Audio matching is awaiting activation. You can inspect the scan plan now.</p>}
          {!fileHash && <p className="small muted">Open this site over HTTPS to start or resume a scan. Clip previews and planning are available here.</p>}
          <button className="btn full" onClick={() => guardNavigation(() => void start())} disabled={locked || loading || !fileHash || !configuration?.recognition || !plan.length || (!configuration?.tester && plan.length > remaining)}>{loading ? <LoaderCircle size={16} className="animate-spin"/> : <Play size={16}/>} {running ? 'Scanning your recording…' : loading ? 'Preparing the scan…' : `Start scan · up to ${plan.length} requests`}</button>
          <p className="micro muted">Cached results and silence do not use a scan. No-match and failed provider requests can. The shared allowance is checked before each section.</p>
        </> : <div className="scan-placeholder"><AudioLines size={30}/><p>Choose your recording to preview the checked sections and request count before starting.</p><div className="coverage-options-preview"><div><strong>Quick survey</strong><span>A few short sections</span></div><div><strong>Continuous scan</strong><span>Consecutive sections</span></div></div></div>}
      </div>
      <div className="panel scan-history"><div className="row between"><h3>{creator ? 'Recent projects' : 'Recent scans'}</h3><button className="btn ghost" aria-label="Refresh recent scans" onClick={refresh} disabled={locked || loading}><RefreshCw size={15}/></button></div><p className="small muted">Saved for 7 days in this browser's collection. Keep this page open while scanning.</p>
        {historyLoading ? <div className="history-loading" role="status"><span className="row small muted"><LoaderCircle size={16} className="animate-spin"/>Loading recent projects…</span><div className="skeleton-line"/><div className="skeleton-line short"/></div> : historyError ? <p role="alert" className="scan-warning">{historyError} <button onClick={refresh} className="btn ghost">Retry</button></p> : jobs.length ? <div className="scan-history-list">{jobs.map(s => <button className={`scan-history-item ${job?.id === s.id ? 'selected' : ''}`} key={s.id} onClick={() => { if (job?.id !== s.id) guardNavigation(() => void openJob(s.id)); }} aria-current={job?.id === s.id ? 'true' : undefined} disabled={locked || loading}><span>{s.filename}</span><small>{s.mode === 'continuous' ? 'Continuous' : 'Survey'} · {s.completed}/{s.total} sections <span className="history-state">{s.completed === s.total ? 'Finished' : 'In progress'}</span></small></button>)}</div> : <div className="history-empty"><FolderOpen size={24}/><strong>No saved projects yet</strong><p>Your scans and review notes will appear here after your first scan.</p></div>}
      </div>
    </div>
    {error && <div className="notice error" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
    {job && stats && <div className="panel scan-results"><div className="section-head"><div><span className="eyebrow">{job.mode === 'continuous' ? 'Continuous scan' : 'Survey results'}</span><h3>{job.filename}</h3></div><div className="row scan-actions">
      {running ? <button className="btn secondary" onClick={() => { stop.current = true; setPauseRequested(true); }} disabled={pauseRequested}><Pause size={16}/>{pauseRequested ? 'Pausing after this section…' : 'Pause'}</button> : stats.completed < stats.total && <button className="btn" onClick={() => run(job)} disabled={locked || loading || !sameFile || !configuration?.recognition}><Play size={16}/>Resume</button>}
      <button className="btn ghost" onClick={() => openJob(job.id)} disabled={locked || loading} aria-label="Refresh scan progress"><RefreshCw size={16}/></button>
      <AlertDialog><AlertDialogTrigger asChild><button className="btn ghost" disabled={locked || loading} aria-label="Delete this scan"><Trash2 size={16}/></button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this scan?</AlertDialogTitle><AlertDialogDescription>This deletes the scan, timeline, and project review notes, including unsaved edits. Saved songs and reusable notebook notes are kept. Export a handoff first if you need a copy.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep scan</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete scan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div></div>
      <div className="row between small"><span role="status" className="scan-progress-status">{running ? <LoaderCircle size={16} className="animate-spin inline-icon"/> : stats.completed === stats.total ? <Check size={14} className="inline-icon"/> : null}{stats.completed} of {stats.total} sections finished</span><span className="muted">{Math.round(stats.checkedMs / job.durationMs * 100)}% checked by recognition</span></div><Progress value={100 * stats.completed / Math.max(1, stats.total)} aria-label="Scan progress" className="scan-progress"/>
      <div className="coverage-rail results" aria-label="Scan coverage timeline">{job.segments.map(s => <button key={s.index} className={`segment-${s.state} ${selected === s.index ? 'selected' : ''}`} aria-label={`${label(s.startMs)} to ${label(s.endMs)}: ${stateLabels[s.state]}`} title={`${label(s.startMs)}–${label(s.endMs)} · ${stateLabels[s.state]}`} onClick={() => jump(s)} style={{ left: `${100 * s.startMs / job.durationMs}%`, width: `${100 * (s.endMs - s.startMs) / job.durationMs}%` }}/>)}</div><div className="row between micro muted"><span>0:00</span><span>{label(job.durationMs)}</span></div>
      <div className="scan-legend"><span><i className="segment-matched"/>Matched</span><span><i className="segment-no_match"/>No match</span><span><i className="segment-silent"/>Silence</span><span><i className="segment-error"/>Unresolved</span><span><i className="segment-pending"/>Not checked</span></div>
      <p className="small muted">{label(stats.checkedMs)} checked · {label(stats.silentMs)} silence skipped · {stats.providerCalls} provider requests · {stats.cacheHits} cached sections. Gaps and unresolved sections may contain other songs.</p>
      {sameFile ? <audio ref={player} src={sourceURL} controls preload="metadata" aria-label="Replay original recording"/> : <p className="notice">Select <strong>{job.filename}</strong> again to replay or resume. Its contents must match the original file. <button className="btn ghost" onClick={onChooseFile} disabled={locked || loading}>Choose file</button></p>}
      {selectedSegment && <p className="small">Selected {label(selectedSegment.startMs)}–{label(selectedSegment.endMs)}: {stateLabels[selectedSegment.state]}. {selectedSegment.result?.error}</p>}
      <p className="small muted">Ranges show checked sections, not exact song boundaries. This project expires {expiresLabel}; export a copy to keep it.</p>
      {creator ? <CreatorReport key={job.id + ":" + reviewSession} job={job} configuration={configuration} onReplay={jump} canReplay={sameFile} externallyLocked={loading && !running} onDirtyChange={setReviewDirty}/> : hits.length ? <div className="timeline-list">{hits.map(hit => <div className="timeline-entry" key={`${hit.song.id}:${hit.startMs}`}><button className="timeline-time" disabled={!sameFile} onClick={() => jump({ index: job.segments.find(s => s.startMs === hit.startMs)?.index || 0, startMs: hit.startMs, endMs: hit.endMs })}><Play size={14}/><strong>{label(hit.startMs)}–{label(hit.endMs)}</strong><span>{hit.samples} matched {hit.samples === 1 ? 'section' : 'sections'}</span></button><SongCard song={{ ...hit.song, sampleAt: undefined }}/></div>)}</div> : <div className="empty-box"><strong>{stats.completed ? 'No songs identified in the finished sections.' : 'Your timeline will appear as sections finish.'}</strong><p className="small">A no-match result does not mean the recording contains no music.</p></div>}
      {!creator && <div className="scan-export"><button className="btn secondary" onClick={() => download('whatsong-timeline.csv', scanCSV(job), 'text/csv;charset=utf-8')}><Download size={16}/>Export CSV</button><button className="btn ghost" onClick={() => download('whatsong-timeline.json', JSON.stringify({ ...job, fileHash: undefined, stats, timeline: hits, note: 'Ranges are submitted windows, not exact song boundaries.' }, null, 2), 'application/json')}><Download size={16}/>Export JSON</button><span className="micro muted">Exports include pending, no-match and unresolved sections.</span></div>}
    </div>}
    <AlertDialog open={!!pendingNavigation} onOpenChange={open => { if (!open) setPendingNavigation(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Leave this unsaved review?</AlertDialogTitle><AlertDialogDescription>Your saved decisions are kept. Changes you have not saved will be discarded. Choose Keep editing to save them first.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { const action = pendingNavigation; setPendingNavigation(null); setReviewSession(previous => previous + 1); setReviewDirty(false); action?.(); }}>Discard edits and continue</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
