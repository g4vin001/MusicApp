'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileAudio, FolderOpen, LoaderCircle, NotebookPen, Upload } from 'lucide-react';
import { Header, Footer } from '@/components/music-finder';
import { ScanWorkspace } from '@/components/scan-workspace';
import { decodeAudio } from '@/lib/audio';
import type { Configuration } from '@/lib/contracts';
import { clearTesterKey, setTesterKey } from '@/lib/tester-client';
import { creatorRequest, productEvent } from '@/lib/creator-client';

export function CreatorStudio() {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [audio, setAudio] = useState<AudioBuffer | null>(null), [filename, setFilename] = useState(''), [fileHash, setFileHash] = useState(''), [sourceURL, setSourceURL] = useState('');
  const [busy, setBusy] = useState(false), [preparing, setPreparing] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null), sourceObject = useRef(''), mounted = useRef(true), accepting = useRef(false);
  const refresh = useCallback(async () => {
    try { const next = await creatorRequest<Configuration>('/api/config'); if (mounted.current) setConfiguration(next); }
    catch { if (mounted.current) setError('The scan service could not load. Refresh to try again.'); }
  }, []);
  useEffect(() => { mounted.current = true; void refresh(); void productEvent('studio_opened'); return () => { mounted.current = false; if (sourceObject.current) URL.revokeObjectURL(sourceObject.current); }; }, [refresh]);
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
  async function toggleTester() {
    setError(''); setNotice('');
    if (configuration?.tester) { clearTesterKey(); await refresh(); setNotice('Public scan limits apply again.'); return; }
    const key = window.prompt('Enter your operator tester key. Provider usage can still be billed.');
    if (!key) return;
    setTesterKey(key);
    try { const next = await creatorRequest<Configuration>('/api/config'); if (!next.tester) { clearTesterKey(); setError('Tester key was not accepted.'); return; } setConfiguration(next); setNotice('Tester mode enabled. App recognition quotas are bypassed for this session.'); }
    catch (e) { clearTesterKey(); setError(e instanceof Error ? e.message : 'Could not enable tester mode.'); }
  }
  const locked = busy || preparing;
  return <div className="shell creator-shell"><Header/><main>
    <section className="studio-heading"><div><span className="eyebrow">Creator studio · early access</span><h1>Review the music in your edit.</h1><p>Find recordings, keep license notes, and send clear decisions to your editor.</p></div><a href="/find" className="btn ghost">Find one song</a></section>
    <section className={`studio-import panel ${dragging ? 'drag' : ''}`} aria-label="Choose a recording" onDragOver={e => { e.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) void choose(file); }}>
      <div className="row"><span className="studio-import-icon"><FileAudio size={28}/></span><div><h2>{preparing ? 'Reading your recording…' : audio ? filename : 'Drop your video or audio file'}</h2><p>MP3, WAV, M4A, FLAC, MP4 or WebM · up to 40 MB / 20 minutes</p></div></div>
      <input ref={input} type="file" className="sr-only" aria-label="Choose creator recording" accept="audio/*,video/mp4,video/webm,video/quicktime,.m4a,.flac,.mov" onChange={e => { const file = e.target.files?.[0]; if (file) void choose(file); e.target.value = ''; }}/>
      <button className="btn" disabled={locked} onClick={() => input.current?.click()}>{preparing ? <LoaderCircle size={17} className="animate-spin"/> : <Upload size={17}/>} {audio ? 'Change recording' : 'Choose recording'}</button>
    </section>
    <div className="studio-utility"><span>Full recordings stay on this device. Only short sections are sent for recognition.</span><div className="row"><button className="text-action" disabled={locked} onClick={() => void toggleTester()}>{configuration?.tester ? 'Exit tester mode' : 'Tester mode'}</button>{configuration?.tester && <a className="text-action" href="/insights">Product metrics</a>}</div></div>
    {error && <div className="notice error" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
    {configuration && !configuration.recognition && <div className="notice">Recognition is temporarily unavailable. Saved projects, review notes and exports remain available.</div>}
    <ScanWorkspace audio={audio} filename={filename} fileHash={fileHash} sourceURL={sourceURL} configuration={configuration} locked={locked} onChooseFile={() => input.current?.click()} onBusyChange={setBusy} onComplete={refresh} creator/>
    <section className="studio-bottom"><a href="/licenses" className="panel studio-resource"><NotebookPen size={22}/><div><h2>Your license notebook</h2><p>Keep evidence links and exact attribution text for recordings you use again.</p></div></a><a href="/how-it-works" className="panel studio-resource"><FolderOpen size={22}/><div><h2>Review coverage before publishing</h2><p>A survey can miss music between samples. Every report keeps those gaps visible.</p></div></a></section>
  </main><Footer/></div>;
}
