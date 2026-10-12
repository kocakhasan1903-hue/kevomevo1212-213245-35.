import { useSyncExternalStore } from 'react';

export const MOBILE_PREFERENCES_KEY = 'habbix.mobile.layout.v2';
export const mobileDefaults = { sidebarOpen: true, friends: true, wallet: true, voice: true, roomInfo: false, furniture: true, user: true, compact: false, notices: true };
export type MobilePreferences = typeof mobileDefaults;
export function parseMobilePreferences(raw: string | null): MobilePreferences {
    try {
        const stored = JSON.parse(raw || '{}');
        return Object.fromEntries(Object.entries(mobileDefaults).map(([key, value]) => [key, typeof stored?.[key] === 'boolean' ? stored[key] : value])) as MobilePreferences;
    } catch { return { ...mobileDefaults }; }
}
function read() {
    try { return parseMobilePreferences(localStorage.getItem(MOBILE_PREFERENCES_KEY)); }
    catch { return { ...mobileDefaults }; }
}
let current = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
    if (event.key === MOBILE_PREFERENCES_KEY || event.key === null) { current = read(); emit(); }
});
export function setMobilePreferences(update: Partial<MobilePreferences>) {
    current = { ...current, ...update };
    try { localStorage.setItem(MOBILE_PREFERENCES_KEY, JSON.stringify(current)); } catch { /* Keep working for this session. */ }
    emit();
}
export const resetMobilePreferences = () => setMobilePreferences(mobileDefaults);
export function useMobilePreferences() {
    return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => mobileDefaults);
}
