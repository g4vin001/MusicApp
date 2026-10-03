'use client';
import { useEffect, useRef, useState } from 'react';
import { BarChart3, Download, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Header, Footer } from '@/components/site-frame';
import { creatorRequest, downloadReport, RequestError } from '@/lib/creator-client';
import { clearTesterKey, setTesterKey } from '@/lib/tester-client';

type Insights = { periodDays: number; events: { kind: string; value: string; count: number; visitors: number }[]; jobs: { projects: number; sections: number; matched: number; no_match: number; unresolved: number }; last24Hours: { kind: string; requests: number; finished: number }[]; cumulativeMeters: { id: string; used: number }[]; returning: { visitors: number }; aiEnabled: boolean; notes: string[] };
const eventLabels: Record<string, string> = { studio_opened: 'Studio opened', report_opened: 'Report opened', review_saved: 'Review saved', report_exported: 'Handoff or export', feedback: 'Feedback' };
const providerLabels: Record<string, string> = { recognize: 'Public recognition', recognize_test: 'Tester recognition', creator_ai: 'AI writing' };

export function ProductInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [accessRequired, setAccessRequired] = useState(false);
  const [updated, setUpdated] = useState('');
  const mounted = useRef(true);
  const sequence = useRef(0);

  async function load(login = false) {
    const request = ++sequence.current;
    setLoading(true); setError('');
    if (login) setTesterKey(key);
    try {
      const result = await creatorRequest<Insights>('/api/insights');
      if (!mounted.current || sequence.current !== request) return;
      setData(result); setAccessRequired(false); setKey(''); setUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      if (!mounted.current || sequence.current !== request) return;
      if (e instanceof RequestError && (e.status === 403 || e.status === 401)) {
        setData(null); setAccessRequired(true); clearTesterKey();
        if (login) setError('That tester key was not accepted. Check the key and try again.');
      } else setError(e instanceof Error ? e.message : 'Could not load measurements.');
    } finally { if (mounted.current && sequence.current === request) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; sequence.current++; }; }, []);
  const visitors = data?.events.filter(e => e.kind === 'studio_opened').reduce((n, e) => n + e.visitors, 0) || 0;
  const reportUsers = data?.events.filter(e => e.kind === 'report_opened').reduce((n, e) => n + e.visitors, 0) || 0;
  const exports = data?.events.filter(e => e.kind === 'report_exported').reduce((n, e) => n + e.count, 0) || 0;

  return <div className="shell"><Header/><main id="main-content" className="notebook-page insights-page">
    <div className="section-head page-heading"><div><span className="eyebrow">Operator workspace</span><h1>Product measurements</h1><p className="muted">See whether people review, export, and return.</p></div>{data && <div className="row"><span className="small muted">Updated {updated}</span><button className="btn ghost icon-button" disabled={loading} onClick={() => void load()} aria-label="Refresh product measurements"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/></button></div>}</div>
    {error && <div className="notice error" role="alert">{error}{!accessRequired && <button className="btn ghost" disabled={loading} onClick={() => void load()}>Retry</button>}</div>}
    {accessRequired && !data && <section className="panel operator-login"><span className="dialog-icon"><ShieldCheck size={24}/></span><h2>Private operator access</h2><p className="muted">Use your tester key to view product measurements. This page does not expose project notes or recordings.</p><form onSubmit={e => { e.preventDefault(); void load(true); }}><label className="field-label" htmlFor="operator-key">Tester key</label><div className="search-row"><input id="operator-key" className="field" type="password" autoComplete="off" maxLength={200} disabled={loading} value={key} onChange={e => setKey(e.target.value)} required/><button className="btn" disabled={loading || !key.trim()}>{loading && <LoaderCircle size={16} className="animate-spin"/>}{loading ? 'Checking…' : 'View measurements'}</button></div></form></section>}
    {loading && !accessRequired && !data && <div className="loading-review" role="status"><span className="row"><LoaderCircle size={17} className="animate-spin"/>Loading product measurements…</span><div className="skeleton-line"/><div className="skeleton-line short"/></div>}
    {data && <>
      <div className="metrics-period"><span className="row"><BarChart3 size={17}/>Last {data.periodDays} days</span><span className="small muted">Browser collections, rather than verified people</span></div>
      <div className="report-metrics"><div><strong>{visitors}</strong><span>opened the studio</span></div><div><strong>{reportUsers}</strong><span>opened a report</span></div><div><strong>{exports}</strong><span>handoff / export actions</span></div><div><strong>{data.returning.visitors}</strong><span>returned another day</span></div></div>
      <section className="panel insights-section"><div className="section-head"><div><h2>Recent scan outcomes</h2><p className="small muted">Retained seven-day projects. Match counts do not measure accuracy.</p></div><span className="badge neutral-badge">{data.jobs.projects} projects</span></div><div className="outcome-grid"><div><strong>{data.jobs.sections}</strong><span>sections</span></div><div><strong>{data.jobs.matched}</strong><span>matches returned</span></div><div><strong>{data.jobs.no_match}</strong><span>no matches</span></div><div><strong>{data.jobs.unresolved}</strong><span>unresolved</span></div></div></section>
      <section className="panel insights-section"><div className="section-head"><h2>Observed actions</h2></div>{data.events.length ? <div className="insights-table-wrap"><table className="insights-table"><caption className="sr-only">Product events during the last {data.periodDays} days</caption><thead><tr><th scope="col">Action</th><th scope="col">Detail</th><th scope="col">Count</th><th scope="col">Browser collections</th></tr></thead><tbody>{data.events.map(e => <tr key={e.kind + ':' + e.value}><td>{eventLabels[e.kind] || e.kind.replaceAll('_', ' ')}</td><td>{e.value ? e.value.replaceAll('_', ' ') : '—'}</td><td>{e.count}</td><td>{e.visitors}</td></tr>)}</tbody></table></div> : <div className="history-empty"><BarChart3 size={24}/><strong>No actions recorded yet</strong><p>Studio visits, saved reviews, and export actions will appear here as the product is used.</p></div>}</section>
      <section className="panel insights-section"><div className="section-head"><div><h2>Provider usage</h2><p className="small muted">Reservations in the last 24 hours; these are request counts, not a billing statement.</p></div><span className="badge neutral-badge">GPT {data.aiEnabled ? 'enabled' : 'disabled'}</span></div>{data.last24Hours.length ? <div className="provider-usage-grid">{data.last24Hours.map(r => <div className="usage-item" key={r.kind}><span className="field-label">{providerLabels[r.kind] || r.kind}</span><strong>{r.requests}</strong><p className="small muted">reserved · {r.finished} responses recorded</p></div>)}</div> : <p className="muted">No provider requests were reserved in this period.</p>}{data.cumulativeMeters.length > 0 && <div className="cumulative-meters"><span className="small muted">Persistent budget counters</span>{data.cumulativeMeters.map(m => <span className="small" key={m.id}>{providerLabels[m.id] || m.id.replaceAll('_', ' ')}: {m.used}</span>)}</div>}</section>
      <details className="measurement-notes"><summary>How to interpret these numbers</summary>{data.notes.map(n => <p className="small muted" key={n}>{n}</p>)}</details>
      <div className="row insights-actions"><button className="btn secondary" onClick={() => downloadReport('creator-product-metrics.json', JSON.stringify(data, null, 2), 'application/json')}><Download size={16}/>Export measurements</button><button className="btn ghost" onClick={() => { clearTesterKey(); setData(null); setAccessRequired(true); setError(''); setKey(''); }}>Exit tester mode</button></div>
    </>}
  </main><Footer/></div>;
}
