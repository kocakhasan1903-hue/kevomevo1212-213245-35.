import nativeChat from '../assets/images/toolbar/air/messenger.png';
import nativeMic from '../assets/images/chat/voice-microphone.png';
import nativeStop from '../assets/images/chat/voice-stop.png';
import nativeSpeaker from '../assets/images/chat/voice-speak.png';
import nativeSend from '../assets/images/friends/swf/send_messenger_message.png';
import nativeOptions from '../assets/images/chat/styles-icon.png';

const icons = {chat:nativeChat,microphone:nativeMic,stop:nativeStop,speaker:nativeSpeaker,send:nativeSend,paperplane:nativeSend,options:nativeOptions};
const artwork = {send:[send,'340 348 576 560'],gif:[gif,'388 420 480 408'],speaker:[speaker,'308 420 664 568'],microphone:[microphone,'436 412 376 528'],chat:[chat,'228 308 800 696'],stop:[stop,'412 420 424 408'],paperplane:[paperplane,'396 404 464 456'],options:[options,'0 0 24 24']} as const;

/** Retain the owner's desktop artwork; touch controls use small native assets. */
export function HabbixActionIcon({ kind }: { kind: keyof typeof icons | 'gif' }) {
    const mobile=useMobileClient();
    if(!mobile){const[src,viewBox]=artwork[kind];const size=kind==='options'?24:1254;return <svg className={`habbix-action-art habbix-action-art--${kind}`} viewBox={viewBox} aria-hidden="true" focusable="false"><image href={src} width={size} height={size}/></svg>;}
    if (kind === 'gif') return <span className="habbix-native-gif" aria-hidden="true">GIF</span>;
    return <img className={`habbix-action-art habbix-native-action habbix-action-art--${kind}`} src={icons[kind]} alt="" aria-hidden="true"/>;
}
import send from '../assets/images/habbix-actions/send.png';
import gif from '../assets/images/habbix-actions/gif.png';
import speaker from '../assets/images/habbix-actions/speaker.png';
import microphone from '../assets/images/habbix-actions/microphone.png';
import chat from '../assets/images/habbix-actions/chat.png';
import stop from '../assets/images/habbix-actions/stop.png';
import paperplane from '../assets/images/habbix-actions/paperplane.png';
import options from '../assets/images/habbix-actions/options.png';
import { useMobileClient } from '../hooks/useMobileClient';
