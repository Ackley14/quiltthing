/* Block editor view. Drawn blocks: paint / select / polygon / rectangle / HST / seam tools on
   a square or triangular lattice. Compound blocks: pick slots and fill them from the sidebar. */

const BLOCK_TOOLS = [
  { key: 'paint', label: 'Paint', kb: 'V', icon: '🖌' },
  { key: 'select', label: 'Select', kb: 'S', icon: '⬚' },
  { key: 'polygon', label: 'Shape', kb: 'P', icon: '⬠' },
  { key: 'rect', label: 'Rectangle', kb: 'R', icon: '▭' },
  { key: 'tri', label: 'Triangle', kb: 'T', icon: '◩' },
  { key: 'seam', label: 'Seam', kb: 'K', icon: '✂' },
];

const ed = { drag: null, hover: null, shift: false };

Views.block = {
  main() {
    const b = activeBlock();
    if (!b) return `<div class="stage"><div class="canvas-wrap"><div class="docview" style="text-align:center"><h2>No block selected</h2><p class="sub">Draw a new block or pick one from the library on the left.</p><div class="btn-row" style="justify-content:center"><button class="btn primary" data-act="newBlock">Draw a block</button><button class="btn" data-act="newCompound">Combine blocks</button></div></div></div></div>`;
    const S = doc.layout.blockSize, m = S * 0.07;   // margin doubles as room to start a box-select
    if (b.kind === 'compound') {
      return `<div class="stage"><div class="toolbar"><b>${esc(b.name)}</b><span class="muted">· combination block</span><div class="spacer"></div>
          <button class="tool" data-act="toggleUi" data-arg="showPieces" aria-pressed="${!!ui.showPieces}">Cut pieces</button></div>
        <div class="canvas-wrap"><svg id="editor" class="editor" viewBox="${-m} ${-m} ${S + 2 * m} ${S + 2 * m}">${blockSvg(b, S, S, { slots: true, activeSlot: ui.activeSlot, pieces: ui.showPieces })}</svg></div>
        <div class="status-bar">${ui.activeSlot != null ? `<b>Slot ${ui.activeSlot + 1} selected</b> — pick a block from <b>My blocks</b> or the <b>library</b> to fill it.` : 'Click a slot, then pick the block to put in it. Rotate or mirror slots on the right.'}</div></div>`;
    }
    const tools = BLOCK_TOOLS.map(t => `<button class="tool" data-act="blockTool" data-arg="${t.key}" aria-pressed="${ui.tool === t.key}" title="${t.label} (${t.kb})">${t.icon} ${t.label} <kbd>${t.kb}</kbd></button>`).join('');
    return `<div class="stage"><div class="toolbar">${tools}<span class="sep"></span>
        <button class="tool" data-act="toggleSeamLines" aria-pressed="${ui.showSeamLines !== false}" title="Show or hide the red seam lines you've added">Seam lines</button>
        <button class="tool" data-act="toggleUi" data-arg="showPieces" aria-pressed="${!!ui.showPieces}" title="Outline each piece you'll actually cut — overlapping shapes are cut apart where they meet">Show pieces</button>
        <div class="spacer"></div><span id="seam-tool-slot"></span>
      </div>
      <div class="canvas-wrap"><svg id="editor" class="editor tool-${ui.tool}" viewBox="${-m} ${-m} ${S + 2 * m} ${S + 2 * m}" aria-label="Block editor"><g id="ed-c">${editorContent(b)}</g><g id="ed-ov" pointer-events="none"></g></svg>
        <div id="sel-bar" class="sel-bar" hidden></div><div id="seam-card" class="seam-card" hidden></div></div>
      <div class="status-bar" id="ed-status">${blockStatus(b)}</div></div>`;
  },
  afterMain(el) {
    const svg = el.querySelector('#editor');
    if (!svg) return;
    if (activeBlock()?.kind === 'compound') { svg.addEventListener('click', compoundClick); return; }
    svg.addEventListener('pointerdown', edDown);
    svg.addEventListener('pointermove', edMove);
    svg.addEventListener('pointerup', edUp);
    svg.addEventListener('pointercancel', () => { ed.drag = null; });
    svg.addEventListener('pointerleave', () => { ed.hover = null; drawOverlay(); });
    svg.addEventListener('dblclick', edDbl);
    svg.addEventListener('contextmenu', edContext);
    scheduleSeamCheck();
    positionSelBar();
  },
  inspector() { return blockInspector(); },
  key(e) { return blockViewKey(e); },
  // picking a fabric while shapes are selected recolours them
  onFabricPick(id) { if (ui.tool === 'select' && selList().length) Actions.regionFab(id); },
};

/* ---------- geometry helpers (grid units) ---------- */
function gridScale(b) { return doc.layout.blockSize / b.n; }
const TRI_H = Math.sqrt(3) / 2;
function latticeDots(b, fine) {
  const n = b.n, out = [];
  if (b.lattice === 'tri' && !fine) {
    for (let k = 0; k * TRI_H <= n + 1e-9; k++) {
      const y = round(k * TRI_H, 6), off = k % 2 ? 0.5 : 0;
      for (let x = off; x <= n + 1e-9; x += 1) out.push([x, y]);
      if (off) { out.push([0, y]); out.push([n, y]); }
    }
    for (let x = 0; x <= n; x += 0.5) out.push([x, n]);
    return out;
  }
  const st = fine ? 0.5 : 1;
  for (let y = 0; y <= n + 1e-9; y += st) for (let x = 0; x <= n + 1e-9; x += st) out.push([x, y]);
  return out;
}
// Nearest grid dot — or a corner of another shape, so pieces can be lined up exactly.
function snapDot(b, p, fine, skip) {
  let best = null, bd = Infinity;
  const consider = d => { const dd = (d[0] - p[0]) ** 2 + (d[1] - p[1]) ** 2; if (dd < bd) { bd = dd; best = d; } };
  for (const d of latticeDots(b, fine)) consider(d);
  b.regions.forEach((r, i) => { if (i !== skip) for (const q of r.pts) consider(q); });
  return best ? [best[0], best[1]] : best;
}
const samePt = (a, b) => a && b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
function evtGrid(e, b) { const [x, y] = svgPoint($('#editor'), e); const k = gridScale(b); return [x / k, y / k]; }

/* ---------- rendering ---------- */
function editorContent(b) {
  const S = doc.layout.blockSize, k = gridScale(b), hair = S * 0.003;
  let s = blockSvg(b, S, S, { ids: true });
  // grid
  if (b.lattice === 'tri') {
    const dots = latticeDots(b);
    for (const [x, y] of dots) s += `<circle class="dot" cx="${x * k}" cy="${y * k}" r="${S * 0.006}" stroke-width="${hair * .6}" opacity=".55"/>`;
  } else {
    for (let i = 0; i <= b.n; i++) {
      s += `<line class="gridline" x1="${i * k}" y1="0" x2="${i * k}" y2="${S}" stroke-width="${hair * (i === 0 || i === b.n ? 1.4 : .8)}"/>`;
      s += `<line class="gridline" x1="0" y1="${i * k}" x2="${S}" y2="${i * k}" stroke-width="${hair * (i === 0 || i === b.n ? 1.4 : .8)}"/>`;
    }
  }
  // seams (always shown while the seam tool is active, so they can be clicked to remove)
  if (ui.showSeamLines !== false || ui.tool === 'seam') (b.seams || []).forEach(([A, B], i) => {
    s += `<line class="seam-line" x1="${A[0] * k}" y1="${A[1] * k}" x2="${B[0] * k}" y2="${B[1] * k}" stroke-width="${hair * 1.6}"/>`;
    if (ui.tool === 'seam') s += `<line data-seam="${i}" x1="${A[0] * k}" y1="${A[1] * k}" x2="${B[0] * k}" y2="${B[1] * k}" stroke="transparent" stroke-width="${S * 0.025}" style="cursor:pointer"/>`;
  });
  if (ui.showPieces) {
    for (const p of blockPieces(b, S, S)) s += `<path d="${polyToPath(p.pts)}" fill="none" stroke="rgba(20,30,40,.75)" stroke-width="${hair * 1.4}" stroke-dasharray="${hair * 5} ${hair * 3}" pointer-events="none"/>`;
  }
  for (const pr of pieceProblems(b, S)) if (pr.kind !== 'tiny') s += `<path class="problem" d="${polyToPath(pr.piece.pts)}${pr.piece.holes.map(h => polyToPath(h)).join('')}" fill-rule="evenodd" stroke-width="${hair * 1.5}"/>`;
  // selection: outline every selected shape; corner/edge handles when exactly one is selected
  const sel = selList();
  if (ui.tool === 'select') for (const i of sel) s += `<path class="sel-outline" d="${regionPathD(b.regions[i], k)}" stroke-width="${hair * 3}"/>`;
  const r = sel.length === 1 ? b.regions[sel[0]] : null;
  if (r && ui.tool === 'select') {
    r.pts.forEach((q, i) => {
      const nb = r.pts[(i + 1) % r.pts.length];
      const bl = r.b?.[i] || 0;
      const mid = bl ? arcInfo([q[0] * k, q[1] * k], [nb[0] * k, nb[1] * k], bl).apex : [(q[0] + nb[0]) / 2 * k, (q[1] + nb[1]) / 2 * k];
      s += `<rect class="eh${bl ? ' curved' : ''}" data-eh="${i}" x="${mid[0] - S * .011}" y="${mid[1] - S * .011}" width="${S * .022}" height="${S * .022}" rx="${S * .004}" stroke-width="${hair}"><title>Drag to curve this edge · double-click to straighten · Alt-click to add a corner here</title></rect>`;
    });
    r.pts.forEach((q, i) => { s += `<circle class="vh" data-vh="${i}" cx="${q[0] * k}" cy="${q[1] * k}" r="${S * .014}" stroke-width="${hair * 1.2}"><title>Drag to move this corner · double-click to remove it</title></circle>`; });
  }
  return s;
}
function drawOverlay() {
  const ov = $('#ed-ov'), b = activeBlock();
  if (!ov || !b || b.kind !== 'drawn') return;
  const S = doc.layout.blockSize, k = gridScale(b), hair = S * 0.003;
  let s = '';
  const dr = ui.drawing;
  const h = ed.hover;
  if (ui.tool === 'polygon' && dr.length) {
    const pts = [...dr, ...(h ? [h] : [])].map(([x, y]) => `${x * k},${y * k}`).join(' ');
    s += `<polyline points="${pts}" fill="rgba(242,177,52,.25)" stroke="#c98a1f" stroke-width="${hair * 2.2}" stroke-dasharray="${hair * 5} ${hair * 3}"/>`;
    dr.forEach((q, i) => s += `<circle cx="${q[0] * k}" cy="${q[1] * k}" r="${S * (i === 0 && dr.length >= 3 ? .018 : .011)}" fill="${i === 0 ? '#f2b134' : '#fff'}" stroke="#1f3a5f" stroke-width="${hair}"/>`);
  }
  if (ui.tool === 'rect' && dr.length === 1 && h) {
    const [a, c] = [dr[0], h];
    s += `<rect x="${Math.min(a[0], c[0]) * k}" y="${Math.min(a[1], c[1]) * k}" width="${Math.abs(c[0] - a[0]) * k}" height="${Math.abs(c[1] - a[1]) * k}" fill="${fabricFill(ui.fabric)}" fill-opacity=".75" stroke="#c98a1f" stroke-width="${hair * 2}"/>`;
  }
  if (ui.tool === 'seam' && dr.length === 1 && h) s += `<line x1="${dr[0][0] * k}" y1="${dr[0][1] * k}" x2="${h[0] * k}" y2="${h[1] * k}" stroke="#b5482f" stroke-width="${hair * 2}" stroke-dasharray="${hair * 4} ${hair * 2}"/>`;
  if (ui.tool === 'tri' && ed.triPreview) s += `<path d="${polyToPath(ed.triPreview.map(([x, y]) => [x * k, y * k]))}" fill="${fabricFill(ui.fabric)}" fill-opacity=".75" stroke="#c98a1f" stroke-width="${hair * 2}"/>`;
  if (h && ['polygon', 'rect', 'seam'].includes(ui.tool)) s += `<circle cx="${h[0] * k}" cy="${h[1] * k}" r="${S * .016}" fill="#f2b134" stroke="#1f3a5f" stroke-width="${hair}"/>`;
  if (ed.drag?.kind === 'marquee' && ed.drag.cur) {
    const a = ed.drag.start, c = ed.drag.cur;
    s += `<rect x="${Math.min(a[0], c[0]) * k}" y="${Math.min(a[1], c[1]) * k}" width="${Math.abs(c[0] - a[0]) * k}" height="${Math.abs(c[1] - a[1]) * k}" fill="rgba(44,79,124,.08)" stroke="#2c4f7c" stroke-width="${hair}" stroke-dasharray="${hair * 4} ${hair * 3}"/>`;
  }
  if (ui.seamPreview && _seamState.block === b.id && _seamState.s) {
    const sg = _seamState.s;
    for (const [list, col] of [[sg.required, '#b5482f'], [sg.optional, '#2e7d4f']]) {
      for (const [A, B] of list) s += `<line x1="${A[0] * k}" y1="${A[1] * k}" x2="${B[0] * k}" y2="${B[1] * k}" stroke="${col}" stroke-width="${hair * 3}" stroke-dasharray="${hair * 6} ${hair * 4}" stroke-linecap="round"/>`;
    }
  }
  ov.innerHTML = s;
}
function blockStatus(b) {
  const fab = ui.fabric === BG ? 'quilt background' : esc(fabricLabel(ui.fabric));
  switch (ui.tool) {
    case 'paint': return `Click a piece to paint it with <b>${fab}</b> — drag across pieces to paint several. Alt-click picks up a piece's fabric. Right-click a shape for more options.`;
    case 'select': {
      const n = selList().length;
      if (!n) return 'Click a shape to select it · Shift-click to add more · Ctrl-drag (or drag from outside the block) to box-select · right-click for options.';
      return `<b>${plural(n, 'shape')} selected</b> — drag to move (Shift = half steps) · arrow keys nudge · <b>Delete</b> removes · Ctrl+D duplicates · Q/E rotate · X/Y mirror${n === 1 ? ' · drag white corners to reshape' : ''}`;
    }
    case 'polygon': return ui.drawing.length ? `<b>${ui.drawing.length} points</b> — click the first point or press <b>Enter</b> to finish · <b>Backspace</b> undo point · <b>Esc</b> cancel` : 'Click grid points to draw a shape. Hold <b>Shift</b> for the half grid.';
    case 'rect': return 'Drag from one grid point to another to add a rectangle (or click both corners).';
    case 'tri': return b.lattice === 'tri' ? 'Click inside a lattice triangle to fill it.' : 'Click near a corner of a grid square to add a half-square triangle covering that corner. Hold <b>Shift</b> for half-size squares.';
    case 'seam': return ui.drawing.length ? 'Click the other end of the seam line.' : 'Seam lines split pieces so every piece can be sewn with straight seams. Click two grid points. Click an existing seam to remove it.';
  }
  return '';
}
function refreshEditor(statusToo = true) {
  const b = activeBlock();
  const c = $('#ed-c');
  if (c && b) c.innerHTML = editorContent(b);
  drawOverlay();
  positionSelBar();
  if (statusToo && $('#ed-status') && b) $('#ed-status').innerHTML = blockStatus(b);
}

/* ---------- selection ---------- */
function selList() {
  const b = activeBlock();
  if (!b || b.kind !== 'drawn') return [];
  const list = (ui.selRegions || (ui.selRegion != null ? [ui.selRegion] : [])).filter(i => b.regions[i]);
  return uniq(list).sort((x, y) => x - y);
}
function setSel(list) {
  ui.selRegions = uniq(list.filter(i => i != null));
  ui.selRegion = ui.selRegions.length ? ui.selRegions[ui.selRegions.length - 1] : null;
}
function selBounds(b, list = selList()) {
  return bounds(list.flatMap(i => b.regions[i].pts));
}
// Small toolbar floating just above the selection.
function positionSelBar() {
  const bar = $('#sel-bar'), b = activeBlock(), svg = $('#editor'), wrap = bar?.parentElement;
  if (!bar || !b || b.kind !== 'drawn' || !svg) return;
  const sel = selList();
  if (ui.tool !== 'select' || !sel.length || ed.drag) { bar.hidden = true; return; }
  const k = gridScale(b), bb = selBounds(b, sel);
  const ctm = svg.getScreenCTM(), wr = wrap.getBoundingClientRect();
  const tl = new DOMPoint(bb.minX * k, bb.minY * k).matrixTransform(ctm), br = new DOMPoint(bb.maxX * k, bb.maxY * k).matrixTransform(ctm);
  bar.innerHTML = `<span class="sb-count">${sel.length > 1 ? sel.length : ''}</span>
    <button data-act="selPaint" title="Paint with ${esc(fabricLabel(ui.fabric))}">${swatchHtml(ui.fabric === BG ? doc.layout.background : ui.fabric, 16)}</button>
    <button data-act="selDup" title="Duplicate (Ctrl+D)">⧉</button>
    <button data-act="selRotate" data-arg="cw" title="Rotate 90° (E)">↻</button>
    <button data-act="selMirror" data-arg="h" title="Mirror left–right (X)">⇋</button>
    <button data-act="selOrder" data-arg="front" title="Bring to front">⤒</button>
    <button data-act="selOrder" data-arg="back" title="Send to back">⤓</button>
    <button data-act="selDelete" class="danger" title="Delete (Del)" aria-label="Delete"><svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.8 9.5h6.4L12 4M6.8 6.5v5M9.2 6.5v5"/></svg></button>`;
  bar.hidden = false;
  const bw = bar.offsetWidth, bh = bar.offsetHeight;
  let x = (tl.x + br.x) / 2 - wr.left - bw / 2, y = tl.y - wr.top - bh - 8;
  if (y < 4) y = br.y - wr.top + 8;
  bar.style.left = `${clamp(x, 4, wr.width - bw - 4)}px`;
  bar.style.top = `${clamp(y, 4, wr.height - bh - 4)}px`;
}

/* ---------- pointer interaction ---------- */
function regionAtEvent(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-region]');
  return el ? +el.dataset.region : null;
}
function edDown(e) {
  const b = activeBlock(); if (!b) return;
  const svg = e.currentTarget;
  const p = evtGrid(e, b), fine = e.shiftKey;
  const tool = ui.tool;
  if (tool === 'paint') {
    const ri = regionAtEvent(e);
    if (e.altKey || e.button === 2) { ui.fabric = ri != null ? b.regions[ri].fab : BG; saveUi(); renderSidebar(); refreshEditor(); toast(`Picked ${ri != null ? fabricLabel(b.regions[ri].fab) : 'quilt background'}`, 1200); return; }
    svg.setPointerCapture(e.pointerId);
    ed.drag = { kind: 'paint', changed: false };
    paintAt(e, b);
    return;
  }
  if (tool === 'select') {
    if (e.button === 2) return;
    const vh = e.target.closest('[data-vh]'), eh = e.target.closest('[data-eh]');
    if (eh && e.altKey) { insertCorner(b, +eh.dataset.eh); return; }
    if (vh || eh) {
      svg.setPointerCapture(e.pointerId);
      ed.drag = vh ? { kind: 'vertex', i: +vh.dataset.vh } : { kind: 'edge', i: +eh.dataset.eh };
      return;
    }
    const ri = regionAtEvent(e);
    const outside = p[0] < 0 || p[1] < 0 || p[0] > b.n || p[1] > b.n;
    if (ri == null || outside || e.ctrlKey || e.metaKey) {
      // box select (adds to the selection with Shift)
      svg.setPointerCapture(e.pointerId);
      ed.drag = { kind: 'marquee', start: p, cur: null, base: e.shiftKey ? selList() : [] };
      if (!e.shiftKey) setSel([]);
      refreshEditor(); renderInspector();
      return;
    }
    if (e.shiftKey) { const cur = selList(); setSel(cur.includes(ri) ? cur.filter(i => i !== ri) : [...cur, ri]); refreshEditor(); renderInspector(); return; }
    if (!selList().includes(ri)) { setSel([ri]); renderInspector(); }
    svg.setPointerCapture(e.pointerId);
    ed.drag = { kind: 'move', start: p, ri, orig: new Map(selList().map(i => [i, b.regions[i].pts.map(q => q.slice())])), moved: false };
    refreshEditor();
    return;
  }
  if (tool === 'polygon') {
    const d = snapDot(b, p, fine), dr = ui.drawing;
    if (dr.length >= 3 && samePt(d, dr[0])) return finishPolygon();
    if (dr.length && samePt(d, dr[dr.length - 1])) return;
    dr.push(d);
    refreshEditor();
    return;
  }
  if (tool === 'rect') {
    const d = snapDot(b, p, fine);
    if (ui.drawing.length === 1) { addRect(ui.drawing[0], d); return; }
    ui.drawing = [d];
    svg.setPointerCapture(e.pointerId);
    ed.drag = { kind: 'rect', start: d };
    drawOverlay();
    return;
  }
  if (tool === 'tri') {
    const tri = triangleAt(b, p, fine);
    if (tri) addOrRepaint(b, tri);
    return;
  }
  if (tool === 'seam') {
    const sl = e.target.closest('[data-seam]');
    if (sl && !ui.drawing.length) { b.seams.splice(+sl.dataset.seam, 1); commit(); toast('Seam removed', 1200); return; }
    const d = snapDot(b, p, fine);
    if (!ui.drawing.length) { ui.drawing = [d]; refreshEditor(); return; }
    const a = ui.drawing[0];
    ui.drawing = [];
    if (samePt(a, d)) { refreshEditor(); return; }
    b.seams = b.seams || [];
    b.seams.push([a, d]);
    commit();
  }
}
function edMove(e) {
  const b = activeBlock(); if (!b) return;
  const p = evtGrid(e, b), fine = e.shiftKey;
  const dr = ed.drag;
  if (dr?.kind === 'paint') { paintAt(e, b); return; }
  if (dr?.kind === 'move') {
    const tri = b.lattice === 'tri';
    const sx = fine || tri ? 0.5 : 1, sy = tri ? TRI_H : (fine ? 0.5 : 1);
    const dx = Math.round((p[0] - dr.start[0]) / sx) * sx, dy = Math.round((p[1] - dr.start[1]) / sy) * sy;
    if (dx === dr.dx && dy === dr.dy) return;
    dr.dx = dx; dr.dy = dy; dr.moved = dx !== 0 || dy !== 0;
    for (const [i, pts] of dr.orig) b.regions[i].pts = pts.map(([x, y]) => [round(x + dx, 6), round(y + dy, 6)]);
    refreshEditor(false);
    return;
  }
  if (dr?.kind === 'marquee') { dr.cur = p; drawOverlay(); return; }
  if (dr?.kind === 'vertex') {
    const r = b.regions[ui.selRegion]; if (!r) return;
    const d = snapDot(b, p, fine, ui.selRegion);
    if (!samePt(r.pts[dr.i], d)) { r.pts[dr.i] = d; dr.moved = true; refreshEditor(false); }
    return;
  }
  if (dr?.kind === 'edge') {
    const r = b.regions[ui.selRegion]; if (!r) return;
    const A = r.pts[dr.i], B = r.pts[(dr.i + 1) % r.pts.length];
    const L = dist(A, B); if (L < 1e-9) return;
    const n = [-(B[1] - A[1]) / L, (B[0] - A[0]) / L];
    const s = (p[0] - (A[0] + B[0]) / 2) * n[0] + (p[1] - (A[1] + B[1]) / 2) * n[1];
    let bl = clamp(2 * s / L, -1, 1);
    for (const snapTo of [0, QUARTER_BULGE, -QUARTER_BULGE, 1, -1]) if (Math.abs(bl - snapTo) < 0.05) bl = snapTo;
    if (!r.b) r.b = r.pts.map(() => 0);
    while (r.b.length < r.pts.length) r.b.push(0);
    r.b[dr.i] = round(bl, 4);
    dr.moved = true;
    refreshEditor(false);
    return;
  }
  // hover feedback
  if (['polygon', 'rect', 'seam'].includes(ui.tool)) {
    const d = snapDot(b, p, fine);
    if (!samePt(d, ed.hover)) { ed.hover = d; drawOverlay(); }
  } else if (ui.tool === 'tri') {
    ed.triPreview = triangleAt(b, p, fine);
    drawOverlay();
  }
}
function edUp(e) {
  const b = activeBlock(); const dr = ed.drag; ed.drag = null;
  if (!b || !dr) return;
  if (dr.kind === 'paint') { if (dr.changed) commit(); return; }
  if (dr.kind === 'vertex' || dr.kind === 'edge') { if (dr.moved) { cleanupRegion(b.regions[ui.selRegion]); commit(); } else positionSelBar(); return; }
  if (dr.kind === 'move') {
    if (dr.moved) { commit(); return; }
    // a plain click on one shape of a multi-selection narrows the selection to it
    if (selList().length > 1) { setSel([dr.ri]); refreshEditor(); renderInspector(); return; }
    positionSelBar();
    return;
  }
  if (dr.kind === 'marquee') {
    const a = dr.start, c = dr.cur || a;
    const box = { minX: Math.min(a[0], c[0]), maxX: Math.max(a[0], c[0]), minY: Math.min(a[1], c[1]), maxY: Math.max(a[1], c[1]) };
    const inside = b.regions.map((r, i) => ({ i, bb: bounds(r.pts) })).filter(({ bb }) => bb.minX >= box.minX - 1e-6 && bb.maxX <= box.maxX + 1e-6 && bb.minY >= box.minY - 1e-6 && bb.maxY <= box.maxY + 1e-6).map(x => x.i);
    setSel([...dr.base, ...inside]);
    refreshEditor(); renderInspector();
    return;
  }
  if (dr.kind === 'rect') {
    const d = snapDot(b, evtGrid(e, b), e.shiftKey);
    if (!samePt(d, dr.start)) addRect(dr.start, d);
    // otherwise keep the first corner and wait for a second click
  }
}
function edDbl(e) {
  const b = activeBlock(); if (!b) return;
  if (ui.tool === 'polygon' && ui.drawing.length >= 3) { finishPolygon(); return; }
  // the pointer is captured during clicks, so find what's actually under it
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const eh = under?.closest('[data-eh]'), vh = under?.closest('[data-vh]');
  if (ui.tool === 'select' && vh) {
    const r = b.regions[ui.selRegion], i = +vh.dataset.vh;
    if (!r || r.pts.length <= 3) { toast('A shape needs at least 3 corners'); return; }
    r.pts.splice(i, 1);
    if (r.b) { r.b.splice(i, 1); r.b[(i - 1 + r.pts.length) % r.pts.length] = 0; }
    commit();
    return;
  }
  if (ui.tool === 'select' && eh) {
    const r = b.regions[ui.selRegion];
    if (r?.b) { r.b[+eh.dataset.eh] = 0; commit(); }
  }
}
function paintAt(e, b) {
  const ri = regionAtEvent(e);
  if (ri == null) {
    // painting the bare background gives this block its own background fabric
    if (!ed.drag.bgDone && ui.fabric !== BG && e.type === 'pointerdown') {
      const n = b.n;
      b.regions.unshift({ pts: [[0, 0], [n, 0], [n, n], [0, n]], fab: ui.fabric });
      ed.drag.changed = true; ed.drag.bgDone = true;
      refreshEditor(false);
    }
    return;
  }
  if (b.regions[ri].fab !== ui.fabric) { b.regions[ri].fab = ui.fabric; ed.drag.changed = true; refreshEditor(false); }
}
function cleanupRegion(r) {
  if (!r) return;
  // drop repeated points created by dragging a vertex onto its neighbour
  for (let i = r.pts.length - 1; i >= 0 && r.pts.length > 2; i--) {
    if (samePt(r.pts[i], r.pts[(i + 1) % r.pts.length])) { r.pts.splice(i, 1); r.b?.splice(i, 1); }
  }
}
function finishPolygon() {
  const b = activeBlock();
  if (ui.drawing.length < 3) return;
  b.regions.push({ pts: ui.drawing.slice(), fab: ui.fabric });
  ui.drawing = [];
  ui.selRegion = b.regions.length - 1;
  commit();
}
function addRect(a, c) {
  const b = activeBlock();
  ui.drawing = [];
  if (Math.abs(a[0] - c[0]) < 1e-9 || Math.abs(a[1] - c[1]) < 1e-9) { refreshEditor(); return; }
  const x1 = Math.min(a[0], c[0]), x2 = Math.max(a[0], c[0]), y1 = Math.min(a[1], c[1]), y2 = Math.max(a[1], c[1]);
  addOrRepaint(b, [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
}
// Adding a shape identical to an existing one just repaints it (avoids invisible stacks).
function addOrRepaint(b, pts) {
  const key = ps => ps.map(ptKey).sort().join('|');
  const k = key(pts);
  const hit = b.regions.findIndex(r => r.pts.length === pts.length && !r.b?.some(x => x) && key(r.pts) === k);
  if (hit >= 0) { b.regions[hit].fab = ui.fabric; const [r] = b.regions.splice(hit, 1); b.regions.push(r); }
  else b.regions.push({ pts, fab: ui.fabric });
  commit();
}
function triangleAt(b, p, fine) {
  if (p[0] < 0 || p[1] < 0 || p[0] > b.n || p[1] > b.n) return null;
  if (b.lattice === 'tri' && !fine) {
    // row r lies between dot rows r and r+1; odd dot rows are shifted half a step
    const r = Math.floor(p[1] / TRI_H);
    const y0 = r * TRI_H, y1 = (r + 1) * TRI_H;
    const offTop = r % 2 ? 0.5 : 0, offBot = (r + 1) % 2 ? 0.5 : 0;
    for (let i = -1; i <= b.n + 1; i++) {
      const xb = i + offBot, xt = i + offTop;
      const up = [[xb, y1], [xb + 1, y1], [xb + 0.5, y0]];
      const down = [[xt, y0], [xt + 1, y0], [xt + 0.5, y1]];
      for (const t of [up, down]) if (pointInPoly(p, t)) return t.map(q => [round(q[0], 6), round(q[1], 6)]);
    }
    return null;
  }
  const st = fine ? 0.5 : 1;
  const cx = Math.min(Math.floor(p[0] / st) * st, b.n - st), cy = Math.min(Math.floor(p[1] / st) * st, b.n - st);
  const fx = (p[0] - cx) / st, fy = (p[1] - cy) / st;
  const tl = [cx, cy], tr = [cx + st, cy], br = [cx + st, cy + st], bl = [cx, cy + st];
  if (fx < .5 && fy < .5) return [tl, tr, bl];
  if (fx >= .5 && fy < .5) return [tl, tr, br];
  if (fx >= .5) return [tr, br, bl];
  return [tl, br, bl];
}
function compoundClick(e) {
  const s = e.target.closest('[data-slot]');
  if (!s) { ui.activeSlot = null; render(); return; }
  ui.activeSlot = +s.dataset.slot;
  render();
}

/* ---------- keyboard ---------- */
function blockViewKey(e) {
  const b = activeBlock();
  if (!b || b.kind !== 'drawn') return;
  const k = e.key.toLowerCase();
  const ctrl = e.ctrlKey || e.metaKey;
  const sel = selList();
  if (e.key === 'Escape') { ui.drawing = []; setSel([]); ed.triPreview = null; refreshEditor(); renderInspector(); return; }
  if (e.key === 'Enter' && ui.tool === 'polygon') { e.preventDefault(); finishPolygon(); return; }
  if (e.key === 'Backspace' && ui.drawing.length) { e.preventDefault(); ui.drawing.pop(); refreshEditor(); return; }
  if (ctrl && k === 'a') { e.preventDefault(); if (ui.tool !== 'select') ui.tool = 'select'; setSel(b.regions.map((_, i) => i)); renderView(); return; }
  if (ctrl && k === 'c' && sel.length) { e.preventDefault(); Actions.selCopy(); return; }
  if (ctrl && k === 'v') { e.preventDefault(); Actions.selPaste(); return; }
  if (ctrl && k === 'd' && sel.length) { e.preventDefault(); Actions.selDup(); return; }
  if (ctrl) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); Actions.selDelete(); return; }
  if (sel.length && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const st = e.shiftKey ? 0.5 : 1;
    const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    for (const i of sel) b.regions[i].pts = b.regions[i].pts.map(([x, y]) => [round(x + d[0], 6), round(y + d[1], 6)]);
    commit();
    return;
  }
  if (sel.length && ui.tool === 'select') {
    if (k === 'q') { Actions.selRotate('ccw'); return; }
    if (k === 'e') { Actions.selRotate('cw'); return; }
    if (k === 'x') { Actions.selMirror('h'); return; }
    if (k === 'y') { Actions.selMirror('v'); return; }
  }
  const tool = BLOCK_TOOLS.find(t => t.kb.toLowerCase() === k);
  if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); Actions.blockTool(tool.key); }
}

/* ---------- actions ---------- */
Actions.blockTool = t => { ui.tool = t; ui.drawing = []; ed.triPreview = null; if (t !== 'select') ui.selEdge = null; saveUi(); renderView(); };
/* ---------- seam suggestions (computed after render so drawing stays snappy) ---------- */
const _seamState = { block: null, key: null, s: null, timer: null };
function scheduleSeamCheck() {
  clearTimeout(_seamState.timer);
  const b = activeBlock();
  if (!b || b.kind !== 'drawn') return;
  _seamState.timer = setTimeout(() => {
    if (activeBlock() !== b || ui.view !== 'block') return;
    _seamState.block = b.id; _seamState.key = blockKey(b);
    _seamState.s = seamSuggestions(b);
    showSeamCard();
  }, _seamState.key === blockKey(b) ? 0 : 250);
}
function seamDismissed(b) { return (ui.seamDismiss || {})[b.id] === blockKey(b); }
function showSeamCard() {
  const card = $('#seam-card'), slot = $('#seam-tool-slot'), b = activeBlock();
  if (!card || !b) return;
  const sg = _seamState.s;
  const has = sg && (sg.required.length || sg.optional.length);
  if (slot) slot.innerHTML = has && seamDismissed(b) ? `<button class="tool" data-act="undismissSeams" title="Show the piecing suggestions again">💡 Piecing tips</button>` : '';
  if (!has || seamDismissed(b)) { card.hidden = true; drawOverlay(); return; }
  const lines = [];
  if (sg.required.length) lines.push(`<b>${plural(sg.reqPieces, 'piece')}</b> can't be sewn with straight seams as drawn — <b>${plural(sg.required.length, 'seam line')}</b> fix${sg.required.length === 1 ? 'es' : ''} that.`);
  if (sg.optional.length) lines.push(`<b>${plural(sg.optPieces, 'piece')}</b> would need a paper template — ${plural(sg.optional.length, 'more seam')} turn${sg.optional.length === 1 ? 's' : ''} ${sg.optPieces === 1 ? 'it' : 'them'} into rotary-cut shapes.`);
  if (sg.setInAfter) lines.push('Some pieces will still meet in a set-in (Y) seam — fine for English paper piecing.');
  const total = sg.required.length + sg.optional.length;
  card.innerHTML = `<div class="sc-icon">💡</div><div class="sc-body"><b>Piecing suggestion</b><br>${lines.join('<br>')}
    <div class="btn-row"><button class="btn small" data-act="seamPreview">${ui.seamPreview ? 'Hide preview' : 'Preview'}</button>
    <button class="btn small primary" data-act="applySeams" data-arg="all">Add ${total === 1 ? 'seam' : `${total} seams`}</button>
    ${sg.required.length && sg.optional.length ? '<button class="btn small" data-act="applySeams" data-arg="required">Only the required ones</button>' : ''}
    <button class="btn small ghost" data-act="dismissSeams">Not now</button></div></div>`;
  card.hidden = false;
  drawOverlay();
}
Actions.toggleSeamLines = () => { ui.showSeamLines = ui.showSeamLines === false; saveUi(); renderView(); };
Actions.seamPreview = () => { ui.seamPreview = !ui.seamPreview; saveUi(); showSeamCard(); };
Actions.dismissSeams = () => { const b = activeBlock(); ui.seamDismiss = { ...(ui.seamDismiss || {}), [b.id]: blockKey(b) }; ui.seamPreview = false; saveUi(); showSeamCard(); };
Actions.undismissSeams = () => { const b = activeBlock(); if (ui.seamDismiss) delete ui.seamDismiss[b.id]; saveUi(); showSeamCard(); };
Actions.applySeams = mode => {
  const b = activeBlock(), sg = seamSuggestions(b);
  const add = mode === 'required' ? sg.required : [...sg.required, ...sg.optional];
  if (!add.length) { toast('No seams to add'); return; }
  b.seams = [...(b.seams || []), ...add];
  ui.seamPreview = false;
  commit();
  const an = analyzeBlock(b, doc.layout.blockSize);
  toast(an.setIn ? `Added ${plural(add.length, 'seam')} — some pieces still meet in a Y-seam` : `Added ${plural(add.length, 'seam')} — the block now sews with straight seams`);
};
Actions.autoSeams = () => {
  const sg = seamSuggestions(activeBlock());
  if (!sg.required.length && !sg.optional.length) { toast(sg.unresolved ? "Couldn't find straight seams for those pieces — they may need appliqué or set-in seams" : 'Nothing to improve — every piece is already a rotary-cut shape'); return; }
  Actions.applySeams('all');
};
Actions.clearSeams = () => { const b = activeBlock(); b.seams = []; commit(); };
Actions.blockName = v => { const b = activeBlock(); if (b) { b.name = v.trim() || 'Untitled block'; commit(); } };
Actions.blockGrid = v => {
  const b = activeBlock(); const n = clamp(parseInt(v, 10) || b.n, 1, 48);
  const k = n / b.n;
  // scale geometry exactly so the design keeps its shape
  for (const r of b.regions) r.pts = r.pts.map(([x, y]) => [round(x * k, 6), round(y * k, 6)]);
  b.seams = (b.seams || []).map(s => s.map(([x, y]) => [round(x * k, 6), round(y * k, 6)]));
  b.n = n; ui.drawing = [];
  commit();
};
Actions.blockLattice = v => { const b = activeBlock(); b.lattice = v; ui.drawing = []; commit(); };
Actions.blockDuplicate = () => { const b = activeBlock(); const c = cloneBlock(b); c.name = b.name + ' copy'; doc.blocks[c.id] = c; doc.blockOrder.splice(doc.blockOrder.indexOf(b.id) + 1, 0, c.id); ui.activeBlock = c.id; commit(); };
Actions.blockDelete = () => {
  const b = activeBlock(); const n = blockUseCount(b.id);
  confirmModal(`Delete “${esc(b.name)}”?`, n ? `It's used ${plural(n, 'time')} in your quilt or other blocks; those places will be emptied.` : 'This block isn’t used anywhere.', 'Delete block', () => {
    const id = b.id;
    delete doc.blocks[id];
    doc.blockOrder = doc.blockOrder.filter(x => x !== id);
    const L = doc.layout;
    L.grid.cells = L.grid.cells.map(c => c?.b === id ? null : c);
    for (const k of Object.keys(L.onpoint.cells)) if (L.onpoint.cells[k]?.b === id) delete L.onpoint.cells[k];
    for (const o of Object.values(doc.blocks)) if (o.kind === 'compound') o.slots = o.slots.map(s => s?.b === id ? null : s);
    ui.activeBlock = doc.blockOrder[0] || null; ui.selRegion = null;
    commit();
  }, true);
};
function transformBlock(b, fn, mirror) {
  for (const r of b.regions) { r.pts = r.pts.map(fn); if (mirror && r.b) r.b = r.b.map(x => -x); }
  b.seams = (b.seams || []).map(s => s.map(fn));
}
Actions.blockRotate = () => { const b = activeBlock(), n = b.n; if (b.kind === 'compound') return; transformBlock(b, ([x, y]) => [round(n - y, 6), round(x, 6)]); commit(); };
Actions.blockMirror = () => { const b = activeBlock(), n = b.n; if (b.kind === 'compound') return; transformBlock(b, ([x, y]) => [round(n - x, 6), y], true); commit(); };
Actions.blockClear = () => confirmModal('Clear this block?', 'Removes every shape and seam (the whole block becomes background).', 'Clear', () => { const b = activeBlock(); b.regions = []; b.seams = []; ui.selRegion = null; commit(); }, true);

const selRegion = () => activeBlock()?.regions?.[ui.selRegion];
Actions.selectRegion = (i, el, e) => {
  i = +i;
  if (e?.shiftKey) { const cur = selList(); setSel(cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i]); }
  else setSel([i]);
  if (ui.tool !== 'select') ui.tool = 'select';
  saveUi(); renderView();
};
Actions.regionFab = id => { const b = activeBlock(), sel = selList(); if (!sel.length) return; for (const i of sel) b.regions[i].fab = id; commit(); };
Actions.regionApp = v => { const b = activeBlock(); for (const i of selList()) { const r = b.regions[i]; if (v) r.app = true; else delete r.app; } commit(); };
Actions.regionDelete = () => Actions.selDelete();
Actions.regionOrder = dir => {
  const b = activeBlock(), sel = selList(); if (!sel.length) return;
  if (dir === 'front' || dir === 'back') { Actions.selOrder(dir); return; }
  if (sel.length !== 1) return;
  const i = sel[0], j = dir === 'up' ? Math.min(i + 1, b.regions.length - 1) : Math.max(i - 1, 0);
  const [r] = b.regions.splice(i, 1); b.regions.splice(j, 0, r); setSel([j]); commit();
};
/* selection actions (toolbar, context menu, keyboard) */
let _edClip = null;
function selCentre(b, sel) { const bb = selBounds(b, sel); return [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]; }
Actions.selDelete = () => {
  const b = activeBlock(), sel = selList(); if (!sel.length) return;
  for (const i of sel.slice().sort((x, y) => y - x)) b.regions.splice(i, 1);
  setSel([]); commit(); toast(`Deleted ${plural(sel.length, 'shape')}`, 1400);
};
Actions.selPaint = () => Actions.regionFab(ui.fabric);
Actions.selPick = () => { const b = activeBlock(), sel = selList(); if (!sel.length) return; ui.fabric = b.regions[sel[sel.length - 1]].fab; saveUi(); render(); toast(`Picked ${ui.fabric === BG ? 'quilt background' : fabricLabel(ui.fabric)}`, 1200); };
Actions.selDup = () => {
  const b = activeBlock(), sel = selList(); if (!sel.length) return;
  const copies = sel.map(i => { const c = JSON.parse(JSON.stringify(b.regions[i])); c.pts = c.pts.map(([x, y]) => [x + 1, y + 1]); return c; });
  const start = b.regions.length;
  b.regions.push(...copies);
  setSel(copies.map((_, k) => start + k)); ui.tool = 'select'; commit();
};
Actions.selCopy = () => { const b = activeBlock(), sel = selList(); if (!sel.length) return; _edClip = { n: b.n, regions: sel.map(i => JSON.parse(JSON.stringify(b.regions[i]))), pastes: 0 }; toast(`Copied ${plural(sel.length, 'shape')}`, 1200); };
Actions.selPaste = () => {
  const b = activeBlock(); if (!_edClip || !b || b.kind !== 'drawn') return;
  _edClip.pastes++;
  const k = b.n / _edClip.n, off = _edClip.pastes;
  const start = b.regions.length;
  for (const r of _edClip.regions) { const c = JSON.parse(JSON.stringify(r)); c.pts = c.pts.map(([x, y]) => [round(x * k + off, 6), round(y * k + off, 6)]); b.regions.push(c); }
  setSel(_edClip.regions.map((_, i) => start + i)); ui.tool = 'select'; commit();
};
Actions.selRotate = dir => {
  const b = activeBlock(), sel = selList(); if (!sel.length) return;
  const [cx, cy] = selCentre(b, sel), s = dir === 'ccw' ? -1 : 1;
  for (const i of sel) b.regions[i].pts = b.regions[i].pts.map(([x, y]) => [round(cx - s * (y - cy), 6), round(cy + s * (x - cx), 6)]);
  commit();
};
Actions.selMirror = axis => {
  const b = activeBlock(), sel = selList(); if (!sel.length) return;
  const [cx, cy] = selCentre(b, sel);
  for (const i of sel) {
    const r = b.regions[i];
    r.pts = r.pts.map(([x, y]) => axis === 'v' ? [x, round(2 * cy - y, 6)] : [round(2 * cx - x, 6), y]);
    if (r.b) r.b = r.b.map(v => -v);
  }
  commit();
};
Actions.selOrder = dir => {
  const b = activeBlock(), sel = selList(); if (!sel.length) return;
  const picked = sel.map(i => b.regions[i]), rest = b.regions.filter((_, i) => !sel.includes(i));
  b.regions = dir === 'front' ? [...rest, ...picked] : [...picked, ...rest];
  setSel(picked.map(r => b.regions.indexOf(r))); commit();
};
function insertCorner(b, i) {
  const r = b.regions[ui.selRegion]; if (!r) return;
  const A = r.pts[i], B = r.pts[(i + 1) % r.pts.length];
  const m = snapDot(b, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], true, ui.selRegion);
  if (samePt(m, A) || samePt(m, B)) { toast('Edge too short to add a corner here'); return; }
  r.pts.splice(i + 1, 0, m);
  if (r.b) { r.b[i] = 0; r.b.splice(i + 1, 0, 0); }
  commit();
  toast('Corner added — drag it to reshape', 1400);
}
// Right-click a shape (any tool) for quick actions.
function edContext(e) {
  e.preventDefault();
  const b = activeBlock(); if (!b) return;
  const ri = regionAtEvent(e);
  const items = [];
  if (ri != null) {
    if (!selList().includes(ri)) setSel([ri]);
    if (ui.tool !== 'select' && ui.tool !== 'paint') ui.tool = 'select';
    refreshEditor(); renderInspector();
    const n = selList().length, what = n > 1 ? `${n} shapes` : 'shape';
    items.push({ label: `Paint with ${esc(ui.fabric === BG ? 'quilt background' : fabricLabel(ui.fabric))}`, act: 'selPaint' },
      { label: 'Pick up this fabric', act: 'selPick' }, '-',
      { label: 'Duplicate', act: 'selDup', kb: 'Ctrl+D' }, { label: 'Copy', act: 'selCopy', kb: 'Ctrl+C' },
      { label: 'Rotate 90°', act: 'selRotate', arg: 'cw', kb: 'E' }, { label: 'Mirror left–right', act: 'selMirror', arg: 'h', kb: 'X' }, { label: 'Mirror top–bottom', act: 'selMirror', arg: 'v', kb: 'Y' }, '-',
      { label: 'Bring to front', act: 'selOrder', arg: 'front' }, { label: 'Send to back', act: 'selOrder', arg: 'back' }, '-',
      { label: `Delete ${what}`, act: 'selDelete', kb: 'Del', danger: true });
  } else {
    items.push({ label: 'Select all shapes', act: 'selAll', kb: 'Ctrl+A' });
    if (_edClip) items.push({ label: 'Paste', act: 'selPaste', kb: 'Ctrl+V' });
  }
  openMenu({ x: e.clientX, y: e.clientY }, items);
}
Actions.selAll = () => { const b = activeBlock(); ui.tool = 'select'; setSel(b.regions.map((_, i) => i)); renderView(); };
Actions.regionCopies = mode => {
  const b = activeBlock(), r = selRegion(); if (!r) return;
  const n = b.n, c = n / 2;
  const copy = fn => ({ ...JSON.parse(JSON.stringify(r)), pts: r.pts.map(fn).map(([x, y]) => [round(x, 6), round(y, 6)]) });
  if (mode.startsWith('rot')) {
    const N = +mode.slice(3);
    for (let k = 1; k < N; k++) {
      const a = 2 * Math.PI * k / N, cs = Math.cos(a), sn = Math.sin(a);
      b.regions.push(copy(([x, y]) => [c + (x - c) * cs - (y - c) * sn, c + (x - c) * sn + (y - c) * cs]));
    }
  } else {
    const flips = mode === 'h' ? [[-1, 1]] : mode === 'v' ? [[1, -1]] : [[-1, 1], [1, -1], [-1, -1]];
    for (const [fx, fy] of flips) {
      const cp = copy(([x, y]) => [c + (x - c) * fx, c + (y - c) * fy]);
      if (cp.b && fx * fy < 0) cp.b = cp.b.map(x => -x);
      b.regions.push(cp);
    }
  }
  commit();
};
Actions.edgeBulge = v => {
  const r = selRegion(); const i = ui.selEdge; if (!r || i == null) return;
  if (!r.b) r.b = r.pts.map(() => 0);
  r.b[i] = +v; commit();
};

/* ---------- compound actions ---------- */
Actions.compoundSub = key => {
  const b = activeBlock(); const p = SUB_PRESETS.find(x => x.key === key); if (!p) return;
  b.sub = JSON.parse(JSON.stringify(p.sub));
  const n = subRects(b.sub, 1, 1).length;
  b.slots = Array.from({ length: n }, (_, i) => b.slots[i] || null);
  ui.activeSlot = null; commit();
};
Actions.slotPick = i => { ui.activeSlot = +i; render(); };
Actions.slotBlock = (v, el) => {
  const b = activeBlock(), i = +el.dataset.arg;
  if (!v) b.slots[i] = null;
  else if (wouldCycle(b.id, v)) { toast("A block can't contain itself"); render(); return; }
  else b.slots[i] = { b: v, r: b.slots[i]?.r || 0, f: !!b.slots[i]?.f };
  commit();
};
Actions.slotRot = (v, el) => { const s = activeBlock().slots[+el.dataset.arg]; if (s) { s.r = +v; commit(); } };
Actions.slotFlip = (v, el) => { const s = activeBlock().slots[+el.dataset.arg]; if (s) { s.f = !!v; commit(); } };

/* ---------- inspector ---------- */
function blockInspector() {
  const b = activeBlock();
  if (!b) return section('Block', '<p class="hint">Select or create a block.</p>');
  const S = doc.layout.blockSize;
  let h = section('Block', `
    <label class="f">Name<input type="text" value="${esc(b.name)}" data-change="blockName"></label>
    ${b.kind === 'drawn' ? `<div class="f-row">
      <label class="f">Grid<select data-change="blockGrid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24, 32].concat(b.n).filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y).map(v => `<option value="${v}" ${v === b.n ? 'selected' : ''}>${v} × ${v}</option>`).join('')}</select></label>
      <label class="f">Lattice<select data-change="blockLattice"><option value="square" ${b.lattice !== 'tri' ? 'selected' : ''}>Square</option><option value="tri" ${b.lattice === 'tri' ? 'selected' : ''}>Triangle (60°)</option></select></label></div>
      <p class="hint">Finished ${fmtSize(S, S)} · one grid square = ${fmtLen(S / b.n)}. Change the block size in Layout.</p>` : ''}
    <div class="btn-row">
      ${b.kind === 'drawn' ? `<button class="btn small" data-act="blockRotate" title="Rotate the design 90°">↻ Rotate</button><button class="btn small" data-act="blockMirror" title="Mirror left–right">⇋ Mirror</button>` : ''}
      <button class="btn small" data-act="blockDuplicate">Duplicate</button>
      <button class="btn small" data-act="exportBlocks" data-arg="one" title="Save this block to a file you can import into another project">Export</button>
      ${b.kind === 'drawn' ? '<button class="btn small" data-act="blockClear">Clear</button>' : ''}
      <button class="btn small danger" data-act="blockDelete">Delete</button>
    </div>`, { key: 'block' });

  if (b.kind === 'compound') {
    let slots = `<label class="f">Arrangement<select data-change="compoundSub">${SUB_PRESETS.map(p => `<option value="${p.key}" ${subKey(b.sub) === p.key ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>`;
    b.slots.forEach((s, i) => {
      const opts = ['<option value="">— empty —</option>', ...doc.blockOrder.filter(id => id !== b.id && !wouldCycle(b.id, id)).map(id => `<option value="${id}" ${s?.b === id ? 'selected' : ''}>${esc(doc.blocks[id].name)}</option>`)].join('');
      slots += `<div class="list-item" style="${ui.activeSlot === i ? 'border-color:var(--sel)' : ''}"><div class="li-h"><b>Slot ${i + 1}</b><button class="btn small ghost" data-act="slotPick" data-arg="${i}">Select</button></div>
        <select data-change="slotBlock" data-arg="${i}" style="width:100%;margin-top:4px">${opts}</select>
        ${s ? `<div class="f-row"><label class="f">Rotate<select data-change="slotRot" data-arg="${i}">${[0, 1, 2, 3].map(r => `<option value="${r}" ${(s.r || 0) === r ? 'selected' : ''}>${r * 90}°</option>`).join('')}</select></label>
        <label class="check" style="margin-top:24px"><input type="checkbox" data-change="slotFlip" data-arg="${i}" ${s.f ? 'checked' : ''}> Mirror</label></div>` : ''}</div>`;
    });
    h += section('Slots', slots, { key: 'slots' });
    h += constructionSection(b, S);
    return h;
  }

  const sel = selList();
  if (sel.length > 1) {
    const fabs = uniq(sel.map(i => b.regions[i].fab));
    h += section(`${sel.length} shapes selected`, `<div class="hint" style="margin-top:0">Fabric (applies to all)</div>${fabricPicker(fabs.length === 1 ? fabs[0] : null, 'regionFab', { allowBg: true })}
      <div class="btn-row"><button class="btn small" data-act="selRotate" data-arg="cw">↻ Rotate</button><button class="btn small" data-act="selMirror" data-arg="h">⇋ Mirror</button><button class="btn small" data-act="selDup">Duplicate</button></div>
      <div class="btn-row"><button class="btn small" data-act="selOrder" data-arg="front">⤒ Front</button><button class="btn small" data-act="selOrder" data-arg="back">⤓ Back</button><button class="btn small danger" data-act="selDelete">Delete ${sel.length}</button></div>`, { key: 'shape' });
  }
  const r = sel.length === 1 ? b.regions[sel[0]] : null;
  if (r) {
    const i = sel[0];
    let body = `<div class="hint" style="margin-top:0">Fabric</div>${fabricPicker(r.fab, 'regionFab', { allowBg: true })}
      <label class="check"><input type="checkbox" data-change="regionApp" ${r.app ? 'checked' : ''}> Appliqué (sewn on top, doesn't cut the pieces below)</label>
      <div class="btn-row"><button class="btn small" data-act="regionOrder" data-arg="back" title="Send to back">⤓ Back</button><button class="btn small" data-act="regionOrder" data-arg="down">↓</button><button class="btn small" data-act="regionOrder" data-arg="up">↑</button><button class="btn small" data-act="regionOrder" data-arg="front" title="Bring to front">⤒ Front</button></div>
      <h4>Make copies around the centre</h4>
      <div class="btn-row"><button class="btn small" data-act="regionCopies" data-arg="rot2">½ turn</button><button class="btn small" data-act="regionCopies" data-arg="rot4">4 × ¼ turn</button><button class="btn small" data-act="regionCopies" data-arg="rot8">8 ×</button></div>
      <div class="btn-row"><button class="btn small" data-act="regionCopies" data-arg="h">Mirror ⇋</button><button class="btn small" data-act="regionCopies" data-arg="v">Mirror ⇵</button><button class="btn small" data-act="regionCopies" data-arg="4">4-way</button></div>
      <div class="btn-row"><button class="btn small danger" data-act="regionDelete">Delete shape</button></div>`;
    h += section(`Shape ${i + 1}`, body, { key: 'shape' });
  }

  // shapes list
  let list = '';
  for (let i = b.regions.length - 1; i >= 0; i--) {
    const reg = b.regions[i];
    list += `<div class="region-row" aria-pressed="${sel.includes(i)}" data-act="selectRegion" data-arg="${i}">${reg.fab === BG ? '<span class="sw" style="background:repeating-linear-gradient(45deg,#faf7f1,#faf7f1 3px,#e9e1d2 3px,#e9e1d2 6px)"></span>' : swatchHtml(reg.fab, 16)}<span class="nm">${reg.pts.length === 2 ? 'Ellipse' : reg.pts.length === 3 ? 'Triangle' : reg.pts.length === 4 ? 'Quad' : reg.pts.length + '-sided'} · ${esc(reg.fab === BG ? 'Quilt background' : fabricLabel(reg.fab))}${reg.app ? ' · appliqué' : ''}${reg.b?.some(x => x) ? ' · curved' : ''}</span></div>`;
  }
  h += section(`Shapes (${b.regions.length})`, list ? `<p class="hint" style="margin-top:0">Top of the list is in front. Shift-click to select several.</p>${list}` : '<p class="hint">No shapes yet — the whole block is quilt background. Use the tools above the canvas to draw.</p>', { key: 'shapes' });
  h += section('Seams', `<p class="hint" style="margin-top:0">${b.seams?.length ? `${plural(b.seams.length, 'seam line')} split this block's pieces.` : 'No extra seam lines.'} Use the ✂ Seam tool to add more.</p>
    <div class="btn-row"><button class="btn small" data-act="autoSeams">Add suggested seams</button>${b.seams?.length ? '<button class="btn small" data-act="clearSeams">Remove all</button>' : ''}</div>`, { key: 'seams' });
  h += constructionSection(b, S);
  return h;
}
function constructionSection(b, S) {
  const pieces = blockPieces(b, S, S);
  const an = analyzeBlock(b, S);
  const counts = {};
  for (const p of pieces) { const k = shapeName(p.cls) + (p.app ? ' (appliqué)' : ''); counts[k] = (counts[k] || 0) + 1; }
  const units = {};
  for (const u of an.units) if (u.unit.type !== 'piece') units[u.unit.type] = (units[u.unit.type] || 0) + 1;
  const probs = pieceProblems(b, S);
  let body = `<dl class="kv"><dt>Pieces to cut</dt><dd>${pieces.length}</dd>${Object.entries(counts).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  if (Object.keys(units).length) body += `<dl class="kv" style="margin-top:8px">${Object.entries(units).map(([k, v]) => `<dt>${esc(UNIT_NAMES[k] || k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  body += an.setIn
    ? `<div class="callout bad">Some pieces meet in set-in (Y) seams. That's fine for English paper piecing or careful machine piecing — the pattern explains how. Add seam lines if you'd rather sew straight seams.</div>`
    : pieces.length > 1 ? `<div class="callout ok">Sews together with straight seams in ${plural(an.height, 'step')}.</div>` : '';
  for (const p of probs) body += `<div class="callout${p.kind === 'tiny' ? '' : ' bad'}" style="margin-top:6px">${esc(p.msg)}</div>`;
  return section('Construction', body, { key: 'construct' });
}
