export type GiphyScope = 'private' | 'room';
export type GiphyItem = { id: string; title: string; url: string; preview: string };
const ID = /^[a-zA-Z0-9]{1,64}$/;

export function parseGiphyMessage(message: string): string | null {
    const match = /^habbix-giphy:([a-zA-Z0-9]{1,64})$/.exec(message);
    return match?.[0] === message ? match[1] : null;
}
export function giphyMessage(id: string): string {
    if (!ID.test(id) || id.trim() !== id) throw new Error('Ungültiges GIF.');
    return `habbix-giphy:${id}`;
}
export function safeGiphyImage(value: unknown): string {
    if (typeof value !== 'string') return '';
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && /^media\d*\.giphy\.com$/.test(url.hostname) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
}
function item(data: any): GiphyItem | null {
    if (!data || !ID.test(data.id || '')) return null;
    const url = safeGiphyImage(data.images?.fixed_height?.url || data.images?.original?.url);
    const preview = safeGiphyImage(data.images?.fixed_width_small?.url) || url;
    return url ? { id: data.id, title: String(data.title || 'GIF'), url, preview } : null;
}
async function request(scope: GiphyScope, endpoint: string, params: Record<string, string>, signal?: AbortSignal) {
    // GIPHY's browser API uses public, separate integration keys for each surface.
    const configResponse = await fetch(new URL('configuration/giphy.json', document.baseURI), { signal, cache: 'no-store', credentials: 'same-origin' });
    if (!configResponse.ok) throw new Error('Die GIF-Suche ist noch nicht eingerichtet.');
    const config = await configResponse.json().catch(() => null);
    const key = config?.[scope === 'room' ? 'roomApiKey' : 'privateApiKey'];
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(key)) throw new Error('Die GIF-Suche ist noch nicht eingerichtet.');
    const query = new URLSearchParams({ api_key: key, ...params });
    const response = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${query}`, { signal, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' });
    if (!response.ok) throw new Error(response.status === 429 ? 'Zu viele GIF-Suchen. Bitte kurz warten.' : 'GIPHY ist gerade nicht erreichbar. Bitte erneut versuchen.');
    return response.json();
}
export async function searchGiphy(scope: GiphyScope, query: string, offset: number, signal?: AbortSignal) {
    const result = await request(scope, query ? 'search' : 'trending', { ...(query ? { q: query, lang: 'de' } : {}), limit: '20', offset: String(offset), rating: 'g' }, signal);
    const entries = Array.isArray(result.data) ? result.data : [];
    return { items: entries.map(item).filter(Boolean) as GiphyItem[], next: offset + entries.length, more: entries.length > 0 && offset + entries.length < (result.pagination?.total_count || 0) };
}
export async function getGiphy(scope: GiphyScope, id: string, signal?: AbortSignal): Promise<GiphyItem> {
    if (!ID.test(id) || id.trim() !== id) throw new Error('Ungültiges GIF.');
    const result = item((await request(scope, id, {}, signal)).data);
    if (!result) throw new Error('Dieses GIF ist nicht mehr verfügbar.');
    return result;
}
