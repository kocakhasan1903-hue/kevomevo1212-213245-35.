import { GiphyMedia } from '../../../../giphy/GiphyMedia';
import { parseGiphyMessage } from '../../../../giphy/giphy';
import { parseMessengerMedia, MessengerMediaView } from '../MessengerMediaView';
import { GetSessionDataManager, MessengerMessageType } from '@octane/renderer';
import { FC, useMemo } from 'react';
import {
    CreateLinkEvent,
    GetGroupChatData,
    LocalizeText,
    MessengerGroupType,
    MessengerThread,
    MessengerThreadChat,
    MessengerThreadChatGroup,
    useHabbiconCatalog
} from '../../../../../api';
import MessengerNotificationIcon from '../../../../../assets/images/friends/messenger_notification_icon.png';
import { LayoutAvatarImageView, LayoutHabbiconImageView, UserIdentityView } from '../../../../../common';
import { useFriends } from '../../../../../hooks';
import { resolveAvatarFigure } from '../../friends-list/resolveAvatarFigure';
import { getMessageStatusPresentation } from './messageStatus.helpers';
import { FriendsAvatarFrameView } from '../../../FriendsAvatarFrameView';

const MessengerMessageTime: FC<{ date: Date }> = ({ date }) => {
    const today=new Date().toDateString()===date.toDateString();
    return <time className="messenger-message-time" dateTime={date.toISOString()} title={date.toLocaleString('de-DE')}>{today?date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):date.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</time>;
};

export const FriendsMessengerThreadGroup: FC<{ thread: MessengerThread; group: MessengerThreadChatGroup }> = ({ thread, group }) => {
    const { getFriend = null } = useFriends();
    const habbicons = useHabbiconCatalog();
    const groupChatData = useMemo(() => group.type === MessengerGroupType.GROUP_CHAT && GetGroupChatData(group.chats[0].extraData), [group]);
    const own =
        (group.type === MessengerGroupType.PRIVATE_CHAT && group.userId === GetSessionDataManager().userId) ||
        (!!groupChatData && group.chats.length > 0 && groupChatData.userId === GetSessionDataManager().userId);

    if (!group.userId)
        return (
            <>
                {group.chats.map((chat, index) =>
                    chat.type === MessengerThreadChat.ROOM_INVITE ? (
                        <div key={index} className="messenger-notification">
                            <img src={MessengerNotificationIcon} alt="" />
                            <span>
                                {LocalizeText('messenger.invitation')} {chat.message}
                                {chat.invitedRoomId>0&&<button type="button" className="hmx-invite-room" onClick={()=>CreateLinkEvent('navigator/goto/'+chat.invitedRoomId)}>Raum betreten</button>}
                            </span>
                        </div>
                    ) : chat.type === MessengerThreadChat.STATUS_NOTIFICATION ? (
                        <div key={index} className="messenger-status-notification">
                            {chat.message}
                        </div>
                    ) : null
                )}
            </>
        );

    const friend = getFriend?.(thread.participant.id);
    const name = own ? GetSessionDataManager().userName : groupChatData?.username || thread.participant.name;
    const figure = own
        ? GetSessionDataManager().figure
        : groupChatData?.figure || resolveAvatarFigure(friend?.figure || thread.participant.figure, friend?.gender ?? thread.participant.gender);
    const renderMessage = (chat: MessengerThreadChat) => {
        const gif = parseGiphyMessage(chat.message);
        if (gif) return <GiphyMedia id={gif} scope="private"/>;
        if (chat.type === MessengerThreadChat.ROOM_INVITE) return <span className="hmx-room-invitation"><strong>Raumeinladung</strong><span>{chat.message}</span>{chat.invitedRoomId>0&&<button type="button" className="hmx-invite-room" onClick={()=>CreateLinkEvent('navigator/goto/'+chat.invitedRoomId)}>Raum betreten</button>}</span>;
        const media=chat.extraData?.startsWith('dm:') ? parseMessengerMedia(chat.message) : null;
        if(media)return <MessengerMediaView id={media.id} kind={media.kind} duration={media.duration}/>;
        if (chat.type !== MessengerMessageType.Habbicon) return chat.message;

        const id = Number(chat.message);
        const entry = habbicons.entries.find((item) => item.id === id);
        const mirror = !!entry?.dir && entry.dir !== (own ? 1 : -1);
        return <LayoutHabbiconImageView id={id} size={80} mirror={mirror} className="messenger-habbicon-message" />;
    };

    const isMedia = (chat: MessengerThreadChat) => !!parseGiphyMessage(chat.message) || (!!chat.extraData?.startsWith('dm:') && !!parseMessengerMedia(chat.message));
    const onlyMedia = group.chats.every(isMedia);

    return (
        <div className={`messenger-message-row${own ? ' own' : ''}`}>
            {!own && !onlyMedia && (
                <div className="message-avatar">
                    <FriendsAvatarFrameView name={name} figure={figure}/>
                </div>
            )}
            <div className="messenger-message-body">
                {!own&&<div className="messenger-message-name"><UserIdentityView username={name}/></div>}
                {group.chats.map(chat => <div key={chat.id} className={`messenger-message-bubble${isMedia(chat)?' hmx-media-message':''}`}>
                    {chat.failed ? <div className="messenger-message-failed" title={chat.failureText}><span className="messenger-message-failed-mark" aria-hidden="true">!</span>{renderMessage(chat)}</div> : !chat.showTranslation || isMedia(chat) ? renderMessage(chat) : <div className="messenger-translation-block"><div><b>original:</b> {chat.originalMessage || chat.message}</div><div><b>translate:</b> {chat.translatedMessage || chat.message}</div></div>}
                    <div className="hmx-message-meta"><MessengerMessageTime date={chat.date}/>{own&&!chat.failed&&<span className={getMessageStatusPresentation(chat.status).isRead?'hmx-read':'hmx-sent'} aria-label={getMessageStatusPresentation(chat.status).label}>{getMessageStatusPresentation(chat.status).ticks}</span>}</div>
                </div>)}
            </div>
            {own && !onlyMedia && (
                <div className="message-avatar">
                    <LayoutAvatarImageView direction={4} figure={figure} headOnly nativeCroppedHead />
                </div>
            )}
        </div>
    );
};
