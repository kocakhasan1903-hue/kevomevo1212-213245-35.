import {useEffect,useState} from 'react';
import {GetUserProfile,TryVisitRoom} from '../../api';
import {LayoutAvatarImageView} from '../../common';
import {avatarStyle,appearanceBackground} from '../../hooks/habbix/useCmsProfile';
import background from '../../assets/images/hotelview/habbix-autumn.png';
export function HabbixHotelLanding(){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{
  const token=localStorage.getItem('kubboch-sto');if(!token?.startsWith('cms_')){setError('Bitte über die Webseite einchecken.');return;}
  const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/habboje-ws`);let authenticated=false;
  const refresh=()=>{if(authenticated&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({header:'lotto',data:{action:'landing'}}));};
  ws.onopen=()=>ws.send(JSON.stringify({header:'auth',data:{sso:token}}));
  ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.header==='authResponse'){authenticated=m.data?.data==='Success';if(authenticated)refresh();else setError('Bitte erneut auf der Webseite anmelden.');}if(m.header==='hotelLandingData'){setData(typeof m.data.data==='string'?JSON.parse(m.data.data):m.data.data);setError('');}if(m.header==='hotelLandingError')setError(String(m.data.data));}catch{setError('Die Startseitendaten konnten nicht gelesen werden.');}};
  ws.onerror=()=>setError('Die Verbindung zur Hotelstartseite ist unterbrochen.');
  const timer=setInterval(refresh,30000);window.addEventListener('habbix-profile-updated',refresh);
  return()=>{clearInterval(timer);window.removeEventListener('habbix-profile-updated',refresh);ws.onmessage=null;ws.onerror=null;ws.close();};
 },[]);
 const face=(user:any)=><span className="hhl-avatar" style={avatarStyle(user.appearance)}>{appearanceBackground(user.appearance?.avatar).backgroundImage?null:<LayoutAvatarImageView figure={user.figure} direction={2} headOnly compactHead compactHeadSize={40} compactHeadPadding={0}/>}</span>;
 const age=(timestamp:number)=>{const days=Math.max(0,Math.floor((Date.now()/1000-timestamp)/86400));return days===0?'Heute':days===1?'vor 1 Tag':`vor ${days} Tagen`;};
 return <section className="habbix-hotel-landing" style={{backgroundImage:`linear-gradient(#0003,#0005),url(${background})`}} aria-label="Hotelstartseite"><div className="hhl-content">
  <div className="hhl-photos" aria-label="Neueste Hotelfotos">{[0,1,2].map(i=>{const p=data?.photos?.[i];return p?<article key={p.id} className="hhl-photo" style={{backgroundImage:/^https:\/\//i.test(p.url)||/^\/(?!\/)/.test(p.url)?`linear-gradient(transparent,#000b),url(${JSON.stringify(p.url)})`:undefined}}><div className="hhl-photo-caption"><div className="hhl-photo-date"><strong>NEUESTES FOTO</strong><time>{age(p.date)}</time></div><button type="button" className="hhl-photo-author" onClick={()=>GetUserProfile(p.userId)}>{face(p)}<span><strong>{p.username}</strong><small>{p.motto}</small></span></button><button type="button" className="hhl-photo-room" onClick={()=>TryVisitRoom(p.roomId)}>Raum: {p.roomName||'Raum besuchen'}</button></div></article>:<article className="hhl-photo hhl-photo-empty" key={i}><strong>Noch kein veröffentlichtes Foto</strong><span>Veröffentliche ein Bild mit der Kamera im Client.</span></article>;})}</div>
  <section className="hhl-leaders"><h2>Event Meister</h2>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Fotos und Eventsterne werden geladen …</p>}<div className="hhl-leader-grid">{data?.leaders?.map((u:any,i:number)=><button type="button" key={u.userId} className="hhl-leader" onClick={()=>GetUserProfile(u.userId)}><span className="hhl-rank">#{i+1}</span>{face(u)}<span className="hhl-user"><strong>{u.username}</strong><small>{Number(u.eventstars).toLocaleString('de-DE')} Eventsterne</small></span></button>)}</div>{data&&!data.leaders?.length&&<p>Noch keine Eventsterne vergeben.</p>}</section>
 </div></section>;
}
