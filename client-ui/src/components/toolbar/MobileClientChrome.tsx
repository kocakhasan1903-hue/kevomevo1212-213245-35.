import { ReactNode } from 'react';
import { MobileLayoutSettings } from './MobileLayoutSettings';
import { MobileNavigationToggle } from './MobileNavigationToggle';
import { setMobilePreferences, useMobilePreferences } from './mobilePreferences';
import { useMobileWindowVisibility } from './useMobileWindowVisibility';

/** The handle never belongs to the scrolling or translated navigation surface. */
export function MobileClientChrome({ children, onCollapse }: { children: ReactNode; onCollapse?: () => void }) {
    const { sidebarOpen } = useMobilePreferences();
    useMobileWindowVisibility();
    return <>
        <aside className={`habbix-mobile-sidebar${sidebarOpen ? '' : ' is-collapsed'}`} aria-label="Client Navigation">
            <div id="habbix-mobile-navigation" className="habbix-mobile-sidebar-scroll" inert={!sidebarOpen} aria-hidden={!sidebarOpen}>{children}</div>
        </aside>
        <MobileNavigationToggle collapsed={!sidebarOpen} onToggle={() => { onCollapse?.(); setMobilePreferences({ sidebarOpen: !sidebarOpen }); }} />
        <MobileLayoutSettings />
    </>;
}
