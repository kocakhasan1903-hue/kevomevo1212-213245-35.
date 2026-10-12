import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MobilePreferences, resetMobilePreferences, setMobilePreferences, useMobilePreferences } from './mobilePreferences';

const options: [keyof MobilePreferences, string][] = [
    ['sidebarOpen', 'Seitenleiste ausgeklappt'], ['friends', 'Online-Freunde unten'],
    ['wallet', 'Guthaben anzeigen'], ['voice', 'Sprachkanäle anzeigen'],
    ['roomInfo', 'Rauminformationen anzeigen'], ['furniture', 'Möbelinfo bei Auswahl'],
    ['user', 'Nutzerinfo bei Auswahl'], ['compact', 'Kompakte Symbolabstände'], ['notices', 'Hotel-Hinweise anzeigen']
];
export function MobileLayoutSettings() {
    const preferences = useMobilePreferences();
    const [open, setOpen] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const root = document.documentElement;
        for (const key of ['wallet', 'voice', 'compact'] as const) root.setAttribute(`data-mobile-${key}`, String(preferences[key]));
        return () => { for (const key of ['wallet', 'voice', 'compact']) root.removeAttribute(`data-mobile-${key}`); };
    }, [preferences]);
    useEffect(() => {
        if (open) dialog.current?.showModal();
        else dialog.current?.close();
    }, [open]);
    return createPortal(<>
        <button type="button" className="habbix-mobile-settings-button" aria-label="Mobile Ansicht anpassen" aria-expanded={open} onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 3-1 3-3 1-2 4 2 2v3l4 3 3-1 3 1 4-3v-3l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="11" r="3"/></svg>
        </button>
        <dialog ref={dialog} className="habbix-mobile-settings" aria-labelledby="mobile-settings-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
            <header><div><small>DEIN CLIENT</small><h2 id="mobile-settings-title">Mobile Ansicht</h2></div><button type="button" aria-label="Einstellungen schließen" onClick={() => setOpen(false)}>×</button></header>
            <p>Dein Hotel, so wie du es brauchst.</p>
            <div className="habbix-mobile-presets" aria-label="Schnelle Ansichten"><button type="button" onClick={() => setMobilePreferences({sidebarOpen:false,voice:false,roomInfo:false,notices:false,compact:true})}><strong>Mehr Raum</strong><small>Weniger Anzeigen, mehr Spielfläche</small></button><button type="button" onClick={() => setMobilePreferences({sidebarOpen:true,friends:true,wallet:true,voice:true,notices:true,compact:false})}><strong>Alles im Blick</strong><small>Freunde und Werkzeuge griffbereit</small></button></div>
            <div className="habbix-mobile-settings-options">{options.map(([key, label]) => <label key={key}><span>{label}</span><input role="switch" type="checkbox" checked={preferences[key]} onChange={event => setMobilePreferences({ [key]: event.target.checked })}/></label>)}</div>
            <footer><button type="button" onClick={resetMobilePreferences}>Zurücksetzen</button><button type="button" className="primary" onClick={() => setOpen(false)}>Fertig</button></footer>
            <small className="habbix-mobile-settings-note">Wird auf diesem Gerät gespeichert.</small>
        </dialog>
    </>, document.body);
}
