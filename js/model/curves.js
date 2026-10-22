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
