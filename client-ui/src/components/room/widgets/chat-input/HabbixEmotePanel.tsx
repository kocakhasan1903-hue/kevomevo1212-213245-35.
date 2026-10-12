import { HabbiconAssetManager, TriggerHabbiconComposer } from '@octane/renderer';
import { useEffect, useState } from 'react';
import { localizeHabbiconName, SendMessageComposer, useHabbiconCatalog } from '../../../../api';
import { ChatEmote, getChatEmotes, refreshChatEmotes } from '../../../../api/utils/chatEmotes';
import { LayoutHabbiconImageView } from '../../../../common';

export function HabbixEmotePanel({ insert, close }: { insert: (text: string) => void; close: () => void }) {
    const catalog = useHabbiconCatalog();
    const [category, setCategory] = useState(catalog.enabled ? 'Meine Habbicons' : 'Alle');
    const [emotes, setEmotes] = useState<ChatEmote[]>([]);
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState<number | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        void refreshChatEmotes().then(() => {
            if (active) { setEmotes(getChatEmotes()); setLoading(false); }
        }).catch(() => { if (active) { setLoading(false); setError('Text-Emotes konnten nicht geladen werden.'); } });
        return () => { active = false; };
    }, []);
    const triggerHabbicon = async (id: number) => {
        if (pending !== null) return;
        setPending(id); setError('');
        try {
            await HabbiconAssetManager.getInstance().preload();
            SendMessageComposer(new TriggerHabbiconComposer(id));
            catalog.clearUnseen(id);
            close();
        } catch { setError('Das Habbicon konnte nicht geladen werden. Bitte versuche es erneut.'); }
        finally { setPending(null); }
    };
    const filtered = emotes.filter(emote => category === 'Alle' || emote.category === category.toLowerCase());
    return <>
        <nav className="hco-tabs" aria-label="Emote-Kategorien">
            {(catalog.enabled ? ['Meine Habbicons', 'Alle', 'Standard', 'Custom', 'Premium'] : ['Alle', 'Standard', 'Custom', 'Premium']).map(value =>
                <button type="button" key={value} aria-pressed={category === value} onClick={() => { setCategory(value); setError(''); }}>{value}</button>)}
        </nav>
        {category === 'Meine Habbicons' ? <>
            <div className="hco-emotes hco-owned-habbicons">
                {catalog.ownedEntries.map(entry => <button type="button" key={entry.id} disabled={pending !== null} aria-label={`${localizeHabbiconName(entry)} im Raum senden`} onClick={() => void triggerHabbicon(entry.id)}>
                    <LayoutHabbiconImageView id={entry.id} size={36}/><small>{localizeHabbiconName(entry)}</small>
                </button>)}
            </div>
            {!catalog.ownedEntries.length && <p className="hco-empty">{catalog.loaded ? 'Du besitzt noch keine Habbicons.' : 'Deine Habbicons werden geladen …'}</p>}
            {catalog.assetError && <p role="alert" className="hco-empty">Habbicon-Bilder konnten nicht geladen werden. <button type="button" onClick={catalog.retry}>Erneut versuchen</button></p>}
            <button type="button" className="hco-habbicon-shop" onClick={() => { catalog.setBookVisible(true); close(); }}>Habbicon-Shop öffnen</button>
        </> : loading ? <p role="status" className="hco-empty">Emotes werden geladen …</p> : filtered.length ? <div className="hco-emotes">
            {filtered.map(emote => <button type="button" key={emote.keyword} title={`:${emote.keyword}:`} onClick={() => { insert(`:${emote.keyword}:`); close(); }}><img src={emote.url} alt=""/><small>:{emote.keyword}:</small></button>)}
        </div> : <p className="hco-empty">Keine Emotes gefunden.</p>}
        {error && <p className="hco-empty" role="alert">{error}</p>}
    </>;
}
