import { GetRoomEngine, OctaneTexture, OctaneSprite, TextureUtils } from '@octane/renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { blitRoomCanvasToViewfinder, getViewfinderRoomFrame, LocalizeText, PlaySound, SoundNames } from '../../api';
import { useCameraZoom } from '../../hooks/camera/useCameraZoom';
import { Column } from '../Column';
import { DraggableWindow } from '../draggable-window';

interface LayoutMiniCameraViewProps {
    roomId: number;
    textureReceiver: (texture: OctaneTexture) => Promise<void>;
    onClose: () => void;
    isSaving?: boolean;
}
interface RoomPhoto { texture: OctaneTexture; url: string; }

export const LayoutMiniCameraView: FC<LayoutMiniCameraViewProps> = ({ roomId = -1, textureReceiver, onClose, isSaving = false }) => {
    const elementRef = useRef<HTMLCanvasElement>(null);
    const flashRef = useRef<HTMLDivElement>(null);
    const mounted = useRef(true);
    const capturing = useRef(false);
    const submitting = useRef(false);
    const photosRef = useRef<RoomPhoto[]>([]);
    const [error, setError] = useState('');
    const [photos, setPhotos] = useState<RoomPhoto[]>([]);
    const [selected, setSelected] = useState(-1);
    const [isCapturing, setIsCapturing] = useState(false);
    const isBusy = isCapturing || isSaving;
    const { zoom, zoomRef, viewfinderRef, cameraRef, stepZoom, holdZoom, stopZoom } = useCameraZoom(!isBusy && selected < 0);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            photosRef.current.forEach(photo => photo.texture.destroy(true));
            photosRef.current = [];
        };
    }, []);
    useEffect(() => { if (!isSaving) submitting.current = false; }, [isSaving]);
    useEffect(() => {
        if (selected >= 0) return;
        let frame = 0;
        const tick = (now: number) => {
            blitRoomCanvasToViewfinder(elementRef.current, 320, 320, 1000 / 24, now, zoomRef.current);
            frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
    }, [selected, zoomRef]);

    const takePicture = async () => {
        if (capturing.current || isSaving) return;
        if (selected >= 0) { setSelected(-1); return; }
        if (photosRef.current.length >= 5) return;
        setError('');
        const frame = getViewfinderRoomFrame(elementRef.current, 320, 320, zoomRef.current);
        if (!frame) return;
        capturing.current = true;
        setIsCapturing(true);
        let texture: OctaneTexture = null;
        try {
            texture = GetRoomEngine().createTextureFromRoom(roomId, -1, frame);
            if (!texture) return;
            if (zoomRef.current > 1 || (texture.width > 0 && (texture.width !== 320 || texture.height !== 320))) {
                const original = texture;
                original.source.scaleMode = 'nearest';
                const sprite = new OctaneSprite(original);
                sprite.width = 320; sprite.height = 320;
                texture = TextureUtils.generateTexture({ target: sprite, resolution: 1 });
                sprite.destroy({ texture: false }); original.destroy(true);
                if (!texture) return;
            }
            PlaySound(SoundNames.CAMERA_SHUTTER);
            flashRef.current?.classList.remove('octane-camera-capture__flash--active');
            void flashRef.current?.offsetWidth;
            flashRef.current?.classList.add('octane-camera-capture__flash--active');
            const url = await TextureUtils.generateImageUrl(texture);
            if (!url || !mounted.current) return;
            const next = [...photosRef.current, { texture, url }];
            texture = null;
            photosRef.current = next;
            setPhotos(next);
            setSelected(next.length - 1);
        } finally {
            texture?.destroy(true);
            capturing.current = false;
            if (mounted.current) setIsCapturing(false);
        }
    };
    const savePicture = async () => {
        if (isBusy || submitting.current || !photos[selected]) return;
        submitting.current = true;
        try { await textureReceiver(photos[selected].texture); }
        finally { submitting.current = false; }
    };
    const removePicture = () => {
        if (isBusy || selected < 0) return;
        photos[selected].texture.destroy(true);
        const next = photos.filter((_, index) => index !== selected);
        photosRef.current = next;
        setPhotos(next);
        setSelected(-1);
    };

    return (
        <DraggableWindow>
            <Column center gap={0} className="octane-camera-capture habbix-room-thumbnail-camera" role="dialog" aria-label="Raumbild ändern" aria-busy={isBusy}>
                <div ref={cameraRef} className="octane-camera-capture__body drag-handler">
                    <div className="octane-camera-capture__title">Raumbild ändern</div>
                    <button type="button" className="octane-camera-capture__close" disabled={isBusy} aria-label={LocalizeText('generic.close')} onClick={onClose} />
                    <div ref={viewfinderRef} className="octane-camera-viewfinder">
                        {selected < 0 ? <canvas ref={elementRef} className="octane-camera-viewfinder__fallback" width={320} height={320} /> : <img className="octane-camera-viewfinder__photo" src={photos[selected]?.url} alt="Ausgewählte Aufnahme" />}
                        {selected < 0 && <div className="habbix-camera-zoom"><output>{Math.round(zoom * 100)} %</output>{([-1, 1] as const).map(direction => <button key={direction} type="button" aria-label={direction < 0 ? 'Rauszoomen' : 'Reinzoomen'} disabled={isBusy || (direction < 0 ? zoom <= 1 : zoom >= 3)} onPointerDown={event => { event.preventDefault(); holdZoom(direction); }} onPointerUp={stopZoom} onPointerCancel={stopZoom} onPointerLeave={stopZoom} onClick={event => { if (event.detail === 0) stepZoom(direction); }}>{direction < 0 ? '−' : '+'}</button>)}</div>}
                    </div>
                    {selected < 0 && <div className="octane-camera-capture__crosshair" aria-hidden="true" />}
                    <div ref={flashRef} className="octane-camera-capture__flash" aria-hidden="true" />
                    {selected >= 0 && <div className="octane-camera-capture__preview-actions"><button type="button" className="octane-camera-capture__editor-button habbo-btn-primary" disabled={isBusy} onClick={() => void savePicture().catch(() => setError('Das Raumbild konnte nicht gespeichert werden.'))}>{isSaving ? 'Wird gespeichert …' : 'Als Raumbild übernehmen'}</button></div>}
                    <button type="button" className="octane-camera-capture__shutter" aria-label={selected >= 0 ? 'Neue Aufnahme' : 'Foto aufnehmen'} title={selected >= 0 ? 'Neue Aufnahme' : 'Foto aufnehmen'} disabled={isBusy || (selected < 0 && photos.length >= 5)} onClick={() => void takePicture().catch(() => setError('Die Aufnahme konnte nicht erstellt werden. Bitte erneut versuchen.'))} />
                </div>
                <div className={`octane-camera-roll${photos.length ? '' : ' octane-camera-roll--hidden'}`} aria-hidden={!photos.length}>
                    {Array.from({ length: 5 }, (_, index) => <div key={index} className={`octane-camera-roll__slot${selected === index ? ' octane-camera-roll__slot--active' : ''}`}>
                        <button type="button" className="octane-camera-roll__slot-button" disabled={isBusy || !photos[index]} aria-label={`Aufnahme ${index + 1} auswählen`} aria-pressed={selected === index} onClick={() => setSelected(index)}>{photos[index] && <img src={photos[index].url} alt="" />}</button>
                        {selected === index && <button type="button" className="octane-camera-roll__delete" disabled={isBusy} aria-label="Aufnahme löschen" onClick={removePicture} />}
                    </div>)}
                </div>
                {error && <p className="habbix-room-thumbnail-error" role="alert">{error}</p>}
            </Column>
        </DraggableWindow>
    );
};
