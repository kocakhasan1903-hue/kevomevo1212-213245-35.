import { useCallback, useEffect, useRef, useState } from 'react';

/** Keep mouse wheel, held buttons and the captured crop on the same zoom. */
export const useCameraZoom = (enabled = true) => {
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    const viewfinderRef = useRef<HTMLDivElement>(null);
    const cameraRef = useRef<HTMLDivElement>(null);
    const timer = useRef<ReturnType<typeof setInterval>>(null);
    const stopZoom = useCallback(() => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
    }, []);
    const stepZoom = useCallback((direction: number) => {
        zoomRef.current = Math.max(1, Math.min(3, Math.round((zoomRef.current + Math.sign(direction) * .1) * 10) / 10));
        setZoom(zoomRef.current);
    }, []);
    const holdZoom = useCallback((direction: number) => {
        stopZoom();
        stepZoom(direction);
        timer.current = setInterval(() => stepZoom(direction), 120);
    }, [stepZoom, stopZoom]);

    useEffect(() => {
        const target = cameraRef.current ?? viewfinderRef.current;
        if (!enabled || !target) { stopZoom(); return; }
        const wheel = (event: WheelEvent) => {
            // A non-passive native listener also prevents the room underneath
            // the camera from zooming or the page from scrolling.
            event.preventDefault();
            event.stopPropagation();
            if (event.deltaY) stepZoom(-event.deltaY);
        };
        target.addEventListener('wheel', wheel, { passive: false, capture: true });
        return () => target.removeEventListener('wheel', wheel, true);
    }, [enabled, stepZoom, stopZoom]);
    useEffect(() => {
        window.addEventListener('pointerup', stopZoom);
        window.addEventListener('blur', stopZoom);
        return () => {
            stopZoom();
            window.removeEventListener('pointerup', stopZoom);
            window.removeEventListener('blur', stopZoom);
        };
    }, [stopZoom]);
    return { zoom, zoomRef, viewfinderRef, cameraRef, stepZoom, holdZoom, stopZoom };
};
