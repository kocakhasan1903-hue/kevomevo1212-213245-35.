export type PriceListViewName = 'list' | 'dashboard' | 'detail';

/** Each view has a different response shape. Never render a previous view's payload. */
export function validatePriceListData(value: unknown, view: PriceListViewName) {
    if (!value || typeof value !== 'object') throw new Error('Die Antwort der Preisliste ist unvollständig. Bitte erneut versuchen.');
    const data = value as Record<string, unknown>;
    const required = view === 'dashboard' ? ['trending', 'newest', 'traders', 'history'] : view === 'detail' ? ['owners', 'history'] : ['items'];
    if (required.some(key => !Array.isArray(data[key])) || (view === 'list' && (!data.summary || typeof data.summary !== 'object')) || (view === 'detail' && (!data.item || typeof data.item !== 'object'))) {
        throw new Error('Die Daten für diese Ansicht sind unvollständig. Bitte erneut versuchen.');
    }
    return {
        ...data,
        ...Object.fromEntries(['categories', 'activity', 'trending', 'newest', 'history', 'traders', 'items', 'owners'].map(key => [key, Array.isArray(data[key]) ? data[key] : []])),
    };
}
