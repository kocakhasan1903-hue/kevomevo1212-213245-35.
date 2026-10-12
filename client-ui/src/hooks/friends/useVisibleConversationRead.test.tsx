/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisibleConversationRead } from './useVisibleConversationRead';

const Harness = ({ active = true, message = 'thread:1', onRead }: { active?: boolean; message?: string; onRead: () => void }) =>
{
    const box = useRef<HTMLDivElement>(null);
    useVisibleConversationRead(active, message, box, onRead);
    return <div ref={box} data-testid="messages" />;
};

describe('conversation read receipts', () =>
{
    let focused = true;
    let scrollHeight = 200;
    let scrollTop = 0;
    beforeEach(() =>
    {
        vi.useFakeTimers();
        focused = true; scrollHeight = 200; scrollTop = 0;
        vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => scrollHeight);
        vi.spyOn(HTMLElement.prototype, 'scrollTop', 'get').mockImplementation(() => scrollTop);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 300, height: 200, top: 30, bottom: 230 } as DOMRect);
    });
    afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
    const settle = () => act(() => { vi.advanceTimersByTime(300); });

    it('acknowledges a focused open conversation once after it remains visible', () =>
    {
        const onRead = vi.fn();
        const view = render(<Harness onRead={onRead} />);
        expect(onRead).not.toHaveBeenCalled();
        settle();
        fireEvent.scroll(view.getByTestId('messages')); settle();
        expect(onRead).toHaveBeenCalledTimes(1);
        view.rerender(<Harness message="thread:2" onRead={onRead} />); settle();
        expect(onRead).toHaveBeenCalledTimes(2);
    });

    it('does not acknowledge the inbox, a hidden document, or a blurred window', () =>
    {
        const onRead = vi.fn();
        const view = render(<Harness active={false} onRead={onRead} />); settle();
        expect(onRead).not.toHaveBeenCalled();
        focused = false;
        view.rerender(<Harness active onRead={onRead} />); settle();
        expect(onRead).not.toHaveBeenCalled();
        focused = true;
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        fireEvent(window, new Event('focus')); settle();
        expect(onRead).not.toHaveBeenCalled();
    });

    it('waits until the recipient reaches the newest messages', () =>
    {
        scrollHeight = 600;
        const onRead = vi.fn();
        const view = render(<Harness onRead={onRead} />); settle();
        expect(onRead).not.toHaveBeenCalled();
        scrollTop = 400;
        fireEvent.scroll(view.getByTestId('messages')); settle();
        expect(onRead).toHaveBeenCalledOnce();
    });

    it('cancels a pending receipt when the conversation closes or focus is lost', () =>
    {
        const onRead = vi.fn();
        const view = render(<Harness onRead={onRead} />);
        view.rerender(<Harness active={false} onRead={onRead} />); settle();
        expect(onRead).not.toHaveBeenCalled();
        view.rerender(<Harness active onRead={onRead} />);
        focused = false; fireEvent(window, new Event('blur')); settle();
        expect(onRead).not.toHaveBeenCalled();
        focused = true; fireEvent(window, new Event('focus')); settle();
        expect(onRead).toHaveBeenCalledOnce();
    });
});
