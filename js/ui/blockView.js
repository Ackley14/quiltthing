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
    const S = doc.layout.blockSize, m = S * 0.035;
    if (b.kind === 'compound') {
      return `<div class="stage"><div class="toolbar"><b>${esc(b.name)}</b><span class="muted">· combination block</span><div class="spacer"></div>
          <button class="tool" data-act="toggleUi" data-arg="showPieces" aria-pressed="${!!ui.showPieces}">Cut pieces</button></div>
        <div class="canvas-wrap"><svg id="editor" class="editor" viewBox="${-m} ${-m} ${S + 2 * m} ${S + 2 * m}">${blockSvg(b, S, S, { slots: true, activeSlot: ui.activeSlot, pieces: ui.showPieces })}</svg></div>
        <div class="status-bar">${ui.activeSlot != null ? `<b>Slot ${ui.activeSlot + 1} selected</b> — pick a block from <b>My blocks</b> or the <b>library</b> to fill it.` : 'Click a slot, then pick the block to put in it. Rotate or mirror slots on the right.'}</div></div>`;
    }
    const tools = BLOCK_TOOLS.map(t => `<button class="tool" data-act="blockTool" data-arg="${t.key}" aria-pressed="${ui.tool === t.key}" title="${t.label} (${t.kb})">${t.icon} ${t.label} <kbd>${t.kb}</kbd></button>`).join('');
    return `<div class="stage"><div class="toolbar">${tools}<span class="sep"></span>
        <button class="tool" data-act="toggleUi" data-arg="showPieces" aria-pressed="${!!ui.showPieces}" title="Outline the actual pieces you'll cut">Cut pieces</button>
        <div class="spacer"></div><span id="seam-tool-slot"></span>
      </div>
      <div class="canvas-wrap"><svg id="editor" class="editor tool-${ui.tool}" viewBox="${-m} ${-m} ${S + 2 * m} ${S + 2 * m}" aria-label="Block editor"><g id="ed-c">${editorContent(b)}</g><g id="ed-ov" pointer-events="none"></g></svg>
        <div id="seam-card" class="seam-card" hidden></div></div>
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
    svg.addEventListener('contextmenu', e => e.preventDefault());
    scheduleSeamCheck();
  },
  inspector() { return blockInspector(); },
  key(e) { return blockViewKey(e); },
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
function snapDot(b, p, fine) {
  let best = null, bd = Infinity;
  for (const d of latticeDots(b, fine)) { const dd = (d[0] - p[0]) ** 2 + (d[1] - p[1]) ** 2; if (dd < bd) { bd = dd; best = d; } }
  return best;
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
  // seams
  (b.seams || []).forEach(([A, B], i) => {
    s += `<line class="seam-line" x1="${A[0] * k}" y1="${A[1] * k}" x2="${B[0] * k}" y2="${B[1] * k}" stroke-width="${hair * 1.6}"/>`;
    if (ui.tool === 'seam') s += `<line data-seam="${i}" x1="${A[0] * k}" y1="${A[1] * k}" x2="${B[0] * k}" y2="${B[1] * k}" stroke="transparent" stroke-width="${S * 0.025}" style="cursor:pointer"/>`;
  });
  if (ui.showPieces) {
    for (const p of blockPieces(b, S, S)) s += `<path d="${polyToPath(p.pts)}" fill="none" stroke="rgba(20,30,40,.75)" stroke-width="${hair * 1.4}" stroke-dasharray="${hair * 5} ${hair * 3}" pointer-events="none"/>`;
  }
  for (const pr of pieceProblems(b, S)) if (pr.kind !== 'tiny') s += `<path class="problem" d="${polyToPath(pr.piece.pts)}${pr.piece.holes.map(h => polyToPath(h)).join('')}" fill-rule="evenodd" stroke-width="${hair * 1.5}"/>`;
  // selection handles
  const r = b.regions[ui.selRegion];
  if (r && ui.tool === 'select') {
    s += `<path class="sel-outline" d="${regionPathD(r, k)}" stroke-width="${hair * 3}"/>`;
    r.pts.forEach((q, i) => {
      const nb = r.pts[(i + 1) % r.pts.length];
      const bl = r.b?.[i] || 0;
      const mid = bl ? arcInfo([q[0] * k, q[1] * k], [nb[0] * k, nb[1] * k], bl).apex : [(q[0] + nb[0]) / 2 * k, (q[1] + nb[1]) / 2 * k];
      s += `<rect class="eh${bl ? ' curved' : ''}" data-eh="${i}" x="${mid[0] - S * .011}" y="${mid[1] - S * .011}" width="${S * .022}" height="${S * .022}" rx="${S * .004}" stroke-width="${hair}"><title>Drag to curve this edge · double-click to straighten</title></rect>`;
    });
    r.pts.forEach((q, i) => { s += `<circle class="vh" data-vh="${i}" cx="${q[0] * k}" cy="${q[1] * k}" r="${S * .014}" stroke-width="${hair * 1.2}"><title>Drag to move this point</title></circle>`; });
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
    case 'paint': return `Click a piece to paint it with <b>${fab}</b> — drag across pieces to paint several. Alt-click (or right-click) picks up a piece's fabric.`;
    case 'select': return ui.selRegion != null ? 'Drag white points to move them, drag yellow edge handles to curve an edge (double-click to straighten). <b>Delete</b> removes the shape.' : 'Click a shape to select it.';
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
  if (statusToo && $('#ed-status') && b) $('#ed-status').innerHTML = blockStatus(b);
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
    const vh = e.target.closest('[data-vh]'), eh = e.target.closest('[data-eh]');
    if (vh || eh) {
      svg.setPointerCapture(e.pointerId);
      ed.drag = vh ? { kind: 'vertex', i: +vh.dataset.vh } : { kind: 'edge', i: +eh.dataset.eh };
      return;
    }
    const ri = regionAtEvent(e);
    ui.selRegion = ri; ui.selEdge = null;
    refreshEditor(); renderInspector();
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
  if (dr?.kind === 'vertex') {
    const r = b.regions[ui.selRegion]; if (!r) return;
    const d = snapDot(b, p, fine);
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
  if (dr.kind === 'vertex' || dr.kind === 'edge') { if (dr.moved) { cleanupRegion(b.regions[ui.selRegion]); commit(); } return; }
  if (dr.kind === 'rect') {
    const d = snapDot(b, evtGrid(e, b), e.shiftKey);
    if (!samePt(d, dr.start)) addRect(dr.start, d);
    // otherwise keep the first corner and wait for a second click
  }
}
function edDbl(e) {
  const b = activeBlock(); if (!b) return;
  if (ui.tool === 'polygon' && ui.drawing.length >= 3) { finishPolygon(); return; }
  const eh = e.target.closest('[data-eh]');
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
  if (e.key === 'Escape') { ui.drawing = []; ui.selRegion = null; ed.triPreview = null; refreshEditor(); renderInspector(); return; }
  if (e.key === 'Enter' && ui.tool === 'polygon') { e.preventDefault(); finishPolygon(); return; }
  if (e.key === 'Backspace' && ui.drawing.length) { e.preventDefault(); ui.drawing.pop(); refreshEditor(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selRegion != null && b.regions[ui.selRegion]) { e.preventDefault(); Actions.regionDelete(); return; }
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
Actions.selectRegion = i => { ui.selRegion = +i; if (ui.tool !== 'select') ui.tool = 'select'; saveUi(); renderView(); };
Actions.regionFab = id => { const r = selRegion(); if (r) { r.fab = id; commit(); } };
Actions.regionApp = v => { const r = selRegion(); if (r) { r.app = !!v || undefined; if (!r.app) delete r.app; commit(); } };
Actions.regionDelete = () => { const b = activeBlock(); if (ui.selRegion == null) return; b.regions.splice(ui.selRegion, 1); ui.selRegion = null; commit(); };
Actions.regionOrder = dir => {
  const b = activeBlock(), i = ui.selRegion; if (i == null) return;
  const j = dir === 'front' ? b.regions.length - 1 : dir === 'back' ? 0 : dir === 'up' ? Math.min(i + 1, b.regions.length - 1) : Math.max(i - 1, 0);
  const [r] = b.regions.splice(i, 1); b.regions.splice(j, 0, r); ui.selRegion = j; commit();
};
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

  const r = selRegion();
  if (r) {
    const i = ui.selRegion;
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
    list += `<div class="region-row" aria-pressed="${ui.selRegion === i}" data-act="selectRegion" data-arg="${i}">${reg.fab === BG ? '<span class="sw" style="background:repeating-linear-gradient(45deg,#faf7f1,#faf7f1 3px,#e9e1d2 3px,#e9e1d2 6px)"></span>' : swatchHtml(reg.fab, 16)}<span class="nm">${reg.pts.length === 2 ? 'Ellipse' : reg.pts.length === 3 ? 'Triangle' : reg.pts.length === 4 ? 'Quad' : reg.pts.length + '-sided'} · ${esc(reg.fab === BG ? 'Quilt background' : fabricLabel(reg.fab))}${reg.app ? ' · appliqué' : ''}${reg.b?.some(x => x) ? ' · curved' : ''}</span></div>`;
  }
  h += section(`Shapes (${b.regions.length})`, list ? `<p class="hint" style="margin-top:0">Top of the list is in front.</p>${list}` : '<p class="hint">No shapes yet — the whole block is quilt background. Use the tools above the canvas to draw.</p>', { key: 'shapes' });
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
