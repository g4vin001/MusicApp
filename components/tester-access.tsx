'use client';

import { useState } from 'react';
import { FlaskConical, LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { clearTesterKey, setTesterKey } from '@/lib/tester-client';
import { creatorRequest } from '@/lib/creator-client';
import type { Configuration } from '@/lib/contracts';

type Props = { configuration: Configuration | null; disabled?: boolean; onChange: (configuration: Configuration) => void };

export function TesterAccess({ configuration, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy || (!configuration?.tester && !key.trim())) return;
    setBusy(true); setError('');
    try {
      if (configuration?.tester) clearTesterKey();
      else setTesterKey(key);
      const next = await creatorRequest<Configuration>('/api/config');
      if (!configuration?.tester && !next.tester) { clearTesterKey(); setError('That key was not accepted. Check the key and try again.'); return; }
      onChange(next); setKey(''); setOpen(false);
    } catch (e) {
      if (!configuration?.tester) clearTesterKey();
      setError(e instanceof Error ? e.message : 'Could not update tester access. Try again.');
    } finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (busy) return; setOpen(value); setKey(''); setError(''); }}>
    <DialogTrigger asChild><button className={`tester-control ${configuration?.tester ? 'enabled' : ''}`} disabled={disabled}><FlaskConical size={15}/>{configuration?.tester ? 'Tester mode on' : 'Tester mode'}</button></DialogTrigger>
    <DialogContent className="tester-dialog" onInteractOutside={e => { if (busy) e.preventDefault(); }} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }}>
      <DialogHeader><span className="dialog-icon"><FlaskConical size={22}/></span><DialogTitle>{configuration?.tester ? 'Tester mode is enabled' : 'Operator tester access'}</DialogTitle><DialogDescription>{configuration?.tester ? 'Recognition limits are bypassed for this browser session. You can return to the public allowance below.' : 'Enter your tester key to bypass app recognition limits for this browser session.'}</DialogDescription></DialogHeader>
      <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        {!configuration?.tester && <><label className="field-label" htmlFor="tester-access-key">Tester key</label><input id="tester-access-key" className="field" type="password" autoComplete="off" value={key} maxLength={200} onChange={e => setKey(e.target.value)} disabled={busy} aria-invalid={!!error} aria-describedby={error ? 'tester-access-error' : undefined} required/></>}
        <p className="small muted">AudD usage can still be billed. AI writing keeps its separate spending limits.</p>
        {error && <p id="tester-access-error" className="notice error" role="alert">{error}</p>}
        <DialogFooter><button type="button" className="btn ghost" disabled={busy} onClick={() => { setOpen(false); setKey(''); setError(''); }}>Cancel</button><button className="btn" disabled={busy || (!configuration?.tester && !key.trim())}>{busy && <LoaderCircle size={16} className="animate-spin"/>}{configuration?.tester ? 'Exit tester mode' : busy ? 'Checking key…' : 'Enable tester mode'}</button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
