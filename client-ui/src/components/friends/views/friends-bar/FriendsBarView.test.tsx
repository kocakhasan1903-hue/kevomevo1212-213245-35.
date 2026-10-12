import {setFriendsSelectedSlot, setFriendsWindowVisible} from '../../friendsWindowVisibility';
/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessengerFriend } from '../../../../api';
import { useFriends, useMessenger } from '../../../../hooks';
import { FriendBarItemView } from './FriendBarItemView';
import { FriendBarView } from './FriendsBarView';

vi.mock('../../../../hooks', () => ({ useFriends: vi.fn(), useMessenger: vi.fn() }));
vi.mock('../../../../common/layout/LayoutAvatarImageView', () => ({ LayoutAvatarImageView: () => null }));
vi.mock('../../../../common/layout/LayoutBadgeImageView', () => ({ LayoutBadgeImageView: () => null }));
vi.mock('../../StaffChatFrankIconView', () => ({
    StaffChatFrankIconView: (props: { className?: string; size: number }) => <div className={props.className} data-size={props.size} />
}));

const makeFriend = (id: number, name: string): MessengerFriend => ({ id, name, figure: '', online: true }) as MessengerFriend;

describe('AIR friend bar paging', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1870 });

        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            bottom: 55,
            height: 40,
            left: 1370,
            right: 1870,
            top: 15,
            width: 500,
            x: 1370,
            y: 15,
            toJSON: () => ({})
        });

        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                disconnect() {}
            }
        );

        vi.mocked(useFriends).mockReturnValue({ followFriend: vi.fn() } as unknown as ReturnType<typeof useFriends>);
        vi.mocked(useMessenger).mockReturnValue({ activeThread: null, visibleThreads: [] } as unknown as ReturnType<typeof useMessenger>);
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it.each([null, undefined, false])('renders a contact without an active chat (%s)', (activeThread) => {
        vi.mocked(useMessenger).mockReturnValue({ activeThread, visibleThreads: [] } as unknown as ReturnType<typeof useMessenger>);
        const { container } = render(<FriendBarItemView friend={makeFriend(1, 'Alpha')} />);
        expect(container).toHaveTextContent('Alpha');
        expect(container.querySelector('.is-chat-open')).toBeNull();
    });

    it('updates the active contact highlight when the conversation closes', () => {
        const friend = makeFriend(1, 'Alpha');
        vi.mocked(useMessenger).mockReturnValue({ activeThread: { participant: friend }, visibleThreads: [] } as unknown as ReturnType<typeof useMessenger>);
        const { container, rerender } = render(<FriendBarItemView friend={friend} />);
        expect(container.querySelector('.is-chat-open')).not.toBeNull();
        vi.mocked(useMessenger).mockReturnValue({ activeThread: null, visibleThreads: [] } as unknown as ReturnType<typeof useMessenger>);
        rerender(<FriendBarItemView friend={friend} />);
        expect(container.querySelector('.is-chat-open')).toBeNull();
    });

    it('removes the staff slot and pages both ways with accurate disabled arrows', async () => {
        const friends = [makeFriend(-1, 'Staff Chat'), makeFriend(1, 'Alice'), makeFriend(2, 'Bruno'), makeFriend(3, 'Carla'), makeFriend(4, 'Dora')];
        const { container } = render(<FriendBarView onlineFriends={friends} />);

        await waitFor(() => expect(container.querySelectorAll('.friend-bar-friend')).toHaveLength(3));

        expect(container).not.toHaveTextContent('Staff Chat');
        expect(container).toHaveTextContent('Alice');
        expect(container).toHaveTextContent('Bruno');
        expect(container).toHaveTextContent('Carla');
        expect(container).not.toHaveTextContent('Dora');
        expect(container.querySelector('.friend-bar-find-friends')).toBeNull();
        expect(container.querySelector('.friend-bar-button.left')).toBeDisabled();
        expect(container.querySelector('.friend-bar-button.right')).not.toBeDisabled();

        fireEvent.click(container.querySelector<HTMLButtonElement>('.friend-bar-button.right'));

        await waitFor(() => expect(container).toHaveTextContent('Dora'));
        await waitFor(() => expect(container).not.toHaveTextContent('Alice'));
        expect(container.querySelector('.friend-bar-button.left')).not.toBeDisabled();
        expect(container.querySelector('.friend-bar-button.right')).toBeDisabled();

        fireEvent.click(container.querySelector<HTMLButtonElement>('.friend-bar-button.left'));
        await waitFor(() => expect(container).toHaveTextContent('Alice'));
        await waitFor(() => expect(container).not.toHaveTextContent('Dora'));
        expect(container.querySelector('.friend-bar-button.left')).toBeDisabled();
    });

    it('fills the three AIR slots with find-friends entries when contacts are missing', async () => {
        const { container } = render(<FriendBarView onlineFriends={[makeFriend(-1, 'Staff Chat')]} />);

        await waitFor(() => expect(container.querySelectorAll('.friend-bar-find-friends')).toHaveLength(3));

        expect(container.querySelectorAll('.friend-bar-friend')).toHaveLength(0);
        expect(container.querySelectorAll('.friend-bar-button')).toHaveLength(2);
        expect(container.querySelector('.friend-bar-button.left')).toBeDisabled();
        expect(container.querySelector('.friend-bar-button.right')).toBeDisabled();
    });

    it('uses Frank and keeps only Chat on the Staff Chat tab', async () => {
        const { container } = render(<FriendBarItemView friend={makeFriend(-1, 'Staff Chat')} />);

        await waitFor(() => expect(container.querySelector('.friend-bar-staff-chat-frank')).not.toBeNull());
        const frank = container.querySelector('.friend-bar-staff-chat-frank');

        expect(frank).toHaveAttribute('data-size', '40');
        expect(frank?.parentElement).toHaveClass('avatar', 'staff-chat');

        fireEvent.click(container.querySelector<HTMLButtonElement>('.friend-bar-tab'));

        await waitFor(() => expect(container.querySelectorAll('.friend-bar-action-icon')).toHaveLength(1));
    });
    it('highlights only the activated empty slot and clears the highlight when closed', async () => {
        const {container} = render(<FriendBarView onlineFriends={[]}/>);
        await waitFor(()=>expect(container.querySelectorAll('.friend-bar-search')).toHaveLength(3));
        const buttons=container.querySelectorAll<HTMLButtonElement>('.friend-bar-search');
        fireEvent.click(buttons[1]);
        const {CreateLinkEvent}=await import('../../../../api');
        const route=vi.mocked(CreateLinkEvent).mock.calls.at(-1)[0];
        expect(route).toMatch(/^friends\/list\//);
        act(()=>{setFriendsSelectedSlot(route.split('/')[2]);setFriendsWindowVisible(true);});
        expect(buttons[1]).toHaveAttribute('aria-pressed','true');
        expect(container.querySelectorAll('.friend-bar-find-friends.is-selected')).toHaveLength(1);
        act(()=>setFriendsWindowVisible(false));
        expect(container.querySelector('.friend-bar-find-friends.is-selected')).toBeNull();
    });

});
