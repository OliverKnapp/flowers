import { CONFIG } from './config.js?v=6';

const { materials: MAT } = CONFIG;

function easeOutCubic(t) {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

function easeOutBack(t, overshoot = 0.95) {
  const c = Math.max(0, Math.min(1, t));
  const f = c - 1;
  return 1 + (overshoot + 1) * f * f * f + overshoot * f * f;
}

function subProgress(globalT, start, end) {
  if (globalT <= start) return 0;
  if (globalT >= end) return 1;
  return (globalT - start) / (end - start);
}

function normalize3(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

function cross3(ax, ay, az, bx, by, bz) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

/**
 * 7 independent 3D flowers arranged around a 360° volumetric bouquet crown:
 * 1 tall central pearl-white blossom + 6 evenly spaced (60° apart) outer blooms
 * at staggered heights so every rotation angle shows crisp, separated individual flowers.
 */
function buildBloomSpecs() {
  const ringDefs = [
    { key: 'orchid',    type: 'daisy',     deg: -135, rad: 0.56, y: -0.39, r: 0.24, petals: 10, start: 0.34, end: 0.84, ph: 0.2 },
    { key: 'magenta',   type: 'daisy',     deg:  -75, rad: 0.65, y: -0.14, r: 0.22, petals: 9,  start: 0.38, end: 0.86, ph: 0.8 },
    { key: 'rose',      type: 'rose',      deg:  -18, rad: 0.52, y: -0.36, r: 0.24, petals: 6,  start: 0.36, end: 0.88, ph: 1.4 },
    { key: 'sunflower', type: 'sunflower', deg:   42, rad: 0.66, y: -0.18, r: 0.24, petals: 12, start: 0.40, end: 0.88, ph: 2.0 },
    { key: 'pink',      type: 'daisy',     deg:  105, rad: 0.56, y: -0.35, r: 0.23, petals: 9,  start: 0.42, end: 0.90, ph: 2.6 },
    { key: 'lavender',  type: 'daisy',     deg:  165, rad: 0.64, y: -0.15, r: 0.22, petals: 9,  start: 0.44, end: 0.92, ph: 3.2 },
  ];

  const specs = [
    {
      key: 'pearl',
      type: 'daisy',
      x: 0.0,
      y: -0.58,
      z: 0.08,
      stemBaseX: 0.0,
      stemBaseY: 0.17,
      stemBaseZ: 0.0,
      r: 0.24,
      petals: 9,
      start: 0.32,
      end: 0.86,
      ph: 0.5,
      tiltOut: 1.4,
      fixedTiltZ: 0.42,
    },
  ];

  for (const d of ringDefs) {
    const a = (d.deg * Math.PI) / 180;
    const x = Math.cos(a) * d.rad;
    const z = Math.sin(a) * d.rad;
    specs.push({
      key: d.key,
      type: d.type,
      x,
      y: d.y,
      z,
      stemBaseX: Math.cos(a) * 0.12,
      stemBaseY: 0.17,
      stemBaseZ: Math.sin(a) * 0.12,
      r: d.r,
      petals: d.petals,
      start: d.start,
      end: d.end,
      ph: d.ph,
      tiltOut: 2.15,
      fixedTiltZ: 0,
    });
  }
  return specs;
}

const BLOOM_SPECS = buildBloomSpecs();

/**
 * Software 3D Z-Buffered Volumetric Botanical Engine.
 * Projects true 3D flowers, curved stems, 360° foliage fans, pleated florist paper wrap,
 * and a 3D butterfly ribbon bow directly onto the (cols x rows) ASCII cell grid with
 * exact per-cell occlusion, 3D Lambert lighting, and depth shading.
 */
export class Bouquet3D {
  constructor(cols, rows, cellAspect) {
    this.cols = cols;
    this.rows = rows;
    this.cellAspect = cellAspect;
    this.size = cols * rows;

    // Per-cell Z-buffer & shading buffers (~50 KB total, zero GC churn per frame)
    this.zBuf = new Float32Array(this.size);
    this.occBuf = new Uint8Array(this.size);
    this.matBuf = new Uint8Array(this.size);
    this.rBuf = new Uint8Array(this.size);
    this.gBuf = new Uint8Array(this.size);
    this.bBuf = new Uint8Array(this.size);
    this.shadeBuf = new Float32Array(this.size);

    this.centerX = cols * 0.5;
    this.centerY = rows * 0.53;
    this.projScaleY = rows * 0.43;
    this.projScaleX = this.projScaleY / cellAspect;

    // Directional key light (upper-front-left)
    const [lx, ly, lz] = normalize3(-0.38, -0.56, 0.74);
    this.lx = lx;
    this.ly = ly;
    this.lz = lz;

    // Per-frame transform trig cache
    this.cosY = 1;
    this.sinY = 0;
    this.cosX = 1;
    this.sinX = 0;
    this.camZ = 3.35;
    this.fov = 3.25;
    this.isDark = true;
  }

  /** Render one 3D frame into the internal Z-buffer and return buffer views */
  render(bloomT, time, rotY, tiltX = CONFIG.animation.cameraTiltX, themeName = 'dark') {
    const palette = CONFIG.themes[themeName] || CONFIG.themes.dark;
    this.isDark = themeName === 'dark';

    this.zBuf.fill(-1e9);
    this.occBuf.fill(0);

    this.cosY = Math.cos(rotY);
    this.sinY = Math.sin(rotY);
    this.cosX = Math.cos(tiltX);
    this.sinX = Math.sin(tiltX);

    const stemP = easeOutCubic(subProgress(bloomT, 0.0, 0.36));
    const upperStemP = easeOutCubic(subProgress(bloomT, 0.14, 0.50));
    const wrapP = easeOutCubic(subProgress(bloomT, 0.10, 0.52));
    const leafP = easeOutCubic(subProgress(bloomT, 0.22, 0.64));
    const ribbonP = easeOutBack(subProgress(bloomT, 0.34, 0.68), 0.7);

    // 1. Lower 3D bundled stems beneath the ribbon
    if (stemP > 0.01) {
      this._drawLowerStems(stemP, palette);
    }

    // 2. Slender 3D curved stems connecting each independent flower into the paper wrap
    if (upperStemP > 0.01) {
      this._drawUpperStems(upperStemP, time, palette);
    }

    // 3. 360° radiating 3D emerald foliage collar
    if (leafP > 0.01) {
      this._drawFoliageCollar(leafP, time, palette);
    }

    // 4. 3D pleated florist paper cone wrap
    if (wrapP > 0.01) {
      this._drawPaperCone(wrapP, palette);
    }

    // 5. 3D waist ribbon belt, sculpted butterfly bow, and curved hanging tails
    if (ribbonP > 0.01) {
      this._drawRibbon3D(ribbonP, time, palette);
    }

    // 6. 7 independent volumetric 3D flower blooms
    for (const b of BLOOM_SPECS) {
      const p = easeOutBack(subProgress(bloomT, b.start, b.end), 0.85);
      if (p <= 0.01) continue;
      const sway = Math.sin(time * CONFIG.animation.swaySpeed + b.ph) * CONFIG.animation.swayAmplitude;
      const fx = b.x + sway;
      const fy = b.y + sway * 0.25;
      const fz = b.z + Math.cos(time * CONFIG.animation.swaySpeed * 0.9 + b.ph) * CONFIG.animation.swayAmplitude * 0.7;
      const colors = palette.flowers[b.key];
      this._drawFlower3D(fx, fy, fz, b.r * p, b.type, b.petals, b.tiltOut, b.fixedTiltZ, colors, time, b.ph);
    }

    return {
      occBuf: this.occBuf,
      matBuf: this.matBuf,
      rBuf: this.rBuf,
      gBuf: this.gBuf,
      bBuf: this.bBuf,
      shadeBuf: this.shadeBuf,
    };
  }

  /** Transform 3D point & normal, apply perspective + Lambert/depth shading, write to Z-buffer */
  _plot(x, y, z, nx, ny, nz, matId, cDark, cLight, spread = false, shadeBias = 0) {
    // Rotate around Y-axis (turntable rotation)
    const rx = x * this.cosY - z * this.sinY;
    const rz0 = x * this.sinY + z * this.cosY;

    // Camera pitch around X-axis: positive tiltX tilts the top of the bouquet toward the viewer
    const ry = y * this.cosX + rz0 * this.sinX;
    const rz = -y * this.sinX + rz0 * this.cosX;

    const invZ = this.fov / (this.camZ - rz);
    if (invZ <= 0) return;

    const gx = Math.round(this.centerX + rx * invZ * this.projScaleX);
    const gy = Math.round(this.centerY + ry * invZ * this.projScaleY);
    if (gy < 0 || gy >= this.rows || gx < 0 || gx >= this.cols) return;

    // Rotate normal into view space
    const rnx = nx * this.cosY - nz * this.sinY;
    const rnz0 = nx * this.sinY + nz * this.cosY;
    const rny = ny * this.cosX + rnz0 * this.sinX;
    const rnz = -ny * this.sinX + rnz0 * this.cosX;

    // Two-sided soft botanical diffuse lighting + front-facing rim + 3D depth separation
    const dot = rnx * this.lx + rny * this.ly + rnz * this.lz;
    const diffuse = Math.abs(dot) * 0.68 + Math.max(0, dot) * 0.32;
    const depthCue = Math.max(0.42, Math.min(1.06, 0.72 + rz * 0.38));

    let shade = (0.28 + 0.72 * diffuse) * depthCue + shadeBias;
    shade = Math.max(0.12, Math.min(1.0, shade));

    // Blend color smoothly between cDark and cLight based on 3D lighting + depth
    const colorT = Math.max(0, Math.min(1, shade));
    const r = Math.round(cDark[0] + (cLight[0] - cDark[0]) * colorT);
    const g = Math.round(cDark[1] + (cLight[1] - cDark[1]) * colorT);
    const b = Math.round(cDark[2] + (cLight[2] - cDark[2]) * colorT);

    // Light mode: preserve rich dynamic character ramp (. : - = + * o 0 O # % @) on white
    const asciiShade = this.isDark ? shade : Math.max(0.14, Math.min(0.98, 0.18 + 0.86 * (1 - shade * 0.62) * depthCue));

    const idx = gy * this.cols + gx;
    if (rz > this.zBuf[idx]) {
      this.zBuf[idx] = rz;
      this.occBuf[idx] = 1;
      this.matBuf[idx] = matId;
      this.rBuf[idx] = r;
      this.gBuf[idx] = g;
      this.bBuf[idx] = b;
      this.shadeBuf[idx] = Math.max(0.1, Math.min(0.999, asciiShade));
    }

    // Optional subtle 1-cell horizontal fill to avoid pinholes on curved surfaces
    if (spread && gx + 1 < this.cols) {
      const idx2 = idx + 1;
      if (rz - 0.004 > this.zBuf[idx2]) {
        this.zBuf[idx2] = rz - 0.004;
        this.occBuf[idx2] = 1;
        this.matBuf[idx2] = matId;
        this.rBuf[idx2] = r;
        this.gBuf[idx2] = g;
        this.bBuf[idx2] = b;
        this.shadeBuf[idx2] = Math.max(0.1, Math.min(0.999, asciiShade * 0.96));
      }
    }
  }

  /** Draw a 3D tube segment along a quadratic Bezier curve */
  _drawBezierTube(p0, p1, p2, radius, steps, matId, cDark, cLight) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
      const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
      const z = mt * mt * p0[2] + 2 * mt * t * p1[2] + t * t * p2[2];

      // Plot 6 points around a tiny circular cross-section so the stem is truly 3D from all sides
      const rings = 6;
      for (let k = 0; k < rings; k++) {
        const a = (k / rings) * Math.PI * 2;
        const nx = Math.cos(a);
        const nz = Math.sin(a);
        this._plot(x + nx * radius, y, z + nz * radius, nx, 0, nz, matId, cDark, cLight, false);
      }
    }
  }

  /** 1. Bundled 3D lower green stems below the ribbon */
  _drawLowerStems(progress, palette) {
    const stems = [
      { ang: 0.2,  rTop: 0.045, rBot: 0.06,  len: 0.35 },
      { ang: 1.5,  rTop: 0.04,  rBot: 0.055, len: 0.38 },
      { ang: 2.8,  rTop: 0.045, rBot: 0.065, len: 0.36 },
      { ang: 4.1,  rTop: 0.04,  rBot: 0.05,  len: 0.34 },
      { ang: 5.3,  rTop: 0.03,  rBot: 0.035, len: 0.37 },
    ];
    for (const s of stems) {
      const topY = 0.56;
      const botY = topY + s.len * progress;
      const tx = Math.cos(s.ang) * s.rTop;
      const tz = Math.sin(s.ang) * s.rTop;
      const bx = Math.cos(s.ang + 0.15) * s.rBot;
      const bz = Math.sin(s.ang + 0.15) * s.rBot;
      this._drawBezierTube(
        [tx, topY, tz],
        [(tx + bx) * 0.5, (topY + botY) * 0.5, (tz + bz) * 0.5],
        [bx, botY, bz],
        0.018,
        20,
        MAT.STEM,
        palette.stemBase,
        palette.stemLight
      );
    }
  }

  /** 2. Slender 3D arching stems connecting each independent flower down into the paper cone */
  _drawUpperStems(progress, time, palette) {
    for (const b of BLOOM_SPECS) {
      const sway = Math.sin(time * CONFIG.animation.swaySpeed + b.ph) * CONFIG.animation.swayAmplitude;
      const hx = b.x + sway;
      const hy = b.y + sway * 0.25 + 0.03;
      const hz = b.z + Math.cos(time * CONFIG.animation.swaySpeed * 0.9 + b.ph) * CONFIG.animation.swayAmplitude * 0.7;

      const curX = b.stemBaseX + (hx - b.stemBaseX) * progress;
      const curY = b.stemBaseY + (hy - b.stemBaseY) * progress;
      const curZ = b.stemBaseZ + (hz - b.stemBaseZ) * progress;

      // Graceful outward bow in the middle of each stem
      const ctrlX = (b.stemBaseX + curX) * 0.5 * 1.15;
      const ctrlY = (b.stemBaseY + curY) * 0.5 + 0.05;
      const ctrlZ = (b.stemBaseZ + curZ) * 0.5 * 1.15;

      this._drawBezierTube(
        [b.stemBaseX, b.stemBaseY, b.stemBaseZ],
        [ctrlX, ctrlY, ctrlZ],
        [curX, curY, curZ],
        0.015,
        24,
        MAT.STEM,
        palette.stemBase,
        palette.stemLight
      );

      // Cute small 3D stem leaflet sprouting halfway up tall stems
      if (progress > 0.55 && b.y < -0.35) {
        const lp = (progress - 0.55) / 0.45;
        const mx = (b.stemBaseX + hx) * 0.52;
        const my = (b.stemBaseY + hy) * 0.52;
        const mz = (b.stemBaseZ + hz) * 0.52;
        const ang = Math.atan2(hz, hx) + 0.65;
        this._drawLeaf3D(mx, my, mz, ang, 0.16 * lp, 0.045 * lp, -0.06, palette);
      }
    }
  }

  /** Sculpted 3D curved botanical leaf blade */
  _drawLeaf3D(ox, oy, oz, azimuth, length, maxWidth, droop, palette) {
    const dirX = Math.cos(azimuth);
    const dirZ = Math.sin(azimuth);
    const sideX = -dirZ;
    const sideZ = dirX;

    const uSteps = 18;
    const vSteps = 7;

    for (let ui = 1; ui <= uSteps; ui++) {
      const u = ui / uSteps;
      // Tapered lance-shaped botanical leaf profile
      const halfW = Math.sin(Math.pow(u, 0.72) * Math.PI) * maxWidth;
      const archY = -Math.sin(u * Math.PI * 0.75) * length * 0.18 + u * u * droop;

      const cx = ox + dirX * (u * length);
      const cy = oy + archY;
      const cz = oz + dirZ * (u * length);

      for (let vi = -vSteps; vi <= vSteps; vi++) {
        const v = vi / vSteps; // [-1, 1] across width
        const w = v * halfW;
        // Slight V-fold trough along central leaf vein
        const foldY = Math.abs(v) * halfW * 0.28;
        const px = cx + sideX * w;
        const py = cy + foldY;
        const pz = cz + sideZ * w;

        const [nx, ny, nz] = normalize3(sideX * v * 0.35 + dirX * 0.15, -0.88, sideZ * v * 0.35 + dirZ * 0.15);
        const veinBoost = Math.abs(v) < 0.18 ? 0.14 : 0;
        this._plot(px, py, pz, nx, ny, nz, MAT.LEAF, palette.leafBase, palette.leafLight, true, veinBoost);
      }
    }
  }

  /** 3. 360° radiating 3D emerald foliage collar fanning gracefully around the wrap rim */
  _drawFoliageCollar(progress, time, palette) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.18;
      const isLong = i % 2 === 0;
      const sway = Math.sin(time * 1.1 + i * 0.9) * 0.025;
      const ox = Math.cos(a) * 0.22;
      const oz = Math.sin(a) * 0.22;
      const oy = isLong ? 0.15 : 0.19;
      const len = (isLong ? 0.58 : 0.44) * progress;
      const width = (isLong ? 0.088 : 0.072) * progress;
      const droop = (isLong ? 0.18 : 0.24) + sway;

      this._drawLeaf3D(ox, oy, oz, a, len, width, droop, palette);
    }
  }

  /** 4. 3D pleated florist paper cone wrap (tapered cone + cinched waist + flared skirt) */
  _drawPaperCone(progress, palette) {
    const topY = 0.58 - (0.58 - 0.14) * progress;
    const waistY = 0.58;
    const botY = 0.58 + 0.085 * progress;

    const ySteps = 44;
    const aSteps = 56;

    for (let yi = 0; yi <= ySteps; yi++) {
      const v = yi / ySteps;
      const y = topY + (botY - topY) * v;

      // Radius profile: wide open crown -> tapered cone -> pinched waist -> subtle flared skirt
      let baseR;
      if (y <= waistY) {
        const u = (y - topY) / Math.max(0.001, waistY - topY);
        baseR = 0.41 * (1 - u * 0.72) * progress + 0.115 * (1 - progress);
      } else {
        const u = (y - waistY) / Math.max(0.001, botY - waistY);
        baseR = 0.115 + u * 0.055 * progress;
      }

      // Horizontal subtle paper banding for the iconic `---===---` wrap texture
      const bandBias = yi % 2 === 0 ? 0.08 : -0.05;

      for (let ai = 0; ai < aSteps; ai++) {
        const a = (ai / aSteps) * Math.PI * 2;
        // Soft 3D origami parchment pleats around circumference
        const pleat = 1 + 0.055 * Math.cos(a * 6 + v * 1.4);
        const r = baseR * pleat;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;

        // Slightly tilted cone surface normal + pleat ridge shading
        const pleatSlope = -0.18 * Math.sin(a * 6 + v * 1.4);
        const [nx, ny, nz] = normalize3(
          Math.cos(a) - Math.sin(a) * pleatSlope,
          0.26,
          Math.sin(a) + Math.cos(a) * pleatSlope
        );

        this._plot(x, y, z, nx, ny, nz, MAT.WRAP, palette.wrapBase, palette.wrapLight, true, bandBias);
      }
    }
  }

  /** 5. 3D coral-pink satin waist belt, sculpted front butterfly bow & curved hanging tails */
  _drawRibbon3D(progress, time, palette) {
    const s = Math.min(1.04, progress);
    const waistY = 0.58;
    const bandR = 0.132;

    // 360° satin band wrapped snugly around the cone waist
    const bandSteps = 44;
    for (let yi = -2; yi <= 2; yi++) {
      const y = waistY + yi * 0.011 * s;
      for (let ai = 0; ai < bandSteps; ai++) {
        const a = (ai / bandSteps) * Math.PI * 2;
        const x = Math.cos(a) * bandR;
        const z = Math.sin(a) * bandR;
        this._plot(x, y, z, Math.cos(a), yi * 0.15, Math.sin(a), MAT.RIBBON, palette.ribbonBase, palette.ribbonLight, true);
      }
    }

    // Sculpted 3D butterfly bow perched on the front (+Z) of the waist
    const frontZ = bandR + 0.025;
    for (const side of [-1, 1]) {
      const uSteps = 18;
      const vSteps = 9;
      for (let ui = 0; ui <= uSteps; ui++) {
        const u = ui / uSteps; // 0 at knot -> 1 at outer loop edge
        const loopX = side * (0.025 + u * 0.195 * s);
        const loopHalfH = (0.018 + Math.sin(Math.pow(u, 0.78) * Math.PI) * 0.068) * s;
        // 3D curved ribbon bulge out in +Z
        const loopZ = frontZ + Math.sin(u * Math.PI) * 0.055 * s;

        for (let vi = -vSteps; vi <= vSteps; vi++) {
          const v = vi / vSteps;
          const y = waistY + v * loopHalfH;
          // Subtle recessed crease across the center of each bow loop
          const crease = Math.abs(v) < 0.22 && u > 0.25 && u < 0.8 ? -0.18 : 0.06;
          const [nx, ny, nz] = normalize3(side * 0.25, v * 0.45, 0.88);
          this._plot(loopX, y, loopZ, nx, ny, nz, MAT.RIBBON, palette.ribbonBase, palette.ribbonLight, true, crease);
        }
      }
    }

    // Central satin knot
    for (let ui = -4; ui <= 4; ui++) {
      for (let vi = -3; vi <= 3; vi++) {
        const kx = ui * 0.009 * s;
        const ky = waistY + vi * 0.009 * s;
        const kz = frontZ + 0.036 * s - (ui * ui + vi * vi) * 0.0012;
        this._plot(kx, ky, kz, ui * 0.15, vi * 0.15, 0.95, MAT.RIBBON, palette.ribbonBase, palette.ribbonLight, true, 0.1);
      }
    }

    // Twin gracefully curving 3D hanging ribbon tails draping down in front of stems
    const swayTail = Math.sin(time * 1.5) * 0.015;
    this._drawBezierTube(
      [-0.02, waistY + 0.02, frontZ + 0.015],
      [-0.085 + swayTail, waistY + 0.12, frontZ + 0.035],
      [-0.125 + swayTail * 1.4, waistY + 0.23 * s, frontZ + 0.02],
      0.017 * s,
      18,
      MAT.RIBBON,
      palette.ribbonBase,
      palette.ribbonLight
    );
    this._drawBezierTube(
      [0.018, waistY + 0.02, frontZ + 0.015],
      [0.045 - swayTail * 0.7, waistY + 0.13, frontZ + 0.03],
      [0.015 - swayTail, waistY + 0.25 * s, frontZ + 0.015],
      0.015 * s,
      18,
      MAT.RIBBON,
      palette.ribbonBase,
      palette.ribbonLight
    );
  }

  /**
   * 6. Sculpted Volumetric 3D Flower Head oriented along its own radial/upward stem axis.
   * Supports 'daisy' (distinct radiating cupped petals), 'rose' (concentric 3D spiral petals),
   * and 'sunflower' (crisp pointed golden rays around a domed pollen center).
   */
  _drawFlower3D(fx, fy, fz, radius, type, petalCount, tiltOut, fixedTiltZ, colors, time, phase) {
    // Build orthonormal local 3D frame (U, V, Axis) facing richly outward & upward
    const [ax, ay, az] = normalize3(fx * tiltOut, -0.82, fz * tiltOut + fixedTiltZ);
    const refX = Math.abs(ax) < 0.85 ? 1 : 0;
    const refZ = Math.abs(ax) < 0.85 ? 0 : 1;
    let [ux, uy, uz] = cross3(refX, 0, refZ, ax, ay, az);
    [ux, uy, uz] = normalize3(ux, uy, uz);
    const [vx, vy, vz] = cross3(ax, ay, az, ux, uy, uz);

    const rotSpin = Math.sin(time * 0.7 + phase) * 0.06;

    // Helper: local (lx, ly, lh) -> world 3D + plot
    const plotLocal = (lx, ly, lh, nlx, nly, nlh, matId, cDark, cLight, bias = 0) => {
      const wx = fx + ux * lx + vx * ly + ax * lh;
      const wy = fy + uy * lx + vy * ly + ay * lh;
      const wz = fz + uz * lx + vz * ly + az * lh;
      const wnx = ux * nlx + vx * nly + ax * nlh;
      const wny = uy * nlx + vy * nly + ay * nlh;
      const wnz = uz * nlx + vz * nly + az * nlh;
      this._plot(wx, wy, wz, wnx, wny, wnz, matId, cDark, cLight, true, bias);
    };

    if (type === 'rose') {
      // Volumetric 3D spiral rose: 3 deep sculptural cupped whorls so it's lush from all 360°
      const whorls = [
        { count: 6, rMin: 0.30, rMax: 1.02, cup: 0.65, widthAng: 0.72, offset: 0.0,  bias: 0.06 },
        { count: 5, rMin: 0.16, rMax: 0.74, cup: 0.85, widthAng: 0.78, offset: 0.65, bias: 0.0 },
        { count: 4, rMin: 0.04, rMax: 0.44, cup: 1.02, widthAng: 0.86, offset: 1.35, bias: -0.08 },
      ];
      for (const w of whorls) {
        for (let p = 0; p < w.count; p++) {
          const baseA = (p / w.count) * Math.PI * 2 + w.offset + rotSpin;
          for (let ri = 0; ri <= 10; ri++) {
            const u = ri / 10;
            const rad = (w.rMin + (w.rMax - w.rMin) * u) * radius;
            const cupH = (Math.sin(u * Math.PI * 0.72) * w.cup * 0.58 - 0.14) * radius;
            const halfSpan = Math.sin(Math.pow(u, 0.68) * Math.PI) * w.widthAng;
            for (let ai = -4; ai <= 4; ai++) {
              const frac = ai / 4;
              const ang = baseA + frac * halfSpan;
              const lx = Math.cos(ang) * rad;
              const ly = Math.sin(ang) * rad;
              const curlH = cupH + (1 - frac * frac) * 0.08 * radius;
              const [nlx, nly, nlh] = normalize3(Math.cos(ang) * 0.55, Math.sin(ang) * 0.55, 0.76);
              plotLocal(lx, ly, curlH, nlx, nly, nlh, MAT.PETAL, colors.petalDark, colors.petalLight, w.bias + u * 0.08);
            }
          }
        }
      }
      for (let ri = 0; ri <= 4; ri++) {
        const rad = (ri / 4) * radius * 0.24;
        const h = (0.24 - (ri / 4) * 0.06) * radius;
        const steps = Math.max(6, ri * 6);
        for (let ai = 0; ai < steps; ai++) {
          const ang = (ai / steps) * Math.PI * 2;
          plotLocal(Math.cos(ang) * rad, Math.sin(ang) * rad, h, 0, 0, 1, MAT.CENTER, colors.coreDark, colors.coreLight, -0.08);
        }
      }
      return;
    }

    // Daisy / Peony or Sunflower: 3D sculpted dome-cupped petals + tall golden pollen dome
    const isSunflower = type === 'sunflower';
    const rings = isSunflower
      ? [
          { count: petalCount, rStart: 0.24, rEnd: 1.06, width: 0.17, cup: 0.26, off: 0,   bias: 0.04 },
          { count: petalCount, rStart: 0.22, rEnd: 0.85, width: 0.15, cup: 0.44, off: 0.5, bias: 0.10 },
        ]
      : [
          { count: petalCount, rStart: 0.24, rEnd: 1.02, width: 0.27, cup: 0.36, off: 0,   bias: 0.02 },
          { count: Math.max(6, petalCount - 2), rStart: 0.20, rEnd: 0.75, width: 0.22, cup: 0.56, off: 0.5, bias: 0.10 },
        ];

    for (const ring of rings) {
      for (let p = 0; p < ring.count; p++) {
        const ang = ((p + ring.off) / ring.count) * Math.PI * 2 + rotSpin;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const pa = -sa;
        const pb = ca;

        const rSteps = 10;
        const wSteps = 4;
        for (let ri = 0; ri <= rSteps; ri++) {
          const u = ri / rSteps;
          const dist = (ring.rStart + (ring.rEnd - ring.rStart) * u) * radius;
          const shape = isSunflower
            ? Math.sin(Math.pow(u, 0.55) * Math.PI)
            : Math.sin(Math.pow(u, 0.70) * Math.PI);
          const halfW = shape * ring.width * radius;
          // Graceful tulip/peony 3D cup: rises up steeply then arcs softly outward at the tip
          const cupH = (Math.sin(u * Math.PI * 0.78) * ring.cup - 0.08) * radius;

          for (let wi = -wSteps; wi <= wSteps; wi++) {
            const v = wi / wSteps;
            const lx = ca * dist + pa * (v * halfW);
            const ly = sa * dist + pb * (v * halfW);
            const lh = cupH + (1 - v * v) * 0.06 * radius;
            const [nlx, nly, nlh] = normalize3(ca * 0.38 + pa * v * 0.22, sa * 0.38 + pb * v * 0.22, 0.85);
            plotLocal(lx, ly, lh, nlx, nly, nlh, MAT.PETAL, colors.petalDark, colors.petalLight, ring.bias);
          }
        }
      }
    }

    // Prominent 3D domed golden pollen center
    const coreR = radius * (isSunflower ? 0.35 : 0.33);
    for (let ri = 0; ri <= 6; ri++) {
      const u = ri / 6;
      const rad = u * coreR;
      const h = (0.04 + Math.cos(u * Math.PI * 0.5) * 0.28) * radius;
      const steps = Math.max(6, ri * 8);
      for (let ai = 0; ai < steps; ai++) {
        const ang = (ai / steps) * Math.PI * 2;
        const lx = Math.cos(ang) * rad;
        const ly = Math.sin(ang) * rad;
        const [nlx, nly, nlh] = normalize3(Math.cos(ang) * u * 0.65, Math.sin(ang) * u * 0.65, 0.82);
        plotLocal(lx, ly, h, nlx, nly, nlh, MAT.CENTER, colors.coreDark, colors.coreLight, 0.10);
      }
    }
  }
}
