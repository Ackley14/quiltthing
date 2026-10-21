/* Printable pattern: a multi-page HTML document laid out for Letter/A4 and printed with the
   browser's "Save as PDF". Every number comes from the same model as the app's views. */

const PAGE_CONTENT = { letter: { w: 7.5, h: 10 }, a4: { w: 7.27, h: 10.69 } };

function autoSkill(Q, plan) {
  let score = 0;
  const blocks = uniq(Q.cells.filter(c => c.b).map(c => c.b)).map(id => doc.blocks[id]);
  if (blocks.length > 3) score++;
  for (const b of blocks) {
    const an = analyzeBlock(b, Q.BS);
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
      <td>${esc(f.sources.join(', '))}</td>${compact ? '' : `<td>${fmtYards(f.lengthIn)}</td>`}<td><b>${fmtYards(f.buyIn)}</b>${f.fq ? '<br><small>or 1 fat quarter</small>' : ''}</td></tr>`;
  }
  return h + '</tbody></table>';
}

// Block diagram with fabric letters (size in inches on paper).
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
      const [cx, cy] = centroid(p.pts);
      const ink = inkOn(fabricHex(p.fab));
      s += `<text x="${round(cx + dx, 3)}" y="${round(cy + dy, 3)}" font-size="${round(fs, 3)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="700" fill="${ink}">${fabricLetter(p.fab)}</text>`;
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
    if (isRoot) text += ` Press, then square the block to ${fmtSize(BS + 2 * sa, BS + 2 * sa)}.`;
    else if (descr.cols) text += ' Press seams in alternate directions from row to row so they nest.';
    steps.push({ text, diag: blockDiagramSvg(block, BS, STEP_DIAG_IN, { level: k }) });
  }
  if (an.applique.length) {
    steps.push({ text: `Appliqué ${plural(an.applique.length, 'piece')} (${uniq(an.applique.map(p => fabricLetter(p.fab))).map(l => `<b>${l}</b>`).join(', ')}) onto the block as shown — turn the edges under by hand, or fuse and stitch around the edge.`, diag: blockDiagramSvg(block, BS, STEP_DIAG_IN) });
  }
  if (!steps.length) steps.push({ text: `This block is a single piece — cut it at ${fmtSize(BS + 2 * sa, BS + 2 * sa)}.`, diag: '' });
  return steps;
}

function templateSvg(t, sa, maxW, maxH) {
  const pts = t.outline, cut = inflate(pts, sa);
  const cb = bounds(cut);
  const pad = 0.15;
  const W = cb.w + 2 * pad, H = cb.h + 2 * pad;
  const tilesX = Math.ceil(W / maxW - 1e-9), tilesY = Math.ceil(H / maxH - 1e-9);
  const dom = fabricHex(t.fab);
  const inner = `<path d="${polyToPath(cut)}" fill="${mix(dom, '#ffffff', .82)}" stroke="#2b3a4a" stroke-width="0.012" stroke-dasharray="0.06 0.04"/>
    <path d="${polyToPath(pts)}" fill="none" stroke="#2b3a4a" stroke-width="0.016"/>
    <text x="${round(cb.x + cb.w / 2, 3)}" y="${round(cb.y + cb.h / 2, 3)}" font-size="${round(Math.min(0.32, Math.min(cb.w, cb.h) / 4), 3)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="700" fill="#2b3a4a">${t.id} · ${fabricLetter(t.fab)}</text>
    ${Math.min(cb.w, cb.h) > 1.4 ? `<path d="M${round(cb.x + cb.w * .25, 3)},${round(cb.y + cb.h / 2 + .32, 3)}h${round(cb.w * .5, 3)}" stroke="#2b3a4a" stroke-width=".012" marker-start="url(#arw)" marker-end="url(#arw)"/>` : ''}`;
  const tiles = [];
  for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
    const x0 = cb.x - pad + tx * maxW, y0 = cb.y - pad + ty * maxH;
    const w = Math.min(maxW, W - tx * maxW), h = Math.min(maxH, H - ty * maxH);
    tiles.push({ tx, ty, svg: `<svg viewBox="${round(x0, 4)} ${round(y0, 4)} ${round(w, 4)} ${round(h, 4)}" width="${round(w, 4)}in" height="${round(h, 4)}in">
      <defs><marker id="arw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#2b3a4a"/></marker></defs>${inner}</svg>` });
  }
  return { tiles, tilesX, tilesY };
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
    <p>Yardage assumes ${fmtLen(doc.cutting.wof)}-wide fabric after removing selvages, includes ${doc.cutting.extra}% extra for shrinkage and mistakes, and is rounded up to the nearest ${({ none: 'inch', eighth: '⅛ yard', quarter: '¼ yard', half: '½ yard' })[doc.cutting.roundTo]}.</p>
    ${patternFabricKeyTable(plan)}
    <table class="pt"><tbody>
      <tr><td><b>Backing</b></td><td>${fmtYards(plan.backing.buyIn)} of ${fmtLen(plan.backing.fabricWidth)}-wide fabric — ${plan.backing.panels > 1 ? `${plan.backing.panels} panels joined with ${plan.backing.seams} seams` : 'one piece'}, to make ${fmtSize(plan.backing.w, plan.backing.h)}</td></tr>
      <tr><td><b>Batting</b></td><td>${fmtSize(plan.batting.w, plan.batting.h)}</td></tr>
      ${doc.layout.binding?.fabric ? `<tr><td><b>Binding</b></td><td>Included above in fabric ${fabricLetter(doc.layout.binding.fabric)} (${fmtLen(doc.layout.binding.width)} strips, double fold)</td></tr>` : ''}
      ${stats.total > 0 ? `<tr><td><b>Thread</b></td><td>About ${Math.ceil(stats.threadYds / 50) * 50} yd for quilting (${Math.round(stats.total / 36)} yd of stitching, top + bobbin)</td></tr>` : ''}
    </tbody></table>
    <div class="note"><b>Before you start.</b> Read all instructions. All seams are ${fmtLen(sa)} unless noted; measurements include seam allowance. <b>WOF</b> = width of fabric. <b>RST</b> = right sides together. <b>HST</b> = half-square triangle.</div>`);

  /* --- cutting --- */
  const tplList = [];
  for (const f of plan.fabrics) for (const r of f.templates) tplList.push({ id: `T${tplList.length + 1}`, fab: f.fab, r, outline: r.recipe.outline, units: r.units });
  P('', `<h2>Cutting</h2><p>Cut strips across the width of fabric (selvage to selvage), then sub-cut, following the numbered order for each fabric. The map beside each list shows where every cut sits on the fabric you buy; the small pictures show where those pieces go. Label each stack with its fabric letter and step number.</p>` +
    plan.fabrics.map(f => {
      const sheet = fabricSheet(f);
      let list = '';
      sheet.rows.forEach((row, i) => {
        let extra = '';
        if (row.kind === 'template') { const t = tplList.find(x => x.r === row.r); if (t) extra = ` <i>(template ${t.id})</i>`; }
        const rec = row.group?.recipes || (row.a ? [row.a] : row.r ? [row.r] : []);
        const uses = [];
        for (const r of rec) for (const u of r.uses?.values() || []) if (u.b && !uses.some(x => x.b === u.b)) uses.push(u);
        list += `<li><span class="stepno">${i + 1}</span><div><b>${row.head}</b>${extra}<br>${row.parts.map(esc).join('<br>')}${uses.length ? `<div class="uses">${uses.map(u => usageThumbSvg(u, 0.42, 'in')).join('')}</div>` : ''}</div></li>`;
      });
      return `<div class="cut-fab"><h3>${swatchHtml(f.fab, 20)} Fabric ${fabricLetter(f.fab)} — ${esc(fabricLabel(f.fab))} <span class="muted" style="font-weight:400">· buy ${fmtYards(f.buyIn)}</span></h3>
        <div class="cut-cols"><ol class="cut-list">${list}</ol><div class="cut-map">${fabricSheetSvg(sheet, f.fab, { width: 2.4, unit: 'in', idp: 'pc' })}</div></div></div>`;
    }).join(''));

  /* --- templates (true scale) --- */
  if (tplList.length) {
    const maxW = page.w - 0.2, maxH = page.h - 1.4;
    const singles = [], multi = [];
    for (const t of tplList) {
      const ts = templateSvg(t, t.r.recipe.applique ? 0.1875 : sa, maxW, maxH);
      const head = `<div class="tpl-head"><b>${t.id}</b> · ${esc(t.r.recipe.makes)} · fabric ${fabricLetter(t.fab)} · cut ${t.units}${t.r.recipe.applique ? ' · appliqué (3/16" turn-under)' : ''}</div>`;
      if (ts.tiles.length === 1) singles.push(`<div class="tpl">${head}${ts.tiles[0].svg}</div>`);
      else for (const tile of ts.tiles) multi.push(`<div class="tpl">${head}<div class="tile-note">Part ${tile.ty * ts.tilesX + tile.tx + 1} of ${ts.tiles.length} (row ${tile.ty + 1}, column ${tile.tx + 1}) — trim and tape the parts together</div>${tile.svg}</div>`);
    }
    P('', `<h2>Templates</h2><div class="note warn"><b>Print at 100% / "Actual size".</b> Check the 1-inch square before tracing. Solid line = sewing line, dashed line = cutting line (includes seam allowance). Arrow = straight grain.</div><div class="cal">${calibrationSvg()}</div><div class="tpls">${singles.join('')}</div>`);
    for (const m of multi) P('', m);
  }

  /* --- blocks --- */
  for (const { id, size: BSZ } of blockJobs) {
    const b = doc.blocks[id];
    const inPanel = Q.cells.some(c => c.b === id && c.size === BSZ && c.row === 'panel');
    const n = Q.cells.filter(c => c.b === id && c.size === BSZ).length;
    const steps = blockStepsHtml(b, BSZ, sa, n);
    const fabs = uniq(blockPieces(b, BSZ, BSZ).map(p => resolveFab(p.fab))).sort((a, c) => fabricIndex(a) - fabricIndex(c));
    let h = `<h2>${esc(b.name)}${inPanel ? ' <span class="muted" style="font-weight:400;font-size:12pt">(centre panel)</span>' : ''}</h2>
      <div class="block-head"><div>${blockDiagramSvg(b, BSZ, 2.2)}</div><div>
        <div class="callout">Make <b>${n}</b> block${n === 1 ? '' : 's'}</div>
        <p>Finished ${fmtSize(BSZ, BSZ)} · unfinished ${fmtSize(BSZ + 2 * sa, BSZ + 2 * sa)}</p>
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
      h += `<h3>Pieces for one block</h3><div class="piece-key">${pieceKey.map(({ f, step, r, u }) =>
        `<div>${usageThumbSvg(u, 0.55, 'in')}<span><b>${u.idx.size} × ${esc(r.recipe.makes)}</b><br>fabric <b>${fabricLetter(f)}</b>, cutting step ${step}</span></div>`).join('')}</div>`;
    }
    P('', h);
  }

  /* --- quilt top assembly --- */
  const asmSize = fit(Q.W, Q.H, page.w * 0.8, page.h * 0.42);
  let asm = `<h2>Quilt top assembly</h2><div class="hero">${quiltSvg(Q, { idp: 'pa', size: asmSize, labels: true, seams: true, binding: false })}</div>`;
  asm += assemblyText(Q, sa);
  P('', asm);

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
    <h3>Backing</h3><p>${plan.backing.panels > 1
      ? `Cut the backing fabric into ${plan.backing.panels} equal lengths. Remove selvages, sew together with ½" ${plan.backing.seams} seams and press open, to make a backing at least ${fmtSize(plan.backing.w, plan.backing.h)}.`
      : `Cut a backing at least ${fmtSize(plan.backing.w, plan.backing.h)}.`}</p>
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
        const cell = Q.cells[r * g.cols + c];
        h += `<td>${cell.b ? `${num(cell.b)}${rot(cell)}${cell.flip ? ' ⇋' : ''}` : cell.fab ? `□ ${fabricLetter(cell.fab)}` : '—'}</td>`;
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
    h += '</ol>';
  } else if (Q.mode === 'onpoint') {
    h += `<ol><li>Lay out the blocks on point with the side setting triangles (fabric ${fabricLetter(L.onpoint.fill)}) at the ends of each diagonal row, as numbered.</li>
      <li>Sew the blocks and side triangles of each diagonal row together. The setting triangles are cut oversized slightly; align their square corner with the block edge.</li>
      <li>Join the diagonal rows, matching seams. Add the four corner triangles last.</li>
      <li>Trim the edges straight, leaving ${fmtLen(sa)} beyond the block points for seam allowance.</li></ol>`;
  } else {
    const t = L.tess, name = tessShape(t.shape).label.replace(/ \(.*\)$/, '').toLowerCase();
    const edge = t.edge === 'fill' ? `Partial shapes at the edges are cut from fabric ${fabricLetter(t.fill)} so the quilt finishes with straight edges.` : 'Shapes at the edges are trimmed straight after the top is assembled — cut them as whole shapes and trim later, or use the edge templates.';
    const how = {
      hex: 'Hexagons need set-in (Y) seams. English paper piecing (EPP) is the easiest route: baste each hexagon over a paper template and whip-stitch neighbours together. By machine, sew hexagons into rows, stopping ¼" from each end, then set rows together.',
      tumbling: 'Sew three diamonds (one of each orientation) into a hexagon "cube" with set-in seams, then join the cubes into rows. EPP works well here too.',
      triangle: 'Sew the triangles into rows, alternating point up and point down and offsetting each by ¼" so the edges align. Join the rows, matching points.',
      zigzag: 'Sew the parallelograms into horizontal rows, matching the angled edges. Join the rows so the zigzags line up into lightning bolts.',
      brick: 'Sew the bricks into rows, then join the rows, offsetting every other row by half a brick.',
      diamond: 'Sew the diamonds into diagonal rows, then join the rows, matching points.',
      square: t.orient === 1 ? 'Sew the on-point squares into diagonal rows, then join the rows.' : 'Sew the squares into rows, then join the rows, nesting seams.',
    }[t.shape];
    const nWhole = Q.tiles.filter(x => x.whole).length;
    h += `<p>${t.shape === 'tumbling' ? `${nWhole} whole diamonds (about ${Math.round(nWhole / 3)} cubes)` : `${nWhole} whole ${name}`} make up the top.</p><ol><li>${how}</li><li>${edge}</li>`;
    for (const p of t.panels || []) {
      const pg = panelGeom(p, ...tessSize(t));
      const content = p.b && doc.blocks[p.b] ? `the ${esc(doc.blocks[p.b].name)} block` : p.fab ? `a ${fmtSize(p.size, p.size)} square of fabric ${fabricLetter(p.fab)}` : 'the centre square';
      const frames = (p.frames || []).filter(f => f.width > 0);
      h += `<li><b>Panel:</b> ${frames.length ? `frame ${content} with ${frames.map((f, k) => `${fmtLen(f.width)} strips of fabric ${fabricLetter(f.fabric)}${k === 0 ? ' (innermost)' : ''}`).join(', then ')} — sides first, then top and bottom — so it measures ${fmtSize(pg.outer + 2 * sa, pg.outer + 2 * sa)} unfinished.` : `${content} measures ${fmtSize(pg.outer + 2 * sa, pg.outer + 2 * sa)} unfinished.`}</li>
        <li><b>Setting the panel in:</b> piece the ${name} in sections — the full-width rows above and below the panel, and the shorter rows to its left and right. Trim each section's edge that meets the panel straight, ${fmtLen(sa)} beyond the panel line. Sew the left and right sections to the panel, then add the top and bottom sections, matching the shape points along each seam.</li>`;
    }
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
