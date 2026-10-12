import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Events and notices share normal document flow instead of independent fixed offsets. */
export function RightNoticeRail() {
    const rail = useRef<HTMLElement>(null);
    useLayoutEffect(() => {
        let wallet: HTMLElement | null = null;
        const measure = () => {
            const next = document.querySelector<HTMLElement>('.habbix-wallet-bar');
            if (next !== wallet) {
                resize.disconnect(); wallet = next;
                if (wallet) resize.observe(wallet);
            }
            const rect = wallet?.getBoundingClientRect();
            rail.current?.style.setProperty('--habbix-rail-top', `${Math.ceil((rect?.bottom ?? 80) + 10)}px`);
            rail.current?.style.setProperty('--habbix-rail-right', `${Math.max(8, Math.round(window.innerWidth - (rect?.right ?? window.innerWidth - 8)))}px`);
        };
        const resize = new ResizeObserver(measure);
        const observer = new MutationObserver(measure);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', measure);
        measure();
        return () => { resize.disconnect(); observer.disconnect(); window.removeEventListener('resize', measure); };
    }, []);
    return <aside ref={rail} className="habbix-right-rail" aria-label="Live-Events und Hotelmeldungen">
        <div className="habbix-right-event-list"><div id="habbix-right-lotto"/><div id="habbix-right-events"/></div>
        <div className="habbix-right-notice-list"><div id="habbix-right-alerts"/><div id="habbix-right-notices"/><div id="habbix-right-messages"/></div>
    </aside>;
}

export function RightRailSlot({ slot, children }: { slot: 'lotto' | 'events' | 'notices' | 'alerts' | 'messages'; children: ReactNode }) {
    const [host, setHost] = useState<HTMLElement | null>(null);
    useLayoutEffect(() => {
        const resolve = () => setHost(document.getElementById(`habbix-right-${slot}`));
        resolve();
        const observer = new MutationObserver(resolve);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [slot]);
    if (host) return createPortal(children, host);
    // Lotto can mount inside the animated wallet before the rail host exists.
    if (slot === 'lotto') return createPortal(children, document.querySelector('.octane-app-root') || document.body);
    return <>{children}</>;
}
