import { GetSessionDataManager } from '@octane/renderer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HelpIndexView } from './HelpIndexView';

type Ticket = { id: number; state: number; timestamp: number; message: string };
type TicketState = { requestId: string; action: string; openCount: number; tickets: Ticket[] };

export function HelpTicketsView() {
    const username = GetSessionDataManager().userName;
    const [data, setData] = useState<TicketState>(null);
    const [closed, setClosed] = useState(false);
    const [creating, setCreating] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [needsRefresh, setNeedsRefresh] = useState(false);
    const [connection, setConnection] = useState(0);
    const socket = useRef<WebSocket>(null);
    const pending = useRef<{ id: string; action: string }>(null);
    const timeout = useRef<ReturnType<typeof setTimeout>>(null);
    const serial = useRef(0);

    const request = useCallback((action = 'supportList') => {
        const ws = socket.current;
        if (!ready || ws?.readyState !== WebSocket.OPEN || pending.current) return;
        const id = `${Date.now()}-${++serial.current}`;
        pending.current = { id, action };
        setBusy(true); setError(''); setNotice('');
        ws.send(JSON.stringify({ header: 'getProfile', data: { username, action, text: JSON.stringify({ requestId: id, message }), postId: 0 } }));
        timeout.current = setTimeout(() => {
            pending.current = null; setBusy(false); setNeedsRefresh(true);
            setError('Keine Bestätigung erhalten. Bitte zuerst die Ticketliste aktualisieren.');
        }, 25000);
    }, [ready, username, message]);

    useEffect(() => {
        const token = localStorage.getItem('kubboch-sto');
        if (!username || !token) { setError('Bitte über die Webseite einchecken.'); return; }
        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/habboje-ws`);
        socket.current = ws;
        const finish = () => { pending.current = null; setBusy(false); clearTimeout(timeout.current); };
        ws.onopen = () => ws.send(JSON.stringify({ header: 'auth', data: { sso: token } }));
        ws.onmessage = event => {
            try {
                const response = JSON.parse(event.data);
                if (response.header === 'authResponse') {
                    if (response.data?.data === 'Success') setReady(true);
                    else setError('Bitte auf der Webseite neu anmelden.');
                }
                if (response.header === 'supportState') {
                    const next: TicketState = JSON.parse(response.data.data);
                    if (next.requestId !== pending.current?.id) return;
                    const created = pending.current.action === 'supportCreate';
                    finish(); setData(next); setNeedsRefresh(false);
                    if (created) { setCreating(false); setClosed(false); setMessage(''); setNotice('Dein Ticket wurde gesendet.'); }
                }
                if (response.header === 'profileError' || response.header === 'profileResponse') {
                    if (!pending.current) return;
                    if (pending.current.action === 'supportCreate') setNeedsRefresh(true);
                    finish(); setError(String(response.data.data));
                }
            } catch { finish(); setNeedsRefresh(true); setError('Ticket-Antwort konnte nicht gelesen werden. Bitte aktualisieren.'); }
        };
        ws.onclose = () => { finish(); setReady(false); setNeedsRefresh(true); setError('Verbindung unterbrochen. Bitte neu verbinden.'); };
        ws.onerror = () => setError('Das Supportsystem ist derzeit nicht erreichbar.');
        const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ header: 'ping', data: {} })); }, 10000);
        return () => { clearInterval(ping); clearTimeout(timeout.current); ws.onclose = null; ws.onmessage = null; ws.onerror = null; ws.close(); socket.current = null; pending.current = null; };
    }, [username, connection]);

    useEffect(() => { if (ready) request(); }, [ready, connection]);
    useEffect(() => {
        if (!ready || creating) return;
        const refresh = setInterval(() => request(), 15000);
        return () => clearInterval(refresh);
    }, [ready, creating, request]);
    const length = message.trim().length;
    const tickets = (data?.tickets || []).filter(ticket => (ticket.state === 0) === closed);
    return <div className="habbix-help-tickets" aria-busy={busy}>
        {creating ? <>
            <div className="habbix-ticket-banner"><strong>Neues Ticket erstellen</strong><span>Beschreibe dein Problem oder deine Frage</span></div>
            <label className="habbix-ticket-message">Deine Nachricht<textarea disabled={busy} value={message} maxLength={140} placeholder="Beschreibe dein Problem oder deine Frage (mindestens 15 Zeichen)..." onChange={event => setMessage(event.target.value)} /></label>
            <small className="habbix-ticket-counter">{message.length} / 140 Zeichen{length < 15 && ' (mindestens 15 Zeichen erforderlich)'}</small>
        </> : <>
            <nav className="habbix-ticket-tabs" role="tablist" aria-label="Meine Tickets"><button role="tab" aria-selected={!closed} onClick={() => setClosed(false)}>Offene ({data?.openCount ?? 0})</button><button role="tab" aria-selected={closed} onClick={() => setClosed(true)}>Geschlossene</button></nav>
            <div className="habbix-ticket-list" role="tabpanel">
                {!data ? <p className="habbix-ticket-empty">{error ? 'Ticketliste nicht geladen.' : 'Tickets werden geladen …'}</p> : !tickets.length ? <p className="habbix-ticket-empty">Keine Tickets gefunden</p> : tickets.map(ticket => <article className="habbix-ticket" key={ticket.id}><header><strong>Ticket #{ticket.id}</strong><time dateTime={new Date(ticket.timestamp * 1000).toISOString()}>{new Date(ticket.timestamp * 1000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></header><p>{ticket.message}</p><small>{ticket.state === 0 ? 'Geschlossen' : ticket.state === 2 ? 'In Bearbeitung' : 'Offen'}</small></article>)}
            </div>
        </>}
        {error && <p className="habbix-ticket-error" role="alert">{error}</p>}{notice && <p className="habbix-ticket-notice" role="status">{notice}</p>}
        <footer className="habbix-ticket-footer">
            {creating ? <><button disabled={busy} onClick={() => setCreating(false)}>Abbrechen</button><button className="is-primary" disabled={!ready || busy || !data || needsRefresh || length < 15 || length > 140} onClick={() => request('supportCreate')}>Ticket senden</button></> : <button className="is-primary" disabled={busy || !ready || !data} onClick={() => { setCreating(true); setNotice(''); }}>Neues Ticket erstellen</button>}
        </footer>
        {(needsRefresh || error) && <button className="habbix-ticket-refresh" disabled={busy} onClick={() => { if (ready) request(); else { setReady(false); setConnection(value => value + 1); } }}>{ready ? 'Ticketliste aktualisieren' : 'Neu verbinden'}</button>}
        <details className="habbix-ticket-other"><summary>Weitere Hilfe und Meldungen</summary><HelpIndexView /></details>
    </div>;
}
