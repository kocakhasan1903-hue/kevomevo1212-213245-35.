/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFriends, useRoom } from '../../../../hooks';
import { FriendsRoomInviteView } from './FriendsListRoomInviteView';

vi.mock('../../../../hooks', () => ({ useFriends: vi.fn(), useRoom: vi.fn() }));
vi.mock('../../../../common', () => ({ DraggableWindow: ({ children }: any) => children, LayoutAvatarImageView: () => null }));

const friends = [{ id: 1, name: 'Alpha', online: true, figure: '', gender: 0 }, { id: 2, name: 'Beta', online: false, figure: '', gender: 0 }];
describe('Room invitation recipients and sending', () => {
    beforeEach(() => {
        vi.mocked(useFriends).mockReturnValue({ getFriend: (id: number) => friends.find(friend => friend.id === id) } as any);
        vi.mocked(useRoom).mockReturnValue({ roomSession: { roomId: 42 } } as any);
    });
    afterEach(cleanup);
    const open = (ids = [1, 2]) => {
        const sendRoomInvite = vi.fn(), removeRecipient = vi.fn(), onCloseClick = vi.fn();
        render(<FriendsRoomInviteView selectedFriendsIds={ids} sendRoomInvite={sendRoomInvite} removeRecipient={removeRecipient} onCloseClick={onCloseClick}/>);
        return { sendRoomInvite, removeRecipient, onCloseClick };
    };
    it('shows named recipients and removes only the requested recipient', () => {
        const { removeRecipient } = open();
        expect(screen.getByText('2 Leute in diesen Raum einladen.')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Alpha aus der Einladung entfernen' }));
        expect(removeRecipient).toHaveBeenCalledExactlyOnceWith(1);
    });
    it('counts the message and submits it once without surrounding whitespace', () => {
        const { sendRoomInvite } = open();
        const send = screen.getByRole('button', { name: 'Absenden' });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: ' Hallo ' } });
        expect(screen.getByText('7 / 255')).toBeTruthy();
        fireEvent.click(send); fireEvent.click(send);
        expect(sendRoomInvite).toHaveBeenCalledExactlyOnceWith('Hallo');
    });
    it('does not send without a room, even with a message and recipients', () => {
        vi.mocked(useRoom).mockReturnValue({ roomSession: null } as any);
        const { sendRoomInvite } = open();
        fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: 'Hallo' } });
        fireEvent.click(screen.getByRole('button', { name: 'Absenden' }));
        expect(sendRoomInvite).not.toHaveBeenCalled();
        expect(screen.getByText('Betritt zuerst einen Raum, um Freunde einzuladen.')).toBeTruthy();
    });
    it('ignores missing recipients and whitespace-only messages', () => {
        const { sendRoomInvite } = open([999]);
        fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: '   ' } });
        expect(screen.getByRole('button', { name: 'Absenden' })).toBeDisabled();
        expect(sendRoomInvite).not.toHaveBeenCalled();
    });
    it('cancels without sending', () => {
        const { sendRoomInvite, onCloseClick } = open();
        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
        expect(onCloseClick).toHaveBeenCalledOnce();
        expect(sendRoomInvite).not.toHaveBeenCalled();
    });
});
