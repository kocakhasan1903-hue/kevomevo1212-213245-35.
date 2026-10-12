import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../../../../hooks/friends/directChatTransport', () => ({ isDirectChatReady: () => true, subscribeDirectChatStatus: () => () => {}, sendDirectMedia: transport.send, loadDirectMedia: vi.fn() }));
import { MessengerMediaComposer } from './MessengerMediaView';
const stopTrack = vi.fn();
class Recorder {
    static isTypeSupported = () => true;
    mimeType = 'audio/webm'; state = 'inactive'; ondataavailable: any; onstop: any;
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(200)], { type: this.mimeType }) }); this.onstop?.(); }
}
beforeEach(() => {
    vi.useFakeTimers(); transport.send.mockReset(); stopTrack.mockReset();
    vi.stubGlobal('MediaRecorder', Recorder);
    vi.stubGlobal('AudioContext', undefined);
    vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:recording', revokeObjectURL: vi.fn() });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function record() {
    await act(async () => { fireEvent.click(screen.getByLabelText('Sprachnachricht aufnehmen')); });
    act(() => { vi.advanceTimersByTime(1000); });
    fireEvent.click(screen.getByLabelText('Aufnahme stoppen'));
}
it('records inside the input bar and restores the draft after an acknowledged animated send', async () => {
    let acknowledge: () => void;
    transport.send.mockReturnValue(new Promise<void>(resolve => { acknowledge = resolve; }));
    const sent = vi.fn();
    const { container } = render(<MessengerMediaComposer peer={2} onSent={sent}><input aria-label="Nachricht" defaultValue="Entwurf"/><button>Senden</button></MessengerMediaComposer>);
    expect(screen.getByLabelText('Sprachnachricht aufnehmen').closest('.hmx-input')).toBeTruthy();
    await record();
    expect(screen.queryByLabelText('Nachricht')).toBeNull();
    expect(stopTrack).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Anhang absenden'));
    expect(sent).not.toHaveBeenCalled();
    expect(container.querySelector('[data-phase="sending"]')).toBeTruthy();
    await act(async () => acknowledge!());
    expect(sent).toHaveBeenCalledOnce();
    expect(container.querySelector('.hmx-recording.is-sent')).toBeTruthy();
    act(() => vi.advanceTimersByTime(280));
    expect(screen.getByLabelText('Nachricht')).toHaveProperty('value', 'Entwurf');
});
it('retains the recording and its message ID when upload fails', async () => {
    transport.send.mockRejectedValue(new Error('Verbindung unterbrochen'));
    render(<MessengerMediaComposer peer={2} onSent={vi.fn()}><input aria-label="Nachricht"/></MessengerMediaComposer>);
    await record();
    await act(async () => { fireEvent.click(screen.getByLabelText('Anhang absenden')); });
    expect(screen.getByRole('alert').textContent).toContain('Verbindung unterbrochen');
    const id = transport.send.mock.calls[0][3];
    await act(async () => { fireEvent.click(screen.getByLabelText('Anhang absenden')); });
    expect(transport.send.mock.calls[1][3]).toBe(id);
    fireEvent.click(screen.getByLabelText('Anhang verwerfen'));
    expect(screen.getByLabelText('Nachricht')).toBeTruthy();
});
it('draws actual microphone levels and releases the meter when cancelled', async () => {
    let sample=128;
    const close=vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('AudioContext',class {
        close=close;
        resume=()=>Promise.resolve();
        createAnalyser=()=>({fftSize:256,getByteTimeDomainData:(data:Uint8Array)=>data.fill(sample)});
        createMediaStreamSource=()=>({connect:vi.fn()});
    });
    render(<MessengerMediaComposer peer={2} onSent={vi.fn()}/>);
    await act(async()=>{fireEvent.click(screen.getByLabelText('Sprachnachricht aufnehmen'));});
    act(()=>vi.advanceTimersByTime(120));
    const wave=screen.getByLabelText('Mikrofonpegel');
    expect((wave.lastElementChild as HTMLElement).style.height).toBe('3px');
    sample=150;
    act(()=>vi.advanceTimersByTime(120));
    expect(parseInt((wave.lastElementChild as HTMLElement).style.height)).toBeGreaterThan(3);
    fireEvent.click(screen.getByLabelText('Anhang verwerfen'));
    expect(close).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
});
