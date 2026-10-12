import { MessengerConversationList, ConversationRow } from './MessengerConversationList';
import { parseGiphyMessage } from '../../../giphy/giphy';
import { directChatRequest, isDirectChatReady, subscribeDirectChatStatus } from '../../../../hooks/friends/directChatTransport';
import { MessengerMediaComposer, parseMessengerMedia } from './MessengerMediaView';
import { getMessageStatusPresentation } from './messenger-thread/messageStatus.helpers';
import backIcon from '../../../../assets/images/avatar-menu/air/arrow-left.png';
import followIcon from '../../../../assets/images/friends/swf/follow_friend.png';
import { createPortal } from 'react-dom';
import { AddLinkEventTracker, FollowFriendMessageComposer, GetSessionDataManager, ILinkEventTracker, RemoveLinkEventTracker } from '@octane/renderer';
import { FC, KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GetUserProfile, MessengerThread, MessengerThreadChat, ReportType, SendMessageComposer } from '../../../../api';
import { LayoutAvatarImageView } from '../../../../common';
import { useFriends, useHelp, useMessenger, useTranslation } from '../../../../hooks';
import { isStaffChatIdentity } from '../../staffChatIdentity';
import { StaffChatFrankIconView } from '../../StaffChatFrankIconView';
import { FriendsAvatarFrameView } from '../../FriendsAvatarFrameView';
import { resolveAvatarFigure } from '../friends-list/resolveAvatarFigure';
import './FriendsMessengerView.css';
import { FriendsMessengerThreadView } from './messenger-thread/FriendsMessengerThreadView';
import { useVisibleConversationRead } from '../../../../hooks/friends/useVisibleConversationRead';


const lastMessage = (thread: MessengerThread): MessengerThreadChat | undefined => {
    for (let i = thread.groups.length - 1; i >= 0; i--) {
        const chats = thread.groups[i].chats;
        for (let j = chats.length - 1; j >= 0; j--) {
            if (chats[j].type === MessengerThreadChat.CHAT || chats[j].type === MessengerThreadChat.ROOM_INVITE) return chats[j];
        }
    }
};

export const FriendsMessengerView: FC<{}> = () => {
    const chatReady = useSyncExternalStore(subscribeDirectChatStatus, isDirectChatReady);
    const [isVisible, setIsVisible] = useState(false);
    const [portalHost,setPortalHost]=useState<HTMLElement|null>(null);
    useEffect(()=>{
        const resolve=()=>setPortalHost(document.getElementById('habbix-friends-chat-host'));
        resolve();const observer=new MutationObserver(resolve);
        observer.observe(document.body,{childList:true,subtree:true});
        return ()=>observer.disconnect();
    },[]);
    const [drafts, setDrafts] = useState<Record<number, string>>({});
    const [sending,setSending]=useState(false);
    const [sendError,setSendError]=useState('');
    const [teamInfoOpen,setTeamInfoOpen]=useState(false);
    const sendingRef=useRef(false);
    const outgoingRef=useRef<{peer:number;text:string;id:string}|null>(null);
    const {
        visibleThreads = [],
        activeThread = null,
        getMessageThread = null,
        sendMessage = null,
        setActiveThreadId = null,
        markThreadRead = null,
        typingUserIds = [],
        sendTypingStatus = null
    } = useMessenger();
    const messageText = activeThread ? drafts[activeThread.threadId] || '' : '';
    const setMessageText = (value: string) => {
        if (activeThread) setDrafts(current => ({ ...current, [activeThread.threadId]: value }));
    };
    const { getFriend = null, friends = [] } = useFriends();
    const { report = null } = useHelp();
    const { settings, translateOutgoing } = useTranslation();
    const messagesBox = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);
    const lastScrolledThread = useRef(0);
    const isTypingRef = useRef<boolean>(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

    const stopTyping = () => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        if (isTypingRef.current && activeThread && activeThread.participant && activeThread.participant.id > 0) {
            sendTypingStatus(activeThread.participant.id, false);
        }

        isTypingRef.current = false;
    };

    const handleInputChange = (value: string) => {
        setMessageText(value);

        const peerId = activeThread && activeThread.participant ? activeThread.participant.id : 0;

        if (peerId <= 0) return;

        if (!value.length) {
            stopTyping();
            return;
        }

        if (!isTypingRef.current) {
            sendTypingStatus(peerId, true);
            isTypingRef.current = true;
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => stopTyping(), 4000);
    };

    const followFriend = () => activeThread && activeThread.participant && SendMessageComposer(new FollowFriendMessageComposer(activeThread.participant.id));
    const openProfile = () => activeThread && activeThread.participant && GetUserProfile(activeThread.participant.id);

    const send = async () => {
        if (!activeThread || !messageText.trim() || sendingRef.current) return;
        const target=activeThread,text=messageText;
        sendingRef.current=true;setSending(true);stopTyping();
        try {
            const shouldTranslate=settings.enabled && text.trimStart().charAt(0)!==':';
            const translation=shouldTranslate?await translateOutgoing(text):null;
            const outgoing=translation?.translatedText?.length && translation.translatedText.length<=255 ? translation.translatedText : text;
            if(target.participant.id>0) {
                if(outgoingRef.current?.peer!==target.participant.id || outgoingRef.current?.text!==outgoing)outgoingRef.current={peer:target.participant.id,text:outgoing,id:crypto.randomUUID()};
                await directChatRequest('dmSend',{peer:target.participant.id,id:outgoingRef.current.id,body:outgoing});
                outgoingRef.current=null;
            }
            else sendMessage(target,GetSessionDataManager().userId,outgoing);
            setSendError('');
            setDrafts(current => current[target.threadId] === text ? { ...current, [target.threadId]: '' } : current);
        } catch(error) { setSendError((error as Error).message); } finally {sendingRef.current=false;setSending(false);}
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if(event.key!=='Enter'||event.nativeEvent.isComposing)return;
        event.preventDefault();void send();
    };

    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split('/');

                if (parts.length === 2) {
                    if (parts[1] === 'overview') {
                        stopTyping();
                        setActiveThreadId(-1);
                        setIsVisible(true);
                        return;
                    }
                    if (parts[1] === 'open') {
                        setIsVisible(true);

                        return;
                    }

                    if (parts[1] === 'toggle') {
                        setIsVisible((prevValue) => !prevValue);

                        return;
                    }

                    const participantId = parseInt(parts[1]);
                    const friend = getFriend(participantId);
                    if (!friend) return;

                    // Staff Chat (participantId -1) and direct chats resolve the same
                    // way — one path, so both open in the same messenger window.
                    const thread = getMessageThread(participantId);

                    if (!thread) return;

                    setActiveThreadId(thread.threadId);
                    setIsVisible(true);
                }
            },
            eventUrlPrefix: 'friends-messenger/'
        };

        AddLinkEventTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, [getFriend, getMessageThread, setActiveThreadId]);

    useEffect(() => {
        if (!isVisible || !activeThread) return;
        if (!messagesBox.current) return;

        if(lastScrolledThread.current !== activeThread.threadId || stickToBottom.current)
        {
            messagesBox.current.scrollTop = messagesBox.current.scrollHeight;
            stickToBottom.current = true;
        }
        lastScrolledThread.current = activeThread.threadId;
    }, [isVisible, portalHost, activeThread, activeThread?.lastUpdated]);

    useEffect(() => {
        return () => {
            stopTyping();
        };
    }, [activeThread]);

    useEffect(()=>{if(chatReady&&isVisible&&activeThread?.participant.id>0)void directChatRequest('dmHistory',{peer:activeThread.participant.id}).catch(()=>{});},[chatReady,isVisible,activeThread?.participant.id]);

    // A hidden conversation must not keep acknowledging incoming messages as read.
    const previousHost = useRef<HTMLElement | null>(null);
    useEffect(() => {
        previousHost.current = portalHost;
    }, [portalHost, setActiveThreadId]);
    useEffect(() => {
        // Keep the chosen conversation across hiding; visibility still gates read receipts.
    }, [isVisible, setActiveThreadId]);

    useVisibleConversationRead(!!(isVisible && portalHost && activeThread), activeThread ? `${activeThread.threadId}:${activeThread.groups.at(-1)?.chats.at(-1)?.id || 0}:${chatReady}` : '', messagesBox, () => markThreadRead?.(activeThread.threadId));

    if (!isVisible || !portalHost) return null;

    const peer=activeThread?.participant;
    const isTeam=!!peer && isStaffChatIdentity(peer);
    const privateThreads=visibleThreads.filter(thread=>!isStaffChatIdentity(thread.participant));
    const livePeer=peer?.id>0?getFriend(peer.id):null;
    const peerOnline=livePeer?.online??peer?.online??false;
    const avatar=(person:any)=>isStaffChatIdentity(person)?<StaffChatFrankIconView size={30}/>:<FriendsAvatarFrameView name={person.name} figure={getFriend(person.id)?.figure||person.figure} gender={person.gender}/>;
    const backToThreads=()=>{stopTyping();setActiveThreadId(-1);};
    const conversationRows: ConversationRow[] = [...privateThreads].sort((a,b) => (lastMessage(b)?.date.getTime() || 0) - (lastMessage(a)?.date.getTime() || 0)).map(thread => {
        const last = lastMessage(thread), media = parseMessengerMedia(last?.message || '');
        return { id: thread.participant.id, name: thread.participant.name, avatar: avatar(thread.participant), relationship: getFriend(thread.participant.id)?.relationshipStatus, online: getFriend(thread.participant.id)?.online ?? thread.participant.online, active: activeThread?.threadId === thread.threadId, unread: thread.unreadCount,
            preview: last?.type === MessengerThreadChat.ROOM_INVITE ? 'Raumeinladung' : media?.kind === 'audio' ? 'Sprachnachricht' : media || parseGiphyMessage(last?.message || '') ? 'GIF' : last?.message || 'Noch keine Nachrichten',
            time: last?.date.toLocaleString('de-DE', last.date.toDateString() === new Date().toDateString() ? {hour:'2-digit',minute:'2-digit'} : {day:'2-digit',month:'2-digit'}),
            failed: last?.failed, status: last?.senderId === GetSessionDataManager().userId && !last?.failed ? getMessageStatusPresentation(last.status) : undefined };
    });
    const contactRows: ConversationRow[] = friends.filter(friend => friend.id > 0 && !isStaffChatIdentity(friend)).slice().sort((a,b) => Number(b.online)-Number(a.online) || a.name.localeCompare(b.name,'de')).map(friend => ({id:friend.id,name:friend.name,avatar:avatar(friend),relationship:friend.relationshipStatus,online:friend.online,preview:friend.online?'Online':'Offline',unread:0}));
    const relationshipContacts = contactRows.filter(row => row.relationship >= 1 && row.relationship <= 3 && !conversationRows.some(conversation => conversation.id === row.id));
    const openConversation = (id: number) => { const thread = getMessageThread(id); if (thread) { stopTyping(); setActiveThreadId(thread.threadId); } };
    return createPortal(<div className={`hmx-messenger${peer ? ' has-conversation' : ''}${isTeam ? ' hmx-team' : ''}`}>
        {!isTeam && <MessengerConversationList conversations={[...conversationRows,...relationshipContacts]} contacts={contactRows} onOpen={openConversation}/>}
        {peer && <section className="hmx-chat-pane" aria-label="Chat">
            {isTeam && <header className="hmx-team-header"><span className="hmx-team-channel">Staff</span><button type="button" aria-label="Teamchat verlassen" onClick={backToThreads}>×</button><button type="button" className="hmx-team-info-button" aria-label="Teamchat-Informationen" aria-expanded={teamInfoOpen} onClick={()=>setTeamInfoOpen(value=>!value)}>ⓘ</button></header>}
            {isTeam && teamInfoOpen && <div className="hmx-team-info">Teamchat für berechtigte Teammitglieder. Nachrichten erreichen die aktuell verbundenen Mitglieder. Die Berechtigung wird vom Server geprüft.</div>}
            <header className="hmx-header"><button type="button" className="hmx-back" aria-label="Zurück zu den Unterhaltungen" onClick={backToThreads}><img src={backIcon} alt=""/><img src={backIcon} alt=""/></button><button type="button" className="hmx-avatar" aria-label={`Profil von ${peer.name}`} onClick={openProfile}>{avatar(peer)}</button><div className="hmx-peer"><strong>{peer.name}</strong><small className={peerOnline?'online':''}>{isStaffChatIdentity(peer)?'Team-Unterhaltung':peerOnline?'Online':'Offline'}</small></div><div className="hmx-actions">{peer.id>0&&<><button type="button" aria-label={`${peer.name} folgen`} title="Raum besuchen" disabled={!livePeer?.followingAllowed} onClick={followFriend}><img src={followIcon} alt=""/></button><button type="button" aria-label="Unterhaltung melden" title="Melden" onClick={()=>report(ReportType.IM,{reportedUserId:peer.id})}><svg width="13" height="14" viewBox="0 0 13 14" aria-hidden="true"><path fill="currentColor" d="M1 1h1v12H1zM3 2h8v6H3z"/></svg></button></>}</div></header>
            <div ref={messagesBox} className="hmx-messages" onScroll={event=>{const el=event.currentTarget;stickToBottom.current=el.scrollHeight-el.clientHeight-el.scrollTop<=12;}}><FriendsMessengerThreadView thread={activeThread}/>{!activeThread.groups.some(group=>group.userId)&&<p className="hmx-empty">Keine Nachrichten</p>}</div>
            {peer.id>0&&typingUserIds.includes(peer.id)&&<div className="hmx-typing">{peer.name} schreibt …</div>}
            {sendError&&<p role="alert" className="hmx-media-error">{sendError}</p>}
            {peer.id>0 ? <MessengerMediaComposer key={peer.id} peer={peer.id} onSent={()=>{stickToBottom.current=true;}}><input aria-label={`Nachricht an ${peer.name}`} maxLength={255} placeholder={`Nachricht an ${peer.name}…`} value={messageText} onChange={event=>handleInputChange(event.target.value)} onKeyDown={event=>{event.stopPropagation();onKeyDown(event);}}/><button type="button" disabled={sending||!messageText.trim()} onClick={()=>void send()}>Senden</button></MessengerMediaComposer> : <div className="hmx-input"><input aria-label={`Nachricht an ${peer.name}`} maxLength={255} placeholder={`Nachricht an ${peer.name}…`} value={messageText} onChange={event=>handleInputChange(event.target.value)} onKeyDown={event=>{event.stopPropagation();onKeyDown(event);}}/><button type="button" disabled={sending||!messageText.trim()} onClick={()=>void send()}>Senden</button></div>}
        </section>}
    </div>,portalHost);
};
