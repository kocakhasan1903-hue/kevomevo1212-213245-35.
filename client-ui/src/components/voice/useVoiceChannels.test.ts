import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceChannels } from './useVoiceChannels';

vi.mock('@octane/renderer', () => ({ GetSessionDataManager: () => ({ userName: 'Test' }) }));
class Socket {
    static OPEN = 1; static all: Socket[] = [];
    readyState = 1; onopen: () => void; onclose: () => void; onmessage: (event: { data: string }) => void;
    packets: any[] = [];
    constructor() { Socket.all.push(this); }
    send(value: string) { this.packets.push(JSON.parse(value)); }
    close() { this.readyState = 3; this.onclose?.(); }
    message(header: string, data: object | string) { this.onmessage?.({ data: JSON.stringify({ header, data: { data: typeof data === 'string' ? data : JSON.stringify(data) } }) }); }
}
class Connection {
    static all: Connection[] = [];
    signalingState = 'stable'; remoteDescription: object = null; localDescription = { sdp: 'test-sdp' };
    ontrack: Function; onicecandidate: Function; onconnectionstatechange: Function;
    candidates: object[] = []; options: RTCConfiguration;
    constructor(options: RTCConfiguration) { this.options = options; Connection.all.push(this); }
    addTrack() {} close() { this.signalingState = 'closed'; }
    async createOffer() { return { type: 'offer', sdp: 'test-sdp' }; }
    async createAnswer() { return { type: 'answer', sdp: 'test-sdp' }; }
    async setLocalDescription(value: { sdp: string }) { this.localDescription = value; }
    async setRemoteDescription(value: object) { this.remoteDescription = value; }
    async addIceCandidate(value: object) { if (!this.remoteDescription) throw new Error('No remote SDP'); this.candidates.push(value); }
}
const track = { stop: vi.fn(), enabled: true, onended: null };
const media = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
let getUserMedia: ReturnType<typeof vi.fn>;
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function connected() {
    const hook = renderHook(() => useVoiceChannels());
    const socket = Socket.all.at(-1);
    act(() => { socket.onopen(); socket.message('authResponse', 'Success'); socket.message('voiceChannels', { action: 'state', channels: [], selfId: 1, rank: 1, channelId: 0 }); });
    return { ...hook, socket };
}
async function join(hook: ReturnType<typeof connected>) {
    await act(async () => { await hook.result.current.join(1); hook.socket.message('voiceChannels', { action: 'joined', channelId: 1, selfId: 1, session: 'me', peers: [], iceServers: [{ urls: 'turn:test:3479' }] }); });
}
beforeEach(() => {
    vi.useFakeTimers(); Socket.all = []; Connection.all = []; track.stop.mockClear(); track.enabled = true;
    localStorage.setItem('kubboch-sto', 'test-session');
    getUserMedia = vi.fn().mockResolvedValue(media);
    vi.stubGlobal('WebSocket', Socket); vi.stubGlobal('RTCPeerConnection', Connection);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]), addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
describe('live voice lifecycle', () => {
    it('reconnects atomically without deleting a custom channel through a preceding Leave', async () => {
        const hook = connected(); await join(hook); hook.socket.packets = [];
        await act(async () => { hook.result.current.reconnectChannel(); await settle(); });
        expect(hook.socket.packets.map(p => p.data.action)).toEqual(['voiceChannelJoin']);
        expect(track.stop).toHaveBeenCalledOnce();
    });
    it('leaves the server channel if a replacement microphone fails', async () => {
        const hook = connected(); await join(hook); hook.socket.packets = [];
        getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
        await act(async () => { await hook.result.current.join(2); });
        expect(hook.socket.packets.map(p => p.data.action)).toEqual(['voiceChannelLeave']);
        expect(hook.result.current.channelId).toBe(0);
    });
    it('never requests a microphone while merely displaying the channel list', () => { const hook = connected(); expect(hook.result.current.ready).toBe(true); expect(getUserMedia).not.toHaveBeenCalled(); });
    it('stops a permission result arriving after cancellation and never joins', async () => {
        let resolve: (value: MediaStream) => void; getUserMedia.mockReturnValue(new Promise<MediaStream>(done => resolve = done));
        const hook = connected(); let pending: Promise<void>;
        act(() => { pending = hook.result.current.join(1); }); act(() => hook.result.current.leave());
        await act(async () => { resolve(media); await pending; });
        expect(track.stop).toHaveBeenCalledOnce(); expect(hook.socket.packets.some(p => p.data.action === 'voiceChannelJoin')).toBe(false);
    });
    it('queues ICE before the remote description and permits direct audio alongside the relay', async () => {
        const hook = connected(); await join(hook);
        await act(async () => { hook.socket.message('voiceChannels', { action: 'signal', channelId: 1, from: 2, session: 'peer', signal: { type: 'candidate', candidate: { candidate: 'ice' } } }); await settle(); });
        const pc = Connection.all[0]; expect(pc.candidates).toHaveLength(0); expect(pc.options.iceTransportPolicy).toBe('all');
        await act(async () => { hook.socket.message('voiceChannels', { action: 'signal', channelId: 1, from: 2, session: 'peer', signal: { type: 'offer', sdp: 'remote' } }); await settle(); });
        expect(pc.candidates).toHaveLength(1); expect(hook.socket.packets.some(p => p.data.action === 'voiceChannelSignal' && JSON.parse(p.data.text).signal.type === 'answer')).toBe(true);
        act(() => hook.result.current.leave()); expect(pc.signalingState).toBe('closed'); expect(track.stop).toHaveBeenCalled();
    });
    it('deafening also stops outgoing audio and respects microphone mute when restored', async () => {
        const hook = connected(); await join(hook);
        act(() => hook.result.current.toggleMute()); expect(track.enabled).toBe(false);
        act(() => hook.result.current.toggleDeaf()); act(() => hook.result.current.toggleDeaf()); expect(track.enabled).toBe(false);
        act(() => hook.result.current.toggleMute()); expect(track.enabled).toBe(true);
    });
    it('disconnect closes the microphone and never rejoins automatically', async () => {
        const hook = connected(); await join(hook); act(() => hook.socket.close());
        expect(track.stop).toHaveBeenCalled(); expect(hook.result.current.channelId).toBe(0);
        act(() => vi.advanceTimersByTime(5000)); expect(getUserMedia).toHaveBeenCalledOnce();
    });
    it('reports permission denial without sending a join', async () => {
        getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError')); const hook = connected();
        await act(async () => { await hook.result.current.join(1); });
        expect(hook.result.current.error).toContain('verweigert'); expect(hook.result.current.joining).toBe(false);
        expect(hook.socket.packets.some(p => p.data.action === 'voiceChannelJoin')).toBe(false);
    });
    it('does not cancel a new join when the previous leave acknowledgement arrives late', async () => {
        const hook = connected();
        await act(async () => { await hook.result.current.join(1); hook.socket.message('voiceChannels', { action: 'left', requested: true }); hook.socket.message('voiceChannels', { action: 'joined', channelId: 1, selfId: 1, peers: [], iceServers: [] }); });
        expect(hook.result.current.channelId).toBe(1); expect(track.stop).not.toHaveBeenCalled();
    });
    it('enters the newly created channel so the creator appears in its member list', async () => {
        const hook = connected(); await act(async () => { hook.socket.message('voiceChannels', { action: 'created', channelId: 7 }); await settle(); });
        expect(getUserMedia).toHaveBeenCalledOnce(); expect(hook.socket.packets.some(p => p.data.action === 'voiceChannelJoin' && JSON.parse(p.data.text).channelId === 7)).toBe(true);
    });
    it('preserves mute across channel changes and advertises the muted state on join', async () => {
        const hook = connected(); await join(hook); act(() => hook.result.current.toggleMute());
        await act(async () => { await hook.result.current.join(2); });
        expect(track.enabled).toBe(false); expect(hook.result.current.muted).toBe(true);
        const packet = hook.socket.packets.filter(p => p.data.action === 'voiceChannelJoin').at(-1);
        expect(JSON.parse(packet.data.text)).toMatchObject({ channelId: 2, muted: true });
    });
});
