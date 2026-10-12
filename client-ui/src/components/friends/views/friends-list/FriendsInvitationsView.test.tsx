/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateLinkEvent, MessengerThread, MessengerThreadChat, OpenMessengerChat } from '../../../../api';
import { useFriends, useMessenger } from '../../../../hooks';
import { FriendsInvitationsView } from './FriendsInvitationsView';
vi.mock('../../../../hooks', () => ({ useFriends: vi.fn(), useMessenger: vi.fn() }));
vi.mock('../../../../common', () => ({ LayoutAvatarImageView: () => null }));
vi.mock('../../../../api', async importOriginal => ({ ...await importOriginal<any>(), OpenMessengerChat: vi.fn(), CreateLinkEvent: vi.fn() }));
const friend = { id: 1, name: 'Alpha', online: true, followingAllowed: true, figure: '', gender: 0 };
describe('Received room invitations', () => {
    const followFriend = vi.fn();
    beforeEach(() => {
        followFriend.mockClear(); vi.mocked(OpenMessengerChat).mockClear();
        vi.mocked(useFriends).mockReturnValue({ getFriend: () => friend, followFriend } as any);
        const thread = new MessengerThread(friend as any);
        thread.addMessage(null, 'Komm in meinen Raum', 0, null, MessengerThreadChat.ROOM_INVITE);
        thread.addMessage(1, 'Normale Nachricht');
        vi.mocked(useMessenger).mockReturnValue({ messageThreads: [thread] } as any);
    });
    afterEach(cleanup);
    it('enters the stored invitation room even when the sender is offline or cannot be followed', () => {
        const thread = new MessengerThread(friend as any);
        thread.addMessage(null, 'Einladung in Raum 432', 0, 'room:432', MessengerThreadChat.ROOM_INVITE);
        vi.mocked(useMessenger).mockReturnValue({ messageThreads: [thread] } as any);
        vi.mocked(useFriends).mockReturnValue({ getFriend: () => ({ ...friend, online: false, followingAllowed: false }), followFriend } as any);
        render(<FriendsInvitationsView/>);
        fireEvent.click(screen.getByRole('button', { name: 'Raum betreten' }));
        expect(CreateLinkEvent).toHaveBeenCalledWith('navigator/goto/432');
        expect(followFriend).not.toHaveBeenCalled();
    });
    it('lists real invitations separately from ordinary messages and allows following', () => {
        render(<FriendsInvitationsView/>);
        expect(screen.getByText('Komm in meinen Raum')).toBeTruthy();
        expect(screen.queryByText('Normale Nachricht')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Zum Freund' }));
        expect(followFriend).toHaveBeenCalledExactlyOnceWith(friend);
        fireEvent.click(screen.getByRole('button', { name: 'Chat öffnen' }));
        expect(OpenMessengerChat).toHaveBeenCalledExactlyOnceWith(1);
    });
    it('disables following when the sender cannot be followed', () => {
        vi.mocked(useFriends).mockReturnValue({ getFriend: () => ({ ...friend, followingAllowed: false }), followFriend } as any);
        render(<FriendsInvitationsView/>);
        fireEvent.click(screen.getByRole('button', { name: 'Zum Freund' }));
        expect(followFriend).not.toHaveBeenCalled();
    });
    it('dismisses the invitation without sending anything', () => {
        render(<FriendsInvitationsView/>);
        fireEvent.click(screen.getByRole('button', { name: 'Einladung von Alpha ausblenden' }));
        expect(screen.getByText('Keine Einladungen gefunden')).toBeTruthy();
        expect(followFriend).not.toHaveBeenCalled();
    });
});
