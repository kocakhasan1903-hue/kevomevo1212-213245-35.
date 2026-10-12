import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRoomVoice } from './useRoomVoice';
vi.mock('@octane/renderer', () => ({ GetSessionDataManager: () => ({ userName: 'Test' }) }));
class Socket {
    static OPEN = 1; static latest: Socket;
    readyState = 1; onopen: () => void; onmessage: (event: { data: string }) => void; onclose: () => void;
    packets: any[] = [];
    constructor() { Socket.latest = this; }
    send(value: string) { this.packets.push(JSON.parse(value)); }
    close() { this.readyState = 3; }
    message(header: string, value: object | string) { this.onmessage?.({ data: JSON.stringify({ header, data: { data: typeof value === 'string' ? value : JSON.stringify(value) } }) }); }
}
class Recorder {
    static latest: Recorder; static isTypeSupported() { return true; }
    state = 'inactive'; mimeType = 'audio/webm;codecs=opus'; onstop: () => void; ondataavailable: (event: { data: Blob }) => void;
    constructor() { Recorder.latest = this; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(256)], { type: this.mimeType }) }); this.onstop?.(); }
}
const stop = vi.fn(); const media = { getTracks: () => [{ stop }] } as unknown as MediaStream;
let getUserMedia: ReturnType<typeof vi.fn>;
const notice = vi.fn();
function ready() {
    const hook = renderHook(({ roomId }) => useRoomVoice(roomId, notice), { initialProps: { roomId: 1 } });
    act(() => { Socket.latest.onopen(); Socket.latest.message('authResponse', 'Success'); Socket.latest.message('roomVoice', { action: 'subscribed' }); });
    return hook;
}
beforeEach(() => {
    stop.mockClear(); notice.mockClear(); localStorage.setItem('kubboch-sto', 'test');
    vi.stubGlobal('WebSocket', Socket); vi.stubGlobal('MediaRecorder', Recorder);
    getUserMedia = vi.fn().mockResolvedValue(media);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    vi.stubGlobal('FileReader', class { result = 'data:audio/webm;base64,FAKEAUDIO'; onload: () => void; readAsDataURL() { this.onload(); } });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test'); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
it('stops recording into a local preview and sends only after confirmation, retaining it until acknowledgement', async () => {
    const hook = ready(); const clock = vi.spyOn(performance, 'now').mockReturnValue(100);
    await act(async () => { await hook.result.current.start(); });
    clock.mockReturnValue(1100);
    act(() => hook.result.current.stop());
    expect(stop).toHaveBeenCalled(); expect(hook.result.current.phase).toBe('preview');
    expect(Socket.latest.packets.some(packet => packet.data.action === 'voiceSend')).toBe(false);
    await act(async () => { await hook.result.current.send(); });
    const packet = Socket.latest.packets.find(packet => packet.data.action === 'voiceSend');
    const payload = JSON.parse(packet.data.text); expect(payload.roomId).toBe(1); expect(hook.result.current.preview).toBe('blob:test');
    act(() => Socket.latest.message('roomVoice', { action: 'sent', requestId: payload.requestId }));
    expect(hook.result.current.phase).toBe('idle'); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
});
it('discards the recording and stops the microphone when changing rooms', async () => {
    const hook = ready(); await act(async () => { await hook.result.current.start(); });
    hook.rerender({ roomId: 2 });
    expect(stop).toHaveBeenCalled(); expect(hook.result.current.phase).toBe('idle'); expect(hook.result.current.preview).toBe('');
});
it('shows a useful permission-denied notice without recording or sending', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const hook = ready(); await act(async () => { await hook.result.current.start(); });
    expect(notice).toHaveBeenCalledWith(expect.stringContaining('verweigert')); expect(hook.result.current.phase).toBe('idle');
    expect(Socket.latest.packets.some(packet => packet.data.action === 'voiceSend')).toBe(false);
});
