import { CSSProperties, useEffect, useSyncExternalStore } from 'react';
import { GetSessionDataManager } from '@octane/renderer';

export type NameEffect = { color:string; blur:number; x:number; y:number };
export type Nametag = { tag:string; tagColor:string; nameColor:string; tagShadow:NameEffect; nameShadow:NameEffect; tagGlow:NameEffect; nameGlow:NameEffect };
const effect=():NameEffect=>({color:'#000000',blur:0,x:0,y:0});
export const defaultNametag=():Nametag=>({tag:'',tagColor:'#299e9a',nameColor:'#ffffff',tagShadow:effect(),nameShadow:effect(),tagGlow:effect(),nameGlow:effect()});
export function nametagTextStyle(value:Nametag,kind:'tag'|'name'):CSSProperties {
 const shadow=value[kind+'Shadow'] as NameEffect,glow=value[kind+'Glow'] as NameEffect;
 const layers=[];
 if(shadow&&(shadow.blur||shadow.x||shadow.y))layers.push(`${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color}`);
 if(glow?.blur)layers.push(`0 0 ${glow.blur}px ${glow.color}`);
 return {color:value[kind+'Color'],textShadow:layers.join(',')||'none'};
}

// One authenticated connection serves all identities; requests are batched and cached.
const cache=new Map<string,Nametag|null>(),listeners=new Set<()=>void>(),wanted=new Set<string>(),inFlight=new Set<string>();
const avatarCache=new Map<string,CSSProperties>();
export function friendAvatarAppearanceStyle(appearance:any):CSSProperties {
 const color=appearance?.borderColor,background=appearance?.backgroundColor||appearance?.clientStyle?.avatarColor;
 const borderStyle=appearance?.borderStyle||appearance?.clientStyle?.borderStyle||'solid';
 return {borderColor:/^#[0-9a-f]{6}$/i.test(color||'')?color:'#333333',borderWidth:/^#[0-9a-f]{6}$/i.test(color||'')?Math.max(0,Math.min(10,Number(appearance?.borderWidth)||0)):3,borderStyle:['solid','dashed','dotted','double','none'].includes(borderStyle)?borderStyle:'solid',backgroundColor:/^#[0-9a-f]{6}$/i.test(background||'')?background:'#1e1e1e'};
}
export function updateFriendAvatarAppearance(username:string,appearance:any){avatarCache.set(key(username),friendAvatarAppearanceStyle(appearance));notify();}
let socket:WebSocket=null,ready=false,flushTimer:ReturnType<typeof setTimeout>,retryTimer:ReturnType<typeof setTimeout>,users=0,retry=0;
let request:{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>} = null;
const key=(name:string)=>name.toLocaleLowerCase();
const notify=()=>listeners.forEach(fn=>fn());
function finish(error?:string){if(!request)return;const current=request;request=null;clearTimeout(current.timer);error?current.reject(new Error(error)):current.resolve();}
function send(action:string,text:string){socket.send(JSON.stringify({header:'getProfile',data:{username:GetSessionDataManager().userName,action,text}}));}
function flush(){clearTimeout(flushTimer);if(!ready||!wanted.size)return;const names=[...wanted].slice(0,100);names.forEach(name=>{wanted.delete(name);inFlight.add(name);});send('nametagList',JSON.stringify(names));if(wanted.size)flushTimer=setTimeout(flush,100);}
function connect(){
 if(socket||!users)return;
 const session=localStorage.getItem('kubboch-sto');
 if(!session?.startsWith('cms_'))return;
 const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/habboje-ws`);socket=ws;
 ws.onopen=()=>ws.send(JSON.stringify({header:'auth',data:{sso:session}}));
 ws.onmessage=event=>{try{
  const message=JSON.parse(event.data);
  if(message.header==='authResponse'){ready=message.data?.data==='Success';if(ready){retry=0;flush();}return;}
  if(message.header==='nametagState'){
   const payload=typeof message.data.data==='string'?JSON.parse(message.data.data):message.data.data;
   for(const entry of payload.entries||[]){cache.set(key(entry.username),entry.style?{...defaultNametag(),...entry.style}:null);for(const name of inFlight)if(key(name)===key(entry.username))inFlight.delete(name);}
   for(const entry of payload.entries||[]){if(entry.avatar)avatarCache.set(key(entry.username),friendAvatarAppearanceStyle(entry.avatar));}
   notify();if(payload.action==='nametagSave')finish();
  }
  if(message.header==='profileError'||message.header==='profileResponse')finish(String(message.data.data));
 }catch{finish('Die Nametag-Antwort konnte nicht gelesen werden.');}};
 ws.onerror=()=>finish('Die Verbindung zur Profilgestaltung ist unterbrochen.');
 ws.onclose=()=>{if(socket!==ws)return;socket=null;ready=false;for(const name of inFlight)wanted.add(name);inFlight.clear();finish('Die Verbindung wurde geschlossen. Bitte erneut versuchen.');cache.clear();avatarCache.clear();notify();if(users)retryTimer=setTimeout(connect,Math.min(30000,1000*2**retry++));};
}
function subscribe(listener:()=>void){listeners.add(listener);users++;connect();return()=>{listeners.delete(listener);users--;if(!users){clearTimeout(retryTimer);clearTimeout(flushTimer);const ws=socket;socket=null;ready=false;ws?.close();finish('Das Nametag-Fenster wurde geschlossen.');cache.clear();avatarCache.clear();inFlight.clear();wanted.clear();}};}
export function useNametag(username:string){
 const value=useSyncExternalStore(subscribe,()=>cache.get(key(username||'')));
 useEffect(()=>{if(username&&value===undefined){wanted.add(username);flushTimer=setTimeout(flush,40);}},[username,value]);
 return value;
}
export function useFriendAvatarStyle(username:string){
 useNametag(username);
 return useSyncExternalStore(subscribe,()=>avatarCache.get(key(username||'')));
}
export function saveNametag(value:Nametag):Promise<void>{
 if(!ready)return Promise.reject(new Error('Die Profilverbindung ist noch nicht bereit. Bitte über die Webseite einchecken.'));
 if(request)return Promise.reject(new Error('Die vorige Änderung wird noch gespeichert.'));
 return new Promise((resolve,reject)=>{request={resolve,reject,timer:setTimeout(()=>finish('Keine Serverbestätigung erhalten. Bitte erneut versuchen.'),15000)};send('nametagSave',JSON.stringify(value));});
}
