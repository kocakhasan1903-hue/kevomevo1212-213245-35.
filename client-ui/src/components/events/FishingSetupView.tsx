import { useEffect, useMemo, useState } from 'react';
import type { EventController } from './EventTypes';
import type { WaterTile } from '../fishing/fishingInteraction';

export type SetupRoom = {id:number;name:string;width:number;height:number;tiles:{x:number;y:number}[];furniture:{id:number;name:string;x:number;y:number;tiles:{x:number;y:number}[]}[]};
export function FishingSetupView({controller,onClose}:{controller:EventController;onClose:()=>void}) {
    const data=controller.data?.fishingAdmin, room=data?.setupRoom;
    const [step,setStep]=useState(0), [roomId,setRoomId]=useState(String(room?.id||data?.config.roomId||''));
    const [water,setWater]=useState<WaterTile[]>([]), [mode,setMode]=useState<'field'|'area'|'remove'>('field');
    const [corner,setCorner]=useState<{x:number;y:number}>(null), [zoom,setZoom]=useState(18), [search,setSearch]=useState('');
    const [range,setRange]=useState(Number(data?.config.range||2)), [checking,setChecking]=useState('');
    const locked=controller.busy||!controller.ready||controller.needsRefresh;
    useEffect(()=>{if(!room)return;setRoomId(String(room.id));setCorner(null);setWater(room.id===Number(data.config.roomId)?(data.config.water as WaterTile[]||[]):[]);setStep(0);},[room?.id]);
    useEffect(()=>{if(checking&&!locked&&data?.setupChecked&&data.setupToken===checking){setStep(2);setChecking('');}},[checking,locked,data?.setupToken]);
    const selected=useMemo(()=>new Set(water.filter(w=>!w.itemId).map(w=>`${w.x}:${w.y}`)),[water]);
    const valid=useMemo(()=>new Set(room?.tiles.map(t=>`${t.x}:${t.y}`)||[]),[room]);
    const furnitureIds=new Set(water.filter(w=>w.itemId).map(w=>w.itemId));
    const tileNames=useMemo(()=>{const names=new Map<string,string[]>();for(const f of room?.furniture||[])for(const t of f.tiles){const key=`${t.x}:${t.y}`;names.set(key,[...(names.get(key)||[]),f.name]);}return names;},[room]);
    const occupied=new Set(room?.furniture.filter(f=>furnitureIds.has(f.id)).flatMap(f=>f.tiles.map(t=>`${t.x}:${t.y}`))||[]);
    const mark=(x:number,y:number)=>{
        if(mode==='area'&&!corner){setCorner({x,y});return;}
        const start=mode==='area'?corner:{x,y};setCorner(null);
        const remove=mode==='remove'||mode==='field'&&selected.has(`${x}:${y}`);
        setWater(old=>{const next=new Map(old.map(w=>[`${w.x}:${w.y}:${w.itemId}`,w]));for(let xx=Math.min(start.x,x);xx<=Math.max(start.x,x);xx++)for(let yy=Math.min(start.y,y);yy<=Math.max(start.y,y);yy++){if(!valid.has(`${xx}:${yy}`))continue;const key=`${xx}:${yy}:0`;if(remove)next.delete(key);else next.set(key,{x:xx,y:yy,itemId:0});}return [...next.values()];});
    };
    const payload={roomId:Number(roomId),water,range,revision:data?.revision};
    return <section className="hea-setup" aria-label="Angelpark einrichten">
        <header><h3>Angelpark einrichten</h3><button onClick={onClose}>Setup schließen</button></header>
        <ol className="hea-setup-steps">{['Raum wählen','Wasser markieren','Prüfen & aktivieren'].map((label,i)=><li key={label} aria-current={step===i?'step':undefined}>{i+1}. {label}</li>)}</ol>
        {step===0?<><p>Betritt den gewünschten Angelraum oder lade seine Raum-ID. Erst am Ende wird etwas gespeichert.</p><form className="hea-form-row" onSubmit={e=>{e.preventDefault();controller.request('eventFishing',{operation:'setupInspect',roomId:Number(roomId)});}}><label>Raum-ID<input type="number" min={1} max={2147483647} required value={roomId} onChange={e=>setRoomId(e.target.value)}/></label><button disabled={locked}>Raum laden</button><button type="button" disabled={locked} onClick={()=>controller.request('eventFishing',{operation:'setupInspect',roomId:0})}>Aktuellen Raum laden</button></form>{room&&<article className="hea-setup-summary"><strong>{room.name}</strong><small>Raum {room.id} · {room.tiles.length} Felder · {room.furniture.length} Möbel</small><button disabled={locked||room.id!==Number(roomId)} onClick={()=>setStep(1)}>Wasser auswählen</button></article>}</>:step===1&&room?<>
            <p>Markiere sämtliche Wasserstellen auf der Karte. Für große Bereiche: „Fläche“ wählen und zwei gegenüberliegende Ecken anklicken. Wassermöbel kannst du darunter vollständig auswählen.</p>
            <div className="hea-setup-tools">{(['field','area','remove'] as const).map((value,i)=><button key={value} aria-pressed={mode===value} onClick={()=>{setMode(value);setCorner(null);}}>{['Einzelfeld','Fläche','Entfernen'][i]}</button>)}<button aria-label="Raumkarte verkleinern" onClick={()=>setZoom(Math.max(8,zoom-4))}>−</button><button aria-label="Raumkarte vergrößern" onClick={()=>setZoom(Math.min(36,zoom+4))}>+</button><button onClick={()=>{setWater([]);setCorner(null);}}>Auswahl leeren</button></div>
            <p role="status">{water.length} Wasser-Markierungen{corner?` · Erste Ecke (${corner.x}, ${corner.y}) gesetzt – jetzt zweite Ecke wählen.`:''}</p>
            <div className="hea-setup-map-scroll"><div className="hea-setup-map" style={{gridTemplateColumns:`repeat(${room.width},${zoom}px)`,gridTemplateRows:`repeat(${room.height},${zoom}px)`}}>{room.tiles.map(t=>{const key=`${t.x}:${t.y}`,names=tileNames.get(key)||[];return <button key={key} aria-label={`Feld ${t.x}, ${t.y}`} aria-pressed={selected.has(key)||occupied.has(key)} title={`${t.x}, ${t.y}${names.length?' · '+names.join(', '):''}`} className={corner?.x===t.x&&corner?.y===t.y?'is-corner':names.length?'has-furniture':''} style={{gridColumn:t.x+1,gridRow:t.y+1}} onClick={()=>mark(t.x,t.y)}/>;})}</div></div>
            <label>Möbel suchen<input value={search} placeholder="Wasser, Teich, See …" onChange={e=>setSearch(e.target.value)}/></label>
            <div className="hea-setup-furniture">{room.furniture.filter(f=>f.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(f=><label className="hea-check" key={f.id}><input type="checkbox" checked={furnitureIds.has(f.id)} onChange={e=>setWater(old=>e.target.checked?[...old,{x:f.x,y:f.y,itemId:f.id}]:old.filter(w=>w.itemId!==f.id))}/><span>{f.name}<small>#{f.id} · {f.tiles.length} Felder · {f.x}, {f.y}</small></span></label>)}{!room.furniture.length&&<p>Keine Bodenmöbel im Raum. Wasser kann über die Raumkarte markiert werden.</p>}</div>
            <label>Maximaler Abstand zum Wasser<select value={range} onChange={e=>setRange(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} {n===1?'Feld':'Felder'}</option>)}</select></label>
            <footer><button onClick={()=>setStep(0)}>Zurück</button><button className="hep-primary" disabled={locked||!water.length||water.length>2048||checking&&locked} onClick={()=>{const token=Date.now().toString(36);setChecking(token);controller.request('eventFishing',{operation:'setupValidate',setupToken:token,...payload});}}>Auswahl prüfen</button></footer>
        </>:<><h3>Einrichtung geprüft</h3><article className="hea-setup-summary"><strong>{room?.name}</strong><p>{water.length} Wasser-Markierungen · Abstand {range} Felder</p><p>Spieler starten per Doppelklick aufs Wasser. Weggehen beendet das Angeln. Die Angelübersicht erscheint nur in diesem Raum oben mittig.</p></article><footer><button disabled={locked} onClick={()=>{setStep(1);setChecking('');}}>Zurück zur Auswahl</button><button disabled={locked} onClick={()=>controller.request('eventFishing',{operation:'setupSave',...payload,enabled:false})}>Als inaktiv speichern</button><button className="hep-primary" disabled={locked} onClick={()=>controller.request('eventFishing',{operation:'setupSave',...payload,enabled:true})}>Speichern & aktivieren</button></footer></>}
        {controller.error&&<p role="alert">{controller.error}</p>}{data?.notice&&<p role="status">{data.notice}</p>}
    </section>;
}
