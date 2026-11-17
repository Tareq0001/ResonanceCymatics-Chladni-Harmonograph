# RESONANCE-CYMATICS: Chladni Plate Standing-Wave Simulator, 3D Harmonograph & Polyphonic Synth

**Lead Creative Technologist & Systems Architect:** **أ. طارق ابوعشي | Tareq Abuashi**

An interactive, zero-allocation **Computational Acoustics & Cymatics Laboratory** engineered with TypeScript, HTML5 Canvas (`Float32Array` / `Uint32Array` 60fps pipelines), and the Web Audio API.

---

## Core Physics & Acoustic Engines

### 1. SYS 01 — 2D Square & Circular Chladni Sand Plate (`26,000 Particles`)
- Solves the 2D standing-wave eigenmode equation in real time:
  $$Z(x, y) = a \cos(n \pi x)\cos(m \pi y) + b \cos(m \pi x)\cos(n \pi y)$$
- Supports switching between **Square Plate** and **Circular Bessel-Like Radial Modes** $J_n(k_{n,m}r)[a\cos(n\theta) + b\sin(n\theta)]$.
- **26,000 luminous sand particles** stored in zero-allocation `Float32Array` buffers and rasterized into a `Uint32Array` plate buffer at 60fps.
- Grains experience stochastic agitation at antinodes and gradient descent drift toward zero-displacement **Nodal Lines (`|Z| ≈ 0`)**.
- Interactive **Sand Brush / Scatter** dragging directly across the plate + **Auto Frequency Sweep Mode**.

### 2. SYS 02 — 3D Damped Rotary Harmonograph (`4 Coupled Pendulums`)
- Models 4 orthogonal and rotary exponentially damped harmonic pendulums weaving 3D Lissajous cosmic ribbons in real time.
- Interactive 3D perspective orbit dragging and instant Just Intonation frequency ratio presets:
  - `1:1 Unison`
  - `3:2 Fifth`
  - `4:3 Fourth`
  - `5:4 Major Third`
  - `7:4 Harmonic`
  - `Free Ratio`

### 3. SYS 03 — Circular Ripple Interference Tank
- Simulates multi-source cylindrical wave superposition inside a circular acoustic tank with 2 to 6 interactive **draggable point emitters** and real-time spectral colormaps.

### 4. Interactive Polyphonic Piano & Web Audio Additive Synth
- Full interactive octave keyboard (**C4 – C5**) with QWERTY keyboard mapping (`A, W, S, E, D, F, T, G, Y, H, U, J, K`).
- Sacred & harmonic frequency presets: **432 Hz**, **528 Hz**, **Golden Ratio ($\varphi$)**, and **Polyphonic Chord Maj7**.
- **Live FFT Oscilloscope & Spectrum Analyzer** powered by `AnalyserNode`.
- Built-in **Snapshot PNG** export and **Physics Dossier Modal**.

---

## Build & Development

```bash
npm run dev
npm run build
```

Built with Vite + TypeScript (`base: './'` for static relative asset deployment).

---

**Architected & Engineered by:**
**أ. طارق ابوعشي | Tareq Abuashi** — *Lead Creative Technologist & Systems Architect*
