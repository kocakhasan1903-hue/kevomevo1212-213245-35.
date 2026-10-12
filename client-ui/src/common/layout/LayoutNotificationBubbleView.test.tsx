import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LayoutNotificationBubbleView } from './LayoutNotificationBubbleView';
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('dismisses on schedule even if another notification changes the close callback', () => {
    vi.useFakeTimers();
    const first = vi.fn(); const latest = vi.fn();
    const view = render(<LayoutNotificationBubbleView onClose={first}>Hinweis</LayoutNotificationBubbleView>);
    act(() => vi.advanceTimersByTime(7000));
    view.rerender(<LayoutNotificationBubbleView onClose={latest}>Hinweis</LayoutNotificationBubbleView>);
    act(() => vi.advanceTimersByTime(1300));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
});
it('clears pending removal when a toast unmounts during its fade', () => {
    vi.useFakeTimers(); const close = vi.fn();
    const view = render(<LayoutNotificationBubbleView onClose={close}>Hinweis</LayoutNotificationBubbleView>);
    act(() => vi.advanceTimersByTime(8000));
    view.unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(close).not.toHaveBeenCalled();
});
