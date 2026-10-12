export const FRIEND_BAR_TAB_WIDTH = 127;
export const FRIEND_BAR_GAP = 6;
export const FRIEND_BAR_ARROW_WIDTH = 32;
export const FRIEND_BAR_MAX_SLOTS = 4;

/** Both arrows keep their space even when disabled, so paging cannot move the toolbar. */
export function resolveFriendBarCapacity(availableWidth: number, requestsCount = 0): number {
    const requestWidth = requestsCount > 0 ? FRIEND_BAR_TAB_WIDTH + FRIEND_BAR_GAP : 0;
    const fixedWidth = 2 * FRIEND_BAR_ARROW_WIDTH + FRIEND_BAR_GAP + requestWidth;
    const slots = Math.floor((Math.max(0, availableWidth) - fixedWidth) / (FRIEND_BAR_TAB_WIDTH + FRIEND_BAR_GAP));
    return Math.max(0, Math.min(FRIEND_BAR_MAX_SLOTS, slots));
}

export function resolveFriendBarPage(friendCount: number, capacity: number, offset: number) {
    const maxOffset = capacity > 0 ? Math.max(0, friendCount - capacity) : 0;
    const safeOffset = Math.max(0, Math.min(offset, maxOffset));
    return {
        safeOffset,
        maxOffset,
        canScrollLeft: safeOffset > 0,
        canScrollRight: safeOffset < maxOffset,
        findFriendsSlots: Math.max(0, capacity - Math.min(capacity, friendCount))
    };
}
