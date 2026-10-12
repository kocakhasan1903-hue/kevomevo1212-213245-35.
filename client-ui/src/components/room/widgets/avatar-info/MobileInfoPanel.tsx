import { ReactNode, useId, useState } from 'react';

export function useMobileInfoPreference(kind: 'furniture' | 'user') {
    const key = `habbix.mobile.info.${kind}`;
    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem(key) === 'open'; } catch { return false; }
    });
    const update = (value: boolean) => {
        setOpen(value);
        try { localStorage.setItem(key, value ? 'open' : 'closed'); } catch { /* Session state still works. */ }
    };
    return [open, update] as const;
}

export function MobileInfoPanel({title, label, open, onToggle, children}: {
    title: string; label: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
    const id = useId();
    return <section className={`habbix-mobile-info${open ? ' is-open' : ''}`}>
        <button type="button" className="habbix-mobile-info-toggle" aria-expanded={open} aria-controls={id}
            aria-label={`${label} ${open ? 'ausblenden' : 'einblenden'}`} onClick={onToggle}>
            <span><small>{label}</small><strong>{title}</strong></span>
            <span className="habbix-mobile-info-chevron" aria-hidden="true" />
        </button>
        <div id={id} className="habbix-mobile-info-reveal" inert={!open} aria-hidden={!open}>
            <div className="habbix-mobile-info-content">{children}</div>
        </div>
    </section>;
}
