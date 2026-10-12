import { HabbixActionIcon } from '../../../../common/HabbixActionIcon';
import { HabbixEmotePanel } from './HabbixEmotePanel';
import * as Popover from '@radix-ui/react-popover';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { ChatInputStyleSelectorViewProps } from './ChatInputStyleSelectorView';
import { HabbixNametagEditor } from './HabbixNametagEditor';

import bubblesIcon from '../../../../assets/images/chat/styles-icon.png';
import emotesIcon from '../../../../assets/images/catalog/air/bundle-star.png';
import heartIcon from '../../../../assets/images/icons/sign-heart.png';
import tagIcon from '../../../../assets/images/achievements/achievement_active.png';
import backIcon from '../../../../assets/images/avatar-menu/air/arrow-left.png';
import './HabbixChatOptions.css';

const altcodes=[['☻',7],['♪',134],['⭕',135],['?',145],['♫',151],['™',153],['£',156],['Ø',157],['♥',159],['⚡',167],['¿',168],['®',169],['¡',173],['«',175],['☕',230],['█',241],['▲',245],['☁',246],['€',271],['☀',276],['☠',422],['♦',485],['★',555],['★',556],['ø',667],['‹',907],['☠',9998]] as const;
type Panel='menu'|'Chat Bubbles'|'Emotes'|'Altcodes';
export function HabbixChatOptions({styles,insert,shout=false,onShoutChange}:{styles:ChatInputStyleSelectorViewProps;insert:(text:string)=>void;shout?:boolean;onShoutChange?:(value:boolean)=>void}) {
 const [open,setOpen]=useState(false),[panel,setPanel]=useState<Panel>('menu'),[tab,setTab]=useState('Shop'),[editor,setEditor]=useState(false);
 const [purchase,setPurchase]=useState<any>(null),[buying,setBuying]=useState<number>(null),[notice,setNotice]=useState('');

 useEffect(()=>{if(buying!==null&&styles.ownedStyleIds?.includes(buying)){setBuying(null);setPurchase(null);setNotice('Gekauft. Du findest die Sprechblase unter „Meine“.');}},[styles.ownedStyleIds,buying]);
 useEffect(()=>{if(buying===null)return;const timer=setTimeout(()=>{setBuying(null);setNotice('Bitte prüfe die Servermeldung im Chat.');},12000);return()=>clearTimeout(timer);},[buying]);
 const changeOpen=(value:boolean)=>{setOpen(value);if(!value){setPanel('menu');if(buying===null){setPurchase(null);setNotice('');}}};
 const choose=(id:number)=>{styles.selectChatStyleId(id);changeOpen(false);};
 const bubble=(id:number)=><span className="hco-bubble-preview bubble-container"><span className={`chat-bubble bubble-${id}`}/></span>;

 return <><Popover.Root open={open} onOpenChange={changeOpen}><Popover.Trigger asChild><button type="button" className="habbix-chat-options-trigger" aria-label="Chatoptionen" title="Chatoptionen"><HabbixActionIcon kind="options"/></button></Popover.Trigger><Popover.Portal><Popover.Content side="top" align="end" sideOffset={8} className={`hco-menu ${panel==='menu'?'hco-root':'hco-panel'}`} onCloseAutoFocus={e=>e.preventDefault()}>
 {panel==='menu'?<nav aria-label="Chatoptionen">{[['Chat Bubbles',bubblesIcon],['Emotes',emotesIcon],['Altcodes',heartIcon],['Nametag',tagIcon]].map(([title,icon])=><button type="button" className="hco-menu-entry" key={title} onClick={()=>{if(title==='Nametag'){changeOpen(false);setEditor(true);}else setPanel(title as Panel);}}><span><img src={icon} alt=""/></span>{title}</button>)}{onShoutChange&&<button type="button" className="hco-shout-toggle" role="switch" aria-checked={shout} onClick={()=>onShoutChange(!shout)}><HabbixActionIcon kind="speaker"/><span>Laut sprechen<small>Auch mit Umschalt + Enter</small></span><i aria-hidden="true"/></button>}</nav>:<><header className="hco-header"><button type="button" aria-label="Zurück zu den Chatoptionen" onClick={()=>{setPanel('menu');setPurchase(null);setNotice('');}}><img src={backIcon} alt=""/></button><strong>{panel}</strong></header>
 {panel==='Chat Bubbles'&&<><nav className="hco-tabs" aria-label="Sprechblasen">{['Shop','Meine'].map(value=><button type="button" key={value} aria-pressed={tab===value} onClick={()=>{setTab(value);setPurchase(null);setNotice('');}}>{value}</button>)}</nav><div className="hco-bubbles">{tab==='Meine'?(styles.chatStyleIds||[]).map(id=><button type="button" key={id} aria-label={`Sprechblase ${id} verwenden`} aria-pressed={styles.chatStyleId===id} onClick={()=>choose(id)}>{bubble(id)}</button>):(styles.shopStyles||[]).map(style=>{const id=Number(style.styleId),owned=styles.chatStyleIds?.includes(id)||styles.ownedStyleIds?.includes(id);return <button type="button" key={id} disabled={buying!==null} aria-label={`Sprechblase ${id}, ${owned?'verfügbar':`${Number(style.price)||0} Taler`}`} onClick={()=>{if(styles.chatStyleIds?.includes(id))choose(id);else setPurchase(style);}}>{bubble(id)}<small>{owned?'Verfügbar':(Number(style.price)||0).toLocaleString('de-DE')}</small></button>;})}</div>{!(tab==='Meine'?styles.chatStyleIds?.length:styles.shopStyles?.length)&&<p className="hco-empty">Keine Sprechblasen verfügbar.</p>}{purchase&&<div className="hco-purchase"><p>Sprechblase {purchase.styleId} für {(Number(purchase.price)||0).toLocaleString('de-DE')} Taler kaufen?</p><button type="button" disabled={buying!==null||!styles.buyStyle} onClick={()=>{const id=Number(purchase.styleId);setBuying(id);setNotice('Kauf wird vom Emulator geprüft …');styles.buyStyle?.(id);}}>Kaufen</button><button type="button" disabled={buying!==null} onClick={()=>setPurchase(null)}>Abbrechen</button></div>}{notice&&<p className="hco-notice" role="status">{notice}</p>}</>}
 {panel==='Emotes'&&<HabbixEmotePanel insert={insert} close={()=>changeOpen(false)}/>}
 {panel==='Altcodes'&&<div className="hco-altcodes">{altcodes.map(([symbol,code])=><button type="button" key={code} aria-label={`${symbol}, Altcode ${code}, einfügen`} onClick={()=>{insert(symbol);changeOpen(false);}}><span>{symbol}</span><small>{code}</small></button>)}</div>}</>}
 </Popover.Content></Popover.Portal></Popover.Root>{editor&&createPortal(<HabbixNametagEditor onClose={()=>setEditor(false)}/>,document.body)}</>;
}
