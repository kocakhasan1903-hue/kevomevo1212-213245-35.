import { useSyncExternalStore } from 'react';

// Primary touch input distinguishes phones/tablets from narrow desktop windows.
export const MOBILE_CLIENT_QUERY = '(pointer: coarse) and (hover: none)';
const snapshot = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_CLIENT_QUERY).matches;
const subscribe = (notify: () => void) => {
    const query = window.matchMedia(MOBILE_CLIENT_QUERY);
    query.addEventListener('change', notify);
    return () => query.removeEventListener('change', notify);
};
export const useMobileClient = () => useSyncExternalStore(subscribe, snapshot, () => false);

export const installMobileClientDetection = () => {
    const query = window.matchMedia(MOBILE_CLIENT_QUERY);
    const update = () => document.documentElement.classList.toggle('habbix-mobile-client', query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
};
