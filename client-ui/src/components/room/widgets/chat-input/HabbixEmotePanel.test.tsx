import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HabbixEmotePanel } from './HabbixEmotePanel';

const m = vi.hoisted(() => ({
    owned: [] as { id: number; nameKey: string }[], send: vi.fn(), clear: vi.fn(), book: vi.fn(),
    preload: vi.fn(async () => {}), refresh: vi.fn(async () => {})
}));
vi.mock('@octane/renderer', () => ({ HabbiconAssetManager: { getInstance: () => ({ preload: m.preload }) }, TriggerHabbiconComposer: class { constructor(public id: number) {} } }));
vi.mock('../../../../api', () => ({ SendMessageComposer: m.send, localizeHabbiconName: (entry: { nameKey: string }) => entry.nameKey,
    useHabbiconCatalog: () => ({ enabled: true, ownedEntries: m.owned, loaded: true, assetError: '', clearUnseen: m.clear, setBookVisible: m.book, retry: vi.fn() }) }));
vi.mock('../../../../api/utils/chatEmotes', () => ({ refreshChatEmotes: m.refresh, getChatEmotes: () => [{ keyword: 'wave', category: 'standard', url: '/wave.png' }] }));
vi.mock('../../../../common', () => ({ LayoutHabbiconImageView: ({ id }: { id: number }) => <span data-testid={`habbicon-${id}`}/> }));
beforeEach(() => { m.owned = []; m.preload.mockResolvedValue(); m.refresh.mockResolvedValue(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('shows newly acquired Habbicons immediately and triggers the native room composer', async () => {
    const close = vi.fn(), insert = vi.fn();
    const view = render(<HabbixEmotePanel close={close} insert={insert}/>);
    expect(screen.getByText('Du besitzt noch keine Habbicons.')).toBeInTheDocument();
    m.owned = [{ id: 81, nameKey: 'Herz' }];
    view.rerender(<HabbixEmotePanel close={close} insert={insert}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Herz im Raum senden' }));
    await waitFor(() => expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ id: 81 })));
    expect(m.clear).toHaveBeenCalledWith(81);
    expect(close).toHaveBeenCalledOnce();
    expect(insert).not.toHaveBeenCalled();
});
it('keeps owned Habbicons usable even if the separate text-emote feed fails', async () => {
    m.owned = [{ id: 81, nameKey: 'Herz' }]; m.refresh.mockRejectedValueOnce(new Error('network'));
    render(<HabbixEmotePanel close={vi.fn()} insert={vi.fn()}/>);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Herz im Raum senden' })).toBeEnabled();
});
it('does not send or mark an item seen when its native asset fails to load', async () => {
    m.owned = [{ id: 81, nameKey: 'Herz' }]; m.preload.mockRejectedValueOnce(new Error('asset'));
    const close = vi.fn(); render(<HabbixEmotePanel close={close} insert={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Herz im Raum senden' }));
    await screen.findByRole('alert');
    expect(m.send).not.toHaveBeenCalled(); expect(m.clear).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
});
it('retains text-emotes and opens the native shop', async () => {
    const insert = vi.fn(), close = vi.fn(); render(<HabbixEmotePanel close={close} insert={insert}/>);
    fireEvent.click(screen.getByRole('button', { name: /^Alle$/ }));
    fireEvent.click(await screen.findByRole('button', { name: ':wave:' }));
    expect(insert).toHaveBeenCalledWith(':wave:');
    fireEvent.click(screen.getByRole('button', { name: 'Meine Habbicons' }));
    fireEvent.click(screen.getByRole('button', { name: 'Habbicon-Shop öffnen' }));
    expect(m.book).toHaveBeenCalledWith(true);
});
