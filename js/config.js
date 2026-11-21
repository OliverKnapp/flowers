/**
 * Central configuration for the rotating 3D ASCII flower bouquet.
 * Defaults to Dark mode (matching the TikTok aesthetic) with a crisp Light mode toggle.
 */
export const CONFIG = {
  caption: typeof atob === 'function' ? atob('Zm9yIENlbGluYQ==') : '',
  defaultTheme: 'dark',

  // Logical ASCII character grid dimensions (columns x rows)
  grid: {
    cols: 112,
    rows: 66,
    cellAspect: 0.6,
  },

  // Material IDs for material-authentic ASCII glyph selection
  materials: {
    NONE: 0,
    STEM: 1,
    LEAF: 2,
    WRAP: 3,
    RIBBON: 4,
    PETAL: 5,
    CENTER: 6,
  },

  // Material-specific ASCII ramps ordered from shadow/feathered -> bright/dense
  ramps: {
    1: ' .:|!iIl*',       // STEM: slender 3D stalks
    2: ' .:-=+*#%0O',     // LEAF: lush green fronds
    3: ' .:-=~-===',      // WRAP: iconic horizontal paper cone folds
    4: ' .:-=+*#%0@',     // RIBBON: satin bow & tails
    5: ' .:-=+*o0O#%@',   // PETAL: 3D shaded petals
    6: ' .:*+o0O@#%',     // CENTER: dense textured pollen dome
  },

  // 3D rotation & bloom timings
  animation: {
    bloomDuration: 2.8,
    captionDelay: 1.75,
    rotationSpeed: 0.26,    // radians / sec (~24s per serene 360° turntable revolution)
    cameraTiltX: 0.24,      // default gentle downward viewing angle
    minTiltX: -1.15,        // allow tilting underneath to view stems/wrap
    maxTiltX: 1.35,         // allow tilting up to look straight into the bouquet crown
    swaySpeed: 1.15,
    swayAmplitude: 0.014,
    shimmerStrength: 0.045,
    dragSensitivity: 0.008,
    dragInertia: 0.93,
  },

  // Dual calibrated RGB [r, g, b] 3D palettes for Dark (default) and Light modes
  themes: {
    dark: {
      themeColor: '#161822',
      stemBase: [46, 178, 82],
      stemLight: [104, 240, 134],
      leafBase: [40, 168, 74],
      leafLight: [118, 248, 140],
      wrapBase: [165, 174, 194],
      wrapLight: [246, 248, 255],
      ribbonBase: [215, 68, 120],
      ribbonLight: [255, 142, 184],
      flowers: {
        pearl:     { petalDark: [165, 174, 198], petalLight: [255, 255, 255], coreDark: [215, 152, 12], coreLight: [255, 240, 110] },
        orchid:    { petalDark: [188, 62, 196],  petalLight: [255, 168, 224], coreDark: [218, 155, 14], coreLight: [255, 242, 115] },
        magenta:   { petalDark: [172, 54, 214],  petalLight: [255, 140, 208], coreDark: [218, 155, 14], coreLight: [255, 240, 110] },
        rose:      { petalDark: [165, 18, 42],   petalLight: [255, 96, 118],  coreDark: [120, 10, 28],  coreLight: [224, 42, 68] },
        sunflower: { petalDark: [214, 144, 6],   petalLight: [255, 236, 92],  coreDark: [148, 76, 14],  coreLight: [232, 146, 36] },
        pink:      { petalDark: [210, 58, 118],  petalLight: [255, 156, 196], coreDark: [216, 150, 14], coreLight: [255, 238, 108] },
        lavender:  { petalDark: [142, 92, 230],  petalLight: [222, 186, 255], coreDark: [218, 156, 16], coreLight: [255, 242, 118] },
      },
      particles: {
        ambientColors: ['#ffffff', '#eef2ff', '#ffe6f0', '#fff5cc', '#d4dcff'],
        burstColors: ['#ff6b9d', '#ff99bd', '#ffe066', '#e08aff', '#ffffff'],
      },
    },
    light: {
      themeColor: '#ffffff',
      stemBase: [24, 106, 52],
      stemLight: [56, 166, 86],
      leafBase: [22, 102, 50],
      leafLight: [72, 182, 92],
      wrapBase: [96, 104, 120],
      wrapLight: [158, 165, 180],
      ribbonBase: [166, 30, 76],
      ribbonLight: [236, 88, 136],
      flowers: {
        pearl:     { petalDark: [96, 104, 124],  petalLight: [158, 166, 184], coreDark: [176, 104, 0],  coreLight: [240, 180, 22] },
        orchid:    { petalDark: [154, 34, 132],  petalLight: [232, 96, 164],  coreDark: [178, 108, 0],  coreLight: [242, 182, 24] },
        magenta:   { petalDark: [130, 32, 164],  petalLight: [218, 72, 154],  coreDark: [178, 108, 0],  coreLight: [242, 182, 24] },
        rose:      { petalDark: [138, 12, 32],   petalLight: [232, 52, 74],   coreDark: [96, 6, 20],    coreLight: [188, 22, 46] },
        sunflower: { petalDark: [186, 108, 0],   petalLight: [242, 184, 24],  coreDark: [112, 52, 4],   coreLight: [188, 104, 14] },
        pink:      { petalDark: [174, 34, 88],   petalLight: [238, 96, 148],  coreDark: [176, 104, 0],  coreLight: [240, 180, 22] },
        lavender:  { petalDark: [108, 56, 188],  petalLight: [176, 120, 232], coreDark: [176, 106, 0],  coreLight: [240, 180, 22] },
      },
      particles: {
        ambientColors: ['#d99b1e', '#e0638c', '#9aa3b8', '#c783b5', '#e38ca6'],
        burstColors: ['#e03e6d', '#eb658f', '#d98f0c', '#b8429e', '#f07ca0'],
      },
    },
  },

  // Strictly universal glyphs to prevent missing-glyph tofu boxes across mobile/desktop fonts
  particles: {
    ambientCount: 34,
    ambientGlyphs: ['·', '•', '°', '*', '+', '.'],
    burstGlyphs: ['*', '·', '°', '+', '•'],
  },

  fontFamily:
    "'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace",
};
