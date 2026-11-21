# ASCII Flowers

An interactive, blooming, rotating 3D truecolor ASCII flower bouquet webpage built with zero-dependency vanilla HTML, CSS, and ES Modules — hosted via **GitHub Pages**.

## Features
- **True 3D Z-Buffered ASCII Engine**: Projects 7 independent volumetric 3D flowers, curved stems, 360° emerald foliage, a pleated paper cone wrap, and a sculpted ribbon bow onto a real-time `112 × 66` truecolor ASCII grid at 60 FPS.
- **2-Axis Interactive Controls**: Smooth turntable auto-rotation with horizontal & vertical drag-to-orbit inertia; tap or click anywhere to burst twinkling sparkles.
- **Dark & Light Modes**: Defaults to dark slate with a top-right sun/moon toggle and dual calibrated color palettes.
- **Mobile & Desktop Responsive**: Automatically scales HiDPI monospace typography across phones, tablets, and desktops, respecting `prefers-reduced-motion`.

## Preview Locally
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.
