'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Download, LoaderCircle, NotebookPen, RefreshCw, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Header, Footer } from '@/components/site-frame';
import { csvCell, safeLink } from '@/lib/contracts';
import { platformLabels, type LicenseNote } from '@/lib/creator';
import { creatorRequest, downloadReport } from '@/lib/creator-client';

export function LicenseNotebook() {
  const [notes, setNotes] = useState<LicenseNote[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState('');
  const mounted = useRef(true);
  const sequence = useRef(0);
  async function load() {
    const request = ++sequence.current;
    setLoading(true); setError('');
    try { const r = await creatorRequest<{ library: LicenseNote[] }>('/api/creator'); if (mounted.current && sequence.current === request) setNotes(r.library); }
    catch (e) { if (mounted.current && sequence.current === request) setError(e instanceof Error ? e.message : 'Could not load notes.'); }
    finally { if (mounted.current && sequence.current === request) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; sequence.current++; }; }, []);
  async function remove(id: string) {
    if (deleting) return;
    setDeleting(id); setError(''); setMessage('');
    try { await creatorRequest('/api/creator?noteId=' + encodeURIComponent(id), { method: 'DELETE' }); if (mounted.current) { setNotes(previous => previous.filter(n => n.id !== id)); setMessage('Notebook note deleted. Saved project decisions are kept.'); } }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not delete note.'); }
    finally { if (mounted.current) setDeleting(''); }
  }
  function exportNotes() {
    const rows = [['Title', 'Artist', 'Platform', 'License note', 'Evidence URL', 'Attribution'], ...notes.map(n => [n.song.title, n.song.artist, platformLabels[n.platform], n.notes, n.url, n.attribution])];
    downloadReport('music-license-notebook.csv', '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
    setMessage('Notebook download prepared. Check your browser’s downloads.');
  }
  async function copyCredit(note: LicenseNote) {
    try { await navigator.clipboard.writeText(note.attribution); setMessage('Attribution copied for ' + note.song.title + '.'); }
    catch { setError('Clipboard access is unavailable. Export the notebook to keep the attribution text.'); }
  }

  return <div className="shell"><Header/><main id="main-content" className="notebook-page">
    <div className="section-head page-heading"><div><span className="eyebrow">This browser’s collection</span><h1>License notebook</h1><p className="muted">Keep your evidence and attribution ready for the next edit.</p></div><div className="row"><button className="btn ghost icon-button" disabled={loading || !!deleting} onClick={() => void load()} aria-label="Refresh license notebook"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/></button><button className="btn secondary" disabled={loading || !notes.length || !!deleting} onClick={exportNotes}><Download size={17}/>Export notebook</button></div></div>
    <div className="notebook-context"><NotebookPen size={20}/><p>Save a reusable note from a recording’s review. Check that its license still covers the new destination, channel, and usage.</p><span className="badge neutral-badge">{notes.length} / 100 notes</span></div>
    {error && <div className="notice error" role="alert">{error}{!notes.length && <button className="btn ghost" disabled={loading} onClick={() => void load()}>Retry</button>}</div>}
    {message && <div className="notice saved-message" role="status"><Check size={16}/>{message}</div>}
    {loading ? <div className="loading-review" role="status"><span className="row"><LoaderCircle size={17} className="animate-spin"/>Loading your notebook…</span><div className="skeleton-line"/><div className="skeleton-line short"/></div> : notes.length ? <div className="notebook-list">{notes.map(n => <article className="panel notebook-note" key={n.id}>
      <div className="notebook-note-heading"><div><span className="badge neutral-badge">{platformLabels[n.platform]}</span><h2>{n.song.title}</h2><p className="muted">{n.song.artist}</p></div><AlertDialog><AlertDialogTrigger asChild><button className="btn ghost icon-button" disabled={!!deleting} aria-label={'Delete note for ' + n.song.title}>{deleting === n.id ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this license note?</AlertDialogTitle><AlertDialogDescription>The reusable note for {n.song.title} will be removed. Decisions saved in projects are kept. Export the notebook first if you need a copy.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep note</AlertDialogCancel><AlertDialogAction onClick={() => void remove(n.id)}>Delete note</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
      <div className="notebook-evidence"><span className="field-label">License scope &amp; evidence</span><p className="notebook-text">{n.notes || 'No scope note saved. Review the linked license terms before reuse.'}</p>{safeLink(n.url) && <a className="btn ghost" href={n.url} target="_blank" rel="noopener noreferrer">Open evidence link</a>}</div>
      {n.attribution && <div className="notebook-attribution"><div className="row between"><span className="field-label">Exact attribution</span><button className="btn ghost" onClick={() => void copyCredit(n)}><Clipboard size={14}/>Copy</button></div><p>{n.attribution}</p></div>}
      <p className="small muted note-updated">Updated {new Date(n.updated * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
    </article>)}</div> : !error && <div className="empty-box notebook-empty"><span className="empty-icon"><NotebookPen size={28}/></span><strong>Your reusable notes will live here.</strong><p>In a recording’s review, choose <b>License noted</b>, add evidence, and select <b>Save review &amp; notebook note</b>.</p><a className="btn" href="/">Review a recording</a></div>}
    <div className="collection-note"><p>Notes are retained for one year after their last update. Projects expire after seven days. Export a copy before clearing cookies or changing browsers.</p><p>A note records your evidence; it does not verify clearance.</p></div>
  </main><Footer/></div>;
}
