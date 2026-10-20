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

/* ---------- recipes ---------- */
function recipeFor(cls, sa, opts = {}) {
  const wof = doc.cutting.wof;
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
      const t = inflate([[0, 0], [cls.a, 0], [0, cls.b]], sa), bb = bounds(t);
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
    default: {
      // packing uses the tightest rotation; the printed template keeps the in-quilt
      // orientation so its grain arrow (horizontal) matches the block's straight grain
      const cutOutline = inflate(cls.pts, sa);
      const mar = minAreaRect(cutOutline);
      const bb = bounds(cls.pts);
      const app = opts.applique;
      return { key: `${app ? 'app' : 'tpl'}:${outlineSignature(cls.pts)}`, method: 'template', applique: app, curved: cls.curved,
        w: mar.w, h: mar.h, outline: translatePoly(cls.pts, -bb.x, -bb.y), cutBox: mar, yield: 1, makes: shapeName(cls), holed: cls.shape === 'holed',
        // regular hexagons nest in a honeycomb; offsetting by sa grows the side by 2·sa/√3
        hexSide: cls.shape === 'hex' && !app ? cls.side + 2 * sa / Math.sqrt(3) : null };
    }
  }
}
function recipeStitchMain(rect, sa) {
  return recipeFor({ shape: 'rect', w: rect.w, h: rect.h }, sa);
}
function recipeStitchCorner(leg, sa) {
  const q = ceilEighth(leg + 2 * sa);
  return { key: `sf:${q}`, method: 'strip', w: q, sub: q, yield: 1, cut: 'stitch', unitName: 'square', unitLabel: `${fmtLen(q, 'up')} square`, makes: 'stitch-and-flip corner' };
}

/* ---------- collect every piece in the quilt ---------- */
function collectCutItems(Q) {
  const sa = doc.cutting.seam;
  const items = [];   // { fab, recipe, count, src }
  const add = (fab, recipe, count, src) => items.push({ fab: resolveFab(fab), recipe, count, src });
  const isDir = fab => !!fabricById(fab).directional;

  // blocks: group identical placements
  const groups = new Map();
  for (const c of Q.cells) {
    if (c.b) { const k = c.b + (c.flip ? '|f' : ''); groups.set(k, (groups.get(k) || 0) + 1); }
    else if (c.fab) add(c.fab, recipeFor({ shape: 'rect', w: c.size, h: c.size }, sa, { directional: isDir(c.fab) }), 1, 'Plain squares');
  }
  for (const [k, n] of groups) {
    const [bid, flip] = k.split('|');
    const block = doc.blocks[bid];
    const an = analyzeBlock(block, Q.BS);
    const name = block.name;
    const handled = new Set();
    for (const u of an.units) {
      if (u.unit.type === 'snowball') {
        handled.add(u.unit.main);
        add(u.unit.main.fab, recipeStitchMain(u.rect, sa), n, name);
        for (const t of u.unit.corners) { handled.add(t); add(t.fab, recipeStitchCorner(t.cls.leg, sa), n, name); }
      }
    }
    const all = blockPieces(block, Q.BS, Q.BS);
    for (const p of all) {
      if (handled.has(p)) continue;
      // mirrored placements only matter for pieces that have a left and right hand
      let cls = p.cls;
      if (flip && ['rtri', 'para', 'tri', 'quad', 'poly', 'curved', 'holed'].includes(cls.shape)) {
        cls = classifyPiece(mirrorPolyX(p.pts, Q.BS / 2), { curved: p.curved });
        if (p.cls.shape === 'holed') cls.shape = 'holed';
      }
      add(p.fab, recipeFor(cls, sa, { directional: isDir(p.fab), applique: p.app }), n, name);
    }
  }
  // tiles & setting triangles
  for (const t of Q.tiles) {
    // trimmed edge shapes are cut whole and trimmed after the top is sewn
    const cls = classifyPiece(t.role === 'trim' && t.full ? t.full : t.pts);
    const src = t.role === 'side-setting' || t.role === 'corner-setting' ? 'Setting triangles' : t.role === 'tile' ? 'Tiles' : 'Edge pieces';
    add(t.fab, recipeFor(cls, sa, { directional: isDir(t.fab) }), 1, src);
  }
  // sashing, cornerstones, borders — long pieces become joined strips
  const joined = new Map();
  for (const p of Q.patches) {
    const bb = bounds(p.pts);
    const long = Math.max(bb.w, bb.h), short = Math.min(bb.w, bb.h);
    const src = p.role === 'border' ? `Border ${p.ring + 1}` : p.role === 'corner' ? 'Cornerstones' : 'Sashing';
    if ((p.role === 'border' || p.role === 'sashLong') && long + 2 * sa > doc.cutting.wof) {
      const w = ceilEighth(short + 2 * sa);
      const key = `${resolveFab(p.fab)}|${w}|${src}`;
      if (!joined.has(key)) joined.set(key, { fab: resolveFab(p.fab), w, lengths: [], src, join: 'straight' });
      joined.get(key).lengths.push(ceilEighth(long + 2 * sa));
    } else {
      add(p.fab, recipeFor({ shape: 'rect', w: bb.w, h: bb.h }, sa, { directional: isDir(p.fab) }), 1, src);
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
function joinedStripCount(total, w, join) {
  const wof = doc.cutting.wof, loss = join === 'diagonal' ? w : 2 * doc.cutting.seam;
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
  return { placed, unplaced, usedH: placed.length ? Math.max(...placed.map(p => p.y + p.h)) : 0 };
}

// N cut hexagons of side s nested honeycomb-style across a WOF-wide band; picks the
// orientation (flat-top columns or pointy-top rows) that uses the least length.
function honeycombPack(N, s, wof) {
  const F = Math.sqrt(3) * s;
  const hex = (cx, cy, pointy) => Array.from({ length: 6 }, (_, k) => {
    const a = (pointy ? -90 : 0) + 60 * k;
    return [cx + s * Math.cos(a * Math.PI / 180), cy + s * Math.sin(a * Math.PI / 180)];
  });
  const opts = [];
  const nc = Math.max(1, Math.floor((wof - 2 * s) / (1.5 * s)) + 1);        // flat-top columns
  if (2 * s <= wof) {
    const placed = [];
    for (let i = 0; i < N; i++) { const c = i % nc, r = Math.floor(i / nc); placed.push([s + 1.5 * s * c, F / 2 + r * F + (c % 2 ? F / 2 : 0), false]); }
    const rows = Math.ceil(N / nc);
    opts.push({ placed, usedH: rows * F + (nc > 1 && N > 1 ? F / 2 : 0) });
  }
  const nr = Math.max(1, Math.floor((wof - F / 2) / F));                     // pointy-top rows
  if (F <= wof) {
    const placed = [];
    for (let i = 0; i < N; i++) { const r = Math.floor(i / nr), c = i % nr; placed.push([F / 2 + c * F + (r % 2 ? F / 2 : 0), s + r * 1.5 * s, true]); }
    const rows = Math.ceil(N / nr);
    opts.push({ placed, usedH: 2 * s + (rows - 1) * 1.5 * s });
  }
  const best = opts.sort((a, b) => a.usedH - b.usedH)[0] || { placed: [], usedH: 0 };
  return { usedH: best.usedH, placed: best.placed.map(([x, y, pointy]) => {
    const poly = hex(x, y, pointy), bb = bounds(poly);
    return { x: bb.x, y: bb.y, w: bb.w, h: bb.h, rot: false, poly };
  }) };
}

let _planCache = { key: null, plan: null };
function cuttingPlan(Q = buildQuilt()) {
  const key = snapshot();
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
    if (!f.recipes.has(it.recipe.key)) f.recipes.set(it.recipe.key, { recipe: it.recipe, pieces: 0, srcs: new Set() });
    const r = f.recipes.get(it.recipe.key);
    r.pieces += it.count; r.srcs.add(it.src);
  }
  for (const j of joined) { const f = F(j.fab); f.joined.push(j); f.sources.add(j.src); }

  const fabrics = [];
  for (const f of byFab.values()) {
    const recs = [...f.recipes.values()].map(r => ({ ...r, units: Math.ceil(r.pieces / r.recipe.yield - 1e-9) }));
    // rotary strips grouped by strip width
    const groupsW = new Map();
    for (const r of recs.filter(r => r.recipe.method === 'strip')) {
      const k = r.recipe.w;
      if (!groupsW.has(k)) groupsW.set(k, []);
      groupsW.get(k).push(r);
    }
    const stripGroups = [...groupsW.entries()].sort((a, b) => b[0] - a[0]).map(([w, rs]) => {
      const units = rs.flatMap(r => Array.from({ length: r.units }, () => ({ len: r.recipe.sub, r })));
      const strips = packStrips(units, wof);
      return { w, recipes: rs, strips, count: strips.length, oversize: rs.some(r => r.recipe.oversize) };
    });
    const angled = recs.filter(r => r.recipe.method === 'angled').map(r => {
      const per = Math.max(1, Math.floor((wof - r.recipe.trim) / r.recipe.step));
      return { ...r, perStrip: per, count: Math.ceil(r.units / per) };
    });
    const tri60 = recs.filter(r => r.recipe.method === 'tri60').map(r => {
      const per = Math.max(1, Math.floor((wof - r.recipe.first + r.recipe.step) / r.recipe.step));
      return { ...r, perStrip: per, count: Math.ceil(r.units / per) };
    });
    const joinedPlans = f.joined.map(j => {
      const total = sum(j.lengths);
      return { ...j, total, count: joinedStripCount(total, j.w, j.join) };
    });
    const templates = recs.filter(r => r.recipe.method === 'template');
    const tplItems = templates.filter(r => !r.recipe.hexSide).flatMap(r => Array.from({ length: r.units }, () => ({ w: r.recipe.w, h: r.recipe.h, r, rot: !fabricById(f.fab).directional })));
    const tplPack = tplItems.length ? packRects(tplItems, wof, 100000) : { placed: [], unplaced: [], usedH: 0 };
    for (const r of templates.filter(r => r.recipe.hexSide)) {
      const hp = honeycombPack(r.units, r.recipe.hexSide, wof);
      for (const p of hp.placed) tplPack.placed.push({ ...p, y: p.y + tplPack.usedH, poly: translatePoly(p.poly, 0, tplPack.usedH), item: { r } });
      tplPack.usedH += hp.usedH;
    }
    const lengthIn = sum(stripGroups, g => g.count * g.w) + sum(angled, a => a.count * a.recipe.w) + sum(tri60, a => a.count * a.recipe.w)
      + sum(joinedPlans, j => j.count * j.w) + tplPack.usedH;
    const pieces = sum(recs, r => r.pieces) + joinedPlans.length;
    const withExtra = lengthIn * (1 + (doc.cutting.extra || 0) / 100);
    fabrics.push({
      fab: f.fab, sources: [...f.sources], stripGroups, angled, tri60, joined: joinedPlans, templates, tplPack,
      lengthIn, buyIn: roundYardIn(withExtra, doc.cutting.roundTo), pieces, recipes: recs,
    });
  }
  fabrics.sort((a, b) => fabricIndex(a.fab) - fabricIndex(b.fab));
  for (const f of fabrics) f.fq = f.lengthIn > 0 && f.lengthIn <= 18 ? fitsInPieces(f, [{ w: 21, h: 18, label: 'FQ' }]).ok : false;

  // backing, batting
  const oh = doc.cutting.overhang ?? 4;
  const bw = doc.cutting.backingWidth || 42, usable = bw - 2;
  const BW = Q.W + 2 * oh, BH = Q.H + 2 * oh;
  const opt = (across, along) => {
    if (across <= usable) return { panels: 1, len: along };
    const n = Math.ceil((across - 1) / (usable - 1) - 1e-9);   // ½" seams between panels
    return { panels: n, len: n * along };
  };
  const vert = opt(BW, BH), horiz = opt(BH, BW);
  const back = vert.len <= horiz.len ? { ...vert, seams: 'vertical' } : { ...horiz, seams: 'horizontal' };
  const backing = { w: BW, h: BH, fabricWidth: bw, ...back, buyIn: roundYardIn(back.len, doc.cutting.roundTo) };
  const batting = { w: BW, h: BH };
  const problems = [];
  for (const f of fabrics) for (const g of f.stripGroups) if (g.oversize) problems.push(`${fabricLabel(f.fab)}: a piece is wider than your fabric — piece it from two cuts or use wide fabric.`);
  return { fabrics, backing, batting, quilt: { w: Q.W, h: Q.H }, totalPieces: sum(fabrics, f => f.pieces), problems };
}

/* ---------- stash / fat-quarter fitting ---------- */
// Every individual cut as a rectangle (approximate for angled/joined), for packing onto owned pieces.
function cutRectsForFabric(f) {
  const dir = !!fabricById(f.fab).directional;
  const out = [];
  for (const g of f.stripGroups) for (const r of g.recipes) for (let i = 0; i < r.units; i++) out.push({ w: r.recipe.sub, h: g.w, label: r.recipe.unitLabel, rot: !dir });
  for (const a of [...f.angled, ...f.tri60]) for (let i = 0; i < a.units; i++) out.push({ w: a.recipe.step, h: a.recipe.w, label: a.recipe.makes, rot: !dir });
  for (const j of f.joined) {
    let left = j.total;
    while (left > 0) { const len = Math.min(left, 20); out.push({ w: len + (j.join === 'diagonal' ? j.w : 0.5), h: j.w, label: `${j.src} strip`, rot: !dir }); left -= 20; }
  }
  for (const r of f.templates) for (let i = 0; i < r.units; i++) out.push({ w: r.recipe.w, h: r.recipe.h, label: r.recipe.makes, rot: !dir });
  return out;
}
function fitsInPieces(f, pieces) {
  let remaining = cutRectsForFabric(f);
  const total = remaining.length;
  const bins = [];
  for (const p of pieces) {
    if (!remaining.length) { bins.push({ piece: p, placed: [] }); continue; }
    const r = packRects(remaining, Math.max(p.w, p.h), Math.min(p.w, p.h));
    bins.push({ piece: p, placed: r.placed, w: Math.max(p.w, p.h), h: Math.min(p.w, p.h) });
    remaining = r.unplaced;
  }
  return { ok: remaining.length === 0, total, short: remaining.length, bins };
}

/* ---------- human-readable cutting instructions ---------- */
function cutVerb(recipe, units) {
  const yieldText = n => `${n} ${recipe.makes}${n === 1 ? '' : 's'}`;
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
  for (const g of f.stripGroups) {
    const parts = g.recipes.map(r => {
      const v = cutVerb(r.recipe, r.units);
      return `${r.units} × ${r.recipe.unitLabel}${v ? ` — ${v}` : ''}`;
    });
    rows.push({ kind: 'strip', head: `Cut ${plural(g.count, 'strip')} ${fmtLen(g.w, 'up')} × WOF`, parts, group: g });
  }
  for (const a of f.angled) {
    const lean = a.recipe.hand ? (a.recipe.hand === 'R' ? ', leaning right' : ', leaning left') : '';
    rows.push({ kind: 'angled', head: `Cut ${plural(a.count, 'strip')} ${fmtLen(a.recipe.w, 'up')} × WOF`,
      parts: [`Trim one end at ${a.recipe.angle}°${lean}, then cut ${a.units} × ${a.recipe.makes}s every ${fmtLen(a.recipe.step, 'up')} along the strip (${a.perStrip} per strip)`], a });
  }
  for (const a of f.tri60) {
    rows.push({ kind: 'tri60', head: `Cut ${plural(a.count, 'strip')} ${fmtLen(a.recipe.w, 'up')} × WOF`,
      parts: [`With a 60° triangle ruler, cut ${a.units} triangles, rotating the ruler each cut (${a.perStrip} per strip)`], a });
  }
  for (const j of f.joined) {
    const desc = j.binding
      ? `Join end to end with diagonal seams, press in half lengthwise → ${fmtLen(j.total)} of binding`
      : `Join end to end, then cut ${j.lengths.length} lengths: ${j.lengths.map(l => fmtLen(l, 'up')).join(', ')}`;
    rows.push({ kind: 'joined', head: `Cut ${plural(j.count, 'strip')} ${fmtLen(j.w, 'up')} × WOF for ${j.src.toLowerCase()}`, parts: [desc], j });
  }
  for (const r of f.templates) {
    rows.push({ kind: 'template', head: `Cut ${r.units} × ${r.recipe.makes.toLowerCase()} from template`, parts: [r.recipe.applique ? 'Appliqué piece: add a scant ¼" turn-under allowance as you cut.' : 'Trace the template, cut on the dashed (seam allowance) line.'], r });
  }
  return rows;
}
