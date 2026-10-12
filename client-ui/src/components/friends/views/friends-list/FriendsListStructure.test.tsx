/* @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AddLinkEventTracker } from '@octane/renderer';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFriends } from '../../../../hooks';
import { FriendsListView } from './FriendsListView';

vi.mock('../../../../hooks', () => ({ useFriends: vi.fn(), useMessenger: () => ({ messageThreads: [] }) }));

vi.mock('./FriendsListSearchView', () => ({
    FriendsSearchView: () => <div data-testid="friend-search">search</div>
}));

vi.mock('./friends-list-group/FriendsListGroupView', () => ({
    FriendsListGroupView: () => <div data-testid="friend-group">friends</div>
}));

vi.mock('./friends-list-request/FriendsListRequestView', () => ({
    FriendsListRequestView: () => <div data-testid="friend-requests">requests</div>
}));

describe('Habbo friend-list information architecture', () => {
    const requestResponse = vi.fn();

    beforeEach(() => {
        vi.mocked(AddLinkEventTracker).mockClear();
        requestResponse.mockClear();
        vi.mocked(useFriends).mockReturnValue({
            onlineFriends: [],
            offlineFriends: [],
            requests: [{ id: 11 }, { id: 12 }],
            requestFriend: vi.fn(),
            requestResponse,
            settings: { categories: [] }
        } as unknown as ReturnType<typeof useFriends>);
    });

    afterEach(cleanup);

    const renderOpen = () => {
        const result = render(<FriendsListView />);
        const tracker = vi.mocked(AddLinkEventTracker).mock.calls[0][0];

        act(() => tracker.linkReceived('friends/show'));

        return { ...result, container: result.baseElement };
    };

    it('uses the original expanded friends tab structure', () => {
        const { container } = renderOpen();

        expect(container.querySelector('.hfl-panel-header')).toBeNull();
        expect(container.querySelector('.hfl-category-current')).not.toBeNull();
        expect(container.querySelector('.hfl-content [data-testid="friend-group"]')).not.toBeNull();
        expect(container.querySelector('.hfl-request-strip')).not.toBeNull();
        expect(container.querySelector('.hfl-search-strip')).not.toBeNull();
        expect(container.querySelector('[data-testid="friends-footer"]')).toBeNull();
    });

    it('switches the lower request and search tabs while keeping their contextual controls', () => {
        const { container } = renderOpen();

        fireEvent.click(container.querySelector<HTMLButtonElement>('.hfl-request-strip'));

        expect(container.querySelector('[data-testid="friend-group"]')).toBeNull();
        expect(container.querySelector('[data-testid="friend-requests"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="requests-footer"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="friends-footer"]')).toBeNull();

        fireEvent.click(container.querySelector<HTMLButtonElement>('[data-action="accept-all"]'));
        fireEvent.click(container.querySelector<HTMLButtonElement>('[data-action="dismiss-all"]'));

        expect(requestResponse).toHaveBeenCalledWith(11, true);
        expect(requestResponse).toHaveBeenCalledWith(12, true);
        expect(requestResponse).toHaveBeenCalledWith(11, false);
        expect(requestResponse).toHaveBeenCalledWith(12, false);

        fireEvent.click(container.querySelector<HTMLButtonElement>('.hfl-search-strip'));

        expect(container.querySelector('[data-testid="friend-requests"]')).toBeNull();
        expect(container.querySelector('[data-testid="friend-search"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="requests-footer"]')).toBeNull();
    });

    it('does not reserve a request tab when there are no pending requests', () => {
        vi.mocked(useFriends).mockReturnValue({
            onlineFriends: [],
            offlineFriends: [],
            requests: [],
            requestFriend: vi.fn(),
            requestResponse,
            settings: { categories: [] }
        } as unknown as ReturnType<typeof useFriends>);

        const { container } = renderOpen();

        expect(container.querySelector('.hfl-request-strip')).toBeNull();
        expect(container.querySelector('.hfl-search-strip')).not.toBeNull();
        const requestTab=Array.from(container.querySelectorAll('nav button')).find(button=>button.textContent.trim()==='Anfragen');
        fireEvent.click(requestTab);
        expect(requestTab).toHaveAttribute('aria-pressed','true');
        expect(container.querySelector('.habbix-requests-empty')).toHaveTextContent('Keine Anfragen.');
        expect(container.querySelector('[data-testid="friend-group"]')).toBeNull();
        expect(container.querySelector('[data-testid="requests-footer"]')).toBeNull();
    });

    it('collapses and reopens the selected friends tab', () => {
        const { container } = renderOpen();
        const friendsTab = container.querySelector<HTMLButtonElement>('.hfl-category-current');

        expect(friendsTab).toHaveAttribute('aria-expanded', 'true');

        fireEvent.click(friendsTab);

        expect(container.querySelector('.habbo-friend-list')).toHaveClass('collapsed-mode');
        expect(friendsTab).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelector('.hfl-content')).toBeNull();
        expect(container.querySelector('[data-testid="friends-footer"]')).toBeNull();
        expect(container.querySelector('.hfl-search-strip')).not.toBeNull();

        fireEvent.click(friendsTab);

        expect(container.querySelector('.habbo-friend-list')).not.toHaveClass('collapsed-mode');
        expect(friendsTab).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelector('.hfl-content')).not.toBeNull();
        expect(container.querySelector('[data-testid="friends-footer"]')).toBeNull();
    });

    it('uses the original fixed geometry instead of stretching the window', () => {
        const css = readFileSync(join(process.cwd(), 'src/components/friends/views/friends-list/FriendsListView.css'), 'utf8');

        expect(css).toMatch(/\.habbo-friend-list\s*\{[\s\S]*?width:\s*230px;/);
        expect(css).toMatch(/grid-template-rows:\s*24px 17px minmax\(0, 1fr\) 41px 17px 33px;/);
        expect(css).toMatch(/\.hfl-footer-border\s*\{[\s\S]*?width:\s*calc\(100% - 10px\);/);
        expect(css).toMatch(/\.habbo-friend-list\.collapsed-mode\s*\{[^}]*height:\s*auto;/s);
    });
    it('isolates the permission-bearing team buddy from friends and exposes its own tab', () => {
        vi.mocked(useFriends).mockReturnValue({onlineFriends:[{id:-1,name:'Staff Chat',online:true},{id:42,name:'Alpha',online:true,motto:''}],offlineFriends:[{id:43,name:'Beta',online:false,motto:''}],requests:[],requestFriend:vi.fn(),requestResponse} as unknown as ReturnType<typeof useFriends>);
        const { container }=renderOpen();
        expect(container.querySelectorAll('.hfl-status-count')[0]).toHaveTextContent('1');
        expect(container.querySelectorAll('.hfl-status-count')[1]).toHaveTextContent('1');
        expect(container.querySelector('.hfl-status-dot.online')).not.toBeNull();
        expect(container.querySelector('.hfl-status-dot.offline')).not.toBeNull();
        expect(container.querySelector('.habbix-friends-tabs')).toHaveTextContent('Team-Bereich');
        const tracker=vi.mocked(AddLinkEventTracker).mock.calls.map(call=>call[0]).find(item=>item.eventUrlPrefix==='friends-messenger/');
        act(()=>tracker.linkReceived('friends-messenger/-1'));
        expect(container.querySelector('#habbix-friends-chat-host')).toHaveAttribute('data-panel','team');
    });
    it('does not offer a team chat without a server-provided staff buddy', () => {
        const { container }=renderOpen();
        expect(container.querySelector('.habbix-friends-tabs')).not.toHaveTextContent('Team-Bereich');
    });
    it('opens direct messages inside the existing friends window and keeps one draggable window', () => {
        const { container } = renderOpen();
        const tracker = vi.mocked(AddLinkEventTracker).mock.calls.map(call=>call[0]).find(item=>item.eventUrlPrefix==='friends-messenger/');
        act(()=>tracker.linkReceived('friends-messenger/11'));
        expect(container.querySelectorAll('.habbo-friend-list')).toHaveLength(1);
        expect(container.querySelector('#habbix-friends-chat-host')).not.toBeNull();
        const friendsTab = Array.from(container.querySelectorAll('.habbix-friends-tabs button')).find(button=>button.textContent==='Freunde');
        fireEvent.click(friendsTab);
        expect(container.querySelector('#habbix-friends-chat-host')).toBeNull();
        expect(container.querySelectorAll('.habbo-friend-list')).toHaveLength(1);
    });

    it('opens the friends list from the toolbar after chat with exactly one selected tab', () => {
        const {container} = renderOpen();
        const tabs = () => container.querySelectorAll('.habbix-friends-tabs>button[aria-pressed="true"]');
        const messengerTracker = vi.mocked(AddLinkEventTracker).mock.calls.map(call=>call[0]).find(tracker=>tracker.eventUrlPrefix==='friends-messenger/');
        const friendsTracker = vi.mocked(AddLinkEventTracker).mock.calls.map(call=>call[0]).find(tracker=>tracker.eventUrlPrefix==='friends/');
        act(()=>messengerTracker.linkReceived('friends-messenger/open'));
        expect(tabs()).toHaveLength(1);expect(tabs()[0]).toHaveTextContent('Chat');
        act(()=>friendsTracker.linkReceived('friends/list'));
        expect(tabs()).toHaveLength(1);expect(tabs()[0]).toHaveTextContent('Freunde');
        expect(container.querySelector('[data-testid="friend-group"]')).not.toBeNull();
        act(()=>friendsTracker.linkReceived('friends/list'));
        expect(container.querySelector('.habbo-friend-list')).not.toBeNull();
    });


});
