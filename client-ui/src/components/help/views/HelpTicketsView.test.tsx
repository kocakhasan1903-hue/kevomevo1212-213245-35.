import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpTicketsView } from './HelpTicketsView';
vi.mock('@octane/renderer', () => ({ GetSessionDataManager: () => ({ userName: 'Syntetic' }) }));
vi.mock('./HelpIndexView', () => ({ HelpIndexView: () => <div>Native Hilfe</div> }));
class Socket {
    static OPEN = 1; static last: Socket;
    readyState = 1; onopen: any; onmessage: any; onclose: any; onerror: any; sent: any[] = [];
    constructor() { Socket.last = this; }
    send(text: string) { this.sent.push(JSON.parse(text)); }
    close() {}
    receive(header: string, data: any) { act(() => this.onmessage({ data: JSON.stringify({ header, data: { data: typeof data === 'string' ? data : JSON.stringify(data) } }) })); }
    list(tickets: any[] = [], openCount = 0) { const q = JSON.parse(this.sent.at(-1).data.text); this.receive('supportState', { requestId: q.requestId, action: this.sent.at(-1).data.action, tickets, openCount }); }
}
function ready() { render(<HelpTicketsView />); const socket = Socket.last; act(() => socket.onopen()); socket.receive('authResponse', 'Success'); socket.list(); return socket; }
beforeEach(() => { vi.stubGlobal('WebSocket', Socket); localStorage.setItem('kubboch-sto', 'test'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); vi.useRealTimers(); });
describe('Hotel support tickets', () => {
    it('validates the trimmed message and only submits once, showing success after persistence', () => {
        const socket = ready(); fireEvent.click(screen.getByText('Neues Ticket erstellen'));
        const textarea = screen.getByLabelText('Deine Nachricht');
        fireEvent.change(textarea, { target: { value: '    kurz     ' } }); expect(screen.getByText('Ticket senden')).toBeDisabled();
        fireEvent.change(textarea, { target: { value: 'Eine vollständige Testnachricht' } });
        const send = screen.getByText('Ticket senden'); fireEvent.click(send); fireEvent.click(send);
        expect(socket.sent.filter(m => m.data?.action === 'supportCreate')).toHaveLength(1);
        expect(screen.queryByText('Dein Ticket wurde gesendet.')).toBeNull();
        socket.list([{ id: 7, state: 1, timestamp: 1000, message: 'Eine vollständige Testnachricht' }], 1);
        expect(screen.getByText('Ticket #7')).toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('gesendet');
    });
    it('shows separate open/closed lists and canceling a draft sends no ticket', () => {
        vi.useFakeTimers();
        const socket = ready();
        fireEvent.click(screen.getByText('Neues Ticket erstellen')); fireEvent.click(screen.getByText('Abbrechen'));
        expect(socket.sent.filter(m => m.data?.action === 'supportCreate')).toHaveLength(0);
        act(() => vi.advanceTimersByTime(15000));
        socket.list([{ id: 1, state: 2, timestamp: 1000, message: 'Offener Bericht' }, { id: 2, state: 0, timestamp: 1000, message: 'Geschlossener Bericht' }], 1);
        expect(screen.getByText('Offener Bericht')).toBeInTheDocument(); expect(screen.queryByText('Geschlossener Bericht')).toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: 'Geschlossene' })); expect(screen.getByText('Geschlossener Bericht')).toBeInTheDocument(); expect(screen.queryByText('Offener Bericht')).toBeNull();
    });
    it('retains failed drafts and reconnects with a list request without replaying a submission', () => {
        const socket = ready(); fireEvent.click(screen.getByText('Neues Ticket erstellen'));
        fireEvent.change(screen.getByLabelText('Deine Nachricht'), { target: { value: 'Eine vollständige Testnachricht' } }); fireEvent.click(screen.getByText('Ticket senden'));
        act(() => socket.onclose()); expect(screen.getByLabelText('Deine Nachricht')).toHaveValue('Eine vollständige Testnachricht');
        fireEvent.click(screen.getByText('Neu verbinden')); const next = Socket.last; act(() => next.onopen()); next.receive('authResponse', 'Success');
        expect(next.sent.filter(m => m.data?.action === 'supportCreate')).toHaveLength(0); expect(next.sent.filter(m => m.data?.action === 'supportList')).toHaveLength(1);
        expect(screen.getByText('Ticket senden')).toBeDisabled(); next.list([{ id: 3, state: 1, timestamp: 1000, message: 'Eine vollständige Testnachricht' }], 1);
    });
});
