import { FC, MouseEvent, useEffect, useRef, useState } from 'react';
import { GetUserProfile, LocalizeText, MessengerFriend, OpenMessengerChat } from '../../../../../api';
import { LayoutAvatarImageView, UserIdentityView } from '../../../../../common';
import { useFriends } from '../../../../../hooks';
import { isStaffChatIdentity } from '../../../staffChatIdentity';
import { StaffChatFrankIconView } from '../../../StaffChatFrankIconView';
import { resolveAvatarFigure } from '../resolveAvatarFigure';
import { resolveAvatarGender } from '../resolveAvatarGender';
import { canFollowFriendListEntry } from './friendsListActions.helpers';
import { useFriendAvatarStyle } from '../../../../../hooks/habbix/nametag';

export const FriendsListGroupItemView: FC<{ friend: MessengerFriend; selected: boolean; selectFriend: (userId: number) => void }> = ({
    friend,
    selected,
    selectFriend
}) => {
    const [isRelationshipOpen, setIsRelationshipOpen] = useState(false);
    const { followFriend = null, updateRelationship = null } = useFriends();
    const relationshipMenuRef = useRef<HTMLDivElement>(null);
    const avatarStyle = useFriendAvatarStyle(friend?.name || '');

    useEffect(() => {
        if (!isRelationshipOpen) return;

        const close = (event: globalThis.MouseEvent) => {
            if (!relationshipMenuRef.current?.contains(event.target as Node)) setIsRelationshipOpen(false);
        };

        window.addEventListener('mousedown', close);

        return () => window.removeEventListener('mousedown', close);
    }, [isRelationshipOpen]);

    if (!friend) return null;

    const isStaffChat = isStaffChatIdentity(friend);
    const stop = (event: MouseEvent<HTMLElement>) => event.stopPropagation();
    const relationshipName = (() => {
        switch (friend.relationshipStatus) {
            case MessengerFriend.RELATIONSHIP_HEART:
                return 'heart';
            case MessengerFriend.RELATIONSHIP_SMILE:
                return 'smile';
            case MessengerFriend.RELATIONSHIP_BOBBA:
                return 'bobba';
            default:
                return 'none';
        }
    })();

    const setRelationship = (event: MouseEvent<HTMLButtonElement>, type: number) => {
        stop(event);
        updateRelationship(friend, type);
        setIsRelationshipOpen(false);
    };

    return (
        <div
            ref={relationshipMenuRef}
            className={`hfl-friend ${friend.online ? 'online' : 'offline'}${selected ? ' selected' : ''}${isRelationshipOpen ? ' relationship-open' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => selectFriend(friend.id)}
            onDoubleClick={() => friend.online && OpenMessengerChat(friend.id)}
            onKeyDown={event => { if(event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')){event.preventDefault();selectFriend(friend.id);} }}
        >
            <button type="button" className="hfl-friend-avatar" style={avatarStyle} aria-label={`Profil von ${friend.name}`} onClick={event => { stop(event); if (!isStaffChat) GetUserProfile(friend.id); }}>
                {isStaffChat ? (
                    <StaffChatFrankIconView size={20} />
                ) : (
                    <LayoutAvatarImageView
                        figure={resolveAvatarFigure(friend.figure, friend.gender)}
                        gender={resolveAvatarGender(friend.gender)}
                        headOnly
                        nativeCroppedHead
                        direction={2}
                    />
                )}
            </button>
            <span className="hfl-friend-copy"><span className="hfl-friend-name"><UserIdentityView username={friend.name}/></span><small className="hfl-friend-motto">{friend.motto || '\u00a0'}</small></span>
            <div className="hfl-friend-actions" onClick={stop}>
                {canFollowFriendListEntry(friend) && (
                    <button type="button" className="hfl-action follow octane-friends-spritesheet icon-friendbar-visit" aria-label={`${friend.name} folgen`} title={LocalizeText('friendlist.tip.follow')} onClick={() => followFriend(friend)} />
                )}
                <button type="button" className="hfl-action chat" aria-label={`Nachricht an ${friend.name}`} title={LocalizeText('friendlist.tip.im')} onClick={() => OpenMessengerChat(friend.id)} />
                {friend.id > 0 && <button type="button" className={`hfl-relationship ${relationshipName}`} aria-label={`Beziehung mit ${friend.name} setzen`} aria-expanded={isRelationshipOpen} title="Beziehung setzen" onClick={() => setIsRelationshipOpen(value => !value)} />}
            </div>
            {isRelationshipOpen && (
                <div className="hfl-relationship-menu" onClick={stop}>
                    <button type="button" className="heart" aria-label="Herz" onClick={(event) => setRelationship(event, MessengerFriend.RELATIONSHIP_HEART)} />
                    <button type="button" className="smile" aria-label="Freundschaft" onClick={(event) => setRelationship(event, MessengerFriend.RELATIONSHIP_SMILE)} />
                    <button type="button" className="bobba" aria-label="Bobba" onClick={(event) => setRelationship(event, MessengerFriend.RELATIONSHIP_BOBBA)} />
                    <button type="button" className="none" aria-label="Beziehung entfernen" onClick={(event) => setRelationship(event, MessengerFriend.RELATIONSHIP_NONE)} />
                </div>
            )}
        </div>
    );
};
