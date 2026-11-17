/**
 * Polyphonic Web Audio Additive Synthesizer & Real-Time FFT Analyzer
 * Lead Creative Technologist & Systems Architect: أ. طارق ابوعشي | Tareq Abuashi
 */

export type SynthTimbre = 'sine' | 'additive' | 'crystal';

interface ActiveVoice {
  oscillators: OscillatorNode[];
  voiceGain: GainNode;
  freq: number;
}

export class AudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  private voices: Map<string, ActiveVoice> = new Map();

  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(512));
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));

  public enabled = false;
  public continuousDrone = false;
  public volume = 0.35;
  public timbre: SynthTimbre = 'additive';
  public currentFreq = 432.0;

  private ensureContext(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.15;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.enabled ? this.volume : 0;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.82;

      this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) {
      this.ensureContext();
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(on ? this.volume : 0, now, 0.03);
    }
    if (!on) {
      this.stopDrone();
      this.stopAllNotes();
    } else if (this.continuousDrone) {
      this.startDrone(this.currentFreq);
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain && this.enabled) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.025);
    }
  }

  public setTimbre(timbre: SynthTimbre): void {
    this.timbre = timbre;
  }

  public setContinuousDrone(on: boolean): void {
    this.continuousDrone = on;
    if (on && this.enabled) {
      this.startDrone(this.currentFreq);
    } else {
      this.stopDrone();
    }
  }

  public startDrone(freq: number): void {
    this.currentFreq = freq;
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx || !this.compressor) return;

    if (!this.droneOsc || !this.droneGain) {
      this.droneOsc = this.ctx.createOscillator();
      this.droneGain = this.ctx.createGain();
      this.droneOsc.type = this.timbre === 'sine' ? 'sine' : 'triangle';
      this.droneOsc.frequency.value = freq;
      this.droneGain.gain.value = 0.0001;
      this.droneOsc.connect(this.droneGain);
      this.droneGain.connect(this.compressor);
      this.droneOsc.start();
    }

    const now = this.ctx.currentTime;
    this.droneOsc.type = this.timbre === 'sine' ? 'sine' : 'triangle';
    this.droneOsc.frequency.setTargetAtTime(freq, now, 0.03);
    this.droneGain.gain.setTargetAtTime(0.22, now, 0.04);
  }

  public updateDroneFreq(freq: number): void {
    this.currentFreq = freq;
    if (this.ctx && this.droneOsc && this.enabled) {
      this.droneOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.025);
    }
  }

  public stopDrone(): void {
    if (this.ctx && this.droneGain && this.droneOsc) {
      const now = this.ctx.currentTime;
      const osc = this.droneOsc;
      const g = this.droneGain;
      this.droneOsc = null;
      this.droneGain = null;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0.0001, now, 0.04);
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
          g.disconnect();
        } catch {
          // ignore already stopped
        }
      }, 180);
    }
  }

  public triggerNote(id: string, freq: number, autoDurationMs?: number): void {
    this.currentFreq = freq;
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx || !this.compressor) return;

    if (this.voices.has(id)) {
      this.releaseNote(id);
    }

    const now = this.ctx.currentTime;
    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(0.32, now + 0.015);
    voiceGain.gain.exponentialRampToValueAtTime(0.2, now + 0.25);
    voiceGain.connect(this.compressor);

    const partials =
      this.timbre === 'sine'
        ? [{ mult: 1, amp: 1, type: 'sine' as OscillatorType }]
        : this.timbre === 'crystal'
          ? [
              { mult: 1, amp: 0.72, type: 'sine' as OscillatorType },
              { mult: 2, amp: 0.3, type: 'sine' as OscillatorType },
              { mult: 3.01, amp: 0.18, type: 'triangle' as OscillatorType },
              { mult: 5.02, amp: 0.08, type: 'sine' as OscillatorType },
            ]
          : [
              { mult: 1, amp: 0.78, type: 'sine' as OscillatorType },
              { mult: 2, amp: 0.26, type: 'triangle' as OscillatorType },
              { mult: 3, amp: 0.12, type: 'sine' as OscillatorType },
            ];

    const oscillators: OscillatorNode[] = [];
    for (const p of partials) {
      const osc = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      osc.type = p.type;
      osc.frequency.setValueAtTime(Math.min(14000, freq * p.mult), now);
      pGain.gain.value = p.amp;
      osc.connect(pGain);
      pGain.connect(voiceGain);
      osc.start(now);
      oscillators.push(osc);
    }

    this.voices.set(id, { oscillators, voiceGain, freq });

    if (autoDurationMs && autoDurationMs > 0) {
      setTimeout(() => this.releaseNote(id), autoDurationMs);
    }
  }

  public releaseNote(id: string): void {
    const voice = this.voices.get(id);
    if (!voice || !this.ctx) return;
    this.voices.delete(id);

    const now = this.ctx.currentTime;
    voice.voiceGain.gain.cancelScheduledValues(now);
    voice.voiceGain.gain.setValueAtTime(Math.max(0.001, voice.voiceGain.gain.value), now);
    voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    setTimeout(() => {
      for (const osc of voice.oscillators) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      }
      try {
        voice.voiceGain.disconnect();
      } catch {
        // ignore
      }
    }, 260);
  }

  public stopAllNotes(): void {
    const keys = Array.from(this.voices.keys());
    for (const k of keys) {
      this.releaseNote(k);
    }
  }

  public getActiveVoiceCount(): number {
    return this.voices.size + (this.droneOsc ? 1 : 0);
  }

  public getFFTData(): { time: Uint8Array; freq: Uint8Array; live: boolean } {
    if (this.analyser && this.enabled && (this.voices.size > 0 || this.droneOsc)) {
      this.analyser.getByteTimeDomainData(this.timeData);
      this.analyser.getByteFrequencyData(this.freqData);
      return { time: this.timeData, freq: this.freqData, live: true };
    }
    return { time: this.timeData, freq: this.freqData, live: false };
  }
}

/**
 * Deterministic frequency-to-Chladni-mode mapper.
 * Maps acoustic frequencies (40 Hz - 2000 Hz) to physically rich (n, m) eigenmode pairs.
 */
export function mapFrequencyToChladniModes(freq: number): { n: number; m: number; a: number; b: number } {
  const clamped = Math.max(40, Math.min(2000, freq));
  const logNorm = Math.log2(clamped / 40) / Math.log2(2000 / 40); // 0 .. 1
  const modeIndex = Math.round(logNorm * 22);

  const presets: Array<[number, number, number, number]> = [
    [1, 2, 1.0, 1.0],
    [1, 3, 1.0, -1.0],
    [2, 3, 1.0, 1.0],
    [1, 4, 1.0, 0.8],
    [2, 4, 1.0, -1.0],
    [3, 4, 1.0, 1.0],
    [2, 5, 1.0, 1.0],
    [3, 5, 1.0, -1.0],
    [1, 6, 1.0, 1.0],
    [4, 5, 1.0, 1.0],
    [3, 6, 1.0, -0.8],
    [2, 7, 1.0, 1.0],
    [4, 7, 1.0, -1.0],
    [5, 6, 1.0, 1.0],
    [3, 8, 1.0, 1.0],
    [5, 8, 1.0, -1.0],
    [4, 9, 1.0, 1.0],
    [6, 8, 1.0, -1.0],
    [5, 9, 1.0, 1.0],
    [7, 9, 1.0, -1.0],
    [6, 10, 1.0, 1.0],
    [7, 11, 1.0, -1.0],
    [8, 11, 1.0, 1.0],
  ];

  const tuple = presets[Math.max(0, Math.min(presets.length - 1, modeIndex))];
  return { n: tuple[0], m: tuple[1], a: tuple[2], b: tuple[3] };
}
