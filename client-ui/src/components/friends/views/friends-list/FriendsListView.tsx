import { setFriendsWindowVisible, setFriendsSelectedSlot } from '../../friendsWindowVisibility';
import { AnimatedCloseButton } from '../../../../common/AnimatedCloseButton';
import { AddLinkEventTracker, ILinkEventTracker, RemoveFriendComposer, RemoveLinkEventTracker, SendRoomInviteComposer } from '@octane/renderer';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { CreateLinkEvent, filterFriendsByCategory, GetRoomSession, LocalizeText, MessengerFriend, OpenMessengerChat, SendMessageComposer } from '../../../../api';
import { isStaffChatIdentity } from '../../staffChatIdentity';
import { DraggableWindow, DraggableWindowPosition } from '../../../../common';
import { useFriends, useMessenger } from '../../../../hooks';
import './FriendsListView.css';
import { FriendsRemoveConfirmationView } from './FriendsListRemoveConfirmationView';
import { FriendsInvitationsView } from './FriendsInvitationsView';
import { FriendsRoomInviteView } from './FriendsListRoomInviteView';
import { FriendsSearchView } from './FriendsListSearchView';
import { FriendsListGroupView } from './friends-list-group/FriendsListGroupView';
import { FriendsListRequestView } from './friends-list-request/FriendsListRequestView';

export const FriendsListView: FC<{}> = (props) => {
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => { setFriendsWindowVisible(isVisible); return () => setFriendsWindowVisible(false); }, [isVisible]);
    const [selectedFriendsIds, setSelectedFriendsIds] = useState<number[]>([]);
    const [showRoomInvite, setShowRoomInvite] = useState<boolean>(false);
    const [showRemoveFriendsConfirmation, setShowRemoveFriendsConfirmation] = useState<boolean>(false);
    const [activePanel, setActivePanel] = useState<'friends' | 'chat' | 'team' | 'invitations' | 'requests' | 'search' | null>('friends');
    const [friendSearchValue, setFriendSearchValue] = useState('');
    const [isOnlineExpanded, setIsOnlineExpanded] = useState<boolean>(true);
    const [isOfflineExpanded, setIsOfflineExpanded] = useState<boolean>(true);
    const { onlineFriends = [], offlineFriends = [], requests = [], requestFriend = null, requestResponse = null } = useFriends();
    const { setActiveThreadId, activeThread, unreadCount = 0 } = useMessenger();
    const teamChat = [...onlineFriends, ...offlineFriends].find(isStaffChatIdentity);
    const matchesSearch = (friend: MessengerFriend) => !isStaffChatIdentity(friend) && (!friendSearch || `${friend.name} ${friend.motto || ''}`.toLocaleLowerCase().includes(friendSearch));

    const friendSearch = friendSearchValue.trim().toLocaleLowerCase();
    const filteredOnlineFriends = filterFriendsByCategory(onlineFriends, 0).filter(
        matchesSearch
    );
    const filteredOfflineFriends = filterFriendsByCategory(offlineFriends, 0).filter(
        matchesSearch
    );

    const removeFriendsText = useMemo(() => {
        if (!selectedFriendsIds || !selectedFriendsIds.length) return '';

        const userNames: string[] = [];

        for (const userId of selectedFriendsIds) {
            let existingFriend: MessengerFriend = onlineFriends.find((f) => f.id === userId);

            if (!existingFriend) existingFriend = offlineFriends.find((f) => f.id === userId);

            if (!existingFriend) continue;

            userNames.push(existingFriend.name);
        }

        return LocalizeText('friendlist.removefriendconfirm.userlist', ['user_names'], [userNames.join('\n')]);
    }, [offlineFriends, onlineFriends, selectedFriendsIds]);

    const selectFriend = useCallback(
        (userId: number) => {
            if (userId < 0) return;

            setSelectedFriendsIds((prevValue) => {
                const newValue = [...prevValue];

                const existingUserIdIndex: number = newValue.indexOf(userId);

                if (existingUserIdIndex > -1) {
                    newValue.splice(existingUserIdIndex, 1);
                } else {
                    newValue.push(userId);
                }

                return newValue;
            });
        },
        [setSelectedFriendsIds]
    );

    const toggleSelectFriends = useCallback((friendIds: number[]) => {
        if (!friendIds.length) return;

        setSelectedFriendsIds((prevValue) => {
            const allSelected = friendIds.every((friendId) => prevValue.indexOf(friendId) >= 0);

            if (allSelected) return prevValue.filter((friendId) => friendIds.indexOf(friendId) === -1);

            const nextValue = [...prevValue];

            for (const friendId of friendIds) {
                if (nextValue.indexOf(friendId) === -1) nextValue.push(friendId);
            }

            return nextValue;
        });
    }, []);

    const sendRoomInvite = (message: string) => {
        if (!GetRoomSession() || !selectedFriendsIds.length || !message?.trim() || message.length > 255) return;

        const recipients = selectedFriendsIds.filter(id => [...onlineFriends, ...offlineFriends].some(friend => friend.id === id && id > 0));
        if (!recipients.length || recipients.length > 100) return;
        SendMessageComposer(new SendRoomInviteComposer(message.trim(), recipients));

        setShowRoomInvite(false);
    };

    const removeSelectedFriends = () => {
        if (selectedFriendsIds.length === 0) return;

        setSelectedFriendsIds((prevValue) => {
            SendMessageComposer(new RemoveFriendComposer(...prevValue));

            return [];
        });

        setShowRemoveFriendsConfirmation(false);
    };

    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split('/');

                if (parts.length < 2) return;

                switch (parts[1]) {
                    case 'invitations':
                        setIsVisible(true);setActivePanel('invitations');return;
                    case 'requests':
                        setIsVisible(true);setActivePanel('requests');return;
                    case 'list':
                    case 'show':
                        setFriendsSelectedSlot(parts[2] || null);
                        setActivePanel('friends');
                        setIsVisible(true);
                        return;
                    case 'hide':
                        setIsVisible(false);
                        return;
                    case 'toggle':
                        setIsVisible((prevValue) => !prevValue);
                        return;
                    case 'request':
                        if (parts.length < 4) return;

                        requestFriend(parseInt(parts[2]), parts[3]);
                }
            },
            eventUrlPrefix: 'friends/'
        };

        AddLinkEventTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, [requestFriend]);

    useEffect(() => {
        const tracker: ILinkEventTracker = {
            eventUrlPrefix:'friends-messenger/',
            linkReceived: url => {
                if(url.endsWith('/hide')) return;
                setFriendsSelectedSlot(null);setIsVisible(true);setActivePanel(url.endsWith('/-1') ? 'team' : 'chat');
            }
        };
        AddLinkEventTracker(tracker);
        return ()=>RemoveLinkEventTracker(tracker);
    }, []);

    if (!isVisible) return null;

    const respondToAllRequests = (accept: boolean) => {
        for (const request of requests) requestResponse(request.id, accept);
    };

    return (
        <>
            <DraggableWindow
                uniqueKey="octane-friends"
                handleSelector=".hfl-titlebar"
                windowPosition={DraggableWindowPosition.CENTER}
            >
                <div
                    className={`habbo-friend-list${requests.length ? ' has-requests' : ''}${activePanel === 'search' ? ' search-mode' : ''}${activePanel === 'requests' ? ' requests-mode' : ''}${activePanel === null ? ' collapsed-mode' : ''}`}
                >
                    <div className="hfl-titlebar drag-handler">
                        <span className="hfl-titlebar-grip" />
                        <span className="hfl-title">{LocalizeText('friendlist.friends')}</span>
                        <AnimatedCloseButton aria-label="Freunde schließen" className="hfl-close" onClick={() => setIsVisible(false)} />
                    </div>
                    <nav className="habbix-friends-tabs" aria-label="Freundesfunktionen">
                        <button type="button" aria-pressed={activePanel==='friends'} onClick={()=>setActivePanel('friends')}>Freunde</button>
                        <button type="button" aria-pressed={activePanel==='chat'} onClick={()=>{if(activeThread?.participant?.id<0)setActiveThreadId?.(-1);setActivePanel('chat');CreateLinkEvent('friends-messenger/open');}}>Chat{unreadCount>0&&<b className="habbix-unread-badge" aria-label={`${unreadCount} ungelesene Nachrichten`}>{unreadCount}</b>}</button>
                        <button type="button" aria-pressed={activePanel==='invitations'} onClick={()=>setActivePanel('invitations')}>Einladungen</button>
                        <button type="button" aria-pressed={activePanel==='requests'} onClick={()=>setActivePanel('requests')}>Anfragen {requests.length>0&&<b className="habbix-unread-badge" aria-label={`${requests.length} Freundesanfragen`}>{requests.length}</b>}</button>
                        {teamChat && <button type="button" aria-pressed={activePanel==='team'} onClick={()=>OpenMessengerChat(teamChat.id)}>Team-Bereich</button>}
                    </nav>
                    {activePanel==='friends'&&<div className="hmx-friend-search"><input className="habbix-friends-search" aria-label="Freunde suchen" placeholder="Freunde suchen …" value={friendSearchValue} onChange={event=>setFriendSearchValue(event.target.value)}/><button type="button" onClick={()=>setActivePanel('search')}>User finden</button></div>}
                    <div className="hfl-category">
                        <button
                            type="button"
                            className="hfl-category-current"
                            aria-expanded={activePanel === 'friends'}
                            onClick={() => setActivePanel((value) => (value === 'friends' ? null : 'friends'))}
                        >
                            {LocalizeText('friendlist.friends')}
                        </button>
                    </div>
                    {activePanel !== null && (
                        <div className={`hfl-content${activePanel==='chat'||activePanel==='team'?' habbix-chat-panel':''}`}>
                            {(activePanel==='chat'||activePanel==='team')&&<div id="habbix-friends-chat-host" data-panel={activePanel}/>}
                            {activePanel === 'search' && <FriendsSearchView />}
                            <div hidden={activePanel !== 'invitations'}><FriendsInvitationsView /></div>
                            {activePanel === 'requests' && (
                                <>
                                    {requests.length ? <FriendsListRequestView /> : <p className="habbix-requests-empty" role="status">Keine Anfragen.</p>}
                                    {requests.length>0&&<div className="hfl-request-footer" data-testid="requests-footer">
                                        <button type="button" data-action="accept-all" disabled={!requests.length} onClick={() => respondToAllRequests(true)}>
                                            {LocalizeText('friendlist.requests.acceptall')}
                                        </button>
                                        <button type="button" data-action="dismiss-all" disabled={!requests.length} onClick={() => respondToAllRequests(false)}>
                                            {LocalizeText('friendlist.requests.dismissall')}
                                        </button>
                                    </div>}
                                </>
                            )}
                            {activePanel === 'friends' && (
                                <>
                                    <section className="hfl-section">
                                        <button
                                            type="button"
                                            className={`hfl-section-header${isOnlineExpanded ? '' : ' collapsed'}`}
                                            onClick={() => setIsOnlineExpanded((value) => !value)}
                                        >
                                            <span className="hfl-status-label"><i className="hfl-status-dot online"/>{LocalizeText('friendlist.friends')} <b className="hfl-status-count">{filteredOnlineFriends.length}</b></span>
                                            <span
                                                className="hfl-select-all"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    toggleSelectFriends(filteredOnlineFriends.map((friend) => friend.id));
                                                }}
                                            >
                                                {filteredOnlineFriends.length &&
                                                filteredOnlineFriends.every((friend) => selectedFriendsIds.indexOf(friend.id) >= 0)
                                                    ? LocalizeText('friendlist.unselect_all')
                                                    : LocalizeText('friendlist.select_all')}
                                            </span>
                                        </button>
                                        {isOnlineExpanded && (
                                            <div className="hfl-list">
                                                <FriendsListGroupView
                                                    list={filteredOnlineFriends}
                                                    selectedFriendsIds={selectedFriendsIds}
                                                    selectFriend={selectFriend}
                                                />
                                            </div>
                                        )}
                                    </section>
                                    <section className="hfl-section">
                                        <button
                                            type="button"
                                            className={`hfl-section-header${isOfflineExpanded ? '' : ' collapsed'}`}
                                            onClick={() => setIsOfflineExpanded((value) => !value)}
                                        >
                                            <span className="hfl-status-label"><i className="hfl-status-dot offline"/>{LocalizeText('friendlist.friends.offlinecaption')} <b className="hfl-status-count">{filteredOfflineFriends.length}</b></span>
                                        </button>
                                        {isOfflineExpanded && (
                                            <div className="hfl-list">
                                                <FriendsListGroupView
                                                    list={filteredOfflineFriends}
                                                    selectedFriendsIds={selectedFriendsIds}
                                                    selectFriend={selectFriend}
                                                />
                                            </div>
                                        )}
                                    </section>
                                </>
                            )}
                        </div>
                    )}
                    {activePanel === 'friends' && selectedFriendsIds.length > 0 && (
                        <div className="hri-selection-actions" data-testid="friends-footer">
                            <span>{selectedFriendsIds.length ? `${selectedFriendsIds.length} ausgewählt` : 'Freunde zum Einladen auswählen'}</span>
                            <button type="button" disabled={!selectedFriendsIds.length} onClick={() => setSelectedFriendsIds([])}>Abwählen</button>
                            <button type="button" className="hri-primary" disabled={!selectedFriendsIds.length} onClick={() => setShowRoomInvite(true)}>Einladen</button>
                            <button type="button" className="hri-danger" disabled={!selectedFriendsIds.length} onClick={() => setShowRemoveFriendsConfirmation(true)}>Löschen</button>
                        </div>
                    )}
                    {!!requests.length && (
                        <button
                            type="button"
                            className="hfl-request-strip"
                            onClick={() => setActivePanel((value) => (value === 'requests' ? null : 'requests'))}
                        >
                            {LocalizeText('friendlist.tab.friendrequests')}
                        </button>
                    )}
                    <button type="button" className="hfl-search-strip" onClick={() => setActivePanel((value) => (value === 'search' ? null : 'search'))}>
                        {LocalizeText('generic.search')}
                    </button>
                    <div className="hfl-bottom" />
                </div>
            </DraggableWindow>
            {showRoomInvite && (
                <FriendsRoomInviteView selectedFriendsIds={selectedFriendsIds} removeRecipient={id => setSelectedFriendsIds(current => current.filter(value => value !== id))} sendRoomInvite={sendRoomInvite} onCloseClick={() => setShowRoomInvite(false)} />
            )}
            {showRemoveFriendsConfirmation && (
                <FriendsRemoveConfirmationView
                    removeFriendsText={removeFriendsText}
                    removeSelectedFriends={removeSelectedFriends}
                    selectedFriendsIds={selectedFriendsIds}
                    onCloseClick={() => setShowRemoveFriendsConfirmation(false)}
                />
            )}
        </>
    );
};


