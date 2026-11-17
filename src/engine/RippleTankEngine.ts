/**
 * SYS 03: Circular Ripple Interference Tank (Cymatic Water Wave Superposition)
 * Zero-Allocation Uint32Array Wave Field + Interactive Draggable Point Sources
 * Lead Creative Technologist & Systems Architect: أ. طارق ابوعشي | Tareq Abuashi
 */

export type RipplePalette = 'cyan' | 'plasma' | 'emerald';

export interface WaveSource {
  x: number; // normalized [-1, 1] inside tank
  y: number;
  phase: number;
}

export class RippleTankEngine {
  private readonly gridSize = 260;
  private offCanvas: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private pixels32: Uint32Array;
  private lut = new Uint32Array(512);

  public sources: WaveSource[] = [];
  public sourceCount = 3;
  public frequency = 432;
  public waveK = 22.0; // spatial wavenumber
  public damping = 0.55;
  public palette: RipplePalette = 'cyan';

  private phaseTime = 0;
  private tankCenterX = 0;
  private tankCenterY = 0;
  private tankRadius = 220;
  private draggedIndex = -1;

  constructor() {
    this.offCanvas = document.createElement('canvas');
    this.offCanvas.width = this.gridSize;
    this.offCanvas.height = this.gridSize;
    const ctx = this.offCanvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create offscreen 2D context for Ripple Tank');
    this.offCtx = ctx;
    this.imgData = this.offCtx.createImageData(this.gridSize, this.gridSize);
    this.pixels32 = new Uint32Array(this.imgData.data.buffer);

    this.rebuildLUT();
    this.setSourceCount(3);
  }

  public setPalette(p: RipplePalette): void {
    this.palette = p;
    this.rebuildLUT();
  }

  private rebuildLUT(): void {
    for (let i = 0; i < 512; i++) {
      // val in [-1, 1]
      const v = (i / 511) * 2 - 1;
      const absV = Math.abs(v);
      const crest = Math.max(0, v);
      const trough = Math.max(0, -v);

      let r = 6;
      let g = 10;
      let b = 22;

      if (this.palette === 'cyan') {
        r = Math.round(8 + crest * 225 + Math.pow(absV, 3) * 20);
        g = Math.round(16 + crest * 235 + trough * 40);
        b = Math.round(36 + crest * 215 + trough * 165);
      } else if (this.palette === 'plasma') {
        r = Math.round(12 + crest * 240 + trough * 95);
        g = Math.round(8 + crest * 155 + Math.pow(crest, 2) * 85);
        b = Math.round(28 + trough * 215 + crest * 65);
      } else {
        r = Math.round(6 + crest * 135);
        g = Math.round(18 + crest * 235 + trough * 70);
        b = Math.round(24 + crest * 165 + trough * 130);
      }

      this.lut[i] = (255 << 24) | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r);
    }
  }

  public setSourceCount(count: number): void {
    this.sourceCount = Math.max(2, Math.min(6, count));
    this.sources = [];
    const ringR = 0.44;
    for (let i = 0; i < this.sourceCount; i++) {
      const ang = (i / this.sourceCount) * Math.PI * 2 - Math.PI * 0.5;
      this.sources.push({
        x: Math.cos(ang) * ringR,
        y: Math.sin(ang) * ringR,
        phase: 0,
      });
    }
  }

  public reset(): void {
    this.setSourceCount(this.sourceCount);
    this.phaseTime = 0;
  }

  public pointerDown(canvasX: number, canvasY: number): boolean {
    const nx = (canvasX - this.tankCenterX) / this.tankRadius;
    const ny = (canvasY - this.tankCenterY) / this.tankRadius;
    let best = -1;
    let bestDist = 0.14;
    for (let i = 0; i < this.sources.length; i++) {
      const d = Math.hypot(this.sources[i].x - nx, this.sources[i].y - ny);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    this.draggedIndex = best;
    return best !== -1;
  }

  public pointerMove(canvasX: number, canvasY: number): void {
    if (this.draggedIndex < 0 || this.draggedIndex >= this.sources.length) return;
    let nx = (canvasX - this.tankCenterX) / this.tankRadius;
    let ny = (canvasY - this.tankCenterY) / this.tankRadius;
    const r = Math.hypot(nx, ny);
    if (r > 0.9) {
      nx = (nx / r) * 0.9;
      ny = (ny / r) * 0.9;
    }
    this.sources[this.draggedIndex].x = nx;
    this.sources[this.draggedIndex].y = ny;
  }

  public pointerUp(): void {
    this.draggedIndex = -1;
  }

  public step(dt: number): void {
    const speed = 3.5 + (this.frequency / 432) * 3.8;
    this.phaseTime += dt * speed;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const margin = Math.min(width, height) * 0.14;
    const diam = Math.max(240, Math.min(width - 40, height - margin * 1.65));
    const radius = diam * 0.5;
    const cx = width * 0.5;
    const cy = height * 0.5;

    this.tankCenterX = cx;
    this.tankCenterY = cy;
    this.tankRadius = radius;

    const N = this.gridSize;
    const invHalf = 2 / N;
    const k = this.waveK;
    const omegaT = this.phaseTime;
    const damp = this.damping;
    const nSrc = this.sources.length;
    const invNSrc = 1 / Math.max(1, nSrc * 0.72);
    const bg32 = 0xff130906;

    for (let iy = 0; iy < N; iy++) {
      const y = iy * invHalf - 1;
      const y2 = y * y;
      const rowOffset = iy * N;

      for (let ix = 0; ix < N; ix++) {
        const x = ix * invHalf - 1;
        if (x * x + y2 > 1.0) {
          this.pixels32[rowOffset + ix] = bg32;
          continue;
        }

        let sum = 0;
        for (let s = 0; s < nSrc; s++) {
          const src = this.sources[s];
          const dx = x - src.x;
          const dy = y - src.y;
          const r = Math.sqrt(dx * dx + dy * dy + 0.0025);
          const atten = 1 / (1 + damp * r * 2.4);
          sum += Math.sin(k * r - omegaT + src.phase) * atten;
        }

        const norm = Math.max(-1, Math.min(1, sum * invNSrc));
        const lutIdx = ((norm + 1) * 255.5) | 0;
        this.pixels32[rowOffset + ix] = this.lut[lutIdx];
      }
    }

    this.offCtx.putImageData(this.imgData, 0, 0);

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Circular tank clip
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.offCanvas, cx - radius, cy - radius, diam, diam);
    ctx.restore();

    // Metallic rim
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw interactive point emitters
    for (let i = 0; i < this.sources.length; i++) {
      const sx = cx + this.sources[i].x * radius;
      const sy = cy + this.sources[i].y * radius;

      ctx.beginPath();
      ctx.arc(sx, sy, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }
}
