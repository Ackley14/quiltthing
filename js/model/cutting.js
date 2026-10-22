/* Cutting & yardage.
   Every finished piece in the quilt gets a cutting "recipe" (how a quilter cuts it):
     strip    — rotary cut from WOF strips (squares, rectangles, HST/QST squares, stitch-and-flip)
     angled   — WOF strips sub-cut at an angle (diamonds, parallelograms)
     tri60    — WOF strips sub-cut with a 60° ruler (equilateral triangles)
     joined   — WOF strips sewn end to end (borders, long sashing, binding)
     template — traced from a printed template (anything irregular or curved, appliqué)
   Sizes come from offsetting the finished outline by the seam allowance, rounded UP to 1/8". */

const ROUND_STEPS = { none: 0, eighth: 4.5, quarter: 9, half: 18 };

function roundYardIn(inches, mode) {
  const step = ROUND_STEPS[mode] ?? 4.5;
  if (inches <= 0) return 0;
  return step ? Math.ceil(inches / step - 1e-9) * step : inches;
}

/* ---------- how each fabric comes ----------
   A fabric is bought as yardage of some width, or as precut pieces (fat quarters, charm
   squares…) or same-size pieces of your own choosing. There's a default for all fabrics
   (Edit → Default fabric); any fabric can override it. */
// w × h is the size sold; use is what's left to cut from after trimming selvages and squaring up
// (precut squares are cut exactly, so they're used whole).
const PRECUTS = [
  { key: 'fq', name: 'Fat quarter', w: 21, h: 18, use: [20, 17.5] },
  { key: 'f8', name: 'Fat eighth', w: 21, h: 9, use: [20, 8.5] },
  { key: 'lq', name: 'Long quarter', w: 42, h: 9, use: [40, 8.5] },
  { key: 'layer', name: 'Layer cake square', w: 10, h: 10 },
  { key: 'charm', name: 'Charm square', w: 5, h: 5 },
  { key: 'mini', name: 'Mini charm', w: 2.5, h: 2.5 },
  { key: 'jelly', name: 'Jelly roll strip', w: 42, h: 2.5, use: [40, 2.5] },
];
// A format setting ({ kind: 'yardage', width } | { kind: 'precut', key } | { kind: 'piece', w, h })
// resolved to { yardage: true, width } or { yardage: false, name, W, H } (W = the longer side).
function resolveFormat(fm) {
  if (fm?.kind === 'yardage' && fm.width > 0) return { yardage: true, width: fm.width };
  if (fm?.kind === 'precut') { const pc = PRECUTS.find(x => x.key === fm.key), [w, h] = pc?.use || [pc?.w, pc?.h]; if (pc) return { yardage: false, name: pc.name, W: Math.max(w, h), H: Math.min(w, h), sold: [pc.w, pc.h] }; }
  if (fm?.kind === 'piece' && fm.w > 0 && fm.h > 0) return { yardage: false, name: 'Piece', W: Math.max(fm.w, fm.h), H: Math.min(fm.w, fm.h) };
  return null;
}
function defaultFormat() { return resolveFormat(doc.cutting.defaultFormat) || { yardage: true, width: doc.cutting.wof }; }
function fabricFormat(fab) { return resolveFormat(fabricById(fab)?.format) || defaultFormat(); }
// The longest strip a fabric gives without joining: its width, or the long side of its pieces.
// Pieces bigger than a precut fall back to the default yardage, so recipes may use that too.
function fabricRun(fab) { const fm = fabricFormat(fab); return fm.yardage ? fm.width : Math.max(fm.W, doc.cutting.wof); }
function formatLabel(fm) { return fm.yardage ? `yardage, ${fmtLen(fm.width)} wide` : `${fm.name.toLowerCase()}s (${fm.sold ? fmtSize(...fm.sold) : fmtSize(fm.W, fm.H)})`; }

/* ---------- recipes ---------- */
function recipeFor(cls, sa, opts = {}) {
  const wof = opts.wof || doc.cutting.wof;
  const dir = !!opts.directional;
  switch (cls.shape) {
    case 'rect': {
      const cw = ceilEighth(cls.w + 2 * sa), chh = ceilEighth(cls.h + 2 * sa);
      let w = dir ? chh : Math.min(cw, chh), sub = dir ? cw : Math.max(cw, chh);
      if (!dir && sub > wof && w <= wof) [w, sub] = [sub, w];
      const sq = Math.abs(cw - chh) < 1e-6;
      return { key: `rect:${w}x${sub}`, method: 'strip', w, sub, yield: 1, cut: 'none', oversize: sub > wof,
        unitName: sq ? 'square' : 'rectangle', unitLabel: sq ? `${fmtLen(w, 'up')} square` : `${fmtSize(sub, w, 'up')} rectangle`, makes: sq ? 'square' : (Math.max(cw, chh) / Math.min(cw, chh) >= 3 ? 'strip' : 'rectangle') };
    }
    case 'hst': {
      const q = ceilEighth(cls.leg + sa * (2 + Math.SQRT2));
      return { key: `hst:${q}`, method: 'strip', w: q, sub: q, yield: 2, cut: 'diag', unitName: 'square', unitLabel: `${fmtLen(q, 'up')} square`, makes: 'half-square triangle' };
    }
    case 'qst': {
      const q = ceilEighth(cls.hyp + 2 * sa * (1 + Math.SQRT2));
      return { key: `qst:${q}`, method: 'strip', w: q, sub: q, yield: 4, cut: 'cross', unitName: 'square', unitLabel: `${fmtLen(q, 'up')} square`, makes: 'quarter-square triangle' };
    }
    case 'rtri': {
      const t = seamOutline([[0, 0], [cls.a, 0], [0, cls.b]], sa, Infinity), bb = bounds(t);
      const a = ceilEighth(bb.w), b = ceilEighth(bb.h);
      return { key: `rtri:${a}x${b}:${cls.hand}`, method: 'strip', w: Math.min(a, b), sub: Math.max(a, b), yield: 2, cut: cls.hand === 'R' ? 'diagR' : 'diagL',
        unitName: 'rectangle', unitLabel: `${fmtSize(a, b, 'up')} rectangle`, makes: 'right triangle' };
    }
    case 'tri60': {
      const H = ceilEighth(cls.height + 3 * sa), B = H * 2 / Math.sqrt(3);
      return { key: `tri60:${H}`, method: 'tri60', w: H, step: B / 2, first: B, yield: 1, makes: '60° triangle', unitLabel: `${fmtLen(H, 'up')} strips` };
    }
    case 'para': {
      const th = cls.angle * Math.PI / 180;
      const w = ceilEighth(cls.height + 2 * sa);
      const step = ceilEighth(cls.base + 2 * sa / Math.sin(th));
      const trim = w / Math.tan(th);
      return { key: `para:${w}:${step}:${Math.round(cls.angle)}:${cls.hand || ''}`, method: 'angled', w, step, trim, angle: Math.round(cls.angle), hand: cls.hand,
        yield: 1, makes: cls.rhombus ? `${Math.round(cls.angle)}° diamond` : `${Math.round(cls.angle)}° parallelogram` };
    }
    case 'trap': {
      // pieces alternate 180° along the strip so the angled ends share cuts
      const shape = trapShape(cls.pts, cls.ia, sa);
      const A = ceilEighth(shape.b1 - shape.b0), B = ceilEighth(shape.t1 - shape.t0);
      const w = ceilEighth(cls.height + 2 * sa), step = dir ? A : (A + B) / 2;
      // which way the short edge sits along the long one; mirror images can't share a strip face up
      const hand = shape.skew ? (shape.t0 < shape.b0 ? 'L' : 'R') : Math.abs(shape.t0 - shape.b0 - (shape.b1 - shape.t1)) < 0.02 ? '' : shape.t0 - shape.b0 > shape.b1 - shape.t1 ? 'R' : 'L';
      return { key: `trap:${w}:${A}:${B}:${[...cls.angles].sort().join('/')}:${hand}`, method: 'trap', w, a: A, b: B, step, angles: cls.angles,
        shape, hand, yield: 1, makes: 'trapezoid', alternate: !dir };
    }
    default: {
      // packing uses the tightest rotation; the printed template keeps the in-quilt
      // orientation so its grain arrow (horizontal) matches the block's straight grain
      const cutOutline = seamOutline(cls.pts, sa);
      const mar = minAreaRect(cutOutline);
      const bb = bounds(cls.pts);
      const app = opts.applique;
      const holes = (opts.holes || []).map(h => translatePoly(h, -bb.x, -bb.y));
      return { key: `${app ? 'app' : 'tpl'}:${outlineSignature(cls.pts)}${holes.map(h => '/' + outlineSignature(h)).join('')}`, method: 'template', applique: app, curved: cls.curved,
        w: mar.w, h: mar.h, outline: translatePoly(cls.pts, -bb.x, -bb.y), holes, cutBox: mar, yield: 1, makes: shapeName(cls), holed: cls.shape === 'holed',
        // regular hexagons nest in a honeycomb; offsetting by sa grows the side by 2·sa/√3
        hexSide: cls.shape === 'hex' && !app ? cls.side + 2 * sa / Math.sqrt(3) : null };
    }
  }
}
// Geometry of a printed template. Pieced templates get the seam allowance; turned-edge appliqué
// a 3/16" turn-under; fusible appliqué is printed reversed with no allowance, ready to trace
// onto the paper side of fusible web.
function templateGeom(recipe) {
  const fusible = !!recipe.applique && doc.cutting.appMethod === 'fusible';
  const sa = recipe.applique ? (fusible ? 0 : 0.1875) : doc.cutting.seam;
  let pts = recipe.outline, holes = recipe.holes || [];
  if (fusible) { const bb = bounds(pts), ax = bb.x + bb.w / 2; pts = mirrorPolyX(pts, ax); holes = holes.map(h => mirrorPolyX(h, ax)); }
  return { sa, fusible, pts, holes, cut: seamOutline(pts, sa), cutHoles: holes.map(h => inflate(h, -sa)) };
}
function recipeStitchMain(rect, sa) {
  return recipeFor({ shape: 'rect', w: rect.w, h: rect.h }, sa);
}
function recipeStitchCorner(leg, sa) {
  const q = ceilEighth(leg + 2 * sa);
  return { key: `sf:${q}`, method: 'strip', w: q, sub: q, yield: 1, cut: 'stitch', unitName: 'square', unitLabel: `${fmtLen(q, 'up')} square`, makes: 'stitch-and-flip corner' };
}

// Shapes and blocks cut off by the quilt edge or a panel are cut whole and trimmed after assembly,
// unless "cut edge pieces to shape" is on: then only the part that shows is cut, to its exact
// outline (identical edge shapes share a cutting step and piece code). Tessellations keep their
// own setting; straight and on-point quilts cut to shape unless it's turned off.
const exactEdges = () => doc.layout.mode === 'tess' ? !!doc.layout.tess.cutEdges : doc.layout.panelExact !== false;
const partialCell = c => !!(c.b && c.clip && exactEdges());
function tileCutShape(t) {
  return t.role === 'trim' && t.full && !exactEdges() ? t.full : t.pts;
}
// The pieces of a partly covered block that show, in quilt coordinates.
function partialBlockPieces(c) {
  const map = cellPointMapper(c), out = [];
  for (const p of blockPieces(doc.blocks[c.b], c.size, c.size)) {
    const piece = [closeRing(p.pts.map(map)), ...p.holes.map(h => closeRing(h.map(map)))];
    for (const part of c.clip) {
      let mp = pcSafe('intersection', piece, toPC(part));
      if (mp && c.clipHoles?.length) mp = pcSafe('difference', mp, ...c.clipHoles.map(toPC));
      for (const x of fromPC(mp || [])) {
        const pts = cleanPoly(x.outer);
        if (pts.length >= 3 && polyArea(pts) > 0.02) out.push({ fab: p.fab, app: p.app, curved: p.curved, pts, holes: x.holes });
      }
    }
  }
  return out;
}

// Pieces of units the block steps make from whole squares (two-at-a-time HSTs, no-waste geese,
// two-fabric hourglasses): the cutting list must keep those squares whole.
function speedPieces(an) {
  const out = new Set();
  for (const u of an.units) {
    const t = u.unit.type;
    if (t === 'hst' || t === 'goose' || (t === 'qst' && (u.unit.fabs || []).length === 2)) for (const p of u.pieces) out.add(p);
  }
  return out;
}

/* ---------- collect every piece in the quilt ---------- */
function collectCutItems(Q) {
  const sa = doc.cutting.seam;
  const items = [];   // { fab, recipe, count, src, use }
  // `use` says where the cut ends up: { b: blockId, i: piece index } or { kind } for tiles/patches
  // speed = how many of these pieces belong to units sewn from whole squares (see `speedPieces`)
  const add = (fab, recipe, count, src, use, speed = 0) => items.push({ fab: resolveFab(fab), recipe, count, src, use, speed });
  const ro = (fab, o = {}) => ({ ...o, wof: fabricRun(resolveFab(fab)) });   // recipe options for this fabric
  const isDir = fab => !!fabricById(fab).directional;

  // blocks: group identical placements
  const groups = new Map();
  for (const c of Q.cells) {
    if (partialCell(c)) {
      // only what shows of a partly covered block, each piece cut to shape
      for (const p of partialBlockPieces(c)) add(p.fab, recipeFor(classifyPiece(p.pts, { curved: p.curved }), sa, ro(p.fab, { directional: isDir(p.fab), applique: p.app, holes: p.holes })), 1, 'Partial blocks', { kind: 'Partial blocks' });
    } else if (c.b) { const k = `${c.b}|${c.flip ? 'f' : ''}|${c.size}`; groups.set(k, (groups.get(k) || 0) + 1); }
    else if (c.fab) add(c.fab, recipeFor({ shape: 'rect', w: c.size, h: c.size }, sa, ro(c.fab, { directional: isDir(c.fab) })), 1, 'Plain squares', { kind: 'plain' });
  }
  for (const [k, n] of groups) {
    const [bid, flipFlag, sizeStr] = k.split('|');
    const flip = flipFlag === 'f', size = +sizeStr;
    const block = doc.blocks[bid];
    const an = analyzeBlock(block, size);
    const name = block.name;
    const handled = new Set();
    const all = blockPieces(block, size, size);
    const speed = speedPieces(an);
    const use = p => ({ b: bid, i: all.indexOf(p) });
    for (const u of an.units) {
      if (u.unit.type === 'snowball') {
        handled.add(u.unit.main);
        add(u.unit.main.fab, recipeStitchMain(u.rect, sa), n, name, use(u.unit.main));
        for (const t of u.unit.corners) { handled.add(t); add(t.fab, recipeStitchCorner(t.cls.leg, sa), n, name, use(t)); }
      }
    }
    for (const p of all) {
      if (handled.has(p)) continue;
      // mirrored placements only matter for pieces that have a left and right hand
      let cls = p.cls, holes = p.holes;
      if (flip && ['rtri', 'para', 'tri', 'quad', 'poly', 'curved', 'holed'].includes(cls.shape)) {
        cls = classifyPiece(mirrorPolyX(p.pts, size / 2), { curved: p.curved });
        holes = holes.map(h => mirrorPolyX(h, size / 2));
        if (p.cls.shape === 'holed') cls.shape = 'holed';
      }
      add(p.fab, recipeFor(cls, sa, ro(p.fab, { directional: isDir(p.fab), applique: p.app, holes })), n, name, use(p), speed.has(p) ? n : 0);
    }
  }
  // tiles & setting triangles
  for (const t of Q.tiles) {
    const cls = classifyPiece(tileCutShape(t));
    const src = t.role === 'side-setting' || t.role === 'corner-setting' ? 'Setting triangles' : t.role === 'tile' ? 'Tiles' : 'Edge pieces';
    add(t.fab, recipeFor(cls, sa, ro(t.fab, { directional: isDir(t.fab) })), 1, src, { kind: src });
  }
  // sashing, cornerstones, borders — long pieces become joined strips
  const joined = new Map();
  for (const p of Q.patches) {
    const bb = bounds(p.pts);
    const long = Math.max(bb.w, bb.h), short = Math.min(bb.w, bb.h);
    const src = p.role === 'border' ? `Border ${p.ring + 1}` : p.role === 'frame' ? `Panel frame ${p.ring + 1}` : p.role === 'corner' ? 'Cornerstones' : 'Sashing';
    const run = fabricFormat(resolveFab(p.fab)).yardage ? fabricRun(resolveFab(p.fab)) : fabricFormat(resolveFab(p.fab)).W;
    if ((p.role === 'border' || p.role === 'sashLong' || p.role === 'frame') && long + 2 * sa > run) {
      const w = ceilEighth(short + 2 * sa);
      const key = `${resolveFab(p.fab)}|${w}|${src}`;
      if (!joined.has(key)) joined.set(key, { fab: resolveFab(p.fab), w, lengths: [], src, join: 'straight' });
      joined.get(key).lengths.push(ceilEighth(long + 2 * sa));
    } else {
      add(p.fab, recipeFor({ shape: 'rect', w: bb.w, h: bb.h }, sa, ro(p.fab, { directional: isDir(p.fab) })), 1, src, { kind: src });
    }
  }
  // binding: one continuous strip around the quilt (+12" for corners and joining the ends)
  const bnd = doc.layout.binding;
  if (bnd?.fabric && bnd.width > 0) {
    joined.set('binding', { fab: resolveFab(bnd.fabric), w: bnd.width, lengths: [2 * (Q.W + Q.H) + 12], src: 'Binding', join: 'diagonal', binding: true });
  }
  return { items, joined: [...joined.values()] };
}

/* ---------- plan per fabric ---------- */
function joinedStripCount(total, w, join, wof = doc.cutting.wof) {
  const loss = join === 'diagonal' ? w : 2 * doc.cutting.seam;
  if (total <= wof) return 1;
  return Math.ceil((total - loss) / (wof - loss) - 1e-9);
}

// First-fit decreasing: lay sub-cuts along WOF strips.
function packStrips(units, wof) {
  const strips = [];
  const sorted = units.slice().sort((a, b) => b.len - a.len);
  for (const u of sorted) {
    let s = strips.find(st => st.used + u.len <= wof + 1e-6);
    if (!s) { s = { used: 0, cuts: [] }; strips.push(s); }
    s.cuts.push(u); s.used += u.len;
  }
  return strips;
}

// MaxRects (bottom-left) rectangle packing into one bin.
function packRects(items, binW, binH) {
  let free = [{ x: 0, y: 0, w: binW, h: binH }];
  const placed = [], unplaced = [];
  const order = items.slice().sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
  for (const it of order) {
    let best = null;
    for (const [w, h, rot] of it.rot === false ? [[it.w, it.h, false]] : [[it.w, it.h, false], [it.h, it.w, true]]) {
      for (const f of free) {
        if (w > f.w + 1e-6 || h > f.h + 1e-6) continue;
        const score = (f.y + h) * 1e4 + f.x + Math.min(f.w - w, f.h - h) * 1e-3;
        if (!best || score < best.score) best = { x: f.x, y: f.y, w, h, rot, score };
      }
    }
    if (!best) { unplaced.push(it); continue; }
    placed.push({ item: it, x: best.x, y: best.y, w: best.w, h: best.h, rot: best.rot });
    const next = [];
    for (const f of free) {
      if (best.x >= f.x + f.w - 1e-6 || best.x + best.w <= f.x + 1e-6 || best.y >= f.y + f.h - 1e-6 || best.y + best.h <= f.y + 1e-6) { next.push(f); continue; }
      if (best.x > f.x + 1e-6) next.push({ x: f.x, y: f.y, w: best.x - f.x, h: f.h });
      if (best.x + best.w < f.x + f.w - 1e-6) next.push({ x: best.x + best.w, y: f.y, w: f.x + f.w - best.x - best.w, h: f.h });
      if (best.y > f.y + 1e-6) next.push({ x: f.x, y: f.y, w: f.w, h: best.y - f.y });
      if (best.y + best.h < f.y + f.h - 1e-6) next.push({ x: f.x, y: best.y + best.h, w: f.w, h: f.y + f.h - best.y - best.h });
    }
    free = next.filter((a, i) => a.w > 0.05 && a.h > 0.05 && !next.some((b, j) => j !== i &&
      a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 && a.x + a.w <= b.x + b.w + 1e-6 && a.y + a.h <= b.y + b.h + 1e-6 && (j < i || a.w * a.h < b.w * b.h - 1e-9)));
  }
  return { placed, unplaced, free, usedH: placed.length ? Math.max(...placed.map(p => p.y + p.h)) : 0 };
}

// Up to N cut hexagons of side s nested honeycomb-style in a binW-wide bin (binH tall at most);
// picks the orientation (flat-top columns or pointy-top rows) that places the most, then uses
// the least length.
function honeycombPack(N, s, wof, binH = Infinity) {
  const F = Math.sqrt(3) * s;
  const hex = (cx, cy, pointy) => Array.from({ length: 6 }, (_, k) => {
    const a = (pointy ? -90 : 0) + 60 * k;
    return [cx + s * Math.cos(a * Math.PI / 180), cy + s * Math.sin(a * Math.PI / 180)];
  });
  const opts = [];
  const fits = (bottom) => bottom <= binH + 1e-6;
  const nc = Math.max(1, Math.floor((wof - 2 * s) / (1.5 * s)) + 1);        // flat-top columns
  if (2 * s <= wof) {
    const placed = [];
    for (let i = 0; placed.length < N && i < N * 2 + nc; i++) {
      const c = i % nc, r = Math.floor(i / nc), y = F / 2 + r * F + (c % 2 ? F / 2 : 0);
      if (fits(y + F / 2)) placed.push([s + 1.5 * s * c, y, false]); else if (c === 0) break;
    }
    opts.push({ placed, usedH: placed.length ? Math.max(...placed.map(q => q[1])) + F / 2 : 0 });
  }
  const nr = Math.max(1, Math.floor((wof - F / 2) / F));                     // pointy-top rows
  if (F <= wof) {
    const placed = [];
    for (let i = 0; placed.length < N; i++) {
      const r = Math.floor(i / nr), c = i % nr, y = s + r * 1.5 * s;
      if (!fits(y + s)) break;
      placed.push([F / 2 + c * F + (r % 2 ? F / 2 : 0), y, true]);
    }
    opts.push({ placed, usedH: placed.length ? Math.max(...placed.map(q => q[1])) + s : 0 });
  }
  const best = opts.sort((a, b) => b.placed.length - a.placed.length || a.usedH - b.usedH)[0] || { placed: [], usedH: 0 };
  return { usedH: best.usedH, placed: best.placed.map(([x, y, pointy]) => {
    const poly = hex(x, y, pointy), bb = bounds(poly);
    return { x: bb.x, y: bb.y, w: bb.w, h: bb.h, rot: false, poly };
  }) };
}

let _planCache = { key: null, plan: null };
function cuttingPlan(Q = buildQuilt()) {
  const key = snapshot() + (ui?.units || '');   // plan texts are written in the display units
  if (_planCache.key === key) return _planCache.plan;
  const plan = computePlan(Q);
  _planCache = { key, plan };
  return plan;
}
function computePlan(Q) {
  const wof = doc.cutting.wof;
  const { items, joined } = collectCutItems(Q);
  const byFab = new Map();
  const F = fab => {
    if (!byFab.has(fab)) byFab.set(fab, { fab, recipes: new Map(), joined: [], sources: new Set() });
    return byFab.get(fab);
  };
  for (const it of items) {
    const f = F(it.fab);
    f.sources.add(it.src);
    if (!f.recipes.has(it.recipe.key)) f.recipes.set(it.recipe.key, { recipe: it.recipe, pieces: 0, srcs: new Set(), uses: new Map() });
    const r = f.recipes.get(it.recipe.key);
    r.pieces += it.count; r.srcs.add(it.src); r.speed = (r.speed || 0) + (it.speed || 0);
    if (it.use) {
      const k = it.use.b || it.use.kind;
      if (!r.uses.has(k)) r.uses.set(k, { b: it.use.b, kind: it.use.kind, idx: new Set() });
      if (it.use.b) r.uses.get(k).idx.add(it.use.i);
    }
  }
  for (const j of joined) { const f = F(j.fab); f.joined.push(j); f.sources.add(j.src); }

  const fabrics = [];
  for (const f of byFab.values()) {
    const fmt = fabricFormat(f.fab), wof = fmt.yardage ? fmt.width : doc.cutting.wof;   // yardage width for this fabric
    const recs = [...f.recipes.values()].map(r => ({ ...r, units: Math.ceil(r.pieces / r.recipe.yield - 1e-9), speedUnits: Math.ceil((r.speed || 0) / r.recipe.yield - 1e-9) }));
    // rotary strips grouped by strip width
    const groupsW = new Map();
    for (const r of recs.filter(r => r.recipe.method === 'strip')) {
      const k = r.recipe.w;
      if (!groupsW.has(k)) groupsW.set(k, []);
      groupsW.get(k).push(r);
    }
    const stripGroups = [...groupsW.entries()].sort((a, b) => b[0] - a[0]).map(([w, rs]) => {
      const units = rs.flatMap(r => Array.from({ length: r.units }, () => ({ len: r.recipe.sub, r })));
      return { w, recipes: rs, units, strips: [], partials: [], count: 0, oversize: rs.some(r => r.recipe.oversize) };
    });
    const angled = recs.filter(r => r.recipe.method === 'angled' || r.recipe.method === 'trap').map(r => {
      const per = r.recipe.method === 'trap' ? trapPerStrip(r.recipe, wof) : Math.max(1, Math.floor((wof - r.recipe.trim) / r.recipe.step));
      return { ...r, perStrip: per, count: Math.ceil(r.units / per) };
    });
    const tri60 = recs.filter(r => r.recipe.method === 'tri60').map(r => {
      const per = Math.max(1, Math.floor((wof - r.recipe.first + r.recipe.step) / r.recipe.step));
      return { ...r, perStrip: per, count: Math.ceil(r.units / per) };
    });
    const joinedPlans = f.joined.map(j => {
      const total = sum(j.lengths);
      return { ...j, total, count: joinedStripCount(total, j.w, j.join, wof) };
    });
    const templates = recs.filter(r => r.recipe.method === 'template');
    // cut from your stash pieces of this fabric first (in the order listed), the rest from yardage
    const dir = !!fabricById(f.fab).directional;
    const d = cutDemand({ stripGroups, angled, tri60, joined: joinedPlans, templates });
    const owned = fabricById(f.fab).skipStash ? [] : doc.stash.filter(x => !x.backing && resolveFab(x.fabric) === f.fab);
    const names = stashNames(owned);
    const layouts = owned.map((piece, i) => {
      const W = Math.max(piece.w, piece.h), H = Math.min(piece.w, piece.h), before = demandPieces(d), work = demandWork(d);
      const L = layoutBin(d, W, H, dir);
      return { kind: 'stash', stash: true, piece, name: names[i], W, H, L, pieces: before - demandPieces(d), used: work - demandWork(d) > 1e-9 };
    });
    // precut / fixed-size pieces: as many as it takes; cuts too big for them go on to yardage
    let buyPieces = 0, yardFor = '';
    if (!fmt.yardage) {
      // long joined strips (binding, borders) come from yardage, not dozens of short precut strips
      const held = d.joined; d.joined = [];
      const start = layouts.length;
      while (demandWork(d) > 1e-9 && buyPieces < 400) {
        const before = demandPieces(d), work = demandWork(d), L = layoutBin(d, fmt.W, fmt.H, dir);
        if (work - demandWork(d) < 1e-9) break;
        buyPieces++;
        layouts.push({ kind: 'precut', name: `${fmt.name} ${buyPieces}`, W: fmt.W, H: fmt.H, L, pieces: before - demandPieces(d), used: true });
      }
      if (buyPieces === 1) layouts[start].name = fmt.name;
      d.joined = held;
      if (!demandPieces({ ...d, joined: [] }) && held.some(j => j.left > 1e-6)) {
        const kinds = uniq(held.filter(j => j.left > 1e-6).map(j => j.ref.binding ? 'binding' : 'borders'));
        yardFor = `for the ${kinds.join(' and ')}`;
      }
    }
    const yardPieces = demandPieces(d);
    const yard = layoutBin(d, wof, Infinity, dir);
    layouts.push({ kind: 'yardage', stash: false, name: 'yardage', W: wof, H: yard.H, L: yard, pieces: yardPieces, fallback: !fmt.yardage });
    for (const g of stripGroups) { const res = yard.groups.get(g); g.strips = res.strips; g.partials = res.partials; g.count = res.strips.length; }
    for (const a of [...angled, ...tri60]) a.count = yard.runs.get(a)?.count || 0;
    for (const j of joinedPlans) j.count = yard.joinedCount.get(j) || 0;
    const lengthIn = yard.H;
    const pieces = sum(recs, r => r.pieces) + joinedPlans.length;
    const withExtra = lengthIn * (1 + (doc.cutting.extra || 0) / 100);
    fabrics.push({
      fab: f.fab, sources: [...f.sources], stripGroups, angled, tri60, joined: joinedPlans, templates, sheet: yard, layouts,
      stashOwned: owned.length, format: fmt, buyPieces, yardFor, lengthIn, buyIn: lengthIn > 1e-6 ? roundYardIn(withExtra, doc.cutting.roundTo) : 0, pieces, recipes: recs,
    });
  }
  fabrics.sort((a, b) => fabricIndex(a.fab) - fabricIndex(b.fab));
  for (const f of fabrics) f.fq = f.format.yardage && f.lengthIn > 0 && f.lengthIn <= 18 ? stashPlan(f, [{ w: 20, h: 17.5 }]).ok : false;

  // backing (see backing.js), batting
  const backing = computeBacking(Q);
  const batting = { w: backing.w, h: backing.h };
  const problems = [];
  for (const f of fabrics) for (const g of f.stripGroups) if (g.oversize) problems.push(`${fabricLabel(f.fab)}: a piece is longer than your fabric is wide. Piece it from two cuts or use wider fabric.`);
  return { fabrics, backing, batting, quilt: { w: Q.W, h: Q.H }, totalPieces: sum(fabrics, f => f.pieces), problems };
}

/* ---------- stash / fat-quarter fitting ---------- */
// Every individual cut as a rectangle (approximate for angled/joined), for packing onto owned pieces.
/* ---------- laying the cuts out on the fabric ----------
   Steps are cut in order down the length of a piece of fabric (the yardage you buy, or a piece
   from your stash). Full-width strips come first in each step; what's left of every strip
   becomes free space that later steps use before any new fabric: narrower strips are cut as
   partial strips from it, and template pieces (hexagons nested honeycomb-style) are placed in
   it. Positions are in inches on the fabric. */
/* ---------- trapezoids on a strip ----------
   The cut outline turned so its parallel sides run along the strip, long edge at the bottom:
   t0..t1 is the short (top) edge and b0..b1 the long (bottom) one, h the strip-direction height.
   The short edge needn't sit over the long one: when both slanted ends lean the same way it sits
   partly or wholly past it (skew). Turning every other piece end-for-end nests any trapezoid:
   each shared cut is one slanted end of both neighbours. */
function trapShape(pts, ia, sa) {
  const a = pts[ia], b = pts[(ia + 1) % pts.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const c = Math.cos(-ang), s = Math.sin(-ang);
  let q = pts.map(([x, y]) => [(x - a[0]) * c - (y - a[1]) * s, (x - a[0]) * s + (y - a[1]) * c]);
  // the long edge is now along y = 0; turn half round if the rest lies below it, keeping the hand
  if (sum(q, p => p[1]) > 0) q = q.map(([x, y]) => [-x, -y]);
  const top = Math.min(...q.map(p => p[1]));
  q = q.map(([x, y]) => [x, y - top]);
  const H = Math.max(...q.map(p => p[1])), T = q.filter(p => p[1] < H / 2).map(p => p[0]), B = q.filter(p => p[1] >= H / 2).map(p => p[0]);
  let t0 = Math.min(...T), t1 = Math.max(...T), b0 = Math.min(...B), b1 = Math.max(...B);
  // the cut outline: every edge moved out by the seam allowance, corners where the lines meet
  const leg = (xt, xb, side) => {
    const dx = xb - xt, len = Math.hypot(dx, H), nx = side * H / len, ny = -side * dx / len;
    const at = y => xt + nx * sa + (y - ny * sa) * dx / H;
    return [at(-sa), at(H + sa)];
  };
  [t0, b0] = leg(t0, b0, -1); [t1, b1] = leg(t1, b1, 1);
  const x0 = Math.min(t0, b0);
  t0 -= x0; t1 -= x0; b0 -= x0; b1 -= x0;
  return { t0, t1, b0, b1, h: H + 2 * sa, skew: t0 < b0 - 1e-3 || t1 > b1 + 1e-3 };
}
// the pieces along one strip, in strip units (x along the strip from 0, y across it). Alternating
// can start with the piece either way up; whichever needs less strip is used.
function trapPieces(r, n) {
  const { t0, t1, b0, b1, h } = r.shape, P0 = [[t0, 0], [t1, 0], [b1, h], [b0, h]], S = Math.max(t1 - t0, b1 - b0);
  if (!r.alternate) return Array.from({ length: n }, (_, i) => P0.map(([x, y]) => [x + i * S, y]));
  // corners in order top-left, top-right, bottom-right, bottom-left; turning end-for-end keeps that order
  const turn = P => [P[2], P[3], P[0], P[1]].map(([x, y]) => [-x, h - y]), shift = (P, dx) => P.map(([x, y]) => [x + dx, y]);
  const run = A => {
    // the second piece is the first turned end-for-end, its left cut on the first one's right cut;
    // the third is the first again, its left cut on the second one's right cut
    const R = turn(A), B = shift(R, A[1][0] - R[0][0]), T = B[1][0] - A[0][0];
    const list = Array.from({ length: n }, (_, i) => shift(i % 2 ? B : A, Math.floor(i / 2) * T));
    const x0 = Math.min(...list.flat().map(p => p[0]));
    return list.map(P => P.map(([x, y]) => [x - x0, y]));
  };
  const a = run(P0), b = run(turn(P0)), span = L => Math.max(...L.flat().map(p => p[0]));
  return span(b) < span(a) - 1e-6 ? b : a;
}
const trapSpan = (r, n) => r.shape ? Math.max(...trapPieces(r, n).flat().map(p => p[0])) : n * Math.max(r.a, r.b);
function trapPerStrip(r, len) {
  let n = 1;
  while (n < 400 && trapSpan(r, n + 1) <= len + 1e-6) n++;
  return n;
}

const LEFTOVER_MIN = 1.5;   // smaller scraps aren't worth reusing

// What a fabric needs cut, as lists the layout consumes (so a piece of stash can take some
// and the rest can go on to the next piece).
function cutDemand(f) {
  return {
    groups: f.stripGroups.map(g => ({ ref: g, w: g.w, units: g.units.slice() })),
    runs: [...f.angled, ...f.tri60].map(a => ({ ref: a, recipe: a.recipe, left: a.units })),
    joined: f.joined.map(j => ({ ref: j, w: j.w, left: j.total, join: j.join })),
    items: f.templates.filter(r => !r.recipe.hexSide).flatMap(r => Array.from({ length: r.units }, () => ({ w: r.recipe.w, h: r.recipe.h, r }))),
    hexes: f.templates.filter(r => r.recipe.hexSide).map(r => ({ r, left: r.units })),
  };
}
// Pieces still to cut (units × what each unit makes; joined strips count once each).
function demandPieces(d) {
  return sum(d.groups, g => sum(g.units, u => u.r.recipe.yield || 1)) + sum(d.runs, a => a.left)
    + d.joined.filter(j => j.left > 1e-6).length + d.items.length + sum(d.hexes, h => h.left);
}

// Progress measure: pieces still to cut, plus a little for every inch of joined strip still to cut
// (so a piece that only takes some binding strips still counts as used).
const demandWork = d => demandPieces(d) + sum(d.joined, j => Math.max(0, j.left)) / 1000;

// Lay what's left of `d` onto a W-wide piece of fabric at most Hmax long, using it up as it goes.
function layoutBin(d, W, Hmax, directional) {
  const bands = [], partials = [], tplPlaced = [], groups = new Map(), runs = new Map(), joinedCount = new Map();
  let free = [], y = 0;
  const keep = fr => fr.w >= LEFTOVER_MIN - 1e-6 && fr.h >= LEFTOVER_MIN - 1e-6;
  const addFree = fr => { if (keep(fr)) free.push(fr); };
  const room = h => y + h <= Hmax + 1e-6;
  // rotary strips, widest first: partial strips from leftovers, then full strips
  for (const g of d.groups) {
    const res = { strips: [], partials: [] };
    groups.set(g.ref, res);
    let units = g.units.slice().sort((a, b) => b.len - a.len);
    for (const fr of free.slice().sort((a, b) => a.h - b.h || b.w - a.w)) {
      while (units.length && fr.h >= g.w - 1e-6) {
        let used = 0;
        const cuts = [];
        units = units.filter(u => { if (used + u.len <= fr.w + 1e-6) { cuts.push({ x: fr.x + used, w: u.len, recipe: u.r.recipe }); used += u.len; return false; } return true; });
        if (!cuts.length) break;
        const ps = { x: fr.x, y: fr.y, w: used, h: g.w, cuts, from: fr.from, group: g.ref };
        res.partials.push(ps); partials.push(ps);
        if (fr.w - used >= LEFTOVER_MIN) free.push({ x: fr.x + used, y: fr.y, w: fr.w - used, h: g.w, from: fr.from });
        fr.y += g.w; fr.h -= g.w;
      }
    }
    free = free.filter(keep);
    for (const st of packStrips(Hmax === Infinity ? units : units.filter(u => u.len <= W + 1e-6), W)) {   // oversize cuts stay on the main plan (flagged there)
      if (!room(g.w)) break;
      let x = 0;
      bands.push({ y, h: g.w, kind: 'strip', ref: g.ref, cuts: st.cuts.map(c => { const o = { x, w: c.len, recipe: c.r.recipe }; x += c.len; return o; }) });
      res.strips.push(st);
      for (const c of st.cuts) units.splice(units.indexOf(c), 1);
      addFree({ x: st.used, y, w: W - st.used, h: g.w, from: g.ref });
      y += g.w;
    }
    g.units = units;
  }
  // angled and 60° strips; the end of the last strip is left over
  for (const a of d.runs) {
    const r = a.recipe;
    const per = r.method === 'tri60' ? Math.max(1, Math.floor((W - r.first + r.step) / r.step)) : r.method === 'trap' ? trapPerStrip(r, W) : Math.max(1, Math.floor((W - (r.trim || 0)) / r.step));
    let count = 0;
    while (a.left > 0 && room(r.w)) {
      const n = Math.min(a.left, per);
      a.left -= n; count++;
      bands.push({ y, h: r.w, kind: r.method, ref: a.ref, recipe: r, n });
      const used = r.method === 'tri60' ? Math.ceil(n / 2) * (r.w * 2 / Math.sqrt(3)) + r.w / Math.sqrt(3)
        : r.method === 'trap' ? trapSpan(r, n) : (r.trim || 0) + n * r.step + r.w;
      addFree({ x: Math.min(W, used), y, w: W - used, h: r.w, from: a.ref });
      y += r.w;
    }
    runs.set(a.ref, { count, perStrip: per });
  }
  // joined strips (borders, binding): pieced from strips W long; the end of the last one is left over
  for (const j of d.joined) {
    const loss = j.join === 'diagonal' ? j.w : 2 * doc.cutting.seam;
    let count = 0;
    while (j.left > 1e-6 && room(j.w)) {
      bands.push({ y, h: j.w, kind: 'joined', ref: j.ref, label: j.ref.src });
      j.left -= count ? W - loss : W;
      count++;
      if (j.left <= 1e-6) addFree({ x: W + j.left, y, w: -j.left, h: j.w, from: j.ref });
      y += j.w;
    }
    joinedCount.set(j.ref, count);
  }
  // templates: the leftovers and the rest of the fabric below the strips form one list of free
  // rectangles (overlapping maximal rectangles, MaxRects-style). Pieces go top-first, so they
  // fill leftovers before new fabric, and nest beside each other as well as below.
  const tplY = y;
  if (Hmax - y > 0.5) free.push({ x: 0, y, w: W, h: Hmax === Infinity ? 100000 : Hmax - y, from: null });
  const occupy = b => { free = splitFree(free, b).filter(keep); };
  const topFirst = () => free.slice().sort((a, b) => a.y - b.y || b.w * b.h - a.w * a.h);
  let todo = d.items.map(it => ({ ...it, rot: !directional }));
  for (const fr of topFirst()) {
    if (!todo.length) break;
    if (!free.includes(fr)) continue;
    const pk = packRects(todo, fr.w, fr.h);
    if (!pk.placed.length) continue;
    for (const p of pk.placed) {
      tplPlaced.push({ ...p, x: p.x + fr.x, y: p.y + fr.y, from: fr.from });
      occupy({ x: p.x + fr.x, y: p.y + fr.y, w: p.w, h: p.h });
    }
    todo = pk.unplaced;
  }
  // hexagons: fill gaps above what's already used, then honeycomb rows across the full width below
  const bottom = () => Math.max(y, ...tplPlaced.map(p => p.y + p.h));
  const placeHex = (hx, x0, y0, w, h, from) => {
    const hp = honeycombPack(hx.left, hx.r.recipe.hexSide, w, h);
    if (!hp.placed.length) return false;
    const polys = hp.placed.map(p => translatePoly(p.poly, x0, y0));
    hp.placed.forEach((p, k) => tplPlaced.push({ ...p, x: p.x + x0, y: p.y + y0, poly: polys[k], item: { r: hx.r }, from }));
    hx.left -= hp.placed.length;
    const bb = bounds(polys.flat());
    occupy({ x: bb.minX, y: bb.minY, w: bb.w, h: bb.h });
    return true;
  };
  for (const hx of d.hexes) {
    // each round, use the free area where a hexagon costs the least extra fabric length
    // (gaps and space beside other pieces cost nothing; a narrow column costs a lot)
    for (let guard = 0; hx.left && guard < 200; guard++) {
      const b = bottom();
      let best = null;
      for (const f of free) {
        const hp = honeycombPack(hx.left, hx.r.recipe.hexSide, f.w, f.h);
        if (!hp.placed.length) continue;
        const score = Math.max(0, f.y + hp.usedH - b) / hp.placed.length;
        if (!best || score < best.score - 1e-9 || (score < best.score + 1e-9 && hp.placed.length > best.n)) best = { f, score, n: hp.placed.length };
      }
      if (!best || !placeHex(hx, best.f.x, best.f.y, best.f.w, best.f.h, best.f.from)) break;
    }
  }
  d.items = todo.map(({ rot, ...it }) => it);
  const tplH = Math.max(0, ...tplPlaced.map(p => p.y + p.h)) - tplY;
  return { W, bands, partials, tplPlaced, tplY, H: Math.max(tplY, tplY + tplH), groups, runs, joinedCount };
}

// Remove box b from a list of (possibly overlapping) free rectangles, keeping the maximal pieces.
function splitFree(free, b) {
  const next = [];
  for (const f of free) {
    if (b.x >= f.x + f.w - 1e-6 || b.x + b.w <= f.x + 1e-6 || b.y >= f.y + f.h - 1e-6 || b.y + b.h <= f.y + 1e-6) { next.push(f); continue; }
    if (b.x > f.x + 1e-6) next.push({ ...f, w: b.x - f.x });
    if (b.x + b.w < f.x + f.w - 1e-6) next.push({ ...f, x: b.x + b.w, w: f.x + f.w - b.x - b.w });
    if (b.y > f.y + 1e-6) next.push({ ...f, h: b.y - f.y });
    if (b.y + b.h < f.y + f.h - 1e-6) next.push({ ...f, y: b.y + b.h, h: f.y + f.h - b.y - b.h });
  }
  return next.filter((a, i) => !next.some((c, j) => j !== i && a.x >= c.x - 1e-6 && a.y >= c.y - 1e-6 && a.x + a.w <= c.x + c.w + 1e-6 && a.y + a.h <= c.y + c.h + 1e-6 && (j < i || a.w * a.h < c.w * c.h - 1e-9)));
}

// "Uses your fat quarter and half yard" style summary of the stash pieces a fabric's plan uses.
function stashUseText(f) {
  const used = (f.layouts || []).filter(x => x.stash && x.used).map(x => `your ${x.name.toLowerCase()}`);
  return used.length ? used.length === 1 ? used[0] : `${used.slice(0, -1).join(', ')} and ${used[used.length - 1]}` : '';
}
const hasStashFor = fab => doc.stash.some(x => !x.backing && resolveFab(x.fabric) === fab);
// Buy column text: yardage still needed, or nothing when the stash covers it.
function buyText(f) {
  const parts = [];
  if (f.buyPieces) parts.push(plural2(f.buyPieces, f.format.name));
  if (f.buyIn > 0) parts.push(f.buyPieces ? `${fmtYards(f.buyIn)} ${f.yardFor || 'for the larger cuts'}` : fmtYards(f.buyIn));
  return parts.length ? parts.join(' + ') : f.stashOwned ? 'nothing (stash)' : fmtYards(0);
}

// Needed column: the yardage cut, or the precut pieces (plus any yardage for cuts too big for them).
function neededText(f) {
  if (f.format.yardage) return fmtYards(f.lengthIn);
  const parts = [f.buyPieces ? plural2(f.buyPieces, f.format.name) : '', f.lengthIn > 1e-6 ? fmtYards(f.lengthIn) : ''].filter(Boolean);
  return parts.join(' + ') || '—';
}

// <option>s for a "comes as" setting; value is 'default' | 'yardage' | precut key | 'piece'.
function formatOptionsHtml(cur, withDefault) {
  const k = !cur ? 'default' : cur.kind === 'precut' ? cur.key : cur.kind;
  const def = defaultFormat();
  return [
    ...(withDefault ? [['default', `Default (${def.yardage ? `yardage, ${fmtLen(def.width)}` : def.name.toLowerCase() + 's'})`]] : []),
    ['yardage', withDefault ? 'Yardage, its own width' : 'Yardage'],
    ...PRECUTS.map(pc => [pc.key, `${pc.name}s (${fmtSize(pc.w, pc.h)})`]),
    ['piece', 'Pieces of a size I choose'],
  ].map(([v, l]) => `<option value="${v}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
}
// A "comes as" choice → the stored setting (keeping any width/size already entered).
function formatFromChoice(v, prev) {
  if (v === 'default') return null;
  if (v === 'yardage') return { kind: 'yardage', width: prev?.width || doc.cutting.wof };
  if (v === 'piece') return { kind: 'piece', w: prev?.w || 18, h: prev?.h || 22 };
  return { kind: 'precut', key: v };
}

// How many W×H pieces a fabric's cuts need (ignoring stash), or null if some cut doesn't fit one.
function piecesNeeded(f, W, H) {
  const d = cutDemand(f), dir = !!fabricById(f.fab).directional;
  let n = 0;
  while (demandWork(d) > 1e-9 && n < 400) {
    const before = demandWork(d);
    layoutBin(d, Math.max(W, H), Math.min(W, H), dir);
    if (before - demandWork(d) < 1e-9) return null;
    n++;
  }
  return n;
}
// Other ways to buy a fabric that hold all its cuts: "or 2 fat quarters · 4 fat eighths".
function formatOptions(f) {
  if (!f.format.yardage) return [];
  const out = [];
  for (const pc of PRECUTS.filter(x => ['fq', 'f8', 'layer', 'charm'].includes(x.key))) {
    const [w, h] = pc.use || [pc.w, pc.h], n = piecesNeeded(f, w, h);
    if (n && n <= 12) out.push({ key: pc.key, n, label: `${n} ${pc.name.toLowerCase()}${n === 1 ? '' : 's'}` });
  }
  return out.slice(0, 3);
}
const plural2 = (n, name) => `${n} ${name.toLowerCase()}${n === 1 ? '' : 's'}`;
// "5 fat quarters, 10 charm squares" for everything bought as pieces (same kinds added up).
function precutSummary(fabrics) {
  const by = new Map();
  for (const f of fabrics) if (f.buyPieces) by.set(f.format.name, (by.get(f.format.name) || 0) + f.buyPieces);
  return [...by].map(([n, c]) => plural2(c, n)).join(', ');
}
// "8 pieces", or "strips" for a piece that only gives strips for joining (binding, borders).
const piecesText = n => n ? plural(n, 'piece') : 'strips for joining';

// Names for stash pieces on the plan: "Fat quarter", or "Fat quarter 1", "Fat quarter 2" when repeated.
function stashNames(pieces) {
  const label = p => (p.label || 'Piece').trim() || 'Piece';
  const seen = new Map();
  return pieces.map(p => {
    const l = label(p), n = pieces.filter(q => label(q) === l).length;
    seen.set(l, (seen.get(l) || 0) + 1);
    return n > 1 ? `${l} ${seen.get(l)}` : l;
  });
}

// The stash check: lay a fabric's cuts onto the pieces you own, one after another, with the
// same layout as the cutting maps, then work out what you'd still need to buy.
function stashPlan(f, pieces) {
  const d = cutDemand(f), dir = !!fabricById(f.fab).directional, total = demandPieces(d);
  const bins = pieces.map(p => {
    const W = Math.max(p.w, p.h), H = Math.min(p.w, p.h), before = demandPieces(d);
    const L = layoutBin(d, W, H, dir);
    return { piece: p, W, H, L, pieces: before - demandPieces(d) };
  });
  const left = demandPieces(d);
  let buyIn = 0;
  if (left) buyIn = roundYardIn(layoutBin(d, fabricRun(f.fab), Infinity, dir).H * (1 + (doc.cutting.extra || 0) / 100), doc.cutting.roundTo);
  return { bins, ok: !left, total, covered: total - left, buyIn };
}

/* ---------- the cutting map: where every cut sits on the actual piece of fabric ----------
   Bands run across the full width of fabric, stacked down its length in cutting order.
   Each cut carries the instruction step number it belongs to. */
function fabricSheet(f) { return sheetFromLayout(f, f.sheet, doc.cutting.wof, f.sheet.H, f.buyIn); }
// Every map for a fabric: each stash piece it uses, then the yardage (if any is still needed).
function fabricSheets(f) {
  return f.layouts.filter(s => s.kind !== 'yardage' ? s.used : s.L.H > 1e-6 || f.layouts.length === 1).map(s => ({
    ...sheetFromLayout(f, s.L, s.W, s.kind !== 'yardage' ? s.H : s.L.H, s.kind !== 'yardage' ? 0 : f.buyIn),
    src: s, title: s.kind === 'stash' ? `Your ${s.name.toLowerCase()}, ${fmtSize(s.W, s.H)}` : s.kind === 'precut' ? `${s.name}, ${fmtSize(s.W, s.H)}` : null,
  }));
}
// A drawable map for a layout (the yardage, or one stash piece), with each cut carrying the
// number of the cutting step it belongs to.
function sheetFromLayout(f, L, W, H, buyIn) {
  const rows = fabricInstructions(f);
  const stepOf = ref => rows.findIndex(r => r.group === ref || r.a === ref || r.j === ref || r.r === ref) + 1;
  const bands = L.bands.map(b => ({ ...b, step: stepOf(b.ref) }));
  const partials = L.partials.map(p => ({ ...p, step: stepOf(p.group) }));
  const placed = L.tplPlaced.map(p => ({ ...p, step: stepOf(p.item.r) }));
  const tpl = placed.length ? { y: L.tplY, h: L.H - L.tplY, placed, abs: true } : null;
  return { W, H, bands, partials, tpl, rows, buyIn };
}

/* ---------- human-readable cutting instructions ---------- */
function cutVerb(recipe, units, speedUnits = 0) {
  const yieldText = n => `${n} ${recipe.makes}${n === 1 ? '' : 's'}`;
  // squares for two-at-a-time HSTs, no-waste geese and two-fabric hourglasses are sewn whole first
  if (speedUnits && ['diag', 'diagR', 'diagL', 'cross'].includes(recipe.cut)) {
    const keep = Math.min(units, speedUnits);
    if (keep === units) return `sew them before cutting apart (see the block steps)`;
    const rest = units - keep, per = recipe.cut === 'cross' ? 4 : 2;
    return `keep ${keep} whole to sew first (see the block steps); cut the other ${rest} ${recipe.cut === 'cross' ? 'twice on the diagonal' : 'once on the diagonal'} → ${yieldText(rest * per)}`;
  }
  switch (recipe.cut) {
    case 'diag': return `cut once on the diagonal → ${yieldText(units * 2)}`;
    case 'diagR': case 'diagL': return `cut each on the diagonal (${recipe.cut === 'diagR' ? 'top-left to bottom-right' : 'top-right to bottom-left'}) → ${yieldText(units * 2)}`;
    case 'cross': return `cut twice on the diagonal (an X) → ${yieldText(units * 4)}`;
    case 'stitch': return `for stitch-and-flip corners`;
    default: return '';
  }
}
function fabricInstructions(f) {
  const rows = [];
  const stepOf = ref => rows.findIndex(r => r.group === ref || r.a === ref || r.j === ref || r.r === ref) + 1;
  // with stash pieces, each step lists what to cut from each piece
  const srcs = (f.layouts || []).filter(x => x.kind !== 'yardage' ? x.used : true);
  const multi = srcs.some(x => x.kind !== 'yardage');
  const fromWhat = x => x.kind === 'stash' ? `From your ${x.name.toLowerCase()}` : x.kind === 'precut' ? `From ${x.name.toLowerCase()}` : 'From yardage';
  const length = x => x.kind !== 'yardage' ? `${fmtLen(x.W, 'up')} long` : 'WOF';
  // runs of identical precut pieces read as one line: "From charm squares 1–16: 1 strip … each"
  const bySource = (count, w) => {
    const list = srcs.map(x => ({ x, n: count(x) })).filter(o => o.n), out = [];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      let j = i;
      while (o.x.kind === 'precut' && list[j + 1]?.x.kind === 'precut' && list[j + 1].n === o.n && list[j + 1].x.W === o.x.W) j++;
      if (j > i) {
        const num = x => x.name.match(/(\d+)$/)?.[1];
        out.push(`From ${o.x.name.replace(/ \d+$/, '').toLowerCase()}s ${num(o.x)}–${num(list[j].x)}: ${plural(o.n, 'strip')} ${fmtLen(w, 'up')} × ${length(o.x)} each.`);
        i = j;
      } else out.push(`${fromWhat(o.x)}: ${plural(o.n, 'strip')} ${fmtLen(w, 'up')} × ${length(o.x)}.`);
    }
    return out;
  };
  // "from the leftover of step 2: …" lines, grouped by the step they come from
  const fromLeftovers = (list, what) => {
    const by = new Map();
    for (const x of list) { const k = stepOf(x.from); by.set(k, [...(by.get(k) || []), x]); }
    return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([k, xs]) => `From the leftover of step ${k}: ${what(xs)}`);
  };
  for (const g of f.stripGroups) {
    const parts = g.recipes.map(r => {
      const v = cutVerb(r.recipe, r.units, r.speedUnits);
      return `${r.units} × ${r.recipe.unitLabel}${v ? `, ${v}` : ''}`;
    });
    const leftoverLines = list => fromLeftovers(list, xs => `cut ${xs.map(x => `a ${fmtLen(g.w, 'up')} × ${fmtLen(x.w, 'up')} ${x.w < g.w * 1.5 ? 'piece' : 'strip'}`).join(', ')}.`);
    let head;
    if (multi) {
      const allPartials = srcs.flatMap(x => x.L.groups.get(g)?.partials || []);
      const total = sum(srcs, x => x.L.groups.get(g)?.strips.length || 0) + allPartials.length;
      parts.unshift(...bySource(x => x.L.groups.get(g)?.strips.length || 0, g.w), ...leftoverLines(allPartials));
      head = `Cut ${plural(total, 'strip')} ${fmtLen(g.w, 'up')} wide`;
    } else {
      const np = g.partials.length;
      if (np) parts.unshift(...leftoverLines(g.partials));
      head = g.count && np ? `Cut ${plural(g.count, 'strip')} ${fmtLen(g.w, 'up')} × WOF, plus ${plural(np, 'shorter strip')} from leftovers`
        : g.count ? `Cut ${plural(g.count, 'strip')} ${fmtLen(g.w, 'up')} × WOF` : `Cut ${plural(np, 'strip')} ${fmtLen(g.w, 'up')} wide from leftovers`;
    }
    rows.push({ kind: 'strip', head, parts, group: g });
  }
  // strips cut whole across a piece (angled, 60°, joined): totals and per-piece counts
  const runHead = (a, w, what) => {
    if (!multi) return { head: `Cut ${plural(a.count, 'strip')} ${fmtLen(w, 'up')} × WOF${what}`, lines: [] };
    const n = x => (a.recipe ? x.L.runs.get(a)?.count : x.L.joinedCount.get(a)) || 0;
    return { head: `Cut ${plural(sum(srcs, n), 'strip')} ${fmtLen(w, 'up')} wide${what}`, lines: bySource(n, w) };
  };
  for (const a of f.angled) {
    if (a.recipe.method === 'trap') {
      const r = a.recipe, rh = runHead(a, r.w, '');
      const ends = r.shape?.skew ? `both ends slant the same way (${uniq(r.angles).join('° and ')}°), so the short edge sits off to one side of the long one`
        : `ends at ${uniq(r.angles).join('° and ')}°`;
      rows.push({ kind: 'angled', head: rh.head,
        parts: [...rh.lines, `Cut ${a.units} trapezoids: long edge ${fmtLen(r.a, 'up')}, short edge ${fmtLen(r.b, 'up')}, ${ends}.${r.alternate ? ' Turn the ruler end-for-end after each cut so the angled ends nest' : ''} (${a.perStrip} per strip)${r.hand ? `. Cut them right side up, as in the map: ${r.shape?.skew ? 'the slant' : 'the shape'} isn't the same flipped over` : ''}.`], a });
      continue;
    }
    const lean = a.recipe.hand ? (a.recipe.hand === 'R' ? ', leaning right' : ', leaning left') : '';
    const rh = runHead(a, a.recipe.w, '');
    rows.push({ kind: 'angled', head: rh.head,
      parts: [...rh.lines, `Trim one end at ${a.recipe.angle}°${lean}, then cut ${a.units} × ${a.recipe.makes}s every ${fmtLen(a.recipe.step, 'up')} along the strip (${a.perStrip} per strip)`], a });
  }
  for (const a of f.tri60) {
    const rh = runHead(a, a.recipe.w, '');
    rows.push({ kind: 'tri60', head: rh.head,
      parts: [...rh.lines, `With a 60° triangle ruler, cut ${a.units} triangles, rotating the ruler each cut (${a.perStrip} per strip)`], a });
  }
  for (const j of f.joined) {
    const desc = j.binding
      ? `Join end to end with diagonal seams, press in half lengthwise → ${fmtLen(j.total)} of binding`
      : `Join end to end, then cut ${j.lengths.length} lengths: ${j.lengths.map(l => fmtLen(l, 'up')).join(', ')}`;
    const rh = runHead(j, j.w, ` for ${j.src.toLowerCase()}`);
    rows.push({ kind: 'joined', head: rh.head, parts: [...rh.lines, desc], j });
  }
  for (const r of f.templates) {
    const inLeft = (f.sheet?.tplPlaced || []).filter(p => p.item.r === r && p.from);
    const perSrc = multi ? srcs.map(x => ({ x, n: x.L.tplPlaced.filter(p => p.item.r === r).length })).filter(o => o.n).map(o => `${fromWhat(o.x)}: ${o.n}.`) : [];
    rows.push({ kind: 'template', head: `Cut ${r.units} × ${r.recipe.makes.toLowerCase()} from template`, parts: [...perSrc,
      ...(inLeft.length ? [(() => {
        const n = inLeft.length, st = uniq(inLeft.map(p => stepOf(p.from))).sort((a, b) => a - b);
        return `${n === r.units ? (n === 1 ? 'It fits' : 'All of them fit') : `${n} of them ${n === 1 ? 'fits' : 'fit'}`} in the leftover${st.length > 1 ? 's' : ''} from step${st.length > 1 ? 's' : ''} ${st.join(', ')}. See the map.`;
      })()] : []),r.recipe.applique ? (doc.cutting.appMethod === 'fusible' ? 'Fusible appliqué: trace the reversed template onto fusible web, fuse it to the wrong side of the fabric and cut on the line.' : 'Appliqué piece: cut on the dashed line, which includes a 3/16" turn-under.') : 'Trace the template and cut on the dashed line, which includes the seam allowance.'], r });
  }
  // a fabric bought as precuts (or set-size pieces): steps cut wholly from the yardage it falls back
  // to are marked and listed last, so the plan reads "from the jelly rolls…, then from yardage…"
  if (!f.format.yardage) {
    for (const row of rows) row.fallback = !rowUsesPieces(f, row);
    if (rows.some(r => r.fallback) && rows.some(r => !r.fallback)) rows.sort((a, b) => a.fallback - b.fallback);
  }
  return rows;
}
// Does a cutting step take anything from the stash or precut pieces (rather than only yardage)?
function rowUsesPieces(f, row) {
  return (f.layouts || []).filter(x => x.kind !== 'yardage').some(x => {
    const L = x.L;
    if (row.group) return (L.groups.get(row.group)?.strips.length || 0) + (L.groups.get(row.group)?.partials.length || 0) > 0;
    if (row.a) return (L.runs.get(row.a)?.count || 0) > 0;
    if (row.j) return (L.joinedCount.get(row.j) || 0) > 0;
    if (row.r) return L.tplPlaced.some(p => p.item.r === row.r);
    return false;
  });
}
// The cut size of a step's pieces (for "largest piece" notes).
const recipeSize = r => [r.w, r.sub ?? r.h ?? r.first ?? r.step ?? r.w];
// Why a precut fabric also needs yardage: how many pieces don't fit, the largest one, and whether
// binding or borders (always cut from yardage) are part of it. Null when nothing falls back.
function fallbackInfo(f) {
  if (f.format.yardage) return null;
  const yard = (f.layouts || []).find(l => l.kind === 'yardage');
  if (!yard || yard.L.H <= 1e-6) return null;
  const rows = fabricInstructions(f).filter(r => r.fallback);
  const recs = rows.flatMap(r => r.group?.recipes || (r.a ? [r.a] : r.r ? [r.r] : []));
  const sizes = recs.map(r => recipeSize(r.recipe)).sort((a, b) => b[0] * b[1] - a[0] * a[1]);
  const strips = uniq(rows.filter(r => r.j).map(r => r.j.binding ? 'binding' : 'borders'));
  return { pieces: sum(recs, r => r.pieces), largest: sizes[0] || null, strips, width: doc.cutting.wof, name: f.format.name.toLowerCase(), none: !f.buyPieces };
}
// "6 pieces too big for a jelly roll strip (largest 12½" × 12½"), and the binding"
function fallbackReason(fb, long) {
  if (fb.none) return `nothing fits a ${fb.name}${long && fb.largest ? ` (largest piece ${fmtSize(fb.largest[0], fb.largest[1], 'up')})` : ''}`;
  const parts = [];
  if (fb.pieces) parts.push(`${plural(fb.pieces, 'piece')} too big for a ${fb.name}${long && fb.largest ? ` (largest ${fmtSize(fb.largest[0], fb.largest[1], 'up')})` : ''}`);
  if (fb.strips.length) parts.push(`the ${fb.strips.join(' and ')}`);
  return parts.join(', and ');
}
