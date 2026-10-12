import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MOBILE_CLIENT_QUERY, useMobileClient } from './useMobileClient';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('uses input capabilities rather than desktop window width and reacts to changes', () => {
    let mobile = false;
    const listeners = new Set<() => void>();
    const matchMedia = vi.fn((query: string) => ({
        get matches() { return query === MOBILE_CLIENT_QUERY && mobile; },
        addEventListener: (_: string, callback: () => void) => listeners.add(callback),
        removeEventListener: (_: string, callback: () => void) => listeners.delete(callback)
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    vi.stubGlobal('innerWidth', 375);
    function View() { return <div>{useMobileClient() ? 'Mobil' : 'Desktop'}</div>; }
    const view = render(<View />);
    expect(screen.getByText('Desktop')).toBeTruthy();
    act(() => { mobile = true; listeners.forEach(fn => fn()); });
    expect(screen.getByText('Mobil')).toBeTruthy();
    view.unmount();
    expect(listeners.size).toBe(0);
});
