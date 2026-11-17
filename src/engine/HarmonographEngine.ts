/**
 * SYS 02: 3D Damped Rotary Harmonograph (4 Coupled Pendulums)
 * Zero-Allocation Float32Array 3D Ring Buffer + Perspective Neon Projection
 * Lead Creative Technologist & Systems Architect: أ. طارق ابوعشي | Tareq Abuashi
 */

export type RatioPresetKey = 'unison' | 'fifth' | 'fourth' | 'major3' | 'harmonic7' | 'free';

export interface RatioPreset {
  label: string;
  fx: number;
  fy: number;
  fz: number;
}

export const HARMONIC_RATIOS: Record<RatioPresetKey, RatioPreset> = {
  unison: { label: '1:1 Unison', fx: 1.0, fy: 1.003, fz: 2.0 },
  fifth: { label: '3:2 Fifth', fx: 3.0, fy: 2.004, fz: 1.5 },
  fourth: { label: '4:3 Fourth', fx: 4.0, fy: 3.005, fz: 2.5 },
  major3: { label: '5:4 Maj 3rd', fx: 5.0, fy: 4.006, fz: 3.0 },
  harmonic7: { label: '7:4 Harmonic', fx: 7.0, fy: 4.005, fz: 3.5 },
  free: { label: 'Free Ratio', fx: 3.14, fy: 2.01, fz: 1.618 },
};

export class HarmonographEngine {
  public readonly maxPoints = 9000;

  // Zero-allocation interleaved 3D trajectory buffer [x, y, z, tNorm]
  private ptsX = new Float32Array(this.maxPoints);
  private ptsY = new Float32Array(this.maxPoints);
  private ptsZ = new Float32Array(this.maxPoints);
  private ptCount = 0;

  // 4 Pendulum parameters
  public preset: RatioPresetKey = 'fifth';
  public fx = 3.0;
  public fy = 2.004;
  public fz = 1.5;
  public phaseOffset = Math.PI * 0.35;
  public damping = 0.008;
  public rotSpeed = 0.28;
  public baseFreqHz = 432.0;

  private simTime = 0;
  private rotYaw = 0.45;
  private rotPitch = 0.38;
  private dragYawVel = 0;

  constructor() {
    this.reset();
  }

  public setRatioPreset(key: RatioPresetKey): void {
    this.preset = key;
    const p = HARMONIC_RATIOS[key];
    this.fx = p.fx;
    this.fy = p.fy;
    this.fz = p.fz;
    this.reset();
  }

  public setFrequencyRatio(fx: number, fy: number): void {
    this.fx = fx;
    this.fy = fy;
    this.preset = 'free';
    this.reset();
  }

  public rotateBy(dx: number, dy: number): void {
    this.rotYaw += dx * 0.008;
    this.rotPitch = Math.max(-1.25, Math.min(1.25, this.rotPitch + dy * 0.006));
    this.dragYawVel = dx * 0.0005;
  }

  public reset(): void {
    this.ptCount = 0;
    this.simTime = 0;
    // Pre-seed initial curve sweep so screen starts richly populated
    this.advancePoints(350, 0.012);
  }

  private samplePendulum(t: number): { x: number; y: number; z: number } {
    const d1 = Math.exp(-this.damping * t);
    const d2 = Math.exp(-this.damping * 1.15 * t);

    // 4 orthogonal + rotary coupled pendulums
    const w1 = this.fx * 2.15;
    const w2 = (this.fx + 0.012) * 2.15;
    const w3 = this.fy * 2.15;
    const w4 = (this.fy - 0.009) * 2.15;
    const wz = this.fz * 2.15;

    const x =
      0.56 * d1 * Math.sin(w1 * t + this.phaseOffset) +
      0.44 * d2 * Math.cos(w2 * t - this.phaseOffset * 0.5);
    const y =
      0.56 * d1 * Math.sin(w3 * t) +
      0.44 * d2 * Math.sin(w4 * t + Math.PI * 0.5);
    const z = 0.65 * d1 * Math.cos(wz * t + this.phaseOffset * 0.7);

    return { x, y, z };
  }

  private advancePoints(steps: number, dtStep: number): void {
    for (let s = 0; s < steps; s++) {
      this.simTime += dtStep;
      const p = this.samplePendulum(this.simTime);

      if (this.ptCount < this.maxPoints) {
        this.ptsX[this.ptCount] = p.x;
        this.ptsY[this.ptCount] = p.y;
        this.ptsZ[this.ptCount] = p.z;
        this.ptCount++;
      } else {
        // Shift ring buffer cleanly when full or wrap continuously
        this.ptsX.copyWithin(0, 1);
        this.ptsY.copyWithin(0, 1);
        this.ptsZ.copyWithin(0, 1);
        this.ptsX[this.maxPoints - 1] = p.x;
        this.ptsY[this.maxPoints - 1] = p.y;
        this.ptsZ[this.maxPoints - 1] = p.z;
      }
    }
  }

  public step(dt: number): void {
    this.rotYaw += (this.rotSpeed + this.dragYawVel) * dt;
    this.dragYawVel *= 0.94;

    // Reset smoothly if pendulum completely damped out
    if (Math.exp(-this.damping * this.simTime) < 0.04) {
      this.simTime = 0;
      this.ptCount = 0;
    }

    // Sub-step curve integration for silky smooth neon arcs
    this.advancePoints(18, Math.min(0.018, dt * 0.75));
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.5;
    const scale = Math.min(width, height) * 0.34;

    // Subtle polar harmonic reference rings
    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.lineWidth = 1;
    for (let r = 0.35; r <= 1.05; r += 0.35) {
      ctx.beginPath();
      ctx.arc(cx, cy, scale * r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.ptCount < 2) {
      ctx.restore();
      return;
    }

    const cosY = Math.cos(this.rotYaw);
    const sinY = Math.sin(this.rotYaw);
    const cosP = Math.cos(this.rotPitch);
    const sinP = Math.sin(this.rotPitch);
    const camDist = 3.2;

    // Draw trajectory in neon spectral batches (32 segments for rich gradient)
    const batchSize = Math.max(12, Math.floor(this.ptCount / 32));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let prevSX = 0;
    let prevSY = 0;
    let lastX = 0;
    let lastY = 0;

    for (let start = 0; start < this.ptCount - 1; start += batchSize) {
      const end = Math.min(this.ptCount - 1, start + batchSize);
      const tNorm = start / Math.max(1, this.ptCount);
      const hue = 185 + tNorm * 145; // Cyan -> Violet -> Gold-Magenta
      const alpha = 0.16 + 0.78 * tNorm;

      ctx.beginPath();
      for (let i = start; i <= end; i++) {
        const x = this.ptsX[i];
        const y = this.ptsY[i];
        const z = this.ptsZ[i];

        // Rotate around Y (yaw) then X (pitch)
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y2 = y * cosP - z1 * sinP;
        const z2 = y * sinP + z1 * cosP;

        const persp = camDist / (camDist + z2);
        const sx = cx + x1 * scale * persp;
        const sy = cy + y2 * scale * persp;

        if (i === start) {
          if (start > 0) {
            ctx.moveTo(prevSX, prevSY);
            ctx.lineTo(sx, sy);
          } else {
            ctx.moveTo(sx, sy);
          }
        } else {
          ctx.lineTo(sx, sy);
        }

        prevSX = sx;
        prevSY = sy;
        lastX = sx;
        lastY = sy;
      }

      ctx.strokeStyle = `hsla(${hue.toFixed(0)}, 92%, 62%, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.2 + tNorm * 1.4;
      ctx.stroke();
    }

    // Glowing stylus tip at current pendulum position
    const tipGrad = ctx.createRadialGradient(lastX, lastY, 1, lastX, lastY, 16);
    tipGrad.addColorStop(0, '#ffffff');
    tipGrad.addColorStop(0.3, '#f59e0b');
    tipGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = tipGrad;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
