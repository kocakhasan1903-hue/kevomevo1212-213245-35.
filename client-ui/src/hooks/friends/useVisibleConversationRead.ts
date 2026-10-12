import { RefObject, useEffect, useRef } from 'react';

/** Receipt eligibility follows the displayed message area, never the inbox or delivery event. */
export const isConversationReadEligible = (element: HTMLElement | null, active: boolean, visible: boolean, focused: boolean): boolean =>
{
    if(!active || !visible || !focused || !element || element.clientHeight <= 0) return false;
    const bounds = element.getBoundingClientRect();
    if(bounds.height <= 0 || bounds.width <= 0 || bounds.bottom <= 0 || bounds.top >= window.innerHeight) return false;
    return element.scrollHeight - element.clientHeight - element.scrollTop <= 12;
};

export const useVisibleConversationRead = (active: boolean, contentKey: string, container: RefObject<HTMLElement | null>, onRead: () => void) =>
{
    const callback = useRef(onRead);
    callback.current = onRead;
    const acknowledged = useRef('');

    useEffect(() =>
    {
        if(!active || !contentKey) return;
        const element = container.current;
        if(!element) return;
        let timer: ReturnType<typeof setTimeout>;
        const eligible = () => isConversationReadEligible(element, active, document.visibilityState === 'visible', document.hasFocus());
        const check = () =>
        {
            clearTimeout(timer);
            if(acknowledged.current === contentKey || !eligible()) return;
            // A brief visible interval avoids acknowledging a tab that was only flashed open.
            timer = setTimeout(() =>
            {
                if(!eligible() || acknowledged.current === contentKey) return;
                acknowledged.current = contentKey;
                callback.current();
            }, 250);
        };
        element.addEventListener('scroll', check, { passive: true });
        window.addEventListener('focus', check);
        window.addEventListener('blur', check);
        document.addEventListener('visibilitychange', check);
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(check) : null;
        observer?.observe(element);
        check();
        return () =>
        {
            clearTimeout(timer);
            observer?.disconnect();
            element.removeEventListener('scroll', check);
            window.removeEventListener('focus', check);
            window.removeEventListener('blur', check);
            document.removeEventListener('visibilitychange', check);
        };
    }, [ active, contentKey, container ]);
};
