import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InfoStandWidgetUserView } from './InfoStandWidgetUserView';
const m = vi.hoisted(() => ({ send: vi.fn(), listener: null as ((event: any) => void) | null }));
vi.mock('@octane/renderer', () => ({ CreateLinkEvent: vi.fn(), GetSessionDataManager: () => ({}),
    RoomSessionUserBadgesEvent: { RSUBE_BADGES: 'badges' }, RoomSessionUserFigureUpdateEvent: { USER_FIGURE: 'figure' }, RoomSessionFavoriteGroupUpdateEvent: { FAVOURITE_GROUP_UPDATE: 'group' },
    RelationshipStatusInfoEvent: class {}, UserRelationshipsComposer: class { constructor(public id: number) {} } }));
vi.mock('../../../../../api', () => ({ AvatarInfoUser: { OWN_USER: 1 }, CloneObject: (value: object) => ({...value}),
    GetConfigurationValue: (_key: string, fallback: unknown) => fallback, GetGroupInformation: vi.fn(), GetUserProfile: vi.fn(), LocalizeText: (key: string) => key, localizeWithFallback: (_key: string, fallback: string) => fallback, SendMessageComposer: m.send }));
vi.mock('../../../../../hooks', () => ({ useRoom: () => ({roomSession: null}), useOctaneEvent: () => {}, useMessageEvent: (_type: unknown, callback: (event: any) => void) => { m.listener = callback; } }));
vi.mock('../../../../../hooks/habbix/useCmsProfile', () => ({useCmsProfile: () => ({data: null}), profileStyle: () => ({}), avatarStyle: () => ({}), appearanceBackground: () => ({})}));
vi.mock('../../../../../common', () => ({LayoutAvatarImageView: () => <span/>}));
vi.mock('../../../../backgrounds/BackgroundsView', () => ({BackgroundsView: () => null}));
vi.mock('../../../../user-profile/HabbixProfileEditor', () => ({HabbixProfileEditor: () => null}));
vi.mock('./InfoStandBadgeSlotView', () => ({InfoStandBadgeSlotView: () => null}));
vi.mock('./InfoStandWidgetUserTagsView', () => ({InfoStandWidgetUserTagsView: () => null}));
vi.mock('./InfoStandWidgetUserRelationshipsView', () => ({InfoStandWidgetUserRelationshipsView: ({relationships}: any) => <div>{relationships.relationshipStatusMap.label}</div>}));
const avatar = {webID: 7, type: 2, name: 'Syntetic', motto: 'Hallo', figure: '', badges: [], achievementScore: 138} as any;
const deliver = (id: number) => act(() => m.listener?.({getParser: () => ({userId: id, relationshipStatusMap: {length: 1, label: '♥ Lina'}})}));
afterEach(() => {cleanup(); vi.clearAllMocks();});
it('displays received relationships and preserves them across motto or badge updates', () => {
    const view = render(<InfoStandWidgetUserView avatarInfo={avatar} setAvatarInfo={vi.fn()} onClose={vi.fn()}/>);
    deliver(7); expect(screen.getByText('BEZIEHUNGEN')).toBeInTheDocument(); expect(screen.getByText('♥ Lina')).toBeInTheDocument();
    view.rerender(<InfoStandWidgetUserView avatarInfo={{...avatar,motto: 'Neues Motto'}} setAvatarInfo={vi.fn()} onClose={vi.fn()}/>);
    expect(screen.getByText('♥ Lina')).toBeInTheDocument(); expect(m.send).toHaveBeenCalledOnce();
});
it('clears relationships when selecting someone else and ignores a late response for the previous user', () => {
    const view = render(<InfoStandWidgetUserView avatarInfo={avatar} setAvatarInfo={vi.fn()} onClose={vi.fn()}/>); deliver(7);
    view.rerender(<InfoStandWidgetUserView avatarInfo={{...avatar,webID: 8,name: 'Max'}} setAvatarInfo={vi.fn()} onClose={vi.fn()}/>);
    deliver(7); expect(screen.queryByText('♥ Lina')).not.toBeInTheDocument(); expect(m.send).toHaveBeenLastCalledWith(expect.objectContaining({id: 8}));
});
