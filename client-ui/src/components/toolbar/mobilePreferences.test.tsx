import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mobileDefaults, parseMobilePreferences, resetMobilePreferences, setMobilePreferences, useMobilePreferences, MOBILE_PREFERENCES_KEY } from './mobilePreferences';
import { MobileClientChrome } from './MobileClientChrome';
beforeEach(() => { HTMLDialogElement.prototype.close = function(){this.removeAttribute('open');}; HTMLDialogElement.prototype.showModal = function(){this.setAttribute('open','');}; });
afterEach(() => { cleanup(); resetMobilePreferences(); });
it('rejects malformed storage and validates every preference', () => {
 expect(parseMobilePreferences('broken')).toEqual(mobileDefaults);
 expect(parseMobilePreferences('{"friends":"false","wallet":false}')).toEqual({...mobileDefaults,wallet:false});
});
it('updates all subscribers and persists changes', () => {
 function View(){const p=useMobilePreferences();return <span>{p.friends?'friends visible':'friends hidden'}</span>;}
 render(<><View/><View/></>);
 act(()=>setMobilePreferences({friends:false}));
 expect(screen.getAllByText('friends hidden')).toHaveLength(2);
 expect(JSON.parse(localStorage.getItem(MOBILE_PREFERENCES_KEY)!).friends).toBe(false);
 act(resetMobilePreferences);
 expect(screen.getAllByText('friends visible')).toHaveLength(2);
});
it('keeps the restore handle outside inert navigation', () => {
 render(<MobileClientChrome><button>Navigator</button></MobileClientChrome>);
 fireEvent.click(screen.getByRole('button',{name:'Navigation einklappen'}));
 const restore=screen.getByRole('button',{name:'Navigation ausklappen'});
 expect(restore.closest('[inert]')).toBeNull();
 expect(document.getElementById('habbix-mobile-navigation')?.hasAttribute('inert')).toBe(true);
 fireEvent.click(restore);
 expect(document.getElementById('habbix-mobile-navigation')?.hasAttribute('inert')).toBe(false);
});

it('settings change visibility and keep the gear reachable', () => {
 render(<MobileClientChrome><button>Navigator</button></MobileClientChrome>);
 fireEvent.click(screen.getByRole('button',{name:'Mobile Ansicht anpassen'}));
 expect(screen.getByRole('dialog')).toBeTruthy();
 fireEvent.click(screen.getByLabelText('Guthaben anzeigen'));
 expect(document.documentElement.getAttribute('data-mobile-wallet')).toBe('false');
 fireEvent.click(screen.getByLabelText('Seitenleiste ausgeklappt'));
 expect(screen.getByRole('button',{name:'Navigation ausklappen'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Zurücksetzen'}));
 expect(document.documentElement.getAttribute('data-mobile-wallet')).toBe('true');
});

it('focus preset frees the room and detail preset restores key controls',()=>{
 render(<MobileClientChrome><button>Navigator</button></MobileClientChrome>);
 fireEvent.click(screen.getByRole('button',{name:'Mobile Ansicht anpassen'}));
 fireEvent.click(screen.getByRole('button',{name:/Mehr Raum/}));
 expect((screen.getByLabelText('Seitenleiste ausgeklappt') as HTMLInputElement).checked).toBe(false);
 expect(JSON.parse(localStorage.getItem(MOBILE_PREFERENCES_KEY)!).notices).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:/Alles im Blick/}));
 expect(JSON.parse(localStorage.getItem(MOBILE_PREFERENCES_KEY)!).notices).toBe(true);
});
