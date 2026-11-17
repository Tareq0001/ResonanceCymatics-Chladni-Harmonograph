/**
 * SYS 01: 2D Square & Circular Chladni Sand Plate Standing-Wave Engine
 * 26,000 Zero-Allocation Float32Array Particles + Uint32Array High-Speed Rasterizer
 * Lead Creative Technologist & Systems Architect: أ. طارق ابوعشي | Tareq Abuashi
 */

export type PlateShape = 'square' | 'circular';
export type SandPalette = 'gold' | 'cyan' | 'plasma';

// First 12 Bessel J_n radial roots approximation k_{n, m} for circular membrane modes
const BESSEL_ROOTS: number[][] = [
  [2.4048, 5.5201, 8.6537, 11.7915, 14.9309, 18.0711, 21.2116, 24.3525],
  [3.8317, 7.0156, 10.1735, 13.3237, 16.4706, 19.6159, 22.7601, 25.9037],
  [5.1356, 8.4172, 11.6198, 14.7960, 17.9598, 21.1170, 24.2701, 27.4206],
  [6.3802, 9.7610, 13.0152, 16.2235, 19.4094, 22.5827, 25.7482, 28.9084],
  [7.5883, 11.0647, 14.3725, 17.6160, 20.8269, 24.0190, 27.1991, 30.3710],
  [8.7715, 12.3386, 15.7002, 18.9801, 22.2178, 25.4303, 28.6266, 31.8117],
];

/**
 * Fast Bessel J_n(x) evaluator using truncated series for small x
 * and Hankel asymptotic cosine form for larger x.
 */
function besselJ(n: number, x: number): number {
  if (x < 1e-5) return n === 0 ? 1 : 0;
  if (x < 8.5) {
    let sum = 0;
    let term = Math.pow(x * 0.5, n);
    // divide by n!
    let fact = 1;
    for (let i = 2; i <= n; i++) fact *= i;
    term /= fact;
    const x2 = -0.25 * x * x;
    for (let k = 0; k < 14; k++) {
      sum += term;
      term *= x2 / ((k + 1) * (k + 1 + n));
      if (Math.abs(term) < 1e-7) break;
    }
    return sum;
  }
  const phase = x - n * Math.PI * 0.5 - Math.PI * 0.25;
  return Math.sqrt(2 / (Math.PI * x)) * Math.cos(phase);
}

export class ChladniEngine {
  public readonly count = 26000;

  // Zero-allocation particle state buffers (normalized coordinates [-1, 1])
  private px = new Float32Array(this.count);
  private py = new Float32Array(this.count);
  private vx = new Float32Array(this.count);
  private vy = new Float32Array(this.count);
  private energy = new Float32Array(this.count);

  // Offscreen high-speed plate raster buffer (640 x 640)
  private readonly bufSize = 640;
  private offCanvas: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private pixels32: Uint32Array;
  private bgColor32 = 0xff130906; // ABGR little-endian for #060913

  // Standing-wave parameters
  public shape: PlateShape = 'square';
  public palette: SandPalette = 'gold';
  public n = 3;
  public m = 5;
  public a = 1.0;
  public b = -1.0;
  public frequency = 432.0;
  public amplitude = 1.0;

  // Telemetry & impulse
  public nodalConvergence = 0;
  private impulseBoost = 0;
  private plateX = 0;
  private plateY = 0;
  private plateDrawSize = 500;

  // Color LUT (256 levels of vibrational energy, ABGR little-endian)
  private lut = new Uint32Array(256);

  constructor() {
    this.offCanvas = document.createElement('canvas');
    this.offCanvas.width = this.bufSize;
    this.offCanvas.height = this.bufSize;
    const ctx = this.offCanvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create offscreen 2D context for Chladni plate');
    this.offCtx = ctx;
    this.imgData = this.offCtx.createImageData(this.bufSize, this.bufSize);
    this.pixels32 = new Uint32Array(this.imgData.data.buffer);

    this.rebuildPaletteLUT();
    this.scatter();
  }

  public setPalette(palette: SandPalette): void {
    this.palette = palette;
    this.rebuildPaletteLUT();
  }

  private rebuildPaletteLUT(): void {
    for (let i = 0; i < 256; i++) {
      const t = i / 255; // 0 = settled on nodal line, 1 = agitated at antinode
      let r = 255;
      let g = 255;
      let b = 255;

      if (this.palette === 'gold') {
        // Settled grains: warm luminous gold/ivory -> agitated: electric cyan/orange plasma
        r = Math.round(252 - t * 30);
        g = Math.round(218 - t * 105);
        b = Math.round(130 + t * 125);
      } else if (this.palette === 'cyan') {
        // Settled grains: crisp ice-cyan -> agitated: bright violet-white
        r = Math.round(135 + t * 115);
        g = Math.round(240 - t * 90);
        b = 255;
      } else {
        // Plasma: settled neon violet-pink -> agitated gold-cyan flare
        r = Math.round(230 - t * 170);
        g = Math.round(120 + t * 125);
        b = Math.round(255 - t * 15);
      }
      this.lut[i] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
  }

  public setShape(shape: PlateShape): void {
    if (this.shape === shape) return;
    this.shape = shape;
    this.scatter();
  }

  public setModes(n: number, m: number, a?: number, b?: number): void {
    this.n = n;
    this.m = m;
    if (a !== undefined) this.a = a;
    if (b !== undefined) this.b = b;
    this.impulseBoost = Math.max(this.impulseBoost, 0.45);
  }

  public excite(strength = 0.8): void {
    this.impulseBoost = Math.min(1.5, this.impulseBoost + strength);
  }

  public scatter(): void {
    for (let i = 0; i < this.count; i++) {
      if (this.shape === 'circular') {
        const r = Math.sqrt(Math.random()) * 0.985;
        const theta = Math.random() * Math.PI * 2;
        this.px[i] = r * Math.cos(theta);
        this.py[i] = r * Math.sin(theta);
      } else {
        this.px[i] = (Math.random() * 2 - 1) * 0.985;
        this.py[i] = (Math.random() * 2 - 1) * 0.985;
      }
      this.vx[i] = (Math.random() - 0.5) * 0.015;
      this.vy[i] = (Math.random() - 0.5) * 0.015;
      this.energy[i] = 1.0;
    }
    this.impulseBoost = 0.8;
  }

  /**
   * Evaluate Chladni standing-wave amplitude Z(x, y).
   * Square: Z(x, y) = a cos(n pi x) cos(m pi y) + b cos(m pi x) cos(n pi y)
   * Circular: Bessel-like radial-angular mode J_l(k_{l,m} r) (a cos(l theta) + b sin(l theta))
   */
  private evalZ(x: number, y: number): number {
    if (this.shape === 'square') {
      const pi = Math.PI;
      return (
        this.a * Math.cos(this.n * pi * x) * Math.cos(this.m * pi * y) +
        this.b * Math.cos(this.m * pi * x) * Math.cos(this.n * pi * y)
      );
    } else {
      const r = Math.sqrt(x * x + y * y);
      const theta = Math.atan2(y, x);
      const angOrder = Math.max(0, Math.min(5, Math.round(this.n) % 6));
      const radOrder = Math.max(0, Math.min(7, Math.round(this.m) - 1));
      const k = BESSEL_ROOTS[angOrder][radOrder];
      const radial = besselJ(angOrder, k * r);
      const angular =
        angOrder === 0
          ? this.a + this.b * 0.5
          : this.a * Math.cos(angOrder * theta) + this.b * 0.35 * Math.sin(angOrder * theta);
      return radial * angular;
    }
  }

  /**
   * Scatter or brush grains interactively around pointer coordinates on the canvas.
   */
  public brushAtCanvas(canvasX: number, canvasY: number, radiusPx = 54): void {
    const nx = ((canvasX - this.plateX) / this.plateDrawSize) * 2 - 1;
    const ny = ((canvasY - this.plateY) / this.plateDrawSize) * 2 - 1;
    if (nx < -1.1 || nx > 1.1 || ny < -1.1 || ny > 1.1) return;

    const nr = (radiusPx / this.plateDrawSize) * 2;
    const nr2 = nr * nr;

    for (let i = 0; i < this.count; i++) {
      const dx = this.px[i] - nx;
      const dy = this.py[i] - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < nr2) {
        const dist = Math.sqrt(d2) + 1e-4;
        const push = (1 - dist / nr) * 0.045;
        this.vx[i] += (dx / dist) * push + (Math.random() - 0.5) * 0.03;
        this.vy[i] += (dy / dist) * push + (Math.random() - 0.5) * 0.03;
        this.energy[i] = 1.0;
      }
    }
  }

  public step(dt: number): void {
    const drive = this.amplitude + this.impulseBoost;
    this.impulseBoost *= 0.91;

    const eps = 0.004;
    const normScale = 1 / Math.max(0.5, Math.abs(this.a) + Math.abs(this.b));
    const stepScale = Math.min(1.8, dt * 60);

    let settledCount = 0;
    const nPi = this.n * Math.PI;
    const mPi = this.m * Math.PI;
    const isSquare = this.shape === 'square';

    for (let i = 0; i < this.count; i++) {
      let x = this.px[i];
      let y = this.py[i];

      let z: number;
      let gzX: number;
      let gzY: number;

      if (isSquare) {
        // Exact analytical evaluation & gradient of Z^2 for maximum speed and precision
        const cosNX = Math.cos(nPi * x);
        const sinNX = Math.sin(nPi * x);
        const cosMY = Math.cos(mPi * y);
        const sinMY = Math.sin(mPi * y);

        const cosMX = Math.cos(mPi * x);
        const sinMX = Math.sin(mPi * x);
        const cosNY = Math.cos(nPi * y);
        const sinNY = Math.sin(nPi * y);

        z = (this.a * cosNX * cosMY + this.b * cosMX * cosNY) * normScale;
        const dzdx = (-this.a * nPi * sinNX * cosMY - this.b * mPi * sinMX * cosNY) * normScale;
        const dzdy = (-this.a * mPi * cosNX * sinMY - this.b * nPi * cosMX * sinNY) * normScale;
        gzX = z * dzdx;
        gzY = z * dzdy;
      } else {
        z = this.evalZ(x, y) * normScale;
        const zx = this.evalZ(x + eps, y) * normScale;
        const zy = this.evalZ(x, y + eps) * normScale;
        gzX = z * ((zx - z) / eps);
        gzY = z * ((zy - z) / eps);
      }

      const absZ = Math.abs(z);
      if (absZ < 0.085) settledCount++;

      // Stochastic antinode jump + gradient drift toward |Z| = 0 nodal lines
      const agitation = absZ * 0.028 * drive;
      const drift = 0.0052 * drive;

      let vx = this.vx[i] * 0.68 - gzX * drift + (Math.random() - 0.5) * agitation;
      let vy = this.vy[i] * 0.68 - gzY * drift + (Math.random() - 0.5) * agitation;

      // Tiny thermal noise when impulse active so grains find global nodal minima
      if (absZ > 0.04) {
        vx += (Math.random() - 0.5) * 0.0018 * drive;
        vy += (Math.random() - 0.5) * 0.0018 * drive;
      }

      x += vx * stepScale;
      y += vy * stepScale;

      // Containment boundary
      if (isSquare) {
        if (x < -0.992) {
          x = -0.992;
          vx *= -0.5;
        } else if (x > 0.992) {
          x = 0.992;
          vx *= -0.5;
        }
        if (y < -0.992) {
          y = -0.992;
          vy *= -0.5;
        } else if (y > 0.992) {
          y = 0.992;
          vy *= -0.5;
        }
      } else {
        const r2 = x * x + y * y;
        if (r2 > 0.985 * 0.985) {
          const r = Math.sqrt(r2);
          const scale = 0.985 / r;
          x *= scale;
          y *= scale;
          vx *= -0.45;
          vy *= -0.45;
        }
      }

      this.px[i] = x;
      this.py[i] = y;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.energy[i] = Math.min(1, absZ * 1.45);
    }

    this.nodalConvergence = (settledCount / this.count) * 100;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Compute centered plate geometry leaving clearance for HUD & bottom controls
    const margin = Math.min(width, height) * 0.14;
    const size = Math.max(240, Math.min(width - 40, height - margin * 1.65));
    const px = (width - size) * 0.5;
    const py = (height - size) * 0.5;

    this.plateX = px;
    this.plateY = py;
    this.plateDrawSize = size;

    // Clear offscreen pixel buffer (with subtle dark slate plate tone)
    this.pixels32.fill(this.bgColor32);

    const S = this.bufSize;
    const halfS = S * 0.5;
    const lut = this.lut;

    for (let i = 0; i < this.count; i++) {
      const ix = ((this.px[i] + 1) * halfS) | 0;
      const iy = ((this.py[i] + 1) * halfS) | 0;
      if (ix >= 0 && ix < S && iy >= 0 && iy < S) {
        const eIdx = Math.min(255, (this.energy[i] * 255) | 0);
        const col = lut[eIdx];
        const idx = iy * S + ix;
        this.pixels32[idx] = col;
        // Subtle 2px bloom neighbor for luminous grains
        if (ix + 1 < S) this.pixels32[idx + 1] = col;
      }
    }

    this.offCtx.putImageData(this.imgData, 0, 0);

    // Clear main canvas
    ctx.clearRect(0, 0, width, height);

    // Plate outer ambient glow
    ctx.save();
    const glowGrad = ctx.createRadialGradient(
      px + size * 0.5,
      py + size * 0.5,
      size * 0.15,
      px + size * 0.5,
      py + size * 0.5,
      size * 0.72
    );
    glowGrad.addColorStop(0, 'rgba(6, 182, 212, 0.12)');
    glowGrad.addColorStop(0.6, 'rgba(139, 92, 246, 0.06)');
    glowGrad.addColorStop(1, 'rgba(6, 9, 19, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, width, height);

    // Clip to plate geometry
    ctx.beginPath();
    if (this.shape === 'circular') {
      ctx.arc(px + size * 0.5, py + size * 0.5, size * 0.5, 0, Math.PI * 2);
    } else {
      ctx.roundRect(px, py, size, size, 12);
    }
    ctx.save();
    ctx.clip();

    // Draw rasterized 26,000 sand particles
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.offCanvas, px, py, size, size);

    // Subtle acoustic plate crosshair grid
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + size * 0.5, py);
    ctx.lineTo(px + size * 0.5, py + size);
    ctx.moveTo(px, py + size * 0.5);
    ctx.lineTo(px + size, py + size * 0.5);
    ctx.stroke();

    ctx.restore();

    // Draw metallic resonant plate rim
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center acoustic transducer anchor bolt
    ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
    ctx.beginPath();
    ctx.arc(px + size * 0.5, py + size * 0.5, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }
}
