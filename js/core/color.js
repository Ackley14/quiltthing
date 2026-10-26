/* Colour maths: conversions, contrast, quilter-friendly value (light/medium/dark),
   nearest human name, and harmony suggestions. Replaces the old chroma.js dependency. */

function normHex(hex) {
  let h = String(hex || '').trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/.test(h) ? '#' + h : null;
}
function hexToRgb(hex) {
  const h = (normHex(hex) || '#000000').slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const hexToHsl = hex => rgbToHsl(hexToRgb(hex));
const hslToHex = hsl => rgbToHex(hslToRgb(hsl));

function luminance(hex) {
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function hexToLab(hex) {
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = hexToRgb(hex).map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

// Quilters judge "value" (lightness) more than hue — this is what makes a design read.
function valueClass(hex) {
  const L = hexToLab(hex)[0];
  return L < 38 ? 'dark' : L < 68 ? 'medium' : 'light';
}
function valueLetter(hex) { return { dark: 'D', medium: 'M', light: 'L' }[valueClass(hex)]; }

// Text colour that reads on top of a given fill.
function inkOn(hex) { return luminance(hex) > 0.36 ? '#1d2733' : '#ffffff'; }

// Curated names a quilter would actually say. Nearest by perceptual distance.
const COLOR_NAMES = [
  ['White', '#ffffff'], ['Snow', '#f7f5f0'], ['Cream', '#f3ead8'], ['Ivory', '#fbf3df'], ['Linen', '#ebe1cf'],
  ['Oatmeal', '#d9ccb4'], ['Sand', '#cfb994'], ['Tan', '#b89a72'], ['Khaki', '#a89a6a'], ['Camel', '#b0814f'],
  ['Brown', '#6b4630'], ['Chocolate', '#4a2e22'], ['Black', '#141414'], ['Charcoal', '#3a3a3c'], ['Slate', '#5b6670'],
  ['Gray', '#8c8c8c'], ['Silver', '#c4c6c8'], ['Navy', '#1f3a5f'], ['Indigo', '#2e3a78'], ['Royal blue', '#2c55b8'],
  ['Denim', '#4a6f9c'], ['Cornflower', '#7b97d4'], ['Sky blue', '#9ccbe8'], ['Powder blue', '#c8dcec'], ['Teal', '#1f7a7a'],
  ['Turquoise', '#3dbcb8'], ['Aqua', '#8fdad0'], ['Mint', '#bfe6cf'], ['Seafoam', '#9fd2b8'], ['Sage', '#8fa98b'],
  ['Olive', '#76783a'], ['Moss', '#5f7a3f'], ['Forest green', '#2e5a3a'], ['Emerald', '#1f8a5a'], ['Kelly green', '#3aa64a'],
  ['Lime', '#a8cc3a'], ['Chartreuse', '#c8d84a'], ['Lemon', '#f4e25a'], ['Butter', '#f6e6a0'], ['Mustard', '#e0a930'],
  ['Gold', '#d4a72c'], ['Honey', '#d99a3e'], ['Orange', '#e9772a'], ['Tangerine', '#f39a3a'], ['Peach', '#f6c3a0'],
  ['Apricot', '#f1a774'], ['Coral', '#ee7a64'], ['Salmon', '#e98a7a'], ['Terracotta', '#c0603e'], ['Rust', '#b5482f'],
  ['Brick', '#8f3a2c'], ['Red', '#c8312f'], ['Cherry', '#a51f2e'], ['Burgundy', '#6e1f2e'], ['Wine', '#5a1f34'],
  ['Raspberry', '#b4245a'], ['Magenta', '#c2307e'], ['Hot pink', '#e8579a'], ['Pink', '#f19cbb'], ['Blush', '#e9b7a9'],
  ['Rose', '#d98593'], ['Mauve', '#b48a9a'], ['Dusty rose', '#c79a9a'], ['Lavender', '#c3b5e2'], ['Lilac', '#b8a0d0'],
  ['Purple', '#6f3f9c'], ['Plum', '#5e2d5a'], ['Eggplant', '#3e2340'], ['Violet', '#8a5cc2'], ['Periwinkle', '#9aa4e0'],
];
const _labNames = [];
function colorName(hex) {
  const h = normHex(hex);
  if (!h) return 'Color';
  if (!_labNames.length) for (const [n, c] of COLOR_NAMES) _labNames.push([n, hexToLab(c)]);
  const L = hexToLab(h);
  let best = null, bestD = Infinity;
  for (const [n, lab] of _labNames) {
    const d = Math.hypot(L[0] - lab[0], L[1] - lab[1], L[2] - lab[2]);
    if (d < bestD) { bestD = d; best = n; }
  }
  // Far from every named colour: describe by lightness instead of guessing wrong.
  if (bestD > 22) {
    const [hh, s, l] = hexToHsl(h);
    const light = l < 0.3 ? 'Dark' : l > 0.72 ? 'Light' : 'Medium';
    if (s < 0.1) return `${light} gray`;
    return `${light} ${best.toLowerCase()}`;
  }
  return best;
}

// Harmony suggestions relative to a base colour; returns [{label, hex}].
function harmonies(hex) {
  const [h, s, l] = hexToHsl(hex);
  const mk = (dh, ds = 0, dl = 0) => hslToHex([h + dh, clamp(s + ds, 0, 1), clamp(l + dl, 0.04, 0.96)]);
  return [
    { label: 'Complement', hex: mk(180) },
    { label: 'Analogous −30°', hex: mk(-30) },
    { label: 'Analogous +30°', hex: mk(30) },
    { label: 'Triad', hex: mk(120) },
    { label: 'Triad', hex: mk(240) },
    { label: 'Split comp.', hex: mk(150) },
    { label: 'Split comp.', hex: mk(210) },
    { label: 'Tint', hex: mk(0, -0.05, 0.22) },
    { label: 'Shade', hex: mk(0, 0.05, -0.22) },
    { label: 'Muted', hex: mk(0, -0.35, 0.05) },
  ];
}

// Mix toward white/black — used for print accents and UI tints.
function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
}
