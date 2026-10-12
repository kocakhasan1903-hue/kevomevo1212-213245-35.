import type { FloorplanDraft } from '../../floorplan-editor/FloorplanEditorView';
import { createOctaneStore } from '../../../state/createOctaneStore';

const CREATE_LOCKOUT_MS = 5000;

interface RoomCreatorState {
    isCreating: boolean;
    pendingLayout: { draft: FloorplanDraft; roomId: number; expires: number } | null;
    setPendingLayout: (draft: FloorplanDraft | null) => void;
    bindCreatedRoom: (roomId: number) => void;
    takeLayout: (roomId: number) => FloorplanDraft | null;
    beginCreate: () => void;
}

export const useRoomCreatorStore = createOctaneStore<RoomCreatorState>()((set, get) => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    return {
        isCreating: false,
        pendingLayout: null,
        setPendingLayout: (draft) => set({ pendingLayout: draft ? { draft, roomId: 0, expires: Date.now() + 30000 } : null }),
        bindCreatedRoom: (roomId) => { const pending = get().pendingLayout; if (pending && pending.roomId === 0 && pending.expires > Date.now()) set({ pendingLayout: { ...pending, roomId } }); },
        takeLayout: (roomId) => { const pending = get().pendingLayout; if (!pending) return null; if (pending.expires <= Date.now()) { set({ pendingLayout: null }); return null; } if (pending.roomId !== roomId) return null; set({ pendingLayout: null }); return pending.draft; },
        beginCreate: () => {
            if (timeoutHandle !== null) clearTimeout(timeoutHandle);

            set({ isCreating: true });

            timeoutHandle = setTimeout(() => {
                timeoutHandle = null;
                set({ isCreating: false });
            }, CREATE_LOCKOUT_MS);
        }
    };
});
