import { useEffect } from 'react';

/** Chrome yields to client windows; the restore handle returns after closing. */
export function useMobileWindowVisibility() {
    useEffect(() => {
        let frame = 0;
        const update = () => {
            const visible = Array.from(document.querySelectorAll<HTMLElement>('.draggable-window')).some(element => {
                const style = getComputedStyle(element);
                return element.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            });
            document.documentElement.classList.toggle('habbix-mobile-window-open', visible);
        };
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
        update();
        return () => { observer.disconnect(); cancelAnimationFrame(frame); document.documentElement.classList.remove('habbix-mobile-window-open'); };
    }, []);
}
