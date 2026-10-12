import { useSyncExternalStore } from 'react';
let visible = false;
const listeners = new Set<() => void>();
export function setFriendsWindowVisible(value: boolean) {
    if (visible === value) return;
    visible = value;
    listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useFriendsWindowVisible = () => useSyncExternalStore(subscribe, () => visible);

let selectedSlot: string | null = null;
export function setFriendsSelectedSlot(value: string | null) {
    if (selectedSlot === value) return;
    selectedSlot = value;
    listeners.forEach(listener => listener());
}
export const useFriendsSelectedSlot = () => useSyncExternalStore(subscribe, () => selectedSlot);
