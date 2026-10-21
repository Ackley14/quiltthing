/* Geometry: polygons, true circular arcs, boolean ops (via vendored polygon-clipping),
   seam-allowance offsets, seam splitting, and rotation-invariant piece classification.
   Polygons are arrays of [x, y] (open rings, no repeated closing point). y grows downward. */

const PC = (typeof polygonClipping !== 'undefined') ? polygonClipping
  : (typeof require !== 'undefined' ? require('../../vendor/polygon-clipping.js') : null);

/* ---------- basics ---------- */
function signedArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}
const polyArea = p => Math.abs(signedArea(p));
function bounds(p) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of p) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
}
function centroid(p) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    const c = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * c; cy += (y1 + y2) * c; a += c;
  }
  if (Math.abs(a) < 1e-12) {
    return [sum(p, q => q[0]) / p.length, sum(p, q => q[1]) / p.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}
function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const translatePoly = (p, dx, dy) => p.map(([x, y]) => [x + dx, y + dy]);
function rotatePoly(p, rad, cx = 0, cy = 0) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return p.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}
function mirrorPolyX(p, axisX) { return p.map(([x, y]) => [2 * axisX - x, y]).reverse(); }
function polyToPath(p, prec = 3) {
  if (!p.length) return '';
  return 'M' + p.map(([x, y]) => `${round(x, prec)},${round(y, prec)}`).join('L') + 'Z';
}

// Drop duplicate and (near-)collinear vertices. tolerance scales with the polygon size.
function cleanPoly(p, keep) {
  if (p.length < 3) return p;
  const b = bounds(p);
  const tol = Math.max(b.w, b.h) * 1e-5 + 1e-6;   // clipping can leave near-duplicate corners ~1e-5 apart
  let pts = [];
  for (const q of p) {
    const last = pts[pts.length - 1];
    if (!last || Math.abs(last[0] - q[0]) > tol || Math.abs(last[1] - q[1]) > tol) pts.push(q);
  }
  if (pts.length > 1 && dist(pts[0], pts[pts.length - 1]) <= tol * 2) pts.pop();
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length], v = pts[i], c = pts[(i + 1) % pts.length];
      if (keep && keep(v)) continue;
      const ux = v[0] - a[0], uy = v[1] - a[1], wx = c[0] - v[0], wy = c[1] - v[1];
      const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
      if (lu < tol || lw < tol) { pts.splice(i, 1); changed = true; break; }
      const cr = (ux * wy - uy * wx) / (lu * lw);
      const dot = (ux * wx + uy * wy) / (lu * lw);
      if (Math.abs(cr) < 2e-5 && dot > 0) { pts.splice(i, 1); changed = true; break; }
    }
  }
  return pts;
}

/* ---------- true circular arcs ----------
   An edge A→B may carry a "bulge" = tan(θ/4) where θ is the arc's included angle
   (0 straight, ±0.4142 quarter circle, ±1 semicircle). Positive bulges toward the
   normal n = (-dy, dx) of the travel direction. */
const QUARTER_BULGE = Math.tan(Math.PI / 8);

function arcInfo(A, B, bulge) {
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const L = Math.hypot(dx, dy) || 1e-9;
  const nx = -dy / L, ny = dx / L;
  const s = bulge * L / 2;                         // signed sagitta
  const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const apex = [mid[0] + nx * s, mid[1] + ny * s];
  const R = (L * L / 4 + s * s) / (2 * Math.abs(s));
  const sign = Math.sign(s);
  const c = [apex[0] - nx * sign * R, apex[1] - ny * sign * R];
  return { L, R, c, apex, mid, theta: 4 * Math.atan(Math.abs(bulge)) };
}
// Intermediate points along the arc (excluding A and B).
function arcPoints(A, B, bulge, stepDeg = 3) {
  if (!bulge || Math.abs(bulge) < 1e-6) return [];
  const { R, c, apex, theta } = arcInfo(A, B, bulge);
  const a0 = Math.atan2(A[1] - c[1], A[0] - c[0]);
  const aApex = Math.atan2(apex[1] - c[1], apex[0] - c[0]);
  // pick the sweep direction that passes through the apex
  const norm = a => Math.atan2(Math.sin(a), Math.cos(a));
  const dir = Math.abs(norm(a0 + theta / 2 - aApex)) < Math.abs(norm(a0 - theta / 2 - aApex)) ? 1 : -1;
  const n = Math.max(2, Math.ceil((theta * 180 / Math.PI) / stepDeg));
  const out = [];
  for (let i = 1; i < n; i++) {
    const a = a0 + dir * theta * i / n;
    out.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]);
  }
  return out;
}
const ptKey = ([x, y]) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;


/* ---------- boolean ops ---------- */
const closeRing = p => [...p, p[0]];
const toPC = p => [closeRing(p)];
function fromPC(mp) {
  // MultiPolygon → [{outer, holes}] with open rings
  const out = [];
  for (const poly of mp || []) {
    const rings = poly.map(r => r.slice(0, -1));
    if (rings[0] && rings[0].length >= 3) out.push({ outer: rings[0], holes: rings.slice(1) });
  }
  return out;
}
function pcSafe(op, a, ...b) {
  try { return PC[op](a, ...b); } catch (e) { console.warn('polygon op failed', op, e); return null; }
}
function polyUnion(list) {
  if (!list.length) return [];
  const r = pcSafe('union', ...list.map(toPC));
  return r ? fromPC(r) : list.map(p => ({ outer: p, holes: [] }));
}

/* ---------- seam allowance (miter offset) ---------- */
// Offsets every edge outward by d (negative = inset) and intersects neighbours.
// Exact for convex polygons and for the gentle concavity of arcs; acute tips are clamped.
function inflate(poly, d) {
  const n = poly.length;
  if (n < 3 || !d) return poly.slice();
  const out = signedArea(poly) > 0 ? -1 : 1;   // y-down: positive area = clockwise on screen
  const norms = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
    norms.push([out * -ey / l, out * ex / l]);
  }
  const maxMiter = Math.abs(d) * 4;
  const res = [];
  for (let i = 0; i < n; i++) {
    const pi = (i - 1 + n) % n;
    const prev = poly[pi], cur = poly[i], next = poly[(i + 1) % n];
    const n1 = norms[pi], n2 = norms[i];
    const p1 = [prev[0] + d * n1[0], prev[1] + d * n1[1]], d1 = [cur[0] - prev[0], cur[1] - prev[1]];
    const p2 = [cur[0] + d * n2[0], cur[1] + d * n2[1]], d2 = [next[0] - cur[0], next[1] - cur[1]];
    const det = d1[0] * d2[1] - d1[1] * d2[0];
    let ix, iy;
    if (Math.abs(det) < 1e-12) { ix = cur[0] + d * n1[0]; iy = cur[1] + d * n1[1]; }
    else {
      const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / det;
      ix = p1[0] + t * d1[0]; iy = p1[1] + t * d1[1];
      const ox = ix - cur[0], oy = iy - cur[1], ol = Math.hypot(ox, oy);
      if (ol > maxMiter) { ix = cur[0] + ox * maxMiter / ol; iy = cur[1] + oy * maxMiter / ol; }
    }
    res.push([ix, iy]);
  }
  return res;
}

/* ---------- orientation helpers ---------- */
// Minimum-area bounding rectangle: optimal orientation is always aligned to an edge.
function minAreaRect(poly) {
  let best = null;
  const seen = new Set();
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ang = ((ang % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    const key = Math.round(ang * 1e4);
    if (seen.has(key)) continue;
    seen.add(key);
    const r = rotatePoly(poly, -ang);
    const bb = bounds(r);
    const area = bb.w * bb.h;
    if (!best || area < best.area - 1e-9 || (Math.abs(area - best.area) < 1e-9 && bb.w > best.w)) {
      best = { angle: -ang, area, w: bb.w, h: bb.h, outline: translatePoly(r, -bb.x, -bb.y) };
    }
  }
  if (best && best.h > best.w + 1e-9) {
    // prefer landscape orientation for packing/drawing consistency
    const r = rotatePoly(best.outline, Math.PI / 2);
    const bb = bounds(r);
    best = { angle: best.angle + Math.PI / 2, area: best.area, w: bb.w, h: bb.h, outline: translatePoly(r, -bb.x, -bb.y) };
  }
  return best;
}
function interiorAngles(poly) {
  const n = poly.length, pos = signedArea(poly) > 0;
  const res = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n], v = poly[i], c = poly[(i + 1) % n];
    const u = [a[0] - v[0], a[1] - v[1]], w = [c[0] - v[0], c[1] - v[1]];
    let ang = Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1]) * 180 / Math.PI;
    // signed angle from u (to previous) to w (to next); flip by winding to get the interior angle
    ang = pos ? -ang : ang;
    if (ang < 0) ang += 360;
    res.push(ang);
  }
  return res;
}
function isConvex(poly, ignoreKeys) {
  const angs = interiorAngles(poly);
  return angs.every((a, i) => a <= 180.5 || (ignoreKeys && ignoreKeys.has(ptKey(poly[i]))));
}
const isAxisDir = (a, b) => {
  const ang = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) % 90;
  return ang < 0.6 || ang > 89.4;
};

/* ---------- seams: split pieces along user / automatic seam segments ---------- */
// Parameter intervals (along A→B) where the infinite line through A,B is inside the
// region (outer ring minus holes).
function lineChords(outer, holes, A, B) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy;
  const ts = [];
  for (const ring of [outer, ...holes]) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const ex = q[0] - p[0], ey = q[1] - p[1];
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((p[0] - A[0]) * ey - (p[1] - A[1]) * ex) / den;
      const u = ((p[0] - A[0]) * dy - (p[1] - A[1]) * dx) / den;
      if (u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
    }
  }
  ts.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const t0 = ts[i], t1 = ts[i + 1];
    if (t1 - t0 < 1e-7) continue;
    const m = [A[0] + dx * (t0 + t1) / 2, A[1] + dy * (t0 + t1) / 2];
    if (pointInPoly(m, outer) && !holes.some(hh => pointInPoly(m, hh))) out.push([t0, t1]);
  }
  return { chords: out, len: Math.sqrt(L2) };
}
function splitRegionByLine(outer, holes, A, B) {
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const L = Math.hypot(dx, dy); if (L < 1e-9) return null;
  const bb = bounds(outer);
  const M = (bb.w + bb.h + dist(A, [bb.x, bb.y]) + 10) * 4;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const P1 = [A[0] - ux * M, A[1] - uy * M], P2 = [A[0] + ux * M, A[1] + uy * M];
  const side = s => toPC([P1, P2, [P2[0] + nx * M * s, P2[1] + ny * M * s], [P1[0] + nx * M * s, P1[1] + ny * M * s]]);
  const region = [closeRing(outer), ...holes.map(closeRing)];
  const a = pcSafe('intersection', region, side(1)), b = pcSafe('intersection', region, side(-1));
  if (!a || !b || !a.length || !b.length) return null;
  return [...fromPC(a), ...fromPC(b)];
}
// Split pieces ({pts, holes}) by seam segments. A seam cuts every stretch of a piece it
// crosses from edge to edge; a seam that stops inside a piece leaves it alone.
function splitBySeams(pieces, seams) {
  let cur = pieces;
  for (const [A, B] of seams) {
    const next = [];
    for (const pc of cur) {
      const { chords, len } = lineChords(pc.pts, pc.holes || [], A, B);
      const tol = 1e-4 / Math.max(len, 1e-9);
      const inSeg = ([t0, t1]) => t0 >= -tol && t1 <= 1 + tol && (t1 - t0) * len > 1e-4;
      if (!pc.holes?.length) {
        // simple piece: cut along each fully-covered chord
        let parts = [pc.pts];
        const dx = B[0] - A[0], dy = B[1] - A[1];
        for (const [t0, t1] of chords.filter(inSeg)) {
          const P = [A[0] + dx * t0, A[1] + dy * t0], Q = [A[0] + dx * t1, A[1] + dy * t1];
          const mid = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
          const k = parts.findIndex(pp => pointInPoly(mid, pp));
          const sp = k >= 0 && splitPolyByPoints(parts[k], P, Q);
          if (sp) parts.splice(k, 1, ...sp);
        }
        for (const pts of parts) next.push(parts.length === 1 ? pc : { ...pc, pts, holes: [] });
        continue;
      }
      const covered = chords.length > 0 && chords.every(inSeg);
      if (!covered) { next.push(pc); continue; }
      const parts = splitRegionByLine(pc.pts, pc.holes || [], A, B);
      if (!parts) { next.push(pc); continue; }
      for (const part of parts) {
        if (polyArea(part.outer) > 1e-6) next.push({ ...pc, pts: part.outer, holes: part.holes });
      }
    }
    cur = next;
  }
  return cur;
}
// Index of P on the ring, inserting it into the edge it lies on if it isn't a vertex (−1 if off-ring).
function ringInsert(ring, P, tol = 1e-6) {
  const k = ring.findIndex(q => dist(q, P) < tol);
  if (k >= 0) return k;
  for (let j = 0; j < ring.length; j++) {
    const a = ring[j], b = ring[(j + 1) % ring.length];
    const L = dist(a, b); if (L < 1e-12) continue;
    const t = ((P[0] - a[0]) * (b[0] - a[0]) + (P[1] - a[1]) * (b[1] - a[1])) / (L * L);
    if (t <= 0 || t >= 1) continue;
    const off = Math.abs((b[0] - a[0]) * (P[1] - a[1]) - (b[1] - a[1]) * (P[0] - a[0])) / L;
    if (off < tol) { ring.splice(j + 1, 0, P); return j + 1; }
  }
  return -1;
}
// Cut a simple polygon along the chord P–Q (both on its boundary). Returns the halves or null.
function splitPolyByPoints(poly, P, Q) {
  const ring = poly.slice();
  if (ringInsert(ring, P) < 0 || ringInsert(ring, Q) < 0) return null;
  const ip = ring.findIndex(q => dist(q, P) < 1e-6), iq = ring.findIndex(q => dist(q, Q) < 1e-6);
  if (ip === iq || (ip + 1) % ring.length === iq || (iq + 1) % ring.length === ip) return null;
  const walk = (a, b) => { const out = []; for (let k = a; ; k = (k + 1) % ring.length) { out.push(ring[k]); if (k === b) break; } return out; };
  const p1 = cleanPoly(walk(ip, iq)), p2 = cleanPoly(walk(iq, ip));
  if (p1.length < 3 || p2.length < 3 || polyArea(p1) < 1e-6 || polyArea(p2) < 1e-6) return null;
  return [p1, p2];
}
// Chords that start at a corner and run into the piece: continuations of its edges, plus
// horizontal/vertical lines (quilt grain) — the natural places a quilter would add a seam.
function chordCandidates(poly) {
  const n = poly.length, out = [], seen = new Set();
  for (let i = 0; i < n; i++) {
    const v = poly[i], pv = poly[(i - 1 + n) % n], nx = poly[(i + 1) % n];
    const dirs = [[v[0] - pv[0], v[1] - pv[1]], [v[0] - nx[0], v[1] - nx[1]], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx0, dy0] of dirs) {
      const L = Math.hypot(dx0, dy0); if (L < 1e-9) continue;
      const dx = dx0 / L, dy = dy0 / L;
      let best = null;
      for (let j = 0; j < n; j++) {
        if (j === i || (j + 1) % n === i) continue;
        const a = poly[j], b = poly[(j + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((a[0] - v[0]) * ey - (a[1] - v[1]) * ex) / den;
        const u = ((a[0] - v[0]) * dy - (a[1] - v[1]) * dx) / den;
        if (t > 1e-7 && u >= -1e-9 && u <= 1 + 1e-9 && (!best || t < best.t)) best = { t, j, p: [v[0] + dx * t, v[1] + dy * t] };
      }
      if (!best) continue;
      const mid = [(v[0] + best.p[0]) / 2, (v[1] + best.p[1]) / 2];
      if (!pointInPoly(mid, poly)) continue;
      const key = [ptKey(v), ptKey(best.p)].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a: v, b: best.p, axis: Math.abs(dx) < 1e-9 || Math.abs(dy) < 1e-9 });
    }
  }
  // corner-to-corner diagonals that stay inside the piece (e.g. cutting a star into point + centre)
  for (let i = 0; i < n; i++) for (let k = i + 2; k < n; k++) {
    if (i === 0 && k === n - 1) continue;
    const a = poly[i], b = poly[k];
    const crosses = poly.some((p, j) => {
      const q = poly[(j + 1) % n];
      if (j === i || j === k || (j + 1) % n === i || (j + 1) % n === k) return false;
      const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      const d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
      const d3 = (q[0] - p[0]) * (a[1] - p[1]) - (q[1] - p[1]) * (a[0] - p[0]);
      const d4 = (q[0] - p[0]) * (b[1] - p[1]) - (q[1] - p[1]) * (b[0] - p[0]);
      return (d1 > 1e-12) !== (d2 > 1e-12) && (d3 > 1e-12) !== (d4 > 1e-12);
    });
    if (crosses || !pointInPoly([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], poly)) continue;
    const key = [ptKey(a), ptKey(b)].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ a, b, axis: Math.abs(a[0] - b[0]) < 1e-9 || Math.abs(a[1] - b[1]) < 1e-9 });
  }
  return out;
}

// Proposed seams for a non-convex piece: continue each edge meeting a reflex corner into the piece.
function autoSeamsFor(poly, arcKeys) {
  const angs = interiorAngles(poly);
  const seams = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    if (angs[i] <= 180.5) continue;
    if (arcKeys && arcKeys.has(ptKey(poly[i]))) continue;   // concave curve, not a corner
    const v = poly[i];
    for (const nb of [poly[(i - 1 + n) % n], poly[(i + 1) % n]]) {
      const dx = v[0] - nb[0], dy = v[1] - nb[1], L = Math.hypot(dx, dy);
      if (L < 1e-9) continue;
      const far = [v[0] + dx / L * 1e4, v[1] + dy / L * 1e4];
      // nearest boundary hit beyond v
      let bestT = Infinity;
      for (let j = 0; j < n; j++) {
        const p = poly[j], q = poly[(j + 1) % n];
        if (j === i || (j + 1) % n === i) continue;
        const ex = q[0] - p[0], ey = q[1] - p[1];
        const rx = far[0] - v[0], ry = far[1] - v[1];
        const den = rx * ey - ry * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((p[0] - v[0]) * ey - (p[1] - v[1]) * ex) / den;
        const u = ((p[0] - v[0]) * ry - (p[1] - v[1]) * rx) / den;
        if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && t < bestT) bestT = t;
      }
      if (bestT < Infinity) {
        const hit = [v[0] + (far[0] - v[0]) * bestT, v[1] + (far[1] - v[1]) * bestT];
        const mid = [(v[0] + hit[0]) / 2, (v[1] + hit[1]) / 2];
        if (pointInPoly(mid, poly)) seams.push([v, hit]);
      }
    }
  }
  return seams;
}

/* ---------- classification ----------
   Rotation-invariant. Grain decides HST vs QST: an HST keeps its legs on the straight
   grain (legs parallel to the block edges), a QST keeps its long side on the grain. */
function classifyPiece(rawPts, opts = {}) {
  const curved = !!opts.curved;
  const pts = curved ? rawPts : cleanPoly(rawPts);
  const n = pts.length;
  const area = polyArea(pts);
  const base = { pts, area, curved };
  if (curved) return { ...base, shape: 'curved' };
  const sides = pts.map((p, i) => dist(p, pts[(i + 1) % n]));
  const angs = interiorAngles(pts);
  const near = (a, b, t = 0.6) => Math.abs(a - b) < t;
  const sameLen = (a, b) => Math.abs(a - b) <= Math.max(a, b) * 0.004 + 1e-6;
  if (n === 3) {
    const ri = angs.findIndex(a => near(a, 90));
    if (ri >= 0) {
      const v = pts[ri], a = pts[(ri + 1) % 3], b = pts[(ri + 2) % 3];
      const l1 = dist(v, a), l2 = dist(v, b);
      if (sameLen(l1, l2)) {
        const legsOnGrain = isAxisDir(v, a) && isAxisDir(v, b);
        const hypOnGrain = isAxisDir(a, b);
        if (!legsOnGrain && hypOnGrain) return { ...base, shape: 'qst', hyp: dist(a, b), leg: l1 };
        return { ...base, shape: 'hst', leg: (l1 + l2) / 2, hyp: dist(a, b) };
      }
      // chirality: is the shorter leg clockwise or counter-clockwise from the longer one?
      const [long, short] = l1 >= l2 ? [a, b] : [b, a];
      const cr = (long[0] - v[0]) * (short[1] - v[1]) - (long[1] - v[1]) * (short[0] - v[0]);
      return { ...base, shape: 'rtri', a: Math.max(l1, l2), b: Math.min(l1, l2), hand: cr > 0 ? 'R' : 'L' };
    }
    if (angs.every(a => near(a, 60, 0.8))) return { ...base, shape: 'tri60', side: sum(sides) / 3, height: sum(sides) / 3 * Math.sqrt(3) / 2 };
    return { ...base, shape: 'tri' };
  }
  if (n === 4) {
    if (angs.every(a => near(a, 90))) {
      return { ...base, shape: 'rect', w: (sides[0] + sides[2]) / 2, h: (sides[1] + sides[3]) / 2 };
    }
    const par = (i, j) => {
      const a = pts[i], b = pts[(i + 1) % 4], c = pts[j], d = pts[(j + 1) % 4];
      const c1 = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      return Math.abs(c1) / (dist(a, b) * dist(c, d)) < 0.004;
    };
    if (par(0, 2) && par(1, 3)) {
      const acute = Math.min(...angs);
      const baseLen = Math.max(sides[0], sides[1]), side = Math.min(sides[0], sides[1]);
      const rhombus = sameLen(sides[0], sides[1]);
      // chirality for non-rhombus parallelograms: from the long edge, does the short edge turn L or R
      let hand = '';
      if (!rhombus) {
        const i = sides[0] >= sides[1] ? 0 : 1;
        const a = pts[i], b = pts[(i + 1) % 4], c = pts[(i + 2) % 4];
        const along = [(b[0] - a[0]) / sides[i], (b[1] - a[1]) / sides[i]];
        const proj = (c[0] - b[0]) * along[0] + (c[1] - b[1]) * along[1];
        const winding = signedArea(pts) > 0 ? 1 : -1;
        hand = proj * winding > 0 ? 'R' : 'L';
      }
      return { ...base, shape: 'para', base: baseLen, side, angle: acute, height: area / baseLen, rhombus, hand };
    }
    // trapezoid: exactly one pair of parallel sides — rotary cut from a strip, alternating 180°
    const pair = par(0, 2) ? 0 : par(1, 3) ? 1 : -1;
    if (pair >= 0) {
      const ia = sides[pair] >= sides[pair + 2] ? pair : pair + 2, ib = ia === pair ? pair + 2 : pair;
      const a = sides[ia], b = sides[ib];
      return { ...base, shape: 'trap', a, b, ia, ib, height: 2 * area / (a + b),
        angles: [angs[ia], angs[(ia + 1) % 4]].map(x => Math.round(Math.min(x, 180 - x))) };
    }
    return { ...base, shape: 'quad' };
  }
  if (n === 6 && sides.every(s => sameLen(s, sides[0])) && angs.every(a => near(a, 120))) {
    return { ...base, shape: 'hex', side: sides[0] };
  }
  return { ...base, shape: 'poly' };
}

const SHAPE_NAMES = {
  trap: 'Trapezoid',
  rect: 'Rectangle', square: 'Square', hst: 'Half-square triangle', qst: 'Quarter-square triangle',
  rtri: 'Right triangle', tri60: 'Equilateral triangle', tri: 'Triangle', para: 'Parallelogram',
  diamond: 'Diamond', quad: 'Four-sided piece', hex: 'Hexagon', poly: 'Template piece', curved: 'Curved piece', holed: 'Ring piece',
};
function shapeName(cls) {
  if (cls.shape === 'rect') return Math.abs(cls.w - cls.h) < 1e-3 ? 'Square' : (Math.max(cls.w, cls.h) / Math.min(cls.w, cls.h) >= 3 ? 'Strip' : 'Rectangle');
  if (cls.shape === 'para') return cls.rhombus ? `${Math.round(cls.angle)}° diamond` : `${Math.round(cls.angle)}° parallelogram`;
  return SHAPE_NAMES[cls.shape] || cls.shape;
}

// Rotation-invariant (but chirality-preserving) signature of an outline, used to group
// identical template pieces regardless of how they sit in the quilt.
function outlineSignature(poly) {
  const p = signedArea(poly) > 0 ? poly : poly.slice().reverse();
  const n = p.length;
  const angs = interiorAngles(p);
  const tok = [];
  for (let i = 0; i < n; i++) tok.push(`${Math.round(dist(p[i], p[(i + 1) % n]) * 32)}/${Math.round(angs[(i + 1) % n] * 2)}`);
  let best = null;
  for (let r = 0; r < n; r++) {
    const s = tok.slice(r).concat(tok.slice(0, r)).join(';');
    if (best === null || s < best) best = s;
  }
  return best;
}

/* ---------- polyline clipping (quilting lines) ---------- */
// Liang–Barsky: parameter interval of segment p0→p1 inside rect, or null.
function segRectInterval(p0, p1, r) {
  let t0 = 0, t1 = 1;
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const tests = [[-dx, p0[0] - r.x], [dx, r.x + r.w - p0[0]], [-dy, p0[1] - r.y], [dy, r.y + r.h - p0[1]]];
  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return t1 - t0 > 1e-9 ? [t0, t1] : null;
}
// Clip a polyline to (inside outer) and optionally (outside inner — one rect or a list).
// Returns polylines.
function clipPolyline(points, outer, inner) {
  const holes = !inner ? [] : Array.isArray(inner) ? inner : [inner];
  const runs = [];
  let cur = null;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const io = segRectInterval(a, b, outer);
    let intervals = io ? [io] : [];
    for (const h of holes) {
      const ii = segRectInterval(a, b, h);
      if (!ii) continue;
      intervals = intervals.flatMap(([t0, t1]) => {
        const keep = [];
        if (ii[0] > t0 + 1e-9) keep.push([t0, Math.min(t1, ii[0])]);
        if (ii[1] < t1 - 1e-9) keep.push([Math.max(t0, ii[1]), t1]);
        return keep;
      });
    }
    for (const [t0, t1] of intervals) {
      const p = lerp(a, b, t0), q = lerp(a, b, t1);
      if (cur && t0 < 1e-9 && dist(cur[cur.length - 1], p) < 1e-6) cur.push(q);
      else { cur = [p, q]; runs.push(cur); }
    }
    if (!intervals.length || intervals[intervals.length - 1][1] < 1 - 1e-9) cur = null;
  }
  return runs;
}
function polylineLength(pl) { let s = 0; for (let i = 0; i + 1 < pl.length; i++) s += dist(pl[i], pl[i + 1]); return s; }
