import { ReactNode, useState } from 'react';

export function MobileNoticeStack({ count, children }: { count: number; children: ReactNode }) {
    const [expanded, setExpanded] = useState(false);
    if (!count) return null;
    return <section className={`habbix-mobile-notices${expanded ? ' is-expanded' : ''}`} aria-label="Hotel Hinweise">
        <div className="habbix-mobile-notice-items">{children}</div>
        {count > 1 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Weniger anzeigen' : `${count - 1} weitere Hinweise`}<span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>}
    </section>;
}
