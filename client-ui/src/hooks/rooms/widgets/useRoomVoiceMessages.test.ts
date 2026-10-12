import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useRoomVoiceMessages } from './useRoomVoiceMessages';
import { ROOM_VOICE_MESSAGE, RoomVoiceMessage } from './useRoomVoice';
afterEach(cleanup);
const packet = { id: 'memo-1', roomId: 1 } as RoomVoiceMessage;
it('keeps an audio URL alive when chat history recreates its callback', () => {
    const release = vi.fn(); const first = vi.fn(); const updated = vi.fn();
    const hook = renderHook(({ receive, roomId }) => useRoomVoiceMessages(roomId, receive, release), { initialProps: { receive: first, roomId: 1 } });
    act(() => window.dispatchEvent(new CustomEvent(ROOM_VOICE_MESSAGE, { detail: packet })));
    expect(first).toHaveBeenCalledOnce(); const signal = first.mock.calls[0][1] as AbortSignal;
    hook.rerender({ receive: updated, roomId: 1 });
    expect(release).not.toHaveBeenCalled(); expect(signal.aborted).toBe(false);
    act(() => window.dispatchEvent(new CustomEvent(ROOM_VOICE_MESSAGE, { detail: { ...packet, id: 'memo-2' } })));
    expect(updated).toHaveBeenCalledOnce();
    hook.rerender({ receive: updated, roomId: 2 });
    expect(release).toHaveBeenCalledOnce(); expect(signal.aborted).toBe(true);
});
it('does not duplicate a memo across callback changes and releases only on exit', () => {
    const release = vi.fn(); const receive = vi.fn();
    const hook = renderHook(() => useRoomVoiceMessages(1, (...args) => receive(...args), release));
    act(() => window.dispatchEvent(new CustomEvent(ROOM_VOICE_MESSAGE, { detail: packet })));
    hook.rerender(); act(() => window.dispatchEvent(new CustomEvent(ROOM_VOICE_MESSAGE, { detail: packet })));
    expect(receive).toHaveBeenCalledOnce(); expect(release).not.toHaveBeenCalled();
    hook.unmount(); expect(release).toHaveBeenCalledOnce();
});
