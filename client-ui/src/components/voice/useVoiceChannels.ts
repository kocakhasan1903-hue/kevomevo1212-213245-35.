import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceActivityMonitor } from './VoiceActivityMonitor';
import { GetSessionDataManager } from '@octane/renderer';

export type VoiceMember = { id: number; session: string; name: string; figure: string; muted: boolean; deaf: boolean };
export type VoiceChannel = { id: number; owner: number; name: string; limit: number; members: VoiceMember[] };
type Peer = { pc: RTCPeerConnection; audio: HTMLAudioElement; session: string; queue: Promise<void>; candidates: RTCIceCandidateInit[]; timer: ReturnType<typeof setTimeout>; initiator: boolean; restarted: boolean };
type OutputAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

export function useVoiceChannels() {
    const [channels, setChannels] = useState<VoiceChannel[]>([]);
    const [selfId, setSelfId] = useState(0);
    const [rank, setRank] = useState(0);
    const [configuration,setConfiguration]=useState({voiceEnabled:true,maxNameLength:32,maxParticipants:8,moderationRank:7});
    const [channelId, setChannelId] = useState(0);
    const [ready, setReady] = useState(false);
    const [joining, setJoining] = useState(false);
    const [muted, setMuted] = useState(false);
    const [deaf, setDeaf] = useState(false);
    const [error, setError] = useState('');
    const [blockedAudio, setBlockedAudio] = useState(false);
    const [speaking, setSpeaking] = useState<Record<number, boolean>>({});
    const activity = useRef<VoiceActivityMonitor>(null);
    const [peerStates, setPeerStates] = useState<Record<number, string>>({});
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [volume, setVolume] = useState(80);
    const ws = useRef<WebSocket>(null);
    const local = useRef<MediaStream>(null);
    const peers = useRef(new Map<number, Peer>());
    const active = useRef(0);
    const generation = useRef(0);
    const wantsJoin = useRef(false);
    const isMuted = useRef(false);
    const isDeaf = useRef(false);
    const outputId = useRef('');
    const loudness = useRef(.8);
    const ice = useRef<RTCIceServer[]>([]);
    const joiningTimer = useRef<ReturnType<typeof setTimeout>>(null);
    const [retry, setRetry] = useState(0);
    const joinCreated = useRef<(id: number) => Promise<void>>(null);

    const send = useCallback((action: string, data: object = {}) => {
        if (ws.current?.readyState !== WebSocket.OPEN) return false;
        ws.current.send(JSON.stringify({ header: 'getProfile', data: { username: GetSessionDataManager().userName, action: `voiceChannel${action}`, text: JSON.stringify(data) } })); return true;
    }, []);
    const closePeer = useCallback((id: number) => {
        const peer = peers.current.get(id); if (!peer) return;
        activity.current?.remove(id);
        clearTimeout(peer.timer); peer.pc.onconnectionstatechange = null; peer.pc.onicecandidate = null; peer.pc.ontrack = null;
        peer.pc.close(); peer.audio.pause(); peer.audio.srcObject = null; peer.audio.remove(); peers.current.delete(id);
        setPeerStates(state => { const next = { ...state }; delete next[id]; return next; });
    }, []);
    const cleanup = useCallback(() => {
        activity.current?.close(); activity.current = null; setSpeaking({});
        generation.current++; wantsJoin.current = false; clearTimeout(joiningTimer.current);
        local.current?.getTracks().forEach(track => track.stop()); local.current = null;
        [...peers.current.keys()].forEach(closePeer); active.current = 0; setChannelId(0); setJoining(false); setBlockedAudio(false);
    }, [closePeer]);
    const leave = useCallback(() => { send('Leave'); cleanup(); }, [cleanup, send]);
    const refreshDevices = useCallback(async () => {
        try { if (navigator.mediaDevices?.enumerateDevices) setDevices(await navigator.mediaDevices.enumerateDevices()); } catch { /* Device labels may be unavailable until permission is granted. */ }
    }, []);

    const makePeer = useCallback((id: number, session: string) => {
        const existing = peers.current.get(id); if (existing?.session === session) return existing;
        if (existing) closePeer(id);
        const pc = new RTCPeerConnection({ iceServers: ice.current, iceTransportPolicy: 'all' });
        const audio = new Audio() as OutputAudio; audio.autoplay = true; audio.muted = isDeaf.current; audio.volume = loudness.current;
        audio.hidden = true; audio.dataset.voicePeer = String(id); audio.setAttribute('playsinline', ''); document.body.appendChild(audio);
        if (outputId.current && audio.setSinkId) audio.setSinkId(outputId.current).catch(() => setError('Die Tonausgabe konnte nicht gewechselt werden.'));
        const peer: Peer = { pc, audio, session, queue: Promise.resolve(), candidates: [], timer: null, initiator: false, restarted: false }; peers.current.set(id, peer);
        local.current?.getAudioTracks().forEach(track => pc.addTrack(track, local.current));
        pc.onicecandidate = event => { if (event.candidate) send('Signal', { target: id, targetSession: session, signal: { type: 'candidate', candidate: event.candidate.toJSON() } }); };
        pc.ontrack = event => {
            const stream = event.streams[0] || new MediaStream([event.track]);
            audio.srcObject = stream; activity.current?.attach(id, stream);
            const play = () => { if (peers.current.get(id) === peer) audio.play().catch(() => setBlockedAudio(true)); };
            event.track.onunmute = play; play();
        };
        const fail = () => { if (peers.current.get(id) !== peer) return; setPeerStates(state => ({ ...state, [id]: 'failed' })); setError('Eine Sprachverbindung ist unterbrochen. Bitte den Kanal erneut betreten.'); };
        peer.timer = setTimeout(fail, 25000);
        pc.onconnectionstatechange = () => {
            setPeerStates(state => ({ ...state, [id]: pc.connectionState }));
            if (pc.connectionState === 'connected') clearTimeout(peer.timer);
            if (pc.connectionState === 'failed') {
                if (peer.initiator && !peer.restarted) {
                    peer.restarted = true;
                    peer.queue = peer.queue.then(async () => { if (pc.signalingState === 'closed') return; await pc.setLocalDescription(await pc.createOffer({ iceRestart: true })); send('Signal', { target: id, targetSession: session, signal: { type: 'offer', sdp: pc.localDescription.sdp } }); }).catch(fail);
                    clearTimeout(peer.timer); peer.timer = setTimeout(fail, 20000);
                } else fail();
            }
            if (pc.connectionState === 'disconnected') { clearTimeout(peer.timer); peer.timer = setTimeout(fail, 15000); }
        };
        return peer;
    }, [closePeer, send]);

    useEffect(() => {
        let disposed = false; let reconnect: ReturnType<typeof setTimeout>; let authenticated = false;
        const token = localStorage.getItem('kubboch-sto'); if (!token) return;
        const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/habboje-ws`); ws.current = socket;
        const timeout = setTimeout(() => { if (!authenticated) socket.close(); }, 15000);
        socket.onopen = () => socket.send(JSON.stringify({ header: 'auth', data: { sso: token } }));
        socket.onmessage = event => {
            if (disposed) return;
            try {
                const message = JSON.parse(event.data);
                if (message.header === 'authResponse') { if (message.data?.data === 'Success') { authenticated = true; clearTimeout(timeout); send('List'); } else { setError('Bitte auf der Webseite erneut anmelden.'); socket.close(); } return; }
                if (message.header !== 'voiceChannels') return;
                const data = JSON.parse(message.data.data);
                if (data.action === 'created') { joinCreated.current?.(data.channelId); return; }
                if (data.action === 'state') { setChannels(data.channels); setSelfId(data.selfId); setRank(data.rank); if(data.settings)setConfiguration(data.settings); setReady(true); if (active.current && !data.channelId) cleanup(); return; }
                if (data.action === 'error') { setError(data.error); if (data.operation === 'voiceChannelJoin') { send('Leave'); cleanup(); } return; }
                if (data.action === 'left' && data.requested) return;
                if (['left', 'replaced', 'kicked'].includes(data.action)) { cleanup(); if (data.action === 'kicked') setError('Du wurdest aus dem Sprachkanal entfernt.'); if (data.action === 'replaced') { setError('Die Sprachkanäle sind in einem anderen Client geöffnet.'); socket.onclose = null; socket.close(); setReady(false); } return; }
                if (data.action === 'joined') {
                    if (!wantsJoin.current || !local.current) { send('Leave'); return; }
                    activity.current?.attach(data.selfId, local.current);
                    clearTimeout(joiningTimer.current); wantsJoin.current = false; active.current = data.channelId; ice.current = data.iceServers; setChannelId(data.channelId); setJoining(false);
                    for (const member of data.peers as VoiceMember[]) {
                        const peer = makePeer(member.id, member.session);
                        peer.initiator = true;
                        peer.queue = peer.queue.then(async () => { if (peer.pc.signalingState === 'closed') return; await peer.pc.setLocalDescription(await peer.pc.createOffer()); if (peers.current.get(member.id) === peer) send('Signal', { target: member.id, targetSession: member.session, signal: { type: 'offer', sdp: peer.pc.localDescription.sdp } }); }).catch(() => { if (peers.current.get(member.id) === peer) setError('Sprachverbindung fehlgeschlagen. Bitte erneut beitreten.'); });
                    }
                    return;
                }
                if (data.action === 'peerLeft') { if (peers.current.get(data.id)?.session === data.session) closePeer(data.id); return; }
                if (data.action === 'signal' && active.current && data.channelId === active.current && local.current) {
                    const peer = makePeer(data.from, data.session);
                    peer.queue = peer.queue.then(async () => {
                        if (peer.pc.signalingState === 'closed') return;
                        const signal = data.signal;
                        if (signal.type === 'candidate') { if (!peer.pc.remoteDescription) peer.candidates.push(signal.candidate); else await peer.pc.addIceCandidate(signal.candidate); return; }
                        await peer.pc.setRemoteDescription({ type: signal.type, sdp: signal.sdp });
                        for (const candidate of peer.candidates.splice(0)) await peer.pc.addIceCandidate(candidate);
                        if (signal.type === 'offer') { await peer.pc.setLocalDescription(await peer.pc.createAnswer()); send('Signal', { target: data.from, targetSession: data.session, signal: { type: 'answer', sdp: peer.pc.localDescription.sdp } }); }
                    }).catch(() => { if (peer.pc.signalingState !== 'closed') setError('Ein Gesprächspartner konnte nicht verbunden werden. Bitte erneut beitreten.'); });
                }
            } catch { setError('Die Sprachverbindung konnte die Antwort nicht lesen.'); }
        };
        socket.onclose = () => { if (disposed) return; setReady(false); if (active.current || wantsJoin.current) setError('Verbindung unterbrochen. Dein Mikrofon ist ausgeschaltet. Bitte erneut beitreten.'); cleanup(); reconnect = setTimeout(() => setRetry(value => value + 1), 5000); };
        const heartbeat = setInterval(() => { if (authenticated) send('List'); }, 20000);
        return () => { disposed = true; clearInterval(heartbeat); clearTimeout(timeout); clearTimeout(reconnect); socket.onclose = null; socket.onmessage = null; socket.close(); cleanup(); };
    }, [retry, cleanup, closePeer, makePeer, send]);

    useEffect(() => { refreshDevices(); navigator.mediaDevices?.addEventListener('devicechange', refreshDevices); return () => navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices); }, [refreshDevices]);
    const join = async (id: number, reconnect = false) => {
        if (!ready || joining || (!reconnect && active.current === id)) return;
        cleanup(); setError(''); setJoining(true); wantsJoin.current = true;
        const version = ++generation.current;
        activity.current = new VoiceActivityMonitor((memberId, talking) => setSpeaking(state => ({ ...state, [memberId]: talking })));
        try {
            if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') throw new Error('unsupported');
            const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(input ? { deviceId: { exact: input } } : {}) }, video: false });
            if (version !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
            local.current = media; refreshDevices();
            media.getAudioTracks().forEach(track => track.enabled = !isMuted.current && !isDeaf.current);
            media.getAudioTracks().forEach(track => track.onended = () => { leave(); setError('Das Mikrofon wurde getrennt. Bitte erneut beitreten.'); });
            if (!send('Join', { channelId: id, muted: isMuted.current || isDeaf.current, deaf: isDeaf.current })) throw new Error('offline');
            joiningTimer.current = setTimeout(() => { leave(); setError('Der Sprachserver antwortet nicht. Bitte erneut versuchen.'); }, 15000);
        } catch (reason) {
            if (version !== generation.current) return;
            send('Leave'); cleanup(); setError((reason as Error).name === 'NotAllowedError' ? 'Mikrofonzugriff wurde verweigert. Bitte erlaube den Zugriff in den Website-Einstellungen deines Browsers.' : (reason as Error).name === 'NotFoundError' ? 'Kein Mikrofon gefunden. Bitte ein Mikrofon anschließen.' : 'Mikrofon nicht verfügbar. Prüfe dein Gerät und öffne das Hotel über HTTPS.');
        }
    };
    const updateStatus = () => { local.current?.getAudioTracks().forEach(track => track.enabled = !isMuted.current && !isDeaf.current); peers.current.forEach(peer => peer.audio.muted = isDeaf.current); send('Status', { muted: isMuted.current || isDeaf.current, deaf: isDeaf.current }); };
    joinCreated.current = join;
    const toggleMute = () => { isMuted.current = !isMuted.current; setMuted(isMuted.current); updateStatus(); };
    const toggleDeaf = () => { isDeaf.current = !isDeaf.current; setDeaf(isDeaf.current); updateStatus(); };
    const changeOutput = async (id: string) => { try { await Promise.all([...peers.current.values()].map(peer => (peer.audio as OutputAudio).setSinkId?.(id))); outputId.current = id; setOutput(id); } catch { setError('Dieser Lautsprecher kann nicht ausgewählt werden.'); } };
    const changeVolume = (value: number) => { setVolume(value); loudness.current = value / 100; peers.current.forEach(peer => peer.audio.volume = value / 100); };
    const resumeAudio = () => { activity.current?.resume(); Promise.all([...peers.current.values()].map(peer => peer.audio.play())).then(() => setBlockedAudio(false)).catch(() => setError('Bitte die Audiowiedergabe im Browser erlauben.')); };
    const reconnectChannel = () => { const id = active.current; if (id) void join(id, true); };
    return { configuration, channels, selfId, rank, channelId, ready, joining, muted, deaf, error, setError, peerStates, speaking, blockedAudio, resumeAudio, join, leave, reconnectChannel, toggleMute, toggleDeaf, send, devices, input, setInput, output, changeOutput, volume, changeVolume };
}
