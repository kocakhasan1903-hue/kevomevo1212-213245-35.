import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MobileInfoPanel, useMobileInfoPreference } from './MobileInfoPanel';
function Example({kind}: {kind: 'furniture' | 'user'}) {
    const [open, setOpen] = useMobileInfoPreference(kind);
    return <MobileInfoPanel title="Auswahl" label={kind} open={open} onToggle={() => setOpen(!open)}><button>Aktion</button></MobileInfoPanel>;
}
afterEach(() => { cleanup(); localStorage.clear(); });
describe('mobile room information', () => {
    it('starts compact and removes hidden controls from interaction', () => {
        render(<Example kind="user" />);
        const toggle = screen.getByRole('button', {name: 'user einblenden'});
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByRole('button', {name: 'Aktion'})).toBeNull();
        fireEvent.click(toggle);
        expect(screen.getByRole('button', {name: 'Aktion'})).toBeTruthy();
        fireEvent.click(toggle);
        expect(screen.queryByRole('button', {name: 'Aktion'})).toBeNull();
    });
    it('remembers each info type independently after remount', () => {
        const view = render(<Example kind="furniture" />);
        fireEvent.click(screen.getByRole('button', {name: 'furniture einblenden'}));
        view.unmount();
        render(<Example kind="furniture" />);
        expect(screen.getByRole('button', {name: 'furniture ausblenden'})).toBeTruthy();
        cleanup();
        render(<Example kind="user" />);
        expect(screen.getByRole('button', {name: 'user einblenden'})).toBeTruthy();
    });
});
