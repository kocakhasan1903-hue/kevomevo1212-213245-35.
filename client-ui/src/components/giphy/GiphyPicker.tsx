import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiSearch, FiX, FiUpload } from 'react-icons/fi';
import { HabbixActionIcon } from '../../common/HabbixActionIcon';
import { GiphyItem, GiphyScope, searchGiphy } from './giphy';
import './Giphy.css';

export function GiphyPicker({ scope, onSend, onUpload, disabled = false }: { scope: GiphyScope; onSend: (gif: GiphyItem) => Promise<void> | void; onUpload?: () => void; disabled?: boolean }) {
    const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [search, setSearch] = useState('');
    const [items, setItems] = useState<GiphyItem[]>([]), [offset, setOffset] = useState(0), [next, setNext] = useState(0), [more, setMore] = useState(false);
    const [selected, setSelected] = useState<GiphyItem | null>(null), [loading, setLoading] = useState(false), [sending, setSending] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
    const [position, setPosition] = useState({ left: 8, top: 8, width: 340, height: 380 });
    const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), sendingRef = useRef(false);
    const close = () => { if (!sendingRef.current) { setOpen(false); trigger.current?.focus(); } };
    useEffect(() => { if (!open) return; const timer = setTimeout(() => { setOffset(0); setSearch(query.trim()); }, 350); return () => clearTimeout(timer); }, [query, open]);
    useEffect(() => {
        if (!open) return;
        const controller = new AbortController(); let active = true;
        setLoading(true); setError(''); if (!offset) setItems([]);
        const timeout = setTimeout(() => { controller.abort(); if (active) { setError('GIPHY antwortet gerade nicht. Bitte erneut versuchen.'); setLoading(false); } }, 12000);
        searchGiphy(scope, search, offset, controller.signal).then(result => {
            if (!active) return;
            setItems(previous => offset ? [...previous, ...result.items] : result.items); setNext(result.next); setMore(result.more);
        }).catch(e => { if (active && !controller.signal.aborted) setError(e.message); }).finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
        return () => { active = false; clearTimeout(timeout); controller.abort(); };
    }, [open, search, offset, scope, retry]);
    useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
            const view = window.visualViewport, vw = view?.width || window.innerWidth, vh = view?.height || window.innerHeight, x = view?.offsetLeft || 0, y = view?.offsetTop || 0;
            const anchor = trigger.current!.getBoundingClientRect(), width = Math.min(340, vw - 16), height = Math.min(380, vh - 24);
            setPosition({ left: Math.max(x + 8, Math.min(anchor.right - width, x + vw - width - 8)), top: Math.max(y + 12, Math.min(anchor.top - height - 8, y + vh - height - 12)), width, height });
        };
        place(); input.current?.focus();
        const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
        window.addEventListener('resize', place); window.visualViewport?.addEventListener('resize', place); document.addEventListener('pointerdown', outside);
        return () => { window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place); document.removeEventListener('pointerdown', outside); };
    }, [open]);
    useEffect(() => { if (disabled && !sendingRef.current) setOpen(false); }, [disabled]);
    const send = async () => {
        if (!selected || sendingRef.current || disabled) return;
        sendingRef.current = true; setSending(true); setError('');
        try { await onSend(selected); setSelected(null); setOpen(false); trigger.current?.focus(); }
        catch (e) { setError((e as Error).message || 'GIF konnte nicht gesendet werden.'); }
        finally { sendingRef.current = false; setSending(false); }
    };
    return <><button ref={trigger} type="button" className="hgp-trigger" aria-label={scope === 'room' ? 'GIF im Raum senden' : 'GIF im Chat senden'} title="GIPHY – GIF auswählen" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => { setSelected(null); setOpen(value => !value); }}><HabbixActionIcon kind="gif"/></button>
        {open && createPortal(<div ref={panel} className="hgp-picker" style={position} role="dialog" aria-label="GIF auswählen" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
            <header><strong>GIF auswählen</strong><button type="button" aria-label="GIF-Auswahl schließen" disabled={sending} onClick={close}><FiX/></button></header>
            <label className="hgp-search"><FiSearch/><input ref={input} aria-label="GIPHY durchsuchen" placeholder="GIPHY durchsuchen …" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} disabled={sending}/></label>
            <div className="hgp-results" aria-busy={loading}>
                {selected ? <div className="hgp-selection"><img src={selected.url} alt={selected.title}/><button type="button" disabled={sending} onClick={() => setSelected(null)}>Anderes GIF auswählen</button></div> : <><div className="hgp-grid">{items.map((gif, index) => <button type="button" key={`${gif.id}:${index}`} aria-label={gif.title} onClick={() => setSelected(gif)}><img src={gif.preview} alt={gif.title} loading="lazy"/></button>)}</div>{loading && <p role="status">GIFs werden geladen …</p>}{!loading && !error && !items.length && <p>Keine GIFs gefunden.</p>}{!loading && more && !error && <button className="hgp-more" type="button" onClick={() => setOffset(next)}>Mehr GIFs</button>}</>}
                {error && <div className="hgp-error" role="alert"><p>{error}</p>{!selected && <button type="button" onClick={() => setRetry(value => value + 1)}>Erneut versuchen</button>}</div>}
            </div>
            <footer><span className="hgp-attribution">Powered by <strong>GIPHY</strong></span>{selected ? <button type="button" className="hgp-send" disabled={sending || disabled} onClick={() => void send()}><HabbixActionIcon kind="send"/>{sending ? 'Sendet …' : 'GIF senden'}</button> : onUpload && <button type="button" onClick={() => { close(); onUpload(); }}><FiUpload/>Eigene GIF</button>}</footer>
        </div>, document.querySelector('.octane-app-root') || document.body)}
    </>;
}
