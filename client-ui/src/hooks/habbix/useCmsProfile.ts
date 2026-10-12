import { CSSProperties, useEffect, useRef, useState } from 'react';
export function useCmsProfile(username: string, ownerId: number) {
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const socket=useRef<WebSocket>(null), authenticated=useRef(false), timer=useRef<ReturnType<typeof setTimeout>>(null);
 const waiting=useRef<{action:string;resolve:(value:any)=>void}>(null);
 const finish=(value:any,message='')=>{clearTimeout(timer.current);setError(message);setPending(false);const request=waiting.current;waiting.current=null;request?.resolve(value);};
 const send=(action='get',text='',postId=0):Promise<any>=>{
  if(waiting.current)return Promise.resolve(null);
  if(!socket.current||socket.current.readyState!==WebSocket.OPEN||!authenticated.current){setError('Bitte melde dich auf der Webseite erneut an.');return Promise.resolve(null);}
  setError('');setPending(true);
  return new Promise(resolve=>{waiting.current={action,resolve};socket.current.send(JSON.stringify({header:'getProfile',data:{username,action,text,postId}}));clearTimeout(timer.current);timer.current=setTimeout(()=>finish(null,'Keine Serverbestätigung erhalten. Bitte erneut versuchen.'),20000);});
 };
 useEffect(()=>{
  setData(null);setError('');setPending(false);authenticated.current=false;
  if(!username||!ownerId)return;
  const session=localStorage.getItem('kubboch-sto');
  if(!session?.startsWith('cms_')){setError('Für die Profilgestaltung bitte über die Webseite einchecken.');return;}
  const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/habboje-ws`);socket.current=ws;
  timer.current=setTimeout(()=>finish(null,'Die Profilverbindung antwortet nicht. Bitte erneut einchecken.'),20000);
  ws.onopen=()=>ws.send(JSON.stringify({header:'auth',data:{sso:session}}));
  const sharedUpdate=(event:Event)=>{const profile=(event as CustomEvent).detail;if(Number(profile?.ownerId)===ownerId)setData(profile);};
  window.addEventListener('habbix-profile-updated',sharedUpdate);
  ws.onmessage=event=>{try{const m=JSON.parse(event.data);if(m.header==='authResponse'){clearTimeout(timer.current);authenticated.current=m.data?.data==='Success';if(authenticated.current)send();else finish(null,'Die Webseiten-Anmeldung ist abgelaufen.');}
   if(m.header==='profileExtras'||m.header==='profileAsset'){const profile=typeof m.data.data==='string'?JSON.parse(m.data.data):m.data.data;if(Number(profile.ownerId)!==ownerId)return;if(m.header==='profileExtras'){setData(profile);window.dispatchEvent(new CustomEvent('habbix-profile-updated',{detail:profile}));}if(waiting.current?.action===profile.action)finish(profile);}
   if(m.header==='profileError'||m.header==='profileResponse')finish(null,String(m.data.data));
  }catch{finish(null,'Profildaten konnten nicht gelesen werden.');}};
  ws.onerror=()=>finish(null,'Die Verbindung zur Profilgestaltung ist unterbrochen.');
  ws.onclose=()=>{authenticated.current=false;finish(null,'Die Profilverbindung wurde geschlossen. Bitte erneut einchecken.');};
  const refresh=setInterval(()=>{if(authenticated.current&&!waiting.current&&ws.readyState===WebSocket.OPEN)send();},30000);
  return()=>{window.removeEventListener('habbix-profile-updated',sharedUpdate);clearInterval(refresh);clearTimeout(timer.current);authenticated.current=false;waiting.current?.resolve(null);waiting.current=null;ws.onmessage=null;ws.onopen=null;ws.onerror=null;ws.onclose=null;ws.close();};
 },[username,ownerId]);
 return {data,error,pending,send};
}
export function appearanceBackground(value:string):CSSProperties {
 if(/^#[0-9a-f]{6}$/i.test(value||''))return {backgroundColor:value};
 if(/^https:\/\//i.test(value||'')){try{const u=new URL(value);if(!u.username&&!u.password&&/\.(png|jpe?g|gif|webp)$/i.test(u.pathname))return {backgroundImage:`url(${JSON.stringify(u.href)})`,backgroundSize:'cover',backgroundPosition:'center'};}catch{}}
 return {};
}
export function profileStyle(a:any):CSSProperties {
 const s=a?.clientStyle||{};
 const gradients:Record<string,string>={ocean:'linear-gradient(135deg,#123b44,#2baaa0)',forest:'linear-gradient(135deg,#153b32,#429877)',rainbow:'linear-gradient(135deg,#6b398b,#299e9a,#46768c)',neon:'linear-gradient(135deg,#421f62,#159b98)',cosmic:'linear-gradient(135deg,#191b40,#56366d)',violet:'linear-gradient(135deg,#312743,#70628b)',ice:'linear-gradient(135deg,#24414e,#9fbebd)',aurora:'linear-gradient(135deg,#27513e,#306265,#615587)'};
 Object.assign(gradients,{sunset:'linear-gradient(135deg,#784066,#be7059)',fire:'linear-gradient(135deg,#682f37,#a75b42)',sunrise:'linear-gradient(135deg,#8a6377,#c6a778)',dusk:'linear-gradient(135deg,#293647,#806377)'});
 if(/^#[0-9a-f]{6}$/i.test(s.gradientStart||'')&&/^#[0-9a-f]{6}$/i.test(s.gradientEnd||''))gradients.custom=`linear-gradient(${Number.isFinite(s.gradientAngle)?s.gradientAngle:135}deg,${s.gradientStart},${s.gradientEnd})`;
 const bg=appearanceBackground(a?.banner);const layers=[s.bannerOverlay?`linear-gradient(#000${Math.round(s.bannerOverlay*2.55).toString(16).padStart(2,'0')},#000${Math.round(s.bannerOverlay*2.55).toString(16).padStart(2,'0')})`:null,gradients[s.gradient],bg.backgroundImage].filter(Boolean);
 return {...bg,backgroundColor:bg.backgroundColor||`color-mix(in srgb, ${s.mainColor||'#2b2b2b'} ${s.opacity??100}%, transparent)`,backgroundImage:layers.join(',')||undefined,backdropFilter:s.blur?`blur(${s.blur}px)`:undefined,color:a?.textColor||'#eee','--habbix-profile-color':s.mainColor||'#2b2b2b','--habbix-profile-opacity':`${(s.opacity??100)/100}`,'--habbix-avatar-color':s.avatarColor||'#222','--habbix-profile-blur':`${s.blur||0}px`,'--habbix-tag-color':s.tagColor||'#eee'} as CSSProperties;
}
export function avatarStyle(a:any):CSSProperties {
 const background=appearanceBackground(a?.avatar||a?.clientStyle?.avatarColor);
 const opacity=Math.max(0,Math.min(100,a?.clientStyle?.avatarOpacity??100))/100;
 return {...background,border:`${a?.borderWidth??1}px ${a?.clientStyle?.borderStyle||'solid'} ${a?.borderColor||'#666'}`,'--hpx-avatar-image':background.backgroundImage||'none','--hpx-avatar-background':background.backgroundColor||a?.clientStyle?.avatarColor||'#222','--hpx-avatar-opacity':opacity} as CSSProperties;
}
