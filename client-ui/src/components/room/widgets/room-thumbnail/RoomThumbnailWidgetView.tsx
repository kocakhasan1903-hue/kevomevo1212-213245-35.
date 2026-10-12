import { GetGuestRoomMessageComposer, GetRoomEngine, OctaneRenderTexture, ThumbnailStatusMessageEvent } from '@octane/renderer';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { LocalizeText, RefreshRoomThumbnail, SendMessageComposer } from '../../../../api';
import { LayoutMiniCameraView } from '../../../../common';
import { RoomWidgetThumbnailEvent } from '../../../../events';
import { useMessageEvent, useNotification, useRoom, useUiEvent } from '../../../../hooks';

const THUMBNAIL_UPLOAD_TIMEOUT_MS = 10_000;

export const RoomThumbnailWidgetView: FC<{}> = (props) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const uploadRoomIdRef = useRef(-1);
    const savingRef = useRef(false);
    const uploadTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
    const { roomSession = null } = useRoom();
    const { simpleAlert = null } = useNotification();

    const clearUploadTimeout = useCallback(() => {
        if (!uploadTimeoutRef.current) return;

        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
    }, []);

    useEffect(() => clearUploadTimeout, [clearUploadTimeout]);

    useUiEvent([RoomWidgetThumbnailEvent.SHOW_THUMBNAIL, RoomWidgetThumbnailEvent.HIDE_THUMBNAIL, RoomWidgetThumbnailEvent.TOGGLE_THUMBNAIL], (event) => {
        switch (event.type) {
            case RoomWidgetThumbnailEvent.SHOW_THUMBNAIL:
                if (savingRef.current) return;
                clearUploadTimeout();
                setIsSaving(false);
                savingRef.current = false;
                setIsVisible(true);
                return;
            case RoomWidgetThumbnailEvent.HIDE_THUMBNAIL:
                if (savingRef.current) return;
                setIsVisible(false);
                return;
            case RoomWidgetThumbnailEvent.TOGGLE_THUMBNAIL:
                if (savingRef.current) return;
                setIsVisible((value) => !value);
                return;
        }
    });

    const receiveTexture = async (texture: OctaneRenderTexture) => {
        if (savingRef.current || !roomSession) return;

        savingRef.current = true;
        uploadRoomIdRef.current = roomSession.roomId;
        setIsSaving(true);
        clearUploadTimeout();
        uploadTimeoutRef.current = setTimeout(() => {
            uploadTimeoutRef.current = null;
            setIsSaving(false);
            savingRef.current = false;
            simpleAlert(LocalizeText('camera.error.creation'));
        }, THUMBNAIL_UPLOAD_TIMEOUT_MS);

        try {
            await GetRoomEngine().saveTextureAsScreenshot(texture, true);
        } catch {
            clearUploadTimeout();
            setIsSaving(false);
            savingRef.current = false;
            simpleAlert(LocalizeText('camera.error.creation'));
        }
    };

    useMessageEvent<ThumbnailStatusMessageEvent>(ThumbnailStatusMessageEvent, (event) => {
        if (!savingRef.current) return;

        clearUploadTimeout();
        const parser = event.getParser();

        if (!parser.ok) {
            setIsSaving(false);
            savingRef.current = false;
            simpleAlert(LocalizeText(parser.isRenderLimitHit ? 'camera.render.count.info' : 'camera.error.creation'));
            return;
        }

        const roomId = uploadRoomIdRef.current;

        setIsSaving(false);
        savingRef.current = false;
        setIsVisible(false);

        if (roomId > 0) {
            RefreshRoomThumbnail(roomId);
            SendMessageComposer(new GetGuestRoomMessageComposer(roomId, false, false));
        }

        simpleAlert(LocalizeText('navigator.thumbnail.camera.success'));
    });

    if (!isVisible || !roomSession) return null;

    return (
        <LayoutMiniCameraView
            key={roomSession.roomId}
            roomId={roomSession.roomId}
            textureReceiver={receiveTexture}
            isSaving={isSaving}
            onClose={() => !savingRef.current && setIsVisible(false)}
        />
    );
};
