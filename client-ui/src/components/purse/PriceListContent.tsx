import { ReactNode, useEffect, useRef, useState } from 'react';
import './PriceListContent.css';
import { validatePriceListData, PriceListViewName } from './priceListData';

type Item = { id: string; name: string; category: string; image: string; price_credits: string; price_diamonds: string; copies: string; owners: string; ltd: string };
type Activity = { id: string; day: string; week: string; period: string };
type History = { id?: string; day: string; trades: string };
type Person = { id: string; username: string; look: string; day: string; week: string; trades: string; rares: string; last_trade: string; copies: string };
type Data = { requestId: string; error?: string; categories: {category: string}[]; totals: {day: string; week: string; period: string}; activity: Activity[]; trending: Item[]; newest: Item[]; history: History[]; traders: Person[]; items: Item[]; summary: {total: string; value: string; average: string}; item: Item; owners: Person[] };
const num = (value: string | number | null | undefined) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0).toLocaleString('de-DE');
const safeImage = (url: string) => typeof url === 'string' && url && (/^https:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : undefined;
const COIN = '/assets/source/currency/small_coin.png';

export function TradeChart({ history = [], days }: {history?: History[]; days: number}) {
    const end = Math.floor(Date.now() / 86400000);
    const values = Array.from({length: days}, (_, index) => { const day = end - days + 1 + index; return { day, value: history.filter(point => Number(point.day) === day).reduce((sum, point) => sum + Number(point.trades), 0) }; });
    const max = Math.max(1, ...values.map(point => point.value));
    return <div className="hpl-chart" aria-label={`Handelsverlauf der letzten ${days} Tage`}>{values.map(point => <span key={point.day} style={{height: `${Math.max(3, point.value / max * 100)}%`}} title={`${new Date(point.day * 86400000).toLocaleDateString('de-DE')}: ${num(point.value)} Trades`}/>)}</div>;
}

export function PriceListContent({ openProfile, avatarUrl, renderAvatar }: { openProfile?: (id: number, name: string) => void; avatarUrl?: (figure: string) => string; renderAvatar?: (figure: string) => ReactNode }) {
    const [view, setView] = useState<'list'|'dashboard'>('list');
    const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [category, setCategory] = useState(''), [sort, setSort] = useState('newest');
    const [days, setDays] = useState(30), [page, setPage] = useState(0), [ltd, setLtd] = useState(false);
    const [ready, setReady] = useState(false), [retry, setRetry] = useState(0), [error, setError] = useState('');
    const [data, setData] = useState<Data | null>(null), [detail, setDetail] = useState<Data | null>(null), [selected, setSelected] = useState<string | null>(null), [detailError, setDetailError] = useState('');
    const socket = useRef<WebSocket | null>(null), request = useRef(''), detailRequest = useRef(''), requestedView = useRef<PriceListViewName>('list');
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), detailTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 250); return () => clearTimeout(t); }, [search]);
    useEffect(() => {
        setReady(false); setError('');
        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/habboje-ws`); socket.current = ws;
        timer.current = setTimeout(() => setError('Die Preisliste antwortet nicht. Bitte erneut verbinden.'), 15000);
        ws.onopen = () => { const token = localStorage.getItem('kubboch-sto'); if (token) ws.send(JSON.stringify({header:'auth',data:{sso:token}})); else setReady(true); };
        ws.onmessage = event => { try {
            const message = JSON.parse(event.data);
            if (message.header === 'authResponse') { if (message.data?.data === 'Success') setReady(true); else setError('Bitte erneut auf der Webseite anmelden.'); return; }
            if (message.header !== 'cmsExplore') return;
            const next: Data = typeof message.data?.data === 'string' ? JSON.parse(message.data.data) : message.data?.data;
            if (!next || (next.requestId !== detailRequest.current && next.requestId !== request.current)) return;
            if (next.requestId === detailRequest.current) { clearTimeout(detailTimer.current); if(next.error) setDetailError(next.error); else { try { setDetail(validatePriceListData(next, 'detail') as Data); } catch (problem) { setDetailError((problem as Error).message); } } }
            else if (next.requestId === request.current) { clearTimeout(timer.current); if(next.error) setError(next.error); else { try { setData(validatePriceListData(next, requestedView.current) as Data); setError(''); } catch (problem) { setError((problem as Error).message); } } }
        } catch { setError('Die Preisliste konnte nicht gelesen werden.'); } };
        ws.onclose = () => {setReady(false);setError('Verbindung unterbrochen. Bitte erneut verbinden.');};
        const ping = setInterval(() => {if(ws.readyState===1) ws.send(JSON.stringify({header:'ping',data:{}}));},15000);
        return () => {clearInterval(ping);clearTimeout(timer.current);clearTimeout(detailTimer.current);ws.onclose=null;ws.onmessage=null;ws.onopen=null;ws.close();};
    }, [retry]);
    useEffect(() => {
        if(!ready) return;
        setData(null);setError('');requestedView.current=view;request.current=crypto.randomUUID();
        socket.current?.send(JSON.stringify({header:'cmsExplore',data:{requestId:request.current,kind:'rares',view,search:query,category,sort,page,days,ltd}}));
        clearTimeout(timer.current);timer.current=setTimeout(()=>setError('Keine Antwort erhalten. Bitte erneut versuchen.'),15000);
    }, [ready,view,query,category,sort,page,days,ltd]);
    useEffect(() => {
        if(!ready || !selected) { detailRequest.current=''; return; }
        setDetail(null);setDetailError('');detailRequest.current=crypto.randomUUID();
        socket.current?.send(JSON.stringify({header:'cmsExplore',data:{requestId:detailRequest.current,kind:'rares',view:'detail',itemId:Number(selected),days}}));
        clearTimeout(detailTimer.current);detailTimer.current=setTimeout(()=>setDetailError('Details konnten nicht geladen werden.'),15000);
        return () => clearTimeout(detailTimer.current);
    },[ready,selected,days]);
    const changeView = (next: 'list'|'dashboard') => {
        if(next === view) return;
        // Clear synchronously: useEffect runs after the next render, which already needs the new payload shape.
        request.current=''; detailRequest.current=''; clearTimeout(timer.current); clearTimeout(detailTimer.current);
        setData(null);setError('');setDetail(null);setView(next);setPage(0);setSelected(null);
    };
    const openItem = (id: string) => {detailRequest.current='';setDetail(null);setDetailError('');setSelected(id);};
    const closeDetail = () => {detailRequest.current='';clearTimeout(detailTimer.current);setSelected(null);setDetail(null);};
    useEffect(() => {if(!selected)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){detailRequest.current='';setSelected(null);setDetail(null);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[selected]);
    const card = (item: Item, chart = false) => {
        const activity = data?.activity?.find(row=>row.id===item.id);
        return <button className="hpl-item" key={item.id} onClick={()=>openItem(item.id)}><div className="hpl-item-top"><div className="hpl-image">{safeImage(item.image) && <img src={safeImage(item.image)} alt="" loading="lazy"/>}</div><div><strong>{item.name}</strong><span className="hpl-price"><img src={COIN} alt="Taler"/>{num(item.price_credits)}</span>{Number(item.price_diamonds)>0&&<small>{num(item.price_diamonds)} Diamanten</small>}</div></div>{chart ? <><div className="hpl-mini-stats"><span>24 Std. <b>{num(activity?.day)}</b></span><span>7 Tage <b>{num(activity?.week)}</b></span><span>{days} Tage <b>{num(activity?.period)}</b></span></div><TradeChart days={days} history={data?.history?.filter(row=>row.id===item.id)}/></> : <small>{item.category} · {num(item.copies)} im Umlauf</small>}</button>;
    };
    return <section className="hpl" aria-label="Preisliste"><header className="hpl-heading"><div className="hpl-heading-icon" aria-hidden="true"><img src="/assets/source/currency/small_coin.png" alt=""/></div><div><h1>Preisliste</h1><p>Möbelwerte und Handel in deinem Hotel</p></div></header>
        <div className="hpl-tabs" role="tablist" aria-label="Preislistenansicht"><button role="tab" aria-selected={view==='list'} onClick={()=>changeView('list')}>Möbelwerte</button><button role="tab" aria-selected={view==='dashboard'} onClick={()=>changeView('dashboard')}>Dashboard</button></div>
        <div className="hpl-content">
        {view==='dashboard'&&<div className="hpl-stats" aria-label="Handelsübersicht">{[['Trades 24 Std.',data?.totals?.day],['Trades 7 Tage',data?.totals?.week],[`Trades ${days} Tage`,data?.totals?.period]].map(([label,value])=><div key={label}><small>{label}</small><strong>{data?num(value):'–'}</strong></div>)}</div>}
        <div className="hpl-filters"><input aria-label="Möbel suchen" placeholder={view==='dashboard'?'Dashboard Suche…':'Suchen…'} maxLength={60} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Kategorie" value={category} onChange={e=>{setCategory(e.target.value);setPage(0);}}><option value="">Alle Kategorien</option>{(data?.categories||[]).map(row=><option key={row.category}>{row.category}</option>)}{category&&!data?.categories?.some(row=>row.category===category)&&<option>{category}</option>}</select><button aria-pressed={ltd} onClick={()=>{setLtd(!ltd);setPage(0);}}>Nur LTD</button>{view==='dashboard'?<div className="hpl-period">{[7,30,90].map(day=><button key={day} aria-pressed={days===day} onClick={()=>setDays(day)}>{day} Tage</button>)}</div>:<select aria-label="Sortierung" value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="newest">Neueste zuerst</option><option value="name">Name A–Z</option><option value="price_asc">Preis aufsteigend</option><option value="price_desc">Preis absteigend</option></select>}</div>
        {error?<div role="alert" className="hpl-empty">{error}<button onClick={()=>setRetry(n=>n+1)}>Erneut verbinden</button></div>:!data?<p role="status" className="hpl-empty">Preisliste wird geladen …</p>:view==='dashboard'?<><div className="hpl-dashboard"><section className="hpl-panel"><h3>Meistgehandelte Möbel <small>Letzte {days} Tage</small></h3><div className="hpl-trending">{data.trending.map(item=>card(item,true))}</div>{!data.trending.length&&<p className="hpl-empty">Für diese Auswahl sind noch keine Möbelwerte eingetragen.</p>}</section><section className="hpl-panel"><h3>Aktivste Händler <small>Letzte {days} Tage</small></h3><div className="hpl-traders">{data.traders.map((person,index)=><button key={person.id} onClick={()=>openProfile?.(Number(person.id),person.username)}><b>#{index+1}</b>{renderAvatar ? <span className="hpl-trader-avatar">{renderAvatar(person.look)}</span> : avatarUrl&&<img className="hpl-trader-avatar" src={avatarUrl(person.look)} alt=""/>}<div><strong>{person.username}</strong><small>Letzter Trade: {(Number(person.last_trade)>0?new Date(Number(person.last_trade)*1000).toLocaleDateString('de-DE'):'–')}</small></div><span><small>24 Std.</small>{num(person.day)}</span><span><small>7 Tage</small>{num(person.week)}</span><span><small>Rares</small>{num(person.rares)}</span><span className="hpl-trade-total"><small>Trades</small>{num(person.trades)}</span></button>)}</div>{!data.traders.length&&<p className="hpl-empty">Noch keine abgeschlossenen Tauschgeschäfte in diesem Zeitraum.</p>}</section></div><section className="hpl-panel"><h3>Neu in der Preisliste <small>Mit Handelsverlauf</small></h3><div className="hpl-newest">{data.newest.map(item=>card(item,true))}</div>{!data.newest.length&&<p className="hpl-empty">Noch keine Möbelwerte eingetragen.</p>}</section></>:<><div className="hpl-summary"><span>Rares: <b>{num(data.summary.total)}</b></span><span>Gesamtwert: <b>{num(data.summary.value)} Taler</b></span><span>Ø Preis: <b>{num(data.summary.average)} Taler</b></span></div><div className="hpl-list">{data.items.map(item=>card(item))}</div>{!data.items.length&&<p className="hpl-empty">Keine passenden Möbelwerte vorhanden.</p>}<nav className="hpl-pagination" aria-label="Preislisten-Seiten"><button disabled={!page} onClick={()=>setPage(page-1)}>Zurück</button><span>{page+1} / {Math.max(1,Math.ceil(Number(data.summary.total)/24))}</span><button disabled={(page+1)*24>=Number(data.summary.total)} onClick={()=>setPage(page+1)}>Weiter</button></nav></>}
        </div>
        {selected&&<aside className="hpl-detail" role="dialog" aria-label="Möbeldetails"><header><strong>Möbeldetails</strong><button aria-label="Detail-Panel schließen" onClick={closeDetail}>×</button></header>{detailError?<p role="alert">{detailError}</p>:!detail?<p role="status">Details werden geladen …</p>:<><div className="hpl-detail-item">{safeImage(detail.item.image)&&<img src={safeImage(detail.item.image)} alt=""/>}<small>{detail.item.category}</small><h2>{detail.item.name}</h2><span className="hpl-price"><img src={COIN} alt="Taler"/>{num(detail.item.price_credits)}</span><p>Im Umlauf: <strong>{num(detail.item.copies)}</strong></p></div><details open><summary>Handelsaktivität</summary><TradeChart history={detail.history} days={days}/><p>{num(detail.history.reduce((sum,row)=>sum+Number(row.trades),0))} Trades in {days} Tagen</p></details><details open><summary>Besitzer · {num(detail.item.owners)}</summary>{detail.owners.map(person=><button className="hpl-owner" key={person.id} onClick={()=>openProfile?.(Number(person.id),person.username)}>{renderAvatar ? <span className="hpl-trader-avatar">{renderAvatar(person.look)}</span> : avatarUrl&&<img className="hpl-trader-avatar" src={avatarUrl(person.look)} alt=""/>}<span>{person.username}</span><b>{num(person.copies)}×</b></button>)}{!detail.owners.length&&<p>Noch keine Exemplare im Besitz.</p>}</details></>}</aside>}
    </section>;
}
