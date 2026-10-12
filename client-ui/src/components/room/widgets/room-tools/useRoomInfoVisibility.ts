import { useCallback, useEffect, useRef, useState } from 'react';

export function useRoomInfoVisibility(roomId: number, startCollapsed = false) {
    const [open, setOpen] = useState(!startCollapsed);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => {
        clearTimeout(timer.current);
        if (!roomId) return;
        setOpen(!startCollapsed);
        if (!startCollapsed) timer.current = setTimeout(() => setOpen(false), 6500);
        return () => clearTimeout(timer.current);
    }, [roomId, startCollapsed]);
    const toggle = useCallback(() => {
        clearTimeout(timer.current);
        setOpen(value => !value);
    }, []);
    return [open, toggle] as const;
}
