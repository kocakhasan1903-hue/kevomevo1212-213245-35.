import { createPortal } from 'react-dom';

/** Kept outside the moving rail so clipping cannot take away its handle. */
export function MobileNavigationToggle({collapsed, onToggle}: {collapsed: boolean; onToggle: () => void}) {
    return createPortal(<button type="button" className={`habbix-mobile-navigation-handle${collapsed ? ' is-collapsed' : ''}`}
        aria-expanded={!collapsed} aria-controls="habbix-mobile-navigation"
        aria-label={collapsed ? 'Navigation ausklappen' : 'Navigation einklappen'} onClick={onToggle}>
        <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
    </button>, document.body);
}
