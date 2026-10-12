import { setMobilePreferences, useMobilePreferences } from '../../../toolbar/mobilePreferences';
import { useMobileClient } from '../../../../hooks/useMobileClient';
import { useRoomInfoVisibility } from './useRoomInfoVisibility';
import { useRoomChatHidden } from '../chat/chatVisibility';
import { LayoutAvatarImageView, UserProfileIconView } from '../../../../common';
import { CreateLinkEvent, GetRoomEngine, RoomEngineEvent, RoomGeometry } from '@octane/renderer';
import { FC, useEffect, useState } from 'react';
import { GetConfigurationValue, LocalizeText, GetUserProfile } from '../../../../api';
import { useAchievements, useNavigatorData, useNavigatorFavourite, useOctaneEvent, useRoom, useRoomUserListSnapshot, useSessionInfo } from '../../../../hooks';
import { useCmsProfile } from '../../../../hooks/habbix/useCmsProfile';
import { classNames } from '../../../../layout';
import { getRegisteredPlugins, IOctanePlugin, subscribePlugins } from '../../../plugins/OctanePluginApi';
import { applyRoomZoom } from './roomZoom.helpers';

const ROOM_ZOOM_SCALES = [0.5, 1, 2, 4, 8, 16];

const getNearestZoomScale = (scale: number) => {
    if (Number.isNaN(scale) || scale <= 0) return 1;

    return ROOM_ZOOM_SCALES.reduce((nearest, current) => (Math.abs(current - scale) < Math.abs(nearest - scale) ? current : nearest), ROOM_ZOOM_SCALES[0]);
};

const getNextZoomScale = (scale: number, direction: number) => {
    const currentScale = getNearestZoomScale(scale);

    if (direction > 0) {
        return ROOM_ZOOM_SCALES.find((zoomScale) => zoomScale > currentScale + 0.001) ?? currentScale;
    }

    if (direction < 0) {
        return [...ROOM_ZOOM_SCALES].reverse().find((zoomScale) => zoomScale < currentScale - 0.001) ?? currentScale;
    }

    return currentScale;
};

const getZoomText = (scale: number) => (Math.round(Math.log(getNearestZoomScale(scale)) / Math.LN2) + 1).toString();

export const RoomToolsWidgetView: FC<{}> = (props) => {
    const mobileClient = useMobileClient();
    const mobilePreferences = useMobilePreferences();
    const [chatHidden,toggleChatHidden] = useRoomChatHidden();
    const [zoomOpen,setZoomOpen] = useState(false);
    const [zoomScale, setZoomScale] = useState<number>(1);
    const [plugins, setPlugins] = useState<IOctanePlugin[]>([]);
    const { navigatorData } = useNavigatorData();
    const { hasWiredAchievements } = useAchievements();
    const { roomSession = null } = useRoom();
    const roomUsers = useRoomUserListSnapshot();
    const { userInfo, userFigure } = useSessionInfo();
    const currentRoom = navigatorData?.enteredGuestRoom;
    const [desktopToolsOpen, toggleDesktopTools] = useRoomInfoVisibility(currentRoom?.roomId === roomSession?.roomId ? roomSession?.roomId : 0, mobileClient);
    const isToolsOpen = mobileClient ? mobilePreferences.roomInfo : desktopToolsOpen;
    const toggleTools = () => mobileClient ? setMobilePreferences({roomInfo: !mobilePreferences.roomInfo}) : toggleDesktopTools();
    const { isFavourite, toggle: toggleFavourite } = useNavigatorFavourite(currentRoom?.roomId ?? 0);
    const owner = roomUsers.find(user => user.webID === currentRoom?.ownerId);
    const ownFigure = currentRoom?.ownerId === userInfo?.userId ? userFigure : '';
    const knownFigure = owner?.figure || ownFigure;
    const { data: ownerProfile } = useCmsProfile(!knownFigure ? currentRoom?.ownerName : '', !knownFigure ? currentRoom?.ownerId : 0);
    const ownerFigure = knownFigure || ownerProfile?.look;

    useEffect(() => {
        setPlugins(getRegisteredPlugins());
        return subscribePlugins(() => setPlugins(getRegisteredPlugins()));
    }, []);

    const getLogicalZoomScale = () => {
        if (!roomSession) return 1;

        const displayScale = GetRoomEngine().getRoomInstanceRenderingCanvasScale(roomSession.roomId, 1);
        const geometry = GetRoomEngine().getRoomInstanceGeometry(roomSession.roomId, 1);
        const geometryRatio = geometry ? geometry.scale / RoomGeometry.SCALE_ZOOMED_IN : 1;

        return getNearestZoomScale(displayScale * geometryRatio);
    };

    const applyZoomScale = (logicalScale: number) => {
        if (!roomSession) return;

        applyRoomZoom(roomSession.roomId, logicalScale);
        setZoomScale(logicalScale);
    };

    const updateZoomScale = () => {
        if (!roomSession) return;

        setZoomScale(getLogicalZoomScale());
    };

    const zoomRoom = (direction: number) => {
        if (!roomSession || direction === 0) return;

        if (!GetConfigurationValue('room.zoom.enabled', true)) {
            const geometry = GetRoomEngine().getRoomInstanceGeometry(roomSession.roomId, 1);
            if (!geometry) return;

            if (direction > 0) geometry.performZoomIn();
            else geometry.performZoomOut();

            setZoomScale(direction > 0 ? 2 : 1);
            return;
        }

        const currentScale = getLogicalZoomScale();
        const nextScale = getNextZoomScale(currentScale, direction);

        if (Math.abs(nextScale - currentScale) <= 0.001) return;

        applyZoomScale(nextScale);
    };

    const handleToolClick = (action: string, value?: string) => {
        if (!roomSession) return;

        switch (action) {
            case 'achievements':
                CreateLinkEvent('questengine/achievements/wired_games');
                return;
            case 'settings':
                CreateLinkEvent('navigator/toggle-room-info');
                return;
            case 'zoom_in':
                zoomRoom(1);
                return;
            case 'zoom_out':
                zoomRoom(-1);
                return;
            case 'chat_history':
                CreateLinkEvent('chat-history/toggle');
                return;
            case 'toggle_room_link':
                CreateLinkEvent('navigator/toggle-room-link');
                return;
        }
    };

    useEffect(() => {
        updateZoomScale();
    }, [roomSession?.roomId]);

    // The renderer can be zoomed from outside this toolbar (keyboard shortcuts,
    // other widgets), so resync the displayed level whenever the engine reports it.
    useOctaneEvent<RoomEngineEvent>(RoomEngineEvent.ROOM_ZOOMED, (event) => {
        if (!roomSession || event.roomId !== roomSession.roomId) return;

        updateZoomScale();
    });

    const canZoomIn = getNextZoomScale(zoomScale, 1) !== getNearestZoomScale(zoomScale);
    const canZoomOut = getNextZoomScale(zoomScale, -1) !== getNearestZoomScale(zoomScale);

    if (!currentRoom || !roomSession) return null;
    return <div className={classNames('octane-room-tools-container', 'habbix-room-tools', !isToolsOpen && 'is-collapsed')}>
        <button className="room-tools-collapse-toggle" type="button" aria-label={isToolsOpen?'Rauminformationen einklappen':'Rauminformationen öffnen'} onClick={toggleTools}>{isToolsOpen?'‹':'›'}</button>
        {<div className="octane-room-tools habbix-room-card" aria-hidden={!isToolsOpen} inert={!isToolsOpen}>
            <strong className="habbix-room-title">{currentRoom.roomName}</strong>
            {currentRoom.showOwner && <button type="button" className="habbix-room-owner" onClick={()=>GetUserProfile(currentRoom.ownerId)}>
                <span className="habbix-room-owner-avatar">{ownerFigure?<LayoutAvatarImageView figure={ownerFigure} gender={owner?.sex || ownerProfile?.gender} direction={3} headOnly nativeCroppedHead/>:<UserProfileIconView userId={currentRoom.ownerId}/>}</span><span>{currentRoom.ownerName}</span>
            </button>}
            {currentRoom.description && <div className="habbix-room-description">{currentRoom.description}</div>}
            <div className="habbix-room-actions">
                <button type="button" title="Einstellungen" aria-label="Rauminfo öffnen" onClick={()=>handleToolClick('settings')}><i className="octane-icon icon-cog"/></button>
                <button type="button" title="Chatverlauf" aria-label="Chatverlauf öffnen" onClick={()=>handleToolClick('chat_history')}><i className="octane-icon icon-chat-history"/></button>
                <button type="button" title="Zoom" aria-label="Raumzoom" aria-expanded={zoomOpen} onClick={()=>setZoomOpen(v=>!v)}><i className="octane-icon icon-zoom-less"/></button>
                <button type="button" title={chatHidden?'Chat Nachrichten einblenden':'Chat Nachrichten ausblenden'} aria-label={chatHidden?'Chat Nachrichten einblenden':'Chat Nachrichten ausblenden'} aria-pressed={chatHidden} onClick={toggleChatHidden}><i className="octane-icon icon-chat-disablebubble"/></button>
                {hasWiredAchievements&&<button type="button" title="Achievements" onClick={()=>handleToolClick('achievements')}><i className="octane-icon icon-room-achievements"/></button>}
                {plugins.map(plugin=><button key={plugin.name} type="button" title={plugin.label} onClick={()=>plugin.onOpen()}><i className={classNames('octane-icon',plugin.icon||'icon-cog')}/></button>)}
                <button className="habbix-room-like" type="button" title={isFavourite ? 'Aus Favoriten entfernen' : 'Als Favorit speichern'} aria-label={isFavourite ? 'Aus Favoriten entfernen' : 'Als Favorit speichern'} aria-pressed={isFavourite} onClick={toggleFavourite}><svg className="habbix-room-favourite-heart" viewBox="0 0 20 18" aria-hidden="true"><path d="M2 1h5v2h6V1h5v2h1v7l-9 7-9-7V3h1Z"/></svg></button>
            </div>
            {zoomOpen&&<div className="room-tools-zoom-row"><span>{LocalizeText('room.zoom.text', ['zoom_level'], [getZoomText(zoomScale)])}</span><button className="room-tools-zoom-button" type="button" aria-label="Raum vergrößern" disabled={!canZoomIn} onClick={()=>handleToolClick('zoom_in')}>+</button><button className="room-tools-zoom-button" type="button" aria-label="Raum verkleinern" disabled={!canZoomOut} onClick={()=>handleToolClick('zoom_out')}>−</button></div>}
        </div>}
    </div>;
};
