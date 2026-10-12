import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceListContent } from './PriceListContent';

class TestSocket {
    static current: TestSocket;
    readyState = 1;
    onopen?: () => void;
    onclose?: () => void;
    onmessage?: (event: { data: string }) => void;
    messages: any[] = [];
    constructor() { TestSocket.current = this; }
    send(raw: string) { this.messages.push(JSON.parse(raw)); }
    close() {}
    request() { return this.messages.filter(message => message.header === 'cmsExplore').at(-1).data; }
    reply(data: object, id = this.request().requestId) {
        act(() => this.onmessage?.({ data: JSON.stringify({ header: 'cmsExplore', data: { data: JSON.stringify({ requestId: id, ...data }) } }) }));
    }
}
const item = { id: '1', name: 'Thron', image: '', category: 'Rares', price_credits: '500', copies: '4' };
const list = { items: [item], summary: { total: '1', value: '500', average: '500' } };
const dashboard = { trending: [], newest: [], traders: [], history: [], totals: { day: '0', week: '0', period: '0' } };
function open() {
    render(<PriceListContent />);
    act(() => TestSocket.current.onopen?.());
    return TestSocket.current;
}
describe('price list view transitions', () => {
    beforeEach(() => { localStorage.clear(); vi.stubGlobal('WebSocket', TestSocket); });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
    it('switches between the actual disjoint list and dashboard payloads without crashing', () => {
        const socket = open();
        socket.reply(list);
        expect(screen.getByText('Thron')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: 'Dashboard' }));
        expect(screen.getByRole('status').textContent).toContain('geladen');
        expect(socket.request().view).toBe('dashboard');
        socket.reply(dashboard);
        expect(screen.getByText('Aktivste Händler')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: 'Möbelwerte' }));
        expect(screen.getByRole('status')).toBeTruthy();
        socket.reply(list);
        expect(screen.getByText('Thron')).toBeTruthy();
    });
    it('ignores a late dashboard response after switching back to the list', () => {
        const socket = open();
        socket.reply(list);
        fireEvent.click(screen.getByRole('tab', { name: 'Dashboard' }));
        const old = socket.request().requestId;
        fireEvent.click(screen.getByRole('tab', { name: 'Möbelwerte' }));
        socket.reply(dashboard, old);
        expect(screen.getByRole('status')).toBeTruthy();
        socket.reply(list);
        expect(screen.getByText('Thron')).toBeTruthy();
    });
    it('shows an actionable error for an incomplete server response and reconnects', () => {
        const socket = open();
        fireEvent.click(screen.getByRole('tab', { name: 'Dashboard' }));
        socket.reply({ trending: null });
        expect(screen.getByRole('alert').textContent).toContain('unvollständig');
        fireEvent.click(screen.getByRole('button', { name: 'Erneut verbinden' }));
        act(() => TestSocket.current.onopen?.());
        TestSocket.current.reply(dashboard);
        expect(screen.getByText('Aktivste Händler')).toBeTruthy();
    });
    it('loads furniture details and can close and reopen the whole view', () => {
        let socket = open();
        socket.reply(list);
        fireEvent.click(screen.getByRole('button', { name: /Thron/ }));
        expect(socket.request().view).toBe('detail');
        socket.reply({ item, history: [], owners: [] });
        expect(screen.getByRole('dialog').textContent).toContain('Thron');
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        cleanup();
        socket = open();
        socket.reply(list);
        expect(screen.getByText('Thron')).toBeTruthy();
    });
});
