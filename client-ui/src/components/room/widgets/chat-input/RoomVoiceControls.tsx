import { FiX } from 'react-icons/fi';
import { HabbixActionIcon } from '../../../../common/HabbixActionIcon';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useRoomVoice } from '../../../../hooks/rooms/widgets/useRoomVoice';
import { VoiceAudioControl, voiceTime } from '../chat/RoomVoicePlayer';
import './RoomVoice.css';

export function ChatModeNotice({ message, title, onClose }: { message: string; title: string; onClose: () => void }) {
    const [expanded, setExpanded] = useState(false);
    useEffect(() => { setExpanded(false); const timeout = setTimeout(onClose, title === 'Chat' ? 3500 : 15000); return () => clearTimeout(timeout); }, [message, title, onClose]);
    if (!message) return null;
    return createPortal(<aside className="hcv-notice" role="status"><button type="button" className="hcv-notice-close" aria-label="Hinweis schließen" onClick={onClose}>×</button><small>{title}</small><p className={expanded ? '' : 'is-short'}>{message}</p>{message.length > 95 && <button type="button" className="hcv-notice-more" onClick={() => setExpanded(!expanded)}>{expanded ? 'Weniger anzeigen' : 'Mehr anzeigen …'}</button>}</aside>, document.body);
}

export function RoomVoiceControls({ voice, disabled }: { voice: ReturnType<typeof useRoomVoice>; disabled: boolean }) {
    const [sendAfterStop, setSendAfterStop] = useState(false);
    useEffect(() => {
        if (sendAfterStop && voice.phase === 'preview') { setSendAfterStop(false); void voice.send(); }
        if (voice.phase === 'idle') setSendAfterStop(false);
    }, [sendAfterStop, voice.phase, voice.send]);
    if (voice.phase === 'idle') return <button type="button" className="hcv-microphone" aria-label="Sprachnachricht aufnehmen" title="Aufnahme starten" disabled={disabled} onClick={voice.start}><HabbixActionIcon kind="microphone"/></button>;
    const sending = voice.phase === 'sending' || sendAfterStop;
    return <div className="hcv-compact" aria-label="Sprachnachricht">
        {voice.phase === 'recording' ? <>
            <button type="button" className="hcv-microphone is-recording" aria-label="Aufnahme stoppen" title="Aufnahme stoppen" onClick={voice.stop}><HabbixActionIcon kind="stop"/></button>
            <output aria-label="Aufnahmedauer">{voiceTime(voice.elapsed)}</output>
        </> : voice.phase === 'permission' ? <span className="hcv-permission" role="status" aria-label="Mikrofon wird freigegeben">…</span> : <VoiceAudioControl url={voice.preview} duration={voice.elapsed} compact/>}
        {voice.phase !== 'permission' && <button type="button" className="hcv-send" aria-label="Sprachnachricht senden" title={sending ? 'Wird gesendet …' : 'Sprachnachricht senden'} disabled={disabled || !voice.ready || sending || voice.elapsed < .3} onClick={() => { if (voice.phase === 'recording') { setSendAfterStop(true); voice.stop(); } else void voice.send(); }}>{sending ? <span>…</span> : <HabbixActionIcon kind="paperplane"/>}</button>}
        <button type="button" className="hcv-discard" aria-label="Aufnahme verwerfen" title="Aufnahme verwerfen" disabled={sending} onClick={voice.cancel}><FiX/></button>
    </div>;
}
