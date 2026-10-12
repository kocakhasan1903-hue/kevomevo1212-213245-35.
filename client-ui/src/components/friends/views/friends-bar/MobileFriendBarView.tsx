import { MessengerFriend, OpenMessengerChat, CreateLinkEvent } from '../../../../api';
import { LayoutAvatarImageView } from '../../../../common';
import { isStaffChatIdentity } from '../../staffChatIdentity';

export function MobileFriendBarView({ onlineFriends }: { onlineFriends: MessengerFriend[] }) {
    const friends = onlineFriends.filter(friend => friend && !isStaffChatIdentity(friend));
    return <div className="habbix-mobile-friend-scroll" aria-label={`${friends.length} Freunde online`}>
        {friends.length ? friends.map(friend => <button type="button" key={friend.id} className="habbix-mobile-friend" onClick={() => OpenMessengerChat(friend.id)} aria-label={`Chat mit ${friend.name} öffnen`}>
            <span className="habbix-mobile-friend-avatar"><LayoutAvatarImageView figure={friend.figure} direction={2} headOnly nativeCroppedHead/><i aria-hidden="true"/></span><span>{friend.name}<small>Online</small></span>
        </button>) : <button type="button" className="habbix-mobile-friends-empty" onClick={() => CreateLinkEvent('friends/list')}>Keine Freunde online <small>Freundesliste öffnen</small></button>}
    </div>;
}
