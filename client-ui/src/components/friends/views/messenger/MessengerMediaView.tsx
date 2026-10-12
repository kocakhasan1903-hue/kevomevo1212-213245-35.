import { GiphyPicker } from '../../../giphy/GiphyPicker';
import { giphyMessage } from '../../../giphy/giphy';
import { directChatRequest } from '../../../../hooks/friends/directChatTransport';
import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FaTimes, FaPlay, FaPause } from 'react-icons/fa';
import { HabbixActionIcon } from '../../../../common/HabbixActionIcon';
import { isDirectChatReady, subscribeDirectChatStatus, sendDirectMedia, loadDirectMedia } from '../../../../hooks/friends/directChatTransport';
import { audioTime, MessengerAudioPlayer } from './MessengerAudioPlayer';

export function parseMessengerMedia(value:string){
 const match=/^habbix-media:([a-f0-9-]{36}):(audio|gif):([0-9.]+)$/.exec(value);
 return match?{id:match[1],kind:match[2],duration:Number(match[3])}:null;
}
export function MessengerMediaView({id,kind,duration=0}:{id:string;kind:string;duration?:number}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true,objectUrl='';setUrl('');setError('');
  loadDirectMedia(id).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[id,retry]);
 if(error)return <button className="hmx-media-retry" onClick={()=>setRetry(n=>n+1)} title={error}>Datei erneut laden</button>;
 if(!url)return <span className="hmx-media-loading">{kind==='gif'?'GIF':'Audio'} wird geladen …</span>;
 return kind==='gif'?<div className="hmx-gif-card"><img className="hmx-gif" src={url} alt="GIF-Nachricht"/><span className="hmx-gif-label">GIF</span></div>:<MessengerAudioPlayer src={url} duration={duration}/>;
}
export function MessengerMediaComposer({peer,onSent,children}:{peer:number;onSent:()=>void;children?:ReactNode}){
 const gifRequest=useRef<{gif:string;id:string}|null>(null);
 const ready=useSyncExternalStore(subscribeDirectChatStatus,isDirectChatReady);
 const [phase,setPhase]=useState<'idle'|'permission'|'recording'|'preview'|'sending'|'sent'>('idle');
 const [levels,setLevels]=useState<number[]>(Array(24).fill(.12));
 const [error,setError]=useState(''),[elapsed,setElapsed]=useState(0),[url,setUrl]=useState(''),[kind,setKind]=useState<'audio'|'gif'>('audio');
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),clip=useRef<Blob|null>(null),generation=useRef(0),duration=useRef(0),objectUrl=useRef(''),messageId=useRef('');
 const timer=useRef<ReturnType<typeof setInterval>|null>(null),file=useRef<HTMLInputElement>(null);
 const meter=useRef<AudioContext|null>(null),sentTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const previewAudio=useRef<HTMLAudioElement|null>(null);
 const [playing,setPlaying]=useState(false);
 const release=()=>{clearInterval(timer.current);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(meter.current){void meter.current.close().catch(()=>{});meter.current=null;}};
 const cancel=()=>{generation.current++;previewAudio.current?.pause();setPlaying(false);if(recorder.current){recorder.current.onstop=null;recorder.current.ondataavailable=null;if(recorder.current.state!=='inactive')recorder.current.stop();recorder.current=null;}release();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current='';clip.current=null;setUrl('');setElapsed(0);setPhase('idle');};
 useEffect(()=>()=>{clearTimeout(sentTimer.current);cancel();},[]);
 const preview=(blob:Blob,seconds:number,type:'audio'|'gif')=>{clip.current=blob;duration.current=seconds;messageId.current=crypto.randomUUID();objectUrl.current=URL.createObjectURL(blob);setUrl(objectUrl.current);setKind(type);setPhase('preview');};
 const start=async()=>{
  if(phase!=='idle'||!ready)return;
  setError('');setPhase('permission');const version=++generation.current;
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('unsupported');
   const source=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(version!==generation.current){source.getTracks().forEach(t=>t.stop());return;}stream.current=source;
   const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error('unsupported');
   const media=new MediaRecorder(source,{mimeType:mime,audioBitsPerSecond:48000});recorder.current=media;const chunks:Blob[]=[];let bytes=0;const began=performance.now();
   media.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;}if(bytes>384*1024&&media.state==='recording')media.stop();};
   media.onerror=()=>{cancel();setError('Aufnahme unterbrochen. Bitte erneut versuchen.');};
   media.onstop=()=>{release();recorder.current=null;if(version!==generation.current)return;const seconds=Math.min(60,(performance.now()-began)/1000),blob=new Blob(chunks,{type:media.mimeType});if(seconds<.3||blob.size<128||blob.size>384*1024){cancel();setError('Aufnahme zu kurz oder zu groß.');return;}setElapsed(seconds);preview(blob,seconds,'audio');};
   let analyser:AnalyserNode|null=null;const samples=new Uint8Array(256);
   try{const AudioContextClass=window.AudioContext||(window as Window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(AudioContextClass){meter.current=new AudioContextClass();analyser=meter.current.createAnalyser();analyser.fftSize=256;meter.current.createMediaStreamSource(source).connect(analyser);void meter.current.resume().catch(()=>{});}}catch{analyser=null;if(meter.current){void meter.current.close().catch(()=>{});meter.current=null;}}
   setLevels(Array(24).fill(.12));media.start(250);setPhase('recording');setElapsed(0);timer.current=setInterval(()=>{const seconds=(performance.now()-began)/1000;setElapsed(Math.min(60,seconds));if(analyser){analyser.getByteTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((sum,n)=>sum+((n-128)/128)**2,0)/samples.length);setLevels(previous=>[...previous.slice(1),Math.min(1,Math.max(.12,rms*5))]);}if(seconds>=60&&media.state==='recording')media.stop();},120);
  }catch(e){if(version!==generation.current)return;release();setPhase('idle');setError((e as DOMException).name==='NotAllowedError'?'Mikrofonzugriff verweigert. Erlaube ihn in den Website-Einstellungen.':'Mikrofon nicht verfügbar. Bitte Browser und Mikrofon prüfen.');}
 };
 const select=async(selected:File|undefined)=>{
  if(!selected||phase!=='idle')return;setError('');const version=++generation.current;
  const signature=new Uint8Array(await selected.slice(0,6).arrayBuffer());if(version!==generation.current)return;
  if(selected.size<14||selected.size>2*1024*1024||String.fromCharCode(...signature).slice(0,3)!=='GIF'){setError('Bitte eine GIF-Datei bis 2 MB auswählen.');return;}
  preview(new Blob([selected],{type:'image/gif'}),0,'gif');
 };
 const send=async()=>{if(!clip.current||phase!=='preview'||!ready)return;previewAudio.current?.pause();setPlaying(false);setPhase('sending');setError('');const version=generation.current;try{await sendDirectMedia(peer,clip.current,duration.current,messageId.current);if(version===generation.current){setPhase('sent');onSent();sentTimer.current=setTimeout(()=>{if(version===generation.current)cancel();},280);}}catch(e){if(version===generation.current){setPhase('preview');setError((e as Error).message);}}};
 return <div className="hmx-media-composer hmx-unified-composer" data-phase={phase}>
  <input ref={file} hidden type="file" accept="image/gif,.gif" onChange={e=>{void select(e.target.files?.[0]);e.target.value='';}}/>
  <div className="hmx-input">
  {phase==='idle'?<>{children}<div className="hmx-media-tools"><GiphyPicker scope="private" disabled={!ready} onUpload={()=>file.current?.click()} onSend={async gif=>{if(gifRequest.current?.gif!==gif.id)gifRequest.current={gif:gif.id,id:crypto.randomUUID()};await directChatRequest('dmSend',{peer,id:gifRequest.current.id,body:giphyMessage(gif.id)});gifRequest.current=null;onSent();}}/><button type="button" disabled={!ready} title={ready?'Sprachnachricht aufnehmen':'Chat verbindet …'} aria-label="Sprachnachricht aufnehmen" onClick={()=>void start()}><HabbixActionIcon kind="microphone"/></button></div></>:<div className={`hmx-recording${phase==='recording'?' is-live':''}${phase==='sent'?' is-sent':''}`}>
   {phase==='permission'?<span>Mikrofon wird angefragt …</span>:<>{kind==='audio'&&phase==='preview'?<button type="button" aria-label={playing?'Vorschau pausieren':'Aufnahme anhören'} onClick={()=>{const audio=previewAudio.current;if(!audio)return;if(playing)audio.pause();else void audio.play().catch(()=>setError('Aufnahme kann nicht abgespielt werden.'));}}>{playing?<FaPause/>:<FaPlay/>}</button>:<HabbixActionIcon kind="microphone"/>} {kind==='gif'&&phase!=='recording'?<img src={url} alt="GIF-Vorschau"/>:<span className="hmx-recording-wave" aria-label={phase==='recording'?'Mikrofonpegel':'Aufnahme'}>{levels.map((level,index)=><i key={index} style={{height:`${Math.round(level*24)}px`}}/>)}</span>}<time>{kind==='gif'&&phase!=='recording'?'GIF':audioTime(elapsed)}</time>{phase==='recording'?<button type="button" onClick={()=>recorder.current?.stop()} aria-label="Aufnahme stoppen"><HabbixActionIcon kind="stop"/></button>:<button type="button" className="hmx-media-send" disabled={phase==='sending'||phase==='sent'||!ready} onClick={()=>void send()} aria-label="Anhang absenden"><HabbixActionIcon kind="paperplane"/><span>{phase==='sending'?'Sendet …':phase==='sent'?'Gesendet':'Absenden'}</span></button>}</>}
   <button type="button" disabled={phase==='sending'||phase==='sent'} aria-label="Anhang verwerfen" onClick={cancel}><FaTimes/></button>
  </div>}
  </div>
  {url&&kind==='audio'&&<audio ref={previewAudio} src={url} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} hidden/>}
  {error&&<p role="alert" className="hmx-media-error">{error}</p>}
 </div>;
}
