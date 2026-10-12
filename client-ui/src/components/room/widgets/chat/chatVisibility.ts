import { useSyncExternalStore } from 'react';
const key='habbix.room-chat-hidden',eventName='habbix:room-chat-visibility';
const read=()=>localStorage.getItem(key)==='true';
const subscribe=(refresh:()=>void)=>{window.addEventListener(eventName,refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener(eventName,refresh);window.removeEventListener('storage',refresh);};};
export function useRoomChatHidden(){
    const hidden=useSyncExternalStore(subscribe,read,()=>false);
    return [hidden,()=>{localStorage.setItem(key,String(!read()));window.dispatchEvent(new Event(eventName));}] as const;
}
