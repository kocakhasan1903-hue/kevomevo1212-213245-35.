import { useMobileClient } from '../../hooks/useMobileClient';
import { MobileFriendBarView } from './views/friends-bar/MobileFriendBarView';
import { FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFriends } from '../../hooks';
import { FriendBarView } from './views/friends-bar/FriendsBarView';
import { FriendsListView } from './views/friends-list/FriendsListView';
import { FriendsMessengerView } from './views/messenger/FriendsMessengerView';
import { MessengerNotificationView } from './MessengerNotificationView';



export const FriendsView: FC<{}> = (props) => {
    const mobile = useMobileClient();
    const { settings = null, onlineFriends = [], requests = [] } = useFriends();
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const resolveTarget = () => {
            for (const id of [mobile ? 'toolbar-friend-bar-container-mobile' : 'toolbar-friend-bar-container-desktop']) {
                const element = document.getElementById(id);

                if (element) {
                    setPortalTarget((previous) => (previous === element ? previous : element));
                    return;
                }
            }

            setPortalTarget(null);
        };

        resolveTarget();

        const observer = new MutationObserver(resolveTarget);

        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [mobile]);

    if (!settings) return null;

    return (
        <>
            {portalTarget && createPortal(mobile ? <MobileFriendBarView onlineFriends={onlineFriends}/> : <FriendBarView onlineFriends={onlineFriends} requestsCount={requests.length} />, portalTarget)}
            <FriendsListView />
            <FriendsMessengerView />
            <MessengerNotificationView />
        </>
    );
};
