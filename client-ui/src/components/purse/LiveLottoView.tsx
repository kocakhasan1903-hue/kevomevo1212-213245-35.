import creditsIcon from '../../assets/images/purse/air/credits.png';
import diamondIcon from '../../assets/images/purse/air/diamond.png';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RightRailSlot } from '../right-side/RightNoticeRail';
type LottoState={prize:number;diamonds?:number;entries:number;serverTime:number;drawAt:number;ticketPrice:number;chosenNumber?:number;flames?:number};
export function LiveLottoView({onFlames}:{onFlames?:(value:number)=>void}={}){
 const [state,setState]=useState<LottoState>(null),[remaining,setRemaining]=useState(0),[unavailable,setUnavailable]=useState(false);
 useEffect(()=>{
  const session=localStorage.getItem('kubboch-sto');if(!session?.startsWith('cms_'))return;
  let disposed=false,authenticated=false,receivedAt=0,snapshot:LottoState=null;
  const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/habboje-ws`);
  const request=()=>{if(authenticated&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({header:'lotto',data:{action:'get'}}));};
  const timeout=setTimeout(()=>{if(!disposed&&!snapshot)setUnavailable(true);},12000);
  ws.onopen=()=>ws.send(JSON.stringify({header:'auth',data:{sso:session}}));
  ws.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.header==='authResponse'){authenticated=message.data?.data==='Success';if(authenticated)request();}
   if(message.header==='lottoData'){const data=typeof message.data.data==='string'?JSON.parse(message.data.data):message.data.data;if(!Number.isFinite(data.drawAt)||!Number.isFinite(data.serverTime)||!Number.isFinite(data.prize))return;snapshot=data;receivedAt=Date.now();setState(data);if(Number.isFinite(data.flames))onFlames?.(data.flames);setUnavailable(false);setRemaining(Math.max(0,data.drawAt-data.serverTime));}
   if(message.header==='lottoError')setUnavailable(true);
  }catch{setUnavailable(true);}};
  ws.onerror=()=>setUnavailable(true);ws.onclose=()=>{authenticated=false;if(!disposed)setUnavailable(true);};
  const refresh=setInterval(request,10000),clock=setInterval(()=>{if(snapshot)setRemaining(Math.max(0,snapshot.drawAt-snapshot.serverTime-Math.floor((Date.now()-receivedAt)/1000)));},1000);
  return()=>{disposed=true;clearTimeout(timeout);clearInterval(refresh);clearInterval(clock);ws.onopen=null;ws.onmessage=null;ws.onerror=null;ws.onclose=null;ws.close();};
 },[]);
 const panelRef=useRef<HTMLElement>(null);
 const visible=!!state&&remaining<=300;
 useLayoutEffect(()=>{
  const panel=panelRef.current;if(!visible||!panel)return;
  const update=()=>document.documentElement.style.setProperty('--habbix-live-lotto-height',`${panel.offsetHeight}px`);
  update();const observer=new ResizeObserver(update);observer.observe(panel);
  return()=>{observer.disconnect();document.documentElement.style.removeProperty('--habbix-live-lotto-height');};
 },[visible]);
 if(!visible)return null;
 const time=`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`;
 // The wallet's entrance transform creates a containing block for fixed children.
 // Mount beside the wallet so the live panel stays anchored to the client viewport.
 return <RightRailSlot slot="lotto"><aside ref={panelRef} className="habbix-live-lotto" aria-label="Live Lotto" title={`Teilnahme: :lotto 0–100 • ${state.ticketPrice.toLocaleString('de-DE')} Taler`}>
  <header><strong>LIVE LOTTO</strong><span title="Teilnehmer">{state.entries}</span></header>
  <div className="habbix-live-lotto-pot"><span>JACKPOT</span><div className="habbix-lotto-prizes"><strong><img src={creditsIcon} alt=""/>{state.prize.toLocaleString('de-DE')} <span>Taler</span></strong><strong><img src={diamondIcon} alt=""/>{(state.diamonds||0).toLocaleString('de-DE')} <span>Diamanten</span></strong></div></div>
  <div className="habbix-live-lotto-countdown"><span style={{width:`${Math.min(100,remaining/300*100)}%`}}/><time>{unavailable?'Verbindung unterbrochen':remaining===0?'Ziehung läuft …':time}</time></div>
  {state.chosenNumber!==undefined&&<small>Deine Zahl: {state.chosenNumber}</small>}
 </aside></RightRailSlot>;
}
