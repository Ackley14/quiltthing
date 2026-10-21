/* Quilting lines (v1): generated stitch paths, like toolpaths on a 3-D printer.
   Each layer = a pattern type + spacing + rotation, applied to the whole quilt, just the
   centre, or just the borders. Lines are clipped to the chosen area and measured so the
   pattern can estimate thread. */

const QUILT_TYPES = [
  { key: 'lines', label: 'Straight lines', angle: 90, help: 'Parallel straight lines. 90° = vertical, 0° = horizontal, 45° = diagonal.' },
  { key: 'crosshatch', label: 'Crosshatch', angle: 45, help: 'Two sets of straight lines at right angles, forming squares or diamonds.' },
  { key: 'diamonds', label: 'Diamond hatch', angle: 90, help: 'Two sets of lines 60° apart, forming elongated diamonds.' },
  { key: 'wavy', label: 'Wavy lines', angle: 0, help: 'Gentle parallel waves.', wave: true },
  { key: 'zigzag', label: 'Zigzag / chevron', angle: 0, help: 'Parallel zigzags.', wave: true },
  { key: 'spiral', label: 'Spiral', angle: 0, help: 'One continuous spiral from the centre outward.' },
  { key: 'circles', label: 'Concentric circles', angle: 0, help: 'Rings around the centre ("baptist fan" look when trimmed by the edges).' },
  { key: 'squares', label: 'Concentric squares', angle: 0, help: 'Nested rectangles echoing the quilt outline.' },
  { key: 'ditch', label: 'In the ditch', angle: 0, help: 'Along every seam, and around appliqué.', noSpacing: true },
  { key: 'outline', label: 'Echo each piece', angle: 0, help: 'Follows every piece ¼" inside its seams, with more echoes inward at the spacing, and echoes around appliqué.' },
  { key: 'meander', label: 'Meander / stipple', angle: 0, help: 'One wandering line over the whole area that never crosses itself. Small spacing gives a stipple, larger a meander. Free-motion quilting.' },
  { key: 'echo', label: 'Nested squares in each block', angle: 0, help: 'Square outlines inside every block or tile, repeated inward at the spacing.' },
  { key: 'faces', label: '3D face lines', angle: 0, help: 'Lines along one edge of each shape, a different direction per face, so cubes look solid. For tessellations.' },
];
const quiltType = k => QUILT_TYPES.find(t => t.key === k) || QUILT_TYPES[0];

function newQuiltLayer(type = 'crosshatch') {
  const t = quiltType(type);
  // faces: which edge each face's lines follow (index into the shape's corners; -1 = no lines)
  return { id: uid('q'), type, spacing: type === 'faces' ? 0.75 : 2, angle: t.angle, area: 'all', amp: 0.75, wave: 4, color: '#c0392b', visible: true, echoes: 2,
    dirs: { 0: 0, 1: 0, 2: 0 }, grade: true };
}

const QUILT_AREAS = [
  ['all', 'Whole quilt'], ['center', 'Centre only'], ['borders', 'Borders only'],
  ['blocks', 'Blocks only'], ['plain', 'Plain squares & setting triangles'], ['sashing', 'Sashing'],
  ['panel', 'Inset panel only'], ['aroundPanel', 'Centre, around the inset'],
];
// Patterns built from the quilt's own shapes, made once and then trimmed to each area.
const GLOBAL_QUILT_TYPES = ['ditch', 'echo', 'outline', 'faces'];
const polyArea2 = (pts, holes = []) => ({ pts, holes, bb: bounds(pts) });
// The areas a layer covers: each is a rect to stitch inside (`outer`) minus rects to skip (`inner`).
// Patterns like spirals and circles are centred on each area, so every inset panel gets its own.
function quiltAreaRects(Q, area) {
  const outer = { x: 0, y: 0, w: Q.W, h: Q.H }, panels = Q.panels || [];
  if (area === 'center') return [{ outer: Q.inner, inner: null }];
  if (area === 'borders') return doc.layout.borders.some(b => b.width > 0) ? [{ outer, inner: Q.inner }] : [];
  if (area === 'panel') return panels.map(r => ({ outer: r, inner: null }));
  if (area === 'aroundPanel') return [{ outer: Q.inner, inner: panels }];
  // shape-based areas: each block or plain square is its own area, so spirals etc. centre on it
  const one = parts => parts.map(pts => { const P = polyArea2(pts), b = P.bb; return { outer: { x: b.x, y: b.y, w: b.w, h: b.h }, inner: null, polys: [P] }; });
  if (area === 'blocks') return one(Q.cells.filter(c => c.b).flatMap(c => c.clip || [c.pts]));
  if (area === 'plain') return one([...Q.cells.filter(c => !c.b).flatMap(c => c.clip || [c.pts]),
    ...Q.tiles.filter(t => /setting/.test(t.role || '')).map(t => t.pts)]);
  if (area === 'sashing') {
    const ps = Q.patches.filter(p => /^(sash|sashLong|corner)$/.test(p.role)).map(p => polyArea2(p.pts));
    return ps.length ? [{ outer: Q.inner, inner: null, polys: ps }] : [];
  }
  return [{ outer, inner: null }];
}
// Appliqué shapes in quilt coordinates (stitching goes around them, not across).
function appliquePolys(Q) {
  if (Q._app) return Q._app;
  const out = [];
  for (const c of Q.cells) {
    const block = c.b && doc.blocks[c.b];
    if (!block) continue;
    const map = cellPointMapper(c);
    for (const p of blockPieces(block, c.size, c.size)) if (p.app) out.push(polyArea2(p.pts.map(map), p.holes.map(h => h.map(map))));
  }
  return (Q._app = out);
}
// The parts of a polyline inside (keep = true) or outside (keep = false) a set of polygons.
function polylineVsPolys(pl, polys, keep) {
  const runs = [];
  let cur = null;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i + 1 < pl.length; i++) {
    const a = pl[i], b = pl[i + 1];
    const sx0 = Math.min(a[0], b[0]), sx1 = Math.max(a[0], b[0]), sy0 = Math.min(a[1], b[1]), sy1 = Math.max(a[1], b[1]);
    let ins = [];
    for (const P of polys) {
      if (P.bb.x > sx1 || P.bb.x + P.bb.w < sx0 || P.bb.y > sy1 || P.bb.y + P.bb.h < sy0) continue;
      for (const [t0, t1] of lineChords(P.pts, P.holes, a, b).chords) {
        const u0 = Math.max(0, t0), u1 = Math.min(1, t1);
        if (u1 - u0 > 1e-9) ins.push([u0, u1]);
      }
    }
    ins.sort((x, y) => x[0] - y[0]);
    const merged = [];
    for (const iv of ins) { const last = merged[merged.length - 1]; if (last && iv[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], iv[1]); else merged.push([...iv]); }
    let ivs = merged;
    if (!keep) { ivs = []; let t = 0; for (const [u0, u1] of merged) { if (u0 > t + 1e-9) ivs.push([t, u0]); t = Math.max(t, u1); } if (t < 1 - 1e-9) ivs.push([t, 1]); }
    for (const [t0, t1] of ivs) {
      const p = lerp(a, b, t0), q = lerp(a, b, t1);
      if (cur && t0 < 1e-9 && dist(cur[cur.length - 1], p) < 1e-6) cur.push(q);
      else { cur = [p, q]; runs.push(cur); }
    }
    if (!ivs.length || ivs[ivs.length - 1][1] < 1 - 1e-9) cur = null;
  }
  return runs;
}
// Seams inside each block (and around its appliqué), placed where the block sits in the quilt.
// The block's own outline is left out: it's already among the seams between blocks.
function blockDitchSegments(Q) {
  const segs = [];
  const near = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12;
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0, 1);
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) < 1e-6 * (1 + Math.sqrt(L2));
  };
  for (const c of Q.cells) {
    const block = c.b && doc.blocks[c.b];
    if (!block) continue;
    const S = c.size, outline = blockOutline(block, S), map = cellPointMapper(c);
    const onOutline = (a, b) => outline.some((o, i) => { const o2 = outline[(i + 1) % outline.length]; return near(a, o, o2) && near(b, o, o2); });
    for (const p of blockPieces(block, S, S)) for (const ring of [p.pts, ...p.holes]) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (!p.app && onOutline(a, b)) continue;
      const A = map(a), B = map(b);
      if (!c.clip) { segs.push([A, B]); continue; }
      // a block cut off by an edge or panel: keep only the part inside the quilt
      for (const part of c.clip) for (const [t0, t1] of lineChords(part, c.clipHoles || [], A, B).chords) {
        const u0 = Math.max(0, t0), u1 = Math.min(1, t1);
        if (u1 - u0 > 1e-6) segs.push([[A[0] + (B[0] - A[0]) * u0, A[1] + (B[1] - A[1]) * u0], [A[0] + (B[0] - A[0]) * u1, A[1] + (B[1] - A[1]) * u1]]);
      }
    }
  }
  return segs;
}

// Raw (unclipped) polylines covering a rect, rotated by `angle` about its centre.
function parallelLines(R, spacing, angle, shape = 'line', amp = 0, wave = 4) {
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
  const half = Math.hypot(R.w, R.h) / 2 + spacing + amp;
  const a = angle * Math.PI / 180;
  const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;   // line direction & normal
  const out = [];
  const n = Math.ceil(half / spacing);
  for (let k = -n; k <= n; k++) {
    const o = k * spacing;
    const pts = [];
    if (shape === 'line') {
      pts.push([cx + nx * o - ux * half, cy + ny * o - uy * half], [cx + nx * o + ux * half, cy + ny * o + uy * half]);
    } else {
      const step = shape === 'zigzag' ? wave / 2 : wave / 16;
      for (let t = -half; t <= half + 1e-9; t += step) {
        let d;
        if (shape === 'zigzag') d = (Math.round((t + half) / step) % 2 ? amp : -amp);
        else d = amp * Math.sin(2 * Math.PI * t / wave);
        pts.push([cx + nx * (o + d) + ux * t, cy + ny * (o + d) + uy * t]);
      }
    }
    out.push(pts);
  }
  return out;
}

// Stitching paths for a layer, trimmed to its areas and kept off appliqué. Cached per quilt build.
function quiltLayerPaths(Q, layer) {
  const { color, visible, ...shape } = layer, key = JSON.stringify(shape);
  const cache = Q._qpaths || (Q._qpaths = new Map());
  if (cache.has(key)) return cache.get(key);
  const areas = quiltAreaRects(Q, layer.area);
  const avoid = layer.type !== 'ditch' && layer.skipApp !== false ? appliquePolys(Q) : [];
  let out;
  if (GLOBAL_QUILT_TYPES.includes(layer.type)) {
    const raw = globalQuiltRaw(Q, layer);
    out = areas.flatMap(A => clipToArea(raw, A));
  } else out = areas.flatMap(A => clipToArea(quiltAreaRaw(Q, layer, A, avoid), A));
  if (avoid.length) out = out.flatMap(pl => polylineVsPolys(pl, avoid, false));
  out = out.filter(r => r.length > 1);
  cache.set(key, out);
  return out;
}
function clipToArea(raw, A) {
  const out = [];
  for (const pl of raw) for (const run of clipPolyline(pl, A.outer, A.inner)) {
    if (run.length < 2) continue;
    if (A.polys) out.push(...polylineVsPolys(run, A.polys, true)); else out.push(run);
  }
  return out;
}
// Patterns laid over one area (centred on it).
function quiltAreaRaw(Q, layer, A, avoid) {
  const R = A.outer, sp = Math.max(0.25, +layer.spacing || 2);
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2, maxR = Math.hypot(R.w, R.h) / 2;
  let raw = [];
  switch (layer.type) {
    case 'lines': raw = parallelLines(R, sp, layer.angle); break;
    case 'crosshatch': raw = [...parallelLines(R, sp, layer.angle), ...parallelLines(R, sp, layer.angle + 90)]; break;
    case 'diamonds': raw = [...parallelLines(R, sp, layer.angle + 30), ...parallelLines(R, sp, layer.angle - 30)]; break;
    case 'wavy': raw = parallelLines(R, sp, layer.angle, 'wave', layer.amp, layer.wave); break;
    case 'zigzag': raw = parallelLines(R, sp, layer.angle, 'zigzag', layer.amp, layer.wave); break;
    case 'spiral': {
      const pts = [];
      const turns = maxR / sp;
      for (let th = 0; th <= turns * Math.PI * 2; th += Math.PI / 36) {
        const r = sp * th / (Math.PI * 2);
        const a = th + layer.angle * Math.PI / 180;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      raw = [pts];
      break;
    }
    case 'circles':
      for (let r = sp; r <= maxR + sp; r += sp) {
        const pts = [];
        const steps = Math.max(24, Math.ceil(r * 6));
        for (let i = 0; i <= steps; i++) { const a = i / steps * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
        raw.push(pts);
      }
      break;
    case 'squares':
      for (let k = 0; ; k++) {
        const ins = sp / 2 + k * sp;
        const w = R.w - 2 * ins, h = R.h - 2 * ins;
        if (w <= 0 || h <= 0) break;
        const pts = rectPts(R.x + ins, R.y + ins, w, h);
        raw.push([...pts, pts[0]]);
      }
      break;
    case 'meander': raw = meanderRaw(A, sp, layer.seed || 1, avoid); break;
  }
  return raw;
}
// Patterns that follow the quilt's own shapes.
function globalQuiltRaw(Q, layer) {
  const sp = Math.max(0.25, +layer.spacing || 2);
  let raw = [];
  switch (layer.type) {
    case 'ditch': {
      const seen = new Set();
      const segs = [];
      const shapes = [...Q.cells.flatMap(c => c.clip || [c.pts]), ...Q.tiles.map(t => t.pts), ...Q.patches.map(p => p.pts)];
      for (const s of shapes) for (let i = 0; i < s.length; i++) {
        const a = s[i], b = s[(i + 1) % s.length];
        const k = [ptKey(a), ptKey(b)].sort().join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        // skip the quilt's outer edge — that's the binding, not a ditch
        const onEdge = p => p[0] < 1e-6 || p[1] < 1e-6 || p[0] > Q.W - 1e-6 || p[1] > Q.H - 1e-6;
        if (onEdge(a) && onEdge(b) && (Math.abs(a[0] - b[0]) < 1e-6 || Math.abs(a[1] - b[1]) < 1e-6)) continue;
        segs.push([a, b]);
      }
      for (const [a, b] of blockDitchSegments(Q)) {
        const k = [ptKey(a), ptKey(b)].sort().join('|');
        if (!seen.has(k)) { seen.add(k); segs.push([a, b]); }
      }
      raw = segs;
      break;
    }
    case 'faces': {
      // Dimensional quilting: per tile, parallel lines along one of the tile's own edges,
      // chosen per orientation (cube face). Darker fabric can get denser lines (deeper shadow).
      const dirs = layer.dirs || {};
      for (const t of Q.tiles) {
        if (t.orient == null) continue;
        const pick = dirs[t.orient] ?? 0;
        if (pick < 0) continue;
        const shape = t.full || t.pts;
        const a = shape[pick % shape.length], b = shape[(pick + 1) % shape.length];
        const L = dist(a, b); if (L < 1e-9) continue;
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
        const s2 = layer.grade !== false ? sp * (0.5 + 0.6 * hexToLab(fabricHex(t.fab))[0] / 100) : sp;
        const proj = shape.map(q => q[0] * nx + q[1] * ny), along = t.pts.map(q => q[0] * ux + q[1] * uy);
        const lo = Math.min(...proj), hi = Math.max(...proj), alo = Math.min(...along) - 1, ahi = Math.max(...along) + 1;
        const n = Math.floor((hi - lo) / s2);
        if (n < 1) continue;
        const start = lo + (hi - lo - (n - 1) * s2) / 2;          // centre the set of lines in the shape
        for (let k = 0; k < n; k++) {
          const o = start + k * s2;
          const A = [nx * o + ux * alo, ny * o + uy * alo], B = [nx * o + ux * ahi, ny * o + uy * ahi];
          for (const [t0, t1] of lineChords(t.pts, [], A, B).chords) {
            raw.push([[A[0] + (B[0] - A[0]) * t0, A[1] + (B[1] - A[1]) * t0], [A[0] + (B[0] - A[0]) * t1, A[1] + (B[1] - A[1]) * t1]]);
          }
        }
      }
      break;
    }
    case 'echo': {
      // cells cut by an inset panel or the quilt edge echo their visible part
      const shapes = [...Q.cells.flatMap(c => !c.clip ? [c.pts] : c.clipHoles?.length ? [] : c.clip), ...Q.tiles.filter(t => t.whole).map(t => t.pts)];
      for (const s of shapes) {
        for (let k = 0; k < Math.max(1, layer.echoes || 1); k++) {
          const ins = inflate(s, -(sp / 2 + k * sp));
          if (polyArea(ins) < sp * sp * 0.1 || signedArea(ins) * signedArea(s) <= 0) break;
          raw.push([...ins, ins[0]]);
        }
      }
      break;
    }
    case 'outline': raw = outlineRaw(Q, sp, Math.max(1, layer.echoes || 1)); break;
  }
  return raw;
}

// Meander / stipple: a random maze (spanning tree) over a grid of cells 2 × spacing wide, and the one
// line that runs around it. Lines stay about `sp` apart and never cross; smoothing rounds the turns.
// Cells inside skipped areas or appliqué are left out, so the line flows around them.
function meanderRaw(A, sp, seed, avoid) {
  const R = A.outer;
  let node = 2 * sp;
  while ((R.w / node) * (R.h / node) > 15000) node *= 1.2;
  const nx = Math.max(1, Math.round(R.w / node)), ny = Math.max(1, Math.round(R.h / node));
  const gx = R.w / nx, gy = R.h / ny, N = nx * ny;
  const holes = !A.inner ? [] : Array.isArray(A.inner) ? A.inner : [A.inner];
  const inRect = (p, r) => p[0] > r.x && p[0] < r.x + r.w && p[1] > r.y && p[1] < r.y + r.h;
  const inP = (p, P) => p[0] >= P.bb.x && p[0] <= P.bb.x + P.bb.w && p[1] >= P.bb.y && p[1] <= P.bb.y + P.bb.h
    && pointInPoly(p, P.pts) && !P.holes.some(h => pointInPoly(p, h));
  const ok = new Uint8Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const p = [R.x + (i + 0.5) * gx, R.y + (j + 0.5) * gy];
    ok[j * nx + i] = !holes.some(h => inRect(p, h)) && (!A.polys || A.polys.some(P => inP(p, P))) && !avoid.some(P => inP(p, P)) ? 1 : 0;
  }
  // random depth-first spanning forest: long corridors give the meandering look
  const rand = rng(seed * 7919 + nx * 31 + ny), right = new Uint8Array(N), down = new Uint8Array(N), seen = new Uint8Array(N);
  for (let s0 = 0; s0 < N; s0++) {
    if (!ok[s0] || seen[s0]) continue;
    const stack = [s0]; seen[s0] = 1;
    while (stack.length) {
      const v = stack[stack.length - 1], i = v % nx, j = (v / nx) | 0;
      const opts = [i > 0 && v - 1, i < nx - 1 && v + 1, j > 0 && v - nx, j < ny - 1 && v + nx].filter(u => u !== false && ok[u] && !seen[u]);
      if (!opts.length) { stack.pop(); continue; }
      const u = opts[Math.floor(rand() * opts.length)];
      seen[u] = 1;
      if (u === v + 1) right[v] = 1; else if (u === v - 1) right[u] = 1; else if (u === v + nx) down[v] = 1; else down[u] = 1;
      stack.push(u);
    }
  }
  // the line around the tree, on a grid twice as fine: every fine cell gets exactly two neighbours
  const W2 = 2 * nx, adj = new Int32Array(W2 * 2 * ny * 2).fill(-1);
  const f = (x, y) => y * W2 + x;
  const link = (a, b) => { adj[2 * a + (adj[2 * a] < 0 ? 0 : 1)] = b; adj[2 * b + (adj[2 * b] < 0 ? 0 : 1)] = a; };
  for (let v = 0; v < N; v++) {
    if (!ok[v]) continue;
    const i = v % nx, j = (v / nx) | 0;
    const a = f(2 * i, 2 * j), b = f(2 * i + 1, 2 * j), c = f(2 * i + 1, 2 * j + 1), d = f(2 * i, 2 * j + 1);
    if (!(j > 0 && down[v - nx])) link(a, b);
    if (right[v]) { link(b, f(2 * i + 2, 2 * j)); link(c, f(2 * i + 2, 2 * j + 1)); } else link(b, c);
    if (down[v]) { link(d, f(2 * i, 2 * j + 2)); link(c, f(2 * i + 1, 2 * j + 2)); } else link(c, d);
    if (!(i > 0 && right[v - 1])) link(d, a);
  }
  const jit = Math.min(gx, gy) * 0.15, raw = [], done = new Uint8Array(adj.length / 2);
  for (let s0 = 0; s0 < done.length; s0++) {
    if (done[s0] || adj[2 * s0] < 0) continue;
    const loop = [];
    let prev = -1, cur = s0;
    while (!done[cur]) {
      done[cur] = 1;
      const x = cur % W2, y = (cur / W2) | 0;
      loop.push([R.x + (x + 0.5) * gx / 2 + (rand() - 0.5) * jit, R.y + (y + 0.5) * gy / 2 + (rand() - 0.5) * jit]);
      const nxt = adj[2 * cur] !== prev ? adj[2 * cur] : adj[2 * cur + 1];
      prev = cur; cur = nxt;
      if (cur < 0) break;
    }
    const smooth = chaikinClosed(loop, 3);
    raw.push([...smooth, smooth[0]]);
  }
  return raw;
}
// Everything within d of some shapes, with rounded corners: edges become d-wide strips and corners
// discs, all joined. Outlines are simplified first so lettering stays quick.
function grownOutline(rings, d) {
  // the boolean union can trip over near-degenerate input; snapping to a coarser grid usually fixes it,
  // and no echo is better than a scribble
  for (const snap of [0, 1e-3, 1e-2]) {
    const parts = grownParts(rings, d).map(p => snap ? p.map(q => q.map(v => Math.round(v / snap) * snap)) : p);
    try { return parts.length ? fromPC(PC.union(...parts.map(toPC))) : []; } catch { /* try again, snapped */ }
  }
  return [];
}
function grownParts(rings, d) {
  const parts = [];
  for (const raw of rings) {
    const ring = simplifyRing(raw, Math.min(0.04, d / 6));
    if (ring.length < 3) continue;
    parts.push(ring);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], L = dist(a, b);
      if (L < 1e-6) continue;
      const nx = -(b[1] - a[1]) / L * d, ny = (b[0] - a[0]) / L * d;
      parts.push([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
      parts.push(Array.from({ length: 12 }, (_, k) => [a[0] + d * Math.cos(k * Math.PI / 6), a[1] + d * Math.sin(k * Math.PI / 6)]));
    }
  }
  return parts;
}
// Douglas–Peucker for a closed ring.
function simplifyRing(ring, tol) {
  if (ring.length < 8) return ring;
  const far = ring.reduce((best, p, i) => dist(p, ring[0]) > dist(ring[best], ring[0]) ? i : best, 0);
  const dp = pts => {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1], L = dist(a, b) || 1e-12;
    let worst = 0, wi = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], dd = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L;
      if (dd > worst) { worst = dd; wi = i; }
    }
    if (worst <= tol) return [a, b];
    const l = dp(pts.slice(0, wi + 1)), r = dp(pts.slice(wi));
    return [...l.slice(0, -1), ...r];
  };
  const one = dp(ring.slice(0, far + 1)), two = dp([...ring.slice(far), ring[0]]);
  return [...one.slice(0, -1), ...two.slice(0, -1)];
}
function chaikinClosed(pts, iterations) {
  for (let k = 0; k < iterations; k++) {
    const o = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      o.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    pts = o;
  }
  return pts;
}

// Echo each piece: a line ¼" inside every piece's seams, more inward at the spacing, and echoes
// outward around appliqué (kept inside its block).
function outlineRaw(Q, sp, n) {
  const raw = [], first = 0.25;
  const segDist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12;
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0, 1);
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  // an inset that folded over itself (narrow piece) isn't stitchable
  const clean = (ring, ins, d) => ins.every(v => pointInPoly(v, ring) && ring.every((a, i) => segDist(v, a, ring[(i + 1) % ring.length]) > d * 0.8));
  const echoIn = (ring, clipTo) => {
    for (let k = 0; k < n; k++) {
      const d = first + k * sp, ins = inflate(ring, -d);
      if (polyArea(ins) < 0.05 || signedArea(ins) * signedArea(ring) <= 0 || !clean(ring, ins, d)) break;
      const pl = [...ins, ins[0]];
      raw.push(...(clipTo ? polylineVsPolys(pl, clipTo, true) : [pl]));
    }
  };
  for (const c of Q.cells) {
    const block = c.b && doc.blocks[c.b];
    const clipTo = c.clip ? c.clip.map(pp => polyArea2(pp, c.clipHoles || [])) : null;
    if (!block) { echoIn(c.pts, clipTo); continue; }
    const map = cellPointMapper(c), cellPoly = clipTo || [polyArea2(c.pts)], app = [];
    for (const p of blockPieces(block, c.size, c.size)) {
      const pts = p.pts.map(map);
      if (p.app) app.push(pts); else echoIn(pts, clipTo);
    }
    // around the appliqué as one group (a word is echoed as a whole), kept inside the block
    if (app.length) for (let k = 0; k < n; k++) {
      for (const g of grownOutline(app, first + k * sp)) for (const ring of [g.outer, ...g.holes]) raw.push(...polylineVsPolys([...ring, ring[0]], cellPoly, true));
    }
  }
  for (const t of [...Q.tiles, ...Q.patches]) echoIn(t.pts, null);
  return raw;
}

function quiltingSvg(Q, layers = doc.quilting.layers, scaleHint = 1) {
  const w = Math.max(Q.W, Q.H) * 0.0022 * scaleHint;
  let s = '<g class="quilting" pointer-events="none" fill="none" stroke-linecap="round" stroke-linejoin="round">';
  for (const L of layers) {
    if (!L.visible) continue;
    const paths = quiltLayerPaths(Q, L);
    const d = paths.map(pl => 'M' + pl.map(([x, y]) => `${round(x, 3)},${round(y, 3)}`).join('L')).join('');
    s += `<path d="${d}" stroke="${L.color}" stroke-width="${round(w, 4)}" stroke-dasharray="${round(w * 3, 4)} ${round(w * 1.6, 4)}"/>`;
  }
  return s + '</g>';
}

// The back of the finished quilt: backing fabric with its panel seams, the binding, and the
// quilting stitches mirrored left to right (the quilt is turned over).
function quiltBackSvg(Q, opts = {}) {
  const bk = cuttingPlan(Q).backing, oh = doc.cutting.overhang ?? 4;
  const fab = doc.layout.backing?.fabric, hair = Math.max(Q.W, Q.H) * 0.0012;
  let s = `<svg class="${opts.cls || 'quilt-svg'}" viewBox="0 0 ${round(Q.W, 3)} ${round(Q.H, 3)}" xmlns="http://www.w3.org/2000/svg"${opts.size ? ` width="${opts.size[0]}" height="${opts.size[1]}"` : ''}>`;
  s += `<rect width="${round(Q.W, 3)}" height="${round(Q.H, 3)}" fill="${fab ? fabricFill(fab) : '#f1eee7'}"/>`;
  const ana = bk.chosen?.ana;
  if (ana?.mode === 'cut') {
    // the cut runs from (sw, 0) to (0, sh) with the backing at [0, w] × [0, h] (y up); quilt coordinates
    const q = ([x, y]) => [round(x - oh, 3), round(bk.h - y - oh, 3)];
    const [a, b] = [q([ana.sourceW, 0]), q([0, ana.sourceH])];
    s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="rgba(20,24,30,.45)" stroke-width="${hair * 1.4}" stroke-dasharray="${hair * 8} ${hair * 5}"/>`;
  } else if (bk.panels > 1) {
    // panels share the backing (quilt + overhang) equally; seams in quilt coordinates
    const across = bk.seams === 'vertical' ? bk.w : bk.h;
    for (let k = 1; k < bk.panels; k++) {
      const v = round(-oh + across * k / bk.panels, 3);
      s += bk.seams === 'vertical'
        ? `<line x1="${v}" y1="0" x2="${v}" y2="${round(Q.H, 3)}" stroke="rgba(20,24,30,.45)" stroke-width="${hair * 1.4}" stroke-dasharray="${hair * 8} ${hair * 5}"/>`
        : `<line x1="0" y1="${v}" x2="${round(Q.W, 3)}" y2="${v}" stroke="rgba(20,24,30,.45)" stroke-width="${hair * 1.4}" stroke-dasharray="${hair * 8} ${hair * 5}"/>`;
    }
  }
  if (doc.layout.binding?.fabric) {
    const bw = 0.375;
    s += `<rect x="${bw / 2}" y="${bw / 2}" width="${round(Q.W - bw, 4)}" height="${round(Q.H - bw, 4)}" fill="none" stroke="${fabricFill(doc.layout.binding.fabric)}" stroke-width="${bw}"/>`;
  }
  const layers = (opts.layers || doc.quilting.layers).filter(L => L.visible);
  if (layers.length) s += `<g transform="translate(${round(Q.W, 4)} 0) scale(-1 1)">${quiltingSvg(Q, layers, opts.scaleHint || 1)}</g>`;
  return s + '</svg>';
}

function quiltingStats(Q) {
  let total = 0;
  const per = doc.quilting.layers.map(L => {
    const len = sum(quiltLayerPaths(Q, L), polylineLength);
    if (L.visible) total += len;
    return { layer: L, length: len };
  });
  // top + bobbin thread, plus ~15% for starts, stops and travel
  return { per, total, threadYds: total * 2 * 1.15 / 36 };
}

function quiltingInstructions(L) {
  const sp = fmtLen(L.spacing);
  const where = { all: 'across the whole quilt', center: 'in the quilt centre (inside the borders)', borders: 'in the borders only',
    panel: 'in the inset panel (including its frames)', aroundPanel: 'in the quilt centre, around the inset panel',
    blocks: 'in the blocks', plain: 'in the plain squares and setting triangles', sashing: 'in the sashing' }[L.area] || '';
  const ang = Math.round(((L.angle % 180) + 180) % 180);
  const dirWord = ang === 90 ? 'vertical' : ang === 0 ? 'horizontal' : `${ang}°`;
  switch (L.type) {
    case 'lines': return `Stitch ${dirWord} straight lines ${sp} apart ${where}. Mark the first line through the centre with a hera marker or painter's tape, then work outward, alternating stitching direction to prevent drift. A walking foot helps.`;
    case 'crosshatch': return `Stitch a crosshatch ${where}: lines ${sp} apart at ${ang}° and again at ${(ang + 90) % 180}°. Stitch all lines in one direction first, then the second set.`;
    case 'diamonds': return `Stitch a diamond hatch ${where}: two sets of lines ${sp} apart, 60° to each other.`;
    case 'wavy': return `Stitch gentle wavy lines ${sp} apart ${where} (waves about ${fmtLen(L.wave)} long and ${fmtLen(L.amp)} high). Many machines have a serpentine stitch that does this with a walking foot.`;
    case 'zigzag': return `Stitch zigzag lines ${sp} apart ${where}, turning every ${fmtLen(L.wave / 2)}. Pivot with the needle down at each point.`;
    case 'spiral': return `Stitch a continuous spiral ${where}, starting at the centre with turns ${sp} apart. Begin with a small circle, then turn the quilt as you go. A walking foot and a slow speed give smooth curves.`;
    case 'circles': return `Stitch concentric circles ${sp} apart from the centre ${where}. Mark the circles with a string compass or circle template.`;
    case 'squares': return `Stitch nested rectangles ${sp} apart ${where}, starting ${fmtLen(L.spacing / 2)} in from the edge and working inward.`;
    case 'ditch': return `Stitch in the ditch ${where}: sew right in the seam lines between blocks, sashing and borders and inside each block, so the stitches disappear, and just outside the edge of any appliqué. Do this first to stabilise the quilt.`;
    case 'echo': return `Echo quilt ${where}: stitch ${plural(L.echoes || 1, 'outline')} inside each block or tile, ${sp} apart.`;
    case 'outline': return `Echo each piece ${where}: stitch ¼" inside the seams of every piece${(L.echoes || 1) > 1 ? `, then ${plural((L.echoes || 1) - 1, 'more line')} ${sp} apart working inward` : ''}, and echo around any appliqué the same way. A ¼" quilting foot or ¼" masking tape keeps the first line even.`;
    case 'meander': return `Meander (stipple) ${where}: free-motion quilt one continuous wandering line with the lines about ${sp} apart, never crossing. Drop the feed dogs, use a darning or free-motion foot, and practise on a scrap sandwich first. The picture shows the idea, not a line to follow exactly; stitch around appliqué rather than across it.`;
    case 'faces': {
      const tum = doc.layout.mode === 'tess' && doc.layout.tess.shape === 'tumbling';
      const names = tum ? ['top', 'right', 'left'] : ['first group of', 'second group of', 'third group of'];
      const used = Object.entries(L.dirs || {}).filter(([, v]) => v >= 0).map(([k]) => names[k]).filter(Boolean);
      return `Dimensional quilting: fill each ${tum ? 'cube face' : 'shape'} with straight lines about ${sp} apart running parallel to one of its own edges, in a different direction on the ${used.join(', ')} faces${L.grade !== false ? ', with lines closer together on darker fabrics to deepen the shadows' : ''}. Mark the first line in each face with a hera marker, stitch to the seam and pivot or travel along the ditch to the next line, and bury thread tails where faces meet.`;
    }
  }
  return '';
}
