import { CONFIG } from './config.js?v=6';

/**
 * High-speed truecolor ASCII renderer consuming the 3D Z-buffer output directly.
 * Draws razor-sharp monospace glyphs onto a HiDPI display canvas across Dark & Light themes.
 */
export class AsciiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = CONFIG.grid.cols;
    this.rows = CONFIG.grid.rows;
    this.cellAspect = CONFIG.grid.cellAspect;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.fontSize = 12;
    this.cellW = 7.2;
    this.cellH = 12;
    this.originX = 0;
    this.originY = 0;
    this.gridW = 0;
    this.gridH = 0;
  }

  /** Recompute HiDPI backing store and responsive character metrics */
  resize(viewportW, viewportH) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.width = viewportW;
    this.height = viewportH;

    this.canvas.width = Math.max(1, Math.round(viewportW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(viewportH * this.dpr));
    this.canvas.style.width = `${viewportW}px`;
    this.canvas.style.height = `${viewportH}px`;

    const captionReserve = Math.max(54, Math.min(82, viewportH * 0.1));
    const padX = Math.max(14, viewportW * 0.04);
    const padTop = Math.max(14, viewportH * 0.03);
    const availW = Math.max(120, viewportW - padX * 2);
    const availH = Math.max(120, viewportH - padTop - captionReserve);

    const maxCellHByHeight = availH / this.rows;
    const maxCellHByWidth = availW / (this.cols * this.cellAspect);
    this.cellH = Math.max(4.5, Math.min(maxCellHByHeight, maxCellHByWidth, 16.5));
    this.cellW = this.cellH * this.cellAspect;
    this.fontSize = this.cellH * 1.04;

    this.gridW = this.cols * this.cellW;
    this.gridH = this.rows * this.cellH;
    this.originX = (viewportW - this.gridW) * 0.5;
    this.originY = padTop + (availH - this.gridH) * 0.5;
  }

  /** Draw the 3D Z-buffered ASCII matrix for the current frame */
  drawFrame(frameBuf, time, reducedMotion) {
    const { occBuf, matBuf, rBuf, gBuf, bBuf, shadeBuf } = frameBuf;
    const ctx = this.ctx;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.font = `600 ${this.fontSize.toFixed(2)}px ${CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const { cols, rows, cellW, cellH, originX, originY } = this;
    const ramps = CONFIG.ramps;
    const shimmerAmp = reducedMotion ? 0 : CONFIG.animation.shimmerStrength;

    let lastFill = '';

    for (let row = 0; row < rows; row++) {
      const py = originY + (row + 0.5) * cellH;
      const rowOffset = row * cols;

      for (let col = 0; col < cols; col++) {
        const idx = rowOffset + col;
        if (occBuf[idx] === 0) continue;

        const mat = matBuf[idx] || CONFIG.materials.PETAL;
        const ramp = ramps[mat] || ramps[CONFIG.materials.PETAL];
        const shimmer =
          shimmerAmp > 0
            ? Math.sin(col * 0.7 + row * 0.9 + time * 2.1) * shimmerAmp
            : 0;

        const density = Math.max(0.08, Math.min(0.999, shadeBuf[idx] + shimmer));
        const charIndex = Math.min(ramp.length - 1, Math.max(1, Math.floor(density * ramp.length)));
        const glyph = ramp[charIndex];
        if (glyph === ' ') continue;

        const qr = (rBuf[idx] >> 2) << 2;
        const qg = (gBuf[idx] >> 2) << 2;
        const qb = (bBuf[idx] >> 2) << 2;
        const fill = `rgb(${qr},${qg},${qb})`;
        if (fill !== lastFill) {
          ctx.fillStyle = fill;
          lastFill = fill;
        }

        const px = originX + (col + 0.5) * cellW;
        ctx.fillText(glyph, px, py);
      }
    }
  }
}
