'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, AudioLines, Check, Clock3, Download, FileAudio, FileCheck2, LoaderCircle, NotebookPen, ShieldCheck, Upload } from 'lucide-react';
import { Header, Footer } from '@/components/site-frame';
import { TesterAccess } from '@/components/tester-access';
import { ScanWorkspace } from '@/components/scan-workspace';
import { decodeAudio, waveform } from '@/lib/audio';
import { secondsLabel, type Configuration } from '@/lib/contracts';
import { creatorRequest, productEvent } from '@/lib/creator-client';

export function CreatorStudio() {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [filename, setFilename] = useState('');
  const [fileHash, setFileHash] = useState('');
  const [sourceURL, setSourceURL] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const sourceObject = useRef('');
  const mounted = useRef(true);
  const accepting = useRef(false);
  const peaks = useMemo(() => audio ? waveform(audio, 48) : [], [audio]);
  const refresh = useCallback(async () => {
    try { const next = await creatorRequest<Configuration>('/api/config'); if (mounted.current) setConfiguration(next); }
    catch { if (mounted.current) setError('The scan service could not load. Try reconnecting below.'); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh(); void productEvent('studio_opened');
    return () => { mounted.current = false; if (sourceObject.current) URL.revokeObjectURL(sourceObject.current); };
  }, [refresh]);

  async function choose(file: File) {
    if (accepting.current || busy) return;
    accepting.current = true; setPreparing(true); setError(''); setNotice('');
    try {
      const decoded = await decodeAudio(file);
      if (!crypto.subtle) throw new Error('Open this site over HTTPS to prepare a resumable scan.');
      const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      if (!mounted.current) return;
      if (sourceObject.current) URL.revokeObjectURL(sourceObject.current);
      sourceObject.current = URL.createObjectURL(file);
      setSourceURL(sourceObject.current); setAudio(decoded); setFilename(file.name);
      setFileHash(Array.from(new Uint8Array(hash), c => c.toString(16).padStart(2, '0')).join(''));
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'This recording could not be read. Try exporting its audio as MP3 or WAV.'); }
    finally { accepting.current = false; if (mounted.current) setPreparing(false); }
  }

  const locked = busy || preparing;
  return <div className="shell creator-shell"><Header/><main id="main-content">
    <section className="studio-heading">
      <div><span className="eyebrow">Music review workspace <span className="edition-label">Early access</span></span><h1>Know what’s in your edit.</h1><p>Find the music. Keep your evidence. Give your editor a clear decision list.</p></div>
      <a href="/find" className="btn ghost">Find one song <ArrowUpRight size={16}/></a>
    </section>
    <ol className="studio-steps" aria-label="Review workflow"><li><span>01</span><div>Choose a recording<small>Video or audio</small></div></li><li><span>02</span><div>Check the coverage<small>See what was sampled</small></div></li><li><span>03</span><div>Review &amp; export<small>Decisions, evidence, next steps</small></div></li></ol>
    <div className={`studio-entry ${audio ? 'has-recording' : ''}`}>
    <section id="recording" className={`studio-import panel ${audio ? 'file-ready' : ''} ${dragging ? 'drag' : ''}`} aria-label="Choose a recording" aria-busy={preparing}
      onDragOver={e => { e.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) void choose(file); }}>
      <div className="row">
        <span className="studio-import-icon">{preparing ? <LoaderCircle size={26} className="animate-spin"/> : audio ? <Check size={26}/> : <FileAudio size={28}/>}</span>
        <div className="import-file-info">
          <span className="eyebrow">{preparing ? 'Preparing on your device' : audio ? 'Recording ready' : 'Your source recording'}</span>
          <h2>{preparing ? 'Reading the audio…' : audio ? filename : 'Drop a video or audio file here'}</h2>
          <p>{audio && !preparing ? <><Clock3 size={14} className="inline-icon"/>{secondsLabel(audio.duration)} <span className="import-separator">·</span> Original audio <span className="import-separator">·</span> Ready to plan below</> : 'MP3, WAV, M4A, FLAC, MP4 or WebM · up to 40 MB and 20 minutes'}</p>
        </div>
      </div>
      {audio && !preparing && <div className="import-waveform" role="img" aria-label="Waveform of your recording">{peaks.map((peak, index) => <span key={index} style={{ height: `${Math.max(8, peak * 100)}%` }}/>)}</div>}
      <input ref={input} type="file" className="sr-only" aria-label="Choose creator recording" disabled={locked} accept="audio/*,video/mp4,video/webm,video/quicktime,.m4a,.flac,.mov" onChange={e => { const file = e.target.files?.[0]; if (file) void choose(file); e.target.value = ''; }}/>
      <div className="import-actions">{audio && !preparing && <a className="btn" href="#scan">View scan plan <ArrowDown size={16}/></a>}<button className={`btn ${audio ? 'ghost' : ''}`} disabled={locked} onClick={() => input.current?.click()}>{preparing ? <LoaderCircle size={17} className="animate-spin"/> : <Upload size={17}/>} {preparing ? 'Preparing…' : audio ? 'Change recording' : 'Choose recording'}</button>{!audio && <span className="small muted">Or drag a file into this space</span>}</div>
    </section>
    <aside className="studio-deliverable panel" aria-label="What your review includes"><span className="eyebrow row"><FileCheck2 size={16}/> Your editor handoff</span><h2>From a recording<br/>to a review you can use.</h2><ul><li><AudioLines size={19}/><div><strong>Checked timestamps</strong><span>Matches and coverage gaps together</span></div></li><li><NotebookPen size={19}/><div><strong>Your decisions &amp; evidence</strong><span>License notes and replacement decisions</span></div></li><li><Download size={19}/><div><strong>A portable handoff</strong><span>Text, CSV, JSON, and saved credits</span></div></li></ul><p>Recognition suggests matches. You confirm the recording and permission.</p></aside>
    </div>
    <div className="studio-utility"><span className="row"><ShieldCheck size={16}/>Full recording stays on this device. Only short sections are sent for recognition.</span><div className="row"><TesterAccess configuration={configuration} disabled={locked} onChange={next => { setConfiguration(next); setNotice(next.tester ? 'Tester mode enabled for this session. Provider usage can still be billed.' : 'Tester mode disabled. Public scan limits apply again.'); }}/>{configuration?.tester && <a className="text-action" href="/insights">Product metrics</a>}</div></div>
    {error && <div className="notice error" role="alert">{error}{!configuration && <button className="btn ghost" onClick={() => { setError(''); void refresh(); }}>Reconnect</button>}</div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {configuration && !configuration.recognition && <div className="notice">Recognition is temporarily unavailable. Saved reviews and exports remain available.</div>}
    <ScanWorkspace audio={audio} filename={filename} fileHash={fileHash} sourceURL={sourceURL} configuration={configuration} locked={locked} onChooseFile={() => input.current?.click()} onBusyChange={setBusy} onComplete={refresh} creator/>
    <section className="studio-bottom" aria-label="Review resources">
      <a href="/licenses" className="panel studio-resource"><NotebookPen size={22}/><div><h2>Your license notebook</h2><p>Reuse evidence links and the exact credit text you saved.</p></div><ArrowUpRight size={18} className="resource-arrow"/></a>
      <a href="/how-it-works" className="panel studio-resource"><ShieldCheck size={22}/><div><h2>Understand your coverage</h2><p>See what a survey checks and how to review the gaps.</p></div><ArrowUpRight size={18} className="resource-arrow"/></a>
    </section>
  </main><Footer/></div>;
}
