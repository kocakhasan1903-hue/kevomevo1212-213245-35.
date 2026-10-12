import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventAuctionWidget, EventPanel } from './EventPanel';
import { EventController, EventState, HotelEvent } from './EventTypes';
import { useEventController } from './useEventController';

const state = (): EventState => ({ requestId: '', username: 'Syntetic', canManage: true, now: Math.floor(Date.now() / 1000), balance: { credits: 50, diamonds: 7 }, plan: [], activities: [] });
const controller = (data = state()): EventController => ({ data, catalog: [], error: '', busy: false, ready: true, needsRefresh: false, action: '', request: vi.fn(), reconnect: vi.fn() });
class Socket {
    static OPEN = 1; static last: Socket;
    readyState = 1; onopen: any; onmessage: any; onclose: any; onerror: any; sent: any[] = [];
    constructor() { Socket.last = this; }
    send(value: string) { this.sent.push(JSON.parse(value)); }
    close() {}
    receive(header: string, data: any) { act(() => this.onmessage({ data: JSON.stringify({ header, data: { data: typeof data === 'string' ? data : JSON.stringify(data) } }) })); }
    state(data: Partial<EventState> = {}) { this.receive('eventState', { ...state(), ...data, requestId: JSON.parse(this.sent.at(-1).data.text).requestId }); }
}
function TransportPanel() { const connection = useEventController('Syntetic', 42); return <EventPanel manager roomId={42} controller={connection} />; }
function connected() { render(<TransportPanel />); const socket = Socket.last; act(() => socket.onopen()); socket.receive('authResponse', 'Success'); socket.state(); return socket; }
beforeEach(() => { vi.stubGlobal('WebSocket', Socket); localStorage.setItem('kubboch-sto', 'test'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); vi.useRealTimers(); });
describe('Hotel events', () => {
    it('uses real calendar entries and keeps joining inside the client', () => {
        const data = state(), now = new Date();
        data.plan = [{ id: 9, title: 'Bodenquiz', description: 'Echte CMS Beschreibung', roomId: 42, roomName: 'Quizraum', host: 'Alpha', startsAt: Math.floor(new Date(now.getFullYear(), now.getMonth(), 12, 18).getTime() / 1000), endsAt: Math.floor(new Date(now.getFullYear(), now.getMonth(), 12, 19).getTime() / 1000) }];
        const visit = vi.fn(); render(<EventPanel controller={controller(data)} onVisitRoom={visit} />);
        expect(screen.getByText('Echte CMS Beschreibung')).toBeInTheDocument(); fireEvent.click(screen.getByText('Zum Event')); expect(visit).toHaveBeenCalledWith(42);
        fireEvent.click(screen.getByLabelText('Nächster Monat')); expect(screen.getByText('Keine Events in diesem Monat.')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Vorheriger Monat')); expect(screen.getByText('Echte CMS Beschreibung')).toBeInTheDocument();
    });
    it('requires actual server management permissions', () => {
        const data = state(); data.canManage = false; render(<EventPanel manager controller={controller(data)} />);
        expect(screen.getByText('Für die Eventverwaltung fehlen dir die Rechte.')).toBeInTheDocument(); expect(screen.queryByText('Auktion starten')).toBeNull();
    });
    it('searches catalog items and creates once without invented item data or optimistic success', () => {
        const socket = connected();
        expect(screen.getByText('Auktion starten')).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Katalogmöbel suchen'), { target: { value: 'Holzboden' } }); fireEvent.click(screen.getByText('Suchen'));
        expect(socket.sent.at(-1).data.action).toBe('eventCatalog');
        socket.state({ catalog: [{ id: 5069, name: 'Kasja Holzboden', asset: 'hween14_floor' }] });
        fireEvent.click(screen.getByRole('button', { name: /Kasja Holzboden/ })); fireEvent.click(screen.getByRole('button', { name: 'Nur Raum' }));
        const start = screen.getByText('Auktion starten'); fireEvent.click(start); fireEvent.click(start);
        const creates = socket.sent.filter(message => message.data?.action === 'eventCreate'); expect(creates).toHaveLength(1);
        expect(JSON.parse(creates[0].data.text)).toMatchObject({ itemId: 5069, kind: 'auction', scope: 'room', roomId: 42, durationSeconds: 60, startPrice: 1 });
        expect(screen.queryByRole('status')).toBeNull(); socket.state({ notice: 'Auktion wurde gestartet.' }); expect(screen.getByRole('status')).toHaveTextContent('Auktion wurde gestartet.');
    });
    it('prevents overbidding and lets the leading bidder use their reserved bid', () => {
        const data = state();
        const auction: HotelEvent = { id: 7, kind: 'auction', title: '', itemId: 5069, asset: 'floor', itemName: 'Holzboden', amount: 1, currency: 'credits', startPrice: 1, highestBid: 40, minBid: 41, highestBidder: 'Syntetic', winner: '', roomId: 42, roomName: '', scope: 'hotel', startsAt: data.now, endsAt: data.now + 300, status: 'active' };
        const connection = controller(data); render(<EventAuctionWidget auction={auction} controller={connection} onClose={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Dein Gebot'), { target: { value: '91' } }); expect(screen.getByText('Bieten')).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Dein Gebot'), { target: { value: '90' } }); fireEvent.click(screen.getByText('Bieten')); expect(connection.request).toHaveBeenCalledWith('eventBid', { id: 7, bid: 90 });
        expect(screen.getByText('40', { exact: false })).toBeInTheDocument();
    });
    it('preserves drafts after failure and reconnects without replaying a creation', () => {
        const socket = connected(); fireEvent.click(screen.getByRole('tab', { name: 'Wort Rätsel' }));
        fireEvent.change(screen.getByLabelText(/Gesuchtes Wort/), { target: { value: 'Habbo' } }); fireEvent.click(screen.getByText('Rätsel starten'));
        expect(socket.sent.at(-1).data.action).toBe('eventCreate'); act(() => socket.onclose());
        expect(screen.getByLabelText(/Gesuchtes Wort/)).toHaveValue('Habbo'); fireEvent.click(screen.getByText('Neu verbinden'));
        const next = Socket.last; act(() => next.onopen()); next.receive('authResponse', 'Success');
        expect(next.sent.filter(message => message.data?.action === 'eventCreate')).toHaveLength(0); expect(next.sent.filter(message => message.data?.action === 'eventState')).toHaveLength(1);
        expect(screen.getByText('Rätsel starten')).toBeDisabled(); next.state(); expect(screen.getByText('Rätsel starten')).toBeEnabled();
    });
});
