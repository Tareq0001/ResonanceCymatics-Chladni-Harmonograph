/**
 * Physics Dossier Modal: Standing-Wave Chladni Equations, 3D Harmonograph & Musical Ratios
 * Lead Creative Technologist & Systems Architect: أ. طارق ابوعشي | Tareq Abuashi
 */

export class DossierModal {
  private modalEl: HTMLElement;

  constructor(modalId: string) {
    const el = document.getElementById(modalId);
    if (!el) throw new Error(`Modal element #${modalId} not found`);
    this.modalEl = el;
    this.renderMarkup();
    this.attachEvents();
  }

  private renderMarkup(): void {
    this.modalEl.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-badge">COMPUTATIONAL ACOUSTICS &amp; CYMATICS DOSSIER</span>
            <h2 id="dossier-title">Mathematical &amp; Physical Architecture of RESONANCE-CYMATICS</h2>
            <p class="modal-author">
              Lead Creative Technologist &amp; Systems Architect:
              <strong>أ. طارق ابوعشي | Tareq Abuashi</strong>
            </p>
          </div>
          <button id="close-dossier-x" class="close-btn" aria-label="Close Physics Dossier">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body custom-scroll">
          <section class="math-section">
            <span class="section-tag">01 // CHLADNI STANDING-WAVE EIGENMODES (2D PLATE)</span>
            <h3>Square Plate &amp; Circular Bessel Nodal Contours</h3>
            <p>
              When a thin elastic metal plate is driven at an eigenfrequency, constructive and destructive interference produces
              stationary regions of zero vertical displacement called <span class="highlight-text">Nodal Lines (|Z| ≈ 0)</span>.
              26,000 sand grains experience stochastic vibrational agitation proportional to |Z(x, y)| at antinodes and drift
              down the gradient &minus;&nabla;(Z&sup2;) until settling along geometric cymatic mandalas.
            </p>
            <div class="formula-box highlight">
              <div>Square Plate: &nbsp;Z(x, y) = a &middot; cos(n&pi;x) &middot; cos(m&pi;y) + b &middot; cos(m&pi;x) &middot; cos(n&pi;y)</div>
              <div>Circular Plate: Z(r, &theta;) = J<sub>n</sub>(k<sub>n,m</sub> r) &middot; [a &middot; cos(n&theta;) + b &middot; sin(n&theta;)]</div>
            </div>
          </section>

          <section class="math-section">
            <span class="section-tag">02 // 3D DAMPED ROTARY HARMONOGRAPH &amp; LISSAJOUS GEOMETRY</span>
            <h3>Four-Pendulum Coupled Phase Space</h3>
            <p>
              A rotary harmonograph couples orthogonal damped harmonic oscillators. Small rational frequency ratios
              (Just Intonation intervals) trace crystalline closed-loop symmetry, whereas irrational detuning or phase drift
              weaves dense 3D toroidal Lissajous ribbons decaying exponentially via viscous damping e<sup>&minus;dt</sup>.
            </p>
            <div class="formula-box">
              <div>x(t) = A<sub>1</sub>e<sup>&minus;d<sub>1</sub>t</sup> sin(&omega;<sub>1</sub>t + &phi;<sub>1</sub>) + A<sub>2</sub>e<sup>&minus;d<sub>2</sub>t</sup> cos(&omega;<sub>2</sub>t + &phi;<sub>2</sub>)</div>
              <div>y(t) = A<sub>3</sub>e<sup>&minus;d<sub>3</sub>t</sup> sin(&omega;<sub>3</sub>t) + A<sub>4</sub>e<sup>&minus;d<sub>4</sub>t</sup> sin(&omega;<sub>4</sub>t + &pi;/2)</div>
              <div>z(t) = A<sub>z</sub>e<sup>&minus;d<sub>z</sub>t</sup> cos(&omega;<sub>z</sub>t + &phi;<sub>z</sub>)</div>
            </div>
          </section>

          <section class="math-section">
            <span class="section-tag">03 // MUSICAL INTERVALS AS GEOMETRIC SYMMETRY</span>
            <h3>Harmonic Ratios &amp; Acoustic Resonance</h3>
            <p>
              Pythagorean and Just Intonation intervals translate directly into spatial symmetry orders:
              <span class="highlight-text">1:1 Unison</span> (elliptical symmetry),
              <span class="highlight-text">3:2 Perfect Fifth</span> (3-lobed knot),
              <span class="highlight-text">4:3 Perfect Fourth</span> (4-fold weave),
              <span class="highlight-text">5:4 Major Third</span> (5-petal rose), and
              <span class="highlight-text">7:4 Harmonic Seventh</span> (7-fold star). Playing the Web Audio polyphonic piano
              or triggering presets like 432 Hz, 528 Hz, or &phi; instantaneously re-tunes both the harmonic spectrum and standing-wave modes.
            </p>
          </section>

          <section class="math-section">
            <span class="section-tag">04 // CIRCULAR RIPPLE INTERFERENCE TANK</span>
            <h3>Multi-Source Wave Superposition</h3>
            <p>
              Each draggable point emitter radiates attenuated cylindrical ripples into a circular fluid tank. The instantaneous
              surface elevation is the linear superposition &Sigma; A<sub>i</sub>(r<sub>i</sub>) sin(k &middot; r<sub>i</sub> &minus; &omega;t + &phi;<sub>i</sub>),
              visualizing hyperbolic nodal interference fringes in real time.
            </p>
          </section>
        </div>

        <div class="modal-footer">
          <span class="footer-note">Zero-Allocation Float32Array &amp; Uint32Array Pipeline &bull; Designed by أ. طارق ابوعشي | Tareq Abuashi</span>
          <button id="close-dossier-btn" class="action-btn">Return to Lab</button>
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    const closeX = document.getElementById('close-dossier-x');
    const closeBtn = document.getElementById('close-dossier-btn');
    closeX?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modalEl.classList.contains('hidden')) {
        this.close();
      }
    });
  }

  public open(): void {
    this.modalEl.classList.remove('hidden');
  }

  public close(): void {
    this.modalEl.classList.add('hidden');
  }
}
