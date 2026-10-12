import { useCallback, useEffect, useRef, useState } from 'react';
import { GetSessionDataManager } from '@octane/renderer';

export const ROOM_VOICE_MESSAGE = 'habbix-room-voice-message';
export const ROOM_VOICE_REPLY = 'habbix-room-voice-reply';
export type RoomVoiceMessage = { id: string; roomId: number; roomIndex: number; userId: number; username: string; figure: string; mime: string; audio: string; duration: number };
const MAX_BYTES = 384 * 1024;
const MAX_SECONDS = 60;
type Phase = 'idle' | 'permission' | 'recording' | 'preview' | 'sending';

export function useRoomVoice(roomId: number, onNotice: (message: string) => void) {
    const [phase, setPhase] = useState<Phase>('idle');
    const [ready, setReady] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [preview, setPreview] = useState('');
    const [reconnect, setReconnect] = useState(0);
    const connection = useRef<WebSocket>(null);
    const recorder = useRef<MediaRecorder>(null);
    const stream = useRef<MediaStream>(null);
    const clip = useRef<Blob>(null);
    const clipDuration = useRef(0);
    const previewUrl = useRef('');
    const generation = useRef(0);
    const timer = useRef<ReturnType<typeof setInterval>>(null);
    const pending = useRef('');
    const responseTimeout = useRef<ReturnType<typeof setTimeout>>(null);
    const notice = useRef(onNotice); notice.current = onNotice;

    const releaseMicrophone = useCallback(() => {
        clearInterval(timer.current); timer.current = null;
        stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    }, []);
    const cancel = useCallback(() => {
        generation.current++;
        if (recorder.current) {
            recorder.current.onstop = null; recorder.current.ondataavailable = null;
            if (recorder.current.state !== 'inactive') recorder.current.stop();
            recorder.current = null;
        }
        releaseMicrophone(); clip.current = null;
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = ''; setPreview(''); setElapsed(0); setPhase('idle');
    }, [releaseMicrophone]);

    useEffect(() => { cancel(); return cancel; }, [roomId, cancel]);

    useEffect(() => {
        setReady(false);
        if (!roomId) return;
        const token = localStorage.getItem('kubboch-sto');
        if (!token) return;
        let disposed = false;
        let retry: ReturnType<typeof setTimeout>;
        const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/habboje-ws`);
        connection.current = ws;
        const subscribe = () => ws.send(JSON.stringify({ header: 'getProfile', data: { username: GetSessionDataManager().userName, action: 'voiceSubscribe', text: JSON.stringify({ roomId, requestId: crypto.randomUUID() }) } }));
        ws.onopen = () => ws.send(JSON.stringify({ header: 'auth', data: { sso: token } }));
        ws.onmessage = event => {
            if (disposed) return;
            try {
                const message = JSON.parse(event.data);
                if (message.header === 'authResponse') {
                    if (message.data?.data === 'Success') subscribe();
                    else notice.current('Bitte auf der Webseite neu anmelden, um Sprachnachrichten zu nutzen.');
                    return;
                }
                if (message.header !== 'roomVoice') return;
                const data = JSON.parse(message.data.data);
                if (data.action === 'subscribed') { setReady(true); return; }
                if (data.action === 'message' && data.roomId === roomId && typeof data.audio === 'string' && data.audio.length <= 524292) {
                    window.dispatchEvent(new CustomEvent<RoomVoiceMessage>(ROOM_VOICE_MESSAGE, { detail: data })); return;
                }
                if (data.action === 'sent' && pending.current === data.requestId) {
                    pending.current = ''; clearTimeout(responseTimeout.current); cancel(); return;
                }
                if (data.action === 'error') {
                    if (data.requestId === pending.current) { pending.current = ''; clearTimeout(responseTimeout.current); setPhase('preview'); }
                    notice.current(data.error || 'Die Sprachnachricht konnte nicht gesendet werden.');
                }
            } catch { notice.current('Die Sprachverbindung konnte die Antwort nicht lesen.'); }
        };
        ws.onclose = () => {
            if (disposed) return;
            setReady(false);
            if (pending.current) { pending.current = ''; clearTimeout(responseTimeout.current); setPhase('preview'); notice.current('Verbindung unterbrochen. Deine Aufnahme wurde nicht bestätigt.'); }
            retry = setTimeout(() => { if (!disposed) setReconnect(value => value + 1); }, 3000);
        };
        const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ header: 'ping', data: {} })); }, 10000);
        return () => { disposed = true; clearTimeout(retry); clearInterval(ping); clearTimeout(responseTimeout.current); pending.current = ''; ws.onmessage = null; ws.onclose = null; ws.close(); connection.current = null; };
    }, [roomId, reconnect, cancel]);

    const stop = useCallback(() => {
        if (recorder.current?.state === 'recording') recorder.current.stop();
        clearInterval(timer.current);
    }, []);

    const start = useCallback(async () => {
        if (phase !== 'idle') return;
        if (!ready) { setReconnect(value => value + 1); notice.current('Die Sprachverbindung wird aufgebaut. Bitte anschließend erneut auf das Mikrofon klicken.'); return; }
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            notice.current('Dieser Browser unterstützt keine Mikrofonaufnahme. Öffne das Hotel über HTTPS in einem aktuellen Browser.'); return;
        }
        const current = ++generation.current;
        setPhase('permission');
        try {
            const source = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
            if (generation.current !== current) { source.getTracks().forEach(track => track.stop()); return; }
            stream.current = source;
            const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
            if (!mime) throw new Error('format');
            const media = new MediaRecorder(source, { mimeType: mime, audioBitsPerSecond: 48000 });
            recorder.current = media;
            const chunks: Blob[] = []; let bytes = 0; const started = performance.now();
            media.ondataavailable = event => {
                if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
                if (bytes > MAX_BYTES && media.state === 'recording') media.stop();
            };
            media.onerror = () => { cancel(); notice.current('Die Aufnahme wurde unterbrochen. Bitte versuche es erneut.'); };
            media.onstop = () => {
                releaseMicrophone(); recorder.current = null;
                if (generation.current !== current) return;
                const duration = Math.min(MAX_SECONDS, (performance.now() - started) / 1000);
                const blob = new Blob(chunks, { type: media.mimeType });
                if (blob.size < 128 || blob.size > MAX_BYTES || duration < .3) { cancel(); notice.current(blob.size > MAX_BYTES ? 'Die Aufnahme ist zu groß. Bitte kürzer aufnehmen.' : 'Die Aufnahme war zu kurz. Bitte erneut aufnehmen.'); return; }
                clip.current = blob; clipDuration.current = duration;
                previewUrl.current = URL.createObjectURL(blob); setPreview(previewUrl.current); setElapsed(duration); setPhase('preview');
            };
            media.start(250); setElapsed(0); setPhase('recording');
            timer.current = setInterval(() => { const seconds = (performance.now() - started) / 1000; setElapsed(Math.min(MAX_SECONDS, seconds)); if (seconds >= MAX_SECONDS) stop(); }, 200);
        } catch (error) {
            if (generation.current !== current) return;
            releaseMicrophone(); setPhase('idle');
            const name = (error as DOMException)?.name;
            notice.current(name === 'NotAllowedError' || name === 'SecurityError'
                ? 'Mikrofonzugriff wurde verweigert. Erlaube den Zugriff in den Website-Einstellungen deines Browsers und versuche es erneut.'
                : name === 'NotFoundError' ? 'Kein Mikrofon gefunden. Schließe ein Mikrofon an und versuche es erneut.'
                : 'Das Mikrofon konnte nicht gestartet werden. Prüfe, ob es angeschlossen oder bereits von einer anderen Anwendung belegt ist.');
        }
    }, [phase, ready, cancel, releaseMicrophone, stop]);

    const send = useCallback(async () => {
        if (phase !== 'preview' || !clip.current || !ready || connection.current?.readyState !== WebSocket.OPEN) return;
        const current = generation.current;
        const blob = clip.current;
        setPhase('sending');
        try {
            const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
            if (generation.current !== current) return;
            if (connection.current?.readyState !== WebSocket.OPEN) throw new Error('disconnected');
            pending.current = crypto.randomUUID();
            connection.current.send(JSON.stringify({ header: 'getProfile', data: { username: GetSessionDataManager().userName, action: 'voiceSend', text: JSON.stringify({ roomId, requestId: pending.current, mime: blob.type, duration: clipDuration.current, audio: data }) } }));
            responseTimeout.current = setTimeout(() => { pending.current = ''; setPhase('preview'); notice.current('Das Senden wurde nicht bestätigt. Prüfe den Raumchat, bevor du erneut sendest.'); }, 20000);
        } catch { setPhase('preview'); notice.current('Die Aufnahme konnte nicht gesendet werden. Bitte erneut versuchen.'); }
    }, [roomId, ready, phase]);

    return { phase, ready, elapsed, preview, start, stop, cancel, send };
}
