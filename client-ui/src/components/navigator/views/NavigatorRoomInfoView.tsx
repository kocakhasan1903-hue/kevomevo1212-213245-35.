import {
    CreateLinkEvent,
    GetCustomRoomFilterMessageComposer,
    GetGuestRoomMessageComposer,
    GetSessionDataManager,
    NavigatorSearchComposer,
    RemoveOwnRoomRightsRoomMessageComposer,
    RoomControllerLevel,
    RoomMuteComposer,
    RoomSettingsComposer,
    ToggleStaffPickMessageComposer,
    UpdateHomeRoomMessageComposer
} from '@octane/renderer';
import { FC, useEffect, useState } from 'react';
import { DispatchUiEvent, GetGroupInformation, isHousekeepingEnabled, LocalizeText, ReportType, SendMessageComposer } from '../../../api';
import weblinkIcon from '../../../assets/images/navigator/air/icon-weblink.png';
import removeRightsIcon from '../../../assets/images/navigator/air/remove-rights.png';
import {
    Flex,
    LayoutBadgeImageView,
    LayoutRoomThumbnailView,
    OctaneCardContentView,
    OctaneCardHeaderView,
    OctaneCardView,
    Text,
    UserProfileIconView
} from '../../../common';
import { RoomWidgetThumbnailEvent } from '../../../events';
import { useHasPermission, useHelp, useNavigatorData, useNavigatorFavourite, useRoom } from '../../../hooks';
import { classNames } from '../../../layout';

export interface NavigatorRoomInfoViewProps {
    onCloseClick: () => void;
}

export const NavigatorRoomInfoView: FC<NavigatorRoomInfoViewProps> = (props) => {
    const { onCloseClick = null } = props;
    const [isRoomPicked, setIsRoomPicked] = useState(false);
    const [isRoomMuted, setIsRoomMuted] = useState(false);
    const { report = null } = useHelp();
    const { navigatorData } = useNavigatorData();
    const { roomSession = null } = useRoom();
    const canManageAnyRoom = useHasPermission('acc_anyroomowner');
    const canUseRoomThumbnailCamera = useHasPermission('acc_camera');
    const canStaffPick = useHasPermission('acc_staff_pick');
    const canOpenHousekeeping = useHasPermission('acc_housekeeping') && isHousekeepingEnabled();

    const enteredRoomId = navigatorData?.enteredGuestRoom?.roomId ?? 0;
    const { isFavourite: isRoomInFavouritesList, toggle: toggleFavourite } = useNavigatorFavourite(enteredRoomId);

    useEffect(() => {
        if (!enteredRoomId) return;
        SendMessageComposer(new GetGuestRoomMessageComposer(enteredRoomId, false, false));
    }, [enteredRoomId]);

    const hasPermission = (permission: string) => {
        if (!navigatorData?.enteredGuestRoom) return false;

        switch (permission) {
            case 'settings':
                return GetSessionDataManager().userId === navigatorData.enteredGuestRoom.ownerId || canManageAnyRoom;
            case 'staff_pick':
                return canStaffPick;
            case 'floor':
                return roomSession?.controllerLevel >= RoomControllerLevel.GUEST;
            case 'guest':
                return roomSession?.controllerLevel === RoomControllerLevel.GUEST;
            default:
                return false;
        }
    };

    const processAction = (action: string, value?: string) => {
        if (!navigatorData?.enteredGuestRoom) return;

        const roomId = navigatorData.enteredGuestRoom.roomId;

        switch (action) {
            case 'set_home_room': {
                let newRoomId = -1;
                if (navigatorData.homeRoomId !== roomId) newRoomId = roomId;
                if (newRoomId > 0) SendMessageComposer(new UpdateHomeRoomMessageComposer(newRoomId));
                return;
            }
            case 'navigator_search_tag':
                CreateLinkEvent(`navigator/search/${value}`);
                SendMessageComposer(new NavigatorSearchComposer('hotel_view', `tag:${value}`));
                return;
            case 'open_room_thumbnail_camera':
                DispatchUiEvent(new RoomWidgetThumbnailEvent(RoomWidgetThumbnailEvent.SHOW_THUMBNAIL));
                return;
            case 'open_group_info':
                GetGroupInformation(navigatorData.enteredGuestRoom.habboGroupId);
                return;
            case 'toggle_room_link':
                CreateLinkEvent('navigator/toggle-room-link');
                return;
            case 'open_room_settings':
                SendMessageComposer(new RoomSettingsComposer(roomId));
                return;
            case 'toggle_pick':
                setIsRoomPicked((prev) => !prev);
                SendMessageComposer(new ToggleStaffPickMessageComposer(roomId));
                SendMessageComposer(new GetGuestRoomMessageComposer(roomId, false, false));
                return;
            case 'toggle_mute':
                setIsRoomMuted((prev) => !prev);
                SendMessageComposer(new RoomMuteComposer());
                SendMessageComposer(new GetGuestRoomMessageComposer(roomId, false, false));
                return;
            case 'room_filter':
                SendMessageComposer(new GetCustomRoomFilterMessageComposer(roomId));
                return;
            case 'open_floorplan_editor':
                CreateLinkEvent('floor-editor/toggle');
                return;
            case 'report_room':
                report(ReportType.ROOM, { roomId, roomName: navigatorData.enteredGuestRoom.roomName });
                return;
            case 'room_favourite':
                toggleFavourite();
                SendMessageComposer(new GetGuestRoomMessageComposer(roomId, false, false));
                return;
            case 'remove_rights':
                SendMessageComposer(new RemoveOwnRoomRightsRoomMessageComposer(roomId));
                return;
            case 'close':
                onCloseClick();
                return;
        }
    };

    useEffect(() => {
        if (!navigatorData) return;
        setIsRoomPicked(navigatorData.currentRoomIsStaffPick);
        if (navigatorData.enteredGuestRoom) setIsRoomMuted(navigatorData.enteredGuestRoom.allInRoomMuted);
    }, [navigatorData]);

    if (!navigatorData?.enteredGuestRoom) return null;

    return (
        <OctaneCardView
            className="octane-room-info habbix-room-info-window"
            isResizable={false}
        >
            <OctaneCardHeaderView headerText={LocalizeText('navigator.roomsettings.roominfo')} onCloseClick={() => processAction('close')} />
            <OctaneCardContentView className="octane-room-info__content" overflow="auto">
                <div className="habbix-room-info-summary">
                    {hasPermission('settings') && canUseRoomThumbnailCamera ? <button type="button" className="habbix-room-info-photo-button" aria-label={LocalizeText('navigator.thumbnail.camera.title')} title="Raumbild ändern" onClick={() => processAction('open_room_thumbnail_camera')}>
                        <LayoutRoomThumbnailView className="octane-room-info__thumbnail" customUrl={navigatorData.enteredGuestRoom.officialRoomPicRef} roomId={enteredRoomId}><i className="octane-room-info__camera octane-icon icon-camera-small absolute bottom-0 right-0 m-1" /></LayoutRoomThumbnailView>
                    </button> : <LayoutRoomThumbnailView className="octane-room-info__thumbnail" customUrl={navigatorData.enteredGuestRoom.officialRoomPicRef} roomId={enteredRoomId} />}
                    <div className="habbix-room-info-details">
                        <div className="octane-room-info__heading"><button type="button" aria-label={LocalizeText('navigator.room.popup.room.info.home')} aria-pressed={navigatorData.homeRoomId===enteredRoomId} className={classNames('octane-room-info__home',navigatorData.homeRoomId===enteredRoomId&&'is-home')} title={LocalizeText('navigator.room.popup.room.info.home')} onClick={()=>processAction('set_home_room')}/><h3>{navigatorData.enteredGuestRoom.roomName}</h3></div>
                        {navigatorData.enteredGuestRoom.showOwner&&<div className="octane-room-info__meta"><span>BESITZER:</span><UserProfileIconView userId={navigatorData.enteredGuestRoom.ownerId}/><strong>{navigatorData.enteredGuestRoom.ownerName}</strong></div>}
                        <div className="octane-room-info__meta"><span>BEWERTUNG:</span><strong>{navigatorData.currentRoomRating}</strong></div>
                    </div>
                </div>
                {navigatorData.enteredGuestRoom.description&&<div className="octane-room-info__description">{navigatorData.enteredGuestRoom.description}</div>}
                <div className="habbix-room-info-link-section"><button type="button" className="octane-room-info__action" onClick={()=>processAction('toggle_room_link')}>{LocalizeText('navigator.embed.caption')}</button></div>
                <div className="habbix-room-info-action-row"><button type="button" className="octane-room-info__action is-danger" onClick={()=>processAction('report_room')}>{LocalizeText('help.emergency.main.report.room')}</button>{hasPermission('guest')?<button type="button" className="octane-room-info__action" onClick={()=>processAction('remove_rights')}>Rechte abgeben</button>:GetSessionDataManager().userId!==navigatorData.enteredGuestRoom.ownerId&&<button type="button" className="octane-room-info__action" aria-pressed={isRoomInFavouritesList} onClick={()=>processAction('room_favourite')}>{isRoomInFavouritesList?'Favorit entfernen':'Als Favorit speichern'}</button>}</div>
                <div className="habbix-room-info-action-row habbix-room-info-bottom">
                    {hasPermission('settings')&&<button type="button" className="octane-room-info__action" onClick={()=>processAction('open_room_settings')}><i className="octane-icon icon-cog"/>{LocalizeText('navigator.roomsettings')}</button>}
                    <button type="button" className="octane-room-info__action" onClick={()=>CreateLinkEvent('help/show')}><i className="octane-icon icon-help"/>Hilfe</button>
                </div>
                {navigatorData.enteredGuestRoom.habboGroupId > 0 && (
                    <Flex pointer alignItems="center" gap={1} className="octane-room-info__group" onClick={() => processAction('open_group_info')}>
                        <LayoutBadgeImageView badgeCode={navigatorData.enteredGuestRoom.groupBadgeCode} className="flex-none" isGroup={true} />
                        <Text small underline>{LocalizeText('navigator.guildbase', ['groupName'], [navigatorData.enteredGuestRoom.groupName])}</Text>
                    </Flex>
                )}
                <details className="habbix-room-info-advanced"><summary>Weitere Raumwerkzeuge</summary><div className="octane-room-info__actions">

                    {hasPermission('settings') && (
                        <button type="button" className="octane-room-info__action habbo-btn-primary" onClick={() => processAction('room_filter')}>
                            {LocalizeText('navigator.roomsettings.roomfilter')}
                        </button>
                    )}
                    {(hasPermission('settings') || hasPermission('floor')) && (
                        <button type="button" className="octane-room-info__action habbo-btn-primary" onClick={() => processAction('open_floorplan_editor')}>
                            {LocalizeText('open.floor.plan.editor')}
                        </button>
                    )}
                    {hasPermission('staff_pick') && (
                        <button type="button" className="octane-room-info__action habbo-btn-primary" onClick={() => processAction('toggle_pick')}>
                            {LocalizeText(isRoomPicked ? 'navigator.staffpicks.unpick' : 'navigator.staffpicks.pick')}
                        </button>
                    )}

                    {hasPermission('settings') && (
                        <button type="button" className="octane-room-info__action habbo-btn-primary" onClick={() => processAction('toggle_mute')}>
                            {LocalizeText(isRoomMuted ? 'navigator.muteall_on' : 'navigator.muteall_off')}
                        </button>
                    )}
                    {canOpenHousekeeping && enteredRoomId > 0 && (
                        <button type="button" className="octane-room-info__action habbo-btn-primary" onClick={() => CreateLinkEvent(`housekeeping/room/${enteredRoomId}`)}>
                            {LocalizeText('housekeeping.menu.open_room')}
                        </button>
                    )}
                </div></details>
            </OctaneCardContentView>
        </OctaneCardView>
    );
};
