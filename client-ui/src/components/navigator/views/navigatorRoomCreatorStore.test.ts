import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoomCreatorStore } from './navigatorRoomCreatorStore';

describe('useRoomCreatorStore', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useRoomCreatorStore.setState({ isCreating: false, pendingLayout: null });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts with isCreating === false', () => {
        expect(useRoomCreatorStore.getState().isCreating).toBe(false);
    });
    it('applies a draft only once to the room returned by creation', () => {
        const draft = {tilemap:'000\r000',doorX:0,doorY:0,doorDirection:2,thicknessWall:0,thicknessFloor:0,wallHeight:3};
        const store = useRoomCreatorStore.getState();
        store.setPendingLayout(draft);
        expect(store.takeLayout(99)).toBeNull();
        store.bindCreatedRoom(42);
        expect(store.takeLayout(99)).toBeNull();
        expect(store.takeLayout(42)).toEqual(draft);
        expect(store.takeLayout(42)).toBeNull();
    });
    it('expires an unconfirmed draft instead of modifying a later room', () => {
        const store = useRoomCreatorStore.getState();
        store.setPendingLayout({tilemap:'00',doorX:0,doorY:0,doorDirection:2,thicknessWall:0,thicknessFloor:0,wallHeight:3});
        vi.advanceTimersByTime(30001);
        store.bindCreatedRoom(42);
        expect(store.takeLayout(42)).toBeNull();
        expect(useRoomCreatorStore.getState().pendingLayout).toBeNull();
    });

    it('beginCreate() latches isCreating to true', () => {
        useRoomCreatorStore.getState().beginCreate();
        expect(useRoomCreatorStore.getState().isCreating).toBe(true);
    });

    it('isCreating auto-resets to false after the 5s lockout', () => {
        useRoomCreatorStore.getState().beginCreate();
        expect(useRoomCreatorStore.getState().isCreating).toBe(true);

        vi.advanceTimersByTime(4999);
        expect(useRoomCreatorStore.getState().isCreating).toBe(true);

        vi.advanceTimersByTime(1);
        expect(useRoomCreatorStore.getState().isCreating).toBe(false);
    });

    it('a second beginCreate() resets the lockout timer (no double-fire)', () => {
        useRoomCreatorStore.getState().beginCreate();
        vi.advanceTimersByTime(4000);

        // Re-entry restarts the 5s window
        useRoomCreatorStore.getState().beginCreate();

        // At t=4500 (500ms past the second call), we should still be locked
        vi.advanceTimersByTime(500);
        expect(useRoomCreatorStore.getState().isCreating).toBe(true);

        // Only after another 4500ms (total 5000 since the second call)
        vi.advanceTimersByTime(4500);
        expect(useRoomCreatorStore.getState().isCreating).toBe(false);
    });
});
