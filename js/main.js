import { CONFIG } from './config.js?v=6';
import { Bouquet3D } from './bouquet.js?v=6';
import { AsciiRenderer } from './ascii.js?v=6';
import { ParticleSystem } from './particles.js?v=6';

const THEME_STORAGE_KEY = 'ascii-flowers-theme';

function resolveInitialTheme(params) {
  const urlTheme = params.get('theme');
  if (urlTheme === 'dark' || urlTheme === 'light') return urlTheme;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore storage errors in restricted webviews
  }
  return CONFIG.defaultTheme;
}

function init() {
  const canvas = document.getElementById('bouquet-canvas');
  const captionEl = document.getElementById('caption');
  const captionTextEl = document.getElementById('caption-text');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  if (!canvas) return;
  if (captionTextEl) {
    captionTextEl.textContent = CONFIG.caption;
  }

  const params = new URLSearchParams(window.location.search);
  const previewMode = params.has('preview');
  const angleParam = parseFloat(params.get('angle'));
  const tiltParam = parseFloat(params.get('tilt'));
  if (params.has('og')) {
    if (themeToggleBtn) themeToggleBtn.style.display = 'none';
    if (captionEl) captionEl.style.display = 'none';
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reducedMotionQuery.matches;
  reducedMotionQuery.addEventListener('change', (e) => {
    reducedMotion = e.matches;
  });

  let currentTheme = resolveInitialTheme(params);

  function applyTheme(nextTheme, persist = false) {
    currentTheme = nextTheme === 'light' ? 'light' : 'dark';
    if (currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', CONFIG.themes[currentTheme].themeColor);
    }

    if (themeToggleBtn) {
      const isDark = currentTheme === 'dark';
      themeToggleBtn.setAttribute('aria-pressed', String(isDark));
      themeToggleBtn.setAttribute(
        'aria-label',
        isDark ? 'Switch to light background' : 'Switch to dark background'
      );
    }

    if (persist) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
      } catch {
        // Ignore storage errors
      }
    }
  }

  applyTheme(currentTheme, false);

  const bouquet = new Bouquet3D(
    CONFIG.grid.cols,
    CONFIG.grid.rows,
    CONFIG.grid.cellAspect
  );
  const renderer = new AsciiRenderer(canvas);
  const particles = new ParticleSystem();

  // 3D turntable rotation + 2-axis interactive drag-to-orbit state (X & Y axes)
  let rotY = Number.isFinite(angleParam) ? (angleParam * Math.PI) / 180 : 0.12;
  let tiltX = Number.isFinite(tiltParam)
    ? (tiltParam * Math.PI) / 180
    : CONFIG.animation.cameraTiltX;
  let spinVelY = 0;
  let spinVelX = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let dragMoved = false;

  let lastBloom = reducedMotion || previewMode ? 1 : 0.02;
  let lastAnimTime = 0;

  function clampTilt(val) {
    return Math.max(CONFIG.animation.minTiltX, Math.min(CONFIG.animation.maxTiltX, val));
  }

  function renderAt(bloomT, animTime, dt) {
    lastBloom = bloomT;
    lastAnimTime = animTime;
    const frameBuf = bouquet.render(bloomT, animTime, rotY, tiltX, currentTheme);
    renderer.drawFrame(frameBuf, animTime, reducedMotion);
    particles.updateAndDraw(
      renderer.ctx,
      renderer,
      dt,
      animTime,
      bloomT,
      rotY,
      tiltX,
      reducedMotion,
      currentTheme
    );
  }

  function handleResize() {
    renderer.resize(window.innerWidth, window.innerHeight);
    renderAt(lastBloom, lastAnimTime, 0);
  }

  handleResize();
  window.addEventListener('resize', handleResize);
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    const ro = new ResizeObserver(handleResize);
    ro.observe(canvas.parentElement);
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
      renderAt(lastBloom, lastAnimTime, 0);
    });
  }

  // Interactive drag horizontally (Y-axis spin) & vertically (X-axis tilt), or tap to burst sparkles
  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    dragMoved = false;
    spinVelY = 0;
    spinVelX = 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 6) {
      dragMoved = true;
    }

    const deltaRotY = dx * CONFIG.animation.dragSensitivity;
    const deltaTiltX = dy * CONFIG.animation.dragSensitivity;
    rotY += deltaRotY;
    tiltX = clampTilt(tiltX + deltaTiltX);
    spinVelY = deltaRotY * 42;
    spinVelX = deltaTiltX * 36;
  });

  function endPointer(e) {
    if (!isDragging) return;
    isDragging = false;
    if (!dragMoved && !reducedMotion) {
      const rect = canvas.getBoundingClientRect();
      particles.spawnBurst(e.clientX - rect.left, e.clientY - rect.top, currentTheme, 10);
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', () => {
    isDragging = false;
  });

  const startTime = performance.now();
  let lastTime = startTime;
  let captionShown = false;

  if ((reducedMotion || previewMode) && captionEl) {
    if (previewMode) {
      captionEl.style.transition = 'none';
    }
    captionEl.classList.add('is-visible');
    captionShown = true;
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    const elapsed = (now - startTime) / 1000;

    const bloomT =
      reducedMotion || previewMode
        ? 1
        : Math.min(1, elapsed / CONFIG.animation.bloomDuration);

    if (!captionShown && elapsed >= CONFIG.animation.captionDelay) {
      captionShown = true;
      if (captionEl) captionEl.classList.add('is-visible');
    }

    // Smooth serene turntable rotation + 2-axis inertia after user drag
    if (!reducedMotion && !isDragging && !Number.isFinite(angleParam)) {
      const damp = Math.pow(CONFIG.animation.dragInertia, dt * 60);
      rotY += (CONFIG.animation.rotationSpeed + spinVelY) * dt;
      tiltX = clampTilt(tiltX + spinVelX * dt);
      spinVelY *= damp;
      spinVelX *= damp;
      if (Math.abs(spinVelY) < 0.002) spinVelY = 0;
      if (Math.abs(spinVelX) < 0.002) spinVelX = 0;
    }

    const animTime = reducedMotion ? 0 : elapsed;
    renderAt(bloomT, animTime, dt);

    requestAnimationFrame(frame);
  }

  const initialBloom = reducedMotion || previewMode ? 1 : 0.02;
  renderAt(initialBloom, 0, 0.016);
  requestAnimationFrame(frame);
}

init();
