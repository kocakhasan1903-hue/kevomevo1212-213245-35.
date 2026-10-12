import { useEffect, useRef, useState } from 'react';
import { FaPause, FaPlay } from 'react-icons/fa';
import { ChatBubbleMessage } from '../../../../api';
import { ROOM_VOICE_REPLY } from '../../../../hooks/rooms/widgets/useRoomVoice';
import '../chat-input/RoomVoice.css';

export const voiceTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export function VoiceAudioControl({ url, duration, compact = false }: { url: string; duration: number; compact?: boolean }) {
    const audio = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [error, setError] = useState(false);
    useEffect(() => {
        const pauseOther = (event: Event) => { if ((event as CustomEvent).detail !== audio.current) audio.current?.pause(); };
        window.addEventListener('habbix-voice-play', pauseOther);
        return () => { window.removeEventListener('habbix-voice-play', pauseOther); };
    }, []);
    const play = async () => {
        const player = audio.current; if (!player) return;
        if (!player.paused) { player.pause(); return; }
        if (player.currentTime >= duration) player.currentTime = 0;
        try { window.dispatchEvent(new CustomEvent('habbix-voice-play', { detail: player })); await player.play(); setError(false); }
        catch { setError(true); }
    };
    return <div className="hcv-player" onClick={event => event.stopPropagation()}>
        <audio ref={audio} src={url} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPosition(duration); }} onError={() => setError(true)} onTimeUpdate={() => { const player = audio.current; if (!player) return; setPosition(Math.min(duration, player.currentTime)); if (player.currentTime >= Math.min(60, duration)) player.pause(); }} />
        <button type="button" className={'hcv-play' + (playing ? ' is-playing' : '')} aria-label={playing ? 'Sprachnachricht pausieren' : 'Sprachnachricht abspielen'} onClick={play}>{playing ? <FaPause/> : <FaPlay/>}</button>
        <div className="hcv-track"><input type="range" aria-label="Wiedergabeposition" min="0" max={duration || 1} step="0.1" value={position} style={{ background: `linear-gradient(to right,#2dc4b8cc ${position / (duration || 1) * 100}%,#ffffff26 ${position / (duration || 1) * 100}%)` }} onChange={event => { if (audio.current) { audio.current.currentTime = Number(event.target.value); setPosition(Number(event.target.value)); } }} /><small>{error ? (compact ? 'Fehler' : 'Audio nicht abspielbar') : compact ? voiceTime(Math.ceil(duration)) : `${voiceTime(position)} / ${voiceTime(Math.ceil(duration))}`}</small></div>
        <span className={'hcv-levels' + (playing ? ' is-playing' : '')} aria-hidden="true"><i/><i/><i/><i/><i/></span>
    </div>;
}

export function RoomVoicePlayer({ chat }: { chat: ChatBubbleMessage }) {
    return <div className="hcv-bubble">
        <div className="hcv-header"><i className="hcv-accent"/><span className="hcv-avatar">{chat.imageUrl && <img src={chat.imageUrl} alt=""/>}</span><strong>{chat.username}</strong></div>
        <VoiceAudioControl url={chat.voice.url} duration={chat.voice.duration}/>
        <button type="button" className="hcv-reply" onClick={event => { event.stopPropagation(); window.dispatchEvent(new CustomEvent(ROOM_VOICE_REPLY, { detail: { username: chat.username } })); }}>Antworten</button>
    </div>;
}
