import { CLIP_RATE, clipWindow, encodeClipWav, processClip, selectChannel, type ClipChannel, type ClipFilter } from './clip-processing';

export async function decodeAudio(file:Blob):Promise<AudioBuffer> {
 if(file.size>40*1024*1024) throw new Error('Choose a file smaller than 40 MB. Trim long videos first.');
 const context=new AudioContext();
 try {
  const audio=await context.decodeAudioData(await file.arrayBuffer());
  if(audio.duration<2) throw new Error('Use a clip at least 2 seconds long.');
  if(audio.duration>1200) throw new Error('Use a clip shorter than 20 minutes. Trim the part with music first.');
  return audio;
 } catch(e) { if(e instanceof Error&&/Use a clip/.test(e.message))throw e;throw new Error('Your browser could not read this file. Try MP3, WAV, M4A or a short MP4 with audio.'); }
 finally { await context.close(); }
}
export function waveform(audio:AudioBuffer,bars=88) {
 const channels=Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i));const step=Math.max(1,Math.floor(audio.length/bars));
 return Array.from({length:bars},(_,i)=>{let peak=0;for(const samples of channels)for(let j=i*step;j<Math.min(samples.length,(i+1)*step);j+=Math.max(1,Math.floor(step/60)))peak=Math.max(peak,Math.abs(samples[j]));return peak;});
}
export async function prepareClip(audio:AudioBuffer,start:number,speed:number,normalize:boolean,windowSeconds=12,allowSilence=false,edits:{channel:ClipChannel;filter:ClipFilter}={channel:'mix',filter:'original'}):Promise<Blob> {
 const {duration,startFrame,endFrame}=clipWindow(audio,start,speed,windowSeconds);
 const context=new OfflineAudioContext(1,Math.ceil(duration*CLIP_RATE),CLIP_RATE);
 const source=context.createBufferSource();
 if(edits.channel==='mix') {
  // Preserve the browser's standard surround/stereo downmix for existing scans.
  source.buffer=audio;
 } else {
  const channels=Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i).subarray(startFrame,endFrame));
  const selected=selectChannel(channels,edits.channel);
  const buffer=context.createBuffer(1,selected.length,audio.sampleRate);buffer.copyToChannel(selected,0);source.buffer=buffer;
 }
 source.playbackRate.value=speed;source.connect(context.destination);source.start(0,edits.channel==='mix'?start:0);
 const rendered=await context.startRendering();const processed=processClip(rendered.getChannelData(0),edits.filter,normalize);
 if(processed.peak<0.00005&&!allowSilence)throw new Error('This section is silent with these settings. Try a different channel or an earlier part.');
 return encodeClipWav(processed.samples);
}
