/* Shared SVG diagrams for the Cutting view and the printed pattern:
   the true-scale cutting map, cut icons, "used for" thumbnails, and unit how-to sketches. */

/* ---------- cutting map ---------- */
// opts: { width: number, unit: 'px'|'in', idp }
function fabricSheetSvg(sheet, fab, opts = {}) {
  const W = sheet.W, need = sheet.H, H = Math.max(need, sheet.buyIn || 0, 1);
  const fs = W * 0.026;
  const ML = W * 0.07, MR = W * 0.11, MT = W * 0.06, MB = W * 0.02;
  const col = fabricHex(fab), ink = inkOn(col), tint = mix(col, '#ffffff', 0.84);
  const idp = (opts.idp || 'sh') + '-' + fab;
  const hair = W * 0.0025;
  const vbW = W + ML + MR, vbH = H + MT + MB;
  const scale = (opts.width || 520) / vbW;
  const u = opts.unit || 'px';
  let s = `<svg class="sheet" viewBox="${-ML} ${-MT} ${round(vbW, 3)} ${round(vbH, 3)}" width="${round(vbW * scale, 2)}${u === 'in' ? 'in' : ''}" height="${round(vbH * scale, 2)}${u === 'in' ? 'in' : ''}" font-family="system-ui, sans-serif">`;
  s += `<defs><pattern id="${idp}-scrap" width="${W * .02}" height="${W * .02}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${W * .02}" height="${W * .02}" fill="${tint}"/><line y2="${W * .02}" stroke="#fff" stroke-width="${W * .006}"/></pattern></defs>`;
  // the fabric itself (scrap shows as hatched), and the extra length to buy
  s += `<rect x="0" y="0" width="${W}" height="${need}" fill="url(#${idp}-scrap)" stroke="#9aa3ad" stroke-width="${hair}"/>`;
  if (H > need + 0.01) {
    s += `<rect x="0" y="${need}" width="${W}" height="${round(H - need, 3)}" fill="none" stroke="#9aa3ad" stroke-width="${hair}" stroke-dasharray="${hair * 6} ${hair * 4}"/>`;
    if (H - need > fs * 1.4) s += `<text x="${W / 2}" y="${need + (H - need) / 2}" font-size="${fs * .9}" text-anchor="middle" dominant-baseline="central" fill="#6b7785">extra to buy (shrinkage, mistakes, rounding)</text>`;
  }
  s += `<text x="${W / 2}" y="${-MT * .45}" font-size="${fs}" text-anchor="middle" fill="#4f5d6b">${esc(opts.title || `← ${fmtLen(W)} width of fabric (selvage to selvage) →`)}</text>`;
  // length ruler on the right: every ¼ yd (or 10 cm)
  const tick = displayUnits === 'cm' ? 10 / CM_PER_IN : 9;
  for (let t = 0, k = 0; t <= H + 1e-6; t += tick, k++) {
    const major = displayUnits === 'cm' ? k % 10 === 0 : k % 4 === 0;
    s += `<line x1="${W}" y1="${round(t, 3)}" x2="${W + (major ? MR * .35 : MR * .18)}" y2="${round(t, 3)}" stroke="#8a94a0" stroke-width="${hair}"/>`;
    if (major && t > 0) s += `<text x="${W + MR * .4}" y="${round(t, 3)}" font-size="${fs * .85}" dominant-baseline="central" fill="#4f5d6b">${displayUnits === 'cm' ? `${Math.round(t * CM_PER_IN / 100)} m` : `${Math.round(t / 36)} yd`}</text>`;
  }
  const badge = (x, y, n, r) => `<g class="sb" data-step="${n}"><circle cx="${round(x, 3)}" cy="${round(y, 3)}" r="${round(r, 3)}" fill="#fff" stroke="#1f3a5f" stroke-width="${hair}"/><text x="${round(x, 3)}" y="${round(y, 3)}" font-size="${round(r * 1.25, 3)}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#1f3a5f">${n}</text></g>`;
  // light fabrics get a dark outline so cuts stay visible against the pale scrap hatching
  const edge = luminance(col) > 0.55 ? '#7a8590' : '#fff';
  const poly = (pts, step, extra = '') => `<path data-step="${step}" d="${polyToPath(pts)}" fill="${fabricFill(fab)}" stroke="${edge}" stroke-width="${hair * 1.4}"${extra}/>`;
  let lastStep = null;
  for (const b of sheet.bands) {
    const { y, h } = b;
    if (b.step !== lastStep) { s += badge(-ML / 2, y + Math.min(h, W * .08) / 2, b.step, Math.min(ML * .36, fs * .95)); lastStep = b.step; }
    s += `<line x1="0" y1="${round(y + h, 3)}" x2="${W}" y2="${round(y + h, 3)}" stroke="#6b7785" stroke-width="${hair}" stroke-dasharray="${hair * 4} ${hair * 3}"/>`;
    if (b.kind === 'strip') {
      for (const c of b.cuts) {
        s += poly(rectPts(c.x, y, c.w, h), b.step);
        const cut = c.recipe.cut;
        const ln = (x1, y1, x2, y2) => `<line x1="${round(x1, 3)}" y1="${round(y1, 3)}" x2="${round(x2, 3)}" y2="${round(y2, 3)}" stroke="${ink}" stroke-opacity=".75" stroke-width="${hair * 1.2}" stroke-dasharray="${hair * 5} ${hair * 3}" pointer-events="none"/>`;
        if (cut === 'diag' || cut === 'diagR' || cut === 'cross' || cut === 'stitch') s += ln(c.x, y, c.x + c.w, y + h);
        if (cut === 'diagL' || cut === 'cross') s += ln(c.x + c.w, y, c.x, y + h);
        if (Math.min(c.w, h) > fs * 2.4) s += `<text x="${round(c.x + c.w / 2, 3)}" y="${round(y + h / 2, 3)}" font-size="${fs * .85}" text-anchor="middle" dominant-baseline="central" fill="${ink}" pointer-events="none">${esc(shortLen(c.w, 'up'))}${Math.abs(c.w - h) > 1e-3 ? `×${esc(shortLen(h, 'up'))}` : ''}</text>`;
      }
    } else if (b.kind === 'angled') {
      const r = b.recipe, lean = (r.hand === 'L' ? -1 : 1) * h / Math.tan(r.angle * Math.PI / 180), x0 = Math.max(0, lean);
      for (let i = 0; i < b.n; i++) { const xa = x0 + i * r.step; s += poly([[xa, y], [xa + r.step, y], [xa + r.step - lean, y + h], [xa - lean, y + h]], b.step); }
    } else if (b.kind === 'trap') {
      // the real outline of each piece, centred across the strip
      const off = (h - b.recipe.shape.h) / 2;
      for (const p of trapPieces(b.recipe, b.n)) s += poly(p.map(([x, py]) => [x, y + off + py]), b.step);
    } else if (b.kind === 'tri60') {
      const Bw = h * 2 / Math.sqrt(3);
      for (let i = 0; i < b.n; i++) {
        const x = Math.floor(i / 2) * Bw + (i % 2 ? Bw / 2 : 0);
        s += poly(i % 2 ? [[x, y], [x + Bw, y], [x + Bw / 2, y + h]] : [[x, y + h], [x + Bw / 2, y], [x + Bw, y + h]], b.step);
      }
    } else if (b.kind === 'joined') {
      // the last strip is cut short when other pieces use the rest of it
      const len = b.used ?? W;
      s += poly(rectPts(0, y, len, h), b.step);
      if (h > fs * 1.2) s += `<text x="${round(len / 2, 3)}" y="${round(y + h / 2, 3)}" font-size="${fs * .85}" text-anchor="middle" dominant-baseline="central" fill="${ink}" pointer-events="none">${esc(b.label.toLowerCase())} strip</text>`;
    }
  }
  // shorter strips cut from leftovers, with their step number at the start; step numbers in
  // leftovers are drawn last, so later cuts don't cover them
  let marks = '';
  for (const ps of sheet.partials || []) {
    s += `<rect x="${round(ps.x, 3)}" y="${round(ps.y, 3)}" width="${round(ps.w, 3)}" height="${round(ps.h, 3)}" fill="none" stroke="#6b7785" stroke-width="${hair}" stroke-dasharray="${hair * 4} ${hair * 3}"/>`;
    for (const c of ps.cuts) {
      s += poly(rectPts(c.x, ps.y, c.w, ps.h), ps.step);
      if (Math.min(c.w, ps.h) > fs * 2.4) s += `<text x="${round(c.x + c.w / 2, 3)}" y="${round(ps.y + ps.h / 2, 3)}" font-size="${fs * .85}" text-anchor="middle" dominant-baseline="central" fill="${ink}" pointer-events="none">${esc(shortLen(c.w, 'up'))}${Math.abs(c.w - ps.h) > 1e-3 ? `×${esc(shortLen(ps.h, 'up'))}` : ''}</text>`;
    }
    marks += badge(ps.x + fs * 0.9, ps.y + Math.min(ps.h / 2, fs * 0.9), ps.step, fs * 0.7);
  }
  if (sheet.tpl) {
    const t = sheet.tpl;
    if (sheet.H > t.y + 1e-6) s += badge(-ML / 2, t.y + fs, t.placed.find(p => p.y >= t.y - 1e-6)?.step || t.placed[0]?.step || '', Math.min(ML * .36, fs * .95));
    // pieces placed in a leftover get their step number beside the first one, drawn on top
    const marked = new Map();
    for (const p of t.placed) {
      if (p.from) {
        if (!marked.has(p.from)) marked.set(p.from, new Set());
        if (!marked.get(p.from).has(p.step)) { marked.get(p.from).add(p.step); marks += badge(p.x + fs * 0.8, p.y + fs * 0.8, p.step, fs * 0.7); }
      }
      let o;
      if (p.poly) o = p.poly;
      else {
        o = p.item.r.recipe.cutBox.outline;
        if (p.rot) o = translatePoly(rotatePoly(o, Math.PI / 2), p.item.r.recipe.cutBox.h, 0);
        o = translatePoly(o, p.x, p.y);
      }
      s += poly(t.abs ? o : translatePoly(o, 0, t.y), p.step);
    }
  }
  return s + marks + '</svg>';
}

/* ---------- what a cut looks like (small icon) ---------- */
function cutIconSvg(recipe, fab, px = 34) {
  const col = fabricFill(fab), ink = inkOn(fabricHex(fab));
  const box = (w, h) => {
    const k = 28 / Math.max(w, h), W = w * k, H = h * k, x = (32 - W) / 2, y = (32 - H) / 2;
    return { x, y, W, H, r: `<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${col}" stroke="#2b3a4a" stroke-width="1"/>` };
  };
  let inner = '';
  const dl = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="1.2" stroke-dasharray="2.5 1.5"/>`;
  if (recipe.method === 'strip') {
    const b = box(recipe.sub, recipe.w);
    inner = b.r;
    if (['diag', 'diagR', 'cross', 'stitch'].includes(recipe.cut)) inner += dl(b.x, b.y, b.x + b.W, b.y + b.H);
    if (recipe.cut === 'diagL' || recipe.cut === 'cross') inner += dl(b.x + b.W, b.y, b.x, b.y + b.H);
  } else if (recipe.method === 'angled') {
    inner = `<path d="M10,6H30L22,26H2Z" fill="${col}" stroke="#2b3a4a"/>`;
  } else if (recipe.method === 'trap' && recipe.shape) {
    const { t0, t1, b0, b1, h } = recipe.shape, W = Math.max(t1, b1), k = 28 / Math.max(W, h);
    inner = `<path d="${polyToPath(translatePoly(scalePts([[t0, 0], [t1, 0], [b1, h], [b0, h]], k), (32 - W * k) / 2, (32 - h * k) / 2))}" fill="${col}" stroke="#2b3a4a"/>`;
  } else if (recipe.method === 'trap') {
    inner = `<path d="M9,8H23L30,24H2Z" fill="${col}" stroke="#2b3a4a"/>`;
  } else if (recipe.method === 'tri60') {
    inner = `<path d="M16,4L30,28H2Z" fill="${col}" stroke="#2b3a4a"/>`;
  } else if (recipe.outline) {
    const bb = bounds(recipe.outline), k = 28 / Math.max(bb.w, bb.h);
    inner = `<path d="${polyToPath(translatePoly(scalePts(recipe.outline, k), (32 - bb.w * k) / 2, (32 - bb.h * k) / 2))}" fill="${col}" stroke="#2b3a4a"/>`;
  } else {
    inner = `<rect x="2" y="12" width="28" height="8" fill="${col}" stroke="#2b3a4a"/>`;
  }
  return `<svg class="cut-icon" viewBox="0 0 32 32" width="${px}" height="${px}">${inner}</svg>`;
}
const scalePts = (p, k) => p.map(([x, y]) => [x * k, y * k]);

/* ---------- where a cut is used: block with those pieces highlighted ---------- */
function usageThumbSvg(use, px = 54, unit = 'px') {
  if (!use.b) return `<span class="pill">${esc(use.kind)}</span>`;
  const block = doc.blocks[use.b];
  if (!block) return '';
  const S = 12;
  const pieces = blockPieces(block, S, S);
  let over = '';
  pieces.forEach((p, i) => {
    if (use.idx.has(i)) over += `<path d="${polyToPath(p.pts)}" fill="none" stroke="#f2b134" stroke-width="0.55" stroke-linejoin="round"/>`;
    else over += `<path d="${polyToPath(p.pts)}${p.holes.map(h => polyToPath(h)).join('')}" fill="#fff" fill-opacity=".72" fill-rule="evenodd"/>`;
  });
  const sz = unit === 'in' ? `${px}in` : px;
  return `<svg class="use-thumb" viewBox="-0.4 -0.4 12.8 12.8" width="${sz}" height="${sz}"><title>${esc(block.name)}</title>${blockSvg(block, S, S)}${over}</svg>`;
}

/* ---------- how to make a unit (pattern illustrations) ---------- */
// Stage-by-stage method sketches, drawn in inches at true proportions and at the unfinished size
// (finished + 2·sa): raw edges, dog ears, points sa in from the edge, then the trimmed unit.
// Lines mean the same in every sketch: red dashes = sewing line, thin solid ink = drawn or cut
// line, grey dashes = finished size (sa in from the raw edge). Pieces lying wrong side up (placed
// right sides together) are drawn see-through. Each panel is labelled with the sub-step letter(s)
// of `unitMethodText` it shows, with a 2–6-word caption; more than 3 panels wrap to two rows.
//
// unitHowToSvg(type, info), info = {
//   sample:  the analysed unit: an item of analyzeBlock(block, BS).units ({ rect, pieces, unit }),
//            i.e. list[0] in blockStepsHtml. Sizes, fabrics and layout all come from it.
//   sa:      seam allowance in inches.
//   method:  'flip' = stitch-and-flip geese (one rectangle + two squares); otherwise no-waste.
//   labels:  optional array of panel labels replacing the default sub-step letters.
//   legend:  false leaves out the line legend (print it once, under the first sketch on a page).
//   widthIn: overall width in inches (default 4.5, the step text column).
// }
// The old form unitHowToSvg(type, a, b[, widthIn]) still works: a, b are fabrics (light and dark;
// goose and sky; main and corner) drawn on a sample unit of a typical size.
const HOWTO_INK = '#2b3a4a', HOWTO_RED = '#b5482f', HOWTO_GREY = '#8a95a3', HOWTO_RULER = '#3d7bb5';
const HOWTO_LABELS = {
  hst: ['a–c', 'd', 'e'], goose: ['a–c', 'd', 'e', 'f', 'g'], gooseFlip: ['a–b', 'c', 'd', 'e'],
  qst: ['a–c', 'd', 'e', 'e'], qst3: ['a', 'b', 'c–d'], snowball: ['a–c', 'd', 'e'], hrt: ['a', 'b', 'c', 'd'], curved: ['a', 'b–c', 'd–e'],
};

function unitHowToSvg(type, a, b, widthIn) {
  const info = a && typeof a === 'object' && a.sample ? a : { sample: howtoDemoSample(type, a, b), sa: 0.25, widthIn };
  if (!info.sample) return '';
  const g = howtoGeom(info);
  let panels, key = type;
  switch (type) {
    case 'hst': panels = howtoHst(g); break;
    case 'qst': if (g.fabs.length === 2 && info.sample.unit?.hourglass !== false) panels = howtoQst2(g); else { panels = howtoQst3(g); key = 'qst3'; } break;
    case 'goose': if (info.method === 'flip') { panels = howtoGooseFlip(g); key = 'gooseFlip'; } else panels = howtoGoose(g); break;
    case 'snowball': panels = howtoSnowball(g); break;
    case 'hrt': panels = howtoHrt(g); break;
    case 'curved': panels = howtoCurved(g); break;
    default: return '';
  }
  if (!panels?.length) return '';
  panels.forEach((p, i) => { p.label = (info.labels || HOWTO_LABELS[key])[i] ?? ''; });
  return howtoLayout(panels, info.widthIn || 4.5, info.legend !== false, g.sa);
}

// Everything the stage builders need, in inches, with the unit's top-left raw corner at (0, 0).
function howtoGeom(info) {
  const s = info.sample, r = s.rect, sa = info.sa ?? 0.25, u = s.unit;
  const lum = f => luminance(fabricHex(f));
  const fabs = uniq((u.fabs || []).map(resolveFab)).sort((p, q) => lum(q) - lum(p));
  const pieces = (s.pieces || []).map(p => ({ pts: p.pts.map(([x, y]) => [x - r.x + sa, y - r.y + sa]), fab: resolveFab(p.fab), curved: !!p.curved, src: p }));
  return {
    sa, D: sa * Math.SQRT2, W: r.w, H: r.h, UW: r.w + 2 * sa, UH: r.h + 2 * sa, S: fmtLen(sa), unit: u, rect: r,
    fabs, lt: fabs[0], dk: fabs[fabs.length - 1], lum, pieces,
  };
}

// A stand-in unit for the old call form (no analysed unit available).
function howtoDemoSample(type, a, b) {
  const P = (pts, fab, cls = {}) => ({ pts, fab, cls, curved: false });
  const sq = n => ({ x: 0, y: 0, w: n, h: n });
  switch (type) {
    case 'hst': return { rect: sq(4), pieces: [P([[0, 0], [4, 4], [0, 4]], a), P([[0, 0], [4, 0], [4, 4]], b)], unit: { type, fabs: [a, b] } };
    case 'qst': return { rect: sq(4), pieces: [P([[0, 0], [4, 0], [2, 2]], b), P([[4, 0], [4, 4], [2, 2]], a), P([[4, 4], [0, 4], [2, 2]], b), P([[0, 4], [0, 0], [2, 2]], a)], unit: { type, fabs: [a, b] } };
    case 'goose': return { rect: { x: 0, y: 0, w: 6, h: 3 }, pieces: [P([[0, 3], [6, 3], [3, 0]], a), P([[0, 0], [3, 0], [0, 3]], b), P([[3, 0], [6, 0], [6, 3]], b)], unit: { type, goose: a, sky: b, fabs: [a, b] } };
    case 'snowball': {
      const c = P([[0, 0], [2, 0], [0, 2]], b, { leg: 2 }), m = P([[2, 0], [6, 0], [6, 6], [0, 6], [0, 2]], a);
      return { rect: sq(6), pieces: [m, c], unit: { type, main: m, corners: [c], fabs: [a, b] } };
    }
    case 'hrt': return { rect: { x: 0, y: 0, w: 2, h: 4 }, pieces: [P([[0, 0], [2, 0], [0, 4]], a), P([[2, 0], [2, 4], [0, 4]], b)], unit: { type, fabs: [a, b] } };
    case 'curved': {
      const R = 4, arc = [...Array(13)].map((_, i) => { const t = i / 12 * Math.PI / 2; return [R * Math.cos(t), R * Math.sin(t)]; });
      const pie = { pts: [[0, 0], ...arc], fab: b, curved: true }, L = { pts: [[R, 0], [6, 0], [6, 6], [0, 6], ...arc.slice().reverse().slice(0, -1)], fab: a, curved: true };
      return { rect: sq(6), pieces: [pie, L], unit: { type, fabs: [a, b], order: [pie, L] } };
    }
  }
  return null;
}

/* geometry helpers (inches) */
// drop repeated and collinear points
function howtoCorners(pts) {
  const out = [];
  pts.forEach((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    if (Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9) out.push(p);
  });
  return out;
}
// a convex piece grown by d on every side with sharp corners: the cut shape of a straight-edged piece
function howtoGrow(pts, d) {
  const q = howtoCorners(pts), c = centroid(q), n = q.length;
  const L = q.map((a, i) => {
    const b = q[(i + 1) % n], l = dist(a, b);
    let nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
    if ((a[0] - c[0]) * nx + (a[1] - c[1]) * ny < 0) { nx = -nx; ny = -ny; }
    return { p: [a[0] + nx * d, a[1] + ny * d], v: [b[0] - a[0], b[1] - a[1]] };
  });
  return L.map((B, i) => {
    const A = L[(i - 1 + n) % n], det = A.v[0] * B.v[1] - A.v[1] * B.v[0];
    const t = ((B.p[0] - A.p[0]) * B.v[1] - (B.p[1] - A.p[1]) * B.v[0]) / det;
    return [A.p[0] + t * A.v[0], A.p[1] + t * A.v[1]];
  });
}
// clip a convex polygon to one side of the line a→b: the side holding `ref` (keep) or the other
function howtoClip(poly, a, b, ref, keep = true) {
  const f = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const sg = (f(ref) >= 0) === keep ? 1 : -1, out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length], sp = f(P) * sg, sq = f(Q) * sg;
    if (sp >= 0) out.push(P);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
  }
  return out.length >= 3 && polyArea(out) > 1e-7 ? out : [];
}
// the parts of a convex polygon lying outside a convex container
function howtoOutside(poly, box) {
  const out = [], c = centroid(box);
  let rest = poly;
  for (let i = 0; i < box.length && rest.length; i++) {
    const a = box[i], b = box[(i + 1) % box.length];
    const part = howtoClip(rest, a, b, c, false);
    if (part.length) out.push(part);
    rest = howtoClip(rest, a, b, c, true);
  }
  return out;
}
const howtoRect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// Dog ears: the seam allowance of `piece` (finished shape) beyond its seam a–b that sticks out of
// `box` (the unfinished unit). Pressed the other way, this allowance stays put under the other piece.
function howtoEars(piece, a, b, box, d) {
  const allow = howtoClip(howtoGrow(piece, d), a, b, centroid(piece), false);
  return allow.length ? howtoOutside(allow, box) : [];
}
// is the edge a–b on the finished outline (rather than a seam)?
function howtoOnEdge(g) {
  const e = 1e-3 * Math.max(g.W, g.H), on = (u, v) => Math.abs(u - v) < e, X = [g.sa, g.sa + g.W], Y = [g.sa, g.sa + g.H];
  return (a, b) => X.some(x => on(a[0], x) && on(b[0], x)) || Y.some(y => on(a[1], y) && on(b[1], y));
}
// The visible part of each straight-edged piece in the sewn unit: the unfinished rectangle cut by
// the piece's seams (edges not on the finished outline), extended to the raw edges.
function howtoFaces(g, list = g.pieces) {
  const edge = howtoOnEdge(g);
  return list.map(p => {
    let f = howtoRect(0, 0, g.UW, g.UH);
    const q = howtoCorners(p.pts), c = centroid(q);
    q.forEach((a, i) => { const b = q[(i + 1) % q.length]; if (!edge(a, b) && f.length) f = howtoClip(f, a, b, c); });
    return { pts: f, fab: p.fab };
  });
}
// convex hull (monotone chain), collinear points dropped
function howtoHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => { const h = []; for (const q of list) { while (h.length > 1 && cr(h[h.length - 2], h[h.length - 1], q) <= 1e-12) h.pop(); h.push(q); } h.pop(); return h; };
  return [...half(p), ...half(p.slice().reverse())];
}
// A convex sewn part of convex straight-edged pieces (lists of points) at cut size: the part grown
// by d with sharp corners, each piece filling it up to its own seams, which carry straight on to
// the raw edge. → { cut, hull, faces } or null when the part or a piece isn't convex.
function howtoConvexCut(pieces, d) {
  const hull = howtoHull(pieces.flat()), A = polyArea(hull), tol = 1e-3 * A;
  if (hull.length < 3 || Math.abs(A - sum(pieces, polyArea)) > tol) return null;
  const e = 1e-4 * Math.sqrt(A), off = (p, a, b) => Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / dist(a, b);
  const onHull = (a, b) => hull.some((h, i) => { const k = hull[(i + 1) % hull.length]; return off(a, h, k) < e && off(b, h, k) < e; });
  const cut = howtoGrow(hull, d), faces = [];
  for (const pts of pieces) {
    const q = howtoCorners(pts);
    if (Math.abs(polyArea(howtoHull(q)) - polyArea(q)) > tol) return null;
    const c = centroid(q);
    let f = cut;
    q.forEach((a, i) => { const b = q[(i + 1) % q.length]; if (!onHull(a, b) && f.length) f = howtoClip(f, a, b, c); });
    if (!f.length) return null;
    faces.push(f);
  }
  return { cut, hull, faces };
}
// A piece (any shape, curved too) as it shows in the sewn unit: edges on the finished outline move
// out to the raw edge, and where a seam meets the finished outline it carries straight on (along
// its end direction) to the raw edge, so a point stays sa in from the edge.
function howtoExtend(g, pts) {
  const { sa, W, H, UW, UH } = g, e = 1e-3 * Math.max(W, H), on = (u, v) => Math.abs(u - v) < e, edge = howtoOnEdge(g);
  const onFin = p => on(p[0], sa) || on(p[0], sa + W) || on(p[1], sa) || on(p[1], sa + H);
  const push = ([x, y]) => [on(x, sa) ? 0 : on(x, sa + W) ? UW : x, on(y, sa) ? 0 : on(y, sa + H) ? UH : y];
  // from v, carrying on away from `from`, to the first raw edge
  const ray = (v, from) => {
    const d = [v[0] - from[0], v[1] - from[1]];
    let best = null;
    for (const [axis, val] of [[0, 0], [0, UW], [1, 0], [1, UH]]) {
      if (Math.abs(d[axis]) < 1e-12) continue;
      const t = (val - v[axis]) / d[axis], q = [v[0] + d[0] * t, v[1] + d[1] * t];
      if (t > 1e-9 && q[0] > -1e-6 && q[0] < UW + 1e-6 && q[1] > -1e-6 && q[1] < UH + 1e-6 && (!best || t < best.t)) best = { t, q, axis, val };
    }
    return best;
  };
  const rawLine = (a, b) => (on(a[0], b[0]) ? { axis: 0, val: on(a[0], sa) ? 0 : UW } : { axis: 1, val: on(a[1], sa) ? 0 : UH });
  const corner = (h, L) => (h.axis === L.axis ? null : h.axis === 0 ? [h.val, L.val] : [L.val, h.val]);
  const out = [], n = pts.length;
  pts.forEach((v, i) => {
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
    if (!onFin(v)) { out.push(v); return; }
    const inB = edge(prev, v), outB = edge(v, next);
    if (inB === outB) { out.push(inB ? push(v) : v); return; }
    if (!inB) {   // a seam arrives here and the outline leaves along the edge
      const h = ray(v, prev); out.push(v);
      if (h) { out.push(h.q); const c = corner(h, rawLine(v, next)); if (c) out.push(c); }
    } else {      // the outline arrives along the edge and a seam leaves
      const h = ray(v, next);
      if (h) { const c = corner(h, rawLine(prev, v)); if (c) out.push(c); out.push(h.q); }
      out.push(v);
    }
  });
  return out;
}
// a piece's seam lines (its edges that aren't on the finished outline), as open polylines
function howtoSeamPaths(g, pts) {
  const edge = howtoOnEdge(g), inner = (a, b) => !edge(a, b);
  const n = pts.length, paths = [];
  const start = pts.findIndex((a, i) => !inner(pts[(i - 1 + n) % n], a) && inner(a, pts[(i + 1) % n]));
  if (start < 0) return pts.every((a, i) => inner(a, pts[(i + 1) % n])) ? [[...pts, pts[0]]] : [];
  for (let k = 0, cur = null; k < n; k++) {
    const i = (start + k) % n, a = pts[i], b = pts[(i + 1) % n];
    if (inner(a, b)) { if (!cur) { cur = [a]; paths.push(cur); } cur.push(b); } else cur = null;
  }
  return paths;
}
function howtoAlong(path, t) {   // point and unit direction at fraction t of a polyline's length
  const segs = path.slice(1).map((b, i) => dist(path[i], b)), total = sum(segs, x => x);
  let need = total * t;
  for (let i = 0; i < segs.length; i++) {
    if (need <= segs[i] || i === segs.length - 1) {
      const a = path[i], b = path[i + 1], k = segs[i] ? Math.min(1, need / segs[i]) : 0;
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], dir: [(b[0] - a[0]) / (segs[i] || 1), (b[1] - a[1]) / (segs[i] || 1)] };
    }
    need -= segs[i];
  }
  return { p: path[0], dir: [1, 0] };
}

/* drawing: a pen in inches. k = print px per inch (0 = measuring pass: collect points only) */
function howtoPen(k, hatch) {
  const pts = [];
  let s = '';
  const w = px => (k ? round(px / k, 4) : 0), f = v => round(v, 3);
  const P = p => { pts.push(p); return `${f(p[0])},${f(p[1])}`; };
  const stroke = (col, px, dash) => `stroke="${col}" stroke-width="${w(px)}"${dash ? ` stroke-dasharray="${dash.map(w).join(' ')}"` : ''}`;
  const pen = {
    pts, k, w, get svg() { return s; },
    // fabric: o.wrong = wrong side up (see-through); o.ghost = cut away; o.shade = two layers overlapping; o.edge = outline only
    poly(ps, fill, o = {}) {
      if (!ps || ps.length < 3) return;
      if (o.shade || o.edge) { s += `<path d="M${ps.map(P).join('L')}Z" fill="${o.shade ? HOWTO_INK : 'none'}"${o.shade ? ' fill-opacity=".28"' : ''} ${stroke(HOWTO_INK, 0.55)} stroke-linejoin="round"/>`; return; }
      s += o.ghost
        ? `<path d="M${ps.map(P).join('L')}Z" fill="#ffffff" fill-opacity=".72" ${stroke(HOWTO_INK, 0.6, [1.6, 1.2])}/>`
        : o.wrong && hatch   // wrong side up: paler, with a faint hatch
          ? `<g><path d="M${ps.map(P).join('L')}Z" fill="${fabricFill(fill)}"/><path d="M${ps.map(P).join('L')}Z" fill="#ffffff" fill-opacity=".25"/><path d="M${ps.map(P).join('L')}Z" fill="url(#${hatch}-${luminance(fabricHex(fill)) > 0.5 ? 'd' : 'l'})" ${stroke(HOWTO_INK, 0.55)} stroke-linejoin="round"/></g>`
          : `<path d="M${ps.map(P).join('L')}Z" fill="${fabricFill(fill)}" ${stroke(HOWTO_INK, 0.55)} stroke-linejoin="round"/>`;
    },
    path(ps, kind) { if (ps.length > 1) s += `<path d="M${ps.map(P).join('L')}" fill="none" ${pen.style(kind)} stroke-linejoin="round"/>`; },
    line(a, b, kind = 'cut') { pen.path([a, b], kind); },
    style: kind => kind === 'sew' ? stroke(HOWTO_RED, 1, [2.6, 1.6]) : kind === 'ruler' ? stroke(HOWTO_RULER, 0.7) : stroke(HOWTO_INK, 0.8),
    fin(g) { const r = howtoRect(g.sa, g.sa, g.W, g.H); s += `<path d="M${r.map(P).join('L')}Z" fill="none" ${stroke(HOWTO_GREY, 0.75, [2, 1.5])}/>`; },
    ruler(ps) { s += `<path d="M${ps.map(P).join('L')}Z" fill="${HOWTO_RULER}" fill-opacity=".14" ${stroke(HOWTO_RULER, 0.8)}/>`; },
    // short arrow (px long) from p along unit vector d
    arrow(p, d, len = 9, dashed = false) {
      P(p);
      const L = w(len), h = w(2.6), e = [p[0] + d[0] * L, p[1] + d[1] * L], n = [-d[1], d[0]];
      s += `<path d="M${f(p[0])},${f(p[1])}L${f(e[0])},${f(e[1])}M${f(e[0] - d[0] * h + n[0] * h * .7)},${f(e[1] - d[1] * h + n[1] * h * .7)}L${f(e[0])},${f(e[1])}L${f(e[0] - d[0] * h - n[0] * h * .7)},${f(e[1] - d[1] * h - n[1] * h * .7)}" fill="none" ${stroke(HOWTO_INK, 0.9, dashed ? [1.6, 1.1] : null)} stroke-linecap="round"/>`;
    },
    // a pin across the seam at p (head on the n side)
    pin(p, n) {
      P(p);
      const a = [p[0] + n[0] * w(5), p[1] + n[1] * w(5)], b = [p[0] - n[0] * w(4), p[1] - n[1] * w(4)];
      s += `<path d="M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}" ${stroke('#5b6672', 0.8)}/><circle cx="${f(a[0])}" cy="${f(a[1])}" r="${w(1.7)}" fill="#e2b13c" ${stroke('#5b6672', 0.5)}/>`;
    },
    dot(p) { P(p); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${w(1.5)}" fill="${HOWTO_RED}"/>`; },
    // text at p, offset dx/dy in px
    text(p, str, o = {}) {
      s += `<text x="${f(p[0] + w(o.dx || 0))}" y="${f(p[1] + w(o.dy || 0))}" font-size="${w(o.size || 8)}" text-anchor="${o.anchor || 'middle'}"${o.base ? ` dominant-baseline="${o.base}"` : ''} fill="${o.fill || HOWTO_INK}"${o.bold ? ' font-weight="700"' : ''}>${esc(str)}</text>`;
    },
    // a small distance from the top edge (y = 0) down to y1, dx px right of x, labelled above
    dimTop(x, y1, dx, str) {
      const X = x + w(dx), t = w(2.2), up = w(5);
      s += `<path d="M${f(X)},${f(-up)}V${f(y1)}M${f(X - t)},${f(y1)}H${f(X + t)}M${f(X - t)},0H${f(X + t)}" ${stroke(HOWTO_INK, 0.7)}/>`;
      pen.text([X, -up], str, { dy: -1.5, size: 7.5 });
    },
  };
  return pen;
}

/* layout: panels in one row (≤ 3) or two rows, one shared scale so sizes compare truly */
function howtoLayout(panels, widthIn, legend, sa) {
  const Wpx = widthIn * 96, gap = 16, maxH = (panels.length > 3 ? 0.95 : 1.2) * 96, fs = 9, lh = 10.5;
  for (const p of panels) { const m = howtoPen(0); p.draw(m); p.bb = bounds(m.pts); }
  const rows = panels.length <= 3 ? [panels] : [panels.slice(0, Math.ceil(panels.length / 2)), panels.slice(Math.ceil(panels.length / 2))];
  const cols = Math.max(...rows.map(r => r.length)), colW = (Wpx - gap * (cols - 1)) / cols;
  const k = Math.min(...panels.map(p => Math.min((colW - 8) / p.bb.w, maxH / p.bb.h)));
  const maxChars = Math.floor(colW / (fs * 0.5));
  const wrap = str => {
    const lines = [''];
    for (const word of str.split(' ')) {
      const cur = lines[lines.length - 1];
      if (cur && (cur + ' ' + word).length > maxChars) lines.push(word); else lines[lines.length - 1] = cur ? cur + ' ' + word : word;
    }
    return lines;
  };
  // hatch for pieces lying wrong side up: white lines on dark fabrics (l), ink lines on light ones (d)
  const hatch = uid('hw'), hw = round(3.4 / k, 4), hp = (id, col, op) => `<pattern id="${hatch}-${id}" width="${hw}" height="${hw}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0V${hw}" stroke="${col}" stroke-opacity="${op}" stroke-width="${round(0.8 / k, 4)}"/></pattern>`;
  let s = `<defs>${hp('l', '#ffffff', 0.55)}${hp('d', HOWTO_INK, 0.28)}</defs>`, y = 2;
  for (const row of rows) {
    const contentH = Math.max(...row.map(p => p.bb.h * k)), top = 6 + (row.some(p => p.top) ? 8 : 0), sizeH = row.some(p => p.size) ? 12 : 0;
    const caps = row.map(p => wrap(p.cap)), capH = Math.max(...caps.map(c => c.length)) * lh;
    row.forEach((p, i) => {
      const x0 = i * (colW + gap), cx = x0 + colW / 2;
      const L = x0 + (colW - p.bb.w * k) / 2, T = y + top + (contentH - p.bb.h * k) / 2;
      const pen = howtoPen(k, hatch); p.draw(pen);
      s += `<g transform="translate(${round(L, 2)} ${round(T, 2)}) scale(${round(k, 4)}) translate(${round(-p.bb.minX, 4)} ${round(-p.bb.minY, 4)})">${pen.svg}</g>`;
      if (p.size) s += `<text x="${round(cx, 2)}" y="${round(y + top + contentH + 10, 2)}" font-size="8.5" text-anchor="middle" fill="${HOWTO_INK}">${esc(p.size)}</text>`;
      const cy = y + top + contentH + sizeH + 11;
      caps[i].forEach((line, j) => {
        const lab = j === 0 && p.label ? `<tspan font-weight="700">${esc(p.label)}</tspan> ` : '';
        s += `<text x="${round(cx, 2)}" y="${round(cy + j * lh, 2)}" font-size="${fs}" text-anchor="middle" fill="${HOWTO_INK}">${lab}${esc(line)}</text>`;
      });
      if (i < row.length - 1) {
        const ax = x0 + colW + gap / 2, ay = y + top + contentH / 2;
        s += `<path d="M${round(ax - 5, 2)},${round(ay, 2)}h9m-3,-3l3,3l-3,3" fill="none" stroke="${HOWTO_INK}" stroke-width=".9"/>`;
      }
    });
    y += top + contentH + sizeH + 11 + capH + 4;
  }
  if (legend) {
    const ly = y + 6, item = (x, sample, str) => `${sample(x)}<text x="${x + 20}" y="${ly + 3}" font-size="8" fill="#4f5d6b">${esc(str)}</text>`;
    const seg = (st) => x => `<line x1="${x}" y1="${ly}" x2="${x + 16}" y2="${ly}" ${st}/>`;
    s += item(0, seg(`stroke="${HOWTO_RED}" stroke-width="1" stroke-dasharray="2.6 1.6"`), 'sewing line')
      + item(Wpx * 0.25, seg(`stroke="${HOWTO_INK}" stroke-width=".8"`), 'drawn or cut line')
      + item(Wpx * 0.56, seg(`stroke="${HOWTO_GREY}" stroke-width=".75" stroke-dasharray="2 1.5"`), `finished size, ${fmtLen(sa)} in from the edge`);
    y = ly + 8;
  }
  const H = Math.ceil(y + 2);
  return `<svg class="howto" viewBox="0 0 ${round(Wpx, 2)} ${H}" width="${widthIn}in" height="${round(H / 96, 3)}in" font-family="system-ui,sans-serif">${s}</svg>`;
}

/* ---- the stages of each method ---- */
function howtoHst(g) {
  const { sa, D, S } = g, U = g.UW, Q = U + D, o = Q * 0.035, A = g.lt, B = g.dk;
  const fin = [[sa, sa], [U - sa, U - sa], [sa, U - sa]], box = howtoRect(0, 0, U, U);
  const unit = (t, ears) => {
    if (ears) for (const e of howtoEars(fin, [sa, sa], [U - sa, U - sa], box, sa)) t.poly(e, A);
    t.poly([[0, 0], [U, U], [0, U]], A); t.poly([[0, 0], [U, 0], [U, U]], B); t.fin(g);
  };
  return [
    { cap: `Draw line, sew ${S} each side`, draw: t => {
      t.poly(howtoRect(o, o, Q, Q), B); t.poly(howtoRect(0, 0, Q, Q), A, { wrong: 1 });
      t.line([0, 0], [Q, Q]); t.line([0, D], [Q - D, Q], 'sew'); t.line([D, 0], [Q, Q - D], 'sew');
    } },
    { cap: 'Cut, press: makes 2', draw: t => unit(t, true) },
    { cap: 'Trim the dog ears', size: fmtSize(U, U), draw: t => unit(t, false) },
  ];
}

// flying geese, no-waste (4 at a time); drawn landscape whatever way the unit sits in the block
function howtoGoose(g) {
  const { sa, D, S } = g, W = Math.max(g.W, g.H), H = Math.min(g.W, g.H), go = g.unit.goose || g.dk, sky = g.unit.sky || g.lt;
  const G = ceilEighth(W + 2 * sa * (1 + Math.SQRT2)), Q = ceilEighth(H + sa * (2 + Math.SQRT2));
  const c = G / 2, turn = p => rotatePoly(p, -Math.PI / 4, c, c), tl = (a, b) => [turn([a])[0], turn([b])[0]];
  const heart = t => {
    t.poly(turn([[0, D], [0, G], [G - D, G]]), go);
    t.poly(turn([[0, D], [Q - D, D], [Q - D, Q]]), sky);
    t.poly(turn([[G - D, G], [G - D, G - Q + D], [G - Q, G - Q + D]]), sky);
  };
  const gg = { ...g, W, H, UW: W + 2 * sa, UH: H + 2 * sa };
  const goose = (t, ears) => howtoGooseUnit(t, gg, go, sky, ears);
  return [
    { cap: `Sew ${S} each side, cut`, draw: t => {
      t.poly(howtoRect(0, 0, G, G), go);
      t.poly(howtoRect(0, 0, Q, Q), sky, { wrong: 1 }); t.poly(howtoRect(G - Q, G - Q, Q, Q), sky, { wrong: 1 });
      // the small squares overlap in the middle: shade that, and show the hidden corner of the first one
      if (2 * Q > G) t.poly(howtoRect(G - Q, G - Q, 2 * Q - G, 2 * Q - G), null, { shade: 1 });
      t.poly(howtoRect(0, 0, Q, Q), null, { edge: 1 });
      t.line([0, 0], [G, G]); t.line([0, D], [G - D, G], 'sew'); t.line([D, 0], [G, G - D], 'sew');
    } },
    { cap: 'Press out: 2 hearts', draw: heart },
    { cap: 'Add a square, sew, cut', draw: t => {
      heart(t);
      t.poly(turn(howtoRect(0, G - Q, Q, Q)), sky, { wrong: 1 });
      t.line(...tl([0, G], [Q, G - Q])); t.line(...tl([0, G - D], [Q - D, G - Q]), 'sew'); t.line(...tl([D, G], [Q, G - Q + D]), 'sew');
    } },
    { cap: 'Press: 4 per big square', draw: t => goose(t, true) },
    { cap: `Trim, ${S} above the point`, size: fmtSize(gg.UW, gg.UH), draw: t => { goose(t, false); t.dimTop(gg.UW / 2, sa, 7, S); }, top: true },
  ];
}
// a sewn goose at unfinished size: point sa below the top edge, seams running on to the edge (the X)
function howtoGooseUnit(t, g, go, sky, ears) {
  const { sa, UW, UH } = g, ax = UW / 2;
  const fin = [[sa, UH - sa], [UW - sa, UH - sa], [ax, sa]], box = howtoRect(0, 0, UW, UH);
  // the top edge is a cut line, so nothing sticks out above it: ears only at the bottom corners
  if (ears) for (const [a, b] of [[fin[0], fin[2]], [fin[2], fin[1]]]) for (const e of howtoEars(fin, a, b, box, sa)) if (e.every(p => p[1] > UH / 2)) t.poly(e, go);
  t.poly([[0, 0], [UH, 0], [0, UH]], sky); t.poly([[UW, 0], [UW, UH], [UW - UH, 0]], sky);
  t.poly([[0, UH], [UW, UH], [ax, sa]], go); t.fin(g);
}

// flying geese, stitch-and-flip: one rectangle and two squares per goose
function howtoGooseFlip(g) {
  const { sa, D, S } = g, W = Math.max(g.W, g.H), H = Math.min(g.W, g.H), go = g.unit.goose || g.dk, sky = g.unit.sky || g.lt;
  const UW = W + 2 * sa, UH = H + 2 * sa, q = UH, gg = { ...g, W, H, UW, UH };
  const rightTri = [[UW - q, 0], [UW, 0], [UW, UH]];
  return [
    { cap: 'Sew on the drawn line', draw: t => {
      t.poly(howtoRect(0, 0, UW, UH), go); t.poly(howtoRect(UW - q, 0, q, q), sky, { wrong: 1 });
      t.line([UW - q, 0], [UW, UH]); t.line([UW - q, 0], [UW, UH], 'sew');
    } },
    { cap: `Trim ${S} outside the seam`, draw: t => {
      t.poly([[0, 0], [UW - q + D, 0], [UW, UH - D], [UW, UH], [0, UH]], go);
      t.poly([[UW - q, 0], [UW - q + D, 0], [UW, UH - D], [UW, UH]], sky, { wrong: 1 });
      t.poly([[UW - q + D, 0], [UW, 0], [UW, UH - D]], null, { ghost: 1 });
      t.line([UW - q, 0], [UW, UH], 'sew');
    } },
    { cap: 'Press; repeat at the left', draw: t => {
      t.poly(howtoRect(0, 0, UW, UH), go); t.poly(rightTri, sky);
      t.poly(howtoRect(0, 0, q, q), sky, { wrong: 1 }); t.line([0, UH], [q, 0]); t.line([0, UH], [q, 0], 'sew');
    } },
    { cap: `Seams cross ${S} below the top`, size: fmtSize(UW, UH), draw: t => {
      t.poly(howtoRect(0, 0, UW, UH), go); t.poly(rightTri, sky); t.poly([[0, 0], [q, 0], [0, UH]], sky); t.fin(gg);
    } },
  ];
}

// QST from two HSTs (2 fabrics): HSTs left untrimmed, recut across the seam, then trimmed
function howtoQst2(g) {
  const { sa, D, S } = g, U = g.UW, A = g.lt, B = g.dk;
  const sq = ceilEighth(g.W + 2 * sa * (1 + Math.SQRT2)), H1 = sq - D, Uq = sq - 2 * D, o = H1 * 0.035;
  const qst = (t, N, ears) => {
    const c = N / 2, box = howtoRect(0, 0, N, N), F = N - 2 * sa;
    if (ears) {
      for (const e of howtoEars([[sa, sa], [c, c], [sa, sa + F]], [sa, sa], [c, c], box, sa)) t.poly(e, A);
      for (const e of howtoEars([[sa + F, sa], [sa + F, sa + F], [c, c]], [c, c], [sa + F, sa + F], box, sa)) t.poly(e, A);
    }
    t.poly([[0, 0], [N, 0], [c, c]], B); t.poly([[0, N], [N, N], [c, c]], B);
    t.poly([[0, 0], [c, c], [0, N]], A); t.poly([[N, 0], [N, N], [c, c]], A);
  };
  const r2 = Math.SQRT1_2;
  return [
    { cap: `Nest seams, sew ${S} each side`, draw: t => {
      t.poly([[o, o], [o + H1, o + H1], [o, o + H1]], A); t.poly([[o, o], [o + H1, o], [o + H1, o + H1]], B);
      t.poly([[0, 0], [H1, 0], [H1, H1]], A, { wrong: 1 }); t.poly([[0, 0], [H1, H1], [0, H1]], B, { wrong: 1 });
      t.line([H1, 0], [0, H1]); t.line([H1 - D, 0], [0, H1 - D], 'sew'); t.line([H1, D], [D, H1], 'sew');
      t.arrow([H1 * 0.3, H1 * 0.3], [-r2, r2]); t.arrow([H1 * 0.7, H1 * 0.7], [r2, -r2], 9, true);
    } },
    { cap: 'Cut: 2 QSTs, a bit big', draw: t => qst(t, Uq, true) },
    { cap: 'Centre the ruler on the crossing', draw: t => {
      qst(t, Uq, true);
      const m = (Uq - U) / 2; t.ruler(howtoRect(m, m, U, U)); t.line([m, m], [m + U, m + U], 'ruler');
    } },
    { cap: 'Trimmed QST', size: fmtSize(U, U), draw: t => { qst(t, U, false); t.fin(g); } },
  ];
}

// QST from four triangles (3+ fabrics), in the unit's own layout
function howtoQst3(g) {
  const { sa } = g, U = g.UW, c = [U / 2, U / 2];
  const tris = g.pieces.map(p => ({ ...p, pts: howtoCorners(p.pts) }));
  if (tris.length !== 4 || tris.some(p => p.pts.length !== 3)) return [];
  const dirOf = p => { const m = centroid(p.pts), v = [m[0] - c[0], m[1] - c[1]], l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l]; };
  const at = (x, y) => tris.find(p => { const d = dirOf(p); return d[0] * x + d[1] * y > 0.7; });
  const top = at(0, -1), left = at(-1, 0), bottom = at(0, 1), right = at(1, 0);
  if (!top || !left || !bottom || !right) return [];
  const e = 0.1 * U + sa, gap = 0.12 * U + sa;
  const halves = [[top, left], [bottom, right]];
  const near = (a, b) => dist(a, b) < 1e-6 * U;
  return [
    { cap: 'Lay out the triangles', draw: t => {
      for (const p of tris) { const d = dirOf(p); t.poly(translatePoly(howtoGrow(p.pts, sa), d[0] * e, d[1] * e), p.fab); }
    } },
    { cap: 'Sew pairs into halves', draw: t => {
      for (const [p, q] of halves) {
        const shared = p.pts.filter(a => q.pts.some(b => near(a, b)));
        const outer = [...p.pts, ...q.pts].filter(a => !shared.some(b => near(a, b)));
        const corner = shared.find(a => !near(a, c)) || shared[0];
        const half = howtoGrow([corner, ...outer], sa), m = centroid([corner, ...outer]);
        const v = [m[0] - c[0], m[1] - c[1]], l = Math.hypot(...v), dx = v[0] / l * gap / 2, dy = v[1] / l * gap / 2;
        const away = g.lum(p.fab) >= g.lum(q.fab) ? p : q;
        const mv = ps => translatePoly(ps, dx, dy);
        for (const ear of howtoEars(away.pts, shared[0], shared[1], half, sa)) t.poly(mv(ear), away.fab);
        for (const x of [p, q]) t.poly(mv(howtoClip(half, shared[0], shared[1], centroid(x.pts))), x.fab);
      }
    } },
    { cap: 'Join the halves, trim ears', size: fmtSize(U, U), draw: t => { for (const f of howtoFaces(g, tris)) t.poly(f.pts, f.fab); t.fin(g); } },
  ];
}

// stitch-and-flip corners (snowball): first corner shown in stages 1–2, every corner in stage 3
function howtoSnowball(g) {
  const { sa, D, S, UW, UH, rect: r } = g, u = g.unit, main = resolveFab(u.main.fab);
  const tol = 1e-3 * Math.max(r.w, r.h), rc = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  const corners = (u.corners || []).map(cp => {
    const k = Math.max(0, rc.findIndex(c => cp.pts.some(q => dist(q, c) < tol)));
    const q = cp.cls.leg + 2 * sa;
    // draw at the top-left, then mirror to the real corner
    const map = ps => ps.map(([x, y]) => [k === 1 || k === 2 ? UW - x : x, k >= 2 ? UH - y : y]);
    return { q, map, fab: resolveFab(cp.fab) };
  });
  if (!corners.length) return [];
  const c0 = corners[0], q = c0.q, M = c0.map, unit = howtoRect(0, 0, UW, UH);
  return [
    { cap: 'Sew on the drawn line', draw: t => {
      t.poly(unit, main); t.poly(M(howtoRect(0, 0, q, q)), c0.fab, { wrong: 1 });
      t.line(...M([[q, 0], [0, q]])); t.line(...M([[q, 0], [0, q]]), 'sew');
    } },
    { cap: `Trim ${S} outside the seam`, draw: t => {
      t.poly(M([[q - D, 0], [UW, 0], [UW, UH], [0, UH], [0, q - D]]), main);
      t.poly(M([[q - D, 0], [q, 0], [0, q], [0, q - D]]), c0.fab, { wrong: 1 });
      t.poly(M([[0, 0], [q - D, 0], [0, q - D]]), null, { ghost: 1 });
      t.line(...M([[q, 0], [0, q]]), 'sew');
    } },
    { cap: 'Press the corner out', size: fmtSize(UW, UH), draw: t => {
      t.poly(unit, main);
      for (const c of corners) t.poly(c.map([[0, 0], [c.q, 0], [0, c.q]]), c.fab);
      t.fin(g);
    } },
  ];
}

// half-rectangle triangles: two long triangles cut from rectangles, tips offset, seam off the corners
function howtoHrt(g) {
  const { sa, S, UW, UH } = g, box = howtoRect(0, 0, UW, UH);
  const tris = g.pieces.map(p => ({ ...p, pts: howtoCorners(p.pts) }));
  if (tris.length !== 2 || tris.some(p => p.pts.length !== 3)) return [];
  const [p0, p1] = tris, near = (a, b) => dist(a, b) < 1e-6 * Math.max(UW, UH);
  const seam = p0.pts.filter(a => p1.pts.some(b => near(a, b)));
  if (seam.length !== 2) return [];
  const lt = g.lum(p0.fab) >= g.lum(p1.fab) ? p0 : p1, dk = lt === p0 ? p1 : p0;
  // the seam line meets the raw edges here (dots), a little in from the corners
  const [a, b] = seam, v = [b[0] - a[0], b[1] - a[1]];
  const hits = [];
  for (const [x, y] of [[0, null], [UW, null], [null, 0], [null, UH]]) {
    const t = x !== null ? (x - a[0]) / v[0] : (y - a[1]) / v[1], p = [a[0] + v[0] * t, a[1] + v[1] * t];
    if (Number.isFinite(t) && p[0] > -1e-6 && p[0] < UW + 1e-6 && p[1] > -1e-6 && p[1] < UH + 1e-6 && !hits.some(h => near(h, p))) hits.push(p);
  }
  const mirror = p => { const t = ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1]), f = [a[0] + v[0] * t, a[1] + v[1] * t]; return [2 * f[0] - p[0], 2 * f[1] - p[1]]; };
  const faces = howtoFaces(g, tris);
  const unit = (t, ears) => {
    if (ears) for (const e of howtoEars(lt.pts, a, b, box, sa)) t.poly(e, lt.fab);
    for (const f of faces) t.poly(f.pts, f.fab);
    t.fin(g);
  };
  return [
    { cap: 'Cut on the same diagonal', size: 'both right side up', draw: t => {
      let x = 0;
      for (const p of [lt, dk]) {
        const cut = howtoGrow(p.pts, sa), bb = bounds(cut), m = translatePoly(cut, x - bb.minX, -bb.minY);
        const hyp = m.map((q, i) => [q, m[(i + 1) % 3]]).sort((u, w) => dist(...w) - dist(...u))[0];
        t.poly(howtoRect(x, 0, bb.w, bb.h), p.fab); t.line(...hyp);
        x += bb.w + Math.max(bb.w * 0.25, 2 * sa);
      }
    } },
    { cap: `Edges cross ${S} in: sew`, draw: t => {
      t.poly(howtoGrow(dk.pts, sa), dk.fab); t.poly(howtoGrow(lt.pts, sa).map(mirror), lt.fab, { wrong: 1 });
      if (hits.length === 2) { t.line(hits[0], hits[1], 'sew'); hits.forEach(h => t.dot(h)); }
    } },
    { cap: 'Press: long dog ears', draw: t => unit(t, true) },
    { cap: 'Trim the dog ears', size: fmtSize(UW, UH), draw: t => unit(t, false) },
  ];
}

// curved piecing: convex piece (pie) + concave piece (L), or rings added smallest first
function howtoCurved(g) {
  const { sa, UW, UH } = g, cx = [UW / 2, UH / 2];
  if (g.pieces.length < 2 || !g.unit.order) return [];
  // the convex piece (pie) comes first, then the others outward from the corner it sits in
  const convex = p => { const q = howtoCorners(p.pts); let sg = 0; return q.every((a, i) => { const b = q[(i + 1) % q.length], c = q[(i + 2) % q.length], cr = Math.sign((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])); sg = sg || cr; return !cr || cr === sg; }); };
  const byArea = g.pieces.slice().sort((p, q) => polyArea(p.pts) - polyArea(q.pts)), first = byArea.find(convex) || byArea[0];
  const pivot = howtoRect(sa, sa, g.W, g.H).sort((a, b) => dist(a, centroid(first.pts)) - dist(b, centroid(first.pts)))[0];
  const ps = [first, ...g.pieces.filter(p => p !== first).sort((p, q) => dist(centroid(p.pts), pivot) - dist(centroid(q.pts), pivot))];
  const m0 = centroid(first.pts), v = [cx[0] - m0[0], cx[1] - m0[1]], vl = Math.hypot(...v) || 1, dir = [v[0] / vl, v[1] / vl];
  const gap = 3.2 * sa + 0.04 * Math.max(g.W, g.H), many = ps.length > 2;
  // a tick across the cut edge at the middle of each curved seam (the finger-pressed crease)
  const creases = (t, p, off) => {
    for (const path of howtoSeamPaths(g, p.pts)) {
      const { p: m, dir: d } = howtoAlong(path, 0.5);
      let n = [-d[1], d[0]];
      if (pointInPoly([m[0] + n[0] * 1e-3, m[1] + n[1] * 1e-3], p.pts)) n = [-n[0], -n[1]];
      const at = k => [m[0] + n[0] * k + off[0], m[1] + n[1] * k + off[1]];
      t.line(at(sa - t.w(3)), at(sa + t.w(3)));
    }
  };
  return [
    { cap: many ? 'Crease centres; sew 1, 2, 3…' : 'Crease the curve centres', draw: t => {
      ps.forEach((p, i) => {
        const off = [dir[0] * gap * i, dir[1] * gap * i];
        t.poly(translatePoly(seamOutline(p.pts, sa), ...off), p.fab);
        for (const path of howtoSeamPaths(g, p.pts)) t.path(translatePoly(path, ...off), 'sew');
        creases(t, p, off);
        if (many) { const c = centroid(p.pts); t.text([c[0] + off[0], c[1] + off[1]], String(i + 1), { size: 8, bold: true, base: 'central', fill: inkOn(fabricHex(p.fab)) }); }
      });
    } },
    { cap: many ? 'Add each ring: pin, sew' : 'Concave on top: pin, sew', draw: t => {
      // the pieces sewn so far (innermost ones pressed flat), the next concave piece on top
      const q = ps[ps.length - 1], done = ps.slice(0, -1), p = done[done.length - 1];
      t.poly(seamOutline(p.pts, sa), p.fab);
      for (const d of done.slice(0, -1).reverse()) t.poly(howtoExtend(g, d.pts), d.fab);
      t.poly(seamOutline(q.pts, sa), q.fab, { wrong: 1 });
      for (const path of howtoSeamPaths(g, q.pts)) {
        t.path(path, 'sew');
        for (const k of [0.03, 0.5, 0.97]) { const { p: m, dir: d } = howtoAlong(path, k); t.pin(m, [-d[1], d[0]]); }
      }
    } },
    { cap: 'Press to the convex piece', size: fmtSize(UW, UH), draw: t => {
      for (const p of ps.slice().reverse()) t.poly(howtoExtend(g, p.pts), p.fab);
      t.fin(g);
    } },
  ];
}
