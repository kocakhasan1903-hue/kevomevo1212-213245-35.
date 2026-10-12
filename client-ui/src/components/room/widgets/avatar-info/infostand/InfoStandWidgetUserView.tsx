import { AnimatedCloseButton } from '../../../../../common/AnimatedCloseButton';
import {useCmsProfile,profileStyle,avatarStyle,appearanceBackground} from '../../../../../hooks/habbix/useCmsProfile';
import {HabbixProfileEditor} from '../../../../user-profile/HabbixProfileEditor';
import {
    CreateLinkEvent,
    GetSessionDataManager,
    RelationshipStatusInfoEvent,
    RelationshipStatusInfoMessageParser,
    RoomSessionFavoriteGroupUpdateEvent,
    RoomSessionUserBadgesEvent,
    RoomSessionUserFigureUpdateEvent,
    UserRelationshipsComposer
} from '@octane/renderer';
import React, { Dispatch, FC, FocusEvent, KeyboardEvent, SetStateAction, useCallback, useEffect, useState } from 'react';
import { AvatarInfoUser, CloneObject, GetConfigurationValue, GetGroupInformation, GetUserProfile, LocalizeText, localizeWithFallback, SendMessageComposer } from '../../../../../api';
import homeIcon from '../../../../../assets/images/infostand/home-icon.png';
import pencilIcon from '../../../../../assets/images/infostand/pencil-icon.png';
import { Base, Column, Flex, LayoutAvatarImageView, LayoutBadgeImageView, Text, UserIdentityView } from '../../../../../common';
import { useMessageEvent, useOctaneEvent, useRoom } from '../../../../../hooks';
import { BackgroundsView } from '../../../../backgrounds/BackgroundsView';
import { InfoStandBadgeSlotView } from './InfoStandBadgeSlotView';
import { InfoStandWidgetUserRelationshipsView } from './InfoStandWidgetUserRelationshipsView';
import { InfoStandWidgetUserTagsView } from './InfoStandWidgetUserTagsView';

interface InfoStandWidgetUserViewProps {
    avatarInfo: AvatarInfoUser;
    setAvatarInfo: Dispatch<SetStateAction<AvatarInfoUser>>;
    onClose: () => void;
}

export const InfoStandWidgetUserView: FC<InfoStandWidgetUserViewProps> = (props) => {
    const { avatarInfo = null, setAvatarInfo = null, onClose = null } = props;
    const cms=useCmsProfile(avatarInfo?.name,avatarInfo?.webID);
    const [motto, setMotto] = useState<string>(null);
    const [isEditingMotto, setIsEditingMotto] = useState(false);
    const [relationships, setRelationships] = useState<RelationshipStatusInfoMessageParser>(null);
    const [backgroundId, setBackgroundId] = useState<number>(null);
    const [standId, setStandId] = useState<number>(null);
    const [overlayId, setOverlayId] = useState<number>(null);
    const [cardBackgroundId, setCardBackgroundId] = useState<number>(null);
    const [borderId, setBorderId] = useState<number>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [preview,setPreview]=useState<any>(null);
    const appearance=isVisible&&preview?preview:cms.data?.appearance;
    const [nativeDesign, setNativeDesign] = useState(false);
    const { roomSession = null } = useRoom();

    const infostandBackgroundClass = `background-${backgroundId ?? 'default'}`;
    const infostandStandClass = `stand-${standId ?? 'default'}`;
    const infostandOverlayClass = `overlay-${overlayId ?? 'default'}`;
    const infostandCardBackgroundClass = cardBackgroundId ? `card-background-${cardBackgroundId}` : '';
    const infostandBorderClass = borderId ? `border-${borderId}` : '';
    const handleProfileClick = useCallback(() => {
        GetUserProfile(avatarInfo.webID);
    }, [avatarInfo.webID]);

    const handleEditClick = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
        setIsVisible(true);
    }, []);

    const saveMotto = (motto: string) => {
        if (!isEditingMotto || motto.length > GetConfigurationValue<number>('motto.max.length', 38) || !roomSession) return;

        roomSession.sendMottoMessage(motto);
        setIsEditingMotto(false);
    };

    const onMottoBlur = (event: FocusEvent<HTMLInputElement>) => saveMotto(event.target.value);

    const onMottoKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();

        switch (event.key) {
            case 'Enter':
                saveMotto((event.target as HTMLInputElement).value);
                return;
        }
    };

    useOctaneEvent<RoomSessionUserBadgesEvent>(RoomSessionUserBadgesEvent.RSUBE_BADGES, (event) => {
        if (!avatarInfo || avatarInfo.webID !== event.userId) return;

        // Deduplicate badges from server
        const seen = new Set<string>();
        const dedupedBadges = event.badges.map((code) => {
            if (!code || seen.has(code)) return '';
            seen.add(code);
            return code;
        });

        const oldBadges = avatarInfo.badges.join('');

        if (oldBadges === dedupedBadges.join('')) return;

        setAvatarInfo((prevValue) => {
            if (!prevValue) return prevValue;

            const newValue = CloneObject(prevValue);
            newValue.badges = dedupedBadges;
            return newValue;
        });
    });

    useOctaneEvent<RoomSessionUserFigureUpdateEvent>(RoomSessionUserFigureUpdateEvent.USER_FIGURE, (event) => {
        if (!avatarInfo || avatarInfo.roomIndex !== event.roomIndex) return;

        setAvatarInfo((prevValue) => {
            if (!prevValue) return prevValue;

            const newValue = CloneObject(prevValue);
            newValue.figure = event.figure;
            newValue.motto = event.customInfo;
            newValue.achievementScore = event.activityPoints;
            newValue.nickIcon = event.nickIcon;
            newValue.prefixText = event.prefixText;
            newValue.prefixColor = event.prefixColor;
            newValue.prefixIcon = event.prefixIcon;
            newValue.prefixEffect = event.prefixEffect;
            newValue.displayOrder = event.displayOrder;
            newValue.backgroundId = event.backgroundId;
            newValue.standId = event.standId;
            newValue.overlayId = event.overlayId;
            newValue.cardBackgroundId = event.cardBackgroundId ?? 0;
            newValue.borderId = event.borderId ?? 0;
            return newValue;
        });
    });

    useOctaneEvent<RoomSessionFavoriteGroupUpdateEvent>(RoomSessionFavoriteGroupUpdateEvent.FAVOURITE_GROUP_UPDATE, (event) => {
        if (!avatarInfo || avatarInfo.roomIndex !== event.roomIndex) return;

        setAvatarInfo((prevValue) => {
            if (!prevValue) return prevValue;

            const newValue = CloneObject(prevValue);
            const clearGroup = event.status === -1 || event.habboGroupId <= 0;

            newValue.groupId = clearGroup ? -1 : event.habboGroupId;
            newValue.groupName = clearGroup ? null : event.habboGroupName;
            newValue.groupBadgeId = clearGroup ? null : GetSessionDataManager().getGroupBadge(event.habboGroupId);
            return newValue;
        });
    });

    useMessageEvent<RelationshipStatusInfoEvent>(RelationshipStatusInfoEvent, (event) => {
        const parser = event.getParser();

        if (!avatarInfo || avatarInfo.webID !== parser.userId) return;

        setRelationships(parser);
    });

    useEffect(() => {
        setIsEditingMotto(false);
        setMotto(avatarInfo.motto);
        setBackgroundId(avatarInfo.backgroundId);
        setStandId(avatarInfo.standId);
        setOverlayId(avatarInfo.overlayId);
        setCardBackgroundId(avatarInfo.cardBackgroundId ?? 0);
        setBorderId(avatarInfo.borderId ?? 0);

    }, [avatarInfo]);

    useEffect(() => {
        setRelationships(null);
        if (avatarInfo?.webID) SendMessageComposer(new UserRelationshipsComposer(avatarInfo.webID));
    }, [avatarInfo?.webID]);

    if (!avatarInfo) return null;

    const isOwnUser = avatarInfo.type === AvatarInfoUser.OWN_USER;
    const mottoMaxLength = GetConfigurationValue<number>('motto.max.length', 38);
    const showAchievementScore = GetConfigurationValue<boolean>('activity.point.display.enabled', true);
    const hasRelationships = !!relationships?.relationshipStatusMap.length;

    return (
        <>
            <aside data-badge-layout={appearance?.clientStyle?.badgeLayout} data-frame-effect={appearance?.clientStyle?.frameEffect} data-badge-hover={appearance?.clientStyle?.badgeHover} data-badge-style={appearance?.clientStyle?.badgeStyle} data-button-style={appearance?.clientStyle?.buttonStyle} className="hpx-infostand" style={profileStyle({...appearance,banner:''})} aria-label={`Profil von ${avatarInfo.name}`}>
                <div className="hpx-banner" style={profileStyle(appearance)}>
                    <div className="hpx-controls">{isOwnUser&&<button type="button" onClick={handleEditClick} aria-label="Profilgestaltung öffnen">UI</button>}<AnimatedCloseButton onClick={onClose} aria-label="Profil schließen">×</AnimatedCloseButton></div>
                    <button type="button" className="hpx-avatar hpx-avatar-round" data-avatar-mode={appearance?.clientStyle?.avatarMode} style={avatarStyle(appearance)} onClick={handleProfileClick} aria-label="Vollständiges Profil öffnen"><LayoutAvatarImageView figure={avatarInfo.figure} direction={2} headOnly={appearance?.clientStyle?.avatarMode==='head'}/></button>
                {cms.data?.premium&&appearance?.clientStyle?.showPremium!==false&&<span className="hpx-premium">CLUB</span>}</div>
                <button type="button" className="hpx-namebar" onClick={handleProfileClick}>{avatarInfo.name}</button>
                <section className="hpx-motto"><h3>MOTTO</h3>{isEditingMotto?<input autoFocus value={motto} maxLength={mottoMaxLength} onChange={e=>setMotto(e.target.value)} onBlur={onMottoBlur} onKeyDown={onMottoKeyDown} aria-label="Motto bearbeiten"/>:<button type="button" disabled={!isOwnUser} onClick={()=>setIsEditingMotto(true)}>{motto||'Noch kein Motto'}</button>}</section>
                <section className="hpx-infostand-badges"><h3>BADGES</h3><div>{avatarInfo.badges.map((badge,index)=>badge?<InfoStandBadgeSlotView key={`${badge}-${index}`} slotIndex={index} badgeCode={badge} isOwnUser={isOwnUser}/>:null)}</div></section>
                {hasRelationships&&<section className="hpx-relationships"><h3>BEZIEHUNGEN</h3><div className="hpx-relationships-row"><InfoStandWidgetUserRelationshipsView relationships={relationships}/></div></section>}
                {showAchievementScore&&<section className="hpx-score"><button type="button" onClick={()=>CreateLinkEvent('achievements/show')}><span>★ AKTIVITÄTSPUNKTE</span><strong>{avatarInfo.achievementScore}</strong></button></section>}
                {!!appearance?.clientStyle?.tags?.length&&<section className="hpx-tags"><h3>TAGS</h3><div>{appearance.clientStyle.tags.map((tag:string)=><span key={tag} style={{color:appearance.clientStyle.tagColors?.[tag]||appearance.clientStyle.tagColor}}>{tag}</span>)}</div></section>}
                {avatarInfo.groupId>0&&<button className="hpx-group" type="button" onClick={()=>GetGroupInformation(avatarInfo.groupId)}>Gruppe: {avatarInfo.groupName}</button>}
            </aside>
            {nativeDesign && avatarInfo.type === AvatarInfoUser.OWN_USER && <BackgroundsView setIsVisible={setNativeDesign} selectedBackground={backgroundId} setSelectedBackground={setBackgroundId} selectedStand={standId} setSelectedStand={setStandId} selectedOverlay={overlayId} setSelectedOverlay={setOverlayId} selectedCardBackground={cardBackgroundId} setSelectedCardBackground={setCardBackgroundId} selectedBorder={borderId} setSelectedBorder={setBorderId}/> }
            {isVisible && avatarInfo.type === AvatarInfoUser.OWN_USER && (
                <div className="backgrounds-view-container">
                    <HabbixProfileEditor profile={cms.data} onPreview={setPreview} onSave={cms.send} pending={cms.pending} error={cms.error} onClose={()=>setIsVisible(false)} onNativeDesign={()=>{setIsVisible(false);setNativeDesign(true);}}/>
                </div>
            )}
        </>
    );
};
