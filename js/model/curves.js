/* Pieced curves: which curved units can be sewn by machine as drawn, why the others can't, the
   straight seams that make them sewable, and the matching marks on their templates. blocks.js
   calls in at a few points; everything here works on finished pieces, in the block's own units. */

const CORNER_DEG = 8;    // a turn this sharp is a corner; arcs are drawn in 3° steps
const SHARP_DEG = 10;    // a curved piece narrowing to less than this is worth a note

/* ---------- rings ---------- */
// A ring that touches itself (two petals meeting at a point) split there into separate loops. Loops
// running the ring's own way are pieces; loops running the other way are holes, each given to the
// piece around it. tol: how close two points are to count as one. → [{ outer, holes }]
function splitPinches(outer, holes, tol) {
  const key = p => `${Math.round(p[0] / tol)},${Math.round(p[1] / tol)}`;
  const loops = ring => {
    const seen = new Map();
    for (let j = 0; j < ring.length; j++) {
      const k = key(ring[j]), i = seen.get(k);
      if (i !== undefined) return [...loops(ring.slice(i, j)), ...loops([...ring.slice(j), ...ring.slice(0, i)])];
      seen.set(k, j);
    }
    return [ring];
  };
  const own = loops(outer), inner = holes.flatMap(loops);
  if (own.length === 1 && inner.length === holes.length) return [{ outer, holes }];
  const ok = L => L.length >= 3 && polyArea(L) > tol * tol, s = Math.sign(signedArea(outer)), out = [];
  for (const L of own.filter(ok)) if (Math.sign(signedArea(L)) === s) out.push({ outer: L, holes: [] }); else inner.push(L);
  if (!out.length) return [{ outer, holes }];
  for (const h of inner.filter(ok)) {
    const score = q => h.filter(p => pointInPoly(p, q.outer)).length;
    out.reduce((a, q) => (score(q) > score(a) ? q : a)).holes.push(h);
  }
  return out;
}
// A curved piece's outline without near-repeated points or zero-width spikes; arc points stay.
function cleanCurvePts(pts, size) {
  const b = bounds(pts), tol = 1e-5 * (size || Math.max(b.w, b.h));
  const out = pts.slice();
  for (let changed = true; changed && out.length > 3;) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i - 1 + out.length) % out.length], v = out[i], c = out[(i + 1) % out.length];
      const ux = v[0] - a[0], uy = v[1] - a[1], wx = c[0] - v[0], wy = c[1] - v[1], lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
      if (lw <= tol || (Math.abs(ux * wy - uy * wx) < 2e-5 * lu * lw && ux * wx + uy * wy < 0)) { out.splice(i, 1); changed = true; i--; }
    }
  }
  return out;
}
// The signed turn at each vertex in degrees: positive turns toward the inside (a convex corner),
// whichever way the ring runs.
function ringTurns(pts) {
  const n = pts.length, s = signedArea(pts) > 0 ? 1 : -1;
  return pts.map((v, i) => {
    const a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n], ux = v[0] - a[0], uy = v[1] - a[1], wx = c[0] - v[0], wy = c[1] - v[1];
    return s * Math.atan2(ux * wy - uy * wx, ux * wx + uy * wy) * 180 / Math.PI;
  });
}
// A stretch of a ring through the vertex indices idx (closed: all the way round). sign: 1 bulges out
// of the piece, −1 scoops into it, 0 bends both ways (an S). t: the turns inside the stretch.
function ringStretch(ring, turns, idx, closed) {
  const t = (closed ? idx : idx.slice(1, -1)).map(k => turns[k]);
  const pos = sum(t.filter(x => x > 0.3)), neg = -sum(t.filter(x => x < -0.3)), turn = sum(t);
  const pts = idx.map(k => ring[k]);
  if (closed) pts.push(pts[0]);
  return { pts, t, closed, turn, len: polylineLength(pts), curved: pts.length > 2 && sum(t, Math.abs) >= 1.5,
    corner: t.some(x => Math.abs(x) >= CORNER_DEG), sign: pos > 2 && neg > 2 ? 0 : Math.sign(turn) };
}
// The curved stretches of a ring, corner to corner (a ring with no corner is one closed run).
function curveRuns(pts, turns = ringTurns(pts)) {
  const n = pts.length, cs = [];
  for (let i = 0; i < n; i++) if (Math.abs(turns[i]) >= CORNER_DEG) cs.push(i);
  if (!cs.length) { const s = ringStretch(pts, turns, pts.map((_, i) => i), true); return s.curved ? [s] : []; }
  return cs.map((i0, k) => {
    const idx = [i0];
    for (let j = (i0 + 1) % n; ; j = (j + 1) % n) { idx.push(j); if (j === cs[(k + 1) % cs.length]) break; }
    return ringStretch(pts, turns, idx, false);
  }).filter(s => s.curved);
}
const curveConvex = pts => ringTurns(pts).every(t => t > -0.3);
// Where a curve ends in a corner of a piece, and the angle there in degrees. An arc is drawn as
// chords, so the angle is taken from the arc itself: half a step past the first chord.
function tipAngles(p) {
  const pts = p.pts, n = pts.length, t = ringTurns(pts), arc = x => Math.abs(x) > 0.3 && Math.abs(x) < CORNER_DEG, out = [];
  for (let i = 0; i < n; i++) {
    const a = t[(i - 1 + n) % n], c = t[(i + 1) % n];
    if (Math.abs(t[i]) < CORNER_DEG || (!arc(a) && !arc(c))) continue;
    out.push({ p: pts[i], deg: clamp(180 - t[i] + (arc(a) ? a / 2 : 0) + (arc(c) ? c / 2 : 0), 0, 360) });
  }
  return out;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy, t = q ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q, 0, 1) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function ringDist(p, ring, closed = true) {
  let d = Infinity;
  for (let i = 0, n = ring.length; i < (closed ? n : n - 1); i++) d = Math.min(d, segDist(p, ring[i], ring[(i + 1) % n]));
  return d;
}
const onRing = (p, ring, tol) => ringDist(p, ring) < tol;
// The point at distance d along a polyline, and the direction there.
function pointAlong(path, d) {
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1], L = dist(a, b);
    if (d <= L || i === path.length - 2) { const k = L ? clamp(d / L, 0, 1) : 0; return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], d: [(b[0] - a[0]) / (L || 1), (b[1] - a[1]) / (L || 1)] }; }
    d -= L;
  }
  return { p: path[0], d: [1, 0] };
}

/* ---------- curved units ----------
   A leaf of the sewing tree holding curved pieces sews by machine when each seam inside it is one
   smooth curve from edge to edge, shared by two pieces, and the seams join the pieces in a chain or
   tree: then it's sewn one seam at a time. A circle or oval set into an opening is the one closed
   seam allowed (an inset unit). Otherwise the unit is curveComplex, and `why` says what's wrong:
   'cross' a curve meets a straight seam inside it, 'meet' curved seams meet inside it, 'corner' a
   curved seam turns a corner, 'S' a set-in shape bends both ways, 'many' anything else (pieces
   joined in a loop; curvesAnalyse also uses it for curved shapes drawn overlapping). */
const CURVED_UNITS = new Set(['curved', 'peel', 'inset']);
const WHY_ORDER = ['cross', 'meet', 'corner', 'S', 'many'];
function classifyCurvedUnit(node, fabs) {
  const ps = node.pieces, r = node.rect, tol = 1e-4 * Math.max(r.w, r.h);
  const onOut = q => ringDist(q, node.region) < tol;
  const bbs = ps.map(p => p.bb || bounds(p.pts));
  const near = (q, j) => { const b = bbs[j]; return q[0] > b.minX - tol && q[0] < b.maxX + tol && q[1] > b.minY - tol && q[1] < b.maxY + tol && [ps[j].pts, ...ps[j].holes].some(h => onRing(q, h, tol)); };
  // every side of every piece: a stretch of its outline along the unit's edge (nb −1) or along one
  // other piece (nb = its index; −2 = nothing there)
  const sides = [];
  ps.forEach((p, pi) => [p.pts, ...p.holes].forEach((ring, hi) => {
    const n = ring.length, turns = ringTurns(ring).map(x => (hi ? -x : x));
    let last = -1;
    const nb = ring.map((a, i) => {
      const b = ring[(i + 1) % n], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (onOut(a) && onOut(b) && onOut(m)) return -1;
      if (last >= 0 && near(m, last)) return last;
      const j = ps.findIndex((_, k) => k !== pi && near(m, k));
      return (last = j < 0 ? -2 : j);
    });
    const s0 = nb.findIndex((x, i) => x !== nb[(i - 1 + n) % n]);
    if (s0 < 0) { sides.push({ pi, nb: nb[0], hole: hi > 0, ...ringStretch(ring, turns, ring.map((_, i) => i), true) }); return; }
    for (let k = 0; k < n;) {
      const i0 = (s0 + k) % n, idx = [i0];
      do idx.push((i0 + idx.length) % n); while (k + idx.length - 1 < n && nb[(i0 + idx.length - 1) % n] === nb[i0]);
      sides.push({ pi, nb: nb[i0], hole: hi > 0, ...ringStretch(ring, turns, idx, false) });
      k += idx.length - 1;
    }
  }));
  const why = new Set(), seams = sides.filter(s => s.nb >= 0 && s.pi < s.nb);
  if (sides.some(s => s.nb === -2)) why.add('many');
  const straightAt = e => sides.some(s => s.nb >= 0 && !s.curved && s.pts.some(q => dist(q, e) < tol));
  for (const s of seams) {
    if (!s.curved) { why.add('cross'); continue; }
    if (s.corner) why.add('corner');
    if (!s.closed) { for (const e of [s.pts[0], s.pts[s.pts.length - 1]]) if (!onOut(e)) why.add(straightAt(e) ? 'cross' : 'meet'); continue; }
    // a closed seam: the outline of a smooth convex shape set into the other piece's hole
    const other = sides.find(x => x.pi === s.nb && x.nb === s.pi);
    if (!other?.closed || s.hole === other.hole || ps.length > 2) why.add('many');
    else if ((s.hole ? other : s).sign !== 1) why.add('S');
  }
  // the pieces must make a tree: pieces − 1 seams, every piece reached
  const adj = ps.map(() => []);
  for (const s of seams) { adj[s.pi].push(s); adj[s.nb].push(s); }
  const reach = [0];
  for (let k = 0; k < reach.length; k++) for (const s of adj[reach[k]]) for (const j of [s.pi, s.nb]) if (!reach.includes(j)) reach.push(j);
  if (!why.size && (seams.length !== ps.length - 1 || reach.length !== ps.length)) why.add('many');
  if (why.size) return { type: 'curveComplex', why: WHY_ORDER.find(w => why.has(w)), fabs };
  // each seam with its convex and concave piece (none for an S) and its matching marks
  const S = seams.map(s => ({ s, run: s.pts, len: s.len, closed: s.closed, notches: seamNotches(s),
    convex: s.sign ? ps[s.sign > 0 ? s.pi : s.nb] : null, concave: s.sign ? ps[s.sign > 0 ? s.nb : s.pi] : null }));
  const out = x => ({ run: x.run, len: x.len, closed: x.closed, convex: x.convex, concave: x.concave, notches: x.notches });
  const ends = x => [x.run[0], x.run[x.run.length - 1]];
  if (ps.length === 2 && S[0].closed) {
    const inner = S[0].convex, c = centroid(inner.pts), d = inner.pts.map(q => dist(q, c));
    return { type: 'inset', inner, outer: S[0].concave, seam: out(S[0]), circle: Math.max(...d) - Math.min(...d) < 0.02 * sum(d) / d.length, fabs };
  }
  // an orange peel: a lens with its tips in opposite corners, a piece on each side
  const at = (p, e) => Math.min(...tipAngles(p).filter(t => dist(t.p, e) < tol).map(t => t.deg));
  const mi = ps.length === 3 ? adj.findIndex((a, i) => a.length === 2 && sides.every(s => s.pi !== i || s.nb >= 0)) : -1;
  if (mi >= 0) {
    const m = ps[mi], [s1, s2] = S.filter(x => x.s.pi === mi || x.s.nb === mi), [A, B] = ends(s1);
    const corner = e => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].findIndex(c => dist(c, e) < tol);
    if (s1.convex === m && s2.convex === m && ends(s2).every(e => dist(e, A) < tol || dist(e, B) < tol) && corner(A) >= 0 && Math.abs(corner(A) - corner(B)) === 2) {
      const cs = [s1.concave, s2.concave];
      return { type: 'peel', petal: m, corners: cs, seams: [out(s1), out(s2)], tips: [A, B], petalDeg: Math.min(at(m, A), at(m, B)),
        cornerDeg: Math.min(...cs.flatMap(c => [at(c, A), at(c, B)])), fabs };
    }
  }
  // sewing order: the piece with the most convex seams first (the smaller one on a tie), then each
  // piece joined to the ones before it by one seam
  const convexN = i => adj[i].filter(s => s.sign && (s.sign > 0) === (s.pi === i)).length;
  const order = [ps.map((_, i) => i).sort((i, j) => convexN(j) - convexN(i) || ps[i].cls.area - ps[j].cls.area)[0]];
  const joins = [];
  for (let k = 0; k < order.length; k++) for (const s of adj[order[k]]) for (const j of [s.pi, s.nb]) if (!order.includes(j)) { order.push(j); joins.push(out(S.find(x => x.s === s))); }
  const tips = ps.flatMap(p => tipAngles(p).filter(t => S.some(x => ends(x).some(e => dist(e, t.p) < tol))));
  return { type: 'curved', form: ps.length === 2 ? 'pie' : adj.every(a => a.length <= 2) ? 'rings' : 'tree', order: order.map(i => ps[i]), seams: joins, tips, fabs };
}
// Matching marks along a seam, as { p, d } (the point and the seam's direction there): the middle,
// with the quarters too past 6"; an S at each bend and the middle of each part; a closed seam at
// its top, right, bottom and left.
function seamNotches(s) {
  if (s.closed) {
    const P = s.pts.slice(0, -1), n = P.length;
    return [q => q[1], q => -q[0], q => -q[1], q => q[0]].map(f => {
      const i = P.reduce((a, q, k) => (f(q) < f(P[a]) ? k : a), 0), a = P[(i - 1 + n) % n], b = P[(i + 1) % n], L = dist(a, b) || 1;
      return { p: P[i], d: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
    });
  }
  let marks = s.len > 6 ? [0.25, 0.5, 0.75].map(k => k * s.len) : [s.len / 2];
  if (!s.sign) {
    const bends = [];
    for (let k = 1, along = 0, last = 0; k < s.pts.length - 1; k++) {
      along += dist(s.pts[k - 1], s.pts[k]);
      const t = s.t[k - 1];
      if (Math.abs(t) > 0.3) { if (last && Math.sign(t) !== last) bends.push(along); last = Math.sign(t); }
    }
    const cuts = [0, ...bends, s.len];
    marks = [...bends, ...cuts.slice(1).map((c, i) => (cuts[i] + c) / 2)].sort((a, b) => a - b);
  }
  return marks.map(m => pointAlong(s.pts, m));
}

// After the sewing tree (analyzeBlock): for each unit that can't be sewn as drawn, the drawn shapes
// behind it (made appliqué, they'd fix it); and the matching marks of every curved seam, given to
// each piece they lie on with that piece's outward direction, by piece index: an.notches[i].
function curvesAnalyse(block, an, all) {
  an.curveIssue = false; an.notches = {};
  for (const u of an.units) {
    const t = u.unit.type, tol = 1e-4 * Math.max(u.rect.w, u.rect.h);
    if (t === 'curveComplex') {
      an.curveIssue = true;
      const regs = u.unit.regions = curveRegionsFor(block, u, an.size);
      if (regs.some((i, k) => regs.slice(k + 1).some(j => regionsOverlap(block, i, j)))) u.unit.why = 'many';
    }
    for (const s of t === 'inset' ? [u.unit.seam] : CURVED_UNITS.has(t) ? u.unit.seams : []) for (const m of s.notches) for (const p of u.pieces) {
      if (![p.pts, ...p.holes].some(h => onRing(m.p, h, tol))) continue;
      const e = 1e-3 * Math.max(p.bb.w, p.bb.h), q = [m.p[0] - m.d[1] * e, m.p[1] + m.d[0] * e];
      const out = !pointInPoly(q, p.pts) || p.holes.some(h => pointInPoly(q, h));
      (an.notches[all.indexOf(p)] ||= []).push({ p: m.p, n: out ? [-m.d[1], m.d[0]] : [m.d[1], -m.d[0]] });
    }
  }
}
// The drawn shapes behind a unit that can't be sewn: curved, pieced (not appliqué), and showing in it.
function curveRegionsFor(block, leaf, size) {
  if (block.kind !== 'drawn') return [];
  const k = size / block.n, ring = i => toPC(regionRing(block.regions[i], k, k));
  return block.regions.map((_, i) => i).filter(i => {
    const r = block.regions[i];
    if (r.app || r.pts.length < 2 || !r.b?.some(x => x)) return false;
    const above = block.regions.map((_, j) => j).filter(j => j > i && !block.regions[j].app && block.regions[j].pts.length >= 2).map(ring);
    let mp = pcSafe('intersection', ring(i), toPC(leaf.region));
    if (mp?.length && above.length) mp = pcSafe('difference', mp, ...above);
    return !!mp && sum(fromPC(mp), q => polyArea(q.outer) - sum(q.holes, polyArea)) > 1e-5 * size * size;
  });
}
function regionsOverlap(block, i, j) {
  const mp = pcSafe('intersection', toPC(regionRing(block.regions[i], 1, 1)), toPC(regionRing(block.regions[j], 1, 1)));
  return !!mp && sum(fromPC(mp), q => polyArea(q.outer)) > 1e-5 * block.n * block.n;
}

// A drawn shape's outline (with its arcs) crossing or touching itself: the shape comes apart there.
function ringSelfCrosses(ring) {
  const n = ring.length, e = 1e-7 * Math.max(bounds(ring).w, bounds(ring).h, 1), cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = ring[i], b = ring[(i + 1) % n], c = ring[j], d = ring[(j + 1) % n];
    if (dist(a, c) < e) return true;
    if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0]) || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) continue;
    if (cr(a, b, c) * cr(a, b, d) < 0 && cr(c, d, a) * cr(c, d, b) < 0) return true;
  }
  return false;
}

/* ---------- fixes for curves that can't be sewn ----------
   What the Seam tool offers for the curved parts that can't be sewn as drawn: the reason, the parts
   (leaves, block grid units) and the drawn shapes that, made appliqué, clear all of them (regions;
   empty when that wouldn't). null when every curved part can be sewn. */
function curvedSeamSuggestions(block) {
  const n = block.n, bad = analyzeBlock(block, n).units.filter(u => u.unit.type === 'curveComplex');
  if (!bad.length) return null;
  const regs = uniq(bad.flatMap(u => u.unit.regions || []));
  const trial = { ...block, regions: block.regions.map((r, i) => (regs.includes(i) ? { ...r, app: true } : r)) };
  return { why: bad[0].unit.why, leaves: bad.map(u => u.rect), seams: [], units: {}, cuts: 0, regions: regs.length && !analyzeBlock(trial, n).curveIssue ? regs : [] };
}
