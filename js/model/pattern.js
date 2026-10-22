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
    if (an.units.some(u => CURVED_UNITS.has(u.unit.type))) score += 2;
    if (an.curveIssue) score += 3;
    if (an.applique.length) score += doc.cutting.appMethod === 'fusible' ? 1 : 2;   // needle-turn takes practice
  }
  if ((doc.layout.panels || []).length) score++;
  if (plan.fabrics.some(f => f.templates.length)) score++;
  if (Q.mode === 'onpoint') score++;
  if (Q.mode === 'tess' && ['hex', 'tumbling', 'triangle'].includes(doc.layout.tess.shape)) score += 2;
  return score <= 1 ? 'Beginner' : score <= 3 ? 'Confident beginner' : score <= 5 ? 'Intermediate' : 'Advanced';
}

// Binding, step by step, with the three moves people find hardest drawn out.
function bindingStepsHtml(bnd, sa) {
  const W = fmtLen(bnd.width), fold = fmtLen(bnd.width / 2);
  const fig = (svg, cap) => `<figure class="bind-fig">${svg}<figcaption>${cap}</figcaption></figure>`;
  const st = 'stroke="#2b3a4a" stroke-width="1.2"', fab = fabricFill(bnd.fabric), dash = 'stroke="#b5482f" stroke-width="1.4" stroke-dasharray="4 3"';
  const join = `<svg viewBox="0 0 150 110" width="1.6in"><rect x="10" y="40" width="90" height="30" fill="${fab}" ${st}/><rect x="70" y="10" width="30" height="90" fill="${fab}" ${st} fill-opacity=".8"/><line x1="70" y1="40" x2="100" y2="70" ${dash}/><text x="110" y="60" font-size="10" fill="#2b3a4a">sew</text></svg>`;
  const mitre = `<svg viewBox="0 0 150 110" width="1.6in"><rect x="10" y="30" width="90" height="70" fill="#f4f1ea" ${st}/><rect x="10" y="30" width="80" height="10" fill="${fab}" ${st}/><path d="M90 30 L120 0 L130 10 L100 40 Z" fill="${fab}" ${st} fill-opacity=".85"/><text x="18" y="66" font-size="10" fill="#2b3a4a">fold up at 45°,</text><text x="18" y="80" font-size="10" fill="#2b3a4a">then down</text></svg>`;
  const ends = `<svg viewBox="0 0 150 110" width="1.6in"><rect x="10" y="45" width="80" height="18" fill="${fab}" ${st}/><rect x="60" y="45" width="80" height="18" fill="${fab}" ${st} fill-opacity=".75"/><line x1="60" y1="35" x2="60" y2="75" ${dash}/><line x1="78" y1="35" x2="78" y2="75" ${dash}/><text x="52" y="92" font-size="10" fill="#2b3a4a">overlap = ${esc(W)}</text></svg>`;
  return `<h3>Binding</h3><div class="bind-figs">${fig(join, 'Join strips on the diagonal')}${fig(mitre, 'Mitre each corner')}${fig(ends, 'Join the ends')}</div><ol>
      <li>Lay one ${W} strip (fabric ${fabricLetter(bnd.fabric)}) right side up. Lay a second strip right side down across its end at a right angle, so they make an L with the ends overlapping in a square. Draw a line across the square from the inside corner to the outside corner and sew on it. Open it to check it makes a straight strip, then trim ${fmtLen(sa)} beyond the seam and press it open. Join all the strips this way into one long strip.</li>
      <li>Press the strip in half lengthwise, wrong sides together, so it is ${fold} wide.</li>
      <li>Trim the batting and backing even with the quilt top.</li>
      <li>Start midway along one side. Leaving a 10" tail, sew the raw edges of the binding to the front of the quilt with a ${fmtLen(sa)} seam (a walking foot helps keep the layers together). Stop ${fmtLen(sa)} from the corner and backstitch.</li>
      <li>Fold the binding up at 45°, away from the quilt, then fold it straight down along the next side, the fold level with the edge you just sewed. Start sewing again at the edge. Repeat at every corner.</li>
      <li>Stop about 10" before where you started. Lay both tails flat along the edge and trim them so they overlap by exactly ${W} (the strip width). Open them out, lay them right sides together at a right angle and sew corner to corner as in step 1. Check, trim to ${fmtLen(sa)}, refold and finish sewing.</li>
      <li>Fold the binding over to the back so it just covers the stitching line. At each corner fold one side over, then the other, to make a neat diagonal (a mitre); a pin or clip holds it.</li>
      <li>Hand-stitch it down with a blind stitch, or machine-stitch from the front in the ditch next to the binding.</li></ol>`;
}
function battingText(b) {
  const o = battingBuy(b.w, b.h);
  return `At least ${fmtSize(b.w, b.h)}: ${[o.pack, o.byYard].filter(Boolean).join(', or ')}. Cotton or 80/20 cotton-poly is easiest to quilt on a home machine.`;
}
function bindingText(plan) {
  const bnd = doc.layout.binding, f = plan.fabrics.find(x => x.fab === resolveFab(bnd.fabric)), j = f?.joined.find(x => x.binding);
  if (!j) return `${fmtLen(bnd.width)} strips, double fold`;
  const w = fabricFormat(bnd.fabric).yardage ? fabricFormat(bnd.fabric).width : doc.cutting.wof;
  // j.count is the yardage strips; stash pieces can give some too
  const n = sum(f.layouts, l => l.L.joinedCount.get(j) || 0), own = n - j.count;
  if (own) return `${plural(n, 'strip')} ${fmtLen(bnd.width)} wide from fabric ${fabricLetter(bnd.fabric)} (${j.count ? `${own} from your stash, ${j.count} from yardage` : 'all from your stash'}), joined into ${fmtLen(j.total, 'up')} of double-fold binding.`;
  return `${plural(j.count, 'strip')} ${fmtLen(bnd.width)} × ${fmtLen(w)} from fabric ${fabricLetter(bnd.fabric)} (about ${fmtYards(roundYardIn(j.count * bnd.width, 'eighth'))}, included in its amount above), joined into ${fmtLen(j.total, 'up')} of double-fold binding.`;
}

function patternFabricKeyTable(plan, compact) {
  let h = `<table class="pt"><thead><tr><th></th><th>Fabric</th><th>Used for</th>${compact ? '' : '<th>Cut length</th>'}<th>Buy</th></tr></thead><tbody>`;
  for (const f of plan.fabrics) {
    h += `<tr><td class="key">${swatchHtml(f.fab, 22)}<b>${fabricLetter(f.fab)}</b></td><td>${esc(fabricLabel(f.fab))}${fabricById(f.fab).directional ? ' <i>(directional)</i>' : ''}</td>
      <td>${esc(f.sources.join(', '))}</td>${compact ? '' : `<td>${neededText(f)}</td>`}<td>${stashUseText(f) && !f.buyIn && !f.buyPieces ? `<small>all from ${esc(stashUseText(f))}</small>` : fallbackInfo(f) ? (fallbackInfo(f).none ? `<b>${fmtYards(f.buyIn)}</b><br><small>${esc(fallbackReason(fallbackInfo(f), true))}</small>` : `<b>${plural2(f.buyPieces, f.format.name)}</b><br><b>+ ${fmtYards(f.buyIn)}</b> yardage<br><small>for ${esc(fallbackReason(fallbackInfo(f), true))}</small>`) : `<b>${buyText(f)}</b>${stashUseText(f) ? `<br><small>plus ${esc(stashUseText(f))}</small>` : f.fq ? '<br><small>or 1 fat quarter</small>' : ''}`}</td></tr>`;
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
  const { cls, holes } = tileCutCls(t);
  return recipeFor(cls, sa, { directional: !!fabricById(t.fab).directional, holes }).key;
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
// opts.sa with opts.level: each sewn part is drawn at its cut size, like the real thing. Its outer
// edges carry on to the raw edge sa beyond (each seam running straight on), with the finished
// outline dashed. Parts that are neither rectangles nor convex are drawn finished.
function blockDiagramSvg(block, BS, paperIn, opts = {}) {
  const an = analyzeBlock(block, BS);
  const sa = opts.level && opts.sa || 0;
  const gap = opts.level ? BS * 0.06 + 2 * sa : 0;
  const placed = opts.level ? explodedPieces(an, opts.level, gap) : blockPieces(block, BS, BS).filter(p => !p.app).map(p => ({ p, dx: 0, dy: 0 }));
  const app = an.applique;
  // each sewn part at this step, at cut size: a rectangle (any pieces, curved too) or a convex part
  // of straight-edged pieces. x.face is what a piece shows; parts of other shapes stay finished.
  const parts = [];
  if (sa) {
    const byPart = new Map();
    for (const x of placed) { x.face = translatePoly(x.p.pts, x.dx, x.dy); if (!byPart.has(x.part)) byPart.set(x.part, []); byPart.get(x.part).push(x); }
    for (const list of byPart.values()) {
      const bb = bounds(list.flatMap(x => x.face));
      const area = sum(list, x => polyArea(x.p.pts) - sum(x.p.holes, h => polyArea(h)));
      if (Math.abs(bb.w * bb.h - area) < 1e-3 * bb.w * bb.h) {
        const g = { sa, W: bb.w, H: bb.h, UW: bb.w + 2 * sa, UH: bb.h + 2 * sa }, ox = bb.minX - sa, oy = bb.minY - sa;
        for (const x of list) x.face = translatePoly(howtoExtend(g, translatePoly(x.face, -ox, -oy)), ox, oy);
        parts.push({ list, cut: rectPts(ox, oy, g.UW, g.UH), fin: rectPts(bb.minX, bb.minY, bb.w, bb.h) });
      } else if (list.every(x => !x.p.holes.length)) {
        const c = howtoConvexCut(list.map(x => x.face), sa);
        if (!c) continue;
        list.forEach((x, i) => { x.face = c.faces[i]; });
        parts.push({ list, cut: c.cut, fin: c.hull });
      }
    }
  }
  let maxX = BS, maxY = BS, minX = 0, minY = 0;
  for (const { p, dx, dy } of placed) {
    maxX = Math.max(maxX, p.bb.maxX + dx); maxY = Math.max(maxY, p.bb.maxY + dy);
    minX = Math.min(minX, p.bb.minX + dx); minY = Math.min(minY, p.bb.minY + dy);
  }
  for (const { cut } of parts) for (const [x, y] of cut) { maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); minX = Math.min(minX, x); minY = Math.min(minY, y); }
  const W = maxX - minX, H = maxY - minY;
  const scale = paperIn / Math.max(W, H);
  const hair = BS * 0.004;
  let s = `<svg class="diag" viewBox="${round(minX, 3)} ${round(minY, 3)} ${round(W, 3)} ${round(H, 3)}" width="${round(W * scale, 3)}in" height="${round(H * scale, 3)}in">`;
  const faded = (unit) => opts.dim && !(opts.highlight && unit && opts.highlight.has(unit)) ? ' opacity=".35"' : '';
  for (const { p, dx, dy, unit, face } of placed) {
    const pts = face || translatePoly(p.pts, dx, dy);
    s += `<path d="${polyToPath(pts)}${p.holes.map(hh => polyToPath(translatePoly(hh, dx, dy))).join('')}" fill="${fabricFill(p.fab)}" fill-rule="evenodd" stroke="#2b3a4a" stroke-width="${hair}"${faded(unit)}/>`;
  }
  for (const { list, cut, fin } of parts) {
    const op = list.some(x => !faded(x.unit)) ? '' : ' opacity=".35"';
    s += `<path d="${polyToPath(cut)}" fill="none" stroke="#2b3a4a" stroke-width="${hair * 1.5}" stroke-linejoin="miter" stroke-miterlimit="20"${op}/>`
      + `<path d="${polyToPath(fin)}" fill="none" stroke="${HOWTO_GREY}" stroke-width="${hair * 1.2}" stroke-dasharray="${hair * 4} ${hair * 3}"${op}/>`;
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

const UNIT_NAMES = { hst: 'half-square triangle (HST) unit', qst: 'quarter-square triangle (QST) unit', goose: 'flying-geese unit', snowball: 'stitch-and-flip unit', curved: 'curved unit', hrt: 'half-rectangle triangle (HRT) unit', complex: 'set-in unit',
  peel: 'orange-peel unit', inset: 'inset circle unit', curveComplex: "curved part that can't be pieced" };
const CURVE_WHY = { meet: 'curved seams meet at a point inside, not at an edge', cross: 'a curve crosses a straight seam', corner: 'a curved seam turns a corner', S: 'a set-in shape bends both ways', many: 'curved shapes overlap' };

// How to make one kind of unit: what it is, then lettered sub-steps (one action each).
// n = units per block, copies = blocks. Every size is a cut or unfinished size.
function unitMethodText(type, sample, n, sa, copies = 1) {
  const r = sample.rect, unf = fmtSize(r.w + 2 * sa, r.h + 2 * sa), S = fmtLen(sa);
  const L = f => `<b>${fabricLetter(resolveFab(f))}</b>`;
  const byLight = uniq((sample.unit.fabs || []).map(resolveFab)).sort((p, q) => luminance(fabricHex(q)) - luminance(fabricHex(p)));
  const lt = byLight[0], dk = byLight[byLight.length - 1];
  // copies 0: every block in the quilt is partial, so the numbers are for one block
  const total = n * (copies || 1);
  const make = (one, many, what) => (copies ? `Make <b>${total}</b> ${total === 1 ? one : many}${copies > 1 ? ` (${n} per block)` : ''}. ` : `Each block has <b>${n}</b> ${n === 1 ? one : many}. Make the ones that show. `) + what;
  const steps = list => `<ol class="sub">${list.map(t => `<li>${t}</li>`).join('')}</ol>`;
  const spare = got => (got > total ? ` You'll have ${got - total} spare.` : '');
  switch (type) {
    case 'hst': {
      const sq = fmtLen(ceilEighth(r.w + sa * (2 + Math.SQRT2)), 'up'), pairs = Math.ceil(total / 2);
      return make('half-square triangle (HST)', 'half-square triangles (HSTs)', `An HST is a square made of two triangles, here ${L(lt)} and ${L(dk)}.`) + steps([
        `Draw a diagonal line, corner to corner, on the wrong side of each ${sq} ${L(lt)} square.`,
        `Place each on a ${sq} ${L(dk)} square, right sides together, edges matching.`,
        `Sew ${S} from the line on both sides.`,
        `Cut on the drawn line. Each pair of squares makes 2 HSTs (${plural(pairs, 'pair')} make ${pairs * 2}).${spare(pairs * 2)}`,
        `Open each HST and press the seam toward ${L(dk)}. Trim off the dog ears (the small points sticking out at two corners). Each HST should measure ${unf}; trim if needed, keeping the seam corner to corner.`,
      ]);
    }
    case 'qst': {
      if (sample.unit.hourglass) {
        const sq = fmtLen(ceilEighth(r.w + 2 * sa * (1 + Math.SQRT2)), 'up'), pairs = Math.ceil(total / 2);
        return make('quarter-square triangle (QST)', 'quarter-square triangles (QSTs)', `A QST (also called an hourglass) is a square made of four triangles meeting in the centre. You make HSTs first, then cut them again.`) + steps([
          `Make HSTs: draw a diagonal on the wrong side of each ${sq} ${L(lt)} square, place it on a ${sq} ${L(dk)} square right sides together, sew ${S} each side of the line and cut on it. Press toward ${L(dk)}. Don't trim these HSTs.`,
          `Draw a diagonal on the wrong side of half the HSTs, corner to corner across the seam.`,
          `Place each marked HST on an unmarked one, right sides together, ${L(lt)} facing ${L(dk)}. The seams lie on top of each other, pressed in opposite directions so they butt together (nest).`,
          `Sew ${S} each side of the line and cut on it. Each pair of HSTs makes 2 QSTs.${spare(pairs * 2)}`,
          `Press, then trim each QST to ${unf}, keeping the centre point in the centre: line up the ruler's diagonal line with a seam.`,
        ]);
      }
      return make('quarter-square triangle (QST)', 'quarter-square triangles (QSTs)', `A QST is a square made of four triangles meeting in the centre, here ${byLight.map(L).join(', ')}.`) + steps([
        `Lay out the four triangles of each unit as in the picture.`,
        `Sew them in pairs along a short edge, right sides together, to make two halves. The long edges are bias, so handle them gently. Press toward the darker fabric.`,
        `Place the halves right sides together, nesting the centre seams so the points meet, and sew along the long edge.`,
        `Press and trim the dog ears. Each unit should measure ${unf}.`,
      ]);
    }
    case 'goose': {
      const big = fmtLen(ceilEighth(Math.max(r.w, r.h) + 2 * sa * (1 + Math.SQRT2)), 'up');
      const small = fmtLen(ceilEighth(Math.min(r.w, r.h) + sa * (2 + Math.SQRT2)), 'up');
      const bigs = Math.ceil(total / 4), g = L(sample.unit.goose), k = L(sample.unit.sky);
      return make('flying-geese unit', 'flying-geese units', `A flying-geese unit is a rectangle with a large ${g} triangle (the "goose") and a small ${k} triangle (the "sky") on each side. They're made four at a time: each ${big} ${g} square and four ${small} ${k} squares make 4 geese (${plural(bigs, 'big square')} and ${bigs * 4} small squares make ${bigs * 4}).${spare(bigs * 4)}`) + steps([
        `Draw a diagonal line on the wrong side of each ${small} ${k} square.`,
        `Place two of them on opposite corners of a ${big} ${g} square, right sides together, so the drawn lines form one line across the big square. The small squares overlap a little in the middle.`,
        `Sew ${S} from the line on both sides. Cut on the drawn line.`,
        `Press the small triangles out, away from the big one. You now have two heart-shaped pieces.`,
        `Place a ${small} ${k} square on the ${g} corner of each heart, right sides together, its drawn line running from that corner to the dip between the two small triangles. Sew ${S} each side of the line and cut on it.`,
        `Press the small triangles out. Each heart gives 2 geese, so each big square gives 4.`,
        `Trim the dog ears and square each unit to ${unf}. Keep ${S} above the goose's point: that is the seam allowance, so the point stays sharp when the unit is sewn in.`,
      ]);
    }
    case 'snowball': {
      const u = sample.unit, c = u.corners[0], cq = fmtLen(ceilEighth(c.cls.leg + 2 * sa), 'up'), nc = u.corners.length;
      return make('stitch-and-flip unit', 'stitch-and-flip units', `Each is a ${unf} ${L(u.main.fab)} piece with ${nc === 1 ? 'one corner' : `${nc} corners`} replaced by ${L(c.fab)} triangles sewn from small squares.`) + steps([
        `Draw a diagonal line on the wrong side of each ${cq} ${L(c.fab)} square.`,
        `Place one on a corner of the ${L(u.main.fab)} piece, right sides together, edges matching, with the line running across the corner.`,
        `Sew on the line. Sewing a thread's width toward the corner keeps the unit full size after pressing.`,
        `Trim ${S} outside the stitching, cutting away the corner of both layers.`,
        `Press the triangle toward the corner.${nc > 1 ? ' Repeat on the other corners.' : ''} The unit still measures ${unf}.`,
      ]);
    }
    case 'curved': {
      const u = sample.unit, np = (sample.pieces || []).length, many = np > 2, wave = u.seams?.some(x => !x.convex);
      const what = many ? `This unit has ${np} pieces and ${np - 1} curved seams: sew them one at a time in the numbered order, and press each seam before the next.`
        : wave ? 'Each joins two pieces along one curved seam that bends both ways.' : 'Each joins a convex piece, which bulges out like a pie slice, to a concave one, scooped in like an L.';
      return make('curved unit', 'curved units', what) + steps([
        `Snip the matching marks on the curved edges, no deeper than ⅛", or fold each curved edge in half and finger-press a crease at its centre.${wave ? ' A curve that bends both ways has a mark at each bend and in the middle of each part.' : ''}`,
        `${many ? 'Place the next piece in the numbered order on the part sewn so far' : wave ? 'Place one piece on the other' : 'Place the concave piece on top of the convex one'}, right sides together, matching the marks. Pin at the marks, then at both ends, then in between, easing the top edge to follow the curve.`,
        `Sew slowly with a ${S} seam${wave ? '' : ', the concave edge on top'}. Every inch or so, stop with the needle down and straighten the fabric ahead.`,
        `Press the seam toward the convex piece, or whichever way lies flatter. If it pulls, clip the concave piece's seam allowance a few times, no deeper than ⅛".${many ? ' Repeat with the next piece in the numbered order.' : ''}`,
        `Trim to ${unf}.`,
      ]);
    }
    case 'peel': {
      const u = sample.unit, cs = uniq(u.corners.map(c => resolveFab(c.fab))), sq = Math.abs(r.w - r.h) < 1e-3 * r.w;
      const C = cs.length === 1 ? `two ${L(cs[0])} corner pieces` : `a ${L(cs[0])} and a ${L(cs[1])} corner piece`;
      return make('orange-peel unit', 'orange-peel units', `Each is a ${sq ? 'square' : 'rectangle'} made of a ${L(u.petal.fab)} petal, a lens shape with its tips in two opposite corners, and ${C} with scooped edges. It has two curved seams, sewn one at a time.${u.cornerDeg < SHARP_DEG ? ' The corner pieces narrow to a very fine point at each tip. The last bit of the point disappears into the seam allowance, so don\'t worry if it looks lost.' : ''}`) + steps([
        `Snip the matching marks on each piece's curved edge, no deeper than ⅛", or fold each curved edge in half and finger-press a crease at its centre. The petal has ${u.seams[0].notches.length > 1 ? 'marks' : 'a mark'} on each side.`,
        `Lay a corner piece on the petal, right sides together, corner piece on top. Match the centre marks and pin there, then pin both ends with the cut edges level, then pin in between, easing the corner piece to follow the curve.`,
        `Sew with a ${S} seam, corner piece on top. Go slowly, stopping every inch or so with the needle down to straighten the fabric ahead.`,
        `Press the seam toward the petal, or whichever way lies flatter.`,
        `Sew the second corner piece to the other side of the petal the same way, and press it the same way.`,
        `Trim to ${unf}. The petal's tips should sit ${S} in from both edges at two opposite corners${sq ? ': line up the ruler\'s diagonal with both tips' : ''}.`,
      ]);
    }
    case 'inset': {
      const u = sample.unit, sq = Math.abs(r.w - r.h) < 1e-3 * r.w, shape = u.circle ? 'circle' : 'oval', bb = bounds(u.inner.pts);
      const lt = bb.minX - r.x + sa, tp = bb.minY - r.y + sa, rt = r.x + r.w - bb.maxX + sa, bt = r.y + r.h - bb.maxY + sa, same = (a, b) => Math.abs(a - b) < 0.02;
      const where = same(lt, rt) && same(tp, bt) && same(lt, tp) ? `the ${shape} centred, ${fmtLen(lt)} from each edge` : `the ${shape}'s edge ${fmtLen(lt)} from the left edge and ${fmtLen(tp)} from the top`;
      return make('inset circle unit', 'inset circle units', `Each is a ${unf} ${L(u.outer.fab)} ${sq ? 'square' : 'rectangle'} with a ${L(u.inner.fab)} ${shape} set into ${u.circle ? 'a round' : 'an oval'} opening, joined by one continuous curved seam.`) + steps([
        `Snip the four matching marks on the edge of the ${shape} and of the opening, no deeper than ⅛", or fold each in half both ways and finger-press creases at the quarter points.`,
        `Clip the opening's seam allowance every ½", ⅛" deep, so it can spread around the ${shape}.`,
        `Lay the ${L(u.outer.fab)} piece on the ${shape}, right sides together, ${L(u.outer.fab)} on top. Match and pin the four marks, then pin in between.`,
        `Sew all the way round with a ${S} seam, ${L(u.outer.fab)} on top, stopping every inch or so with the needle down to straighten the fabric ahead. Overlap the first stitches by ½".`,
        `Press the seam toward the ${shape}, or whichever way lies flatter.`,
        `Trim to ${unf}, with ${where}.`,
      ]) + `If you'd rather, turn the opening's allowance under over a card template and topstitch it onto the ${shape} from the front. The cutting is the same.`;
    }
    case 'curveComplex':
      return `This part has curves that can't be sewn by machine as drawn: ${CURVE_WHY[sample.unit.why] || CURVE_WHY.many}. Appliqué the curved shapes on top of the block instead, the usual way to make shapes like these: in Blocks, select them and tick Appliqué. Or sew it by hand with English paper piecing.`;
    case 'hrt':
      return make('half-rectangle triangle (HRT)', 'half-rectangle triangles (HRTs)', `An HRT is a rectangle cut corner to corner into two long triangles, here ${byLight.map(L).join(' and ')}. The triangles aren't 45°, so their tips don't line up like an HST's.`) + steps([
        `Check the triangles were cut with the fabric right side up (see the cutting list): a mirror-image triangle won't fit.`,
        `Lay a ${L(lt)} and a ${L(dk)} triangle right sides together along their long edges. Slide them so the edges cross ${S} in from each end: that is where the seam starts and stops.`,
        `Sew along the long edge with a ${S} seam. Press toward ${L(dk)}.`,
        `Trim the dog ears. The unit should measure ${unf}. The seam meets the short edges a little way in from the corners, not in them: that's right for an HRT.`,
      ]);
    case 'complex':
      return `This block has <b>set-in (Y) seams</b>: three pieces meet at one point, so those seams are sewn only up to the seam line, never into the seam allowance.` + steps([
        `On the wrong side of each piece, mark a dot ${S} in from each corner where three seams will meet.`,
        `Sew the pieces that form the centre first (the diamonds of a star, or the centre of a hexagon), starting and stopping exactly at the dots and backstitching at both. Press seams open.`,
        `Set in each remaining piece with two seams: pin it to one neighbour, dot to dot, and sew from the outer edge in to the dot; backstitch. Lift the needle, swing the next edge into line and sew from the dot out to the edge.`,
        `Press, then square the block to its unfinished size.`,
      ]) + ` English paper piecing is a good alternative.`;
  }
  return '';
}

// Appliqué: where it goes (measured from the finished block's edges, with a placement sketch) and
// how to stitch it for the chosen method.
function appliqueSteps(block, BS, sa, an) {
  const app = an.applique, fusible = doc.cutting.appMethod === 'fusible';
  const bb = bounds(app.flatMap(p => p.pts));
  const centred = Math.abs(bb.minX + bb.maxX - BS) < 0.13 && Math.abs(bb.minY + bb.maxY - BS) < 0.13;
  const fabs = uniq(app.map(p => fabricLetter(p.fab))).map(l => `<b>${l}</b>`).join(', ');
  const plainBack = blockPieces(block, BS, BS).filter(p => !p.app).length === 1 && !isHexBlock(block);
  const hair = BS * 0.006, k = STEP_DIAG_IN / BS;
  let sketch = `<svg class="diag" viewBox="${-BS * 0.12} ${-BS * 0.12} ${BS * 1.24} ${BS * 1.24}" width="${round(STEP_DIAG_IN * 1.24, 3)}in" height="${round(STEP_DIAG_IN * 1.24, 3)}in">
    <rect width="${BS}" height="${BS}" fill="#f6f3ec" stroke="#2b3a4a" stroke-width="${hair}"/>
    <path d="M${BS / 2} 0V${BS}M0 ${BS / 2}H${BS}" stroke="#8a95a3" stroke-width="${hair}" stroke-dasharray="${hair * 4} ${hair * 3}"/>`;
  for (const p of app) sketch += `<path d="${polyToPath(p.pts)}${p.holes.map(h => polyToPath(h)).join('')}" fill="${fabricFill(p.fab)}" fill-rule="evenodd" stroke="#2b3a4a" stroke-width="${hair}"/>`;
  const fs = BS * 0.075, arrow = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#b5482f" stroke-width="${hair * 1.3}"/>`;
  if (!centred) sketch += arrow(0, bb.minY + bb.h / 2, bb.minX, bb.minY + bb.h / 2) + arrow(bb.minX + bb.w / 2, 0, bb.minX + bb.w / 2, bb.minY)
    + `<text x="${bb.minX / 2}" y="${bb.minY + bb.h / 2 - fs * 0.5}" font-size="${fs}" text-anchor="middle" fill="#b5482f">${esc(fmtLen(bb.minX))}</text>`
    + `<text x="${bb.minX + bb.w / 2 + fs * 0.3}" y="${bb.minY / 2}" font-size="${fs}" fill="#b5482f">${esc(fmtLen(bb.minY))}</text>`;
  sketch += '</svg>';
  const where = centred
    ? `The design is centred: fold the background in half both ways and finger-press to mark the centre lines, then match the design's centre to them.`
    : `Fold the background in half both ways to mark the centre lines. The design's left edge sits ${fmtLen(bb.minX)} from the left of the finished block and its top ${fmtLen(bb.minY)} from the top (measure from the sewing line, ${fmtLen(sa)} in from the cut edge).`;
  const boxes = app.map(p => bounds(p.pts)), touch = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
  const order = boxes.some((a, i) => boxes.some((b, j) => i < j && touch(a, b))) ? ' Where pieces overlap, stitch the ones underneath first.' : '';
  const method = fusible
    ? `Trace each reversed template onto the paper side of fusible web, cut it out roughly, fuse it to the wrong side of the fabric and cut on the line. Peel off the paper, place the pieces and fuse with a hot, dry iron. Finish the raw edges with a blanket, zigzag or close straight stitch.`
    : `Trace each template onto the right side of the fabric: that line is the fold line. Cut 3/16" outside it. Pin or glue-baste the pieces in place, then turn the allowance under with the needle tip, a little at a time, and blind-stitch with thread that matches the appliqué. Clip inner curves almost to the line; don't turn edges that will be covered by another piece.`;
  return [
    { text: `<b>Appliqué placement</b> (fabric ${fabs}). ${plainBack ? `Appliqué shrinks and frays the background a little, so it was cut 1" bigger all round (${fmtSize(BS + 2 * sa + 2, BS + 2 * sa + 2)}). After stitching, trim it to ${fmtSize(BS + 2 * sa, BS + 2 * sa)}, keeping the design centred where it should be. ` : ''}${where}`, diag: sketch },
    { text: `<b>${fusible ? 'Fusible' : 'Turned-edge'} appliqué.</b> ${method}${order}`, diag: blockDiagramSvg(block, BS, STEP_DIAG_IN) },
  ];
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
  let sketched = false;
  for (const list of groups.values()) {
    const u = list[0].unit;
    let text = unitMethodText(u.type, list[0], list.length, sa, copies);
    // sketch of the method at the unit's real size, in its own fabrics; the line key only under the block's first sketch
    const howto = ['hst', 'qst', 'goose', 'snowball', 'curved', 'hrt', 'peel', 'inset'].includes(u.type) ? unitHowToSvg(u.type, { sample: list[0], sa, legend: !sketched }) : '';
    if (howto) { text += `<div class="howto-wrap">${howto}</div>`; sketched = true; }
    steps.push({ text, diag: blockDiagramSvg(block, BS, STEP_DIAG_IN, { level: an.height + 1, highlight: new Set(list), dim: true }) });
  }
  // lay everything out first; the bias note is said once
  if (an.height > 0) steps.push({ text: 'Lay out the units and pieces as in the block picture, checking that every triangle and goose points the right way.', diag: blockDiagramSvg(block, BS, STEP_DIAG_IN, { level: an.height + 1, sa }) });
  let biasSaid = false;
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
        parts.push(dir === 'cols' ? `Sew ${names} together, side by side` : dir === 'rows' ? `Sew ${names} together, one above the other` : `Sew ${names} together along the diagonal seams, in that order`);
        continue;
      }
      if (dir === 'cols') parts.push(cnt === 1 ? `Sew the ${m} ${t} together, side by side` : `Sew the ${t} in each row together, side by side (${cnt} rows of ${m})`);
      else if (dir === 'rows') parts.push(isRoot && cnt === 1 ? `Sew the ${m} ${t === 'sections' ? 'rows' : t} together, top to bottom, matching seams` : cnt === 1 ? `Sew the ${m} ${t} together, one above the other` : `Sew ${m} ${t} together, one above the other (make ${cnt})`);
      else parts.push(`Sew the ${t} to the centre, opposite sides first, working outward${cnt > 1 ? ` (${cnt} groups)` : ''}`);
    }
    let text = parts.join('. ') + '.';
    if (descr.diag && !biasSaid) { biasSaid = true; text += ' The long edges of triangles are on the bias and stretch easily: pin, don\'t pull, and press without steam. Centre each piece so its dog ears overhang equally at both ends, and trim them after each seam.'; }
    if (isRoot) text += isHexBlock(block) ? ` Press, then trim it to a ${blockSizeText(block, BS, 2 * sa)}, ${fmtLen(sa)} beyond each point of the sewn shape.` : ` Press. The block should measure ${fmtSize(BS + 2 * sa, BS + 2 * sa)}; trim only if it's larger, keeping ${fmtLen(sa)} beyond any points.`;
    else if ((descr.cols || 0) > 1 || nodes.filter(nd => nd.dir === 'cols').length > 1) text += ' Press the seams of each row the opposite way to the row before, so they nest when the rows are joined.';
    else if (descr.cols || descr.rows) text += ' Press toward the darker fabric.';
    steps.push({ text, diag: blockDiagramSvg(block, BS, STEP_DIAG_IN, { level: k, sa }) });
  }
  if (an.applique.length) steps.push(...appliqueSteps(block, BS, sa, an));
  if (!steps.length) steps.push({ text: `This block is a single piece. Cut it at ${isHexBlock(block) ? blockSizeText(block, BS, 2 * sa) : fmtSize(BS + 2 * sa, BS + 2 * sa)}.`, diag: '' });
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
    ${g.notches.map(m => `<path d="M${round(m.p[0], 4)},${round(m.p[1], 4)}L${round(m.p[0] + m.n[0] * g.sa, 4)},${round(m.p[1] + m.n[1] * g.sa, 4)}" stroke="#2b3a4a" stroke-width="0.016"/>`).join('')}
    <text x="${round(cb.x + cb.w / 2, 3)}" y="${round(cb.y + cb.h / 2, 3)}" font-size="${round(Math.min(0.32, Math.min(cb.w, cb.h) / 4), 3)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="700" fill="#2b3a4a">${t.id} · ${(t.cuts || [t]).map(c => fabricLetter(c.fab)).join(', ')}</text>
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
      <text transform="translate(${round(x + w / 2, 4)} ${round(y + h / 2, 4)})${vertical ? ' rotate(90)' : ''}" font-size="0.1" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" fill="#3a4754">Glue: next sheet on top</text>`;
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
      sections.push(`<div class="map-head">${ovw}<div><h2>Assembly map${one ? '' : `, part ${j * nx + i + 1} of ${nx * ny}`}</h2><p>${inRows.length ? `Rows ${inRows[0].n}–${inRows[inRows.length - 1].n}${where}. ` : ''}${one ? 'The map again, large enough to read every code.' : 'Each part overlaps the next slightly so you can line them up.'} Codes are explained in the piece key on the assembly page.</p></div></div>
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
    const t = tplList.find(x => x.rs.includes(e.r));
    legend += `<div>${shapeThumb(e)}<span>${codeTag(e.code)}<b>${esc(e.r.recipe.makes)}</b> · ${c.whole + c.trim}${c.trim ? (exactEdges() ? `, edge piece${c.trim === 1 ? '' : 's'} cut to fit` : `, ${c.trim} at the edges${(doc.layout.panels || []).length ? ' or panel' : ''}: sew whole, trim later`) : ''}<br>fabric <b>${fabricLetter(e.fab)}</b>, cutting step ${e.step}${t ? `, template ${t.id}` : ''}</span></div>`;
  }
  for (const [id, n] of blockNo) {
    const cells = Q.cells.filter(c => c.b === id);
    legend += `<div><span class="pcode blk">#${n}</span><span><b>${esc(doc.blocks[id].name)}</b> · ${cells.length} block${cells.length === 1 ? '' : 's'}${cells.some(c => c.clip) ? ` (${cells.filter(c => c.clip).length} trimmed)` : ''}<br>see its block page</span></div>`;
  }
  legend += '</div><div style="height:10px"></div>';
  if (sections.length) legend += `<p class="small">The labels are small at this size, so the map is repeated larger ${sections.length === 1 ? 'on its own page' : `over ${plural(sections.length, 'page')}`} after the assembly steps.</p>`;
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
      <tr><td><b>Backing</b></td><td>${plan.backing.chosen.from === 'stash' ? `From your stash (${esc(plan.backing.chosen.title.toLowerCase())})` : `${fmtYards(plan.backing.buyIn)} of ${fmtLen(plan.backing.fabricWidth)}-wide ${doc.layout.backing?.fabric ? esc(fabricLabel(doc.layout.backing.fabric)) : 'fabric'}`}: ${esc(plan.backing.chosen.title.toLowerCase())}, to make ${fmtSize(plan.backing.w, plan.backing.h)}</td></tr>
      <tr><td><b>Batting</b></td><td>${battingText(plan.batting)}</td></tr>
      ${doc.layout.binding?.fabric ? `<tr><td><b>Binding</b></td><td>${bindingText(plan)}</td></tr>` : ''}
      ${stats.total > 0 ? `<tr><td><b>Thread</b></td><td>About ${Math.ceil(stats.threadYds / 50) * 50} yd for quilting (${Math.round(stats.total / 36)} yd of stitching, top + bobbin)</td></tr>` : ''}
    </tbody></table>
    <div class="note"><b>Before you start.</b> Read all the instructions first. All seams are ${fmtLen(sa)} and sewn with right sides together unless noted. Every size given includes the seam allowance. <b>Finished</b> = the size in the quilt; <b>unfinished</b> = the size before it's sewn in (${fmtLen(2 * sa)} bigger). <b>WOF</b> = width of fabric, selvage to selvage. <b>Dog ears</b> = the small points that stick out past the edge after a diagonal seam; trim them off. Units such as HSTs and flying geese are explained where you first make them.</div>
    <div class="note"><b>Get ready.</b> Prewash your fabrics if you prewash (all of them, or none), then press them flat with starch or sizing so they cut accurately. Sew a test seam on scraps: two 2" strips sewn together should measure 3½" across. If not, adjust your needle or seam guide before you start.</div>`);

  /* --- cutting --- */
  const tplList = [];
  // one template per shape: the same shape cut from several fabrics shares a template
  for (const f of plan.fabrics) for (const r of f.templates) {
    const same = tplList.find(t => t.r.recipe.key === r.recipe.key && !!t.r.recipe.applique === !!r.recipe.applique);
    if (same) { same.rs.push(r); same.cuts.push({ fab: f.fab, units: r.units }); same.units += r.units; continue; }
    tplList.push({ id: `T${tplList.length + 1}`, fab: f.fab, r, rs: [r], cuts: [{ fab: f.fab, units: r.units }], outline: r.recipe.outline, units: r.units });
  }
  const tplFabs = t => t.cuts.length > 1 ? `fabrics ${t.cuts.map(c => fabricLetter(c.fab)).join(', ')}` : `fabric ${fabricLetter(t.fab)}`;
  const tplCuts = t => t.cuts.length > 1 ? t.cuts.map(c => `${c.units} from ${fabricLetter(c.fab)}`).join(', ') : t.units;
  const codes = pieceCodes(plan);
  P('', `<h2>Cutting</h2><p>Cut strips across the width of fabric (selvage to selvage), then sub-cut, following the numbered order for each fabric. The map beside each list shows where every cut sits on the fabric you buy; the small pictures show where those pieces go. Label each stack with its piece code (${codeTag('A1')} = fabric A, piece 1). The block diagrams and the assembly map use the same codes.</p>` +
    plan.fabrics.map(f => {
      const sheet = fabricSheet(f);
      let list = '';
      const fb = fallbackInfo(f), split = fb && sheet.rows.some(r => r.fallback) && sheet.rows.some(r => !r.fallback);
      sheet.rows.forEach((row, i) => {
        if (split && (i === 0 || row.fallback !== sheet.rows[i - 1].fallback)) list += `<li class="src-h">${row.fallback ? `From ${fmtLen(fb.width)} yardage: ${esc(fallbackReason(fb, true))}` : `From ${esc(f.format.name.toLowerCase())}s`}</li>`;
        let extra = '';
        if (row.kind === 'template') { const t = tplList.find(x => x.rs.includes(row.r)); if (t) extra = ` <i>(template ${t.id})</i>`; }
        const rec = row.group?.recipes || (row.a ? [row.a] : row.r ? [row.r] : []);
        const uses = [];
        for (const r of rec) for (const u of r.uses?.values() || []) if (u.b && !uses.some(x => x.b === u.b)) uses.push(u);
        list += `<li><span class="stepno">${i + 1}</span><div>${codes.forRow(row).map(e => codeTag(e.code)).join('')}<b>${row.head}</b>${extra}<br>${row.parts.map(esc).join('<br>')}${uses.length ? `<div class="uses">${uses.map(u => usageThumbSvg(u, 0.42, 'in')).join('')}</div>` : ''}</div></li>`;
      });
      const st = stashUseText(f);
      const maps = fabricSheets(f).map((sh, i) => `${sh.src.kind === 'stash' ? `<div class="map-cap">Your ${esc(sh.src.name.toLowerCase())}</div>` : sh.src.kind === 'precut' ? `<div class="map-cap">${esc(sh.src.name)}</div>` : sh.src.fallback ? `<div class="map-cap">Yardage for ${esc(fallbackInfo(f) ? fallbackReason(fallbackInfo(f), false) : 'the larger cuts')}</div>` : st ? '<div class="map-cap">Yardage for the rest</div>' : ''}${fabricSheetSvg(sh, f.fab, { width: 2.4, unit: 'in', idp: 'pc' + i, title: sh.title })}`).join('');
      return `<div class="cut-fab"><h3>${swatchHtml(f.fab, 20)} Fabric ${fabricLetter(f.fab)}: ${esc(fabricLabel(f.fab))} <span class="muted" style="font-weight:400">· ${st && !f.buyIn && !f.buyPieces ? `all from ${esc(st)}` : `buy ${buyText(f)}${st ? `, plus ${esc(st)}` : ''}`}</span></h3>
        <div class="cut-cols"><ol class="cut-list">${list}</ol><div class="cut-map">${maps}</div></div></div>`;
    }).join(''));

  /* --- templates (true scale) --- */
  if (tplList.length) {
    const maxW = page.w - 0.2, maxH = page.h - 1.8;
    const singles = [], tiled = [];
    for (const t of tplList) {
      const ts = templateSvg(t, maxW, maxH);
      const app = t.r.recipe.applique ? (doc.cutting.appMethod === 'fusible' ? ' · fusible appliqué: printed reversed, trace on the line, no allowance' : ' · appliqué (3/16" turn-under)') : '';
      const head = `<div class="tpl-head"><b>${t.id}</b> · ${esc(t.r.recipe.makes)} · ${tplFabs(t)} · cut ${tplCuts(t)}${app}</div>`;
      if (ts.tiles.length === 1) singles.push(`<div class="tpl">${head}${ts.tiles[0].svg}</div>`);
      else tiled.push({ t, ts, head });
    }
    P('', `<h2>Templates</h2><div class="note warn"><b>Print at 100% / "Actual size".</b> Check the 1-inch square before tracing. Solid line = sewing line, dashed line = cutting line (includes seam allowance). Arrow = straight grain.${tplList.some(t => t.r.recipe.notches?.length) ? ' Short ticks across the allowance on curved edges are matching marks: snip ⅛" into the allowance at each, or mark them, and match them when you pin.' : ''}</div><div class="cal">${calibrationSvg()}</div>${tiled.length ? `<p class="small">${plural(tiled.length, 'template')} ${tiled.length === 1 ? 'is' : 'are'} bigger than a page and ${tiled.length === 1 ? 'is' : 'are'} printed over several sheets. See the sheet atlas after ${singles.length ? 'these' : 'this page'}.</p>` : ''}<div class="tpls">${singles.join('')}</div>`);
    if (tiled.length) {
      // atlas: how each template's sheets fit together, four templates to a page
      const items = tiled.map(({ t, ts }) => {
        const printed = ts.tiles.filter(x => !x.blank).length;
        return `<div class="atlas-item"><div class="tpl-head"><b>${t.id}</b> · ${esc(t.r.recipe.makes)} · ${tplFabs(t)} · ${plural(printed, 'sheet')}${printed < ts.tiles.length ? ` (${ts.tiles.length - printed} blank, not printed)` : ''}</div>${templateAtlasSvg(t, ts, page.w / 2 - 0.25, page.h / 2 - 1.1)}</div>`;
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
    const n = Q.cells.filter(c => c.b === id && c.size === BSZ && !partialCell(c)).length;
    const trimmed = Q.cells.filter(c => c.b === id && c.size === BSZ && c.clip && !partialCell(c)).length;
    const partial = Q.cells.filter(c => c.b === id && c.size === BSZ && partialCell(c)).length, edge = (doc.layout.panels || []).length ? 'panel or edge' : 'edge';
    const steps = blockStepsHtml(b, BSZ, sa, n);
    const fabs = uniq(blockPieces(b, BSZ, BSZ).map(p => resolveFab(p.fab))).sort((a, c) => fabricIndex(a) - fabricIndex(c));
    let h = `<h2>${esc(b.name)}${inPanel ? ' <span class="muted" style="font-weight:400;font-size:12pt">(centre panel)</span>' : ''}</h2>
      <div class="block-head"><div>${blockDiagramSvg(b, BSZ, 2.2, { codes: blockPieceCodes(codes, id, BSZ) })}</div><div>
        <div class="callout">${n ? `Make <b>${n}</b> block${n === 1 ? '' : 's'}${partial ? ` + ${partial} partial` : ''}` : `Make <b>${partial}</b> partial block${partial === 1 ? '' : 's'}`}</div>
        <p>Finished ${blockSizeText(b, BSZ)} · unfinished ${blockSizeText(b, BSZ, 2 * sa)}</p>
        ${trimmed ? `<p><b>${trimmed}</b> of them run off the edge${(doc.layout.panels || []).length ? ' or under the panel' : ''}. Make them whole; they're trimmed after the top is assembled.</p>` : ''}
        ${partial ? `<p>${n ? `Plus <b>${partial}</b> partial block${partial === 1 ? '' : 's'} where the ${edge} covers part of it.` : `The ${edge} covers part of ${partial === 1 ? 'it' : 'each one'}.`} Only the pieces that show are cut, to shape (listed as "Partial blocks" in the cutting list). Sew them in the same order, leaving out what's covered.</p>` : ''}
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
        const e = codes.list.find(x => x.r === r), t = tplList.find(x => x.rs.includes(r));
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
    h += `</ol><p>Total stitching: about <b>${Math.round(stats.total / 36)} yd</b>. Have ${Math.ceil(stats.threadYds / 50) * 50} yd of thread for top and bobbin.</p>`;
    P('', h);
  }

  /* --- finishing --- */
  const bnd = doc.layout.binding;
  P('', `<h2>Finishing</h2>
    <h3>Backing</h3>${doc.layout.backing?.fabric || layers.length ? `<figure class="back-fig">${quiltBackSvg(Q, { size: fit(Q.W, Q.H, page.w * 0.34, page.h * 0.3), layers, scaleHint: 1.4 })}<figcaption>Back of the quilt${layers.length ? ', quilting mirrored' : ''}</figcaption></figure>` : ''}<p>Make a backing at least ${fmtSize(plan.backing.w, plan.backing.h)}, the quilt plus ${fmtLen(doc.cutting.overhang ?? 4)} all round: ${esc(plan.backing.chosen.title.toLowerCase())}.</p>
    <div class="back-plan">${backingDiagramSvg(plan.backing, plan.backing.chosen, { width: '2.8in' })}<ol>${plan.backing.chosen.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>
    <h3>Layer and baste</h3><p>Lay the backing wrong side up, smooth and tape it taut. Centre the batting (${fmtSize(plan.batting.w, plan.batting.h)}) and then the quilt top, right side up. Baste with pins every 4–6", spray baste, or thread baste, working from the centre out.</p>
    <h3>Quilt</h3><p>${layers.length ? 'Quilt as shown on the Quilting page.' : 'Quilt as you like: straight lines, free motion or hand quilting.'} Keep the quilting density even across the quilt. Trim the batting and backing even with the top.</p>
    ${bnd?.fabric ? bindingStepsHtml(bnd, sa) : ''}
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
    const content = p.b && doc.blocks[p.b] ? `the ${esc(doc.blocks[p.b].name)} block` : p.fab ? `a ${fmtSize(pg.size, pg.size)} square of fabric ${fabricLetter(p.fab)}` : 'the centre square';
    const frames = pg.frames.filter(f => f.width > 0);
    const tess = Q.mode === 'tess';
    h += `<li><b>Panel:</b> ${frames.length ? `frame ${content} with ${frames.map((f, k) => `${fmtLen(f.width + 2 * sa)}-wide strips of fabric ${fabricLetter(f.fabric)} (${fmtLen(f.width)} finished)${k === 0 ? ', innermost' : ''}`).join(', then ')}: sides first, pressing toward the frame, then top and bottom. It then measures ${fmtSize(pg.outer + 2 * sa, pg.outer + 2 * sa)} unfinished.` : `${content} measures ${fmtSize(pg.outer + 2 * sa, pg.outer + 2 * sa)} unfinished.`}</li>
      ${Q.mode === 'grid' ? '' : `<li><b>Setting the panel in:</b> piece the ${name} in sections: the full-width rows above and below the panel, and the shorter rows to its left and right. ${exact ? 'The pieces along the panel are cut to shape, so each section already has a straight edge there.' : `Trim each section's edge that meets the panel straight, ${fmtLen(sa)} beyond the panel line.`} Sew the left and right sections to the panel, then add the top and bottom sections, matching seams.</li>`}`;
  }
  return h;
}

// A straight-set quilt with an inset panel is sewn like a medallion: the rows above and below the
// panel, the short rows beside it, the side sections onto the panel, then the top and bottom.
function medallionSteps(Q, sa) {
  const g = doc.layout.grid, L = doc.layout, sw = g.sashing.width;
  const h = panelStepsHtml(Q, sa, 'blocks', exactEdges());   // making each panel
  // grid positions the panels cover or cut into
  const here = new Map(Q.cells.filter(c => /^g\d+$/.test(c.key)).map(c => [+c.key.slice(1), c]));
  // the band the panel sits in: positions it hides completely (or, for a small panel, the ones it cuts into)
  const gone = [], cut = [];
  for (let i = 0; i < g.rows * g.cols; i++) { const c = here.get(i); if (!c) gone.push(i); else if (c.clip) cut.push(i); }
  const touched = gone.length ? gone : cut;
  if (!touched.length || L.panels.length > 1) {
    return h + `<li>Piece the blocks around the panel${L.panels.length > 1 ? 's' : ''} in sections: the full rows above and below, and the shorter rows beside ${L.panels.length > 1 ? 'each panel' : 'it'}. Sew the side sections to the panel${L.panels.length > 1 ? 's' : ''}, then join everything top to bottom, matching seams.</li>`;
  }
  const rows = touched.map(i => Math.floor(i / g.cols)), cols = touched.map(i => i % g.cols);
  const r0 = Math.min(...rows), r1 = Math.max(...rows), c0 = Math.min(...cols), c1 = Math.max(...cols);
  const R = (a, b) => a === b ? `row ${letterFor(a)}` : `rows ${letterFor(a)}–${letterFor(b)}`;
  const C = (a, b) => a === b ? `column ${a + 1}` : `columns ${a + 1}–${b + 1}`;
  const sash = sw ? ', with sashing between the blocks as described above' : '';
  const parts = [];
  if (r0 > 0) parts.push(`<li><b>Top section:</b> sew the blocks of ${R(0, r0 - 1)} ${r0 === 1 ? `together${sash}` : `into rows${sash}, then join the rows`}.</li>`);
  if (r1 < g.rows - 1) parts.push(`<li><b>Bottom section:</b> sew ${R(r1 + 1, g.rows - 1)} the same way.</li>`);
  const side = (a, b, name) => a > b ? '' : `<li><b>${name} section:</b> in ${R(r0, r1)}, sew the blocks in ${C(a, b)} ${a === b ? 'top to bottom' : 'into short rows, then join them top to bottom'}${sash}.</li>`;
  parts.push(side(0, c0 - 1, 'Left'), side(c1 + 1, g.cols - 1, 'Right'));
  const clipped = cut.length > 0;
  if (clipped) parts.push(`<li>${exactEdges() ? 'The partial blocks next to the panel are cut to shape, so their sections already have a straight edge there.' : `Blocks the panel cuts into are made whole and sewn into their sections; trim each section's edge that meets the panel straight, ${fmtLen(sa)} beyond the panel line.`}</li>`);
  parts.push(`<li>Sew the left and right sections to the sides of the panel. Then sew the top and bottom sections across the full width, matching seams.</li>`);
  return h + parts.join('');
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
    if ((L.panels || []).length) h += medallionSteps(Q, sa);
    else if (sw) {
      const cutS = fmtSize(sw + 2 * sa, Q.BS + 2 * sa), out = g.sashing.outer;
      h += `<li><b>Block rows:</b> sew the blocks of each row together with a ${cutS} sashing strip between them${out ? ' and at both ends' : ''}. Press toward the sashing. Make ${g.rows}.</li>`;
      h += g.sashing.cornerstones
        ? `<li><b>Sashing rows:</b> sew sashing strips and ${fmtSize(sw + 2 * sa, sw + 2 * sa)} cornerstones (fabric ${fabricLetter(g.sashing.cornerFabric)}) together, ${out ? 'starting and ending with a cornerstone' : 'a cornerstone between each pair of strips'}. Press toward the sashing. Make ${out ? g.rows + 1 : g.rows - 1}.</li><li>Join the rows${out ? ', starting and ending with a sashing row' : ', a sashing row between each pair of block rows'}. Match each cornerstone to the vertical sashing above and below it.</li>`
        : `<li>Join the rows with long horizontal sashing strips between them${out ? ' and at the top and bottom' : ''}. Mark where the blocks' seams fall on each strip so the vertical sashing lines up from row to row.</li>`;
    } else {
      h += `<li>Sew the blocks of each row together. Press the seams of row A to the left, row B to the right, and so on.</li><li>Join the rows, nesting the seams at each intersection, and press.</li>`;
    }
    h += '</ol>';
  } else if (Q.mode === 'onpoint') {
    h += `<ol><li>Lay out the blocks on point (turned 45°) in diagonal rows, as in the picture. Put a side setting triangle (fabric ${fabricLetter(L.onpoint.fill)}, the larger triangles) at both ends of each diagonal row, long edge facing out.</li>
      <li>Sew each diagonal row together, right sides together. The setting triangles are cut to exact size: line up the triangle's square corner with the corner of the block it's sewn to, so its long edge runs straight with the other edges. Press each row the opposite way to the one before.</li>
      ${Q.cells.some(c => c.setting) ? (exactEdges() ? '<li>Blocks in setting-triangle positions are partial: only the part that shows is cut, to shape, and pieced like the full block before it goes into its diagonal row.</li>' : '<li>Blocks shown in setting-triangle positions are made whole and sewn into their diagonal rows like the others; only part of them shows, and the rest is trimmed away with the edges in the last step.</li>') : ''}
      <li>Join the rows, matching seams where the blocks meet. Add the four corner triangles (the smaller ones) last, centring each on its block.</li>
      <li>Check the edges are straight, with ${fmtLen(sa)} beyond the block corners for the seam allowance. Trim only where an edge wanders.</li>${panelStepsHtml(Q, sa, 'blocks', exactEdges())}</ol>`;
  } else {
    const t = L.tess, name = tessShape(t.shape).label.replace(/ \(.*\)$/, '').toLowerCase();
    const edge = t.edge !== 'fill' && t.cutEdges ? 'Edge pieces are cut to their exact shape (each has its own code on the map), so the edges come out straight with no trimming. Sew them in with their rows.' : t.edge === 'fill' ? `Partial shapes at the edges are cut from fabric ${fabricLetter(t.fill)} so the quilt finishes with straight edges.` : 'Shapes at the edges are trimmed straight after the top is assembled. Cut them as whole shapes and trim later, or use the edge templates.';
    const how = {
      hex: `Hexagons are joined with set-in (Y) seams. English paper piecing (EPP) is the easiest route: baste each hexagon over a paper hexagon and whip-stitch neighbours together (cut papers on the template's solid line and fabric on the dashed line). By machine: mark a dot ${fmtLen(sa)} in from every corner on the wrong side, sew the hexagons into rows sewing only from dot to dot and backstitching, then join the rows one edge at a time: sew to a dot, lift the needle, swing the next edge into line and carry on.`,
      tumbling: 'Sew three diamonds (one of each orientation) into a hexagon "cube" with set-in seams, then join the cubes into rows. EPP works well here too.',
      triangle: 'Sew the triangles into rows, alternating point up and point down and offsetting each so the edges align. Join the rows, matching points.',
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
    h += `<h3>Borders</h3><p>Measure your quilt top through the centre, top to bottom and side to side; if it differs from the sizes below, cut the borders to your measurement. For each border, innermost first: fold a side strip and the quilt's side in half and mark the centres. Pin them right sides together at the centres and ends, then in between, easing in any fullness. Sew and press toward the border. Repeat on the other side, then add the top and bottom the same way.</p><ol>`;
    for (const p of Q.patches.filter(p => p.role === 'border' && (p.side === 'left' || p.side === 'top'))) {
      const bb = bounds(p.pts);
      h += `<li>Border ${p.ring + 1} (fabric ${fabricLetter(p.fab)}), ${p.side === 'left' ? 'sides' : 'top & bottom'}: ${fmtSize(Math.max(bb.w, bb.h) + 2 * sa, Math.min(bb.w, bb.h) + 2 * sa, 'up')} (cut size)</li>`;
    }
    h += '</ol>';
  }
  return h;
}
