import { describe, expect, it } from 'vitest';
import { getBadgePageSize } from './badgePagination';
describe('badge pagination fits visible cells', () => {
    it('fits only complete rows and columns including gaps', () => {
        expect(getBadgePageSize(324, 136)).toBe(21);
        expect(getBadgePageSize(323, 135)).toBe(12);
    });
    it('keeps a usable page during initial layout and adapts to narrow grids', () => {
        expect(getBadgePageSize(0, 0)).toBe(1);
        expect(getBadgePageSize(89, 183)).toBe(8);
    });
});
