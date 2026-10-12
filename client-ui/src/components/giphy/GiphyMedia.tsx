import { useEffect, useState } from 'react';
import { getGiphy, GiphyItem, GiphyScope } from './giphy';
import './Giphy.css';

export function GiphyMedia({ id, scope }: { id: string; scope: GiphyScope }) {
    const [gif, setGif] = useState<GiphyItem | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setGif(null); setError('');
        getGiphy(scope, id, controller.signal).then(setGif).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => controller.abort();
    }, [id, scope, retry]);
    return <figure className="hgp-media">
        {error ? <button type="button" onClick={() => setRetry(n => n + 1)} title={error}>GIF erneut laden</button> : gif ? <img src={gif.url} alt={gif.title} loading="lazy" onError={() => setError('GIF nicht verfügbar.')}/> : <span>GIF wird geladen …</span>}
        <figcaption>Powered by GIPHY</figcaption>
    </figure>;
}
