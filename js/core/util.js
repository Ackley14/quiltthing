/* Quilt Designer — shared utilities: escaping, numbers, units, formatting.
   Internal measurements are ALWAYS inches; only display/input converts. */

const APP_VERSION = '3.23';
const CM_PER_IN = 2.54;
const EPS = 1e-9;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, p = 3) => { const k = 10 ** p; return Math.round(v * k) / k; };
const sum = (arr, f = x => x) => arr.reduce((s, x) => s + f(x), 0);
const uniq = arr => [...new Set(arr)];

let _uidCounter = 0;
function uid(prefix = 'id') {
  _uidCounter = (_uidCounter + 1) % 1e6;
  return prefix + Date.now().toString(36).slice(-5) + _uidCounter.toString(36) + Math.random().toString(36).slice(2, 5);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Seeded PRNG (mulberry32) so "random" fills are reproducible from a saved seed.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Units & formatting ---------- */

// Display units are a UI preference; model code that formats lengths reads it from here.
let displayUnits = 'in';
function setDisplayUnits(u) { displayUnits = u === 'cm' ? 'cm' : 'in'; }

const EIGHTH_GLYPHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

// Round to 1/8" — 'up' for cut sizes (never short), 'near' for finished sizes.
function toEighths(inches, mode = 'near') {
  const e = inches * 8;
  return mode === 'up' ? Math.ceil(e - 1e-6) : Math.round(e);
}
function ceilEighth(inches) { return toEighths(inches, 'up') / 8; }

function fracIn(inches, mode = 'near') {
  if (!Number.isFinite(inches)) return '0';
  const neg = inches < 0;
  const e = toEighths(Math.abs(inches), mode);
  const whole = Math.floor(e / 8), rem = e % 8;
  const s = rem === 0 ? `${whole}` : whole === 0 ? EIGHTH_GLYPHS[rem] : `${whole}${EIGHTH_GLYPHS[rem]}`;
  return (neg ? '-' : '') + s;
}

// fmtLen(4.5) → 4½"  |  in cm mode → 11.4 cm.  mode 'up' is for cut sizes.
function fmtLen(inches, mode = 'near') {
  if (displayUnits === 'cm') {
    const cm = inches * CM_PER_IN;
    const v = mode === 'up' ? Math.ceil(cm * 10 - 1e-6) / 10 : Math.round(cm * 10) / 10;
    return `${v.toFixed(1).replace(/\.0$/, '')} cm`;
  }
  return `${fracIn(inches, mode)}"`;
}
function fmtSize(w, h, mode = 'near') {
  if (displayUnits === 'cm') return `${fmtLen(w, mode).replace(' cm', '')} × ${fmtLen(h, mode)}`;
  return `${fracIn(w, mode)}" × ${fracIn(h, mode)}"`;
}
// Value for an <input> in current units (plain decimal, no glyphs).
function inputLen(inches) {
  if (displayUnits === 'cm') return String(round(inches * CM_PER_IN, 2));
  return String(round(inches, 4));
}
function unitLabel() { return displayUnits === 'cm' ? 'cm' : 'in'; }

const GLYPH_VALUES = { '⅛': .125, '¼': .25, '⅜': .375, '½': .5, '⅝': .625, '¾': .75, '⅞': .875, '⅓': 1 / 3, '⅔': 2 / 3 };

// Accepts "4", "4.5", "4 1/2", "4½", "1/2", '12"', "12in", "30cm", "30 cm". Returns inches or NaN.
function parseLen(str, fallbackUnits = displayUnits) {
  if (typeof str === 'number') return fallbackUnits === 'cm' ? str / CM_PER_IN : str;
  let s = String(str ?? '').trim().toLowerCase();
  if (!s) return NaN;
  let units = fallbackUnits;
  if (/cm$/.test(s)) { units = 'cm'; s = s.replace(/cm$/, ''); }
  else if (/mm$/.test(s)) { units = 'mm'; s = s.replace(/mm$/, ''); }
  else if (/("|in|inch|inches)$/.test(s)) { units = 'in'; s = s.replace(/("|in|inch|inches)$/, ''); }
  s = s.trim();
  let v = 0;
  const glyph = Object.keys(GLYPH_VALUES).find(g => s.endsWith(g));
  if (glyph) { v += GLYPH_VALUES[glyph]; s = s.slice(0, -glyph.length).trim(); if (!s) s = '0'; }
  const mixed = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (mixed) v += +mixed[1] + (+mixed[2] / +mixed[3]);
  else if (frac) v += +frac[1] / +frac[2];
  else if (/^\d*\.?\d+$/.test(s)) v += parseFloat(s);
  else return NaN;
  if (units === 'cm') return v / CM_PER_IN;
  if (units === 'mm') return v / 10 / CM_PER_IN;
  return v;
}

// Yardage: fabric is sold in 1/8-yard steps (imperial) — metric shows metres to 0.05 m.
function fmtYards(inches) {
  if (displayUnits === 'cm') {
    const m = Math.ceil((inches * CM_PER_IN / 100) * 20 - 1e-6) / 20;
    return `${m.toFixed(2)} m`;
  }
  return `${fracIn(inches / 36, 'up')} yd`;
}
function plural(n, word, pluralWord) { return `${n} ${n === 1 ? word : (pluralWord || word + 's')}`; }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function letterFor(i) { return i < 26 ? LETTERS[i] : LETTERS[Math.floor(i / 26) - 1] + LETTERS[i % 26]; }

/* ---------- DOM helpers (no-ops outside a browser so model code can be unit-tested in node) ---------- */
const hasDOM = typeof document !== 'undefined';
const $ = (sel, root) => hasDOM ? (root || document).querySelector(sel) : null;
const $$ = (sel, root) => hasDOM ? [...(root || document).querySelectorAll(sel)] : [];

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function slugify(s) { return String(s || 'quilt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quilt'; }
// Compact length for tight diagram labels: 3½ (inches) or 8.9 (cm), no unit suffix.
function shortLen(inches, mode = 'near') { return fmtLen(inches, mode).replace(/"| cm$/g, ''); }
