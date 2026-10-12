import * as Popover from '@radix-ui/react-popover';
import { FC, useEffect, useState } from 'react';
import { CHAT_TEXT_SIZES, ChatTextSize, getChatTextSizeLabel, getStoredChatTextSize, setStoredChatTextSize } from './chatTextSize';

export interface ChatInputStyleSelectorViewProps {
    triggerLabel?: string;
    chatStyleId: number;
    chatStyleIds: number[];
    selectChatStyleId: (styleId: number) => void;
    shopStyles?: any[];
    ownedStyleIds?: number[];
    buyStyle?: (styleId:number)=>void;
}

export const ChatInputStyleSelectorView: FC<ChatInputStyleSelectorViewProps> = (props) => {
    const { chatStyleId = 0, chatStyleIds = null, selectChatStyleId = null, shopStyles=[], ownedStyleIds=[], buyStyle, triggerLabel } = props;
    const [selectorVisible, setSelectorVisible] = useState(false);
    const [tab,setTab]=useState('Meine'),[buying,setBuying]=useState<number>(null),[notice,setNotice]=useState('');
    useEffect(()=>{if(buying!==null&&ownedStyleIds.includes(buying)){setBuying(null);setNotice('Sprechblase gekauft. Du kannst sie unter „Meine“ auswählen.');}},[ownedStyleIds,buying]);
    useEffect(()=>{if(buying===null)return;const timer=setTimeout(()=>{setBuying(null);setNotice('Bitte prüfe die Servermeldung im Chat.');},12000);return()=>clearTimeout(timer);},[buying]);
    const [chatTextSize, setChatTextSize] = useState<ChatTextSize>(() => getStoredChatTextSize());

    const selectStyle = (styleId: number) => {
        selectChatStyleId(styleId);
        setSelectorVisible(false);
    };

    const selectTextSize = (size: ChatTextSize) => {
        setChatTextSize(size);
        setStoredChatTextSize(size);
    };

    return (
        <Popover.Root open={selectorVisible} onOpenChange={setSelectorVisible}>
            <Popover.Trigger asChild>
                <button type="button" className={triggerLabel?'habbix-chat-option':'swf-chat-style-trigger flex items-center cursor-pointer select-none'} aria-label="Sprechblasen auswählen">
                    {triggerLabel || <>
                    <svg className="swf-chat-style-arrow shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                    <div className="swf-chat-style-icon" />
                    </>}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="top"
                    align="start"
                    sideOffset={9}
                    className="swf-chat-style-menu"
                >
                    <strong>Chat Bubbles</strong>
                    <nav className="habbix-editor-tabs">{['Shop','Meine'].map(value=><button type="button" key={value} aria-pressed={tab===value} onClick={()=>{setTab(value);setNotice('');}}>{value}</button>)}</nav>
                    <div className="swf-chat-style-menu-grid">
                        {tab==='Meine' && chatStyleIds &&
                            chatStyleIds.length > 0 &&
                            chatStyleIds.map((styleId) => (
                                <button
                                    key={styleId}
                                    type="button"
                                    aria-label={`Sprechblase ${styleId} verwenden`}
                                    className={`swf-chat-style-option ${chatStyleId === styleId ? 'is-active' : ''}`}
                                    onClick={() => selectStyle(styleId)}
                                >
                                    <span className="swf-chat-style-preview bubble-container">
                                        <span className={`chat-bubble bubble-${styleId}`} />
                                    </span>
                                </button>
                            ))}
                        {tab==='Shop'&&shopStyles.map(style=>{const id=Number(style.styleId),price=Number(style.price)||0,owned=ownedStyleIds.includes(id)||chatStyleIds?.includes(id);return <button type="button" key={id} className="swf-chat-style-option habbix-bubble-shop-item" disabled={buying!==null} title={`Sprechblase ${id}`} onClick={()=>{if(owned||price===0){if(chatStyleIds?.includes(id))selectStyle(id);return;}if(confirm(`Sprechblase ${id} für ${price.toLocaleString('de-DE')} Taler kaufen?`)){setBuying(id);setNotice('Kauf wird vom Emulator geprüft …');buyStyle?.(id);}}}><span className="swf-chat-style-preview bubble-container"><span className={`chat-bubble bubble-${id}`}/></span><small>{owned?'Verfügbar':price===0?'Kostenlos':`${price.toLocaleString('de-DE')} Taler`}</small></button>})}
                        {tab==='Shop'&&!shopStyles.length&&<p>Aktuell keine Sprechblasen im Shop.</p>}
                    </div>
                    {notice&&<p role="status">{notice}</p>}
                    <div className="swf-chat-font-row">
                        <span className="swf-chat-font-label">Schriftgröße</span>
                        {CHAT_TEXT_SIZES.map((size) => (
                            <button
                                key={size}
                                type="button"
                                className={`swf-chat-font-option ${chatTextSize === size ? 'is-active' : ''}`}
                                onClick={() => selectTextSize(size)}
                            >
                                {getChatTextSizeLabel(size)}
                            </button>
                        ))}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};
