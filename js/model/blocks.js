/* Blocks: creation, cut-piece extraction, rendering, and sewing-order analysis.

   A drawn block is a layered drawing on an n×n grid. Regions paint in order (later on
   top); whatever isn't covered is quilt background. Cut pieces are the *visible* parts,
   further split by the block's seam lines. Appliqué regions sit on top of the pieced
   block instead of cutting into it.

   A compound block arranges other blocks in slots (grid, columns or rows). */

/* ---------- creation ---------- */
function newDrawnBlock(name = 'New block', n = 4, shape) {
  if (shape === 'hex') return { id: uid('b'), kind: 'drawn', name, n, lattice: 'tri', shape: 'hex', regions: [], seams: [] };
  return { id: uid('b'), kind: 'drawn', name, n, lattice: 'square', regions: [], seams: [] };
}

/* ---------- block outline ----------
   A hexagon block is drawn in the same n×n frame as a square one, as a flat-topped regular
   hexagon touching the left and right edges, lined up with the 60° lattice. In the quilt it
   fills one tile of a hexagon tessellation, so its frame is the tile's point-to-point width. */
const TRI_H = Math.sqrt(3) / 2;
const isHexBlock = b => b?.shape === 'hex';
function hexFrame(n) {
  const c = n / 2, h = n * TRI_H / 2;
  return [[0, c], [n / 4, c - h], [3 * n / 4, c - h], [n, c], [3 * n / 4, c + h], [n / 4, c + h]].map(([x, y]) => [round(x, 6), round(y, 6)]);
}
// Hexagon blocks are stored flat-topped; in pointy-topped hexagon quilts they sit turned 30°,
// and the editor and thumbnails show them that way.
function hexViewAngle(b) { return isHexBlock(b) && doc.layout.tess.orient !== 1 ? 30 : 0; }
// The block's outline in a w×h frame.
function blockOutline(b, w, h = w) {
  if (!isHexBlock(b)) return [[0, 0], [w, 0], [w, h], [0, h]];
  return hexFrame(b.n).map(([x, y]) => [x * w / b.n, y * h / b.n]);
}
// Finished size of the block's drawing frame in the quilt.
function blockFrameSize(b) { return isHexBlock(b) ? 2 * doc.layout.tess.size : doc.layout.blockSize; }
// "12 × 12" for square blocks; "3 side" for hexagons (frame = point-to-point width).
function blockSizeText(b, frame, plus = 0) {
  if (!isHexBlock(b)) return fmtSize(frame + plus, frame + plus);
  const side = frame / 2 + plus / Math.sqrt(3);
  return `${fmtLen(side)} hexagon (${fmtLen(2 * side)} point to point, ${fmtLen(side * Math.sqrt(3))} flat to flat)`;
}
function newCompoundBlock(name = 'New compound') {
  return { id: uid('b'), kind: 'compound', name, sub: { type: 'grid', rows: 2, cols: 2 }, slots: [null, null, null, null] };
}
function addBlockToDoc(block, select = true) {
  doc.blocks[block.id] = block;
  doc.blockOrder.push(block.id);
  if (select) ui.activeBlock = ui.placeBlock = block.id;
  return block.id;
}
function cloneBlock(block) {
  const c = JSON.parse(JSON.stringify(block));
  c.id = uid('b');
  return c;
}

/* ---------- compound slots ---------- */
const SUB_PRESETS = [
  { key: 'g2', label: '2 × 2 grid', sub: { type: 'grid', rows: 2, cols: 2 } },
  { key: 'g3', label: '3 × 3 grid', sub: { type: 'grid', rows: 3, cols: 3 } },
  { key: 'g4', label: '4 × 4 grid', sub: { type: 'grid', rows: 4, cols: 4 } },
  { key: 'g23', label: '2 rows × 3 cols', sub: { type: 'grid', rows: 2, cols: 3 } },
  { key: 'c11', label: '2 columns', sub: { type: 'cols', ratios: [1, 1] } },
  { key: 'c111', label: '3 columns', sub: { type: 'cols', ratios: [1, 1, 1] } },
  { key: 'c121', label: 'Columns 1 : 2 : 1', sub: { type: 'cols', ratios: [1, 2, 1] } },
  { key: 'r11', label: '2 rows', sub: { type: 'rows', ratios: [1, 1] } },
  { key: 'r111', label: '3 rows', sub: { type: 'rows', ratios: [1, 1, 1] } },
  { key: 'r121', label: 'Rows 1 : 2 : 1', sub: { type: 'rows', ratios: [1, 2, 1] } },
];
function subKey(sub) {
  const hit = SUB_PRESETS.find(p => JSON.stringify(p.sub) === JSON.stringify(sub));
  return hit ? hit.key : 'g2';
}
function subRects(sub, w, h) {
  const out = [];
  if (sub.type === 'grid') {
    const cw = w / sub.cols, ch = h / sub.rows;
    for (let r = 0; r < sub.rows; r++) for (let c = 0; c < sub.cols; c++) out.push({ x: c * cw, y: r * ch, w: cw, h: ch });
  } else {
    const tot = sum(sub.ratios);
    let acc = 0;
    for (const q of sub.ratios) {
      if (sub.type === 'cols') out.push({ x: acc / tot * w, y: 0, w: q / tot * w, h });
      else out.push({ x: 0, y: acc / tot * h, w, h: q / tot * h });
      acc += q;
    }
  }
  return out;
}
// Child content is drawn in its own cw×ch frame (swapped for quarter turns) then placed in the slot.
function slotFrame(rect, rot = 0, flip = false) {
  const odd = rot % 2 === 1;
  const cw = odd ? rect.h : rect.w, ch = odd ? rect.w : rect.h;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const tf = `translate(${round(cx, 4)} ${round(cy, 4)}) rotate(${rot * 90}) scale(${flip ? -1 : 1} 1) translate(${round(-cw / 2, 4)} ${round(-ch / 2, 4)})`;
  const a = rot * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  const map = ([x, y]) => {
    let px = x - cw / 2, py = y - ch / 2;
    if (flip) px = -px;
    return [cx + px * c - py * s, cy + px * s + py * c];
  };
  return { cw, ch, tf, map };
}
function wouldCycle(parentId, childId) {
  const stack = [childId], seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === parentId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const b = doc.blocks[id];
    if (b?.kind === 'compound') for (const s of b.slots) if (s?.b) stack.push(s.b);
  }
  return false;
}

/* ---------- geometry ---------- */
function regionRing(region, sx, sy, arcKeys) {
  const pts = region.pts;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], B = pts[(i + 1) % pts.length];
    out.push([A[0] * sx, A[1] * sy]);
    const bl = region.b?.[i] || 0;
    if (bl) {
      for (const q of arcPoints(A, B, bl)) {
        const p = [q[0] * sx, q[1] * sy];
        out.push(p);
        arcKeys?.add(ptKey(p));
      }
    }
  }
  return out;
}
function regionPathD(region, sx, sy = sx) { return polyToPath(regionRing(region, sx, sy), 4); }

function blockKey(block, depth = 0) {
  if (!block) return 'null';
  if (block.kind === 'compound' && depth < 6) {
    return JSON.stringify([block.sub, block.slots.map(s => s ? [blockKey(doc.blocks[s.b], depth + 1), s.r || 0, !!s.f] : null)]);
  }
  return JSON.stringify([block.n, block.regions, block.seams, block.shape || '', block.appSeams || []]);
}

const _pieceCache = new Map();
function clearBlockCaches() { _pieceCache.clear(); _analysisCache.clear(); }

// Visible cut pieces of a block rendered at w×h inches. Fabric ids may be BG.
function blockPieces(block, w, h, depth = 0) {
  if (!block || depth > 6) return [];
  const key = `${blockKey(block)}|${round(w, 4)}|${round(h, 4)}`;
  if (_pieceCache.has(key)) return _pieceCache.get(key);
  let pieces;
  if (block.kind === 'compound') {
    pieces = [];
    const rects = subRects(block.sub, w, h);
    rects.forEach((rect, i) => {
      const slot = block.slots[i];
      const child = slot && doc.blocks[slot.b];
      if (!child) {
        const pts = [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x + rect.w, rect.y + rect.h], [rect.x, rect.y + rect.h]];
        pieces.push(makePiece(pts, [], BG, false, false));
        return;
      }
      const fr = slotFrame(rect, slot.r || 0, !!slot.f);
      for (const p of blockPieces(child, fr.cw, fr.ch, depth + 1)) {
        let pts = p.pts.map(fr.map), holes = p.holes.map(hh => hh.map(fr.map));
        pieces.push(makePiece(pts, holes, p.fab, p.app, p.curved));
      }
    });
  } else {
    pieces = drawnPieces(block, w, h);
  }
  if (_pieceCache.size > 800) _pieceCache.clear();
  _pieceCache.set(key, pieces);
  return pieces;
}
function makePiece(pts, holes, fab, app, curved) {
  const cls = classifyPiece(curved ? pts : dropSpikes(pts), { curved });
  if (holes.length) cls.shape = 'holed';
  return { pts: cls.pts, holes, fab, app: !!app, curved: !!curved, cls, bb: bounds(cls.pts) };
}

function drawnPieces(block, w, h) {
  const sx = w / block.n, sy = h / block.n;
  const arcKeys = new Set();
  const full = blockOutline(block, w, h);
  const rings = block.regions.map(r => regionRing(r, sx, sy, arcKeys));
  const isCurved = (outer, holes) => [outer, ...holes].some(ring => ring.some(p => arcKeys.has(ptKey(p))));
  const raw = [];
  const pieced = block.regions.map((r, i) => ({ r, i })).filter(x => !x.r.app && x.r.pts.length >= 2);
  const applique = block.regions.map((r, i) => ({ r, i })).filter(x => x.r.app && x.r.pts.length >= 2);
  // pieced layers: each region minus everything painted above it, clipped to the block
  for (let k = 0; k < pieced.length; k++) {
    const { r, i } = pieced[k];
    const above = pieced.slice(k + 1).map(x => toPC(rings[x.i]));
    let mp = pcSafe('intersection', toPC(rings[i]), toPC(full));
    if (mp && above.length) mp = pcSafe('difference', mp, ...above);
    for (const pg of fromPC(mp)) raw.push({ outer: pg.outer, holes: pg.holes, fab: r.fab, app: false });
  }
  // background = whatever no pieced region covers
  const allPieced = pieced.map(x => toPC(rings[x.i]));
  const bgMp = allPieced.length ? pcSafe('difference', toPC(full), ...allPieced) : [toPC(full)];
  for (const pg of fromPC(bgMp)) raw.push({ outer: pg.outer, holes: pg.holes, fab: BG, app: false });
  // appliqué stacks only among itself
  for (let k = 0; k < applique.length; k++) {
    const { r, i } = applique[k];
    const above = applique.slice(k + 1).map(x => toPC(rings[x.i]));
    let mp = pcSafe('intersection', toPC(rings[i]), toPC(full));
    if (mp && above.length) mp = pcSafe('difference', mp, ...above);
    for (const pg of fromPC(mp)) raw.push({ outer: pg.outer, holes: pg.holes, fab: r.fab, app: true });
  }
  // seams split pieced (not appliqué) pieces
  const seams = (block.seams || []).map(([A, B]) => [[A[0] * sx, A[1] * sy], [B[0] * sx, B[1] * sy]]);
  let list = raw.map(p => ({ pts: p.outer, holes: p.holes, fab: p.fab, app: p.app }));
  // appSeams cut appliqué (and lettering) into pieces sewn as one shape
  const appSeams = (block.appSeams || []).map(([A, B]) => [[A[0] * sx, A[1] * sy], [B[0] * sx, B[1] * sy]]);
  if (seams.length || appSeams.length) {
    const pc = list.filter(p => !p.app), ap = list.filter(p => p.app);
    list = [...(seams.length ? splitBySeams(pc, seams) : pc), ...(appSeams.length ? splitBySeams(ap, appSeams) : ap)];
  }
  return list
    .filter(p => polyArea(p.pts) - sum(p.holes, polyArea) > w * h * 1e-6)
    .map(p => makePiece(p.pts, p.holes, p.fab, p.app, isCurved(p.pts, p.holes)));
}

// Pieces that can't be sewn with straight seams as drawn (need seam lines added).
function pieceProblems(block, size) {
  if (!block || block.kind !== 'drawn') return [];
  const out = [];
  for (const p of blockPieces(block, size, size)) {
    if (p.app) continue;
    if (p.holes.length) out.push({ piece: p, kind: 'hole', msg: 'Piece surrounds another piece (has a hole)' });
    else if (!p.curved && !isConvex(p.pts)) out.push({ piece: p, kind: 'concave', msg: 'Piece has an inside corner (needs a set-in seam)' });
    const mar = minAreaRect(p.pts);
    if (mar && Math.min(mar.w, mar.h) < 0.249) out.push({ piece: p, kind: 'tiny', msg: `Very narrow piece (${fmtLen(Math.min(mar.w, mar.h))} finished)` });
  }
  return out;
}

// Blocks in the quilt with pieces that can't be sewn as drawn. The block editor stays quiet about
// these while you draw; Layout, Fabric & cutting and Pattern mention them.
function seamWarnings() {
  return doc.blockOrder.map(id => doc.blocks[id]).filter(b => b?.kind === 'drawn' && blockUseCount(b.id) && pieceProblems(b, blockFrameSize(b)).some(p => p.kind !== 'tiny'))
    .map(b => `${b.name} needs set-in seams as drawn. The Seam tool in Blocks can fix that.`);
}

/* ---------- seam suggestions ----------
   A small search: for each piece, try seams that start at a corner (edge continuations and
   grain lines), score the resulting pieces by how easy they are to cut and sew, and keep the
   cheapest set. Pieces that can't be sewn as drawn get "required" seams; awkward template
   pieces that become rotary-cut shapes get "optional" ones. */
const PIECE_COST = { rect: 1, hst: 1.4, qst: 1.4, rtri: 1.8, tri60: 2, trap: 2.2, para: 2.2, hex: 3, curved: 3, tri: 4.5, quad: 4.5, poly: 5 };
const STANDARD_COST = 3.1;   // anything at or below this is a rotary-cut shape (cost + per-piece overhead)
function pieceCost(pts, scale) {
  const cls = classifyPiece(pts);
  let c = (PIECE_COST[cls.shape] ?? 5) + 0.8;          // + per-piece sewing overhead
  if (!isConvex(cls.pts)) c += 20;                      // needs a set-in seam: worth several extra seams to avoid
  const mar = minAreaRect(cls.pts);
  if (mar && Math.min(mar.w, mar.h) * scale < 0.5) c += 6;   // finished narrower than ½"
  return c;
}
const MIN_PIECE_COST = PIECE_COST.rect + 0.8;
// memo: canonical outline → { budget, cost, seams }. A result found with a bigger search budget
// is reused for smaller ones (it's a valid, at-least-as-good decomposition).
function optimizePiece(poly, scale, depth, memo, maxDepth = 4) {
  const budget = maxDepth - depth;
  const key = poly.map(ptKey).sort().join(';');
  const hit = memo.get(key);
  if (hit && hit.budget >= budget) return hit;
  let best = { cost: pieceCost(poly, scale), seams: [], budget };
  if (budget > 0 && best.cost > STANDARD_COST) {
    // grain-line and edge-continuation seams first; corner diagonals after
    const cands = chordCandidates(poly).sort((a, b) => (b.axis - a.axis)).slice(0, depth === 0 ? 40 : 24);
    for (const c of cands) {
      if (best.cost <= 2 * MIN_PIECE_COST + 0.3) break;      // can't do better than two plain pieces
      const parts = splitPolyByPoints(poly, c.a, c.b);
      if (!parts) continue;
      const r1 = optimizePiece(parts[0], scale, depth + 1, memo, maxDepth);
      if (r1.cost + MIN_PIECE_COST >= best.cost - 0.3) continue;
      const r2 = optimizePiece(parts[1], scale, depth + 1, memo, maxDepth);
      const cost = r1.cost + r2.cost + (c.axis ? 0 : 0.1);   // small preference for straight-grain seams
      if (cost < best.cost - 0.3) best = { cost, seams: [[c.a, c.b], ...r1.seams, ...r2.seams], budget };
    }
  }
  memo.set(key, best);
  return best;
}
// A piece that surrounds another: try a seam along each edge of the hole, carried across the
// whole piece, then optimise the opened-up parts.
function optimizeHoled(p, scale, memo) {
  let best = null;
  for (const hole of p.holes) for (let k = 0; k < hole.length; k++) {
    const A = hole[k], B = hole[(k + 1) % hole.length];
    const parts = splitRegionByLine(p.pts, p.holes, A, B);
    if (!parts || parts.some(x => x.holes.length)) continue;
    const { chords } = lineChords(p.pts, p.holes, A, B);
    if (!chords.length) continue;
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const t0 = Math.min(...chords.map(c => c[0])), t1 = Math.max(...chords.map(c => c[1]));
    let cost = 0;
    const seams = [[[A[0] + dx * t0, A[1] + dy * t0], [A[0] + dx * t1, A[1] + dy * t1]]];
    for (const part of parts) { const r = optimizePiece(cleanPoly(part.outer), scale, 0, memo, 3); cost += r.cost; seams.push(...r.seams); }
    if (!best || cost < best.cost) best = { cost, seams };
  }
  return best;
}
const _seamCache = new Map();
function seamSuggestions(block) {
  if (!block || block.kind !== 'drawn') return { required: [], optional: [], reqPieces: 0, optPieces: 0, unresolved: 0 };
  const key = blockKey(block) + '|' + blockFrameSize(block);
  if (_seamCache.has(key)) return _seamCache.get(key);
  const n = block.n, scale = blockFrameSize(block) / n;
  const memo = new Map();
  const res = { required: [], optional: [], reqPieces: 0, optPieces: 0, unresolved: 0 };
  for (const p of blockPieces(block, n, n)) {
    if (p.app || p.curved) continue;
    if (p.holes.length) {
      const r = optimizeHoled(p, scale, memo);
      if (r) { res.required.push(...r.seams); res.reqPieces++; } else res.unresolved++;
      continue;
    }
    const concave = !isConvex(p.pts);
    const base = pieceCost(p.pts, scale);
    if (!concave && base <= STANDARD_COST) continue;
    // many-cornered concave shapes (stars) get one more level of search
    const r = optimizePiece(p.pts, scale, 0, memo, concave && p.pts.length >= 7 ? 4 : 3);
    if (!r.seams.length) { if (concave) res.unresolved++; continue; }
    if (concave) { res.required.push(...r.seams); res.reqPieces++; }
    else if (base - r.cost >= 1) { res.optional.push(...r.seams); res.optPieces++; }
  }
  const norm = s => s.map(([a, b]) => [[round(a[0], 6), round(a[1], 6)], [round(b[0], 6), round(b[1], 6)]]);
  const k2 = ([a, b]) => [ptKey(a), ptKey(b)].sort().join('|');
  const seen = new Set((block.seams || []).map(k2));
  const dedupe = list => norm(list).filter(s => { const k = k2(s); if (seen.has(k)) return false; seen.add(k); return true; });
  res.required = dedupe(res.required);
  res.optional = dedupe(res.optional);
  // Per-piece seams can be individually perfect yet not line up across the block (leaving a
  // Y-seam). If so, try carrying each seam straight across the whole block instead.
  const trial = extra => analyzeBlock({ ...block, seams: [...(block.seams || []), ...extra] }, n);
  const all = [...res.required, ...res.optional];
  if (all.length && trial(all).setIn) {
    const across = ([a, b]) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      const p = [[a[0] - dx / L * 4 * n, a[1] - dy / L * 4 * n], [a[0] + dx / L * 4 * n, a[1] + dy / L * 4 * n]];
      const iv = segRectInterval(p[0], p[1], { x: 0, y: 0, w: n, h: n });
      if (!iv) return [a, b];
      const at = t => [round(p[0][0] + (p[1][0] - p[0][0]) * t, 6), round(p[0][1] + (p[1][1] - p[0][1]) * t, 6)];
      return [at(iv[0]), at(iv[1])];
    };
    const req2 = dedupe2(res.required.map(across)), opt2 = dedupe2(res.optional.map(across), req2);
    if (!trial([...req2, ...opt2]).setIn) { res.required = req2; res.optional = opt2; res.extended = true; }
  }
  res.setInAfter = all.length ? trial([...res.required, ...res.optional]).setIn : false;
  if (_seamCache.size > 200) _seamCache.clear();
  _seamCache.set(key, res);
  return res;
}
function dedupe2(list, already = []) {
  const k = ([a, b]) => [ptKey(a), ptKey(b)].sort().join('|');
  const seen = new Set(already.map(k));
  return list.filter(x => { const kk = k(x); if (seen.has(kk)) return false; seen.add(kk); return true; });
}
// Back-compat helper: every suggested seam (required first).
function suggestSeams(block) { const s = seamSuggestions(block); return [...s.required, ...s.optional]; }

/* ---------- rendering ---------- */
// SVG content for a block in a w×h frame. opts: { seams, pieces (outline cut pieces), ids }
function blockSvg(block, w, h, opts = {}, depth = 0) {
  if (!block) return '';
  if (depth > 6) return `<rect width="${w}" height="${h}" fill="#fdd"/>`;
  const hair = Math.min(w, h) * 0.0025;
  if (block.kind === 'compound') {
    let s = '';
    subRects(block.sub, w, h).forEach((rect, i) => {
      const slot = block.slots[i];
      const child = slot && doc.blocks[slot.b];
      const tag = opts.slots ? ` data-slot="${i}" class="slot${opts.activeSlot === i ? ' slot-active' : ''}"` : '';
      if (!child) {
        s += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${fabricFill(BG)}"/>`;
        if (opts.slots) s += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="rgba(255,255,255,.55)" stroke="#8a95a3" stroke-width="${hair * 2}" stroke-dasharray="${hair * 8} ${hair * 6}"${tag}/>`;
        return;
      }
      const fr = slotFrame(rect, slot.r || 0, !!slot.f);
      s += `<g transform="${fr.tf}">${blockSvg(child, fr.cw, fr.ch, { seams: opts.seams }, depth + 1)}</g>`;
      if (opts.slots) s += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="transparent"${tag}/>`;
    });
    return s;
  }
  const sx = w / block.n, sy = h / block.n;
  // nested <svg> = viewport clip, so shapes that run past the block edge are trimmed visually.
  // The clip sits a hair outside the block so each piece's edge stroke fully covers the
  // block's outermost pixels — otherwise the background square shows through as a faint line.
  const e = hair;
  let s = `<svg x="${-e}" y="${-e}" width="${w + 2 * e}" height="${h + 2 * e}" viewBox="${-e} ${-e} ${w + 2 * e} ${h + 2 * e}" overflow="hidden">`;
  // hexagon blocks clip to their outline (again a hair outside it)
  const hex = isHexBlock(block);
  if (hex) {
    const cid = uid('hx'), k = 1 + 2 * e / w;
    s += `<clipPath id="${cid}"><path d="${polyToPath(blockOutline(block, w, h).map(([x, y]) => [w / 2 + (x - w / 2) * k, h / 2 + (y - h / 2) * k]), 4)}"/></clipPath><g clip-path="url(#${cid})">`;
  }
  // Paint only the background that is actually uncovered (not a full square underneath):
  // a square under everything bleeds through the anti-aliased block edges as a faint line.
  const bgFill = fabricFill(BG);
  for (const p of blockPieces(block, w, h)) {
    if (p.fab === BG && !p.app) s += `<path d="${polyToPath(p.pts)}${p.holes.map(hh => polyToPath(hh)).join('')}" fill="${bgFill}" fill-rule="evenodd" stroke="${bgFill}" stroke-width="${hair}" stroke-linejoin="round"/>`;
  }
  const order = [...block.regions.map((r, i) => ({ r, i })).filter(x => !x.r.app), ...block.regions.map((r, i) => ({ r, i })).filter(x => x.r.app)];
  for (const { r, i } of order) {
    if (r.pts.length < 2) continue;
    const fill = fabricFill(r.fab);
    const id = opts.ids ? ` data-region="${i}"` : '';
    s += `<path d="${regionPathD(r, sx, sy)}" fill="${fill}" stroke="${fill}" stroke-width="${hair}" stroke-linejoin="round"${id}/>`;
  }
  s += hex ? `</g></svg>` : `</svg>`;
  if (opts.seams && (block.seams?.length || block.appSeams?.length)) {
    for (const [A, B] of [...(block.seams || []), ...(block.appSeams || [])]) {
      s += `<line x1="${A[0] * sx}" y1="${A[1] * sy}" x2="${B[0] * sx}" y2="${B[1] * sy}" stroke="rgba(20,24,30,.6)" stroke-width="${hair * 1.4}"/>`;
    }
  }
  if (opts.pieces) {
    for (const p of blockPieces(block, w, h)) {
      s += `<path d="${polyToPath(p.pts)}" fill="none" stroke="rgba(20,30,40,.55)" stroke-width="${hair * 2}" stroke-dasharray="${hair * 6} ${hair * 3}" pointer-events="none"/>`;
    }
  }
  return s;
}
function blockThumb(block, px = 64, cls = 'thumb') {
  const S = 12, a = hexViewAngle(block);
  return `<svg class="${cls}" viewBox="0 0 ${S} ${S}" width="${px}" height="${px}" aria-hidden="true">${a ? `<g transform="rotate(${a} ${S / 2} ${S / 2})">` : ''}${blockSvg(block, S, S)}${a ? '</g>' : ''}</svg>`;
}
function blockFabrics(block, depth = 0) {
  const set = new Set();
  if (!block || depth > 6) return set;
  if (block.kind === 'compound') {
    for (const s of block.slots) if (s?.b) for (const f of blockFabrics(doc.blocks[s.b], depth + 1)) set.add(f);
    if (block.slots.some(s => !s)) set.add(BG);
  } else {
    for (const r of block.regions) set.add(r.fab);
    set.add(BG);
  }
  return set;
}

/* ---------- sewing-order analysis ----------
   Pieced blocks are sewn with straight "guillotine" seams: find full-length lines no piece
   crosses, split there, recurse. Leaves are units (HST, flying geese…) or single pieces.
   A leaf that still holds several pieces with no straight split needs set-in (Y) seams. */
const _analysisCache = new Map();
function analyzeBlock(block, size) {
  const key = `${blockKey(block)}|${round(size, 4)}`;
  if (_analysisCache.has(key)) return _analysisCache.get(key);
  const all = blockPieces(block, size, size);
  const pieced = all.filter(p => !p.app);
  const applique = all.filter(p => p.app);
  const root = splitNode(pieced, blockOutline(block, size), size * 1e-5);
  const units = [];
  walkTree(root, n => { if (!n.children.length) { n.unit = n.unit || classifyUnit(n); units.push(n); } });
  const height = treeHeight(root);
  const res = { root, units, height, applique, setIn: units.some(u => u.unit.type === 'complex'), size };
  if (_analysisCache.size > 300) _analysisCache.clear();
  _analysisCache.set(key, res);
  return res;
}
// Candidate seam lines = lines through straight piece edges. A line is a valid seam for this
// node when no piece straddles it. Parallel valid lines split the node into rows/strips.
function splitNode(pieces, region, tol) {
  const node = { region, rect: bounds(region), pieces, children: [], dir: null, normal: null };
  if (pieces.length <= 1) return node;
  const groups = new Map();
  for (const p of pieces) {
    const pts = p.pts, n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const L = dist(a, b);
      if (L < tol * 10 || (p.curved && !isAxisDir(a, b))) continue;
      let nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
      if (nx < -1e-9 || (Math.abs(nx) < 1e-9 && ny < 0)) { nx = -nx; ny = -ny; }   // canonical normal
      const angKey = Math.round(Math.atan2(ny, nx) * 1e4);
      const off = nx * a[0] + ny * a[1];
      let g = groups.get(angKey);
      if (!g) { g = { n: [nx, ny], offs: new Map() }; groups.set(angKey, g); }
      g.offs.set(Math.round(off / tol), off);
    }
  }
  const valid = [];
  for (const g of groups.values()) {
    const offs = [];
    for (const off of g.offs.values()) {
      let lo = 0, hi = 0, ok = true;
      for (const p of pieces) {
        let mn = Infinity, mx = -Infinity;
        for (const q of p.pts) { const s = g.n[0] * q[0] + g.n[1] * q[1] - off; if (s < mn) mn = s; if (s > mx) mx = s; }
        if (mn < -tol && mx > tol) { ok = false; break; }
        if (mx > tol) hi++; else if (mn < -tol) lo++; else { ok = false; break; }
      }
      if (ok && lo && hi) offs.push(off);
    }
    if (offs.length) {
      const axis = Math.abs(g.n[0]) < 1e-6 || Math.abs(g.n[1]) < 1e-6;
      valid.push({ n: g.n, offs: offs.sort((a, b) => a - b), axis, rows: Math.abs(g.n[0]) < 1e-6 });
    }
  }
  const pickBest = list => list.sort((a, b) => (b.offs.length - a.offs.length) || (b.rows - a.rows))[0];
  let choice = pickBest(valid.filter(v => v.axis));
  if (!choice) {
    const unit = classifyUnit(node);
    if (unit.type !== 'complex') { node.unit = unit; return node; }
    choice = pickBest(valid);
  }
  if (!choice) return node;
  const [nx, ny] = choice.n;
  node.normal = choice.n;
  node.dir = choice.axis ? (choice.rows ? 'rows' : 'cols') : 'diag';
  const cuts = [-Infinity, ...choice.offs, Infinity];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const lo = cuts[i], hi = cuts[i + 1];
    const ps = pieces.filter(p => { const c = centroid(p.pts); const s = nx * c[0] + ny * c[1]; return s > lo && s < hi; });
    if (!ps.length) continue;
    let sub = region;
    if (lo > -Infinity) sub = clipHalfplane(sub, [nx, ny], lo, true);
    if (hi < Infinity) sub = clipHalfplane(sub, [nx, ny], hi, false);
    node.children.push(splitNode(ps, sub, tol));
  }
  return node;
}
function walkTree(n, fn) { fn(n); for (const c of n.children) walkTree(c, fn); }
function treeHeight(n) { return n.children.length ? 1 + Math.max(...n.children.map(treeHeight)) : 0; }

function classifyUnit(node) {
  const ps = node.pieces, r = node.rect;
  const shapes = ps.map(p => p.cls.shape);
  const count = s => shapes.filter(x => x === s).length;
  const fabs = uniq(ps.map(p => resolveFab(p.fab)));
  if (ps.length === 1) return { type: 'piece' };
  if (ps.some(p => p.curved)) return { type: 'curved', fabs };
  const square = Math.abs(r.w - r.h) < 1e-3 * r.w;
  if (ps.length === 2 && count('hst') === 2 && square) return { type: 'hst', fabs };
  if (ps.length === 2 && count('rtri') === 2) return { type: 'hrt', fabs };
  if (ps.length === 4 && count('qst') === 4 && square) return { type: 'qst', fabs };
  if (ps.length === 3 && count('qst') === 1 && count('hst') === 2) {
    const goose = ps.find(p => p.cls.shape === 'qst'), sky = ps.find(p => p.cls.shape === 'hst');
    return { type: 'goose', goose: resolveFab(goose.fab), sky: resolveFab(sky.fab), fabs };
  }
  // stitch-and-flip: one main piece plus right-isosceles corner triangles on the unit's corners
  const tol = 1e-4 * Math.max(r.w, r.h);
  const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  const isCornerTri = p => p.cls.shape === 'hst' && corners.some(c => {
    const i = p.pts.findIndex(q => dist(q, c) < tol);
    if (i < 0) return false;
    const a = p.pts[(i + 2) % 3], b = p.pts[(i + 1) % 3];
    return isAxisDir(c, a) && isAxisDir(c, b);
  });
  const tris = ps.filter(isCornerTri);
  if (tris.length && tris.length === ps.length - 1) {
    const main = ps.find(p => !tris.includes(p));
    const rectArea = r.w * r.h;
    const smallCorners = tris.every(t => t.cls.leg <= Math.min(r.w, r.h) * 0.5 + tol);
    const mainNeedsTemplate = !['rect', 'hst', 'qst', 'rtri', 'para', 'trap', 'tri60'].includes(main?.cls.shape);
    if (main && !main.curved && smallCorners && mainNeedsTemplate && Math.abs(main.cls.area + sum(tris, t => t.cls.area) - rectArea) < rectArea * 1e-3) {
      return { type: 'snowball', main, corners: tris, fabs };
    }
  }
  return { type: 'complex', fabs };
}

// Sutherland–Hodgman clip of a convex polygon against n·p ≥ off (keepAbove) or ≤ off.
function clipHalfplane(poly, n, off, keepAbove) {
  const s = p => (n[0] * p[0] + n[1] * p[1] - off) * (keepAbove ? 1 : -1);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = s(a), sb = s(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// Piece offsets for an "exploded" diagram: nodes of height ≥ level have their children pulled
// apart along the node's split normal. Children are spaced by their own exploded extent, so
// `gap` separates them however deep the tree goes (a log cabin's spiral). Each entry's `part` is
// the sewn part it belongs to at this level: the largest node that isn't pulled apart.
function explodedPieces(analysis, level, gap) {
  const lay = node => {
    if (!node.children.length) return node.pieces.map(p => ({ p, dx: 0, dy: 0, unit: node }));
    const apart = treeHeight(node) >= level, [nx, ny] = node.normal;
    let prev = null;
    return node.children.flatMap(c => {
      const list = lay(c);
      if (!apart) return list;
      let lo = Infinity, hi = -Infinity;
      for (const x of list) { x.part ??= c; for (const q of x.p.pts) { const s = nx * (q[0] + x.dx) + ny * (q[1] + x.dy); lo = Math.min(lo, s); hi = Math.max(hi, s); } }
      const k = prev === null ? 0 : prev + gap - lo;
      for (const x of list) { x.dx += nx * k; x.dy += ny * k; }
      prev = hi + k;
      return list;
    });
  };
  const out = lay(analysis.root);
  for (const x of out) x.part ??= analysis.root;
  return out;
}
