/* Printable pattern: a multi-page HTML document laid out for Letter/A4 and printed with the
   browser's "Save as PDF". Every number comes from the same model as the app's views. */

const PAGE_CONTENT = { letter: { w: 7.5, h: 10 }, a4: { w: 7.27, h: 10.69 } };

function autoSkill(Q, plan) {
  let score = 0;
  const blocks = uniq(Q.cells.filter(c => c.b).map(c => c.b)).map(id => doc.blocks[id]);
  if (blocks.length > 3) score++;
  for (const b of blocks) {
    const an = analyzeBlock(b, blockFrameSize(b));
    if (an.setIn) score += 2;
    if (an.units.some(u => u.unit.type === 'curved')) score += 2;
    if (an.applique.length) score++;
  }
  if (plan.fabrics.some(f => f.templates.length)) score++;
  if (Q.mode === 'onpoint') score++;
  if (Q.mode === 'tess' && ['hex', 'tumbling', 'triangle'].includes(doc.layout.tess.shape)) score += 2;
  return score <= 1 ? 'Beginner' : score <= 3 ? 'Confident beginner' : score <= 5 ? 'Intermediate' : 'Advanced';
}

function patternFabricKeyTable(plan, compact) {
  let h = `<table class="pt"><thead><tr><th></th><th>Fabric</th><th>Used for</th>${compact ? '' : '<th>Cut length</th>'}<th>Buy</th></tr></thead><tbody>`;
  for (const f of plan.fabrics) {
    h += `<tr><td class="key">${swatchHtml(f.fab, 22)}<b>${fabricLetter(f.fab)}</b></td><td>${esc(fabricLabel(f.fab))}${fabricById(f.fab).directional ? ' <i>(directional)</i>' : ''}</td>
      <td>${esc(f.sources.join(', '))}</td>${compact ? '' : `<td>${fmtYards(f.lengthIn)}</td>`}<td>${stashUseText(f) && !f.buyIn ? `<small>all from ${esc(stashUseText(f))}</small>` : `<b>${buyText(f)}</b>${stashUseText(f) ? `<br><small>plus ${esc(stashUseText(f))}</small>` : f.fq ? '<br><small>or 1 fat quarter</small>' : ''}`}</td></tr>`;
  }
  return h + '</tbody></table>';
}

/* ---------- piece codes ----------
   Every distinct cut shape gets a short code: its fabric letter plus a number in cutting order
   (A1, A2, B1…). The cutting list, block diagrams and the assembly map all use them, so any
   piece can be followed from the fabric to its place in the quilt. */
function pieceCodes(plan) {
  const byKey = new Map(), list = [];
  for (const f of plan.fabrics) {
    let n = 0;
    fabricSheet(f).rows.forEach((row, i) => {
      for (const r of row.group?.recipes || (row.a ? [row.a] : row.r ? [row.r] : [])) {
        const k = `${f.fab}|${r.recipe.key}`;
        if (byKey.has(k)) continue;
        const e = { code: `${fabricLetter(f.fab)}${++n}`, fab: f.fab, step: i + 1, r };
        byKey.set(k, e); list.push(e);
      }
    });
  }
  const forRow = row => (row.group?.recipes || (row.a ? [row.a] : row.r ? [row.r] : [])).map(r => list.find(e => e.r === r)).filter(Boolean);
  return { list, forRow, of: (fab, key) => byKey.get(`${resolveFab(fab)}|${key}`) };
}
const codeTag = c => `<span class="pcode">${c}</span>`;
// The recipe a tessellation tile is cut with (must match collectCutItems).
function tileRecipeKey(t, sa) {
  return recipeFor(classifyPiece(tileCutShape(t)), sa, { directional: !!fabricById(t.fab).directional }).key;
}
// Piece object → its code(s) for one block (mirrored copies cut differently get a second code).
function blockPieceCodes(codes, blockId, size) {
  const all = blockPieces(doc.blocks[blockId], size, size), out = new Map();
  for (const e of codes.list) {
    const u = e.r.uses?.get(blockId);
    if (!u) continue;
    for (const i of u.idx) { const p = all[i]; if (p) out.set(p, [...(out.get(p) || []), e.code]); }
  }
  return out;
}

// Where to write a piece's label: the spot inside it farthest from any edge (centroids of
// L-shapes, rings and pieces under appliqué can land somewhere else entirely).
function labelSpot(pts, holes = [], avoid = []) {
  const c = centroid(pts);
  const inside = q => pointInPoly(q, pts) && !holes.some(h => pointInPoly(q, h)) && !avoid.some(a => pointInPoly(q, a));
  const rings = [pts, ...holes, ...avoid];
  const clearance = q => {
    let d = Infinity;
    for (const r of rings) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12;
      const t = clamp(((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2, 0, 1);
      d = Math.min(d, Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy));
    }
    return d;
  };
  let best = inside(c) ? c : null, bd = best ? clearance(c) * 1.15 : -1;   // keep the centroid unless clearly worse
  const bb = bounds(pts), N = 14;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const q = [bb.minX + bb.w * (i + 0.5) / N, bb.minY + bb.h * (j + 0.5) / N];
    if (!inside(q)) continue;
    const d = clearance(q);
    if (d > bd) { bd = d; best = q; }
  }
  return best || c;
}

// Block diagram with fabric letters, or piece codes when opts.codes is given (size in inches on paper).
function blockDiagramSvg(block, BS, paperIn, opts = {}) {
  const an = analyzeBlock(block, BS);
  const gap = opts.level ? BS * 0.06 : 0;
  const placed = opts.level ? explodedPieces(an, opts.level, gap) : blockPieces(block, BS, BS).filter(p => !p.app).map(p => ({ p, dx: 0, dy: 0 }));
  const app = an.applique;
  let maxX = BS, maxY = BS;
  for (const { p, dx, dy } of placed) { maxX = Math.max(maxX, p.bb.maxX + dx); maxY = Math.max(maxY, p.bb.maxY + dy); }
  const minX = Math.min(0, ...placed.map(x => x.p.bb.minX + x.dx)), minY = Math.min(0, ...placed.map(x => x.p.bb.minY + x.dy));
  const W = maxX - minX, H = maxY - minY;
  const scale = paperIn / Math.max(W, H);
  const hair = BS * 0.004;
  let s = `<svg class="diag" viewBox="${round(minX, 3)} ${round(minY, 3)} ${round(W, 3)} ${round(H, 3)}" width="${round(W * scale, 3)}in" height="${round(H * scale, 3)}in">`;
  for (const { p, dx, dy, unit } of placed) {
    const hi = opts.highlight && unit && opts.highlight.has(unit);
    const pts = translatePoly(p.pts, dx, dy);
    s += `<path d="${polyToPath(pts)}${p.holes.map(hh => polyToPath(translatePoly(hh, dx, dy))).join('')}" fill="${fabricFill(p.fab)}" fill-rule="evenodd" stroke="#2b3a4a" stroke-width="${hair}"${opts.dim && !hi ? ' opacity=".35"' : ''}/>`;
  }
  if (!opts.level) for (const p of app) s += `<path d="${polyToPath(p.pts)}" fill="${fabricFill(p.fab)}" stroke="#2b3a4a" stroke-width="${hair}" stroke-dasharray="${hair * 3} ${hair * 2}"/>`;
  if (opts.letters !== false) {
    const fs = BS * 0.055;
    for (const { p, dx, dy } of [...placed, ...(opts.level ? [] : app.map(p => ({ p, dx: 0, dy: 0 })))]) {
      if (p.cls.area < (BS * 0.07) ** 2) continue;
      const [cx, cy] = labelSpot(p.pts, p.holes, p.app || opts.level ? [] : app.map(a => a.pts));
      const ink = inkOn(fabricHex(p.fab));
      const label = opts.codes?.get(p)?.join('/') || fabricLetter(p.fab);
      s += `<text x="${round(cx + dx, 3)}" y="${round(cy + dy, 3)}" font-size="${round(label.length > 3 ? fs * 0.75 : fs, 3)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="700" fill="${ink}">${label}</text>`;
    }
  }
  return s + '</svg>';
}

const UNIT_NAMES = { hst: 'half-square triangle (HST) unit', qst: 'quarter-square triangle unit', goose: 'flying-geese unit', snowball: 'stitch-and-flip unit', curved: 'curved unit', hrt: 'half-rectangle triangle unit', complex: 'set-in unit' };

function unitMethodText(type, sample, n, sa) {
  const r = sample.rect, unf = fmtSize(r.w + 2 * sa, r.h + 2 * sa);
  const L = f => `<b>${fabricLetter(f)}</b>`;
  const fabs = sample.unit.fabs || [];
  switch (type) {
    case 'hst': {
      const sq = fmtLen(ceilEighth(r.w + sa * (2 + Math.SQRT2)), 'up');
      return `Make <b>${n}</b> HST units (${fabs.map(L).join(' + ')}). Pair a ${sq} square of each fabric right sides together, draw a diagonal line on the lighter one, sew ¼" on both sides of the line and cut on it. Each pair makes 2 units. Press toward the darker fabric and trim to ${unf}.`;
    }
    case 'qst': {
      const sq = fmtLen(ceilEighth(r.w * Math.SQRT2 + 2 * sa * (1 + Math.SQRT2)), 'up');
      return `Make <b>${n}</b> quarter-square triangle units (${fabs.map(L).join(' + ')}). For two-fabric hourglasses: make HSTs from ${sq} squares, pair two HSTs with contrasting fabrics facing, draw a diagonal across the seam, sew ¼" each side and cut. Otherwise sew the triangles in pairs, then join the pairs. Trim to ${unf}.`;
    }
    case 'goose': {
      const big = fmtLen(ceilEighth(Math.max(r.w, r.h) + 2 * sa * (1 + Math.SQRT2)), 'up');
      const small = fmtLen(ceilEighth(Math.min(r.w, r.h) + sa * (2 + Math.SQRT2)), 'up');
      return `Make <b>${n}</b> flying-geese units (goose ${L(sample.unit.goose)}, sky ${L(sample.unit.sky)}) with the no-waste method: place two ${small} sky squares on opposite corners of a ${big} goose square, sew ¼" each side of the diagonal, cut apart, add the remaining sky squares the same way. Every big square makes 4 geese. Trim to ${unf}.`;
    }
    case 'snowball':
      return `Make <b>${n}</b> stitch-and-flip units: draw a diagonal on the wrong side of each small corner square, place it on the corner of the main piece right sides together, sew on the line, trim ¼" beyond the seam and press open. Unit measures ${unf}.`;
    case 'curved':
      return `Make <b>${n}</b> curved units: fold each piece in half to finger-press the centre of the curve, pin the centres and ends right sides together with the concave piece on top, and sew slowly, easing the curve. Press toward the convex piece. Trim to ${unf}.`;
    case 'hrt':
      return `Make <b>${n}</b> half-rectangle triangle units: sew the triangles along the long edge with the points offset by ¼" so the unit squares up to ${unf}.`;
    case 'complex':
      return `This block has <b>set-in (Y) seams</b>. Mark the ¼" seam intersections on the wrong side, sew each seam only between the marks and back-stitch, then pivot to set in the next piece. English paper piecing is a good alternative.`;
  }
  return '';
}

const STEP_DIAG_IN = 1.3;
function blockStepsHtml(block, BS, sa, copies = 1) {
  const an = analyzeBlock(block, BS);
  const steps = [];
  const groups = new Map();
  for (const u of an.units) {
    if (u.unit.type === 'piece') continue;
    // a unit turned 90° is the same unit — group by size regardless of orientation
    const dims = [round(u.rect.w, 3), round(u.rect.h, 3)].sort((a, b) => a - b).join('x');
    const k = u.unit.type + '|' + (u.unit.goose ? u.unit.goose + '/' + u.unit.sky : (u.unit.fabs || []).slice().sort().join(',')) + '|' + dims;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(u);
  }
  for (const list of groups.values()) {
    const u = list[0].unit;
    let text = unitMethodText(u.type, list[0], list.length, sa);
    if (copies > 1 && u.type !== 'complex') text = text.replace(`<b>${list.length}</b>`, `<b>${list.length}</b> per block (<b>${list.length * copies}</b> in total)`);
    // sketch of the method, in the unit's own fabrics (lighter fabric first)
    const fabs = (u.fabs || []).slice().sort((p, q) => luminance(fabricHex(q)) - luminance(fabricHex(p)));
    const howto = u.type === 'goose' ? unitHowToSvg('goose', u.goose, u.sky)
      : u.type === 'snowball' ? unitHowToSvg('snowball', resolveFab(u.main.fab), resolveFab(u.corners[0].fab))
      : u.type === 'curved' ? unitHowToSvg('curved', fabs[0], fabs[1] || fabs[0])
      : ['hst', 'qst'].includes(u.type) ? unitHowToSvg(u.type, fabs[0], fabs[1] || fabs[0]) : '';
    if (howto) text += `<div class="howto-wrap">${howto}</div>`;
    steps.push({ text, diag: blockDiagramSvg(block, BS, STEP_DIAG_IN, { level: an.height + 1, highlight: new Set(list), dim: true }) });
  }
  for (let k = 1; k <= an.height; k++) {
    const nodes = [];
    walkTree(an.root, n => { if (n.children.length && treeHeight(n) === k) nodes.push(n); });
    const isRoot = k === an.height;
    const descr = nodes.map(n => n.dir).reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {});
    const parts = [];
    const thing = n => n.children.every(c => !c.children.length) ? (n.children.some(c => c.pieces.length > 1) ? 'units' : 'pieces') : 'sections';
    for (const [dir, cnt] of Object.entries(descr)) {
      const sample = nodes.find(n => n.dir === dir), m = sample.children.length, t = thing(sample);
      // a single short run of loose pieces: name them so the reader knows what goes where
      if (cnt === 1 && m <= 5 && sample.children.every(c => !c.children.length && c.pieces.length === 1)) {
        const names = sample.children.map(c => `${shapeName(c.pieces[0].cls).toLowerCase()} (<b>${fabricLetter(c.pieces[0].fab)}</b>)`).join(' + ');
        parts.push(dir === 'cols' ? `Sew ${names} side by side` : dir === 'rows' ? `Sew ${names} top to bottom` : `Sew ${names} together along the diagonal seams, in that order`);
        continue;
      }
      if (dir === 'cols') parts.push(isRoot && cnt === 1 ? `Sew the ${m} ${t} side by side` : `Sew ${cnt === 1 ? `the ${m} ${t}` : `${cnt} rows of ${m} ${t}`} side by side`);
      else if (dir === 'rows') parts.push(isRoot && cnt === 1 ? `Join the ${m} ${t === 'sections' ? 'rows' : t} top to bottom` : `Join ${cnt === 1 ? `the ${m} ${t}` : `${cnt} sets of ${m} ${t}`} top to bottom`);
      else parts.push(`Sew ${cnt === 1 ? `the ${m} ${t}` : `${cnt} groups of ${m} ${t}`} together along the diagonal seams, working outward from the centre`);
    }
    let text = parts.join('. ') + '.';
    if (descr.diag) text += ' Diagonal edges are cut on the bias and stretch easily: pin well, centre each piece so its points ("dog ears") overhang equally at both ends, and press without steam. Trim the dog ears after sewing.';
    if (isRoot) text += isHexBlock(block) ? ` Press, then trim the hexagon to ${blockSizeText(block, BS, 2 * sa)} (¼" beyond each point of the sewn shape).` : ` Press, then square the block to ${fmtSize(BS + 2 * sa, BS + 2 * sa)}.`;
    else if (descr.cols) text += ' Press seams in alternate directions from row to row so they nest.';
    steps.push({ text, diag: blockDiagramSvg(block, BS, STEP_DIAG_IN, { level: k }) });
  }
  if (an.applique.length) {
    steps.push({ text: `Appliqué ${plural(an.applique.length, 'piece')} (${uniq(an.applique.map(p => fabricLetter(p.fab))).map(l => `<b>${l}</b>`).join(', ')}) onto the block as shown — turn the edges under by hand, or fuse and stitch around the edge.`, diag: blockDiagramSvg(block, BS, STEP_DIAG_IN) });
  }
  if (!steps.length) steps.push({ text: `This block is a single piece — cut it at ${isHexBlock(block) ? blockSizeText(block, BS, 2 * sa) : fmtSize(BS + 2 * sa, BS + 2 * sa)}.`, diag: '' });
  return steps;
}

// A template at true size, split into page-sized sheets when it's bigger than a page. Each sheet
// is named <template>-<row letter><column> (T1-B2). Sheets overlap by a shaded glue strip on their
// right and bottom edges, so the next sheet's lines land exactly on top; sheets the template
// doesn't reach aren't printed.
const SHEET_GLUE = 0.3;
function templateSvg(t, maxW, maxH) {
  const g = templateGeom(t.r.recipe), pts = g.pts, cut = g.cut;
  const cb = bounds(cut);
  const holesD = list => list.map(h => polyToPath(h)).join('');
  const pad = 0.15;
  const W = cb.w + 2 * pad, H = cb.h + 2 * pad, X = cb.x - pad, Y = cb.y - pad;
  const one = W <= maxW + 1e-9 && H <= maxH + 1e-9;
  const stepX = W <= maxW + 1e-9 ? W : maxW - SHEET_GLUE, stepY = H <= maxH + 1e-9 ? H : maxH - SHEET_GLUE;
  const tilesX = Math.max(1, Math.ceil((W - (W > maxW ? SHEET_GLUE : 0)) / stepX - 1e-9)), tilesY = Math.max(1, Math.ceil((H - (H > maxH ? SHEET_GLUE : 0)) / stepY - 1e-9));
  const dom = fabricHex(t.fab);
  const inner = `<path d="${polyToPath(cut)}${holesD(g.cutHoles)}" fill="${mix(dom, '#ffffff', .82)}" fill-rule="evenodd" stroke="#2b3a4a" stroke-width="0.012"${g.sa ? ' stroke-dasharray="0.06 0.04"' : ''}/>
    ${g.sa ? `<path d="${polyToPath(pts)}${holesD(g.holes)}" fill="none" stroke="#2b3a4a" stroke-width="0.016"/>` : ''}
    <text x="${round(cb.x + cb.w / 2, 3)}" y="${round(cb.y + cb.h / 2, 3)}" font-size="${round(Math.min(0.32, Math.min(cb.w, cb.h) / 4), 3)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="700" fill="#2b3a4a">${t.id} · ${fabricLetter(t.fab)}</text>
    ${Math.min(cb.w, cb.h) > 1.4 ? `<path d="M${round(cb.x + cb.w * .25, 3)},${round(cb.y + cb.h / 2 + .32, 3)}h${round(cb.w * .5, 3)}" stroke="#2b3a4a" stroke-width=".012" marker-start="url(#arw)" marker-end="url(#arw)"/>` : ''}`;
  const defs = `<defs><marker id="arw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#2b3a4a"/></marker></defs>`;
  if (one) return { tiles: [{ tx: 0, ty: 0, id: t.id, blank: false, own: { x: X, y: Y, w: W, h: H }, svg: `<svg viewBox="${round(X, 4)} ${round(Y, 4)} ${round(W, 4)} ${round(H, 4)}" width="${round(W, 4)}in" height="${round(H, 4)}in">${defs}${inner}</svg>` }], tilesX: 1, tilesY: 1, box: { x: X, y: Y, w: W, h: H }, g };
  const tiles = [];
  for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
    const own = { x: X + tx * stepX, y: Y + ty * stepY, w: tx < tilesX - 1 ? stepX : W - tx * stepX, h: ty < tilesY - 1 ? stepY : H - ty * stepY };
    const id = `${t.id}-${String.fromCharCode(65 + ty)}${tx + 1}`;
    const hit = pcSafe('intersection', toPC(rectPts(own.x, own.y, own.w, own.h)), toPC(cut));
    const blank = !hit || sum(fromPC(hit), pg => polyArea(pg.outer)) < 1e-3;
    const gr = tx < tilesX - 1 ? SHEET_GLUE : 0, gb = ty < tilesY - 1 ? SHEET_GLUE : 0;
    const vw = own.w + gr, vh = own.h + gb;
    let marks = '';
    // glue strips (the next sheet goes on top of them) and border lines to trim along
    const glue = (x, y, w, h, vertical) => `<rect x="${round(x, 4)}" y="${round(y, 4)}" width="${round(w, 4)}" height="${round(h, 4)}" fill="#8a95a3" fill-opacity=".22"/>
      <text transform="translate(${round(x + w / 2, 4)} ${round(y + h / 2, 4)})${vertical ? ' rotate(90)' : ''}" font-size="0.1" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" fill="#3a4754">glue — the next sheet goes on top</text>`;
    if (gr) marks += glue(own.x + own.w, own.y, gr, own.h, true);
    if (gb) marks += glue(own.x, own.y + own.h, own.w + gr, gb, false);
    if (tx > 0) marks += `<line x1="${round(own.x, 4)}" y1="${round(own.y, 4)}" x2="${round(own.x, 4)}" y2="${round(own.y + vh, 4)}" stroke="#a33326" stroke-width="0.02"/>`;
    if (ty > 0) marks += `<line x1="${round(own.x, 4)}" y1="${round(own.y, 4)}" x2="${round(own.x + vw, 4)}" y2="${round(own.y, 4)}" stroke="#a33326" stroke-width="0.02"/>`;
    tiles.push({ tx, ty, id, blank, own, svg: `<svg viewBox="${round(own.x, 4)} ${round(own.y, 4)} ${round(vw, 4)} ${round(vh, 4)}" width="${round(vw, 4)}in" height="${round(vh, 4)}in">${defs}${inner}${marks}</svg>` });
  }
  return { tiles, tilesX, tilesY, box: { x: X, y: Y, w: W, h: H }, g };
}
// The whole template drawn small with its sheets marked — how the printed sheets fit together.
function templateAtlasSvg(t, ts, maxWIn, maxHIn, hi) {
  const { box, g } = ts, k = Math.min(maxWIn / box.w, maxHIn / box.h);
  const fs = Math.max(box.w, box.h) * 0.045;
  let s = `<svg class="atlas-svg" viewBox="${round(box.x, 3)} ${round(box.y, 3)} ${round(box.w, 3)} ${round(box.h, 3)}" width="${round(box.w * k, 3)}in" height="${round(box.h * k, 3)}in">
    <path d="${polyToPath(g.cut)}${g.cutHoles.map(h => polyToPath(h)).join('')}" fill="${mix(fabricHex(t.fab), '#ffffff', .7)}" fill-rule="evenodd" stroke="#2b3a4a" stroke-width="${round(fs * 0.08, 4)}"/>`;
  for (const tl of ts.tiles) {
    const o = tl.own, mine = tl.id === hi;
    s += `<rect x="${round(o.x, 3)}" y="${round(o.y, 3)}" width="${round(o.w, 3)}" height="${round(o.h, 3)}" fill="${mine ? '#f2b134' : tl.blank ? '#e6e8eb' : 'none'}" fill-opacity="${mine ? .55 : tl.blank ? .8 : 0}" stroke="#2b3a4a" stroke-width="${round(fs * 0.12, 4)}" stroke-dasharray="${round(fs * .5, 3)} ${round(fs * .3, 3)}"/>`;
    if (hi) continue;
    s += `<text x="${round(o.x + o.w / 2, 3)}" y="${round(o.y + o.h / 2, 3)}" font-size="${round(fs * 2.2, 3)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="800" fill="${tl.blank ? '#8a95a3' : '#1f3a5f'}" paint-order="stroke" stroke="#fff" stroke-width="${round(fs * 0.5, 3)}">${tl.id.split('-')[1]}</text>`;
    if (tl.blank) s += `<text x="${round(o.x + o.w / 2, 3)}" y="${round(o.y + o.h / 2 + fs * 2.2, 3)}" font-size="${round(fs * 1.1, 3)}" text-anchor="middle" font-family="system-ui,sans-serif" fill="#5a6672">not printed</text>`;
  }
  return s + '</svg>';
}
const scaleBarSvg = () => `<svg class="scale-bar" width="1.1in" height="0.32in" viewBox="0 0 1.1 0.32"><path d="M0.05,0.06v0.12h1v-0.12M0.55,0.12v0.06" fill="none" stroke="#2b3a4a" stroke-width="0.012"/><text x="0.55" y="0.29" font-size="0.085" text-anchor="middle" font-family="system-ui,sans-serif" fill="#2b3a4a">check: 1 inch</text></svg>`;

// Tessellation assembly map: every shape labelled with its piece code (blocks with #n), rows
// numbered, and a legend. When the labels would be too small to read on one page, the map is
// also printed in sections at a larger scale.
function assemblyMap(Q, codes, sa, page, tplList, blockJobs) {
  const MIN_LABEL_IN = 0.085;                       // ≈ 6pt on paper
  const whole = Q.tiles.find(t => t.whole) || Q.tiles[0];
  const fs0 = whole ? Math.sqrt(polyArea(whole.full || whole.pts)) * 0.27 : 1;
  const blockNo = new Map(uniq(blockJobs.map(j => j.id)).map((id, i) => [id, i + 1]));
  const counts = new Map();
  let labels = '';
  const txt = (x, y, fs, fill, t) => `<text x="${round(x, 3)}" y="${round(y, 3)}" font-size="${round(fs, 3)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="700" fill="${fill}">${t}</text>`;
  for (const t of Q.tiles) {
    const e = codes.of(t.fab, tileRecipeKey(t, sa));
    if (!e) continue;
    const c = counts.get(e) || { whole: 0, trim: 0 };
    if (t.whole) c.whole++; else c.trim++;
    counts.set(e, c);
    const fs = Math.min(fs0, Math.sqrt(polyArea(t.pts)) * 0.4);
    if (fs < fs0 * 0.4) continue;                   // a sliver: its code is in the legend
    const [x, y] = labelSpot(t.pts);
    labels += txt(x, y, fs, inkOn(fabricHex(t.fab)), e.code);
  }
  for (const c of Q.cells) if (c.b) {
    const [x, y] = c.clip ? centroid(c.clip[0]) : [c.cx, c.cy];
    const fs = Math.min(c.size * 0.16, fs0 * 1.1);
    labels += `<circle cx="${round(x, 3)}" cy="${round(y, 3)}" r="${round(fs * 0.85, 3)}" fill="#fff" fill-opacity=".85" stroke="#2b3a4a" stroke-width="${round(fs * 0.08, 3)}"/>` + txt(x, y, fs, '#2b3a4a', `#${blockNo.get(c.b) || '?'}`);
  }
  const svgAt = (size, vb, extra = '') => {
    let s = quiltSvg(Q, { idp: 'pm', size, labels: !vb, seams: true, binding: false });
    s = s.replace('<g class="hover-layer"', `<g pointer-events="none">${labels}${extra}</g><g class="hover-layer"`);
    if (vb) s = s.replace(/viewBox="[^"]*"/, `viewBox="${vb.map(v => round(v, 3)).join(' ')}"`);
    return s;
  };
  // one page if the labels are readable there, otherwise sections too
  const heroW = page.w * 0.86, heroH = page.h * 0.46;
  const k1 = Math.min(heroW / (Q.W * 1.08), heroH / (Q.H * 1.08));
  const hero = `<div class="hero">${svgAt([round(Q.W * 1.08 * k1, 3) + 'in', round(Q.H * 1.08 * k1, 3) + 'in'])}</div>`;
  const sections = [];
  if (k1 < MIN_LABEL_IN / fs0 * 0.95) {
    // split the pieced centre (borders carry no labels) into equal parts big enough to read
    const I = Q.inner, pad = fs0 * 2.4, ov = fs0 * 1.5;
    const availW = page.w, availH = page.h * 0.8, need = MIN_LABEL_IN / fs0;
    const nx = Math.ceil((I.w + pad) * need / availW - 1e-6), ny = Math.ceil(I.h * need / availH - 1e-6);
    const w = I.w / nx, hh = I.h / ny;
    const k = Math.min(availW / (w + 2 * ov + pad), availH / (hh + 2 * ov));
    const rowsY = new Map();
    for (const t of Q.tiles) if (t.row !== undefined) { const r = rowsY.get(t.row) || []; r.push(centroid(t.pts)[1]); rowsY.set(t.row, r); }
    const rows = [...rowsY.keys()].sort((a, b) => a - b).map((r, i) => ({ n: i + 1, y: sum(rowsY.get(r)) / rowsY.get(r).length }));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x0 = I.x + Math.max(0, i * w - ov), y0 = I.y + Math.max(0, j * hh - ov), x1 = I.x + Math.min(I.w, (i + 1) * w + ov), y1 = I.y + Math.min(I.h, (j + 1) * hh + ov);
      const inRows = rows.filter(r => r.y >= y0 && r.y <= y1);
      const fsR = fs0 * 1.1;
      const rowNums = `<rect x="${round(x0 - pad, 3)}" y="${round(y0, 3)}" width="${round(pad, 3)}" height="${round(y1 - y0, 3)}" fill="#fff"/>` + inRows.map(r => `<text x="${round(x0 - pad / 2, 3)}" y="${round(r.y, 3)}" font-size="${round(fsR, 3)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="700" fill="#2b3a4a">${r.n}</text>`).join('');
      const where = nx > 1 ? (i === 0 ? ', left side' : i === nx - 1 ? ', right side' : ', middle') : '';
      const ovw = `<svg class="map-key" viewBox="0 0 ${round(Q.W, 2)} ${round(Q.H, 2)}" width="0.9in" height="${round(0.9 * Q.H / Q.W, 3)}in"><rect width="${round(Q.W, 2)}" height="${round(Q.H, 2)}" fill="#eef0f2" stroke="#8a95a3" stroke-width="${round(Q.W * 0.01, 3)}"/><rect x="${round(I.x, 2)}" y="${round(I.y, 2)}" width="${round(I.w, 2)}" height="${round(I.h, 2)}" fill="#dfe3e8"/><rect x="${round(x0, 2)}" y="${round(y0, 2)}" width="${round(x1 - x0, 2)}" height="${round(y1 - y0, 2)}" fill="#f2b134" fill-opacity=".75"/></svg>`;
      const one = nx * ny === 1;
      sections.push(`<div class="map-head">${ovw}<div><h2>Assembly map${one ? '' : ` — part ${j * nx + i + 1} of ${nx * ny}`}</h2><p>${inRows.length ? `Rows ${inRows[0].n}–${inRows[inRows.length - 1].n}${where}. ` : ''}${one ? 'The map again, large enough to read every code.' : 'Each part overlaps the next slightly so you can line them up.'} Codes are explained in the piece key on the assembly page.</p></div></div>
        <div class="hero">${svgAt([round((x1 - x0 + pad) * k, 3) + 'in', round((y1 - y0) * k, 3) + 'in'], [x0 - pad, y0, x1 - x0 + pad, y1 - y0], rowNums)}</div>`);
    }
  }
  // legend: one entry per piece code used in the map, then the blocks
  const shapeThumb = e => {
    const tile = Q.tiles.find(t => codes.of(t.fab, tileRecipeKey(t, sa)) === e);
    const pts = e.r.recipe.outline || (tile && tileCutShape(tile));
    if (!pts) return '';
    const bb = bounds(pts), m = Math.max(bb.w, bb.h) * 0.08;
    return `<svg viewBox="${round(bb.x - m, 3)} ${round(bb.y - m, 3)} ${round(bb.w + 2 * m, 3)} ${round(bb.h + 2 * m, 3)}" width="0.42in" height="0.42in"><path d="${polyToPath(pts)}" fill="${fabricFill(e.fab)}" stroke="#2b3a4a" stroke-width="${round(Math.max(bb.w, bb.h) * 0.02, 3)}"/></svg>`;
  };
  const items = [...counts.entries()].sort((a, b) => codes.list.indexOf(a[0]) - codes.list.indexOf(b[0]));
  let legend = `<h3>Piece key</h3><p class="small">Each shape on the map is labelled with the code of the piece you cut for it (see the cutting list)${blockNo.size ? '; circled numbers are blocks' : ''}. Rows are numbered down the left side.</p><div class="piece-key">`;
  for (const [e, c] of items) {
    const t = tplList.find(x => x.r === e.r);
    legend += `<div>${shapeThumb(e)}<span>${codeTag(e.code)}<b>${esc(e.r.recipe.makes)}</b> · ${c.whole + c.trim}${c.trim ? (doc.layout.tess.cutEdges ? ` — edge piece${c.trim === 1 ? '' : 's'}, cut to fit` : ` (${c.trim} at the edges${(doc.layout.panels || []).length ? ' or panel' : ''} — sew whole, trim later)`) : ''}<br>fabric <b>${fabricLetter(e.fab)}</b>, cutting step ${e.step}${t ? `, template ${t.id}` : ''}</span></div>`;
  }
  for (const [id, n] of blockNo) {
    const cells = Q.cells.filter(c => c.b === id);
    legend += `<div><span class="pcode blk">#${n}</span><span><b>${esc(doc.blocks[id].name)}</b> · ${cells.length} block${cells.length === 1 ? '' : 's'}${cells.some(c => c.clip) ? ` (${cells.filter(c => c.clip).length} trimmed)` : ''}<br>see its block page</span></div>`;
  }
  legend += '</div><div style="height:10px"></div>';
  if (sections.length) legend += `<p class="small">The labels are small at this size — the map is repeated larger ${sections.length === 1 ? 'on its own page' : `over ${plural(sections.length, 'page')}`} after the assembly steps.</p>`;
  return { hero, legend, sections };
}

function calibrationSvg() {
  return `<svg width="1.6in" height="1.15in" viewBox="0 0 1.6 1.15"><rect x="0.02" y="0.02" width="1" height="1" fill="none" stroke="#2b3a4a" stroke-width="0.012"/>
    <text x="0.52" y="0.52" font-size="0.16" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif">1 inch</text>
    <rect x="1.12" y="0.02" width="0.3937" height="0.3937" fill="none" stroke="#2b3a4a" stroke-width="0.012"/><text x="1.32" y="0.55" font-size="0.12" text-anchor="middle" font-family="system-ui,sans-serif">1 cm</text></svg>`;
}

function renderPatternDoc() {
  const Q = buildQuilt();
  const plan = cuttingPlan(Q);
  const sa = doc.cutting.seam;
  const meta = doc.meta;
  const page = PAGE_CONTENT[ui.patternPage] || PAGE_CONTENT.letter;
  const title = esc(meta.title || 'Untitled quilt');
  const skill = meta.skill === 'auto' ? autoSkill(Q, plan) : meta.skill;
  const pages = [];
  const P = (cls, html) => pages.push({ cls, html });
  const fit = (w, h, maxW, maxH) => { const k = Math.min(maxW / w, maxH / h); return [round(w * k, 3) + 'in', round(h * k, 3) + 'in']; };
  // one page per block per size (an inset panel can hold a bigger copy of a block)
  const blockJobs = uniq(Q.cells.filter(c => c.b).map(c => `${c.b}|${c.size}`)).map(k => { const [id, s] = k.split('|'); return { id, size: +s }; });

  /* --- cover --- */
  const heroSize = fit(Q.W, Q.H, page.w, page.h * 0.62);
  P('cover', `<div class="cover-title"><h1>${title}</h1>${meta.designer ? `<div class="by">A quilt pattern by ${esc(meta.designer)}</div>` : ''}</div>
    <div class="hero">${quiltSvg(Q, { idp: 'pc', size: heroSize })}</div>
    <div class="facts"><div><span>Finished size</span><b>${fmtSize(Q.W, Q.H)}</b></div>
      <div><span>Skill level</span><b>${esc(skill)}</b></div>
      <div><span>Blocks</span><b>${Q.cells.filter(c => c.b).length || '—'}</b></div>
      <div><span>Fabrics</span><b>${plan.fabrics.length}</b></div></div>
    ${meta.description ? `<p class="lede">${esc(meta.description)}</p>` : ''}`);

  /* --- materials --- */
  const stats = quiltingStats(Q);
  P('', `<h2>Materials</h2>
    <p>Yardage assumes ${fmtLen(doc.cutting.wof)}-wide fabric after removing selvages (unless a fabric says otherwise below), includes ${doc.cutting.extra}% extra for shrinkage and mistakes, and is rounded up to the nearest ${({ none: 'inch', eighth: '⅛ yard', quarter: '¼ yard', half: '½ yard' })[doc.cutting.roundTo]}.</p>
    ${patternFabricKeyTable(plan)}
    <table class="pt"><tbody>
      <tr><td><b>Backing</b></td><td>${plan.backing.chosen.from === 'stash' ? `From your stash (${esc(plan.backing.chosen.title.toLowerCase())})` : `${fmtYards(plan.backing.buyIn)} of ${fmtLen(plan.backing.fabricWidth)}-wide ${doc.layout.backing?.fabric ? esc(fabricLabel(doc.layout.backing.fabric)) : 'fabric'}`} — ${esc(plan.backing.chosen.title.toLowerCase())}, to make ${fmtSize(plan.backing.w, plan.backing.h)}</td></tr>
      <tr><td><b>Batting</b></td><td>${fmtSize(plan.batting.w, plan.batting.h)}</td></tr>
      ${doc.layout.binding?.fabric ? `<tr><td><b>Binding</b></td><td>Included above in fabric ${fabricLetter(doc.layout.binding.fabric)} (${fmtLen(doc.layout.binding.width)} strips, double fold)</td></tr>` : ''}
      ${stats.total > 0 ? `<tr><td><b>Thread</b></td><td>About ${Math.ceil(stats.threadYds / 50) * 50} yd for quilting (${Math.round(stats.total / 36)} yd of stitching, top + bobbin)</td></tr>` : ''}
    </tbody></table>
    <div class="note"><b>Before you start.</b> Read all instructions. All seams are ${fmtLen(sa)} unless noted; measurements include seam allowance. <b>WOF</b> = width of fabric. <b>RST</b> = right sides together. <b>HST</b> = half-square triangle.</div>`);

  /* --- cutting --- */
  const tplList = [];
  for (const f of plan.fabrics) for (const r of f.templates) tplList.push({ id: `T${tplList.length + 1}`, fab: f.fab, r, outline: r.recipe.outline, units: r.units });
  const codes = pieceCodes(plan);
  P('', `<h2>Cutting</h2><p>Cut strips across the width of fabric (selvage to selvage), then sub-cut, following the numbered order for each fabric. The map beside each list shows where every cut sits on the fabric you buy; the small pictures show where those pieces go. Label each stack with its piece code (${codeTag('A1')} = fabric A, piece 1) — the block diagrams and the assembly map use the same codes.</p>` +
    plan.fabrics.map(f => {
      const sheet = fabricSheet(f);
      let list = '';
      sheet.rows.forEach((row, i) => {
        let extra = '';
        if (row.kind === 'template') { const t = tplList.find(x => x.r === row.r); if (t) extra = ` <i>(template ${t.id})</i>`; }
        const rec = row.group?.recipes || (row.a ? [row.a] : row.r ? [row.r] : []);
        const uses = [];
        for (const r of rec) for (const u of r.uses?.values() || []) if (u.b && !uses.some(x => x.b === u.b)) uses.push(u);
        list += `<li><span class="stepno">${i + 1}</span><div>${codes.forRow(row).map(e => codeTag(e.code)).join('')}<b>${row.head}</b>${extra}<br>${row.parts.map(esc).join('<br>')}${uses.length ? `<div class="uses">${uses.map(u => usageThumbSvg(u, 0.42, 'in')).join('')}</div>` : ''}</div></li>`;
      });
      const st = stashUseText(f);
      const maps = fabricSheets(f).map((sh, i) => `${sh.src.kind === 'stash' ? `<div class="map-cap">Your ${esc(sh.src.name.toLowerCase())}</div>` : sh.src.kind === 'precut' ? `<div class="map-cap">${esc(sh.src.name)}</div>` : sh.src.fallback ? '<div class="map-cap">Yardage for the larger cuts</div>' : st ? '<div class="map-cap">Yardage for the rest</div>' : ''}${fabricSheetSvg(sh, f.fab, { width: 2.4, unit: 'in', idp: 'pc' + i, title: sh.title })}`).join('');
      return `<div class="cut-fab"><h3>${swatchHtml(f.fab, 20)} Fabric ${fabricLetter(f.fab)} — ${esc(fabricLabel(f.fab))} <span class="muted" style="font-weight:400">· ${st && !f.buyIn ? `all from ${esc(st)}` : `buy ${buyText(f)}${st ? `, plus ${esc(st)}` : ''}`}</span></h3>
        <div class="cut-cols"><ol class="cut-list">${list}</ol><div class="cut-map">${maps}</div></div></div>`;
    }).join(''));

  /* --- templates (true scale) --- */
  if (tplList.length) {
    const maxW = page.w - 0.2, maxH = page.h - 1.8;
    const singles = [], tiled = [];
    for (const t of tplList) {
      const ts = templateSvg(t, maxW, maxH);
      const app = t.r.recipe.applique ? (doc.cutting.appMethod === 'fusible' ? ' · fusible appliqué — printed reversed, trace on the line, no allowance' : ' · appliqué (3/16" turn-under)') : '';
      const head = `<div class="tpl-head"><b>${t.id}</b> · ${esc(t.r.recipe.makes)} · fabric ${fabricLetter(t.fab)} · cut ${t.units}${app}</div>`;
      if (ts.tiles.length === 1) singles.push(`<div class="tpl">${head}${ts.tiles[0].svg}</div>`);
      else tiled.push({ t, ts, head });
    }
    P('', `<h2>Templates</h2><div class="note warn"><b>Print at 100% / "Actual size".</b> Check the 1-inch square before tracing. Solid line = sewing line, dashed line = cutting line (includes seam allowance). Arrow = straight grain.</div><div class="cal">${calibrationSvg()}</div>${tiled.length ? `<p class="small">${plural(tiled.length, 'template')} ${tiled.length === 1 ? 'is' : 'are'} bigger than a page and ${tiled.length === 1 ? 'is' : 'are'} printed over several sheets — see the sheet atlas after ${singles.length ? 'these' : 'this page'}.</p>` : ''}<div class="tpls">${singles.join('')}</div>`);
    if (tiled.length) {
      // atlas: how each template's sheets fit together, four templates to a page
      const items = tiled.map(({ t, ts }) => {
        const printed = ts.tiles.filter(x => !x.blank).length;
        return `<div class="atlas-item"><div class="tpl-head"><b>${t.id}</b> · ${esc(t.r.recipe.makes)} · fabric ${fabricLetter(t.fab)} · ${plural(printed, 'sheet')}${printed < ts.tiles.length ? ` (${ts.tiles.length - printed} blank, not printed)` : ''}</div>${templateAtlasSvg(t, ts, page.w / 2 - 0.25, page.h / 2 - 1.1)}</div>`;
      });
      for (let i = 0; i < items.length; i += 4) {
        P('', `<h2>Template sheet atlas${items.length > 4 ? ` (${i / 4 + 1} of ${Math.ceil(items.length / 4)})` : ''}</h2>
          <p>Each large template prints over several sheets, named by row letter and column number (${tiled[0].ts.tiles[0].id} is the top-left sheet of ${tiled[0].t.id}). Lay the sheets out like the pictures below, then for each sheet: trim along its red border lines (top and left), lay it over the shaded glue strips of the sheets above and to its left so the lines meet, and tape. Grey squares are blank and aren't printed.</p>
          <div class="atlas">${items.slice(i, i + 4).join('')}</div>`);
      }
      for (const { t, ts, head } of tiled) {
        const printed = ts.tiles.filter(x => !x.blank);
        const at = (tx, ty) => ts.tiles.find(x => x.tx === tx && x.ty === ty && !x.blank);
        printed.forEach((tl, n) => {
          const nb = [['above', at(tl.tx, tl.ty - 1)], ['left', at(tl.tx - 1, tl.ty)], ['right', at(tl.tx + 1, tl.ty)], ['below', at(tl.tx, tl.ty + 1)]].filter(([, x]) => x);
          P('', `<div class="tpl">${head}<div class="sheet-bar">${templateAtlasSvg(t, ts, 0.9, 0.9, tl.id)}<div class="sheet-txt"><div class="sheet-id">${tl.id}</div><div class="tile-note">Sheet ${n + 1} of ${printed.length} for template ${t.id}${nb.length ? ` · ${nb.map(([w, x]) => `${w}: <b>${x.id}</b>`).join(' · ')}` : ''}</div></div>${scaleBarSvg()}</div>${tl.svg}</div>`);
        });
      }
    }
  }

  /* --- blocks --- */
  for (const { id, size: BSZ } of blockJobs) {
    const b = doc.blocks[id];
    const inPanel = Q.cells.some(c => c.b === id && c.size === BSZ && c.row === 'panel');
    const n = Q.cells.filter(c => c.b === id && c.size === BSZ).length;
    const trimmed = Q.cells.filter(c => c.b === id && c.size === BSZ && c.clip).length;
    const steps = blockStepsHtml(b, BSZ, sa, n);
    const fabs = uniq(blockPieces(b, BSZ, BSZ).map(p => resolveFab(p.fab))).sort((a, c) => fabricIndex(a) - fabricIndex(c));
    let h = `<h2>${esc(b.name)}${inPanel ? ' <span class="muted" style="font-weight:400;font-size:12pt">(centre panel)</span>' : ''}</h2>
      <div class="block-head"><div>${blockDiagramSvg(b, BSZ, 2.2, { codes: blockPieceCodes(codes, id, BSZ) })}</div><div>
        <div class="callout">Make <b>${n}</b> block${n === 1 ? '' : 's'}</div>
        <p>Finished ${blockSizeText(b, BSZ)} · unfinished ${blockSizeText(b, BSZ, 2 * sa)}</p>
        ${trimmed ? `<p><b>${trimmed}</b> of them run off the edge${(doc.layout.panels || []).length ? ' or under the panel' : ''}: make them whole — they're trimmed after the top is assembled.</p>` : ''}
        <div class="fab-key">${fabs.map(f => `<span>${swatchHtml(f, 16)}<b>${fabricLetter(f)}</b> ${esc(fabricLabel(f))}</span>`).join('')}</div>
      </div></div><ol class="steps">`;
    for (const s of steps) h += `<li><div class="step-text">${s.text}</div>${s.diag ? `<div class="step-diag">${s.diag}</div>` : ''}</li>`;
    h += '</ol>';
    // pieces for one block, each pointing back to the cutting step that makes it
    const pieceKey = [];
    for (const f of plan.fabrics) {
      fabricSheet(f).rows.forEach((row, i) => {
        const rec = row.group?.recipes || (row.a ? [row.a] : row.r ? [row.r] : []);
        for (const r of rec) {
          const u = r.uses?.get(id);
          if (u) pieceKey.push({ f: f.fab, step: i + 1, r, u });
        }
      });
    }
    if (pieceKey.length) {
      h += `<h3>Pieces for one block <span class="h-note">· codes match the block picture and the cutting list</span></h3><div class="piece-key">${pieceKey.map(({ f, step, r, u }) => {
        const e = codes.list.find(x => x.r === r), t = tplList.find(x => x.r === r);
        return `<div>${usageThumbSvg(u, 0.55, 'in')}<span>${e ? codeTag(e.code) : ''}<b>${u.idx.size} × ${esc(r.recipe.makes)}</b><br>fabric <b>${fabricLetter(f)}</b>, cutting step ${step}${t ? `, template ${t.id}` : ''}</span></div>`;
      }).join('')}</div>`;
    }
    P('', h);
  }

  /* --- quilt top assembly --- */
  if (Q.mode === 'tess') {
    const am = assemblyMap(Q, codes, sa, page, tplList, blockJobs);
    P('', `<h2>Quilt top assembly</h2>${am.hero}${am.legend}${assemblyText(Q, sa)}`);
    for (const sec of am.sections) P('', sec);
  } else {
    const asmSize = fit(Q.W, Q.H, page.w * 0.8, page.h * 0.42);
    let asm = `<h2>Quilt top assembly</h2><div class="hero">${quiltSvg(Q, { idp: 'pa', size: asmSize, labels: true, seams: true, binding: false })}</div>`;
    asm += assemblyText(Q, sa);
    P('', asm);
  }

  /* --- quilting --- */
  const layers = doc.quilting.layers.filter(l => l.visible);
  if (layers.length) {
    const qs = fit(Q.W, Q.H, page.w, page.h * 0.5);
    let h = `<h2>Quilting</h2><div class="hero">${quiltSvg(Q, { idp: 'pq', size: qs, faded: true, binding: false, quilting: quiltingSvg(Q, layers, 1.4) })}</div><ol>`;
    for (const L of layers) h += `<li><span class="qsw" style="background:${L.color}"></span>${quiltingInstructions(L)}</li>`;
    h += `</ol><p>Total stitching ≈ <b>${Math.round(stats.total / 36)} yd</b> — have at least ${Math.ceil(stats.threadYds / 50) * 50} yd of thread on hand (top + bobbin).</p>`;
    P('', h);
  }

  /* --- finishing --- */
  const bnd = doc.layout.binding;
  P('', `<h2>Finishing</h2>
    <h3>Backing</h3>${doc.layout.backing?.fabric || layers.length ? `<figure class="back-fig">${quiltBackSvg(Q, { size: fit(Q.W, Q.H, page.w * 0.34, page.h * 0.3), layers, scaleHint: 1.4 })}<figcaption>The back of the finished quilt${layers.length ? ' — quilting shown mirrored, as it appears from behind' : ''}</figcaption></figure>` : ''}<p>Make a backing at least ${fmtSize(plan.backing.w, plan.backing.h)} (the quilt plus ${fmtLen(doc.cutting.overhang ?? 4)} all round) — ${esc(plan.backing.chosen.title.toLowerCase())}:</p>
    <div class="back-plan">${backingDiagramSvg(plan.backing, plan.backing.chosen, { width: '2.8in' })}<ol>${plan.backing.chosen.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>
    <h3>Layer and baste</h3><p>Lay the backing wrong side up, smooth and tape it taut. Centre the batting (${fmtSize(plan.batting.w, plan.batting.h)}) and then the quilt top, right side up. Baste with pins every 4–6", spray baste, or thread baste, working from the centre out.</p>
    <h3>Quilt</h3><p>${layers.length ? 'Quilt as shown on the Quilting page.' : 'Quilt as desired — straight lines, free motion, or hand quilting.'} Keep the quilting density even across the quilt. Trim the batting and backing even with the top.</p>
    ${bnd?.fabric ? `<h3>Binding</h3><ol>
      <li>Join the ${fmtLen(bnd.width)} binding strips (fabric ${fabricLetter(bnd.fabric)}) end to end with diagonal seams; trim to ¼" and press open.</li>
      <li>Press the strip in half lengthwise, wrong sides together.</li>
      <li>Starting midway along one side, sew the raw edges to the front of the quilt with a ${fmtLen(sa)} seam, mitring each corner. Join the ends.</li>
      <li>Fold the binding to the back and stitch the folded edge down by hand or machine.</li></ol>` : ''}
    <h3>Label</h3><p>Add a label with the quilt's name, your name, and the date.</p>`);

  /* --- notes --- */
  P('', `<h2>Notes</h2><div class="notes-lines"></div>
    <p class="credits">${title}${meta.designer ? ` · designed by ${esc(meta.designer)}` : ''} · pattern generated ${new Date().toISOString().slice(0, 10)} with Quilt Designer ${APP_VERSION}.</p>`);

  return pages.map((p, i) => `<section class="page ${p.cls}">${p.html}<footer><span>${title}</span><span>Quilt Designer ${APP_VERSION}</span></footer></section>`).join('');
}

// Making and setting in the inset panels (any setting). `name` = what surrounds them.
function panelStepsHtml(Q, sa, name, exact) {
  let h = '';
  for (const p of doc.layout.panels || []) {
    const pg = panelGeom(p, Q.inner.w, Q.inner.h);
    const content = p.b && doc.blocks[p.b] ? `the ${esc(doc.blocks[p.b].name)} block` : p.fab ? `a ${fmtSize(p.size, p.size)} square of fabric ${fabricLetter(p.fab)}` : 'the centre square';
    const frames = (p.frames || []).filter(f => f.width > 0);
    const tess = Q.mode === 'tess';
    h += `<li><b>Panel:</b> ${frames.length ? `frame ${content} with ${frames.map((f, k) => `${fmtLen(f.width)} strips of fabric ${fabricLetter(f.fabric)}${k === 0 ? ' (innermost)' : ''}`).join(', then ')} — sides first, then top and bottom — so it measures ${fmtSize(pg.outer + 2 * sa, pg.outer + 2 * sa)} unfinished.` : `${content} measures ${fmtSize(pg.outer + 2 * sa, pg.outer + 2 * sa)} unfinished.`}</li>
      <li><b>Setting the panel in:</b> piece the ${name} in sections — the full-width rows above and below the panel, and the shorter rows to its left and right. ${exact ? 'The pieces along the panel are cut to shape, so each section already has a straight edge there.' : tess ? `Trim each section's edge that meets the panel straight, ${fmtLen(sa)} beyond the panel line.` : `Blocks the panel partly covers are made whole and sewn into their section; then trim the section's edge that meets the panel straight, ${fmtLen(sa)} beyond the panel line.`} Sew the left and right sections to the panel, then add the top and bottom sections, matching seams.</li>`;
  }
  return h;
}

function assemblyText(Q, sa) {
  const L = doc.layout;
  let h = '';
  if (Q.mode === 'grid') {
    const g = L.grid;
    const ids = uniq(Q.cells.filter(c => c.b).map(c => c.b));
    const num = id => ids.indexOf(id) + 1;
    const rot = c => c.rot ? ` ↻${c.rot * 90}°` : '';
    h += `<p>Lay out the blocks in ${g.rows} rows of ${g.cols} as shown. Key: ${ids.map(id => `<b>${num(id)}</b> = ${esc(doc.blocks[id].name)}`).join(', ')}${Q.cells.some(c => c.fab) ? ', <b>□</b> = plain square' : ''}${Q.cells.some(c => c.flip) ? ', <b>⇋</b> = mirrored' : ''}.</p><table class="pt grid-key"><tbody>`;
    for (let r = 0; r < g.rows; r++) {
      h += `<tr><th>${letterFor(r)}</th>`;
      for (let c = 0; c < g.cols; c++) {
        // positions under a panel are gone (or trimmed plain squares, now pieces)
        const cell = Q.cells.find(x => x.key === `g${r * g.cols + c}`) || { fab: Q.tiles.find(x => x.key === `g${r * g.cols + c}`)?.fab, part: true };
        h += `<td>${cell.b ? `${num(cell.b)}${rot(cell)}${cell.flip ? ' ⇋' : ''}${cell.clip ? ' ✂' : ''}` : cell.fab ? `□ ${fabricLetter(cell.fab)}${cell.part ? ' ✂' : ''}` : cell.part ? '<i>panel</i>' : '—'}</td>`;
      }
      h += '</tr>';
    }
    h += `</tbody></table><ol>`;
    const sw = g.sashing.width;
    if (sw) {
      h += `<li>Sew each row together, placing a ${fmtSize(sw, Q.BS)} (finished) sashing strip between blocks${g.sashing.outer ? ' and at both ends' : ''}. Press toward the sashing.</li>`;
      h += g.sashing.cornerstones
        ? `<li>Make sashing rows: alternate sashing strips with cornerstones (fabric ${fabricLetter(g.sashing.cornerFabric)}). Press toward the sashing.</li><li>Join block rows and sashing rows, matching cornerstones to the vertical sashing.</li>`
        : `<li>Join the rows with long horizontal sashing strips between them${g.sashing.outer ? ' and at the top and bottom' : ''}. Mark the block positions on each strip so the vertical sashing lines up.</li>`;
    } else {
      h += `<li>Sew the blocks in each row together. Press the seams of alternate rows in opposite directions.</li><li>Join the rows, nesting the seams at each intersection.</li>`;
    }
    h += panelStepsHtml(Q, sa, 'blocks', false) + '</ol>';
  } else if (Q.mode === 'onpoint') {
    h += `<ol><li>Lay out the blocks on point with the side setting triangles (fabric ${fabricLetter(L.onpoint.fill)}) at the ends of each diagonal row, as numbered.</li>
      <li>Sew the blocks and side triangles of each diagonal row together. The setting triangles are cut oversized slightly; align their square corner with the block edge.</li>
      ${Q.cells.some(c => c.setting) ? '<li>Blocks shown in setting-triangle positions are made whole and sewn into their diagonal rows like the others; only part of them shows, and the rest is trimmed away with the edges in the last step.</li>' : ''}
      <li>Join the diagonal rows, matching seams. Add the four corner triangles last.</li>
      <li>Trim the edges straight, leaving ${fmtLen(sa)} beyond the block points for seam allowance.</li>${panelStepsHtml(Q, sa, 'blocks', false)}</ol>`;
  } else {
    const t = L.tess, name = tessShape(t.shape).label.replace(/ \(.*\)$/, '').toLowerCase();
    const edge = t.edge !== 'fill' && t.cutEdges ? 'Edge pieces are cut to their exact shape (each has its own code on the map), so the edges come out straight — no trimming needed. Sew them in with their rows.' : t.edge === 'fill' ? `Partial shapes at the edges are cut from fabric ${fabricLetter(t.fill)} so the quilt finishes with straight edges.` : 'Shapes at the edges are trimmed straight after the top is assembled — cut them as whole shapes and trim later, or use the edge templates.';
    const how = {
      hex: 'Hexagons need set-in (Y) seams. English paper piecing (EPP) is the easiest route: baste each hexagon over a paper template and whip-stitch neighbours together. By machine, sew hexagons into rows, stopping ¼" from each end, then set rows together.',
      tumbling: 'Sew three diamonds (one of each orientation) into a hexagon "cube" with set-in seams, then join the cubes into rows. EPP works well here too.',
      triangle: 'Sew the triangles into rows, alternating point up and point down and offsetting each by ¼" so the edges align. Join the rows, matching points.',
      zigzag: 'Sew the parallelograms into horizontal rows, matching the angled edges. Join the rows so the zigzags line up into lightning bolts.',
      brick: 'Sew the bricks into rows, then join the rows, offsetting every other row by half a brick.',
      diamond: 'Sew the diamonds into diagonal rows, then join the rows, matching points.',
      square: t.orient === 1 ? 'Sew the on-point squares into diagonal rows, then join the rows.' : 'Sew the squares into rows, then join the rows, nesting seams.',
    }[t.shape];
    const nWhole = Q.tiles.filter(x => x.whole).length, hexBlocks = Q.cells.filter(c => c.hex);
    h += `<p>${t.shape === 'tumbling' ? `${nWhole} whole diamonds (about ${Math.round(nWhole / 3)} cubes)` : `${nWhole} whole ${name}`}${hexBlocks.length ? ` and ${plural(hexBlocks.length, 'hexagon block')}` : ''} make up the top.</p><ol>${hexBlocks.length ? `<li>Make the hexagon blocks (see their pages) and lay them out with the plain hexagons as shown, turning each as pictured. Treat each block as one hexagon from here on.</li>` : ''}<li>${how}</li><li>${edge}</li>`;
    h += panelStepsHtml(Q, sa, name, t.cutEdges);
    h += '</ol>';
  }
  const bs = L.borders.filter(b => b.width > 0);
  if (bs.length) {
    h += `<h3>Borders</h3><p>Measure the quilt through the centre and adjust these lengths if yours differs. For each border, sew the side strips first, press toward the border, then add the top and bottom.</p><ol>`;
    for (const p of Q.patches.filter(p => p.role === 'border' && (p.side === 'left' || p.side === 'top'))) {
      const bb = bounds(p.pts);
      h += `<li>Border ${p.ring + 1} (fabric ${fabricLetter(p.fab)}), ${p.side === 'left' ? 'sides' : 'top & bottom'}: ${fmtSize(Math.max(bb.w, bb.h) + 2 * sa, Math.min(bb.w, bb.h) + 2 * sa, 'up')} (cut size)</li>`;
    }
    h += '</ol>';
  }
  return h;
}
