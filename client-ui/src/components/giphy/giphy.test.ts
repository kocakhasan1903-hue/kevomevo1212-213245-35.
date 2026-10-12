import { afterEach, expect, it, vi } from 'vitest';
import { getGiphy, giphyMessage, parseGiphyMessage, safeGiphyImage, searchGiphy } from './giphy';
afterEach(() => vi.unstubAllGlobals());
const gif = {id:'abc123',title:'Hello',images:{fixed_height:{url:'https://media2.giphy.com/media/abc123/200.gif'},fixed_width_small:{url:'https://media2.giphy.com/media/abc123/100w.gif'}}};
it('accepts only opaque provider IDs and HTTPS provider media, never arbitrary URLs', () => {
    expect(parseGiphyMessage(giphyMessage('abc123'))).toBe('abc123');
    for (const value of ['habbix-giphy:../admin','habbix-giphy:abc<script>','habbix-giphy:abc\n']) expect(parseGiphyMessage(value)).toBeNull();
    for (const value of ['javascript:alert(1)','http://media.giphy.com/a.gif','https://media.giphy.com.evil.test/a.gif','https://user:pass@media.giphy.com/a.gif']) expect(safeGiphyImage(value)).toBe('');
});
it('uses the room key, preserves result order and requests bounded search results', async () => {
    const request = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({privateApiKey:'private_test_key',roomApiKey:'room_test_key'})}).mockResolvedValueOnce({ok:true,json:async()=>({data:[gif,{...gif,id:'xyz789'}],pagination:{total_count:40}})});
    vi.stubGlobal('fetch', request);
    const result = await searchGiphy('room','Hallo & Welt',20);
    const url = new URL(request.mock.calls[1][0]);
    expect(url.origin).toBe('https://api.giphy.com'); expect(url.searchParams.get('api_key')).toBe('room_test_key');
    expect(url.searchParams.get('q')).toBe('Hallo & Welt'); expect(url.searchParams.get('rating')).toBe('g');
    expect(result.items.map(item=>item.id)).toEqual(['abc123','xyz789']); expect(result.next).toBe(22); expect(result.more).toBe(true);
});
it('does not invent results or call GIPHY without a configured key', async () => {
    const request = vi.fn().mockResolvedValue({ok:true,json:async()=>({})}); vi.stubGlobal('fetch',request);
    await expect(searchGiphy('private','',0)).rejects.toThrow('noch nicht eingerichtet'); expect(request).toHaveBeenCalledTimes(1);
});
it('loads received media through the provider and gives a useful rate-limit error', async () => {
    const request = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({privateApiKey:'private_test_key'})}).mockResolvedValueOnce({ok:false,status:429}); vi.stubGlobal('fetch',request);
    await expect(getGiphy('private','abc123')).rejects.toThrow('kurz warten');
});
