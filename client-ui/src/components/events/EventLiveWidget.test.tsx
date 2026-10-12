import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventLiveWidget } from './EventLiveWidget';
import { EventController, HotelEvent } from './EventTypes';

afterEach(cleanup);
const activity = { id: 42, kind: 'giveaway', status: 'active', scope: 'hotel', startsAt: 1000, endsAt: 1060, itemId: 0, rewardCredits: 20, participants: 3 } as HotelEvent;
const controller = { data: { now: 1000 }, ready: true, busy: false, needsRefresh: false, error: '', request: vi.fn() } as unknown as EventController;
describe('Live event participation', () => {
    it('joins the displayed giveaway and waits for server confirmation', () => {
        const view = render(<EventLiveWidget activity={activity} controller={controller} onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Teilnehmen'));
        expect(controller.request).toHaveBeenCalledWith('eventJoin', { id: 42 });
        expect(screen.queryByText('Du nimmst teil')).toBeNull();
        view.rerender(<EventLiveWidget activity={{ ...activity, joined: true }} controller={controller} onClose={vi.fn()} />);
        expect(screen.getByText('Du nimmst teil')).toBeDisabled();
    });
    it('shows the server riddle and requires answers through room chat', () => {
        render(<EventLiveWidget activity={{ ...activity, kind: 'riddle', question: 'Sortiere die Buchstaben: b · a · b · o · h' }} controller={controller} onClose={vi.fn()} />);
        expect(screen.getByText('Sortiere die Buchstaben: b · a · b · o · h')).toBeInTheDocument();
        expect(screen.getByText(/Schreibe das Lösungswort in den Raumchat/)).toBeInTheDocument();
        expect(screen.queryByText('Teilnehmen')).toBeNull();
    });
    it('prevents expired giveaways and makes closing independent from participation', () => {
        const close = vi.fn();
        render(<EventLiveWidget activity={{ ...activity, endsAt: 999 }} controller={controller} onClose={close} />);
        expect(screen.getByText('Teilnehmen')).toBeDisabled();
        fireEvent.click(screen.getByLabelText('Event ausblenden'));
        expect(close).toHaveBeenCalledOnce();
    });
});
