/* @vitest-environment jsdom */
import { NavigatorSearchResultSet } from '@octane/renderer';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavigatorUiStore } from '../../../../hooks/navigator/navigatorUiStore';
import { NavigatorSearchView } from './NavigatorSearchView';

vi.mock('../../../../hooks', async () => ({
    useNavigatorUiStore: (await import('../../../../hooks/navigator/navigatorUiStore')).useNavigatorUiStore,
    useNavigatorData: () => ({ topLevelContext: {} })
}));
vi.mock('../../../../api', async (original) => ({
    ...(await original<typeof import('../../../../api')>()),
    SendMessageComposer: vi.fn(),
    LocalizeText: (key: string) => key,
    localizeWithFallback: (_key: string, fallback: string) => fallback
}));

describe('Navigator search draft', () => {
    beforeEach(() => useNavigatorUiStore.setState({ currentTabCode: 'hotel_view', currentFilter: '' }));
    afterEach(cleanup);

    it('keeps an unfinished query when a periodic room result arrives', () => {
        const view = render(<NavigatorSearchView searchResult={null} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pool' } });
        view.rerender(<NavigatorSearchView searchResult={{ data: '', code: 'hotel_view' } as NavigatorSearchResultSet} />);
        expect(screen.getByRole('textbox')).toHaveValue('Pool');
    });

    it('clears the submitted filter as well as the text', () => {
        useNavigatorUiStore.setState({ currentFilter: 'owner:Syntetic' });
        render(<NavigatorSearchView searchResult={null} />);
        fireEvent.click(screen.getByRole('button', { name: 'Suche zurücksetzen' }));
        expect(screen.getByRole('textbox')).toHaveValue('');
        expect(useNavigatorUiStore.getState().currentFilter).toBe('');
    });

    it('resets a draft when switching tabs without a submitted filter', () => {
        render(<NavigatorSearchView searchResult={null} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pool' } });
        act(() => useNavigatorUiStore.getState().setTab('myworld_view'));
        expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('preserves colons in ordinary queries and submits the text', () => {
        useNavigatorUiStore.setState({ currentFilter: 'Room: Pool' });
        const { container } = render(<NavigatorSearchView searchResult={null} />);
        expect(screen.getByRole('textbox')).toHaveValue('Room: Pool');
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pool 2' } });
        fireEvent.submit(container.querySelector('form')!);
        expect(useNavigatorUiStore.getState().currentFilter).toBe('Pool 2');
    });
});
