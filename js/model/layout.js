/* Quilt layout engine. Every setting (straight grid, on-point, tessellation) is turned into
   one flat description of the top in quilt inches:
     cells   — block positions holding a block or a plain fabric: squares (maybe on point), inset
               panels, and hexagon tiles holding a hexagon block (cells with `clip` are cut off by
               an edge or panel: made whole, trimmed after assembly)
     tiles   — tessellation shapes (and on-point setting triangles), each a polygon + fabric
     patches — sashing, cornerstones and borders
   Rendering, cutting, quilting lines and the printed pattern all consume this. */

const TESS_SHAPES = [
  { key: 'square', label: 'Squares', ratio: 1, lean: 0, orientLabels: ['Straight', 'On point'] },
  { key: 'hex', label: 'Hexagons', ratio: 1, lean: 0, orientLabels: ['Pointy top', 'Flat top'] },
  { key: 'triangle', label: 'Triangles', ratio: 1, lean: 0, orientLabels: ['Rows', 'Columns'] },
  { key: 'tumbling', label: 'Tumbling blocks (3D cubes)', ratio: 1, lean: 0, orientLabels: ['Upright', 'Sideways'] },
  { key: 'zigzag', label: 'Lightning / zigzag', ratio: 0.5, lean: 0.5, orientLabels: ['Vertical bolts', 'Horizontal chevrons'] },
  { key: 'brick', label: 'Bricks', ratio: 0.5, lean: 0, orientLabels: ['Horizontal', 'Vertical'] },
  { key: 'diamond', label: 'Diamonds (argyle)', ratio: 1.6, lean: 0, orientLabels: ['Tall', 'Wide'] },
];
const tessShape = key => TESS_SHAPES.find(s => s.key === key) || TESS_SHAPES[0];

const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/* ---------- tile lattices (unclipped, covering [0,W]×[0,H]) ---------- */
function latticeTiles(shape, s, ratio, lean, orient, W, H) {
  // orient 1 = generate in the transposed frame, then swap x/y back
  const T = orient === 1 && shape !== 'square';
  const [GW, GH] = T ? [H, W] : [W, H];
  const out = [];
  const push = (key, pts, row, col, o = 0) => out.push({ key, pts: T ? pts.map(([x, y]) => [y, x]) : pts, row: T ? col : row, col: T ? row : col, orient: o });
  if (shape === 'square') {
    if (orient === 1) {
      const d = s * Math.SQRT2;
      for (let i = -1; i <= Math.ceil(H / d) + 1; i++) for (let j = -1; j <= Math.ceil(W / d) + 1; j++) {
        for (const [k, cx, cy] of [['A', (j + .5) * d, (i + .5) * d], ['B', j * d, i * d]]) {
          out.push({ key: `${k}${i},${j}`, pts: [[cx, cy - d / 2], [cx + d / 2, cy], [cx, cy + d / 2], [cx - d / 2, cy]], row: i, col: j, orient: k === 'A' ? 0 : 1 });
        }
      }
    } else {
      for (let i = 0; i < Math.ceil(H / s - 1e-9); i++) for (let j = 0; j < Math.ceil(W / s - 1e-9); j++) out.push({ key: `${i},${j}`, pts: rectPts(j * s, i * s, s, s), row: i, col: j, orient: (i + j) % 2 });
    }
  } else if (shape === 'hex' || shape === 'tumbling') {
    const w = Math.sqrt(3) * s, rh = 1.5 * s;
    for (let i = -1; i <= Math.ceil(GH / rh) + 1; i++) for (let j = -1; j <= Math.ceil(GW / w) + 1; j++) {
      const cx = j * w + (Math.abs(i) % 2 ? w / 2 : 0), cy = i * rh;
      const v = k => [cx + s * Math.cos((-90 + 60 * k) * Math.PI / 180), cy + s * Math.sin((-90 + 60 * k) * Math.PI / 180)];
      if (shape === 'hex') push(`${i},${j}`, [0, 1, 2, 3, 4, 5].map(v), i, j);
      else {
        const c = [cx, cy];
        push(`${i},${j},0`, [c, v(5), v(0), v(1)], i, j, 0);   // top
        push(`${i},${j},1`, [c, v(1), v(2), v(3)], i, j, 1);   // right
        push(`${i},${j},2`, [c, v(3), v(4), v(5)], i, j, 2);   // left
      }
    }
  } else if (shape === 'triangle') {
    const h = s * Math.sqrt(3) / 2;
    for (let i = -1; i <= Math.ceil(GH / h) + 1; i++) for (let k = -2; k <= Math.ceil(GW / (s / 2)) + 2; k++) {
      const y = i * h, x = k * s / 2;
      const up = ((i + k) % 2 + 2) % 2 === 0;
      push(`${i},${k}`, up ? [[x - s / 2, y + h], [x, y], [x + s / 2, y + h]] : [[x - s / 2, y], [x + s / 2, y], [x, y + h]], i, k, up ? 0 : 1);
    }
  } else if (shape === 'zigzag') {
    const w = s, h = s * ratio, a = s * lean;
    for (let i = -1; i <= Math.ceil(GH / h) + 1; i++) for (let j = -2; j <= Math.ceil(GW / w) + 2; j++) {
      const y = i * h, x = j * w, odd = ((i % 2) + 2) % 2 === 1;
      const pts = odd ? [[x, y], [x + w, y], [x + w + a, y + h], [x + a, y + h]] : [[x + a, y], [x + w + a, y], [x + w, y + h], [x, y + h]];
      push(`${i},${j}`, pts, i, j, odd ? 1 : 0);
    }
  } else if (shape === 'brick') {
    const w = s, h = s * ratio;
    for (let i = -1; i <= Math.ceil(GH / h) + 1; i++) for (let j = -2; j <= Math.ceil(GW / w) + 1; j++) {
      const x = j * w + (((i % 2) + 2) % 2 ? w / 2 : 0);
      push(`${i},${j}`, rectPts(x, i * h, w, h), i, j, ((i % 2) + 2) % 2);
    }
  } else if (shape === 'diamond') {
    const w = s, h = s * ratio;
    for (let i = -1; i <= Math.ceil(GH / h) + 1; i++) for (let j = -1; j <= Math.ceil(GW / w) + 1; j++) {
      for (const [k, cx, cy] of [['A', (j + .5) * w, (i + .5) * h], ['B', j * w, i * h]]) {
        push(`${k}${i},${j}`, [[cx, cy - h / 2], [cx + w / 2, cy], [cx, cy + h / 2], [cx - w / 2, cy]], i * 2 + (k === 'A' ? 1 : 0), j, k === 'A' ? 0 : 1);
      }
    }
  }
  return out;
}
// Repeat period of a lattice (so a size can be snapped to whole tiles).
function tessPeriod(t) {
  const s = t.size, sh = t.shape;
  let p;
  if (sh === 'square') p = t.orient === 1 ? [s * Math.SQRT2, s * Math.SQRT2] : [s, s];
  else if (sh === 'hex' || sh === 'tumbling') p = [Math.sqrt(3) * s, 3 * s];
  else if (sh === 'triangle') p = [s, s * Math.sqrt(3)];
  else if (sh === 'zigzag') p = [s, 2 * s * t.ratio];
  else if (sh === 'brick') p = [s, 2 * s * t.ratio];
  else p = [s, s * t.ratio];
  return (t.orient === 1 && sh !== 'square') ? [p[1], p[0]] : p;
}

// Centre size of a tessellation; snapped to the lattice repeat unless the user turned that off.
function tessSize(t) {
  if (t.snap === false) return [t.width, t.height];
  const [px, py] = tessPeriod(t);
  return [round(Math.max(px, Math.round(t.width / px) * px), 4), round(Math.max(py, Math.round(t.height / py) * py), 4)];
}
// Gap-fill pieces smaller than a quarter of a shape are joined to a neighbouring gap piece,
// so the cutting plan doesn't ask for slivers.
function mergeSmallFills(fills, tileArea) {
  const shares = (a, b) => {
    for (let i = 0; i < a.length; i++) {
      const p = a[i], q = a[(i + 1) % a.length];
      for (let j = 0; j < b.length; j++) {
        const r = b[j], s = b[(j + 1) % b.length];
        const d1 = Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
        const d2 = Math.abs((q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]));
        if (d1 < 1e-6 && d2 < 1e-6) {
          // collinear edges: check they overlap by more than a hair
          const L = dist(p, q), ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L;
          const t1 = (r[0] - p[0]) * ux + (r[1] - p[1]) * uy, t2 = (s[0] - p[0]) * ux + (s[1] - p[1]) * uy;
          if (Math.min(L, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)) > 1e-3) return true;
        }
      }
    }
    return false;
  };
  let list = fills.slice();
  const stuck = new Set();
  for (let guard = 0; guard < 2000; guard++) {
    const small = list.find(f => !stuck.has(f) && polyArea(f.pts) < tileArea * 0.25);
    if (!small) break;
    const nb = list.filter(f => f !== small && shares(small.pts, f.pts)).sort((a, b) => polyArea(a.pts) - polyArea(b.pts))[0];
    const u = nb ? polyUnion([small.pts, nb.pts]) : [];
    if (u.length !== 1 || u[0].holes.length) { stuck.add(small); continue; }
    list = list.filter(f => f !== small && f !== nb);
    list.push({ ...nb, pts: cleanPoly(u[0].outer), full: null });
  }
  return list;
}
// Where an inset panel sits in a tessellation: centred, offset by (dx, dy), its frames around it.
function panelGeom(p, cw, ch) {
  const fw = sum(p.frames || [], f => f.width > 0 ? f.width : 0);
  const outer = p.size + 2 * fw;
  const cx = cw / 2 + (p.dx || 0), cy = ch / 2 + (p.dy || 0);
  return { p, fw, outer, cx, cy, x0: cx - outer / 2, y0: cy - outer / 2 };
}
function clipToRect(pts, W, H) {
  const bb = bounds(pts);
  if (bb.minX >= -1e-9 && bb.minY >= -1e-9 && bb.maxX <= W + 1e-9 && bb.maxY <= H + 1e-9) return pts;   // already inside
  let p = pts;
  p = clipHalfplane(p, [1, 0], 0, true); if (p.length < 3) return null;
  p = clipHalfplane(p, [1, 0], W, false); if (p.length < 3) return null;
  p = clipHalfplane(p, [0, 1], 0, true); if (p.length < 3) return null;
  p = clipHalfplane(p, [0, 1], H, false); if (p.length < 3) return null;
  p = cleanPoly(p);
  return p.length >= 3 && polyArea(p) > 1e-4 ? p : null;
}

/* ---------- build ---------- */
function buildQuilt() {
  const L = doc.layout, BS = L.blockSize;
  const Q = { mode: L.mode, BS, cells: [], tiles: [], patches: [], panels: [], warnings: [] };
  const off = sum(L.borders, b => b.width);
  let cw = 0, ch = 0;

  if (L.mode === 'grid') {
    const g = L.grid, sw = g.sashing.width > 0 ? g.sashing.width : 0;
    const o = sw && g.sashing.outer ? sw : 0, pitch = BS + sw;
    cw = g.cols * BS + (g.cols - 1) * sw + 2 * o;
    ch = g.rows * BS + (g.rows - 1) * sw + 2 * o;
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c, x = off + o + c * pitch, y = off + o + r * pitch;
      Q.cells.push(makeCell(`g${i}`, g.cells[i], x + BS / 2, y + BS / 2, 0, BS, r, c));
    }
    if (sw) {
      const sf = g.sashing.fabric, cf = g.sashing.cornerstones ? g.sashing.cornerFabric : sf;
      const vGaps = []; for (let c = o ? 0 : 1; c <= (o ? g.cols : g.cols - 1); c++) vGaps.push(off + o + c * pitch - sw);
      const hGaps = []; for (let r = o ? 0 : 1; r <= (o ? g.rows : g.rows - 1); r++) hGaps.push(off + o + r * pitch - sw);
      // short vertical sashing between blocks within each row
      for (let r = 0; r < g.rows; r++) for (const x of vGaps) Q.patches.push({ role: 'sash', fab: sf, pts: rectPts(x, off + o + r * pitch, sw, BS), row: r });
      if (g.sashing.cornerstones) {
        for (const y of hGaps) for (let c = 0; c < g.cols; c++) Q.patches.push({ role: 'sash', fab: sf, pts: rectPts(off + o + c * pitch, y, BS, sw) });
        for (const y of hGaps) for (const x of vGaps) Q.patches.push({ role: 'corner', fab: cf, pts: rectPts(x, y, sw, sw) });
      } else {
        // long horizontal sashing strips between rows (run the full width)
        for (const y of hGaps) Q.patches.push({ role: 'sashLong', fab: sf, pts: rectPts(off, y, cw, sw) });
      }
    }
  } else if (L.mode === 'onpoint') {
    const op = L.onpoint, d = BS * Math.SQRT2;
    cw = op.cols * d; ch = op.rows * d;
    for (const t of latticeTiles('square', BS, 1, 0, 1, cw, ch)) {
      const isA = t.key[0] === 'A';
      const i = t.row, j = t.col;
      if (isA ? (i < 0 || j < 0 || i >= op.rows || j >= op.cols) : (i < 0 || j < 0 || i > op.rows || j > op.cols)) continue;
      const clipped = clipToRect(t.pts, cw, ch);
      if (!clipped) continue;
      const whole = Math.abs(polyArea(clipped) - BS * BS) < 1e-6;
      if (whole) {
        const [cx, cy] = centroid(t.pts);
        Q.cells.push(makeCell(`o${t.key}`, op.cells[t.key], off + cx, off + cy, 45, BS, Math.round((cx + cy) / d), t.key));
      } else {
        const corner = polyArea(clipped) < BS * BS * 0.3;
        Q.tiles.push({ key: `o${t.key}`, role: corner ? 'corner-setting' : 'side-setting', fab: op.cells[t.key]?.fab || op.fill, whole: false,
          pts: translatePoly(clipped, off, off), diag: Math.round((centroid(t.pts)[0] + centroid(t.pts)[1]) / d) });
      }
    }
  } else {
    const t = L.tess;
    [cw, ch] = tessSize(t);
    const fills = [];
    // inset panels: framed squares set into the tile field; tiles are trimmed around them
    const panels = (t.panels || []).map(p => panelGeom(p, cw, ch));
    const holes = panels.map(pg => rectPts(pg.x0, pg.y0, pg.outer, pg.outer));
    // 3D cubes: unpainted tumbling-block diamonds take the face fabric for their direction
    const faceFab = o => t.shape === 'tumbling' && t.faces ? [t.faces.top, t.faces.right, t.faces.left][o] : null;
    // hexagon blocks painted onto hexagon tiles
    const hexBlockAt = key => { const c = t.shape === 'hex' && t.blocks?.[key]; return c && isHexBlock(doc.blocks[c.b]) ? c : null; };
    for (const tile of latticeTiles(t.shape, t.size, t.ratio, t.lean, t.orient, cw, ch)) {
      const bb = bounds(tile.pts);
      if (bb.maxX <= 1e-9 || bb.maxY <= 1e-9 || bb.minX >= cw - 1e-9 || bb.minY >= ch - 1e-9) continue;
      const clipped = clipToRect(tile.pts, cw, ch);
      if (!clipped) continue;
      let parts = [clipped];
      const hits = holes.filter(hp => { const hb = bounds(hp); return bb.maxX > hb.minX + 1e-9 && bb.minX < hb.maxX - 1e-9 && bb.maxY > hb.minY + 1e-9 && bb.minY < hb.maxY - 1e-9; });
      if (hits.length) {
        const mp = pcSafe('difference', toPC(clipped), ...hits.map(toPC));
        parts = mp ? fromPC(mp).map(x => cleanPoly(x.outer)).filter(pp => pp.length >= 3 && polyArea(pp) > 1e-3) : [clipped];
        if (!parts.length) continue;
      }
      const fullArea = polyArea(tile.pts);
      const blk = hexBlockAt(tile.key), blkParts = [];
      for (let pts of parts) {
        const whole = Math.abs(polyArea(pts) - fullArea) < 1e-4;
        // a panel edge that only touches a tile leaves it whole: keep its exact outline
        if (whole) pts = clipped;
        const byPanel = hits.length > 0;
        const role = whole ? 'tile' : (t.edge === 'fill' && !byPanel ? 'fill' : 'trim');
        if (blk && role !== 'fill') { blkParts.push(pts); continue; }
        const tileRec = { key: `t${tile.key}`, tkey: tile.key, role,
          fab: role === 'fill' ? t.fill : (t.colors[tile.key] || faceFab(tile.orient) || t.base), whole,
          pts: translatePoly(pts, off, off), full: translatePoly(tile.pts, off, off), row: tile.row, col: tile.col, orient: tile.orient };
        if (role === 'fill') fills.push(tileRec); else Q.tiles.push(tileRec);
      }
      if (blkParts.length) {
        // the block's flat-topped frame turns 30° to sit in pointy-topped hexagons; turns go in 60° steps
        const [cx, cy] = centroid(tile.pts);
        const c = makeCell(`t${tile.key}`, blk, off + cx, off + cy, t.orient === 1 ? 0 : 30, 2 * t.size, tile.row, tile.col);
        Object.assign(c, { rstep: 60, hex: true, pts: translatePoly(tile.pts, off, off) });
        const whole = blkParts.length === 1 && Math.abs(polyArea(blkParts[0]) - fullArea) < 1e-4;
        if (!whole) c.clip = blkParts.map(pp => translatePoly(pp, off, off));
        Q.cells.push(c);
      }
    }
    for (const pg of panels) {
      const p = pg.p;
      Q.panels.push({ id: p.id, x: off + pg.x0, y: off + pg.y0, w: pg.outer, h: pg.outer });   // framed panel, for quilting areas
      // frames from the inside out: sides first, then top & bottom (the sewing order)
      let x = off + pg.x0 + pg.fw, y = off + pg.y0 + pg.fw, s = p.size;
      (p.frames || []).forEach((fr, k) => {
        const w = fr.width; if (!(w > 0)) return;
        Q.patches.push({ role: 'frame', panel: p.id, ring: k, side: 'left', fab: fr.fabric, pts: rectPts(x - w, y, w, s) });
        Q.patches.push({ role: 'frame', panel: p.id, ring: k, side: 'right', fab: fr.fabric, pts: rectPts(x + s, y, w, s) });
        Q.patches.push({ role: 'frame', panel: p.id, ring: k, side: 'top', fab: fr.fabric, pts: rectPts(x - w, y - w, s + 2 * w, w) });
        Q.patches.push({ role: 'frame', panel: p.id, ring: k, side: 'bottom', fab: fr.fabric, pts: rectPts(x - w, y + s, s + 2 * w, w) });
        x -= w; y -= w; s += 2 * w;
      });
      Q.cells.push(makeCell(`p${p.id}`, p.b ? { b: p.b, r: p.r || 0, f: !!p.f } : p.fab ? { fab: p.fab } : null,
        off + pg.cx, off + pg.cy, 0, p.size, 'panel', p.id));
    }
    const oneTile = latticeTiles(t.shape, t.size, t.ratio, t.lean, t.orient, t.size * 4, t.size * 4)[0];
    Q.tiles.push(...mergeSmallFills(fills, polyArea(oneTile.pts)));
  }

  // borders (sides first, then top & bottom — the usual sewing order)
  let ix = off, iy = off, iw = cw, ih = ch;
  Q.inner = { x: off, y: off, w: cw, h: ch };
  L.borders.forEach((b, k) => {
    const w = b.width;
    if (!(w > 0)) return;
    Q.patches.push({ role: 'border', ring: k, side: 'left', fab: b.fabric, pts: rectPts(ix - w, iy, w, ih) });
    Q.patches.push({ role: 'border', ring: k, side: 'right', fab: b.fabric, pts: rectPts(ix + iw, iy, w, ih) });
    Q.patches.push({ role: 'border', ring: k, side: 'top', fab: b.fabric, pts: rectPts(ix - w, iy - w, iw + 2 * w, w) });
    Q.patches.push({ role: 'border', ring: k, side: 'bottom', fab: b.fabric, pts: rectPts(ix - w, iy + ih, iw + 2 * w, w) });
    ix -= w; iy -= w; iw += 2 * w; ih += 2 * w;
  });
  Q.W = cw + 2 * off; Q.H = ch + 2 * off;
  Q.outer = { x: 0, y: 0, w: Q.W, h: Q.H };
  const empty = Q.cells.filter(c => !c.b && !c.fab).length;
  if (empty) Q.warnings.push(`${plural(empty, 'empty block position')} — fill them before cutting.`);
  return Q;
}

function makeCell(key, content, cx, cy, angle, size, row, col) {
  const c = { key, cx, cy, angle, size, row, col, b: null, fab: null, rot: 0, flip: false };
  if (content?.b && doc.blocks[content.b]) { c.b = content.b; c.rot = content.r || 0; c.flip = !!content.f; }
  else if (content?.fab) c.fab = content.fab;
  const h = size / 2;
  c.pts = rotatePoly([[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]], angle * Math.PI / 180, cx, cy);
  return c;
}
// Neighbouring shapes are drawn overlapping by this much (inches) so anti-aliasing doesn't
// show thin background-coloured lines between blocks. Display only — cutting is unaffected.
const DRAW_BLEED = 0.04;
// "Seam lines" view: seams inside blocks/tiles, and the heavier lines between blocks
const SEAM_INK = 'rgba(20,24,30,.55)';
const SEAM_INK_STRONG = 'rgba(20,24,30,.7)';
// Block frame coordinates → quilt coordinates for a cell (the same placement as cellTransform).
function cellPointMapper(c) {
  const h = c.size / 2, f = c.flip ? -1 : 1;
  const a = (c.angle + (c.rot || 0) * (c.rstep || 90)) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  return ([x, y]) => { const px = (x - h) * f, py = y - h; return [c.cx + px * co - py * si, c.cy + px * si + py * co]; };
}
function cellTransform(c, bleed = 0) {
  const h = c.size / 2, k = (c.size + bleed) / c.size;
  return `translate(${round(c.cx, 4)} ${round(c.cy, 4)}) rotate(${c.angle + (c.rot || 0) * (c.rstep || 90)}) scale(${round((c.flip ? -1 : 1) * k, 5)} ${round(k, 5)}) translate(${-h} ${-h})`;
}

/* ---------- reading / writing cell content ---------- */
function cellContent(key) {
  const L = doc.layout;
  if (key[0] === 'g') return L.grid.cells[+key.slice(1)] || null;
  if (key[0] === 'o') return L.onpoint.cells[key.slice(1)] || null;
  if (key[0] === 't') {
    const k = key.slice(1), bl = L.tess.blocks?.[k];
    if (bl?.b && doc.blocks[bl.b]) return bl;
    const f = L.tess.colors[k];
    return f ? { fab: f } : null;
  }
  if (key[0] === 'p') {
    const p = (L.tess.panels || []).find(x => x.id === key.slice(1));
    return p?.b ? { b: p.b, r: p.r || 0, f: !!p.f } : p?.fab ? { fab: p.fab } : null;
  }
  return null;
}
function setCellContent(key, content) {
  const L = doc.layout;
  if (key[0] === 'g') L.grid.cells[+key.slice(1)] = content;
  else if (key[0] === 'o') { if (content) L.onpoint.cells[key.slice(1)] = content; else delete L.onpoint.cells[key.slice(1)]; }
  else if (key[0] === 't') {
    const k = key.slice(1), T = L.tess;
    T.blocks = T.blocks || {};
    delete T.blocks[k]; delete T.colors[k];
    if (content?.b) T.blocks[k] = { b: content.b, r: content.r || 0, f: !!content.f };
    else if (content?.fab) T.colors[k] = content.fab;
  }
  else if (key[0] === 'p') {
    const p = (L.tess.panels || []).find(x => x.id === key.slice(1));
    if (!p) return;
    p.b = content?.b || null; p.r = content?.r || 0; p.f = !!content?.f; p.fab = content?.fab || null;
  }
}
function resizeGrid(rows, cols) {
  const g = doc.layout.grid;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(r < g.rows && c < g.cols ? g.cells[r * g.cols + c] : null);
  g.rows = rows; g.cols = cols; g.cells = cells;
}

/* ---------- rendering ---------- */
// opts: { idp, interactive, seams, sel, labels, binding, quilting (polylines with style), faded, defs }
function quiltSvg(Q, opts = {}) {
  const idp = opts.idp || 'q';
  const pad = opts.labels ? Math.max(2, Math.min(Q.W, Q.H) * 0.06) : 0;
  const vb = `${-pad} ${-pad} ${round(Q.W + pad * (opts.labels ? 1.2 : 0), 3)} ${round(Q.H + pad * (opts.labels ? 1.2 : 0), 3)}`;
  const symId = c => `${idp}-${c.b}-${String(round(c.size, 3)).replace('.', '_')}`;
  const used = uniq(Q.cells.filter(c => c.b).map(c => `${c.b}|${round(c.size, 3)}`));
  const hair = Math.max(Q.W, Q.H) * 0.0012;
  let defs = opts.defs ? fabricDefs() : '';
  for (const u of used) {
    const [id, size] = u.split('|'), S = +size;
    defs += `<g id="${symId({ b: id, size: S })}">${blockSvg(doc.blocks[id], S, S, { seams: false })}${opts.seams ? blockSeamLines(doc.blocks[id], S, hair) : ''}</g>`;
  }
  let s = `<svg class="${opts.cls || 'quilt-svg'}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${opts.size ? ` width="${opts.size[0]}" height="${opts.size[1]}"` : ''}>`;
  s += `<defs>${defs}</defs>`;
  s += `<g${opts.faded ? ' opacity=".35"' : ''}>`;
  for (const p of Q.patches) s += `<path d="${polyToPath(p.pts)}" fill="${fabricFill(p.fab)}" stroke="${fabricFill(p.fab)}" stroke-width="${DRAW_BLEED}"/>`;
  for (const t of Q.tiles) {
    const attr = opts.interactive && t.key ? ` data-cell="${t.key}"` : '';
    s += `<path d="${polyToPath(t.pts)}" fill="${fabricFill(t.fab)}" stroke="${opts.seams ? SEAM_INK : fabricFill(t.fab)}" stroke-width="${opts.seams ? hair : DRAW_BLEED}"${attr}/>`;
  }
  Q.cells.forEach((c, i) => {
    const attr = opts.interactive ? ` data-cell="${c.key}"` : '';
    if (c.b && c.clip) {
      // cut off by an edge or panel: show only the part that's in the quilt
      const cid = `${idp}-clip-${i}`;
      s += `<clipPath id="${cid}"><path d="${c.clip.map(pp => polyToPath(pp)).join('')}"/></clipPath><g clip-path="url(#${cid})"><use href="#${symId(c)}" xlink:href="#${symId(c)}" transform="${cellTransform(c, DRAW_BLEED)}"${attr}/></g>`;
    } else if (c.b) s += `<use href="#${symId(c)}" xlink:href="#${symId(c)}" transform="${cellTransform(c, DRAW_BLEED)}"${attr}/>`;
    else if (c.fab) s += `<path d="${polyToPath(c.pts)}" fill="${fabricFill(c.fab)}" stroke="${fabricFill(c.fab)}" stroke-width="${DRAW_BLEED}"${attr}/>`;
    else s += `<path d="${polyToPath(c.pts)}" fill="#f4f1ea" stroke="#c9c2b3" stroke-width="${hair}" stroke-dasharray="${hair * 4} ${hair * 3}"${attr}/>`;
  });
  if (opts.seams) {
    // block outlines a touch heavier than the seams inside blocks, so the structure reads
    for (const c of Q.cells) if (c.b || c.fab) s += `<path d="${(c.clip || [c.pts]).map(pp => polyToPath(pp)).join('')}" fill="none" stroke="${SEAM_INK_STRONG}" stroke-width="${hair * 1.5}" pointer-events="none"/>`;
    for (const p of Q.patches) s += `<path d="${polyToPath(p.pts)}" fill="none" stroke="${SEAM_INK}" stroke-width="${hair * 1.2}" pointer-events="none"/>`;
  }
  if (opts.binding !== false && doc.layout.binding?.fabric) {
    const bw = 0.375;
    s += `<rect x="${bw / 2}" y="${bw / 2}" width="${round(Q.W - bw, 4)}" height="${round(Q.H - bw, 4)}" fill="none" stroke="${fabricFill(doc.layout.binding.fabric)}" stroke-width="${bw}" pointer-events="none"/>`;
  }
  s += `</g>`;
  if (opts.quilting) s += opts.quilting;
  if (opts.sel) {
    const c = [...Q.cells, ...Q.tiles].find(x => x.key === opts.sel);
    if (c) s += `<path d="${polyToPath(c.pts)}" fill="none" stroke="#f2b134" stroke-width="${hair * 4}" pointer-events="none" class="sel-outline"/>`;
  }
  if (opts.labels) s += assemblyLabels(Q, pad);
  s += `<g class="hover-layer" pointer-events="none"></g></svg>`;
  return s;
}
function blockSeamLines(block, size, hair) {
  return blockPieces(block, size, size).filter(p => !p.app)
    .map(p => `<path d="${polyToPath(p.pts)}" fill="none" stroke="${SEAM_INK}" stroke-width="${hair}" pointer-events="none"/>`).join('');
}
function assemblyLabels(Q, pad) {
  const fs = pad * 0.55;
  let s = '';
  const lab = (x, y, t) => `<text x="${round(x, 3)}" y="${round(y, 3)}" font-size="${round(fs, 3)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="700" fill="#2b3a4a">${t}</text>`;
  if (Q.mode === 'grid') {
    const rows = uniq(Q.cells.map(c => c.row)), cols = uniq(Q.cells.map(c => c.col));
    for (const r of rows) { const c = Q.cells.find(x => x.row === r); s += lab(-pad / 2, c.cy, letterFor(r)); }
    for (const k of cols) { const c = Q.cells.find(x => x.col === k); s += lab(c.cx, -pad / 2, k + 1); }
  } else if (Q.mode === 'onpoint') {
    const d = Q.BS * Math.SQRT2, off = Q.inner.x;
    const diags = uniq([...Q.cells.map(c => c.row), ...Q.tiles.map(t => t.diag)]).sort((a, b) => a - b);
    diags.forEach((k, i) => {
      // label each diagonal row where it meets the top or left edge
      const v = k * d;
      const x = v <= Q.inner.w ? off + v : off + Q.inner.w + pad * 0.5, y = v <= Q.inner.w ? -pad / 2 : off + (v - Q.inner.w);
      s += lab(x, y, i + 1);
    });
  } else {
    const rows = uniq(Q.tiles.filter(t => t.row !== undefined).map(t => t.row)).sort((a, b) => a - b);
    rows.forEach((r, i) => {
      const ts = Q.tiles.filter(t => t.row === r);
      const cy = sum(ts, t => centroid(t.pts)[1]) / ts.length;
      if (rows.length <= 60) s += lab(-pad / 2, cy, i + 1);
    });
  }
  return s;
}
