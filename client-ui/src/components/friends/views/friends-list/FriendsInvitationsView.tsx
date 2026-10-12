import { FC, useState } from 'react';
import { MessengerThreadChat, OpenMessengerChat, CreateLinkEvent } from '../../../../api';
import { LayoutAvatarImageView } from '../../../../common';
import { useFriends, useMessenger } from '../../../../hooks';
import { resolveAvatarFigure } from './resolveAvatarFigure';

export const FriendsInvitationsView: FC = () => {
    const { messageThreads = [] } = useMessenger();
    const { getFriend, followFriend } = useFriends();
    const [dismissed, setDismissed] = useState<number[]>([]);
    const invitations = messageThreads.flatMap(thread => thread.groups.flatMap(group => group.chats
        .filter(chat => chat.type === MessengerThreadChat.ROOM_INVITE && !dismissed.includes(chat.id))
        .map(chat => ({ chat, sender: thread.participant }))))
        .sort((a, b) => b.chat.date.getTime() - a.chat.date.getTime());

    return <section className="hri-inbox" aria-label="Empfangene Einladungen">
        <h3>Einladungen <span>{invitations.length}</span></h3>
        {!invitations.length && <p className="hri-inbox-empty">Keine Einladungen gefunden</p>}
        {invitations.map(({ chat, sender }) => {
            const friend = getFriend(sender.id);
            const canFollow = friend?.online && friend.followingAllowed;
            return <article className="hri-invitation" key={chat.id}>
                <header><span className="hri-avatar"><LayoutAvatarImageView figure={resolveAvatarFigure(friend?.figure || sender.figure, sender.gender)} headOnly nativeCroppedHead direction={2}/></span><strong>{sender.name}</strong><time dateTime={chat.date.toISOString()}>{chat.date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time><button type="button" aria-label={`Einladung von ${sender.name} ausblenden`} onClick={() => setDismissed(current => [...current, chat.id])}>×</button></header>
                <p>{chat.message}</p>
                <footer><button type="button" className="hri-primary" disabled={!chat.invitedRoomId && !canFollow} title={chat.invitedRoomId ? `Raum #${chat.invitedRoomId} betreten` : canFollow ? 'Zum aktuellen Raum des Freundes' : 'Der Freund ist offline oder erlaubt kein Folgen'} onClick={() => { if (chat.invitedRoomId) CreateLinkEvent(`navigator/goto/${chat.invitedRoomId}`); else if (canFollow) followFriend(friend); }}>{chat.invitedRoomId ? 'Raum betreten' : 'Zum Freund'}</button><button type="button" onClick={() => OpenMessengerChat(sender.id)}>Chat öffnen</button></footer>
            </article>;
        })}
    </section>;
};
