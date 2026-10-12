import {
    AddLinkEventTracker,
    CreateLinkEvent,
    ILinkEventTracker,
    RemoveLinkEventTracker,
    RoomEngineEvent,
    RoomId,
    RoomObjectCategory,
    RoomObjectType, HabboSearchComposer, HabboSearchResultData, HabboSearchResultEvent } from '@octane/renderer';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import ticketsIcon from '../../assets/images/icons/tickets.png';
import userIcon from '../../assets/images/icons/user.png';
import roomIcon from '../../assets/images/icons/small-room.png';
import chatIcon from '../../assets/images/icons/chat-history.png';
import { GetRoomSession, ISelectedUser, LocalizeText, SendMessageComposer } from '../../api';
import { Button, DraggableWindowPosition, OctaneCardContentView, OctaneCardHeaderView, OctaneCardView } from '../../common';
import { useMessageEvent, useModTools, useOctaneEvent, useObjectSelectedEvent, useRoomUserListSnapshot } from '../../hooks';
import { ModToolsChatlogView } from './views/room/ModToolsChatlogView';
import { ModToolsRoomView } from './views/room/ModToolsRoomView';
import { ModToolsTicketsView } from './views/tickets/ModToolsTicketsView';
import { ModToolsUserChatlogView } from './views/user/ModToolsUserChatlogView';
import { ModToolsUserView } from './views/user/ModToolsUserView';

export const ModToolsView: FC<{}> = (props) => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentRoomId, setCurrentRoomId] = useState<number>(-1);
    const [selectedUser, setSelectedUser] = useState<ISelectedUser>(null);
    const [isTicketsVisible, setIsTicketsVisible] = useState(false);
    const [activePanel, setActivePanel] = useState<'overview' | 'tickets' | 'user' | 'rooms' | 'chatlogs'>('overview');
    const [userQuery, setUserQuery] = useState('');
    const [userIdQuery, setUserIdQuery] = useState('');
    const [roomQuery, setRoomQuery] = useState('');
    const [roomLogQuery, setRoomLogQuery] = useState('');
    const [userLogQuery, setUserLogQuery] = useState('');
    const [queryError, setQueryError] = useState('');
    const [userResults, setUserResults] = useState<HabboSearchResultData[]>(null);
    // The search packet is shared with the friend list, so only a search this window
    // started is allowed to fill this list.
    const isSearchingRef = useRef(false);
    const {
        tickets = [],
        openRooms = [],
        openRoomChatlogs = [],
        openUserChatlogs = [],
        openUserInfos = [],
        openRoomInfo = null,
        closeRoomInfo = null,
        toggleRoomInfo = null,
        openRoomChatlog = null,
        closeRoomChatlog = null,
        toggleRoomChatlog = null,
        openUserInfo = null,
        closeUserInfo = null,
        toggleUserInfo = null,
        openUserChatlog = null,
        closeUserChatlog = null,
        toggleUserChatlog = null
    } = useModTools();
    const elementRef = useRef<HTMLDivElement>(null);
    // Reactive room roster — used to auto-clear the selected user if
    // they leave the room while the panel is open, and to show an
    // online dot on the selected-user button without going through
    // userDataManager imperatively on every render.
    const roomUserList = useRoomUserListSnapshot();
    // Count of OPEN tickets the moderator hasn't picked yet — shown
    // as a badge on the Report Tool button so a new ticket is visible
    // immediately, without forcing the user to click through.
    const openTicketsCount = useMemo(() => tickets.filter((ticket) => ticket && ticket.state === 1).length, [tickets]);
    const isSelectedUserPresent = useMemo(
        () => !!(selectedUser && roomUserList.some((user) => user && user.webID === selectedUser.userId)),
        [selectedUser, roomUserList]
    );

    useOctaneEvent<RoomEngineEvent>([RoomEngineEvent.INITIALIZED, RoomEngineEvent.DISPOSED], (event) => {
        if (RoomId.isRoomPreviewerId(event.roomId)) return;

        switch (event.type) {
            case RoomEngineEvent.INITIALIZED:
                setCurrentRoomId(event.roomId);
                return;
            case RoomEngineEvent.DISPOSED:
                setCurrentRoomId(-1);
                return;
        }
    });

    useObjectSelectedEvent((event) => {
        if (event.category !== RoomObjectCategory.UNIT) return;

        const roomSession = GetRoomSession();

        if (!roomSession) return;

        const userData = roomSession.userDataManager.getUserDataByIndex(event.id);

        if (!userData || userData.type !== RoomObjectType.USER) return;

        setSelectedUser({ userId: userData.webID, username: userData.name });
    });

    useMessageEvent<HabboSearchResultEvent>(HabboSearchResultEvent, (event) => {
        if (!isSearchingRef.current) return;

        isSearchingRef.current = false;

        const parser = event.getParser();

        setUserResults([...(parser.friends ?? []), ...(parser.others ?? [])]);
    });

    const validId = (value: string) => /^\d+$/.test(value.trim()) && Number(value) > 0 && Number(value) <= 2147483647;
    const searchUser = () => {
        setQueryError('');
        if(userIdQuery.trim()) {
            if(!validId(userIdQuery)) { setQueryError('Bitte eine gültige User ID eingeben.'); return; }
            const id = Number(userIdQuery);
            setSelectedUser({ userId: id, username: `User ${id}` });
            openUserInfo(id);
            return;
        }
        const name = userQuery.trim();
        if(name.length < 2 || name.length > 32) { setQueryError('Bitte einen Usernamen eingeben (2 bis 32 Zeichen).'); return; }
        isSearchingRef.current = true;
        SendMessageComposer(new HabboSearchComposer(name));
    };

    const pickUser = useCallback((result: HabboSearchResultData) => {
        setSelectedUser({ userId: result.avatarId, username: result.avatarName });
        setUserResults(null);
        setUserQuery('');
    }, []);

    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split('/');

                if (parts.length < 2) return;

                switch (parts[1]) {
                    case 'show':
                        setIsVisible(true);
                        return;
                    case 'hide':
                        setIsVisible(false);
                        return;
                    case 'toggle':
                        setIsVisible((prevValue) => !prevValue);
                        return;
                    case 'open-room-info':
                        openRoomInfo(Number(parts[2]));
                        return;
                    case 'close-room-info':
                        closeRoomInfo(Number(parts[2]));
                        return;
                    case 'toggle-room-info':
                        toggleRoomInfo(Number(parts[2]));
                        return;
                    case 'open-room-chatlog':
                        openRoomChatlog(Number(parts[2]));
                        return;
                    case 'close-room-chatlog':
                        closeRoomChatlog(Number(parts[2]));
                        return;
                    case 'toggle-room-chatlog':
                        toggleRoomChatlog(Number(parts[2]));
                        return;
                    case 'open-user-info':
                        openUserInfo(Number(parts[2]));
                        return;
                    case 'close-user-info':
                        closeUserInfo(Number(parts[2]));
                        return;
                    case 'toggle-user-info':
                        toggleUserInfo(Number(parts[2]));
                        return;
                    case 'open-user-chatlog':
                        openUserChatlog(Number(parts[2]));
                        return;
                    case 'close-user-chatlog':
                        closeUserChatlog(Number(parts[2]));
                        return;
                    case 'toggle-user-chatlog':
                        toggleUserChatlog(Number(parts[2]));
                        return;
                }
            },
            eventUrlPrefix: 'mod-tools/'
        };

        AddLinkEventTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, [
        openRoomInfo,
        closeRoomInfo,
        toggleRoomInfo,
        openRoomChatlog,
        closeRoomChatlog,
        toggleRoomChatlog,
        openUserInfo,
        closeUserInfo,
        toggleUserInfo,
        openUserChatlog,
        closeUserChatlog,
        toggleUserChatlog
    ]);

    const isInRoom = currentRoomId > 0;
    const isRoomInfoOpen = isInRoom && openRooms.includes(currentRoomId);
    const isRoomChatlogOpen = isInRoom && openRoomChatlogs.includes(currentRoomId);
    const isUserInfoOpen = selectedUser && openUserInfos.includes(selectedUser.userId);
    const noRoomHint = LocalizeText('modtools.window.no.room');

    const panels = [
        { id: 'overview' as const, label: 'Übersicht' },
        { id: 'tickets' as const, label: 'Tickets' },
        { id: 'user' as const, label: 'User' },
        { id: 'rooms' as const, label: 'Räume' },
        { id: 'chatlogs' as const, label: 'Chatlogs' }
    ];
    const overview = [
        { id: 'tickets' as const, label: 'Tickets', description: `${openTicketsCount} offene Tickets`, icon: ticketsIcon },
        { id: 'user' as const, label: 'User', description: 'User suchen und moderieren', icon: userIcon },
        { id: 'rooms' as const, label: 'Räume', description: 'Aktuellen Raum moderieren', icon: roomIcon },
        { id: 'chatlogs' as const, label: 'Chatlogs', description: 'Nachrichtenverlauf ansehen', icon: chatIcon }
    ];

    return (
        <>
            {isVisible && (
                <OctaneCardView
                    className={`octane-mod-tools hsm-mod-window${activePanel === 'tickets' ? ' hsm-mod-wide' : ''}`}
                    theme="primary-slim"
                    uniqueKey="mod-tools"
                    windowPosition={DraggableWindowPosition.TOP_LEFT}
                    classicScrollbar={false}
                    isResizable={false}
                >
                    <OctaneCardHeaderView headerText="MOD Tools" onCloseClick={() => setIsVisible(false)} />
                    <nav className="hsm-mod-tabs" aria-label="Moderationswerkzeuge">
                        {panels.map(panel => <button type="button" key={panel.id} aria-pressed={activePanel === panel.id} onClick={() => { setQueryError(''); setActivePanel(panel.id); }}>{panel.label}{panel.id === 'tickets' && openTicketsCount > 0 && <span className="hsm-mod-count">{openTicketsCount}</span>}</button>)}
                    </nav>
                    <OctaneCardContentView className="hsm-mod-content" gap={2}>
                        {activePanel === 'overview' && <div className="hsm-mod-overview">
                            {overview.map(panel => <button type="button" key={panel.id} onClick={() => { setQueryError(''); setActivePanel(panel.id); }}><span className="hsm-mod-icon"><img src={panel.icon} alt="" /></span><span><strong>{panel.label}</strong><small>{panel.description}</small></span></button>)}
                        </div>}
                        {activePanel === 'tickets' && <ModToolsTicketsView embedded onCloseClick={() => setActivePanel('overview')} />}
                        {activePanel === 'rooms' && <section className="hsm-mod-section">
                            <form className="hsm-mod-search" onSubmit={event => { event.preventDefault(); if(!validId(roomQuery)) { setQueryError('Bitte eine gültige Raum-ID eingeben.'); return; } setQueryError(''); openRoomInfo(Number(roomQuery)); }}><label>Raum suchen<input aria-label="Raum suchen" inputMode="numeric" maxLength={10} value={roomQuery} placeholder="Raum-ID" onChange={event=>setRoomQuery(event.target.value)} /></label><button type="submit">Suchen</button></form>
                            {queryError && <p className="hsm-mod-error" role="alert">{queryError}</p>}
                        {/* Room tools */}
                        <div className="flex flex-col gap-1.5">
                            <div className="text-[.6rem] uppercase tracking-wide opacity-60 font-semibold pl-1">
                                {LocalizeText('modtools.window.section.room')}
                            </div>
                            <Button
                                active={isRoomInfoOpen}
                                disabled={!isInRoom}
                                gap={2}
                                variant="secondary"
                                justifyContent="start"
                                title={!isInRoom ? noRoomHint : undefined}
                                onClick={() => CreateLinkEvent(`mod-tools/toggle-room-info/${currentRoomId}`)}
                            >
                                <div className="octane-icon icon-small-room shrink-0" />
                                <span className="grow text-start">{LocalizeText('modtools.window.tools.room')}</span>
                            </Button>
                            <Button
                                active={isRoomChatlogOpen}
                                disabled={!isInRoom}
                                gap={2}
                                variant="secondary"
                                innerRef={elementRef}
                                justifyContent="start"
                                title={!isInRoom ? noRoomHint : undefined}
                                onClick={() => CreateLinkEvent(`mod-tools/toggle-room-chatlog/${currentRoomId}`)}
                            >
                                <div className="octane-icon icon-chat-history shrink-0" />
                                <span className="grow text-start">{LocalizeText('modtools.window.tools.chatlog')}</span>
                            </Button>
                        </div>

                            {!isInRoom && <p className="hsm-mod-empty">{noRoomHint}</p>}
                        </section>}
                        {activePanel === 'user' && <section className="hsm-mod-section">
                            <form className="hsm-mod-search hsm-mod-user-search" onSubmit={event=>{event.preventDefault();searchUser();}}><label>User ID<input aria-label="User ID" inputMode="numeric" maxLength={10} value={userIdQuery} onChange={event=>setUserIdQuery(event.target.value)} /></label><label>Username<input aria-label="Username" maxLength={32} value={userQuery} onChange={event=>setUserQuery(event.target.value)} /></label><button type="submit">Suchen</button></form>
                            {queryError && <p className="hsm-mod-error" role="alert">{queryError}</p>}
                        {/* Selected user */}
                        <div className="flex flex-col gap-1.5">
                            <div className="text-[.6rem] uppercase tracking-wide opacity-60 font-semibold pl-1">
                                {LocalizeText('modtools.window.section.user')}
                            </div>
                            {selectedUser ? (
                                <div
                                    className={`flex flex-col gap-1.5 rounded p-1.5 border ${isSelectedUserPresent ? 'bg-gradient-to-r from-emerald-50 to-transparent border-emerald-100' : 'bg-gradient-to-r from-zinc-50 to-transparent border-zinc-200'}`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className={`inline-block w-2 h-2 rounded-full shrink-0 ${isSelectedUserPresent ? 'bg-emerald-500' : 'bg-zinc-400'}`}
                                            title={
                                                isSelectedUserPresent
                                                    ? LocalizeText('modtools.window.user.in_room')
                                                    : LocalizeText('modtools.window.user.left_room')
                                            }
                                            aria-label={
                                                isSelectedUserPresent
                                                    ? LocalizeText('modtools.userinfo.presence.in_room')
                                                    : LocalizeText('modtools.window.user.left_room')
                                            }
                                        />
                                        <span className="truncate grow text-start text-sm font-semibold leading-tight">{selectedUser.username}</span>
                                        <button
                                            className="inline-flex items-center justify-center w-5 h-5 rounded text-zinc-500 hover:text-rose-600 hover:bg-rose-100 shrink-0 transition-colors"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedUser(null);
                                            }}
                                            title={LocalizeText('modtools.window.user.clear')}
                                        >
                                            <FaTimes size={10} />
                                        </button>
                                    </div>
                                    <Button
                                        active={!!isUserInfoOpen}
                                        gap={2}
                                        justifyContent="start"
                                        variant="secondary"
                                        onClick={() => CreateLinkEvent(`mod-tools/toggle-user-info/${selectedUser.userId}`)}
                                    >
                                        <div className="octane-icon icon-user shrink-0" />
                                        <span className="grow text-start">{LocalizeText('modtools.window.user.open_info')}</span>
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 rounded p-2 border border-dashed border-zinc-300 bg-zinc-50/50">
                                        <div className="octane-icon icon-avatar-anonymous shrink-0 opacity-70" />
                                        <span className="text-xs italic">{LocalizeText('modtools.window.select.user')}</span>
                                    </div>
                                    {userResults && !userResults.length && <div className="text-[.65rem] italic opacity-60 pl-1">
                                        {LocalizeText('generic.no_results_found')}
                                    </div>}
                                    {userResults && userResults.length > 0 && <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto">
                                        {userResults.slice(0, 12).map((result) => <button
                                            key={result.avatarId}
                                            className="flex items-center gap-2 rounded px-2 py-1 text-start hover:bg-zinc-100"
                                            type="button"
                                            onClick={() => pickUser(result)}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${result.isAvatarOnline ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                                            <span className="truncate text-xs">{result.avatarName}</span>
                                        </button>)}
                                    </div>}
                                </div>
                            )}
                        </div>

                        </section>}
                        {activePanel === 'chatlogs' && <section className="hsm-mod-section">
                            <form className="hsm-mod-search" onSubmit={event=>{event.preventDefault();if(!validId(roomLogQuery)){setQueryError('Bitte eine gültige Raum-ID eingeben.');return;}setQueryError('');openRoomChatlog(Number(roomLogQuery));}}><label>Raum Chatlog öffnen<input aria-label="Raum Chatlog öffnen" inputMode="numeric" maxLength={10} placeholder="Raum-ID" value={roomLogQuery} onChange={event=>setRoomLogQuery(event.target.value)}/></label><button type="submit">Öffnen</button></form>
                            <form className="hsm-mod-search" onSubmit={event=>{event.preventDefault();if(!validId(userLogQuery)){setQueryError('Bitte eine gültige User ID eingeben.');return;}setQueryError('');openUserChatlog(Number(userLogQuery));}}><label>User Chatlog öffnen<input aria-label="User Chatlog öffnen" inputMode="numeric" maxLength={10} placeholder="User ID" value={userLogQuery} onChange={event=>setUserLogQuery(event.target.value)}/></label><button type="submit">Öffnen</button></form>
                            <Button disabled={!selectedUser} onClick={()=>selectedUser && openUserChatlog(selectedUser.userId)}><img className="hsm-mod-action-icon" src={chatIcon} alt="" />{selectedUser ? `${selectedUser.username} Chatlog öffnen` : 'Zuerst einen User auswählen'}</Button>
                            {queryError && <p className="hsm-mod-error" role="alert">{queryError}</p>}
                            <p className="hsm-mod-hint">Chatlogs werden in separaten Fenstern geöffnet. Du kannst mehrere Chatlogs gleichzeitig öffnen.</p>
                        </section>}
                    </OctaneCardContentView>
                </OctaneCardView>
            )}
            {openRooms.length > 0 &&
                openRooms.map((roomId) => (
                    <ModToolsRoomView key={roomId} roomId={roomId} onCloseClick={() => CreateLinkEvent(`mod-tools/close-room-info/${roomId}`)} />
                ))}
            {openRoomChatlogs.length > 0 &&
                openRoomChatlogs.map((roomId) => (
                    <ModToolsChatlogView key={roomId} roomId={roomId} onCloseClick={() => CreateLinkEvent(`mod-tools/close-room-chatlog/${roomId}`)} />
                ))}
            {openUserInfos.length > 0 &&
                openUserInfos.map((userId) => (
                    <ModToolsUserView key={userId} userId={userId} onCloseClick={() => CreateLinkEvent(`mod-tools/close-user-info/${userId}`)} />
                ))}
            {openUserChatlogs.length > 0 &&
                openUserChatlogs.map((userId) => (
                    <ModToolsUserChatlogView key={userId} userId={userId} onCloseClick={() => CreateLinkEvent(`mod-tools/close-user-chatlog/${userId}`)} />
                ))}
            {isTicketsVisible && <ModToolsTicketsView onCloseClick={() => setIsTicketsVisible(false)} />}
        </>
    );
};
