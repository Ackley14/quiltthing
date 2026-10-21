/* Appliqué lettering: text turned into fabric shapes for the block editor.
   opentype.js and the fonts (SIL Open Font License) load on first use as script files, so
   they work offline and when the app is opened straight from disk. */

const TEXT_FONTS = [
  { key: 'firasans', label: 'Fira Sans', group: 'Sans serif' },
  { key: 'firasans-bold', label: 'Fira Sans Bold', group: 'Sans serif' },
  { key: 'firasans-black', label: 'Fira Sans Black', group: 'Sans serif' },
  { key: 'archivo', label: 'Archivo Black', group: 'Sans serif' },
  { key: 'roboto', label: 'Roboto Bold', group: 'Sans serif' },
  { key: 'opensans', label: 'Open Sans Bold', group: 'Sans serif' },
  { key: 'montserrat', label: 'Montserrat Bold', group: 'Sans serif' },
  { key: 'lato', label: 'Lato Bold', group: 'Sans serif' },
  { key: 'poppins', label: 'Poppins Bold', group: 'Sans serif' },
  { key: 'oswald', label: 'Oswald (narrow)', group: 'Sans serif' },
  { key: 'bebas', label: 'Bebas Neue (tall capitals)', group: 'Sans serif' },
  { key: 'lilita', label: 'Lilita One', group: 'Rounded' },
  { key: 'comfortaa', label: 'Comfortaa Bold', group: 'Rounded' },
  { key: 'slab', label: 'Alfa Slab One', group: 'Serif' },
  { key: 'robotoslab', label: 'Roboto Slab Bold', group: 'Serif' },
  { key: 'merriweather', label: 'Merriweather Bold', group: 'Serif' },
  { key: 'playfair', label: 'Playfair Display Bold', group: 'Serif' },
  { key: 'script', label: 'Pacifico', group: 'Script' },
  { key: 'lobster', label: 'Lobster', group: 'Script' },
  { key: 'dancing', label: 'Dancing Script Bold', group: 'Script' },
];
const fontLabel = key => TEXT_FONTS.find(f => f.key === key)?.label || key;
function fontOptions(cur) {
  return uniq(TEXT_FONTS.map(f => f.group)).map(g => `<optgroup label="${g}">${TEXT_FONTS.filter(f => f.group === g).map(f => `<option value="${f.key}" ${f.key === cur ? 'selected' : ''}>${f.label}</option>`).join('')}</optgroup>`).join('');
}
const _fonts = {};
const _scriptLoads = {};
function loadScriptOnce(src) {
  if (!_scriptLoads[src]) {
    _scriptLoads[src] = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => { delete _scriptLoads[src]; el.remove(); reject(new Error(`Couldn't load ${src}`)); };
      document.head.appendChild(el);
    });
  }
  return _scriptLoads[src];
}
async function loadFont(key) {
  if (_fonts[key]) return _fonts[key];
  await loadScriptOnce('vendor/opentype.min.js');
  await loadScriptOnce(`fonts/${key}.font.js`);
  const bin = atob(window.QT_FONT_DATA[key]);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  _fonts[key] = opentype.parse(buf.buffer);
  return _fonts[key];
}
const loadedFont = key => _fonts[key] || null;

// Text → [{ outer, holes }] (y down). Capital letters are capH tall; lines are centred and the
// whole block of text is centred on (0, 0).
function textShapes(font, text, capH) {
  const upm = font.unitsPerEm;
  const cap = font.tables.os2?.sCapHeight || upm * 0.7;
  const size = capH * upm / cap, lineH = capH * 1.5;
  const lines = String(text).split('\n');
  const widths = lines.map(l => font.getAdvanceWidth(l, size, { kerning: true }));
  const maxW = Math.max(0, ...widths);
  let out = [];
  lines.forEach((line, li) => {
    const x0 = (maxW - widths[li]) / 2, base = capH + li * lineH;
    font.forEachGlyph(line, x0, base, size, { kerning: true }, (glyph, x, y, fs) => {
      out.push(...glyphShapes(glyph.getPath(x, y, fs).commands, capH));
    });
  });
  if (!out.length) return [];
  const bb = bounds(out.flatMap(s => s.outer));
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
  const mv = p => p.map(([x, y]) => [x - cx, y - cy]);
  return out.map(s => ({ outer: mv(s.outer), holes: s.holes.map(mv) }));
}

// One glyph's outline commands → filled shapes. Contours wound like the glyph's biggest one add
// fabric, the others cut holes (works for both TrueType and CFF winding conventions).
function glyphShapes(cmds, capH) {
  const rings = [];
  const segLen = capH * 0.05;
  let cur = null;
  const close = () => { if (cur && cur.length > 2) rings.push(cur); cur = null; };
  for (const c of cmds) {
    if (c.type === 'M') { close(); cur = [[c.x, c.y]]; continue; }
    if (!cur) continue;
    const [x0, y0] = cur[cur.length - 1];
    if (c.type === 'L') cur.push([c.x, c.y]);
    else if (c.type === 'Q') {
      const n = clamp(Math.ceil((Math.hypot(c.x1 - x0, c.y1 - y0) + Math.hypot(c.x - c.x1, c.y - c.y1)) / segLen), 2, 12);
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        cur.push([u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y]);
      }
    } else if (c.type === 'C') {
      const n = clamp(Math.ceil((Math.hypot(c.x1 - x0, c.y1 - y0) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2)) / segLen), 2, 16);
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        cur.push([u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y]);
      }
    } else if (c.type === 'Z') close();
  }
  close();
  const clean = rings.map(r => cleanPoly(r)).filter(r => r.length >= 3 && polyArea(r) > capH * capH * 1e-5);
  if (!clean.length) return [];
  const sign = Math.sign(signedArea(clean.reduce((a, b) => polyArea(a) >= polyArea(b) ? a : b)));
  const add = clean.filter(r => Math.sign(signedArea(r)) === sign), sub = clean.filter(r => Math.sign(signedArea(r)) !== sign);
  let mp = pcSafe('union', ...add.map(toPC));
  if (mp && sub.length) mp = pcSafe('difference', mp, ...sub.map(toPC));
  return mp ? fromPC(mp) : add.map(r => ({ outer: r, holes: [] }));
}

// A shape's holes joined to its outline by zero-width slits, so it can live in one block
// region (the clipping library turns the slit back into a proper hole when cutting pieces).
function keyholeRing(outer, holes) {
  let ring = outer.slice();
  const outerSign = Math.sign(signedArea(outer));
  const pending = holes.map(h => Math.sign(signedArea(h)) === outerSign ? h.slice().reverse() : h.slice());
  const crosses = (a, b, rings) => {
    for (const r of rings) for (let k = 0; k < r.length; k++) {
      const p = r[k], q = r[(k + 1) % r.length];
      if (samePoint(p, a) || samePoint(q, a) || samePoint(p, b) || samePoint(q, b)) continue;
      if (segsCross(a, b, p, q)) return true;
    }
    return false;
  };
  while (pending.length) {
    const h = pending.shift();
    const pairs = [];
    for (let i = 0; i < h.length; i++) for (let j = 0; j < ring.length; j++) pairs.push([dist(h[i], ring[j]), i, j]);
    pairs.sort((a, b) => a[0] - b[0]);
    const hit = pairs.slice(0, 60).find(([, i, j]) => !crosses(h[i], ring[j], [ring, h, ...pending]));
    if (!hit) return null;
    const [, i, j] = hit;
    ring = [...ring.slice(0, j + 1), ...h.slice(i), ...h.slice(0, i + 1), ...ring.slice(j)];
  }
  return ring;
}
const samePoint = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
function segsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 && d2 && d3 && d4;
}
// Text → block regions (grid units) centred on `at`. Shapes whose holes can't be joined keep
// their outline only; `lost` counts them.
function textRegions(font, text, capH, at, fab) {
  const regions = [];
  let lost = 0;
  for (const s of textShapes(font, text, capH)) {
    let ring = s.holes.length ? keyholeRing(s.outer, s.holes) : s.outer;
    if (!ring) { ring = s.outer; lost++; }
    regions.push({ pts: ring.map(([x, y]) => [round(x + at[0], 4), round(y + at[1], 4)]), fab, app: true });
  }
  return { regions, lost };
}
