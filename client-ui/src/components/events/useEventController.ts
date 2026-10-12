import { useCallback, useEffect, useRef, useState } from 'react';
import { CatalogEventItem, EventController, EventState } from './EventTypes';

export function useEventController(username: string, roomId = 0): EventController {
    const [data, setData] = useState<EventState | null>(null), [catalog, setCatalog] = useState<CatalogEventItem[]>([]);
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false), [connection, setConnection] = useState(0), [action, setAction] = useState('');
    const socket = useRef<WebSocket | null>(null), pending = useRef<{ id: string; action: string } | null>(null), serial = useRef(0), timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const room = useRef(roomId); room.current = roomId;
    const request = useCallback((next = 'eventState', values: Record<string, unknown> = {}) => {
        const ws = socket.current;
        if (!ready || ws?.readyState !== WebSocket.OPEN || pending.current) return;
        const id = `events-${Date.now()}-${++serial.current}`;
        pending.current = { id, action: next }; setBusy(true); setAction(next); setError('');
        ws.send(JSON.stringify({ header: 'getProfile', data: { username, action: next, text: JSON.stringify({ ...values, roomId: values.roomId ?? room.current, requestId: id }), postId: 0 } }));
        timeout.current = setTimeout(() => { pending.current = null; setBusy(false); setNeedsRefresh(true); setError('Keine Bestätigung erhalten. Bitte den Eventstatus aktualisieren, bevor du die Aktion wiederholst.'); }, 25000);
    }, [ready, username]);
    useEffect(() => {
        const token = localStorage.getItem('kubboch-sto');
        if (!username || !token) { setError('Bitte über die Webseite anmelden.'); return; }
        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/habboje-ws`); socket.current = ws;
        const finish = () => { pending.current = null; setBusy(false); if (timeout.current) clearTimeout(timeout.current); };
        ws.onopen = () => ws.send(JSON.stringify({ header: 'auth', data: { sso: token } }));
        ws.onmessage = event => {
            try {
                const response = JSON.parse(event.data);
                if (response.header === 'authResponse') { if (response.data?.data === 'Success') setReady(true); else setError('Bitte auf der Webseite neu anmelden.'); }
                if (response.header === 'eventState') {
                    const next: EventState = typeof response.data?.data === 'string' ? JSON.parse(response.data.data) : response.data.data;
                    if (next.requestId !== pending.current?.id) return;
                    const requested = pending.current.action; finish();
                    if (Array.isArray(next.catalog)) setCatalog(next.catalog);
                    setData(previous => ({ ...previous, ...next }));
                    if (requested === 'eventState') setNeedsRefresh(false);
                }
                if ((response.header === 'profileError' || response.header === 'profileResponse') && pending.current) {
                    const mutation = !['eventState', 'eventCatalog'].includes(pending.current.action); finish();
                    if (mutation) setNeedsRefresh(true);
                    setError(String(response.data?.data || 'Die Aktion konnte nicht abgeschlossen werden.'));
                }
            } catch { finish(); setNeedsRefresh(true); setError('Die Event-Antwort konnte nicht gelesen werden. Bitte aktualisieren.'); }
        };
        ws.onclose = () => { finish(); setReady(false); setNeedsRefresh(true); setError('Verbindung unterbrochen. Bitte neu verbinden.'); };
        ws.onerror = () => setError('Der Eventserver ist derzeit nicht erreichbar.');
        const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ header: 'ping', data: {} })); }, 10000);
        return () => { clearInterval(ping); if (timeout.current) clearTimeout(timeout.current); ws.onmessage = null; ws.onclose = null; ws.onerror = null; ws.close(); socket.current = null; pending.current = null; };
    }, [username, connection]);
    useEffect(() => { if (ready) request(); }, [ready, roomId, request]);
    useEffect(() => { if (!ready) return; const timer = setInterval(() => request(), 5000); return () => clearInterval(timer); }, [ready, request]);
    return { data, catalog, error, busy, ready, needsRefresh, action, request, reconnect: () => { setReady(false); setConnection(value => value + 1); } };
}
