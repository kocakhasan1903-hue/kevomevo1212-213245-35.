/** Measures local and received audio without routing a second copy to the speakers. */
export class VoiceActivityMonitor {
    private context: AudioContext;
    private timer: ReturnType<typeof setInterval>;
    private meters = new Map<number, { source: MediaStreamAudioSourceNode; analyser: AnalyserNode; samples: Float32Array<ArrayBuffer>; lastVoice: number; speaking: boolean }>();

    constructor(private changed: (id: number, speaking: boolean) => void) {
        try {
            this.context = new AudioContext();
            this.resume();
            this.timer = setInterval(() => this.sample(), 80);
        } catch { /* Speech indication is optional; audio calls still work without Web Audio. */ }
    }

    resume() { void this.context?.resume().catch(() => {}); }

    attach(id: number, stream: MediaStream) {
        this.remove(id);
        if (!this.context) return;
        try {
            const source = this.context.createMediaStreamSource(stream);
            const analyser = this.context.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            this.meters.set(id, { source, analyser, samples: new Float32Array(1024), lastVoice: -Infinity, speaking: false });
        } catch { /* An ended or unavailable stream has no speech indicator. */ }
    }

    private sample() {
        const now = performance.now();
        for (const [id, meter] of this.meters) {
            meter.analyser.getFloatTimeDomainData(meter.samples);
            let energy = 0;
            for (const sample of meter.samples) energy += sample * sample;
            if (this.context.state === 'running' && Math.sqrt(energy / meter.samples.length) > .018) meter.lastVoice = now;
            const speaking = now - meter.lastVoice < 240;
            if (speaking !== meter.speaking) { meter.speaking = speaking; this.changed(id, speaking); }
        }
    }

    remove(id: number) {
        const meter = this.meters.get(id);
        if (!meter) return;
        meter.source.disconnect(); meter.analyser.disconnect(); this.meters.delete(id);
        if (meter.speaking) this.changed(id, false);
    }

    close() {
        clearInterval(this.timer);
        for (const id of this.meters.keys()) this.remove(id);
        void this.context?.close().catch(() => {});
        this.context = null;
    }
}
