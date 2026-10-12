type RoomThumbnailListener = (revision: number) => void;

const revisions = new Map<number, number>();
const listeners = new Map<number, Set<RoomThumbnailListener>>();

const revisionKey = (roomId: number) => `habbix.room-thumbnail.${roomId}`;
export const GetRoomThumbnailRevision = (roomId: number): number => {
    if (revisions.has(roomId)) return revisions.get(roomId);
    try { return Number(localStorage.getItem(revisionKey(roomId))) || 0; } catch { return 0; }
};

export const RefreshRoomThumbnail = (roomId: number, revision: number = Date.now()): void => {
    if (roomId <= 0) return;

    revisions.set(roomId, revision);
    // Other tabs and the CMS parent frame receive a storage event after saving.
    try { localStorage.setItem(revisionKey(roomId), String(revision)); } catch { /* The in-client refresh still works without storage. */ }

    for (const listener of listeners.get(roomId) ?? []) listener(revision);
};

export const SubscribeRoomThumbnail = (roomId: number, listener: RoomThumbnailListener): (() => void) => {
    let roomListeners = listeners.get(roomId);

    if (!roomListeners) {
        roomListeners = new Set();
        listeners.set(roomId, roomListeners);
    }

    roomListeners.add(listener);

    return () => {
        roomListeners.delete(listener);
        if (!roomListeners.size) listeners.delete(roomId);
    };
};
