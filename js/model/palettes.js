/* Fabric palettes. A palette is an ordered list of fabrics (colour, name, and print if any). It maps
   onto a quilt by position: the 1st colour goes to the quilt background, the rest to the other
   fabrics in order, the same way library blocks pick their fabrics. Your own palettes are kept in
   this browser, so every quilt can use them. */

const PALETTE_KEY = 'quiltthing.v3.palettes';
function myPalettes() {
  try { const l = JSON.parse(localStorage.getItem(PALETTE_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
}
function saveMyPalettes(list) {
  try { localStorage.setItem(PALETTE_KEY, JSON.stringify(list)); return true; } catch { toast("Couldn't save palettes in this browser"); return false; }
}
const allPalettes = () => [...myPalettes(), ...BUILTIN_PALETTES];
const findPalette = id => allPalettes().find(p => p.id === id);

// The quilt's fabrics in palette order: the background first, then the others as listed.
function paletteOrder() {
  const bg = doc.fabrics.find(f => f.id === doc.layout.background);
  return bg ? [bg, ...doc.fabrics.filter(f => f !== bg)] : doc.fabrics.slice();
}
function paletteFromQuilt(name) {
  return { id: uid('pal'), name, colors: paletteOrder().map(f => ({ name: f.name, color: f.color, ...(f.print && f.print.kind !== 'solid' ? { print: { ...f.print } } : {}) })) };
}
// Is this palette what the quilt looks like now?
function paletteInUse(p) {
  const order = paletteOrder();
  return p.colors.length <= order.length && p.colors.every((c, i) => order[i].color === c.color && (order[i].print?.kind || 'solid') === (c.print?.kind || 'solid'));
}

// Recolour the quilt: each fabric takes the palette colour in its position. A longer palette adds
// its remaining colours as new fabrics; a shorter one leaves the quilt's extra fabrics as they are.
function applyPalette(p) {
  const order = paletteOrder();
  p.colors.forEach((c, i) => {
    const look = { name: c.name, color: c.color, print: { kind: 'solid', color2: mix(c.color, '#ffffff', 0.55), scale: 1, ...(c.print || {}) }, directional: c.print?.kind === 'stripes' };
    if (i < order.length) Object.assign(order[i], look);
    else doc.fabrics.push({ ...makeFabric(c.color, c.name, c.print), directional: look.directional });
  });
}

// Swap two fabrics everywhere: every piece in A now looks like B and the other way round. The
// fabrics trade places in the list (their look, buying settings and stash pieces go with them),
// so blocks and the layout don't need to change.
function swapFabrics(a, b) {
  const A = fabricById(a), B = fabricById(b);
  if (!A || !B || A === B) return;
  const keep = { ...A };
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (k !== 'id') { if (k in B) A[k] = B[k]; else delete A[k]; }
  for (const k of Object.keys(keep)) if (k !== 'id') B[k] = keep[k];
  for (const k of Object.keys(B)) if (k !== 'id' && !(k in keep)) delete B[k];
  for (const s of doc.stash) s.fabric = s.fabric === a ? b : s.fabric === b ? a : s.fabric;
}

/* ---------- palette generator ----------
   Hues come from a colour scheme around a base colour; lightness follows the same value roles as
   the built-in palettes, so a generated palette has the usual quilt balance of lights and darks. */
const PALETTE_SCHEMES = [['mono', 'One colour', [0]], ['analog', 'Neighbours', [0, -30, 30]], ['comp', 'Opposites', [0, 180]], ['triad', 'Three-way', [0, 120, 240]], ['split', 'Split', [0, 150, 210]]];
// which scheme hue each role uses, and how strong its colour is (lights stay soft)
const ROLE_HUE = [0, 0, 1, 2, 0, 1, 2, 1, 2, 1];
const ROLE_SAT = { light: [0.25, 0.45], 'light-medium': [0.4, 0.65], medium: [0.45, 0.75], 'medium-dark': [0.35, 0.6], dark: [0.3, 0.55] };
function hexAtLightness(h, s, L) {
  let a = 0, z = 1;
  for (let i = 0; i < 30; i++) { const m = (a + z) / 2; if (hexToLab(hslToHex([h, s, m]))[0] < L) a = m; else z = m; }
  return hslToHex([h, s, (a + z) / 2]);
}
function generatePalette(base, scheme, n, seed) {
  const R = rng(seed), [h0, s0] = hexToHsl(base), hues = (PALETTE_SCHEMES.find(x => x[0] === scheme) || PALETTE_SCHEMES[1])[2];
  const colors = [];
  for (let i = 0; i < n; i++) {
    const [role, lo, hi] = PALETTE_ROLES[i % PALETTE_ROLES.length];
    const h = (h0 + hues[(ROLE_HUE[i % ROLE_HUE.length] + Math.floor(i / PALETTE_ROLES.length)) % hues.length] + (R() - 0.5) * 16 + 360) % 360;
    const [sLo, sHi] = ROLE_SAT[role];
    const s = clamp(sLo + R() * (sHi - sLo), 0, 1) * clamp(s0 * 1.3, 0.15, 1);
    const color = hexAtLightness(h, s, lo + (0.25 + R() * 0.5) * (hi - lo));
    colors.push({ name: colorName(color), color });
  }
  // two fabrics can land on the same colour name; number the repeats
  const seen = {};
  for (const c of colors) { seen[c.name] = (seen[c.name] || 0) + 1; if (seen[c.name] > 1) c.name += ' ' + seen[c.name]; }
  return colors;
}
