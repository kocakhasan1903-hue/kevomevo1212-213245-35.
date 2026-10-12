import { motion, useReducedMotion } from 'framer-motion';
import { FC, useEffect, useRef } from 'react';
import { NotificationBubbleItem, OpenMessengerChat } from '../../../../api';
import { LayoutAvatarImageView } from '../../../../common';
import { useFriends } from '../../../../hooks';

interface NotificationFriendOnlineBubbleViewProps { item: NotificationBubbleItem; onClose: () => void; }

export const NotificationFriendOnlineBubbleView: FC<NotificationFriendOnlineBubbleViewProps> = ({item,onClose}) => {
    const close = useRef(onClose); close.current = onClose;
    const reduced = useReducedMotion();
    const { getFriend } = useFriends();
    const friendId = Number((item?.linkUrl || '').split('/').pop());
    const friend = friendId > 0 ? getFriend?.(friendId) : null;
    useEffect(() => { const timer = setTimeout(() => close.current?.(), 8000); return () => clearTimeout(timer); }, []);
    const open = () => { if(friendId > 0) OpenMessengerChat(friendId); onClose?.(); };
    return <motion.aside className="habbix-friend-online-card" role="status" initial={{opacity:0,y:reduced?0:4}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:0.2}}>
        <button type="button" className="habbix-friend-online-open" aria-label={`Nachricht senden: ${friend?.name || item.message}`} onClick={open}>
            <span className="habbix-friend-online-avatar">{(friend?.figure || item.iconUrl) && <LayoutAvatarImageView figure={friend?.figure || item.iconUrl} headOnly nativeCroppedHead direction={2}/>}<i aria-hidden="true"/></span>
            <span className="habbix-friend-online-copy"><small>HABBO ONLINE</small><strong>{friend?.name || item.message}</strong><span>{friend ? 'ist jetzt online · Nachricht senden' : 'Nachricht senden'}</span></span>
        </button>
        <button type="button" className="habbix-friend-online-close" aria-label="Online-Hinweis schließen" onClick={()=>onClose?.()}>×</button>
    </motion.aside>;
};