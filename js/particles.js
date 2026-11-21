import { CONFIG } from './config.js?v=6';

/**
 * 3D-orbiting ambient twinkling sparkles and interactive tap/click sparkle bursts
 * across Dark & Light themes.
 */
export class ParticleSystem {
  constructor() {
    this.ambient = [];
    this.bursts = [];
    this._initAmbient();
  }

  _initAmbient() {
    const { ambientCount, ambientGlyphs } = CONFIG.particles;
    this.ambient = [];

    for (let i = 0; i < ambientCount; i++) {
      const angle = (i / ambientCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const radius = 0.68 + Math.random() * 0.48;
      const y = -0.78 + Math.random() * 1.48;

      this.ambient.push({
        baseAngle: angle,
        radius,
        y,
        orbitFactor: 0.35 + Math.random() * 0.35,
        glyph: ambientGlyphs[i % ambientGlyphs.length],
        colorIdx: i,
        sizeScale: 0.72 + Math.random() * 0.52,
        phase: Math.random() * Math.PI * 2,
        speed: 0.9 + Math.random() * 1.4,
      });
    }
  }

  /** Spawn a graceful burst of floating sparkles at the tap/click point */
  spawnBurst(canvasX, canvasY, themeName = 'dark', count = 10) {
    const { burstGlyphs } = CONFIG.particles;
    const palette = (CONFIG.themes[themeName] || CONFIG.themes.dark).particles;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.35;
      const speed = 22 + Math.random() * 58;
      this.bursts.push({
        x: canvasX + (Math.random() - 0.5) * 10,
        y: canvasY + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: 0,
        maxLife: 1.05 + Math.random() * 0.65,
        glyph: burstGlyphs[Math.floor(Math.random() * burstGlyphs.length)],
        color: palette.burstColors[Math.floor(Math.random() * palette.burstColors.length)],
        sizeScale: 0.9 + Math.random() * 0.55,
        wobblePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  /** Update bursts and draw 3D-orbiting sparkles onto the display canvas */
  updateAndDraw(ctx, renderer, dt, time, bloomT, rotY, tiltX, reducedMotion, themeName = 'dark') {
    const { fontSize, originX, originY, gridW, gridH } = renderer;
    const baseSize = Math.max(10, fontSize * 1.15);
    const palette = (CONFIG.themes[themeName] || CONFIG.themes.dark).particles;

    ctx.save();
    ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const ambientFade = Math.max(0, Math.min(1, (bloomT - 0.2) / 0.65));
    const cx = originX + gridW * 0.5;
    const cy = originY + gridH * 0.52;
    const cosX = Math.cos(tiltX);
    const sinX = Math.sin(tiltX);

    if (ambientFade > 0.01) {
      for (const p of this.ambient) {
        const ang = p.baseAngle + rotY * p.orbitFactor;
        const x3 = Math.cos(ang) * p.radius;
        const z0 = Math.sin(ang) * p.radius;
        const y0 = p.y + (reducedMotion ? 0 : Math.sin(time * 0.7 + p.phase) * 0.03);

        // Apply matching X-axis camera pitch so sparkles tilt cleanly with the bouquet
        const y3 = y0 * cosX + z0 * sinX;
        const z3 = -y0 * sinX + z0 * cosX;

        const persp = 3.25 / (3.35 - z3);
        const px = cx + x3 * persp * gridW * 0.45;
        const py = cy + y3 * persp * gridH * 0.46;

        const twinkle = reducedMotion
          ? 0.62
          : 0.22 + 0.74 * Math.pow(0.5 + 0.5 * Math.sin(time * p.speed + p.phase), 2);
        const depthAlpha = Math.max(0.3, Math.min(1.0, 0.68 + z3 * 0.35));
        const alpha = twinkle * depthAlpha * ambientFade * (themeName === 'dark' ? 0.9 : 0.78);
        if (alpha < 0.04) continue;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = palette.ambientColors[p.colorIdx % palette.ambientColors.length];
        ctx.font = `600 ${(baseSize * p.sizeScale * (0.85 + persp * 0.15)).toFixed(1)}px ${CONFIG.fontFamily}`;
        ctx.fillText(p.glyph, px, py);
      }
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        this.bursts.splice(i, 1);
        continue;
      }

      const t = b.life / b.maxLife;
      b.vx *= Math.pow(0.94, dt * 60);
      b.vy -= 14 * dt;
      b.x += (b.vx + Math.sin(time * 4 + b.wobblePhase) * 14) * dt;
      b.y += b.vy * dt;

      const alpha = t < 0.15 ? t / 0.15 : Math.pow(1 - (t - 0.15) / 0.85, 1.4);
      const scale = b.sizeScale * (0.85 + 0.3 * Math.sin(t * Math.PI));

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha * 0.92));
      ctx.fillStyle = b.color;
      ctx.font = `600 ${(baseSize * scale).toFixed(1)}px ${CONFIG.fontFamily}`;
      ctx.fillText(b.glyph, b.x, b.y);
    }

    ctx.restore();
  }
}
