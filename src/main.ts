/**
 * RESONANCE-CYMATICS Main Orchestrator
 * Chladni Plate Standing-Wave Simulator, 3D Harmonograph, Ripple Tank & Polyphonic Synth
 * Lead Creative Technologist & Systems Architect: أ. طارق ابوعشي | Tareq Abuashi
 */

import { AudioSynth, mapFrequencyToChladniModes, SynthTimbre } from './engine/AudioSynth';
import { ChladniEngine, PlateShape, SandPalette } from './engine/ChladniEngine';
import { HARMONIC_RATIOS, HarmonographEngine, RatioPresetKey } from './engine/HarmonographEngine';
import { RipplePalette, RippleTankEngine } from './engine/RippleTankEngine';
import { DossierModal } from './components/DossierModal';

type ActiveSystem = 'chladni' | 'harmonograph' | 'ripple';

interface PianoNote {
  note: string;
  freq: number;
  isSharp: boolean;
  hotkey: string;
  whiteIndex: number; // position among white keys 0..7
}

const OCTAVE_NOTES: PianoNote[] = [
  { note: 'C4', freq: 261.63, isSharp: false, hotkey: 'A', whiteIndex: 0 },
  { note: 'C#4', freq: 277.18, isSharp: true, hotkey: 'W', whiteIndex: 0 },
  { note: 'D4', freq: 293.66, isSharp: false, hotkey: 'S', whiteIndex: 1 },
  { note: 'D#4', freq: 311.13, isSharp: true, hotkey: 'E', whiteIndex: 1 },
  { note: 'E4', freq: 329.63, isSharp: false, hotkey: 'D', whiteIndex: 2 },
  { note: 'F4', freq: 349.23, isSharp: false, hotkey: 'F', whiteIndex: 3 },
  { note: 'F#4', freq: 369.99, isSharp: true, hotkey: 'T', whiteIndex: 3 },
  { note: 'G4', freq: 392.0, isSharp: false, hotkey: 'G', whiteIndex: 4 },
  { note: 'G#4', freq: 415.3, isSharp: true, hotkey: 'Y', whiteIndex: 4 },
  { note: 'A4', freq: 440.0, isSharp: false, hotkey: 'H', whiteIndex: 5 },
  { note: 'A#4', freq: 466.16, isSharp: true, hotkey: 'U', whiteIndex: 5 },
  { note: 'B4', freq: 493.88, isSharp: false, hotkey: 'J', whiteIndex: 6 },
  { note: 'C5', freq: 523.25, isSharp: false, hotkey: 'K', whiteIndex: 7 },
];

class ResonanceCymaticsApp {
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private fftCanvas: HTMLCanvasElement;
  private fftCtx: CanvasRenderingContext2D;

  private audio = new AudioSynth();
  private chladni = new ChladniEngine();
  private harmonograph = new HarmonographEngine();
  private ripple = new RippleTankEngine();
  private dossier: DossierModal;

  private activeSystem: ActiveSystem = 'chladni';
  private isPlaying = true;
  private isSweeping = false;
  private sweepDir = 1;
  private masterFrequency = 432.0;

  private canvasWidth = 800;
  private canvasHeight = 520;
  private dpr = 1;

  private lastTime = performance.now();
  private fpsFrames = 0;
  private fpsTimer = 0;
  private currentFps = 60;
  private phasePreview = 0;

  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private keyElements = new Map<string, HTMLElement>();
  private pressedHotkeys = new Set<string>();

  constructor() {
    const mc = document.getElementById('physics-canvas') as HTMLCanvasElement | null;
    const fc = document.getElementById('fft-canvas') as HTMLCanvasElement | null;
    if (!mc || !fc) throw new Error('Required canvas elements missing');

    const mCtx = mc.getContext('2d');
    const fCtx = fc.getContext('2d');
    if (!mCtx || !fCtx) throw new Error('2D context unavailable');

    this.mainCanvas = mc;
    this.mainCtx = mCtx;
    this.fftCanvas = fc;
    this.fftCtx = fCtx;
    this.dossier = new DossierModal('dossier-modal');

    this.initLayoutResize();
    this.initNavigation();
    this.initHeaderAndTransport();
    this.initSynthControls();
    this.initPianoKeyboard();
    this.initPresets();
    this.initPointerInteractions();
    this.renderDynamicSidebar();
    this.applyFrequencyToEngines(this.masterFrequency, false);

    requestAnimationFrame((t) => this.loop(t));
  }

  private initLayoutResize(): void {
    const resize = () => {
      const rect = this.mainCanvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvasWidth = Math.max(300, Math.floor(rect.width));
      this.canvasHeight = Math.max(300, Math.floor(rect.height));

      this.mainCanvas.width = Math.floor(this.canvasWidth * this.dpr);
      this.mainCanvas.height = Math.floor(this.canvasHeight * this.dpr);
      this.mainCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      const fRect = this.fftCanvas.getBoundingClientRect();
      const fw = Math.max(200, Math.floor(fRect.width));
      const fh = Math.max(100, Math.floor(fRect.height));
      this.fftCanvas.width = Math.floor(fw * this.dpr);
      this.fftCanvas.height = Math.floor(fh * this.dpr);
      this.fftCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    };

    window.addEventListener('resize', resize);
    setTimeout(resize, 0);
    resize();
  }

  private initNavigation(): void {
    const tabs = document.querySelectorAll<HTMLButtonElement>('.system-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const sys = tab.dataset.system as ActiveSystem | undefined;
        if (!sys || sys === this.activeSystem) return;
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeSystem = sys;
        this.updateHudForSystem();
        this.renderDynamicSidebar();
      });
    });
    this.updateHudForSystem();
  }

  private updateHudForSystem(): void {
    const titleEl = document.getElementById('hud-system-title');
    const hintEl = document.getElementById('hud-interaction-hint');
    const scatterBtn = document.getElementById('btn-scatter');

    if (this.activeSystem === 'chladni') {
      if (titleEl) titleEl.textContent = '2D Standing-Wave Chladni Plate (26,000 Particles)';
      if (hintEl) hintEl.innerHTML = '<span>🖱 Drag across plate to brush &amp; scatter sand</span>';
      if (scatterBtn) scatterBtn.style.display = 'flex';
    } else if (this.activeSystem === 'harmonograph') {
      if (titleEl) titleEl.textContent = '3D Damped Rotary Harmonograph (4 Pendulums)';
      if (hintEl) hintEl.innerHTML = '<span>🖱 Drag canvas to orbit 3D Lissajous figure</span>';
      if (scatterBtn) scatterBtn.style.display = 'none';
    } else {
      if (titleEl) titleEl.textContent = 'Circular Ripple Interference Tank';
      if (hintEl) hintEl.innerHTML = '<span>🖱 Drag amber point emitters inside tank</span>';
      if (scatterBtn) scatterBtn.style.display = 'none';
    }
  }

  private initHeaderAndTransport(): void {
    const audioBtn = document.getElementById('audio-toggle-btn');
    const audioText = document.getElementById('audio-status-text');
    audioBtn?.addEventListener('click', () => {
      const next = !this.audio.enabled;
      this.audio.setEnabled(next);
      audioBtn.classList.toggle('active', next);
      if (audioText) audioText.textContent = next ? 'Audio: ON' : 'Audio: OFF';
    });

    document.getElementById('open-dossier-btn')?.addEventListener('click', () => this.dossier.open());

    const doSnapshot = () => this.exportSnapshotPNG();
    document.getElementById('btn-snapshot')?.addEventListener('click', doSnapshot);
    document.getElementById('btn-snapshot-top')?.addEventListener('click', doSnapshot);

    const playBtn = document.getElementById('btn-play-pause');
    const playTxt = document.getElementById('txt-play-pause');
    const togglePlay = () => {
      this.isPlaying = !this.isPlaying;
      if (playTxt) playTxt.textContent = this.isPlaying ? 'Pause' : 'Resume';
      playBtn?.classList.toggle('active', !this.isPlaying);
    };
    playBtn?.addEventListener('click', togglePlay);

    document.getElementById('btn-scatter')?.addEventListener('click', () => {
      this.chladni.scatter();
    });

    const sweepBtn = document.getElementById('btn-sweep');
    sweepBtn?.addEventListener('click', () => {
      this.isSweeping = !this.isSweeping;
      sweepBtn.classList.toggle('sweep-on', this.isSweeping);
      if (this.isSweeping && this.audio.enabled) {
        this.audio.startDrone(this.masterFrequency);
      } else if (!this.isSweeping && !this.audio.continuousDrone) {
        this.audio.stopDrone();
      }
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (this.activeSystem === 'chladni') this.chladni.scatter();
      else if (this.activeSystem === 'harmonograph') this.harmonograph.reset();
      else this.ripple.reset();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    });
  }

  private initSynthControls(): void {
    const volSlider = document.getElementById('slider-volume') as HTMLInputElement | null;
    const volDisp = document.getElementById('disp-volume');
    volSlider?.addEventListener('input', () => {
      const val = parseFloat(volSlider.value);
      this.audio.setVolume(val);
      if (volDisp) volDisp.textContent = `${Math.round(val * 100)}%`;
    });

    const timbreBtns = document.querySelectorAll<HTMLButtonElement>('[data-timbre]');
    const timbreDisp = document.getElementById('disp-timbre');
    timbreBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const timbre = btn.dataset.timbre as SynthTimbre;
        timbreBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.audio.setTimbre(timbre);
        if (timbreDisp) timbreDisp.textContent = btn.textContent || timbre;
      });
    });

    const droneBtns = document.querySelectorAll<HTMLButtonElement>('[data-drone]');
    const droneDisp = document.getElementById('disp-drone');
    droneBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const isOn = btn.dataset.drone === 'on';
        droneBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.audio.setContinuousDrone(isOn);
        if (droneDisp) droneDisp.textContent = isOn ? 'ON' : 'OFF';
        if (isOn && !this.audio.enabled) {
          document.getElementById('audio-toggle-btn')?.click();
        }
      });
    });
  }

  private initPianoKeyboard(): void {
    const container = document.getElementById('piano-keyboard');
    if (!container) return;

    const totalWhites = 8;
    const whiteWidthPct = 100 / totalWhites;

    // Render white keys first
    for (const item of OCTAVE_NOTES) {
      if (item.isSharp) continue;
      const key = document.createElement('button');
      key.className = 'piano-key-white';
      key.type = 'button';
      key.innerHTML = `
        <span class="key-hotkey">${item.hotkey}</span>
        <span class="key-note">${item.note}</span>
        <span class="key-hz">${Math.round(item.freq)}</span>
      `;
      this.bindPianoKeyEvents(key, item);
      container.appendChild(key);
      this.keyElements.set(item.note, key);
    }

    // Render sharp keys overlaid accurately
    for (const item of OCTAVE_NOTES) {
      if (!item.isSharp) continue;
      const key = document.createElement('button');
      key.className = 'piano-key-black';
      key.type = 'button';
      const leftPct = (item.whiteIndex + 1) * whiteWidthPct - 3.25;
      key.style.left = `${leftPct}%`;
      key.innerHTML = `<span class="key-note">${item.note}</span>`;
      this.bindPianoKeyEvents(key, item);
      container.appendChild(key);
      this.keyElements.set(item.note, key);
    }

    // QWERTY keyboard mapping
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement) return;
      const letter = e.key.toUpperCase();
      const match = OCTAVE_NOTES.find((n) => n.hotkey === letter);
      if (match && !this.pressedHotkeys.has(letter)) {
        this.pressedHotkeys.add(letter);
        this.activateNote(match);
      }
    });

    window.addEventListener('keyup', (e) => {
      const letter = e.key.toUpperCase();
      const match = OCTAVE_NOTES.find((n) => n.hotkey === letter);
      if (match) {
        this.pressedHotkeys.delete(letter);
        this.deactivateNote(match);
      }
    });
  }

  private bindPianoKeyEvents(el: HTMLElement, item: PianoNote): void {
    const down = (e: Event) => {
      e.preventDefault();
      this.activateNote(item);
    };
    const up = () => this.deactivateNote(item);

    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up);
  }

  private activateNote(item: PianoNote): void {
    this.keyElements.get(item.note)?.classList.add('active');
    if (!this.audio.enabled) {
      document.getElementById('audio-toggle-btn')?.click();
    }
    this.audio.triggerNote(item.note, item.freq);
    this.applyFrequencyToEngines(item.freq, true);
  }

  private deactivateNote(item: PianoNote): void {
    this.keyElements.get(item.note)?.classList.remove('active');
    this.audio.releaseNote(item.note);
  }

  private initPresets(): void {
    const chips = document.querySelectorAll<HTMLButtonElement>('.preset-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const p = chip.dataset.preset;
        if (!this.audio.enabled) {
          document.getElementById('audio-toggle-btn')?.click();
        }

        if (p === '432') {
          this.applyFrequencyToEngines(432.0, true);
          this.audio.triggerNote('preset-432', 432.0, 950);
        } else if (p === '528') {
          this.applyFrequencyToEngines(528.0, true);
          this.audio.triggerNote('preset-528', 528.0, 950);
        } else if (p === 'phi') {
          const phiFreq = 432 * 1.618034; // ~699 Hz
          this.applyFrequencyToEngines(phiFreq, true);
          this.harmonograph.setFrequencyRatio(1.618, 1.0);
          this.audio.triggerNote('preset-phi-1', 432.0, 1100);
          this.audio.triggerNote('preset-phi-2', phiFreq, 1100);
        } else if (p === 'maj7') {
          // C4 - E4 - G4 - B4 polyphonic Major 7th chord
          const chord = [
            { id: 'C4', f: 261.63 },
            { id: 'E4', f: 329.63 },
            { id: 'G4', f: 392.0 },
            { id: 'B4', f: 493.88 },
          ];
          chord.forEach((n) => {
            this.audio.triggerNote(`chord-${n.id}`, n.f, 1250);
            const kEl = this.keyElements.get(n.id);
            kEl?.classList.add('active');
            setTimeout(() => kEl?.classList.remove('active'), 1100);
          });
          this.applyFrequencyToEngines(493.88, true);
          this.chladni.setModes(4, 7, 1.0, 1.0);
          this.harmonograph.setRatioPreset('major3');
          this.renderDynamicSidebar();
        }
      });
    });
  }

  private applyFrequencyToEngines(freq: number, exciteSand: boolean): void {
    this.masterFrequency = Math.max(40, Math.min(2000, freq));
    this.chladni.frequency = this.masterFrequency;
    this.ripple.frequency = this.masterFrequency;
    this.harmonograph.baseFreqHz = this.masterFrequency;

    const mapped = mapFrequencyToChladniModes(this.masterFrequency);
    this.chladni.setModes(mapped.n, mapped.m, mapped.a, mapped.b);
    if (exciteSand) {
      this.chladni.excite(0.85);
    }

    // Update ripple spatial wavenumber smoothly with frequency
    this.ripple.waveK = 12 + ((this.masterFrequency - 40) / 1960) * 32;

    if (this.audio.continuousDrone || this.isSweeping) {
      this.audio.updateDroneFreq(this.masterFrequency);
    }

    // Sync sliders in sidebar if currently visible
    const freqSlider = document.getElementById('slider-chladni-freq') as HTMLInputElement | null;
    const freqVal = document.getElementById('disp-chladni-freq');
    if (freqSlider) freqSlider.value = String(Math.round(this.masterFrequency));
    if (freqVal) freqVal.textContent = `${Math.round(this.masterFrequency)} Hz`;

    const nSlider = document.getElementById('slider-mode-n') as HTMLInputElement | null;
    const nVal = document.getElementById('disp-mode-n');
    const mSlider = document.getElementById('slider-mode-m') as HTMLInputElement | null;
    const mVal = document.getElementById('disp-mode-m');
    if (nSlider) nSlider.value = String(this.chladni.n);
    if (nVal) nVal.textContent = String(this.chladni.n);
    if (mSlider) mSlider.value = String(this.chladni.m);
    if (mVal) mVal.textContent = String(this.chladni.m);
  }

  private initPointerInteractions(): void {
    const getPos = (e: PointerEvent) => {
      const rect = this.mainCanvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    this.mainCanvas.addEventListener('pointerdown', (e) => {
      this.isPointerDown = true;
      const pos = getPos(e);
      this.lastPointerX = pos.x;
      this.lastPointerY = pos.y;
      this.mainCanvas.setPointerCapture(e.pointerId);

      if (this.activeSystem === 'chladni') {
        this.chladni.brushAtCanvas(pos.x, pos.y);
      } else if (this.activeSystem === 'ripple') {
        this.ripple.pointerDown(pos.x, pos.y);
      }
    });

    this.mainCanvas.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown) return;
      const pos = getPos(e);
      const dx = pos.x - this.lastPointerX;
      const dy = pos.y - this.lastPointerY;
      this.lastPointerX = pos.x;
      this.lastPointerY = pos.y;

      if (this.activeSystem === 'chladni') {
        this.chladni.brushAtCanvas(pos.x, pos.y);
      } else if (this.activeSystem === 'harmonograph') {
        this.harmonograph.rotateBy(dx, dy);
      } else {
        this.ripple.pointerMove(pos.x, pos.y);
      }
    });

    const endDrag = () => {
      this.isPointerDown = false;
      this.ripple.pointerUp();
    };
    this.mainCanvas.addEventListener('pointerup', endDrag);
    this.mainCanvas.addEventListener('pointercancel', endDrag);
  }

  private renderDynamicSidebar(): void {
    const panel = document.getElementById('panel-dynamic-controls');
    if (!panel) return;

    if (this.activeSystem === 'chladni') {
      panel.innerHTML = `
        <div class="panel-header">
          <span>Chladni Plate Physics</span>
          <span class="badge">26,000 Grains</span>
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Plate Geometry</span>
            <span class="control-val" id="disp-plate-shape">${this.chladni.shape === 'square' ? 'Square' : 'Circular Bessel'}</span>
          </div>
          <div class="preset-btn-group">
            <button class="sub-btn ${this.chladni.shape === 'square' ? 'active' : ''}" data-shape="square">Square Plate</button>
            <button class="sub-btn ${this.chladni.shape === 'circular' ? 'active' : ''}" data-shape="circular">Circular (Bessel)</button>
          </div>
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Acoustic Frequency</span>
            <span class="control-val" id="disp-chladni-freq">${Math.round(this.masterFrequency)} Hz</span>
          </div>
          <input type="range" id="slider-chladni-freq" min="40" max="2000" step="1" value="${Math.round(this.masterFrequency)}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Mode Index n</span>
            <span class="control-val" id="disp-mode-n">${this.chladni.n}</span>
          </div>
          <input type="range" id="slider-mode-n" min="1" max="12" step="1" value="${this.chladni.n}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Mode Index m</span>
            <span class="control-val" id="disp-mode-m">${this.chladni.m}</span>
          </div>
          <input type="range" id="slider-mode-m" min="1" max="12" step="1" value="${this.chladni.m}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Coefficient b (Symmetry)</span>
            <span class="control-val" id="disp-coeff-b">${this.chladni.b.toFixed(1)}</span>
          </div>
          <input type="range" id="slider-coeff-b" min="-1.5" max="1.5" step="0.1" value="${this.chladni.b}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Vibration Amplitude</span>
            <span class="control-val" id="disp-amp">${this.chladni.amplitude.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-amp" min="0.3" max="2.0" step="0.05" value="${this.chladni.amplitude}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Sand Spectrum</span>
          </div>
          <div class="preset-btn-group">
            <button class="sub-btn ${this.chladni.palette === 'gold' ? 'active' : ''}" data-pal="gold">Solar Gold</button>
            <button class="sub-btn ${this.chladni.palette === 'cyan' ? 'active' : ''}" data-pal="cyan">Quantum Cyan</button>
            <button class="sub-btn ${this.chladni.palette === 'plasma' ? 'active' : ''}" data-pal="plasma">Plasma Violet</button>
          </div>
        </div>
      `;

      panel.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((b) => {
        b.addEventListener('click', () => {
          const shape = b.dataset.shape as PlateShape;
          this.chladni.setShape(shape);
          this.renderDynamicSidebar();
        });
      });

      panel.querySelectorAll<HTMLButtonElement>('[data-pal]').forEach((b) => {
        b.addEventListener('click', () => {
          const pal = b.dataset.pal as SandPalette;
          this.chladni.setPalette(pal);
          this.renderDynamicSidebar();
        });
      });

      const freqSlider = document.getElementById('slider-chladni-freq') as HTMLInputElement;
      freqSlider.addEventListener('input', () => {
        this.applyFrequencyToEngines(parseFloat(freqSlider.value), true);
      });

      const nSlider = document.getElementById('slider-mode-n') as HTMLInputElement;
      const nDisp = document.getElementById('disp-mode-n')!;
      nSlider.addEventListener('input', () => {
        const n = parseInt(nSlider.value, 10);
        nDisp.textContent = String(n);
        this.chladni.setModes(n, this.chladni.m);
      });

      const mSlider = document.getElementById('slider-mode-m') as HTMLInputElement;
      const mDisp = document.getElementById('disp-mode-m')!;
      mSlider.addEventListener('input', () => {
        const m = parseInt(mSlider.value, 10);
        mDisp.textContent = String(m);
        this.chladni.setModes(this.chladni.n, m);
      });

      const bSlider = document.getElementById('slider-coeff-b') as HTMLInputElement;
      const bDisp = document.getElementById('disp-coeff-b')!;
      bSlider.addEventListener('input', () => {
        const b = parseFloat(bSlider.value);
        bDisp.textContent = b.toFixed(1);
        this.chladni.setModes(this.chladni.n, this.chladni.m, this.chladni.a, b);
      });

      const ampSlider = document.getElementById('slider-amp') as HTMLInputElement;
      const ampDisp = document.getElementById('disp-amp')!;
      ampSlider.addEventListener('input', () => {
        const v = parseFloat(ampSlider.value);
        this.chladni.amplitude = v;
        ampDisp.textContent = `${v.toFixed(2)}×`;
      });
    } else if (this.activeSystem === 'harmonograph') {
      const ratioBtns = (Object.keys(HARMONIC_RATIOS) as RatioPresetKey[])
        .map(
          (k) =>
            `<button class="sub-btn ${this.harmonograph.preset === k ? 'active' : ''}" data-ratio="${k}">${HARMONIC_RATIOS[k].label}</button>`
        )
        .join('');

      panel.innerHTML = `
        <div class="panel-header">
          <span>3D Harmonograph Pendulums</span>
          <span class="badge">4-DOF Lissajous</span>
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Musical Frequency Ratio</span>
          </div>
          <div class="preset-btn-group">${ratioBtns}</div>
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>X-Pendulum Ratio (fx)</span>
            <span class="control-val" id="disp-h-fx">${this.harmonograph.fx.toFixed(2)}</span>
          </div>
          <input type="range" id="slider-h-fx" min="1" max="8" step="0.02" value="${this.harmonograph.fx}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Y-Pendulum Ratio (fy)</span>
            <span class="control-val" id="disp-h-fy">${this.harmonograph.fy.toFixed(2)}</span>
          </div>
          <input type="range" id="slider-h-fy" min="1" max="8" step="0.02" value="${this.harmonograph.fy}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Phase Offset (&Delta;&phi;)</span>
            <span class="control-val" id="disp-h-phase">${this.harmonograph.phaseOffset.toFixed(2)} rad</span>
          </div>
          <input type="range" id="slider-h-phase" min="0" max="6.28" step="0.05" value="${this.harmonograph.phaseOffset}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Viscous Damping</span>
            <span class="control-val" id="disp-h-damp">${this.harmonograph.damping.toFixed(3)}</span>
          </div>
          <input type="range" id="slider-h-damp" min="0.001" max="0.03" step="0.001" value="${this.harmonograph.damping}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>3D Orbit Spin Speed</span>
            <span class="control-val" id="disp-h-rot">${this.harmonograph.rotSpeed.toFixed(2)}</span>
          </div>
          <input type="range" id="slider-h-rot" min="0" max="1.2" step="0.04" value="${this.harmonograph.rotSpeed}" />
        </div>
      `;

      panel.querySelectorAll<HTMLButtonElement>('[data-ratio]').forEach((b) => {
        b.addEventListener('click', () => {
          const key = b.dataset.ratio as RatioPresetKey;
          this.harmonograph.setRatioPreset(key);
          this.renderDynamicSidebar();
        });
      });

      const fxS = document.getElementById('slider-h-fx') as HTMLInputElement;
      const fyS = document.getElementById('slider-h-fy') as HTMLInputElement;
      const fxD = document.getElementById('disp-h-fx')!;
      const fyD = document.getElementById('disp-h-fy')!;

      fxS.addEventListener('input', () => {
        const v = parseFloat(fxS.value);
        fxD.textContent = v.toFixed(2);
        this.harmonograph.setFrequencyRatio(v, this.harmonograph.fy);
      });
      fyS.addEventListener('input', () => {
        const v = parseFloat(fyS.value);
        fyD.textContent = v.toFixed(2);
        this.harmonograph.setFrequencyRatio(this.harmonograph.fx, v);
      });

      const phS = document.getElementById('slider-h-phase') as HTMLInputElement;
      const phD = document.getElementById('disp-h-phase')!;
      phS.addEventListener('input', () => {
        const v = parseFloat(phS.value);
        this.harmonograph.phaseOffset = v;
        this.harmonograph.reset();
        phD.textContent = `${v.toFixed(2)} rad`;
      });

      const dS = document.getElementById('slider-h-damp') as HTMLInputElement;
      const dD = document.getElementById('disp-h-damp')!;
      dS.addEventListener('input', () => {
        const v = parseFloat(dS.value);
        this.harmonograph.damping = v;
        this.harmonograph.reset();
        dD.textContent = v.toFixed(3);
      });

      const rS = document.getElementById('slider-h-rot') as HTMLInputElement;
      const rD = document.getElementById('disp-h-rot')!;
      rS.addEventListener('input', () => {
        const v = parseFloat(rS.value);
        this.harmonograph.rotSpeed = v;
        rD.textContent = v.toFixed(2);
      });
    } else {
      panel.innerHTML = `
        <div class="panel-header">
          <span>Circular Ripple Tank</span>
          <span class="badge">Wave Superposition</span>
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Point Emitters</span>
            <span class="control-val" id="disp-r-src">${this.ripple.sourceCount} Sources</span>
          </div>
          <div class="preset-btn-group">
            ${[2, 3, 4, 5, 6]
              .map(
                (n) =>
                  `<button class="sub-btn ${this.ripple.sourceCount === n ? 'active' : ''}" data-src="${n}">${n}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Spatial Wavenumber (k)</span>
            <span class="control-val" id="disp-r-k">${this.ripple.waveK.toFixed(1)}</span>
          </div>
          <input type="range" id="slider-r-k" min="8" max="48" step="0.5" value="${this.ripple.waveK}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Fluid Attenuation</span>
            <span class="control-val" id="disp-r-damp">${this.ripple.damping.toFixed(2)}</span>
          </div>
          <input type="range" id="slider-r-damp" min="0.05" max="1.8" step="0.05" value="${this.ripple.damping}" />
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Spectral Map</span>
          </div>
          <div class="preset-btn-group">
            <button class="sub-btn ${this.ripple.palette === 'cyan' ? 'active' : ''}" data-rpal="cyan">Spectral Cyan</button>
            <button class="sub-btn ${this.ripple.palette === 'plasma' ? 'active' : ''}" data-rpal="plasma">Interference Plasma</button>
            <button class="sub-btn ${this.ripple.palette === 'emerald' ? 'active' : ''}" data-rpal="emerald">Deep Emerald</button>
          </div>
        </div>
      `;

      panel.querySelectorAll<HTMLButtonElement>('[data-src]').forEach((b) => {
        b.addEventListener('click', () => {
          const n = parseInt(b.dataset.src || '3', 10);
          this.ripple.setSourceCount(n);
          this.renderDynamicSidebar();
        });
      });

      panel.querySelectorAll<HTMLButtonElement>('[data-rpal]').forEach((b) => {
        b.addEventListener('click', () => {
          this.ripple.setPalette(b.dataset.rpal as RipplePalette);
          this.renderDynamicSidebar();
        });
      });

      const kS = document.getElementById('slider-r-k') as HTMLInputElement;
      const kD = document.getElementById('disp-r-k')!;
      kS.addEventListener('input', () => {
        const v = parseFloat(kS.value);
        this.ripple.waveK = v;
        kD.textContent = v.toFixed(1);
      });

      const dS = document.getElementById('slider-r-damp') as HTMLInputElement;
      const dD = document.getElementById('disp-r-damp')!;
      dS.addEventListener('input', () => {
        const v = parseFloat(dS.value);
        this.ripple.damping = v;
        dD.textContent = v.toFixed(2);
      });
    }
  }

  private renderFFTOscilloscope(dt: number): void {
    const w = this.fftCanvas.width / this.dpr;
    const h = this.fftCanvas.height / this.dpr;
    const ctx = this.fftCtx;

    ctx.clearRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    const fft = this.audio.getFFTData();
    this.phasePreview += dt * (4 + (this.masterFrequency / 432) * 8);

    if (fft.live) {
      // Draw real Web Audio FFT spectrum bars
      const bars = 48;
      const step = Math.max(1, Math.floor(fft.freq.length / bars));
      const barW = w / bars;
      for (let i = 0; i < bars; i++) {
        const mag = fft.freq[i * step] / 255;
        const barH = mag * h * 0.85;
        ctx.fillStyle = `rgba(139, 92, 246, ${0.22 + mag * 0.5})`;
        ctx.fillRect(i * barW + 1, h - barH, Math.max(1, barW - 2), barH);
      }

      // Draw real Web Audio time-domain waveform
      ctx.beginPath();
      const len = fft.time.length;
      for (let i = 0; i < len; i++) {
        const x = (i / (len - 1)) * w;
        const v = (fft.time[i] - 128) / 128;
        const y = h * 0.5 + v * (h * 0.42);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else {
      // Synthesized mathematical harmonic preview when audio is muted/idle
      const n = this.chladni.n;
      const m = this.chladni.m;
      ctx.beginPath();
      const samples = 120;
      for (let i = 0; i <= samples; i++) {
        const u = i / samples;
        const x = u * w;
        const sig =
          0.62 * Math.sin(u * Math.PI * 2 * (2 + (this.masterFrequency / 432) * 2) + this.phasePreview) +
          0.28 * Math.sin(u * Math.PI * 2 * (n + m) * 0.5 - this.phasePreview * 1.4);
        const y = h * 0.5 + sig * h * 0.34;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.78)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Mode harmonic markers
      const markerCount = 18;
      for (let i = 0; i < markerCount; i++) {
        const dist = Math.abs(i - ((n + m) % markerCount));
        const amp = Math.max(0.08, 1 - dist * 0.25) * 0.5;
        const barH = amp * h * 0.65;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
        ctx.fillRect((i / markerCount) * w + 2, h - barH, w / markerCount - 4, barH);
      }
    }
  }

  private updateTelemetry(): void {
    const freqHud = document.getElementById('hud-freq-badge');
    const valFreq = document.getElementById('val-freq');
    const valModes = document.getElementById('val-modes');
    const valNodal = document.getElementById('val-nodal');
    const valVoices = document.getElementById('val-voices');

    if (freqHud) freqHud.textContent = `${this.masterFrequency.toFixed(1)} Hz`;
    if (valFreq) valFreq.innerHTML = `${this.masterFrequency.toFixed(1)}<span class="unit">Hz</span>`;

    if (this.activeSystem === 'chladni') {
      if (valModes) valModes.textContent = `(${this.chladni.n}, ${this.chladni.m})`;
      if (valNodal) valNodal.innerHTML = `${this.chladni.nodalConvergence.toFixed(1)}<span class="unit">%</span>`;
    } else if (this.activeSystem === 'harmonograph') {
      if (valModes) valModes.textContent = `${this.harmonograph.fx.toFixed(2)}:${this.harmonograph.fy.toFixed(2)}`;
      if (valNodal) valNodal.innerHTML = `3D<span class="unit">Lissajous</span>`;
    } else {
      if (valModes) valModes.textContent = `${this.ripple.sourceCount} src`;
      if (valNodal) valNodal.innerHTML = `k=${this.ripple.waveK.toFixed(1)}`;
    }

    if (valVoices) {
      valVoices.innerHTML = `${this.audio.getActiveVoiceCount()}<span class="unit">ch</span>`;
    }
  }

  private exportSnapshotPNG(): void {
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `resonance-cymatics-${this.activeSystem}-${timestamp}.png`;
    link.href = this.mainCanvas.toDataURL('image/png');
    link.click();
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    // FPS counter
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.45) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
      const fpsEl = document.getElementById('hud-fps');
      if (fpsEl) fpsEl.textContent = `${this.currentFps} FPS`;
    }

    if (this.isPlaying) {
      if (this.isSweeping) {
        let nextF = this.masterFrequency + this.sweepDir * dt * 115;
        if (nextF >= 1400) {
          nextF = 1400;
          this.sweepDir = -1;
        } else if (nextF <= 90) {
          nextF = 90;
          this.sweepDir = 1;
        }
        this.applyFrequencyToEngines(nextF, false);
      }

      if (this.activeSystem === 'chladni') {
        this.chladni.step(dt);
      } else if (this.activeSystem === 'harmonograph') {
        this.harmonograph.step(dt);
      } else {
        this.ripple.step(dt);
      }
    }

    if (this.activeSystem === 'chladni') {
      this.chladni.render(this.mainCtx, this.canvasWidth, this.canvasHeight);
    } else if (this.activeSystem === 'harmonograph') {
      this.harmonograph.render(this.mainCtx, this.canvasWidth, this.canvasHeight);
    } else {
      this.ripple.render(this.mainCtx, this.canvasWidth, this.canvasHeight);
    }

    this.renderFFTOscilloscope(dt);
    this.updateTelemetry();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new ResonanceCymaticsApp();
});
