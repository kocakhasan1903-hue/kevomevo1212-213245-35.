import React, { useCallback, useEffect, useRef, useState } from 'react';
import './MarketplacePanel.css';
import talerIcon from './currency-taler.png';
import diamondIcon from './currency-diamond.png';
import starIcon from './currency-eventstars.png';
import flameIcon from './currency-flames.png';

type Item = { id:number; name:string; asset:string; seller:string; own:boolean; price:number; proceeds:number; state:number };
type Vault = {type:number;amount:number;enabled:boolean};
type State = { vaults?:Vault[]; items:Item[]; total:number; enabled:boolean; currency:number; notice:string; tab:string; page:number; ownSection?:number; requestId:string };
type Tab = 'browse'|'own'|'inventory';
export function MarketplacePanel({username,onProfile}:{username:string;onProfile?:(name:string)=>void}) {
 const [ownSection,setOwnSection]=useState(1),[connection,setConnection]=useState(0);
 const [tab,setTab]=useState<Tab>('browse'),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[sort,setSort]=useState(0),[category,setCategory]=useState(0),[page,setPage]=useState(0);
 const [data,setData]=useState<State|null>(null),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<Item|null>(null),[price,setPrice]=useState('1');
 const socket=useRef<WebSocket|null>(null),latest=useRef(''),timeout=useRef<ReturnType<typeof setTimeout>|null>(null),pending=useRef(false);
 const filters=useRef({tab,search:query,sort,category,page,ownSection});filters.current={tab,search:query,sort,category,page,ownSection};
 const request=useCallback((action='marketList',extra:Record<string,unknown>={})=>{
  if(!socket.current||socket.current.readyState!==WebSocket.OPEN||pending.current)return;
  pending.current=true;setBusy(true);setError('');latest.current=Date.now().toString(36)+Math.random().toString(36).slice(2);
  socket.current.send(JSON.stringify({header:'getProfile',data:{username,action,text:JSON.stringify({...filters.current,...extra,requestId:latest.current})}}));
  if(timeout.current)clearTimeout(timeout.current);
  timeout.current=setTimeout(()=>{pending.current=false;setBusy(false);setError('Keine Bestätigung erhalten. Bitte Angebote und Inventar aktualisieren, bevor du die Aktion wiederholst.');},25000);
 },[username]);
 useEffect(()=>{
  if(!username){setError('Bitte auf der Webseite anmelden.');return;}
  const token=localStorage.getItem('kubboch-sto');if(!token){setError('Bitte über die Webseite einchecken.');return;}
  const ws=new WebSocket(`${window.location.protocol==='https:'?'wss':'ws'}://${window.location.host}/habboje-ws`);socket.current=ws;
  const finish=()=>{pending.current=false;setBusy(false);if(timeout.current)clearTimeout(timeout.current);};
  ws.onopen=()=>ws.send(JSON.stringify({header:'auth',data:{sso:token}}));
  ws.onmessage=event=>{try{
   const message=JSON.parse(event.data);
   if(message.header==='authResponse'){if(message.data?.data==='Success'){setReady(true);}else setError('Bitte auf der Webseite neu anmelden.');}
   if(message.header==='marketState'){
    const next:State=JSON.parse(message.data.data);if(next.requestId!==latest.current)return;
    finish();setData(next);setSelected(null);
   }
   if(message.header==='profileError'||message.header==='profileResponse'){finish();setError(String(message.data.data));}
  }catch{finish();setError('Die Marktplatz-Antwort konnte nicht gelesen werden.');}};
  ws.onclose=()=>{finish();setReady(false);setError('Verbindung unterbrochen. Bitte neu verbinden.');};
  ws.onerror=()=>setError('Der Marktplatz ist derzeit nicht erreichbar.');
  const ping=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({header:'ping',data:{}}));},10000);
  return()=>{clearInterval(ping);if(timeout.current)clearTimeout(timeout.current);ws.onclose=null;ws.onmessage=null;ws.close();socket.current=null;pending.current=false;};
 },[username,connection]);
 useEffect(()=>{if(ready)request();},[ready,tab,query,sort,category,page,ownSection,request]);
 const currency=data?.currency===0?'Taler':data?.currency===5?'Diamanten':data?.currency===104?'Eventsterne':`Punkte (${data?.currency??0})`;
 const currencies=[{type:0,label:'Taler',icon:talerIcon},{type:104,label:'Eventsterne',icon:starIcon},{type:5,label:'Diamanten',icon:diamondIcon},{type:-2,label:'Flammen',icon:flameIcon}];
 const changeTab=(value:Tab)=>{setSelected(null);setSearch('');setQuery('');setPage(0);setTab(value);};
 const money=(value:number)=>value.toLocaleString('de-DE');
 const allItems=data?.tab===tab&&(tab!=='own'||data.ownSection===ownSection)?data.items:[];
 const items=tab==='own'?allItems.filter(item=>item.state===ownSection):allItems;
 const icon=(item:Item)=><img className="hmp-item-icon" src={'/nitro-assets/dcr/hof_furni/icons/'+encodeURIComponent(item.asset.replace(/\*/g,'_'))+'_icon.png'} alt="" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>;
 return <div className="hmp-panel">
  <nav role="tablist" className="hmp-tabs" aria-label="Marktplatz"><button disabled={busy} role="tab" aria-selected={tab==='browse'} onClick={()=>changeTab('browse')}>Durchsuchen</button><button disabled={busy} role="tab" aria-selected={tab==='own'} onClick={()=>changeTab('own')}>Meine Angebote</button><button disabled={busy} role="tab" aria-selected={tab==='inventory'} onClick={()=>changeTab('inventory')}>Angebot erstellen</button></nav>
  {tab!=='own'&&<form className="hmp-search" onSubmit={e=>{e.preventDefault();setPage(0);if(search===query)request();else setQuery(search);}}>
   <select disabled={busy} aria-label="Kategorie" value={category} onChange={e=>{setCategory(Number(e.target.value));setPage(0);}}><option value={0}>Alle Kategorien</option><option value={1}>Bodenmöbel</option><option value={2}>Wandmöbel</option></select>
   <input aria-label="Items suchen" placeholder="Suchen …" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)}/>
   {tab!=='inventory'&&<select disabled={busy} aria-label="Sortierung" value={sort} onChange={e=>{setSort(Number(e.target.value));setPage(0);}}><option value={0}>Neueste zuerst</option><option value={1}>Älteste zuerst</option><option value={2}>Preis aufsteigend</option><option value={3}>Preis absteigend</option></select>}
   <button disabled={busy||!ready}>Suchen</button>
  </form>}
  {error&&<p className="hmp-error" role="alert">{error}{!ready&&username&&<button type="button" onClick={()=>{setError('');setData(null);setConnection(v=>v+1);}}>Neu verbinden</button>}</p>}{data?.notice&&<p className="hmp-notice" role="status">{data.notice}</p>}
  {data&&!data.enabled&&<p className="hmp-error">Der Marktplatz ist derzeit geschlossen.</p>}
  {tab==='own'&&<><div className="hmp-vaults" aria-label="Verkaufserlöse">{currencies.map(c=>{const vault=data?.vaults?.find(v=>v.type===c.type);return <button type="button" className="hmp-vault" key={c.type} disabled={busy||!ready||!vault?.enabled||!vault.amount} title={vault?.enabled?'Verkaufserlöse abholen':'Für diese Währung ist der Handel nicht aktiviert.'} aria-label={`${c.label}: ${money(vault?.amount||0)} Verkaufserlöse abholen`} onClick={()=>request('marketClaim',{currency:c.type})}><span className="hmp-vault-icon"><img src={c.icon} alt=""/></span><span><small>{c.label}</small><strong>{money(vault?.amount||0)}</strong></span></button>;})}</div><nav className="hmp-own-tabs" aria-label="Eigene Angebote"><button disabled={busy} aria-pressed={ownSection===1} onClick={()=>{setOwnSection(1);setPage(0);}}>Meine Angebote</button><button disabled={busy} aria-pressed={ownSection===2} onClick={()=>{setOwnSection(2);setPage(0);}}>Meine Verkäufe</button><button disabled={busy} aria-pressed={ownSection===3} onClick={()=>{setOwnSection(3);setPage(0);}}>Abgelaufene</button></nav></>}
  <div className="hmp-content" aria-busy={busy}>
   {!data&&!error&&<p className="hmp-empty">Marktplatz wird geladen …</p>}
   {data&&!items.length&&<p className="hmp-empty">{tab==='inventory'?'Keine verkaufbaren Items gefunden.':tab==='own'?(ownSection===1?'Du hast noch keine Angebote erstellt.':ownSection===2?'Keine noch nicht abgeholten Verkäufe.':'Keine abgelaufenen Angebote.'):'Keine passenden Angebote gefunden.'}</p>}
   <div className="hmp-grid">{items.map(item=><article className={'hmp-offer'+(selected?.id===item.id?' hmp-selected':'')} key={item.id}>
    <button className="hmp-offer-main" disabled={busy||!data?.enabled} onClick={()=>{setSelected(item);setPrice('1');}}>{icon(item)}<strong>{item.name||item.asset}</strong>{tab!=='inventory'&&<span className="hmp-price"><img src={currencies.find(c=>c.type===data?.currency)?.icon||talerIcon} alt=""/>{money(item.price)} <small>{currency}</small></span>}</button>
    {tab!=='inventory'&&<footer><button className="hmp-seller" onClick={()=>onProfile?onProfile(item.seller):window.open('/profile/'+encodeURIComponent(item.seller),'_blank','noopener')}>{item.seller}</button>{tab==='own'&&<span>{item.state===2?'Verkauft':item.state===3?'Abgelaufen':'Im Verkauf'}</span>}</footer>}
   </article>)}</div>
  </div>
  <footer className="hmp-pagination"><button disabled={busy||page===0} onClick={()=>setPage(page-1)}>Zurück</button><span>Seite {page+1} / {Math.max(1,Math.ceil((data?.total||0)/24))}</span><button disabled={busy||(page+1)*24>=(data?.total||0)} onClick={()=>setPage(page+1)}>Weiter</button><button disabled={busy||!ready} onClick={()=>request()}>Aktualisieren</button></footer>
  {selected&&<div className="hmp-overlay"><section className="hmp-confirm" role="dialog" aria-modal="true" aria-label="Angebot"><h3>{selected.name||selected.asset}</h3>{icon(selected)}
   {tab==='inventory'?<><label>Dein Verkaufspreis ({currency})<input type="number" min={1} max={1000000000} step={1} value={price} onChange={e=>setPrice(e.target.value)}/></label><p>Der Käuferpreis enthält zusätzlich die Marktplatzgebühr. Laufzeit: 48 Stunden.</p></>:<p>{money(selected.price)} {currency}{selected.own&&<small> · Dein Erlös: {money(selected.proceeds)} {currency}</small>}</p>}
   <footer><button disabled={busy} onClick={()=>setSelected(null)}>Abbrechen</button>{tab==='inventory'?<button className="hmp-primary" disabled={busy||!data?.enabled||!ready||!Number.isInteger(Number(price))||Number(price)<1||Number(price)>1000000000} onClick={()=>request('marketSell',{id:selected.id,price:Number(price)})}>Angebot erstellen</button>:selected.own?<button className="hmp-primary" disabled={busy||!ready||!data?.enabled||selected.state===2} onClick={()=>request('marketCancel',{id:selected.id})}>Zurücknehmen</button>:<button className="hmp-primary" disabled={busy||!ready||!data?.enabled||selected.state!==1} onClick={()=>request('marketBuy',{id:selected.id,price:selected.price})}>Für {money(selected.price)} {currency} kaufen</button>}</footer>
   {error&&<p role="alert" className="hmp-error">{error}</p>}
  </section></div>}
 </div>;
}
