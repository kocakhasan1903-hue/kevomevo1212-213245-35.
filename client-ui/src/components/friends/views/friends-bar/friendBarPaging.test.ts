import { describe, expect, it } from 'vitest';
import { resolveFriendBarCapacity, resolveFriendBarPage } from './friendBarPaging';

describe('friend bar paging geometry', () => {
    it('reserves both arrows and the actual six-pixel gaps before counting slots', () => {
        expect(resolveFriendBarCapacity(469)).toBe(3);
        expect(resolveFriendBarCapacity(468)).toBe(2);
        expect(resolveFriendBarCapacity(203)).toBe(1);
        expect(resolveFriendBarCapacity(202)).toBe(0);
        expect(resolveFriendBarCapacity(1000)).toBe(4);
        expect(resolveFriendBarCapacity(602)).toBe(4);
        expect(resolveFriendBarCapacity(601)).toBe(3);
        expect(resolveFriendBarCapacity(469, 1)).toBe(2);
    });

    it('clamps a later page after contacts leave or more slots become available', () => {
        expect(resolveFriendBarPage(6, 3, 3)).toMatchObject({ safeOffset: 3, canScrollLeft: true, canScrollRight: false, findFriendsSlots: 0 });
        expect(resolveFriendBarPage(4, 3, 3)).toMatchObject({ safeOffset: 1, maxOffset: 1, canScrollLeft: true, canScrollRight: false });
        expect(resolveFriendBarPage(2, 3, 3)).toMatchObject({ safeOffset: 0, canScrollLeft: false, canScrollRight: false, findFriendsSlots: 1 });
        expect(resolveFriendBarPage(6, 0, 3)).toMatchObject({ safeOffset: 0, canScrollLeft: false, canScrollRight: false });
    });
});
