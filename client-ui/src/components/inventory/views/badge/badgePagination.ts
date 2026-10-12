/** Must match the 42px cells and 5px gaps in the badge grid. */
export function getBadgePageSize(width: number, height: number): number {
    const columns = Math.max(1, Math.floor((width + 5) / 47));
    const rows = Math.max(1, Math.floor((height + 5) / 47));
    return columns * rows;
}
