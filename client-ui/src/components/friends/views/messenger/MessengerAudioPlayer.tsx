import { CSSProperties, useEffect, useRef, useState } from 'react';
import { FaPause, FaPlay } from 'react-icons/fa';

export const audioTime = (seconds: number) => {
    const value = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};

/** Compact real playback controls. Progress follows the media element, never a timer. */
export function MessengerAudioPlayer({ src, duration = 0 }: { src: string; duration?: number }) {
    const audio = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [length, setLength] = useState(duration);
    const [speed, setSpeed] = useState(1);
    const [error, setError] = useState('');
    useEffect(() => { setPosition(0); setPlaying(false); setError(''); setLength(duration); setSpeed(1); }, [src, duration]);
    const total = Number.isFinite(length) && length > 0 ? length : duration;
    const progress = total > 0 ? Math.min(100, position / total * 100) : 0;
    const toggle = async () => {
        const el = audio.current;
        if (!el) return;
        if (!el.paused) { el.pause(); return; }
        setError('');
        try { await el.play(); } catch { setError('Audio konnte nicht abgespielt werden. Erneut versuchen.'); }
    };
    return <div className="hmx-voice-card">
        <audio ref={audio} src={src} preload="metadata" onLoadedMetadata={e => { if (Number.isFinite(e.currentTarget.duration)) setLength(e.currentTarget.duration); }} onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPosition(0); if (audio.current) audio.current.currentTime = 0; }} onError={() => { setPlaying(false); setError('Audio konnte nicht geladen werden.'); }} />
        <button type="button" className="hmx-voice-play" onClick={() => void toggle()} aria-label={playing ? 'Sprachnachricht pausieren' : 'Sprachnachricht abspielen'}>{playing ? <FaPause /> : <FaPlay />}</button>
        <div className="hmx-voice-content"><span className="hmx-voice-label">Sprachnachricht</span><input className="hmx-voice-progress" aria-label="Audioposition" type="range" min="0" max={total || 1} step="0.05" value={Math.min(position, total || 1)} disabled={!total} style={{ '--voice-progress': `${progress}%` } as CSSProperties} onChange={e => { const value = Number(e.target.value); if (audio.current) { audio.current.currentTime = value; setPosition(value); } }} /><div className="hmx-voice-timing"><time>{audioTime(position)} / {audioTime(total)}</time><button type="button" className="hmx-voice-speed" aria-label={`Wiedergabegeschwindigkeit ${speed}x`} onClick={() => { const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; setSpeed(next); if (audio.current) audio.current.playbackRate = next; }}>{speed}×</button></div></div>
        {error && <small role="alert" className="hmx-voice-error">{error}</small>}
    </div>;
}
