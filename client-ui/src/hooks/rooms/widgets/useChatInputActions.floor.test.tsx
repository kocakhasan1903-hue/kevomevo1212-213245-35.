import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useChatInputActions } from './useChatInputActions';
const m = vi.hoisted(() => ({ link: vi.fn(), session: { isRoomOwner: true, controllerLevel: 0 }, staff: false }));
vi.mock('@octane/renderer', async () => ({ ...await vi.importActual<any>('@octane/renderer'), CreateLinkEvent: m.link }));
vi.mock('../../../api', () => ({ IsAnyRoomController: () => m.staff, ChatMessageTypeEnum: { DEFAULT: 0 },
    GetClubMemberLevel: () => 0, GetConfigurationValue: (_key: string, fallback: unknown) => fallback, LocalizeText: (key: string) => key, SendMessageComposer: vi.fn() }));
vi.mock('../useRoom', () => ({ useRoom: () => ({ roomSession: m.session }) }));
vi.mock('../../notification', () => ({ useNotification: () => ({ showOctaneAlert: vi.fn(), showConfirm: vi.fn() }) }));
vi.mock('../../translation', () => ({ useTranslation: () => ({ settings: {}, translateOutgoing: vi.fn(), enqueueOutgoingTranslation: vi.fn() }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); m.staff = false; });
it('opens :floor for the room owner even with normal rank and controller level zero', () => {
    m.session = { isRoomOwner: true, controllerLevel: 0 };
    renderHook(useChatInputActions).result.current.sendChat(':floor', 0);
    expect(m.link).toHaveBeenCalledWith('floor-editor/show');
});
it('does not open the editor for an ordinary guest', () => {
    m.session = { isRoomOwner: false, controllerLevel: 0 };
    renderHook(useChatInputActions).result.current.sendChat(':floor', 0);
    expect(m.link).not.toHaveBeenCalled();
});
