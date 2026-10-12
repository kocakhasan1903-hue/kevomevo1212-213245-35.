import { parseGiphyMessage } from '../giphy/giphy';
import { useEffect, useRef, useState } from 'react';
import { MessengerThreadChat, OpenMessengerChat } from '../../api';
import { useMessenger } from '../../hooks';
import { RightRailSlot } from '../right-side/RightNoticeRail';

type Notice={id:number;peer:number;name:string;preview:string};

/** Receipts and history updates never create another notification for the same line. */
export function MessengerNotificationView(){
    const {messageThreads=[],activeThread=null}=useMessenger();
    const mountedAt=useRef(Date.now());
    const seen=useRef(new Set<number>());
    const [notice,setNotice]=useState<Notice|null>(null);
    useEffect(()=>{
        let latest:Notice|null=null;
        const present=new Set<number>();
        for(const thread of messageThreads){
            for(const group of thread.groups)for(const chat of group.chats){
                present.add(chat.id);
                if(seen.current.has(chat.id)||chat.type!==MessengerThreadChat.CHAT||thread.participant.id<=0||chat.senderId!==thread.participant.id||!thread.unreadCount||chat.date.getTime()<mountedAt.current)continue;
                const open=activeThread?.threadId===thread.threadId&&document.getElementById('habbix-friends-chat-host')?.dataset.panel==='chat'&&document.visibilityState==='visible'&&document.hasFocus();
                if(open)continue;
                const preview=parseGiphyMessage(chat.message)?'GIF-Nachricht':chat.message.startsWith('habbix-media:')?(chat.message.includes(':audio:')?'Sprachnachricht':'GIF-Nachricht'):chat.message;
                latest={id:chat.id,peer:thread.participant.id,name:thread.participant.name,preview};
            }
        }
        seen.current=present;
        if(latest)setNotice(latest);
        else setNotice(current=>current&&messageThreads.some(thread=>thread.participant.id===current.peer&&thread.unreadCount>0)?current:null);
    },[messageThreads,activeThread]);
    useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),6500);return()=>clearTimeout(timer);},[notice]);
    if(!notice)return null;
    return <RightRailSlot slot="messages"><aside className="habbix-message-notice" key={notice.id} aria-label="Neue private Nachricht" role="status">
        <button type="button" className="habbix-message-notice-open" aria-label={`Nachricht von ${notice.name} öffnen`} onClick={()=>{OpenMessengerChat(notice.peer);setNotice(null);}}>
            <small>Neue Nachricht</small><strong>{notice.name}</strong><span>{notice.preview}</span>
        </button>
        <button type="button" className="habbix-message-notice-close" aria-label="Nachrichtenhinweis schließen" onClick={()=>setNotice(null)}>×</button>
    </aside></RightRailSlot>;
}
