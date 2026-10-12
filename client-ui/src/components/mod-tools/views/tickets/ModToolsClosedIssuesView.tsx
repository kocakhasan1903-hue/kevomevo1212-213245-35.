import { GetSessionDataManager } from '@octane/renderer';
import { useEffect, useRef, useState } from 'react';

type ClosedTicket = { id: number; timestamp: number; closedTimestamp: number; senderId: number; senderName: string; reportedId: number; reportedName: string; moderatorName: string; roomId: number; category: number; message: string };

export const ModToolsClosedIssuesView = () =>
{
    const username = GetSessionDataManager().userName;
    const [ tickets, setTickets ] = useState<ClosedTicket[]>(null);
    const [ ready, setReady ] = useState(false);
    const [ busy, setBusy ] = useState(false);
    const [ error, setError ] = useState('');
    const [ hasMore, setHasMore ] = useState(false);
    const [ connection, setConnection ] = useState(0);
    const socket = useRef<WebSocket>(null);
    const pending = useRef<{ id: string; beforeId: number }>(null);
    const timeout = useRef<ReturnType<typeof setTimeout>>(null);
    const sequence = useRef(0);

    const request = (beforeId = 0) =>
    {
        if(!ready || socket.current?.readyState !== WebSocket.OPEN || pending.current) return;
        const id = `${Date.now()}-${++sequence.current}`;
        pending.current = { id, beforeId }; setBusy(true); setError('');
        socket.current.send(JSON.stringify({ header: 'getProfile', data: { username, action: 'moderationClosedTickets', text: JSON.stringify({ requestId: id, beforeId }), postId: 0 } }));
        timeout.current = setTimeout(() => { pending.current = null; setBusy(false); setError('Die Ticket-Historie antwortet nicht. Bitte aktualisieren.'); }, 20000);
    };

    useEffect(() =>
    {
        const token = localStorage.getItem('kubboch-sto');
        if(!username || !token) { setError('Bitte über die Webseite einchecken.'); return; }
        const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/habboje-ws`);
        socket.current = ws;
        const finish = () => { clearTimeout(timeout.current); pending.current = null; setBusy(false); };
        ws.onopen = () => ws.send(JSON.stringify({ header: 'auth', data: { sso: token } }));
        ws.onmessage = event =>
        {
            try
            {
                const response = JSON.parse(event.data);
                if(response.header === 'authResponse')
                {
                    if(response.data?.data === 'Success') setReady(true);
                    else setError('Bitte auf der Webseite neu anmelden.');
                }
                if(response.header === 'moderationState')
                {
                    const next = JSON.parse(response.data.data);
                    if(next.requestId !== pending.current?.id) return;
                    const append = pending.current.beforeId > 0;
                    finish(); setTickets(previous => append ? [ ...(previous || []), ...next.tickets ] : next.tickets); setHasMore(!!next.hasMore);
                }
                if((response.header === 'profileError' || response.header === 'profileResponse') && pending.current)
                {
                    finish(); setError(String(response.data.data));
                }
            }
            catch { finish(); setError('Die Ticket-Antwort ist ungültig.'); }
        };
        ws.onclose = () => { finish(); setReady(false); setError('Verbindung unterbrochen. Bitte neu verbinden.'); };
        ws.onerror = () => setError('Die Ticket-Historie ist derzeit nicht erreichbar.');
        const ping = setInterval(() => { if(ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ header: 'ping', data: {} })); }, 10000);
        return () => { clearInterval(ping); clearTimeout(timeout.current); ws.onmessage = null; ws.onclose = null; ws.onerror = null; ws.close(); socket.current = null; pending.current = null; };
    }, [ username, connection ]);
    useEffect(() => { if(ready) request(); }, [ ready, connection ]);

    return <section className="hsm-closed-tickets" aria-busy={busy}>
        <div className="hsm-closed-toolbar"><span>Geschlossene Tickets</span><button type="button" disabled={busy} onClick={() => { if(ready) request(); else { setReady(false); setConnection(value => value + 1); } }}>{ready ? 'Aktualisieren' : 'Neu verbinden'}</button></div>
        {error && <p className="hsm-mod-error" role="alert">{error}</p>}
        {!tickets ? <p className="hsm-mod-empty">{error ? 'Historie nicht geladen.' : 'Tickets werden geladen …'}</p> : !tickets.length ? <p className="hsm-mod-empty">Keine geschlossenen Tickets vorhanden.</p> : tickets.map(ticket => <details className="hsm-closed-ticket" key={ticket.id}><summary><strong>#{ticket.id} · {ticket.senderName || `User ${ticket.senderId}`}</strong><span>{ticket.moderatorName || 'System'}</span><time>{new Date((ticket.closedTimestamp || ticket.timestamp) * 1000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></summary><p>{ticket.message}</p><small>{ticket.reportedName && `Gemeldet: ${ticket.reportedName} · `}Raum: {ticket.roomId || 'Hotel'} · Kategorie: {ticket.category}</small></details>)}
        {hasMore && <button type="button" className="hsm-closed-more" disabled={busy} onClick={() => request(tickets.at(-1)?.id || 0)}>Ältere Tickets laden</button>}
    </section>;
};
