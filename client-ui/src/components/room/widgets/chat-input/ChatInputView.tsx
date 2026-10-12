import { CreateLinkEvent, GetSessionDataManager, HabboClubLevelEnum, SecurityLevel } from '@octane/renderer';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChatMessageTypeEnum, GetClubMemberLevel, GetConfigurationValue, HasSessionPermission, LocalizeText, RoomWidgetUpdateChatInputContentEvent } from '../../../../api';
import { Text } from '../../../../common';
import { useChatCommandSelector, useChatInputWidget, useChatMentions, useRoom, useSessionInfo, useUiEvent } from '../../../../hooks';
import { RoomChatBar } from './RoomChatBar';
import { ChatInputCommandSelectorView } from './ChatInputCommandSelectorView';
import { ROOM_VOICE_REPLY, useRoomVoice } from '../../../../hooks/rooms/widgets/useRoomVoice';
import { ChatModeNotice, RoomVoiceControls } from './RoomVoiceControls';
import { HabbixChatOptions } from './HabbixChatOptions';
import { ChatInputMentionSelectorView } from './ChatInputMentionSelectorView';

export const ChatInputView: FC<{}> = (props) => {
    const [chatValue, setChatValue] = useState<string>('');
    const [portalTarget, setPortalTarget] = useState<HTMLElement>(null);
    const { chatStyleId = 0, ownedChatStyleIds = [], updateChatStyleId = null } = useSessionInfo();
    const {
        selectedUsername = '',
        floodBlocked = false,
        floodBlockedSeconds = 0,
        setIsTyping = null,
        setIsIdle = null,
        sendChat = null
    } = useChatInputWidget();
    const { roomSession = null } = useRoom();
    const [shoutMode, setShoutMode] = useState(false);
    const [shiftHeld, setShiftHeld] = useState(false);
    const [chatNotice, setChatNotice] = useState({ message: '', title: 'Chat' });
    const closeChatNotice = useCallback(() => setChatNotice({ message: '', title: 'Chat' }), []);
    const voice = useRoomVoice(roomSession && !roomSession.isSpectator ? roomSession.roomId : 0, message => setChatNotice({ message, title: 'Hinweis' }));
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const down = (event: KeyboardEvent) => { if (event.key === 'Shift') setShiftHeld(true); };
        const up = (event: KeyboardEvent) => { if (event.key === 'Shift') setShiftHeld(false); };
        const blur = () => setShiftHeld(false);
        const reply = (event: Event) => { const username = (event as CustomEvent<{ username: string }>).detail.username; setChatValue(`@${username} `); inputRef.current?.focus(); };
        window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); window.addEventListener(ROOM_VOICE_REPLY, reply);
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener(ROOM_VOICE_REPLY, reply); };
    }, []);
    const {
        isVisible: commandSelectorVisible,
        filteredCommands,
        selectedIndex,
        setSelectedIndex,
        moveUp,
        moveDown,
        selectCurrent,
        close: closeCommandSelector
    } = useChatCommandSelector(chatValue);

    const mention = useChatMentions(chatValue, setChatValue, inputRef, commandSelectorVisible);

    const chatModeIdWhisper = useMemo(() => LocalizeText('widgets.chatinput.mode.whisper'), []);
    const chatModeIdShout = useMemo(() => LocalizeText('widgets.chatinput.mode.shout'), []);
    const chatModeIdSpeak = useMemo(() => LocalizeText('widgets.chatinput.mode.speak'), []);
    const maxChatLength = useMemo(() => GetConfigurationValue<number>('chat.input.maxlength', 100), []);

    const anotherInputHasFocus = useCallback(() => {
        const activeElement = document.activeElement;

        if (!activeElement) return false;

        if (inputRef && inputRef.current === activeElement) return false;

        if (!(activeElement instanceof HTMLInputElement) && !(activeElement instanceof HTMLTextAreaElement)) return false;

        return true;
    }, [inputRef]);

    const setInputFocus = useCallback(() => {
        inputRef.current.focus();

        inputRef.current.setSelectionRange(inputRef.current.value.length * 2, inputRef.current.value.length * 2);
    }, [inputRef]);

    const checkSpecialKeywordForInput = useCallback(() => {
        setChatValue((prevValue) => {
            if (prevValue !== chatModeIdWhisper || !selectedUsername.length) return prevValue;

            return `${prevValue} ${selectedUsername}`;
        });
    }, [selectedUsername, chatModeIdWhisper]);

    const sendChatValue = useCallback(
        (value: string, shiftKey: boolean = false) => {
            if (!value || value === '') return;

            let chatType = (shiftKey || shoutMode) ? ChatMessageTypeEnum.CHAT_SHOUT : ChatMessageTypeEnum.CHAT_DEFAULT;
            let text = value;

            const parts = text.split(' ');

            let recipientName = '';
            let append = '';

            switch (parts[0]) {
                case chatModeIdWhisper:
                    chatType = ChatMessageTypeEnum.CHAT_WHISPER;
                    recipientName = parts[1];
                    append = chatModeIdWhisper + ' ' + recipientName + ' ';

                    parts.shift();
                    parts.shift();
                    break;
                case chatModeIdShout:
                    chatType = ChatMessageTypeEnum.CHAT_SHOUT;

                    parts.shift();
                    break;
                case chatModeIdSpeak:
                    chatType = ChatMessageTypeEnum.CHAT_DEFAULT;

                    parts.shift();
                    break;
            }

            text = parts.join(' ');

            setIsTyping(false);
            setIsIdle(false);

            if (text.length <= maxChatLength) {
                if (/%CC%/g.test(encodeURIComponent(text))) {
                    setChatValue('');
                } else {
                    setChatValue('');
                    sendChat(text, chatType, recipientName, chatStyleId);
                }
            }

            setChatValue(append);
        },
        [chatModeIdWhisper, chatModeIdShout, chatModeIdSpeak, maxChatLength, chatStyleId, setIsTyping, setIsIdle, sendChat, shoutMode]
    );

    const updateChatInput = useCallback(
        (value: string) => {
            if (!value || !value.length) {
                setIsTyping(false);
            } else {
                setIsTyping(true);
                setIsIdle(true);
            }

            setChatValue(value);
        },
        [setIsTyping, setIsIdle]
    );

    const addChatEmoji = useCallback(
        (emoji: string) => {
            setChatValue((prev) => prev + emoji);
            setIsTyping(true);
            inputRef.current?.focus();
        },
        [setIsTyping, inputRef]
    );

    const onKeyDownEvent = useCallback(
        (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || voice.phase !== 'idle' || floodBlocked || !inputRef.current || anotherInputHasFocus()) return;
            if (event.target instanceof Element && event.target !== inputRef.current && event.target.closest('button,summary,select,[contenteditable="true"],[role="button"],[role="menuitem"],.hco-menu,.hcn-window')) return;

            if (document.activeElement !== inputRef.current) setInputFocus();

            if (commandSelectorVisible) {
                switch (event.key) {
                    case 'ArrowUp':
                        event.preventDefault();
                        moveUp();
                        return;
                    case 'ArrowDown':
                        event.preventDefault();
                        moveDown();
                        return;
                    case 'Tab':
                        event.preventDefault();
                    case 'NumpadEnter':
                    case 'Enter': {
                        const selected = selectCurrent();

                        if (selected) {
                            event.preventDefault();
                            setChatValue(':' + selected.key + ' ');
                            return;
                        }
                        break;
                    }
                    case 'Escape':
                        event.preventDefault();
                        closeCommandSelector();
                        return;
                }
            }

            if (mention.visible) {
                switch (event.key) {
                    case 'ArrowUp':
                        event.preventDefault();
                        mention.moveUp();
                        return;
                    case 'ArrowDown':
                        event.preventDefault();
                        mention.moveDown();
                        return;
                    case 'Tab':
                    case 'NumpadEnter':
                    case 'Enter':
                        if (mention.applyCurrent()) {
                            event.preventDefault();
                            return;
                        }
                        break;
                    case 'Escape':
                        event.preventDefault();
                        mention.cancel();
                        return;
                }
            }

            const value = inputRef.current.value;

            switch (event.key) {
                case ' ':
                case 'Space':
                    checkSpecialKeywordForInput();
                    return;
                case 'NumpadEnter':
                case 'Enter':
                    event.preventDefault();
                    sendChatValue(value, event.shiftKey);
                    return;
                case 'Backspace':
                    if (value) {
                        const parts = value.split(' ');

                        if (parts[0] === chatModeIdWhisper && parts.length === 3 && parts[2] === '') {
                            setChatValue('');
                        }
                    }
                    return;
            }
        },
        [
            floodBlocked,
            voice.phase,
            inputRef,
            chatModeIdWhisper,
            anotherInputHasFocus,
            setInputFocus,
            checkSpecialKeywordForInput,
            sendChatValue,
            commandSelectorVisible,
            moveUp,
            moveDown,
            selectCurrent,
            closeCommandSelector,
            mention,
            chatValue
        ]
    );

    useUiEvent<RoomWidgetUpdateChatInputContentEvent>(RoomWidgetUpdateChatInputContentEvent.CHAT_INPUT_CONTENT, (event) => {
        switch (event.chatMode) {
            case RoomWidgetUpdateChatInputContentEvent.TEXT:
                setChatValue(event.userName);
                inputRef.current?.focus();
                return;
            case RoomWidgetUpdateChatInputContentEvent.WHISPER: {
                setChatValue(`${chatModeIdWhisper} ${event.userName} `);
                return;
            }
            case RoomWidgetUpdateChatInputContentEvent.SHOUT:
                return;
        }
    });

    const [cmsBubbleStyles,setCmsBubbleStyles]=useState<any[]>([]);
    useEffect(()=>{let active=true;const refresh=()=>fetch('/assets/uploads/chat-bubbles.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Unavailable');return r.json();}).then(value=>{if(active&&Array.isArray(value.styles))setCmsBubbleStyles(value.styles);}).catch(()=>{});refresh();const timer=setInterval(refresh,60000);return()=>{active=false;clearInterval(timer);};},[]);
    const chatStyleIds = useMemo(() => {
        let styleIds: number[] = [];

        const styles =
            GetConfigurationValue<{ styleId: number; minRank: number; isSystemStyle: boolean; isHcOnly: boolean; isAmbassadorOnly: boolean }[]>('chat.styles');

        for (const style of styles) {
            if (!style) continue;

            if (style.minRank > 0) {
                if (GetSessionDataManager().hasSecurity(style.minRank)) styleIds.push(style.styleId);

                continue;
            }

            if (style.isSystemStyle) {
                // The server keeps these bubbles for acc_anychatcolor.
                if (HasSessionPermission('acc_anychatcolor', SecurityLevel.MODERATOR)) {
                    styleIds.push(style.styleId);

                    continue;
                }
            }

            if (GetConfigurationValue<number[]>('chat.styles.disabled').indexOf(style.styleId) >= 0) continue;

            if (style.isHcOnly && GetClubMemberLevel() >= HabboClubLevelEnum.CLUB) {
                styleIds.push(style.styleId);

                continue;
            }

            if (style.isAmbassadorOnly && GetSessionDataManager().isAmbassador) {
                styleIds.push(style.styleId);

                continue;
            }

            if (!style.isHcOnly && !style.isAmbassadorOnly) styleIds.push(style.styleId);
        }

        const configured = new Map<number,any>(cmsBubbleStyles.map(style=>[Number(style.styleId),style]));
        const permitted=(style:any)=>!!Number(style.enabled)&&GetSessionDataManager().hasSecurity(Number(style.minRank))&&(!Number(style.isHcOnly)||GetClubMemberLevel()>=HabboClubLevelEnum.CLUB)&&(!Number(style.isAmbassadorOnly)||GetSessionDataManager().isAmbassador)&&(!Number(style.isSystemStyle)||HasSessionPermission('acc_anychatcolor',SecurityLevel.MODERATOR))&&(!Number(style.price)||ownedChatStyleIds.includes(Number(style.styleId)));
        styleIds=styleIds.filter(id=>!configured.has(id)||permitted(configured.get(id)));
        for(const style of cmsBubbleStyles)if(permitted(style))styleIds.push(Number(style.styleId));
        for(const id of ownedChatStyleIds)if(!configured.has(id)||permitted(configured.get(id)))styleIds.push(id);
        return Array.from(new Set(styleIds));
    }, [cmsBubbleStyles,ownedChatStyleIds]);

    useEffect(() => {
        document.body.addEventListener('keydown', onKeyDownEvent);

        return () => {
            document.body.removeEventListener('keydown', onKeyDownEvent);
        };
    }, [onKeyDownEvent]);

    useEffect(() => {
        if (!inputRef.current) return;

        inputRef.current.parentElement.dataset.value = chatValue;
    }, [chatValue]);

    useEffect(() => {
        if (!roomSession) return;

        if (portalTarget && portalTarget.isConnected) return;

        let frame = 0;

        const locate = () => {
            const target = document.getElementById('toolbar-chat-input-container');

            if (target) {
                setPortalTarget(target);
                return;
            }

            frame = window.requestAnimationFrame(locate);
        };

        locate();

        return () => window.cancelAnimationFrame(frame);
    }, [roomSession, portalTarget]);

    if (!roomSession || roomSession.isSpectator || !portalTarget) return null;

    return createPortal(
        <RoomChatBar recording={voice.phase !== 'idle'}
            canSend={!floodBlocked && !!chatValue.trim()}
            onSend={() => { if (!floodBlocked) sendChatValue(chatValue, shiftHeld); inputRef.current?.focus(); }}
            input={!floodBlocked ? <div className="flex-1 items-center input-sizer swf-chat-input-sizer">
                <input ref={inputRef} className={'swf-chat-input-field w-full border-none bg-transparent' + ((shoutMode || shiftHeld) ? ' is-shout' : '')}
                    aria-label="Nachricht in den Raum" maxLength={maxChatLength} placeholder="Nachricht in den Raum …" type="text" value={chatValue}
                    onChange={event => updateChatInput(event.target.value)} onMouseDown={() => setInputFocus()}/>
            </div> : <div className="swf-chat-flood flex min-w-0 flex-1 items-center">
                <Text variant="danger" className="w-full truncate whitespace-nowrap text-[0.8rem] font-bold leading-none">
                    {LocalizeText('chat.input.alert.flood', ['time'], [floodBlockedSeconds.toString()])}
                </Text>
            </div>}
            voice={<RoomVoiceControls voice={voice} disabled={floodBlocked}/>}
            gif={<GiphyPicker scope="room" disabled={floodBlocked || voice.phase !== 'idle'} onSend={gif => {
                if (floodBlocked || !roomSession) throw new Error('Du kannst gerade nicht im Raum schreiben.');
                const recipient = chatValue.startsWith(chatModeIdWhisper + ' ') ? chatValue.split(' ')[1] : '';
                sendChat(giphyMessage(gif.id), recipient ? ChatMessageTypeEnum.CHAT_WHISPER : shoutMode ? ChatMessageTypeEnum.CHAT_SHOUT : ChatMessageTypeEnum.CHAT_DEFAULT, recipient, chatStyleId);
                setIsIdle(false);
            }}/>}
            options={<HabbixChatOptions insert={addChatEmoji} shout={shoutMode} onShoutChange={setShoutMode} styles={{
                chatStyleId, chatStyleIds, selectChatStyleId:updateChatStyleId, ownedStyleIds:ownedChatStyleIds,
                shopStyles:cmsBubbleStyles.filter(style=>Number(style.enabled)&&GetSessionDataManager().hasSecurity(Number(style.minRank))&&(!Number(style.isHcOnly)||GetClubMemberLevel()>=HabboClubLevelEnum.CLUB)&&(!Number(style.isAmbassadorOnly)||GetSessionDataManager().isAmbassador)&&(!Number(style.isSystemStyle)||HasSessionPermission('acc_anychatcolor',SecurityLevel.MODERATOR))),
                buyStyle:id=>sendChatValue(':buybubble '+id,false)
            }}/>}
        >
            {voice.phase === 'idle' && commandSelectorVisible && <ChatInputCommandSelectorView
                commands={filteredCommands} selectedIndex={selectedIndex}
                onSelect={cmd => { setChatValue(':' + cmd.key + ' '); inputRef.current?.focus(); }} onHover={setSelectedIndex}/>}
            {voice.phase === 'idle' && mention.visible && !commandSelectorVisible && <ChatInputMentionSelectorView
                suggestions={mention.suggestions} selectedIndex={mention.selectedIndex} onSelect={mention.apply} onHover={mention.setSelectedIndex}/>}
            <ChatModeNotice message={chatNotice.message} title={chatNotice.title} onClose={closeChatNotice}/>
        </RoomChatBar>, portalTarget
    );
};
import { GiphyPicker } from '../../../giphy/GiphyPicker';
import { giphyMessage } from '../../../giphy/giphy';
