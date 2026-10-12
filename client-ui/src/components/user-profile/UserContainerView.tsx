import respectIcon from '../../assets/images/room-widgets/wordquiz-widget/thumbs-up-small.png';
import { useCmsProfile, avatarStyle } from '../../hooks/habbix/useCmsProfile';
import { CreateLinkEvent, GetSessionDataManager, RelationshipStatusInfoMessageParser, RequestFriendComposer, UserProfileParser } from '@octane/renderer';
import { FC, useEffect, useMemo, useState } from 'react';
import {
    formatProfileValue,
    FriendlyTime,
    isProfileHiddenFromViewer,
    SendMessageComposer
} from '../../api';
import { level as profileLevelIcon } from '../../assets/images/user-profile';
import { LayoutAvatarImageView, LayoutBadgeImageView, UserIdentityView } from '../../common';
import { RelationshipsContainerView } from './RelationshipsContainerView';

interface UserContainerViewProps {
    userProfile: UserProfileParser;
    userBadges?: string[];
    userRelationships?: RelationshipStatusInfoMessageParser;
    onOpenRooms?: () => void;
    /** Closes the profile window (the official find-friends link closes it). */
    onClose?: () => void;
    /** Official block_button / blocked_container: the user is on the session block list. */
    isBlocked?: boolean;
    onToggleBlock?: () => void;
}

export const UserContainerView: FC<UserContainerViewProps> = (props) => {
    const { userProfile = null, userBadges = [], userRelationships = null, onClose = null, isBlocked = false, onToggleBlock = null } = props;

    const cms=useCmsProfile(userProfile?.username,userProfile?.id);
    const [requestSent, setRequestSent] = useState(userProfile.requestSent);
    const isOwnProfile = userProfile.id === GetSessionDataManager().userId;
    // "Hide my profile": the server left the counts, last login and relationships out.
    const profileHidden = isProfileHiddenFromViewer(userProfile, GetSessionDataManager().userId);
    const canSendFriendRequest = !requestSent && !isOwnProfile && !userProfile.isMyFriend && !userProfile.requestSent;
    const selectedBadges = useMemo(() => [...userBadges].slice(0, 5), [userBadges]);

    const addFriend = () => {
        setRequestSent(true);
        SendMessageComposer(new RequestFriendComposer(userProfile.username));
    };

    useEffect(() => {
        setRequestSent(userProfile.requestSent);
    }, [userProfile]);

    return <div className="hpx-overview">
        <section className="hpx-identity">
            <div className="hpx-avatar" data-avatar-mode={cms.data?.appearance?.clientStyle?.avatarMode} style={avatarStyle(cms.data?.appearance)}>
                <LayoutAvatarImageView figure={userProfile.figure} direction={2} headOnly={cms.data?.appearance?.clientStyle?.avatarMode==='head'}/>
                <span className={`hpx-presence${userProfile.isOnline?' online':''}`} aria-label={userProfile.isOnline?'Online':'Offline'}/>
            </div>
            <div className="hpx-identity-copy"><UserIdentityView username={userProfile.username} nickIcon={userProfile.nickIcon} prefixText={userProfile.prefixText} prefixColor={userProfile.prefixColor} prefixEffect={userProfile.prefixEffect} prefixFont={userProfile.prefixFont} prefixIcon={userProfile.prefixIcon} displayOrder={userProfile.displayOrder} nameClassName="hpx-name"/><p>{userProfile.motto}</p></div>
        </section>
        <section className="hpx-badges" aria-label="Badges">{selectedBadges.filter(Boolean).map((badge,index)=><LayoutBadgeImageView key={`${badge}-${index}`} badgeCode={badge} highlightRarity showInfo showRarityInfo infoStyle="profile" tabIndex={0} aria-label={badge}/>)}</section>
        <section className="hpx-details">
            <div className="hpx-stat"><i className="octane-icon icon-pf-online"/><span>Erstellt {userProfile.registration}</span></div>
            <div className="hpx-stat"><i className="octane-icon icon-pf-offline"/><span>Zuletzt online {formatProfileValue(userProfile.secondsSinceLastVisit,profileHidden,(seconds)=>FriendlyTime.format(seconds,'.ago',2))}</span></div>
            <div className="hpx-stat"><img src={respectIcon} alt=""/><span><strong className="hpx-respect-count">{profileHidden?"–":typeof cms.data?.stats?.respect==='number'?cms.data.stats.respect.toLocaleString('de-DE'):"–"}</strong> Lobe erhalten</span></div>
            <button className="hpx-stat" type="button" onClick={()=>CreateLinkEvent('achievements/toggle')}><img src={profileLevelIcon} alt=""/><span>{userProfile.achievementPoints} Aktivitätspunkte</span></button>
            {!profileHidden&&userRelationships&&<div className="hpx-relationships"><RelationshipsContainerView relationships={userRelationships} onClose={onClose}/></div>}
            {profileHidden&&<p>Dieses Profil ist privat.</p>}
            {canSendFriendRequest&&<button className="hpx-action" type="button" onClick={addFriend}>Freund hinzufügen</button>}
        </section>
        {!isOwnProfile&&onToggleBlock&&<button className="hpx-action" type="button" onClick={onToggleBlock}>{isBlocked?'Blockierung aufheben':'Blockieren'}</button>}
    </div>;
};
