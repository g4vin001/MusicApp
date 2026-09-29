'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Download, RotateCcw, Search, SlidersHorizontal, Volume2, Clock3 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { waveform } from '@/lib/audio';
import { clipDownloadName, DEFAULT_CLIP_SETTINGS, inspectClip, type ClipChannel, type ClipFilter, type ClipSettings } from '@/lib/clip-processing';
import { secondsLabel } from '@/lib/contracts';

export type ClipPreview = { url: string; settingsKey: string };
type Props = {
  audio: AudioBuffer; filename: string; sourceURL: string; settings: ClipSettings;
  preview: ClipPreview | null; locked: boolean; recognition: boolean;
  onChange: (settings: ClipSettings) => void; onPreview: () => void; onDownload: () => void; onIdentify: () => void;
};

export function ClipWorkbench({ audio, filename, sourceURL, settings, preview, locked, recognition, onChange, onPreview, onDownload, onIdentify }: Props) {
  const originalPlayer = useRef<HTMLAudioElement>(null), preparedPlayer = useRef<HTMLAudioElement>(null);
  const peaks = useMemo(() => waveform(audio), [audio]);
  const inspection = useMemo(() => {
    try { return { result: inspectClip(audio, settings), error: '' }; }
    catch (e) { return { result: null, error: e instanceof Error ? e.message : 'Choose another section.' }; }
  }, [audio, settings.start, settings.speed, settings.channel]);
  const stats = inspection.result;
  const currentPreview = preview?.settingsKey === JSON.stringify(settings);
  const canPrepare = !locked && !!stats;
  const maxStart = Math.max(0, audio.duration - 2 * settings.speed);
  const change = (patch: Partial<ClipSettings>) => onChange({ ...settings, ...patch });

  useEffect(() => {
    const player = originalPlayer.current;
    if (player && player.readyState >= 1) { player.pause(); player.currentTime = settings.start; }
    preparedPlayer.current?.pause();
  }, [settings.start, settings.speed, settings.channel, settings.filter, settings.normalize]);

  return <section className="editor clip-workbench" aria-label="Clip recovery workbench">
    <div className="row between clip-heading">
      <div><span className="eyebrow">Make the music easier to hear</span><h3>Prepare your clip</h3><p className="small muted clip-filename">{filename} · {secondsLabel(audio.duration)}</p></div>
      <SlidersHorizontal size={21} aria-hidden="true"/>
    </div>
    <div className="wave" aria-label="Original recording waveform">{peaks.map((p, i) => <span key={i} style={{ height: Math.max(3, p * 42), opacity: i / peaks.length >= settings.start / audio.duration && i / peaks.length <= (settings.start + 12 * settings.speed) / audio.duration ? 1 : .2 }}/>)}</div>
    <label className="field-label" htmlFor="clip-original-player">Original recording</label>
    <audio id="clip-original-player" ref={originalPlayer} controls src={sourceURL} preload="metadata" onLoadedMetadata={e => { e.currentTarget.currentTime = settings.start; }} onPlay={() => preparedPlayer.current?.pause()}/>

    <div className="control-grid">
      <div>
        <label className="field-label" htmlFor="clip-start">Start at {secondsLabel(settings.start)}</label>
        <Slider id="clip-start" aria-label="Clip start time" min={0} max={maxStart} step={.1} value={[settings.start]} onValueChange={v => change({ start: v[0] })} disabled={locked}/>
        <label className="clip-exact-time small">Seconds <input className="field" aria-label="Exact clip start in seconds" type="number" min={0} max={maxStart} step="0.1" value={Number(settings.start.toFixed(1))} onChange={e => { const start = e.target.valueAsNumber; if (Number.isFinite(start)) change({ start: Math.min(maxStart, Math.max(0, start)) }); }} disabled={locked}/></label>
      </div>
      <div>
        <label className="field-label" htmlFor="clip-speed">Speed &amp; pitch · {settings.speed.toFixed(2)}×</label>
        <Slider id="clip-speed" aria-label="Playback speed and pitch" min={.65} max={Math.min(1.35, Math.floor(audio.duration / 2 * 20) / 20)} step={.05} value={[settings.speed]} onValueChange={v => change({ speed: v[0], start: Math.min(settings.start, Math.max(0, audio.duration - 2 * v[0])) })} disabled={locked}/>
        <p className="small muted">Both change together. Start with 1×.</p>
      </div>
      <div>
        <label className="field-label" htmlFor="clip-channel">Audio channel</label>
        <Select value={settings.channel} onValueChange={channel => change({ channel: channel as ClipChannel })} disabled={locked || audio.numberOfChannels < 2}>
          <SelectTrigger id="clip-channel" className="field clip-select"><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="mix">{audio.numberOfChannels < 2 ? 'Mono recording' : 'Mix channels (original)'}</SelectItem><SelectItem value="left">Left channel only</SelectItem><SelectItem value="right">Right channel only</SelectItem></SelectContent>
        </Select>
      </div>
      <div>
        <label className="field-label" htmlFor="clip-filter">Noise filter</label>
        <Select value={settings.filter} onValueChange={filter => change({ filter: filter as ClipFilter })} disabled={locked}>
          <SelectTrigger id="clip-filter" className="field clip-select"><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="original">Off (original)</SelectItem><SelectItem value="rumble">Reduce low rumble</SelectItem><SelectItem value="hiss">Soften high hiss</SelectItem><SelectItem value="both">Rumble + hiss</SelectItem></SelectContent>
        </Select>
      </div>
    </div>
    <div className="row between clip-options"><label className="row small" htmlFor="clip-normalize"><Switch id="clip-normalize" checked={settings.normalize} onCheckedChange={normalize => change({ normalize })} disabled={locked}/> Boost quiet audio</label><button className="btn ghost" onClick={() => onChange({ ...DEFAULT_CLIP_SETTINGS, start: Math.min(settings.start, Math.max(0, audio.duration - 2)) })} disabled={locked}><RotateCcw size={14}/> Reset edits</button></div>
    <p className="small muted">Try another channel if speech dominates one side. Filters can also remove musical detail; compare with the original. They do not separate voices from music.</p>

    <div className="clip-check" aria-live="polite">
      <strong>Audio check</strong>
      {inspection.error ? <p>{inspection.error}</p> : stats && <>
        <p>{Number(stats.duration.toFixed(1))} seconds prepared · {audio.numberOfChannels === 1 ? 'mono source' : `${audio.numberOfChannels} source channels`}</p>
        {stats.cancellation && settings.channel === 'mix' ? <p>The channels cancel out when mixed. <button className="text-action" disabled={locked} onClick={() => change({ channel: stats.suggestedChannel })}>Try the {stats.suggestedChannel} channel</button>.</p> : stats.silent ? <p>No audible signal detected in this selection. Choose another channel or section.</p> : stats.quiet ? <p>This selection is very quiet. Try Boost quiet audio, then preview it.</p> : <p>The selected source has an audible signal. Listen for a clear section of music.</p>}
        {stats.clipped && <p>The source may be distorted. Lowering or filtering it cannot restore missing detail; a cleaner section may work better.</p>}
      </>}
    </div>

    <div className="clip-buttons"><button className="btn secondary" onClick={onPreview} disabled={!canPrepare}><Volume2 size={16}/> Preview edit</button>{currentPreview && preview && !locked ? <a className="btn ghost" href={preview.url} download={clipDownloadName(filename, settings)}><Download size={16}/> Download clip</a> : <button className="btn ghost" onClick={onDownload} disabled={!canPrepare}><Download size={16}/> Prepare download</button>}</div>
    {preview && <div className="prepared-player"><label className="field-label" htmlFor="clip-prepared-player">{currentPreview ? 'Prepared clip · exactly what Identify will send' : 'Previous preview · settings have changed'}</label><audio id="clip-prepared-player" key={preview.url} ref={preparedPlayer} controls src={preview.url} preload="metadata" onPlay={() => originalPlayer.current?.pause()}/>{!currentPreview && <p className="small muted">Preview edit again to hear your current settings. Download and Identify always use the current settings.</p>}</div>}
    <p className="small muted">Preview and WAV download stay on this device and use no recognition requests.</p>
    <button className="btn full" onClick={onIdentify} disabled={!canPrepare || !recognition}><Search size={16}/> Identify this section · free</button>
    {!recognition && <p className="small muted">Identification is awaiting activation. You can still prepare, preview and download your clip.</p>}
    <a className="btn ghost full" style={{ marginTop: 10 }} href="#scan"><Clock3 size={16}/> Scan across this recording</a>
    <p className="micro muted">Timeline scans use the original recording without these edits.</p>
  </section>;
}
