import { useMobilePreferences } from '../../../toolbar/mobilePreferences';
import { useMobileClient } from '../../../../hooks/useMobileClient';
import { MobileInfoPanel, useMobileInfoPreference } from './MobileInfoPanel';
import {
    AddLinkEventTracker,
    GetRoomEngine,
    GetSessionDataManager,
    ILinkEventTracker,
    RemoveLinkEventTracker,
    RoomEngineEvent,
    RoomEngineObjectEvent,
    RoomEnterEffect,
    RoomSessionDanceEvent
} from '@octane/renderer';
import { FC, useEffect, useState } from 'react';
import {
    AvatarInfoFurni,
    AvatarInfoPet,
    AvatarInfoRentableBot,
    AvatarInfoUser,
    GetConfigurationValue,
    RoomWidgetUpdateRentableBotChatEvent
} from '../../../../api';
import { Column } from '../../../../common';
import { useAvatarInfoWidget, useFurniPickupGuard, useOctaneEvent, useRoom, useUiEvent } from '../../../../hooks';
import { AvatarInfoPetTrainingPanelView } from './AvatarInfoPetTrainingPanelView';
import { AvatarInfoRentableBotChatView } from './AvatarInfoRentableBotChatView';
import { AvatarInfoUseProductConfirmView } from './AvatarInfoUseProductConfirmView';
import { AvatarInfoUseProductView } from './AvatarInfoUseProductView';
import { InfoStandWidgetBotView } from './infostand/InfoStandWidgetBotView';
import { InfoStandWidgetFurniView } from './infostand/InfoStandWidgetFurniView';
import { InfoStandWidgetPetView } from './infostand/InfoStandWidgetPetView';
import { InfoStandWidgetRentableBotView } from './infostand/InfoStandWidgetRentableBotView';
import { InfoStandWidgetUserView } from './infostand/InfoStandWidgetUserView';
import { AvatarInfoWidgetAvatarView } from './menu/AvatarInfoWidgetAvatarView';
import { AvatarInfoWidgetDecorateView } from './menu/AvatarInfoWidgetDecorateView';
import { AvatarInfoWidgetFurniView } from './menu/AvatarInfoWidgetFurniView';
import { AvatarInfoWidgetNameView } from './menu/AvatarInfoWidgetNameView';
import { AvatarInfoWidgetOwnAvatarView } from './menu/AvatarInfoWidgetOwnAvatarView';
import { AvatarInfoWidgetOwnPetView } from './menu/AvatarInfoWidgetOwnPetView';
import { AvatarInfoWidgetPetView } from './menu/AvatarInfoWidgetPetView';
import { AvatarInfoWidgetRentableBotView } from './menu/AvatarInfoWidgetRentableBotView';

export const AvatarInfoWidgetView: FC<{}> = (props) => {
    const BLOCK_MENU_WINDOW_MS = 500;
    const BLOCK_ROTATE_WINDOW_MS = 500;
    const [isGameMode, setGameMode] = useState(false);
    const { pickupRoomObject } = useFurniPickupGuard();
    const [isDancing, setIsDancing] = useState(false);
    const isTouchLayout = useMobileClient();
    const mobilePreferences = useMobilePreferences();
    const [mobileFurniDetailsOpen, setMobileFurniDetailsOpen] = useMobileInfoPreference('furniture');
    const [mobileUserDetailsOpen, setMobileUserDetailsOpen] = useMobileInfoPreference('user');
    const [rentableBotChatEvent, setRentableBotChatEvent] = useState<RoomWidgetUpdateRentableBotChatEvent>(null);
    const {
        avatarInfo = null,
        setAvatarInfo = null,
        activeNameBubble = null,
        setActiveNameBubble = null,
        nameBubbles = [],
        removeNameBubble = null,
        productBubbles = [],
        confirmingProduct = null,
        updateConfirmingProduct = null,
        removeProductBubble = null,
        isDecorating = false,
        setIsDecorating = null
    } = useAvatarInfoWidget();
    const { roomSession = null } = useRoom();

    const updateAvatarClickControl = (updates: { suppressMenuUntil?: number; suppressRotateUntil?: number }) => {
        const globalScope = globalThis as any;

        if (!globalScope.__octaneAvatarClickControl) {
            globalScope.__octaneAvatarClickControl = {
                suppressMenuUntil: 0,
                suppressRotateUntil: 0
            };
        }

        Object.assign(globalScope.__octaneAvatarClickControl, updates);
    };

    useOctaneEvent<RoomEngineEvent>(RoomEngineEvent.NORMAL_MODE, (event) => {
        if (isGameMode) setGameMode(false);
    });

    useOctaneEvent<RoomEngineEvent>(RoomEngineEvent.GAME_MODE, (event) => {
        if (!isGameMode) setGameMode(true);
    });


    useOctaneEvent<RoomSessionDanceEvent>(RoomSessionDanceEvent.RSDE_DANCE, (event) => {
        if (event.roomIndex !== roomSession.ownRoomIndex) return;

        setIsDancing(event.danceId !== 0);
    });

    useUiEvent<RoomWidgetUpdateRentableBotChatEvent>(RoomWidgetUpdateRentableBotChatEvent.UPDATE_CHAT, (event) => setRentableBotChatEvent(event));

    useOctaneEvent<RoomEngineObjectEvent>(RoomEngineObjectEvent.REQUEST_PICKUP, (event) => pickupRoomObject(event.objectId, event.category));

    useOctaneEvent<RoomEngineObjectEvent>(RoomEngineObjectEvent.REQUEST_MANIPULATION, (event) => {
        if (!(avatarInfo instanceof AvatarInfoFurni)) return;
        if (event.category !== avatarInfo.category || event.objectId !== avatarInfo.id) return;

        setMobileFurniDetailsOpen(false);
    });

    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split('/');

                if (parts.length < 2) return;

                switch (parts[1]) {
                    case 'hide':
                        setAvatarInfo(null);
                        setActiveNameBubble(null);

                        if (roomSession) GetRoomEngine().clearSelectedAvatar(roomSession.roomId);
                        return;
                    case 'block-menu':
                        updateAvatarClickControl({ suppressMenuUntil: Date.now() + BLOCK_MENU_WINDOW_MS });
                        setAvatarInfo(null);
                        setActiveNameBubble(null);
                        return;
                    case 'block-rotate':
                        updateAvatarClickControl({ suppressRotateUntil: Date.now() + BLOCK_ROTATE_WINDOW_MS });
                        return;
                }
            },
            eventUrlPrefix: 'avatar-info/'
        };

        AddLinkEventTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, [roomSession, setActiveNameBubble, setAvatarInfo]);

    const getMenuView = () => {
        if (!roomSession || isGameMode) return null;

        if (activeNameBubble) return <AvatarInfoWidgetNameView nameInfo={activeNameBubble} onClose={() => setActiveNameBubble(null)} />;

        if (avatarInfo) {
            switch (avatarInfo.type) {
                case AvatarInfoFurni.FURNI: {
                    const info = avatarInfo as AvatarInfoFurni;

                    if (!isDecorating) return null;

                    return <AvatarInfoWidgetFurniView avatarInfo={info} onClose={() => setAvatarInfo(null)} />;
                }
                case AvatarInfoUser.OWN_USER:
                case AvatarInfoUser.PEER: {
                    const info = avatarInfo as AvatarInfoUser;

                    if (isTouchLayout && (mobilePreferences.roomInfo || !mobilePreferences.user || !mobileUserDetailsOpen)) return null;

                    if (GetConfigurationValue('user.tags.enabled')) GetSessionDataManager().getUserTags(info.roomIndex);

                    if (info.isSpectatorMode) return null;

                    if (info.isOwnUser) {
                        if (RoomEnterEffect.isRunning()) return null;

                        return (
                            <AvatarInfoWidgetOwnAvatarView
                                avatarInfo={info}
                                isDancing={isDancing}
                                setIsDecorating={setIsDecorating}
                                onClose={() => setAvatarInfo(null)}
                            />
                        );
                    }

                    return <AvatarInfoWidgetAvatarView avatarInfo={info} onClose={() => setAvatarInfo(null)} />;
                }
                case AvatarInfoPet.PET_INFO: {
                    const info = avatarInfo as AvatarInfoPet;

                    if (info.isOwner) return <AvatarInfoWidgetOwnPetView avatarInfo={info} onClose={() => setAvatarInfo(null)} />;

                    return <AvatarInfoWidgetPetView avatarInfo={info} onClose={() => setAvatarInfo(null)} />;
                }
                case AvatarInfoRentableBot.RENTABLE_BOT: {
                    return <AvatarInfoWidgetRentableBotView avatarInfo={avatarInfo as AvatarInfoRentableBot} onClose={() => setAvatarInfo(null)} />;
                }
            }
        }

        return null;
    };

    const getInfostandView = () => {
        if (!avatarInfo) return null;
        if (isTouchLayout && mobilePreferences.roomInfo && !isDecorating) return null;
        if (isTouchLayout && !isDecorating) {
            if (avatarInfo.type === AvatarInfoFurni.FURNI && !mobilePreferences.furniture) return null;
            if ([AvatarInfoUser.OWN_USER, AvatarInfoUser.PEER].includes(avatarInfo.type) && !mobilePreferences.user) return null;
        }

        switch (avatarInfo.type) {
            case AvatarInfoFurni.FURNI: {
                const info = avatarInfo as AvatarInfoFurni;
                const content = <InfoStandWidgetFurniView avatarInfo={info} onClose={() => isTouchLayout && !isDecorating ? setMobileFurniDetailsOpen(false) : setAvatarInfo(null)} />;
                if (!isTouchLayout || isDecorating) return content;
                return <MobileInfoPanel title={info.name} label="Möbelinfo" open={mobileFurniDetailsOpen} onToggle={() => setMobileFurniDetailsOpen(!mobileFurniDetailsOpen)}>{content}</MobileInfoPanel>;
            }
            case AvatarInfoUser.OWN_USER:
            case AvatarInfoUser.PEER: {
                const info = avatarInfo as AvatarInfoUser;
                const content = <InfoStandWidgetUserView avatarInfo={info} setAvatarInfo={setAvatarInfo} onClose={() => isTouchLayout ? setMobileUserDetailsOpen(false) : setAvatarInfo(null)} />;
                if (!isTouchLayout) return content;
                return <MobileInfoPanel title={info.name} label="Nutzerinfo" open={mobileUserDetailsOpen} onToggle={() => setMobileUserDetailsOpen(!mobileUserDetailsOpen)}>{content}</MobileInfoPanel>;
            }
            case AvatarInfoUser.BOT:
                return <InfoStandWidgetBotView avatarInfo={avatarInfo as AvatarInfoUser} onClose={() => setAvatarInfo(null)} />;
            case AvatarInfoRentableBot.RENTABLE_BOT:
                return <InfoStandWidgetRentableBotView avatarInfo={avatarInfo as AvatarInfoRentableBot} onClose={() => setAvatarInfo(null)} />;
            case AvatarInfoPet.PET_INFO:
                return <InfoStandWidgetPetView avatarInfo={avatarInfo as AvatarInfoPet} onClose={() => setAvatarInfo(null)} />;
        }
    };

    return (
        <>
            {isDecorating && (
                <AvatarInfoWidgetDecorateView
                    roomIndex={roomSession.ownRoomIndex}
                    setIsDecorating={setIsDecorating}
                    userId={GetSessionDataManager().userId}
                    userName={GetSessionDataManager().userName}
                />
            )}
            {getMenuView()}
            {avatarInfo && (
                <Column alignItems="end" className="habbix-infostand-anchor absolute right-[10px] bottom-[65px] pointer-events-none z-30 text-white">
                    {getInfostandView()}
                </Column>
            )}
            {nameBubbles.length > 0 &&
                nameBubbles.map((name, index) => <AvatarInfoWidgetNameView key={index} nameInfo={name} onClose={() => removeNameBubble(index)} />)}
            {productBubbles.length > 0 &&
                productBubbles.map((item, index) => {
                    return (
                        <AvatarInfoUseProductView
                            key={item.id}
                            item={item}
                            updateConfirmingProduct={updateConfirmingProduct}
                            onClose={() => removeProductBubble(index)}
                        />
                    );
                })}
            {rentableBotChatEvent && <AvatarInfoRentableBotChatView chatEvent={rentableBotChatEvent} onClose={() => setRentableBotChatEvent(null)} />}
            {confirmingProduct && <AvatarInfoUseProductConfirmView item={confirmingProduct} onClose={() => updateConfirmingProduct(null)} />}
            <AvatarInfoPetTrainingPanelView />
        </>
    );
};
