import { GetEventDispatcher, GetRenderer, GetRoomEngine, RoomGeometry, RoomObjectMouseEvent, RoomObjectTileMouseEvent, RoomSession, RoomZoomEvent } from '@octane/renderer';
import { pinchRoomScale, touchDistance } from './mobileRoomGesture';
import { AnimatePresence, motion } from 'framer-motion';
import { FC, useEffect, useRef } from 'react';
import { DispatchMouseEvent, DispatchTouchEvent } from '../../api';
import { useRoom, useRoomKeyboardMovement } from '../../hooks';
import { classNames } from '../../layout';
import { RoomSpectatorView } from './spectator/RoomSpectatorView';
import { RoomWidgetsView } from './widgets/RoomWidgetsView';
import { WiredVariableFxOverlayView } from './widgets/wired-fx/WiredVariableFxOverlayView';
import { FishingView } from '../fishing/FishingView';

export const RoomView: FC<{}> = (props) => {
    const { roomSession = null } = useRoom();
    const elementRef = useRef<HTMLDivElement>(null);

    useRoomKeyboardMovement();

    useEffect(() => {
        if (!roomSession) return;

        const canvas = GetRenderer().canvas;

        if (!canvas) return;

        canvas.onclick = (event) => DispatchMouseEvent(event);
        canvas.onmousemove = (event) => DispatchMouseEvent(event);
        canvas.onmousedown = (event) => DispatchMouseEvent(event);
        canvas.onmouseup = (event) => DispatchMouseEvent(event);

        let pinch: {distance:number;scale:number} | null = null;
        let suppressTouch = false;
        const dispatchTouch = (event: TouchEvent) => {
            if (event.cancelable) event.preventDefault();
            if (event.touches.length >= 2) {
                suppressTouch = true;
                const distance = touchDistance(event.touches);
                if (!pinch) {
                    const engine = GetRoomEngine();
                    const geometry = engine.getRoomInstanceGeometry(roomSession.roomId, 1);
                    const displayScale = engine.getRoomInstanceRenderingCanvasScale(roomSession.roomId, 1);
                    pinch = {distance,scale:geometry?.scale === RoomGeometry.SCALE_ZOOMED_OUT ? displayScale / 2 : displayScale};
                } else if (event.type === 'touchmove') {
                    GetEventDispatcher().dispatchEvent(new RoomZoomEvent(roomSession.roomId,pinchRoomScale(pinch.scale,pinch.distance,distance)));
                }
                return;
            }
            if (suppressTouch) {
                if (!event.touches.length) { pinch = null; suppressTouch = false; }
                return;
            }
            DispatchTouchEvent(event);
        };
        canvas.classList.add('habbix-room-touch-canvas');
        canvas.addEventListener('touchstart', dispatchTouch, {passive:false});
        canvas.addEventListener('touchmove', dispatchTouch, {passive:false});
        canvas.addEventListener('touchend', dispatchTouch, {passive:false});
        canvas.addEventListener('touchcancel', dispatchTouch, {passive:false});

        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoved = false;
        let lastTileTap: { x: number; y: number; time: number } = null;

        const isMobileTouch = () => window.matchMedia('(pointer: coarse), (hover: none)').matches;

        const onTouchStart = (event: TouchEvent) => {
            const touch = event.touches[0];

            if (!touch || !isMobileTouch()) return;

            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchMoved = false;
        };

        const onTouchMove = (event: TouchEvent) => {
            const touch = event.touches[0];

            if (!touch || !isMobileTouch()) return;

            if (Math.abs(touch.clientX - touchStartX) > 8 || Math.abs(touch.clientY - touchStartY) > 8) touchMoved = true;
        };

        const onTouchEnd = (event: TouchEvent) => {
            const touch = event.changedTouches[0];

            if (!touch || touchMoved || !isMobileTouch()) return;

            lastTileTap = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        };

        const showTouchFeedback = () => {
            if (!lastTileTap || Date.now() - lastTileTap.time > 250) return;

            const feedback = document.createElement('div');

            feedback.className = 'octane-room-touch-feedback';
            feedback.style.left = `${lastTileTap.x}px`;
            feedback.style.top = `${lastTileTap.y}px`;

            document.body.appendChild(feedback);
            window.setTimeout(() => feedback.remove(), 420);

            lastTileTap = null;
        };

        const onTileClick = (event: RoomObjectMouseEvent) => {
            if (event instanceof RoomObjectTileMouseEvent) window.setTimeout(showTouchFeedback, 0);
        };

        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('touchend', onTouchEnd, { passive: true });
        GetEventDispatcher().addEventListener(RoomObjectMouseEvent.CLICK, onTileClick);

        const element = elementRef.current;

        if (!element) return;

        canvas.classList.add('bg-black');

        element.appendChild(canvas);

        return () => {
            canvas.removeEventListener('touchstart', dispatchTouch);
            canvas.removeEventListener('touchmove', dispatchTouch);
            canvas.removeEventListener('touchend', dispatchTouch);
            canvas.removeEventListener('touchcancel', dispatchTouch);
            canvas.classList.remove('habbix-room-touch-canvas');
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            GetEventDispatcher().removeEventListener(RoomObjectMouseEvent.CLICK, onTileClick);
        };
    }, [roomSession]);

    return (
        <AnimatePresence>
            {
                <motion.div className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div ref={elementRef} className="w-full h-full">
                        <WiredVariableFxOverlayView />
                        {roomSession instanceof RoomSession && (
                            <>
                                <RoomWidgetsView />
                                <FishingView />
                                {roomSession.isSpectator && <RoomSpectatorView />}
                            </>
                        )}
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    );
};
