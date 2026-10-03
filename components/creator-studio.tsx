'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock3, FileAudio, LoaderCircle, NotebookPen, ShieldCheck, Upload } from 'lucide-react';
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
      <div><span className="eyebrow">Creator studio <span className="edition-label">Early access</span></span><h1>Review the music in your recording.</h1><p>Check the audio, record your decisions, and export a handoff for your edit.</p></div>
      <a href="/find" className="btn ghost">Find one song</a>
    </section>
    <ol className="studio-steps" aria-label="Review workflow"><li><span>01</span>Choose a recording</li><li><span>02</span>Check the coverage</li><li><span>03</span>Review &amp; export</li></ol>
    <section className={`studio-import panel ${audio ? 'file-ready' : ''} ${dragging ? 'drag' : ''}`} aria-label="Choose a recording" aria-busy={preparing}
      onDragOver={e => { e.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) void choose(file); }}>
      <div className="row">
        <span className="studio-import-icon">{preparing ? <LoaderCircle size={26} className="animate-spin"/> : audio ? <Check size={26}/> : <FileAudio size={28}/>}</span>
        <div className="import-file-info">
          <span className="eyebrow">{preparing ? 'Preparing on your device' : audio ? 'Recording ready' : 'Start with your footage'}</span>
          <h2>{preparing ? 'Reading the audio…' : audio ? filename : 'Drop a video or audio file here'}</h2>
          <p>{audio && !preparing ? <><Clock3 size={14} className="inline-icon"/>{secondsLabel(audio.duration)} <span className="import-separator">·</span> Original audio <span className="import-separator">·</span> Ready to plan below</> : 'MP3, WAV, M4A, FLAC, MP4 or WebM · up to 40 MB and 20 minutes'}</p>
        </div>
      </div>
      {audio && !preparing && <div className="import-waveform" aria-hidden="true">{peaks.map((peak, index) => <span key={index} style={{ height: `${Math.max(8, peak * 100)}%` }}/>)}</div>}
      <input ref={input} type="file" className="sr-only" aria-label="Choose creator recording" disabled={locked} accept="audio/*,video/mp4,video/webm,video/quicktime,.m4a,.flac,.mov" onChange={e => { const file = e.target.files?.[0]; if (file) void choose(file); e.target.value = ''; }}/>
      <button className="btn" disabled={locked} onClick={() => input.current?.click()}>{preparing ? <LoaderCircle size={17} className="animate-spin"/> : <Upload size={17}/>} {preparing ? 'Preparing…' : audio ? 'Change recording' : 'Choose recording'}</button>
    </section>
    <div className="studio-utility"><span className="row"><ShieldCheck size={16}/>Full recording stays on this device. Only short sections are sent for recognition.</span><div className="row"><TesterAccess configuration={configuration} disabled={locked} onChange={next => { setConfiguration(next); setNotice(next.tester ? 'Tester mode enabled for this session. Provider usage can still be billed.' : 'Tester mode disabled. Public scan limits apply again.'); }}/>{configuration?.tester && <a className="text-action" href="/insights">Product metrics</a>}</div></div>
    {error && <div className="notice error" role="alert">{error}{!configuration && <button className="btn ghost" onClick={() => { setError(''); void refresh(); }}>Reconnect</button>}</div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {configuration && !configuration.recognition && <div className="notice">Recognition is temporarily unavailable. Saved reviews and exports remain available.</div>}
    <ScanWorkspace audio={audio} filename={filename} fileHash={fileHash} sourceURL={sourceURL} configuration={configuration} locked={locked} onChooseFile={() => input.current?.click()} onBusyChange={setBusy} onComplete={refresh} creator/>
    <section className="studio-bottom" aria-label="Review resources">
      <a href="/licenses" className="panel studio-resource"><NotebookPen size={22}/><div><h2>Your license notebook</h2><p>Reuse evidence links and the exact credit text you saved.</p></div><span className="resource-label">Open notebook</span></a>
      <a href="/how-it-works" className="panel studio-resource"><ShieldCheck size={22}/><div><h2>Understand your coverage</h2><p>See what a survey checks and how to review the gaps.</p></div><span className="resource-label">Read the guide</span></a>
    </section>
  </main><Footer/></div>;
}
