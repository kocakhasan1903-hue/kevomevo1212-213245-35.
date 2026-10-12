import { useEffect, useRef } from 'react';
import { ROOM_VOICE_MESSAGE, RoomVoiceMessage } from './useRoomVoice';

/** Keep the room subscription alive across chat/history rerenders. */
export function useRoomVoiceMessages(roomId: number, receive: (message: RoomVoiceMessage, signal: AbortSignal) => void | Promise<void>, release: () => void) {
    const callbacks = useRef({ receive, release });
    callbacks.current = { receive, release };
    useEffect(() => {
        if (!roomId) return;
        const controller = new AbortController();
        const seen = new Set<string>();
        const listener = (event: Event) => {
            const message = (event as CustomEvent<RoomVoiceMessage>).detail;
            if (!message || message.roomId !== roomId || seen.has(message.id)) return;
            seen.add(message.id); if (seen.size > 100) seen.delete(seen.values().next().value);
            void callbacks.current.receive(message, controller.signal);
        };
        window.addEventListener(ROOM_VOICE_MESSAGE, listener);
        return () => { controller.abort(); window.removeEventListener(ROOM_VOICE_MESSAGE, listener); callbacks.current.release(); };
    }, [roomId]);
}
