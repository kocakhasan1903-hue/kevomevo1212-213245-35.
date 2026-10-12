/* @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateLinkEvent, GetSessionDataManager } from '@octane/renderer';
import { GetConfigurationValue, GetUserProfile } from '../../api';
import { ToolbarMeView, ToolbarPersonalShortcuts } from './ToolbarMeView';

vi.mock('@octane/renderer', () => ({ CreateLinkEvent: vi.fn(), GetSessionDataManager: () => ({ userId: 42 }) }));
vi.mock('../../hooks', () => ({ useDailyTasks: () => ({}), useRewardTracks: () => ({}) }));
vi.mock('../../api', () => ({ GetConfigurationValue: vi.fn(() => true), GetUserProfile: vi.fn(), LocalizeText: (key: string) => key, localizeWithFallback: (_key: string, fallback: string) => fallback }));
vi.mock('../../common', () => ({ Flex: ({ innerRef, children }: any) => <div ref={innerRef}>{children}</div>, LayoutItemCountView: () => null }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('Toolbar profile menu', () => {
    it('opens the wheel and own profile from the direct shortcuts', () => {
        const view = render(<ToolbarPersonalShortcuts />);
        fireEvent.click(view.getByRole('button', { name: 'Glücksrad' }));
        expect(CreateLinkEvent).toHaveBeenCalledWith('fortune-wheel/toggle');
        fireEvent.click(view.getByRole('button', { name: 'Mein Profil' }));
        expect(GetUserProfile).toHaveBeenCalledWith(GetSessionDataManager().userId);
    });
    it('respects a disabled wheel configuration', () => {
        vi.mocked(GetConfigurationValue).mockReturnValueOnce(false);
        const view = render(<ToolbarPersonalShortcuts />);
        expect(view.queryByRole('button', { name: 'Glücksrad' })).toBeNull();
        expect(view.getByRole('button', { name: 'Mein Profil' })).toBeTruthy();
    });
    it('keeps clothing, settings and forums without the removed progression/navigation entries', () => {
        const { container } = render(<ToolbarMeView setMeExpanded={vi.fn()} />);
        for (const name of ['achievements','quests','dailytasks','rewardtrack','rooms']) expect(container.querySelector(`.icon-me-${name}`)).toBeNull();
        fireEvent.click(container.querySelector('.icon-me-clothing')!);
        expect(CreateLinkEvent).toHaveBeenCalledWith('avatar-editor/toggle');
        fireEvent.click(container.querySelector('.icon-me-settings')!);
        expect(CreateLinkEvent).toHaveBeenCalledWith('user-settings/toggle');
    });
    it('closes on Escape and removes the listener on unmount', () => {
        const close = vi.fn();
        const view = render(<ToolbarMeView setMeExpanded={close} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(close).toHaveBeenCalledWith(false);
        view.unmount();
        close.mockClear();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(close).not.toHaveBeenCalled();
    });
});
