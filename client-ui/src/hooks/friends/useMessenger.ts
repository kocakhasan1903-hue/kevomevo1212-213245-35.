import { parseGiphyMessage } from '../../components/giphy/giphy';
import { DirectMessage, directChatRequest, startDirectChat, isDirectChatReady } from './directChatTransport';
import {
    AuthenticatedEvent,
    ConsoleReadReceiptEvent,
    ConsoleTypingComposer,
    FriendIsTypingEvent,
    FriendListUpdateEvent,
    GetSessionDataManager,
    InstantMessageErrorEvent,
    MarkConsoleReadComposer,
    MessengerMessageAckEvent,
    MessengerMessageEvent,
    MessengerMessageFailedEvent,
    MessengerMessageType,
    NewConsoleMessageEvent,
    RoomInviteErrorEvent,
    RoomInviteEvent,
    SendMessageComposer as SendMessageComposerPacket,
    SendMessengerMessageComposer
} from '@octane/renderer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { registerSharedHook, useSharedHook } from '@/state/useSharedHook';
import {
    CloneObject,
    getInstantMessageErrorTextKey,
    LocalizeText,
    localizeWithFallback,
    MessengerIconState,
    MessengerThread,
    MessengerThreadChat,
    NotificationAlertType,
    PlaySound,
    SendMessageComposer,
    SoundNames,
    selectMessages,
    selectMessengerIconState
} from '../../api';
import { useMessageEvent } from '../events';
import { useNotification } from '../notification';
import { IResolvedTranslation, useTranslation } from '../translation';
import { useMessengerHistory, useMessengerRealtime } from './messenger';
import { useFriends } from './useFriends';

const useMessengerState = () => {
    // Still load-bearing after FriendsPersistentMessengerView was removed: the realtime
    // store drives the messenger icon state and history prefetch for the SWF window.
    const persistentState = useMessengerRealtime();
    const persistentHistory = useMessengerHistory();
    const [messageThreads, setMessageThreads] = useState<MessengerThread[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<number>(-1);
    const [hiddenThreadIds, setHiddenThreadIds] = useState<number[]>([]);
    const [iconState, setIconState] = useState<number>(MessengerIconState.HIDDEN);
    const { getFriend = null, friends = [] } = useFriends();
    const { simpleAlert = null } = useNotification();
    const { settings, translateIncoming } = useTranslation();

    const [typingUserIds, setTypingUserIds] = useState<number[]>([]);
    const typingTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
    const habbiconConfirmationId = useRef(0);
    const pendingHabbicons = useRef(new Map<number, { thread: MessengerThread; id: number; timer: ReturnType<typeof setTimeout> }>());
    const historyMessageIdsRef = useRef<Map<number, Set<number>>>(new Map());
    const hiddenThreadIdsRef = useRef(hiddenThreadIds);

    const messageThreadsRef = useRef(messageThreads);
    messageThreadsRef.current = messageThreads;
    hiddenThreadIdsRef.current = hiddenThreadIds;

    const directDeliveryPending = useRef(new Set<string>());
    const directReceiver = useRef<(messages: DirectMessage[]) => void>(null);
    directReceiver.current = incoming => {
        const ownId = GetSessionDataManager().userId;
        const accepted = incoming.filter(message => {
            const peer = message.sender === ownId ? message.recipient : message.sender;
            return (message.sender === ownId || message.recipient === ownId) && !!(messageThreadsRef.current.find(thread => thread.participant.id === peer) || getMessageThread(peer));
        });
        setMessageThreads(previous => {
            const next = [...previous];
            for(const message of accepted){
                const peer = message.sender === ownId ? message.recipient : message.sender;
                const index = next.findIndex(thread => thread.participant.id === peer);
                if(index < 0) continue;
                const thread = CloneObject(next[index]);
                let chat = thread.groups.flatMap(group => group.chats).find(chat => chat.extraData === `dm:${message.id}`);
                if(!chat){
                    const value = message.mime ? `habbix-media:${message.id}:${message.mime.startsWith('audio/') ? 'audio' : 'gif'}:${message.duration}` : message.body;
                    chat = thread.addMessage(message.sender, value, Math.max(0, (Date.now()-message.created)/1000), `dm:${message.id}`, MessengerThreadChat.CHAT, message.sender !== ownId && !message.read);
                }
                if(chat) chat.setStatus(message.read ? MessengerThreadChat.READ : message.delivered ? MessengerThreadChat.DELIVERED : MessengerThreadChat.SENT);
                next[index] = thread;
            }
            return next;
        });
        const ids=accepted.filter(m=>m.sender!==ownId&&!m.delivered&&!directDeliveryPending.current.has(m.id)).map(m=>m.id);
        if(ids.length){ids.forEach(id=>directDeliveryPending.current.add(id));void directChatRequest('dmDelivered',{ids}).catch(()=>ids.forEach(id=>directDeliveryPending.current.delete(id)));}
    };
    useEffect(() => startDirectChat(messages => directReceiver.current?.(messages)), []);
    useEffect(() => { if(isDirectChatReady())void directChatRequest('dmHistory').catch(()=>{}); }, [friends]);

    const visibleThreads = useMemo(() => messageThreads.filter((thread) => hiddenThreadIds.indexOf(thread.threadId) === -1), [messageThreads, hiddenThreadIds]);
    const activeThread = useMemo<MessengerThread | null>(
        () => activeThreadId > 0 ? visibleThreads.find((thread) => thread.threadId === activeThreadId) ?? null : null,
        [activeThreadId, visibleThreads]
    );

    const getMessageThread = (userId: number) => {
        let thread = messageThreadsRef.current.find((thread) => thread.participant && thread.participant.id === userId);

        if (!thread) {
            const friend = getFriend(userId);

            if (!friend) return null;

            thread = new MessengerThread(friend);

            thread.addMessage(null, LocalizeText('messenger.moderationinfo'), 0, null, MessengerThreadChat.SECURITY_NOTIFICATION);

            thread.setRead();

            messageThreadsRef.current = [...messageThreadsRef.current, thread];
            setMessageThreads((prevValue) => (prevValue.some((existing) => existing.threadId === thread.threadId) ? prevValue : [...prevValue, thread]));
        } else {
            const hiddenIndex = hiddenThreadIdsRef.current.indexOf(thread.threadId);

            if (hiddenIndex >= 0) {
                setHiddenThreadIds((prevValue) => {
                    const newValue = [...prevValue];

                    newValue.splice(hiddenIndex, 1);

                    return newValue;
                });
            }
        }

        return thread;
    };

    const closeThread = (threadId: number) => {
        setHiddenThreadIds((prevValue) => {
            const newValue = [...prevValue];

            if (newValue.indexOf(threadId) >= 0) return prevValue;

            newValue.push(threadId);

            return newValue;
        });

        if (activeThreadId === threadId) setActiveThreadId(-1);
    };

    const sendMessage = (
        thread: MessengerThread,
        senderId: number,
        messageText: string,
        secondsSinceSent: number = 0,
        extraData: string = null,
        messageType: number = MessengerThreadChat.CHAT,
        translation: IResolvedTranslation = null
    ) => {
        if (!thread || !messageText || !messageText.length) return;

        const ownMessage = senderId === GetSessionDataManager().userId;

        if (ownMessage && messageType === MessengerThreadChat.CHAT && messageText.length <= 255)
            SendMessageComposer(new SendMessageComposerPacket(thread.participant.id, messageText));

        let addedChatId = -1;

        setMessageThreads((prevValue) => {
            const newValue = [...prevValue];
            const index = newValue.findIndex((newThread) => newThread.threadId === thread.threadId);

            if (index === -1) return prevValue;

            thread = CloneObject(newValue[index]);

            if (ownMessage && thread.groups.length === 1) PlaySound(SoundNames.MESSENGER_NEW_THREAD);

            const isNotification = messageType === MessengerThreadChat.ROOM_INVITE || messageType === MessengerThreadChat.STATUS_NOTIFICATION;
            const addedChat = thread.addMessage(isNotification ? null : senderId, messageText, secondsSinceSent, extraData, messageType, !ownMessage && messageType !== MessengerThreadChat.STATUS_NOTIFICATION);

            addedChatId = addedChat?.id || -1;

            if (translation && messageType === MessengerThreadChat.CHAT)
                addedChat?.setTranslation(translation.originalText, translation.translatedText, translation.detectedLanguage, translation.targetLanguage);

            newValue[index] = thread;

            if (!ownMessage && messageType !== MessengerThreadChat.STATUS_NOTIFICATION && thread.unread) PlaySound(SoundNames.MESSENGER_MESSAGE_RECEIVED);

            return newValue;
        });

        const canTranslateMessage = !parseGiphyMessage(messageText) && !translation && settings.enabled && messageType === MessengerThreadChat.CHAT && !!messageText?.trim().length;

        if (!canTranslateMessage || addedChatId <= 0) return;

        void translateIncoming(messageText).then((translation) => {
            if (!translation) return;

            setMessageThreads((prevValue) => {
                const newValue = [...prevValue];
                const index = newValue.findIndex((newThread) => newThread.threadId === thread.threadId);

                if (index === -1) return prevValue;

                const clonedThread = CloneObject(newValue[index]);
                const chat = clonedThread.getChat(addedChatId);

                if (!chat) return prevValue;

                chat.setTranslation(translation.originalText, translation.translatedText, translation.detectedLanguage, translation.targetLanguage);
                newValue[index] = clonedThread;

                return newValue;
            });
        });
    };

    const sendHabbiconMessage = (thread: MessengerThread, id: number) => {
        if (!thread || id <= 0) return;

        const confirmationId = ++habbiconConfirmationId.current;
        const timer = setTimeout(() => {
            if (!pendingHabbicons.current.delete(confirmationId)) return;
            simpleAlert(localizeWithFallback('messenger.habbicon.failed', 'The Habicon could not be sent. Please try again.'));
        }, 10000);
        pendingHabbicons.current.set(confirmationId, { thread, id, timer });
        SendMessageComposer(new SendMessengerMessageComposer(0, thread.participant.id, confirmationId, MessengerMessageType.Habbicon, String(id), ''));
    };

    const noteHabbiconMessage = (conversationId: number, messageId: number) => {
        const known = historyMessageIdsRef.current.get(conversationId) ?? new Set<number>();
        known.add(messageId);
        historyMessageIdsRef.current.set(conversationId, known);
    };

    useMessageEvent<AuthenticatedEvent>(AuthenticatedEvent, () => {
        for (const pending of pendingHabbicons.current.values()) clearTimeout(pending.timer);
        pendingHabbicons.current.clear();
    });

    useMessageEvent<MessengerMessageAckEvent>(MessengerMessageAckEvent, (event) => {
        const parser = event.getParser();
        const pending = pendingHabbicons.current.get(parser.confirmationId);
        if (!pending) return;

        clearTimeout(pending.timer);
        pendingHabbicons.current.delete(parser.confirmationId);
        noteHabbiconMessage(parser.conversationId, parser.messageId);
        sendMessage(pending.thread, GetSessionDataManager().userId, String(pending.id), 0, null, MessengerMessageType.Habbicon);
    });

    useMessageEvent<MessengerMessageFailedEvent>(MessengerMessageFailedEvent, (event) => {
        const parser = event.getParser();
        const pending = pendingHabbicons.current.get(parser.confirmationId);
        if (!pending) return;

        clearTimeout(pending.timer);
        pendingHabbicons.current.delete(parser.confirmationId);
        simpleAlert(localizeWithFallback('messenger.habbicon.failed', 'The Habicon could not be sent. Please try again.'));
    });

    useMessageEvent<MessengerMessageEvent>(MessengerMessageEvent, (event) => {
        const message = event.getParser().message;
        if (message.type !== MessengerMessageType.Habbicon) return;

        const thread = getMessageThread(message.senderId);
        if (!thread) return;

        noteHabbiconMessage(message.conversationId, message.id);
        sendMessage(thread, message.senderId, message.message, 0, message.metadata, MessengerMessageType.Habbicon);
    });

    useEffect(
        () => () => {
            for (const pending of pendingHabbicons.current.values()) clearTimeout(pending.timer);
            pendingHabbicons.current.clear();
        },
        []
    );

    const sendTypingStatus = (peerId: number, isTyping: boolean) => {
        if (!peerId || peerId <= 0) return;

        SendMessageComposer(new ConsoleTypingComposer(peerId, isTyping));
    };

    useMessageEvent<NewConsoleMessageEvent>(NewConsoleMessageEvent, (event) => {
        const parser = event.getParser();
        const thread = getMessageThread(parser.senderId);

        if (!thread) return;

        if (parser.extraData === 'offline-sent') {
            sendMessage(thread, null, LocalizeText('messenger.notification.persisted_message_sent'), 0, null, MessengerThreadChat.STATUS_NOTIFICATION);
            return;
        }

        sendMessage(thread, parser.senderId, parser.messageText, parser.secondsSinceSent, parser.extraData);
    });

    // The server refused a console message (muted, flood, not a friend): the line was added
    // optimistically, so mark it as not sent and say why, as Flash does.
    useMessageEvent<InstantMessageErrorEvent>(InstantMessageErrorEvent, (event) => {
        const parser = event.getParser();
        const errorText = LocalizeText(getInstantMessageErrorTextKey(parser.errorCode));
        const ownUserId = GetSessionDataManager().userId;

        setMessageThreads((prevValue) => {
            const index = prevValue.findIndex((thread) => thread.participant && thread.participant.id === parser.userId);

            if (index === -1) return prevValue;

            const newValue = [...prevValue];
            const thread = CloneObject(newValue[index]);

            thread.markOwnMessageFailed(ownUserId, parser.message, errorText);
            thread.addMessage(null, errorText, 0, null, MessengerThreadChat.STATUS_NOTIFICATION);

            newValue[index] = thread;

            return newValue;
        });
    });

    useMessageEvent<FriendListUpdateEvent>(FriendListUpdateEvent, (event) => {
        const parser = event.getParser();

        if (!parser.updatedFriends.length) return;

        setMessageThreads((prevValue) => {
            const newValue = [...prevValue];
            let changed = false;

            for (const updatedFriend of parser.updatedFriends) {
                const index = newValue.findIndex((thread) => thread.participant?.id === updatedFriend.id);

                if (index === -1) continue;

                const thread = CloneObject(newValue[index]);
                const wasOnline = thread.participant.online;

                thread.participant.online = updatedFriend.online;

                if (wasOnline !== updatedFriend.online && hiddenThreadIdsRef.current.indexOf(thread.threadId) === -1) {
                    thread.addMessage(
                        null,
                        LocalizeText(updatedFriend.online ? 'messenger.notification.online' : 'messenger.notification.offline'),
                        0,
                        null,
                        MessengerThreadChat.STATUS_NOTIFICATION
                    );

                }

                newValue[index] = thread;
                changed = true;
            }

            return changed ? newValue : prevValue;
        });
    });

    useEffect(() => {
        for(const conversationId of persistentState.conversationIds){
            const conversation=persistentState.conversationsById[conversationId];
            if(conversation?.type!==0 || conversation.participantId<=0)continue;
            if(!messageThreadsRef.current.some(thread=>thread.participant?.id===conversation.participantId))getMessageThread(conversation.participantId);
        }
    }, [persistentState.conversationIds,persistentState.conversationsById,getFriend]);

    useEffect(() => {
        for (const thread of messageThreads) {
            const participantId = thread.participant?.id ?? 0;
            if (participantId <= 0) continue;

            const conversation = persistentState.conversationIds
                .map((conversationId) => persistentState.conversationsById[conversationId])
                .find((candidate) => candidate?.type === 0 && candidate.participantId === participantId);

            if (conversation?.id > 0) persistentHistory.loadInitial(conversation.id);
        }
    }, [messageThreads, persistentHistory, persistentState.conversationIds, persistentState.conversationsById]);

    useEffect(() => {
        const now = Math.floor(Date.now() / 1000);

        setMessageThreads((previousThreads) => {
            let changed = false;
            const nextThreads = [...previousThreads];

            for (let index = 0; index < nextThreads.length; index++) {
                const currentThread = nextThreads[index];
                const participantId = currentThread.participant?.id ?? 0;
                if (participantId <= 0) continue;

                const conversation = persistentState.conversationIds
                    .map((conversationId) => persistentState.conversationsById[conversationId])
                    .find((candidate) => candidate?.type === 0 && candidate.participantId === participantId);
                if (!conversation || !persistentState.historyByConversation[conversation.id]?.loaded) continue;

                const knownMessageIds = historyMessageIdsRef.current.get(conversation.id) ?? new Set<number>();
                const historyMessages = selectMessages(persistentState, conversation.id).filter(
                    (message) => message.id > 0 && !knownMessageIds.has(message.id)
                );
                if (!historyMessages.length) continue;

                const thread = CloneObject(currentThread);
                for (const message of historyMessages) {
                    // History prefetch must preserve unread live messages and cannot count old lines as newly received.
                    thread.addMessage(message.senderId, message.message, Math.max(0, now - message.createdAt), message.metadata || null, message.type, false);
                    knownMessageIds.add(message.id);
                }
                historyMessageIdsRef.current.set(conversation.id, knownMessageIds);
                nextThreads[index] = thread;
                changed = true;
            }

            return changed ? nextThreads : previousThreads;
        });
    }, [persistentState]);

    useMessageEvent<RoomInviteEvent>(RoomInviteEvent, (event) => {
        const parser = event.getParser();
        const thread = getMessageThread(parser.senderId);

        if (!thread) return;

        sendMessage(thread, parser.senderId, parser.messageText, 0, parser.roomId > 0 ? `room:${parser.roomId}` : null, MessengerThreadChat.ROOM_INVITE);
    });

    useMessageEvent<RoomInviteErrorEvent>(RoomInviteErrorEvent, (event) => {
        const parser = event.getParser();

        const names = parser.failedRecipients.map(id => getFriend(id)?.name || `User ${id}`);
        simpleAlert(
            names.length ? `Die Einladung konnte nicht an ${names.join(', ')} zugestellt werden. Die Freunde sind möglicherweise offline oder nicht erreichbar.` : 'Die Raumeinladung konnte nicht zugestellt werden. Bitte versuche es später erneut.',
            NotificationAlertType.DEFAULT,
            null,
            null,
            LocalizeText('friendlist.alert.title')
        );
    });

    useMessageEvent<FriendIsTypingEvent>(FriendIsTypingEvent, (event) => {
        const parser = event.getParser();
        const senderId = parser.senderId;

        if (senderId <= 0) return;

        const timers = typingTimersRef.current;
        const existing = timers.get(senderId);

        if (existing) {
            clearTimeout(existing);
            timers.delete(senderId);
        }

        if (parser.isTyping) {
            setTypingUserIds((prev) => (prev.indexOf(senderId) >= 0 ? prev : [...prev, senderId]));

            timers.set(
                senderId,
                setTimeout(() => {
                    typingTimersRef.current.delete(senderId);
                    setTypingUserIds((prev) => prev.filter((id) => id !== senderId));
                }, 6000)
            );
        } else {
            setTypingUserIds((prev) => prev.filter((id) => id !== senderId));
        }
    });

    useMessageEvent<ConsoleReadReceiptEvent>(ConsoleReadReceiptEvent, (event) => {
        const parser = event.getParser();
        const ownUserId = GetSessionDataManager().userId;

        setMessageThreads((prevValue) => {
            const index = prevValue.findIndex((thread) => thread.participant && thread.participant.id === parser.readerId);

            if (index === -1) return prevValue;

            const newValue = [...prevValue];

            newValue[index] = CloneObject(newValue[index]);
            for(const chat of newValue[index].groups.flatMap(group=>group.chats)){if(chat.senderId===ownUserId&&!chat.extraData?.startsWith('dm:'))chat.setStatus(MessengerThreadChat.READ);}

            return newValue;
        });
    });

    const markThreadRead = (threadId: number) => {
        if (threadId <= 0 || threadId !== activeThreadId) return;

        const activeThreadValue = messageThreadsRef.current.find((thread) => thread.threadId === threadId);
        const participantId = activeThreadValue?.participant?.id ?? 0;

        setMessageThreads((prevValue) => {
            const newValue = [...prevValue];
            const index = newValue.findIndex((newThread) => newThread.threadId === threadId);

            if (index >= 0 && newValue[index].unread) {
                newValue[index] = CloneObject(newValue[index]);
                newValue[index].setRead();
            } else return prevValue;

            return newValue;
        });

        if (participantId > 0) {
            SendMessageComposer(new MarkConsoleReadComposer(participantId));
            const ids=activeThreadValue.groups.flatMap(group=>group.chats).filter(chat=>chat.senderId===participantId&&chat.extraData?.startsWith('dm:')&&chat.status!==MessengerThreadChat.READ).map(chat=>chat.extraData.slice(3));
            if(ids.length) void directChatRequest('dmRead',{ids:ids.slice(-100)}).catch(()=>{});
        }
    };

    useEffect(() => {
        setIconState(
            selectMessengerIconState(
                persistentState,
                visibleThreads.length > 0,
                visibleThreads.some((thread) => thread.unreadCount > 0)
            )
        );
    }, [persistentState, visibleThreads]);

    return {
        messageThreads,
        unreadCount: messageThreads.reduce((sum,thread)=>sum+(thread.participant.id>0?thread.unreadCount:0),0),
        activeThread,
        iconState,
        visibleThreads,
        getMessageThread,
        setActiveThreadId,
        markThreadRead,
        closeThread,
        sendMessage,
        sendHabbiconMessage,
        typingUserIds,
        sendTypingStatus
    };
};

export const useMessenger = () => useSharedHook(useMessengerState);

registerSharedHook(useMessengerState);
