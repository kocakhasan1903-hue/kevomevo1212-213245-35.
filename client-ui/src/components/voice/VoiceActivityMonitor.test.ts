import { afterEach, expect, it, vi } from 'vitest';
import { VoiceActivityMonitor } from './VoiceActivityMonitor';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('lights for speech, ignores background noise, holds briefly across pauses and releases audio resources', () => {
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const levels = [0, 0];
    const sources: { disconnect: ReturnType<typeof vi.fn> }[] = [];
    const analysers: { disconnect: ReturnType<typeof vi.fn> }[] = [];
    const close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('AudioContext', class {
        state = 'running'; close = close; resume = vi.fn().mockResolvedValue(undefined);
        createMediaStreamSource() { const source = { connect: vi.fn(), disconnect: vi.fn() }; sources.push(source); return source; }
        createAnalyser() { const index = analysers.length; const analyser = { fftSize: 1024, disconnect: vi.fn(), getFloatTimeDomainData: (samples: Float32Array) => samples.fill(levels[index]) }; analysers.push(analyser); return analyser; }
    });
    const changed = vi.fn();
    const monitor = new VoiceActivityMonitor(changed);
    monitor.attach(1, {} as MediaStream); monitor.attach(2, {} as MediaStream);
    const tick = (ms: number) => { now += ms; vi.advanceTimersByTime(ms); };
    levels[0] = .005; tick(80); expect(changed).not.toHaveBeenCalled();
    levels[0] = .1; levels[1] = .08; tick(80);
    expect(changed.mock.calls).toEqual([[1, true], [2, true]]);
    levels[0] = 0; tick(80); expect(changed).toHaveBeenCalledTimes(2);
    tick(240); expect(changed).toHaveBeenLastCalledWith(1, false);
    monitor.remove(2); expect(changed).toHaveBeenLastCalledWith(2, false);
    expect(sources[1].disconnect).toHaveBeenCalledOnce();
    monitor.close(); expect(close).toHaveBeenCalledOnce();
    expect(sources[0].disconnect).toHaveBeenCalledOnce(); expect(analysers[0].disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
});

it('does not break a call when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined);
    const monitor = new VoiceActivityMonitor(vi.fn());
    expect(() => { monitor.attach(1, {} as MediaStream); monitor.resume(); monitor.close(); }).not.toThrow();
});
