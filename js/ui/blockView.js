/* Block editor view. Drawn blocks (square, or hexagon for hexagon tessellations): paint /
   select / polygon / rectangle / triangle / seam / text tools on a square or triangular
   lattice, with an optional tracing picture. Compound blocks: pick slots and fill them from
   the Blocks panel. */

const BLOCK_TOOLS = [
  { key: 'paint', label: 'Paint', kb: 'V', icon: 'paint' },
  { key: 'fill', label: 'Fill', kb: 'F', icon: 'fill' },
  { key: 'select', label: 'Select', kb: 'S', icon: 'select' },
  { key: 'erase', label: 'Eraser', kb: 'E', icon: 'erase' },
  { key: 'polygon', label: 'Shape', kb: 'P', icon: 'shape' },
  { key: 'rect', label: 'Rectangle', kb: 'R', icon: 'rect' },
  { key: 'tri', label: 'Triangle', kb: 'T', icon: 'tri' },
  { key: 'arc', label: 'Quarter circle', kb: 'C', icon: 'arc' },
  { key: 'seam', label: 'Seam line', kb: 'K', icon: 'seam' },
  { key: 'text', label: 'Text', kb: 'L', icon: 'text' },
];

const ed = { drag: null, hover: null, shift: false };

Views.block = {
  // the tool strip (drawn blocks only)
  tools() {
    const b = activeBlock();
    if (!b || b.kind === 'compound') return null;
    return { act: 'blockTool', active: ui.tool, list: [...BLOCK_TOOLS.map(t => ({ ...t, badge: t.key === 'seam' ? seamBadge(b) : '' })), { sep: true }, ...NAV_TOOLS] };
  },
  docs() { const b = activeBlock(); return [{ label: b ? b.name : 'No block open', on: true, icon: 'blocks' }]; },
  // the context bar: a mode bar while drawing, otherwise the tool's options or the selection's commands
  options() {
    const b = activeBlock();
    if (!b) return '<span class="tb-label">Add a block from the Blocks panel to start.</span>';
    if (b.kind === 'compound') return `<span class="tb-label"><b>${esc(b.name)}</b> · combination block</span>`;
    if (ui.tool === 'polygon' && ui.drawing.length) return `<span class="mode-tag">Drawing a shape</span><span class="tb-label">${plural(ui.drawing.length, 'point')} · click the first point or press Enter to finish</span><button class="btn small primary" data-act="polyDone" ${ui.drawing.length < 3 ? 'disabled' : ''}>Done</button><button class="btn small" data-act="polyCancel">Cancel</button>`;
    if (ui.tool === 'seam' && ui.drawing.length) return `<span class="mode-tag">Seam line</span><span class="tb-label">Now click a point on another line</span><button class="btn small" data-act="polyCancel">Cancel</button>`;
    if (ui.refAdjust && refImgs[b.id]) return `<span class="mode-tag">Moving the tracing picture</span><span class="tb-label">Drag to move it, scroll to resize it</span><button class="btn small primary" data-act="refAdjustToggle">Done</button>`;
    // options for the current tool, or for the selection
    const sel = selList(), fabBtn = (act, f, mixed) => `<button class="tool fab-drop" data-act="${act}" aria-haspopup="menu" title="Fabric">${f ? swatchHtml(f === BG ? doc.layout.background : f, 16) : '<span class="sw mixed"></span>'} ${mixed ? 'Mixed' : esc(f === BG ? 'Background' : fabricLabel(f))} ${icon('down', 12)}</button>`;
    let opts = '';
    if (ui.tool === 'select' && sel.length) {
      const fs = uniq(sel.map(i => b.regions[i].fab));
      const ib = (act, arg, ic, label) => `<button class="tool icon-only" data-act="${act}" ${arg ? `data-arg="${arg}"` : ''} title="${label}" aria-label="${label}">${icon(ic)}</button>`;
      opts = `<span class="tb-label">${plural(sel.length, 'shape')}</span>${fabBtn('selFabricMenu', fs.length === 1 ? fs[0] : null, fs.length > 1)}
        ${ib('selDup', '', 'dup', 'Duplicate (Ctrl+D)')}${ib('selRotate', 'cw', 'rotate', 'Rotate 90° (E)')}${ib('selMirror', 'h', 'mirror', 'Flip horizontal (X)')}${ib('selMirror', 'v', 'flipv', 'Flip vertical (Y)')}${ib('selOrder', 'front', 'front', 'Bring to front')}${ib('selOrder', 'back', 'back', 'Send to back')}${ib('selDelete', '', 'trash', 'Delete (Del)')}`;
    } else if (ui.tool === 'select') opts = `<button class="tool small" data-act="selAll" title="Select all (Ctrl+A)">Select all</button>`;
    // controls only; the status bar says how to use the tool
    else if (ui.tool === 'text') { const o = textOpts(); opts = `${fabBtn('paintFabricMenu', ui.fabric)}<select class="tb-in" data-change="textFont" aria-label="Font" title="Font">${fontOptions(o.font)}</select><label class="tb-label">Height<input class="tb-in narrow" type="text" inputmode="decimal" value="${esc(inputLen(o.h))}" data-change="textH" aria-label="Capital height"></label>`; }
    else if (ui.tool === 'hand' || ui.tool === 'zoom') opts = `<button class="tool small" data-act="edZoomBy" data-arg="fit" title="Fit (0)">Fit</button><button class="tool small" data-act="zoomActual" title="Actual size (Shift+0)">100%</button>`;
    else if (ui.tool === 'erase') opts = '';
    else if (ui.tool === 'paint' || ui.tool === 'fill') opts = `<span class="tb-label">${ui.tool === 'fill' ? 'Fill with' : 'Paint with'}</span>${fabBtn('paintFabricMenu', ui.fabric)}`;
    else opts = `${ui.tool !== 'seam' ? fabBtn('paintFabricMenu', ui.fabric) : ''}<button class="tool toggle" data-act="toggleSnap" aria-pressed="${!ui.snapOff}" title="Snap points to the grid">Snap</button>`;
    const tl = [...BLOCK_TOOLS, ...NAV_TOOLS].find(t => t.key === ui.tool);
    return `${tl ? `<span class="tool-chip">${icon(tl.icon, 16)}${tl.label}</span>` : ''}${opts}
      ${refImgs[b.id] ? `<span class="sep"></span><button class="tool toggle" data-act="refAdjustToggle" aria-pressed="${!!ui.refAdjust}" title="Drag to move the tracing picture, scroll to resize it">Move picture</button>` : ''}
      <span id="seam-tool-slot"></span>`;
  },
  main() {
    const b = activeBlock();
    if (!b) return `<div class="stage"><div class="canvas-wrap"><div class="empty-state big"><h2>Start with a block</h2><p>Draw on a grid, or start from a classic.</p><div class="btn-row" style="justify-content:center"><button class="btn primary" data-act="libraryPicker">Browse classic blocks</button><button class="btn" data-act="newBlock">Draw a block</button></div></div></div></div>`;
    const S = b.kind === 'drawn' ? blockFrameSize(b) : doc.layout.blockSize, m = S * 0.07;   // margin doubles as room to start a box-select
    if (b.kind === 'compound') {
      return `<div class="stage"><div class="canvas-wrap"><svg id="editor" class="editor" viewBox="${-m} ${-m} ${S + 2 * m} ${S + 2 * m}">${blockSvg(b, S, S, { slots: true, activeSlot: ui.activeSlot, pieces: ui.showPieces })}</svg></div>
        <div class="status-bar">${ui.activeSlot != null ? `Pick a block in the Blocks panel for slot ${ui.activeSlot + 1}.` : 'Click a slot, then pick a block for it.'}</div></div>`;
    }
    return `<div class="stage"><div class="canvas-wrap"><svg id="editor" class="editor tool-${ui.refAdjust && refImgs[b.id] ? 'ref' : ui.tool}" viewBox="${edViewBox(S).map(v => round(v, 4)).join(' ')}" aria-label="Block editor"><g ${edTurn(b, S)}><g id="ed-c">${editorShapes(b)}</g></g><g id="ed-ref" pointer-events="none">${refImageSvg(b, S)}</g><g ${edTurn(b, S)}><g id="ed-g">${editorGuides(b)}</g><g id="ed-ov" pointer-events="none"></g></g></svg>
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
    svg.addEventListener('pointerleave', () => { ed.hover = null; ed.eraseHover = null; ed.fillHover = null; if (!ed.drag) ed.triPreview = null; drawOverlay(); });
    svg.addEventListener('dblclick', edDbl);
    svg.addEventListener('contextmenu', edContext);
    svg.addEventListener('wheel', edWheel, { passive: false });
    // a fabric swatch dropped on a piece paints it
    svg.addEventListener('dragover', e => { if (dragFabricId) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    svg.addEventListener('drop', e => { if (dragFabricId) { e.preventDefault(); dropFabric(e, dragFabricId); } });
    svg.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });   // no autoscroll on middle-drag
    if (ui.tool === 'text') ensureFont();
    scheduleSeamCheck();
    positionSelBar();
  },
  props() { return blockInspector(); },
  inspector() { return blockInspector(); },
  key(e) { return blockViewKey(e); },
};

/* ---------- geometry helpers (grid units) ---------- */
function gridScale(b) { return blockFrameSize(b) / b.n; }
function latticeDots(b, fine) {
  const n = b.n, out = [];
  if (isHexBlock(b)) {
    // rows of the 60° lattice inside the hexagon; Shift halves the step
    const st = fine ? 0.5 : 1, rows = Math.round(n / st), y0 = hexFrame(n)[1][1];
    for (let k = 0; k <= rows; k++) {
      const xl = Math.abs(k - rows / 2) * st / 2, y = round(y0 + k * TRI_H * st, 6);
      for (let x = xl; x <= n - xl + 1e-9; x += st) out.push([round(x, 6), y]);
    }
    return out;
  }
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
  if (ui.snapOff) {
    // free placement: only nearby corners (other shapes', the block outline's) pull the point in
    bd = (b.n * 0.02) ** 2;
    for (const d of blockOutline(b, b.n)) consider(d);
    b.regions.forEach((r, i) => { if (i !== skip) for (const q of r.pts) consider(q); });
    return best ? [best[0], best[1]] : [round(clamp(p[0], 0, b.n), 4), round(clamp(p[1], 0, b.n), 4)];
  }
  for (const d of latticeDots(b, fine)) consider(d);
  b.regions.forEach((r, i) => { if (i !== skip) for (const q of r.pts) consider(q); });
  return best ? [best[0], best[1]] : best;
}
const samePt = (a, b) => a && b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
// Seam lines run from line to line: each end lands on a piece's edge, the block's edge or another
// seam. The lines a seam can start or end on (grid units):
function seamTargets(b) {
  const lines = [];
  const ring = pts => pts.forEach((a, i) => lines.push([a, pts[(i + 1) % pts.length]]));
  ring(blockOutline(b, b.n));
  for (const r of b.regions) ring(r.b?.some(x => x) ? regionRing(r, 1, 1) : r.pts);   // appliqué and lettering too
  for (const s of [...(b.seams || []), ...(b.appSeams || [])]) lines.push(s);
  return lines;
}
// Which parts a new seam cuts: through appliqué it cuts the appliqué; elsewhere the pieces.
function seamKinds(b, a, d) {
  const app = b.regions.filter(r => r.app).map(r => r.b?.some(x => x) ? regionRing(r, 1, 1) : r.pts);
  let inApp = false, outside = false;
  for (let i = 1; i < 20; i++) {
    const q = [a[0] + (d[0] - a[0]) * i / 20, a[1] + (d[1] - a[1]) * i / 20];
    if (app.some(p => pointInPoly(q, p))) inApp = true; else outside = true;
  }
  return { inApp, outside };
}
// The point on a line nearest the pointer (preferring grid points on it), or null when no line is close.
function seamSnap(b, p, fine) {
  const pxPerUnit = ($('#ed-c')?.getScreenCTM()?.a || 40) * gridScale(b), tol = 14 / pxPerUnit;
  const lines = seamTargets(b);
  const near = (q, [A, B]) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1e-12;
    const t = clamp(((q[0] - A[0]) * dx + (q[1] - A[1]) * dy) / L2, 0, 1), x = A[0] + t * dx, y = A[1] + t * dy;
    return { pt: [x, y], d: Math.hypot(q[0] - x, q[1] - y) };
  };
  // grid points and corners that sit on a line
  let best = null, bd = tol;
  const cands = [...latticeDots(b, fine), ...b.regions.filter(r => !r.app).flatMap(r => r.pts)];
  for (const c of [...cands, ...b.regions.filter(r => r.app).flatMap(r => r.pts)]) {
    const dp = Math.hypot(c[0] - p[0], c[1] - p[1]);
    if (dp < bd && lines.some(l => near(c, l).d < 1e-4)) { bd = dp; best = [c[0], c[1]]; }
  }
  if (best) return best;
  // otherwise anywhere along the nearest line; from the seam's first end, an almost straight or
  // 45° seam is made exactly so
  let line = null;
  for (const l of lines) { const n = near(p, l); if (n.d < bd) { bd = n.d; best = n.pt; line = l; } }
  const from = ui.drawing[0];
  if (best && from) {
    const ang = Math.atan2(best[1] - from[1], best[0] - from[0]), snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    if (Math.abs(ang - snap) < 8 * Math.PI / 180) {
      const [A, B] = line, ux = Math.cos(snap), uy = Math.sin(snap), ex = B[0] - A[0], ey = B[1] - A[1];
      const den = ux * ey - uy * ex;
      if (Math.abs(den) > 1e-9) {
        const t = ((A[0] - from[0]) * ey - (A[1] - from[1]) * ex) / den, u = ((A[0] - from[0]) * uy - (A[1] - from[1]) * ux) / den;
        if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = [from[0] + t * ux, from[1] + t * uy];
      }
    }
  }
  return best && best.map(v => round(v, 4));
}
function evtGrid(e, b) { const [x, y] = svgPoint($('#ed-c'), e); const k = gridScale(b); return [x / k, y / k]; }
// The tracing picture isn't turned with the block, so it moves in screen-aligned (view) units.
function evtView(e, b) { const [x, y] = svgPoint($('#editor'), e); const k = gridScale(b); return [x / k, y / k]; }
// The editor shows hexagon blocks the way they sit in the quilt (the tracing picture stays upright).
const edAngle = hexViewAngle;
function edTurn(b, S) { const a = edAngle(b); return a ? `transform="rotate(${a} ${S / 2} ${S / 2})"` : ''; }

/* ---------- rendering ---------- */
// Block shapes (plus the area outside a hexagon greyed out).
function editorShapes(b) {
  const S = blockFrameSize(b), u = S / edZoom(), hair = u * 0.003;
  let s = blockSvg(b, S, S, { ids: true });
  if (isHexBlock(b)) {
    const hx = blockOutline(b, S);
    s += `<path d="M${-S},${-S}H${2 * S}V${2 * S}H${-S}Z${polyToPath(hx)}" fill="rgba(110,120,135,.16)" fill-rule="evenodd" pointer-events="none"/>
      <path d="${polyToPath(hx)}" fill="none" stroke="#8a95a3" stroke-width="${hair * 1.4}" pointer-events="none"/>`;
  }
  return s;
}
// Tracing picture: drawn over the shapes (see-through) and under the grid and handles.
function refGeom(r, S) {
  const sc = r.sc || 1, ar = r.ar || 1;
  const w = (ar >= 1 ? S : S * ar) * sc, h = (ar >= 1 ? S / ar : S) * sc;
  return { w, h, x: (S - w) / 2 + (r.dx || 0) * S, y: (S - h) / 2 + (r.dy || 0) * S };
}
function refImageSvg(b, S) {
  const r = refImgs[b.id];
  if (!r || r.on === false) return '';
  const g = refGeom(r, S);
  return `<image href="${r.src}" x="${round(g.x, 4)}" y="${round(g.y, 4)}" width="${round(g.w, 4)}" height="${round(g.h, 4)}" opacity="${r.op ?? 0.5}" preserveAspectRatio="none"/>`;
}
function refreshRef() { const b = activeBlock(), g = $('#ed-ref'); if (g && b) g.innerHTML = refImageSvg(b, blockFrameSize(b)); }
// Grid, seam lines, problem highlights, selection and handles.
function editorGuides(b) {
  const S = blockFrameSize(b), k = gridScale(b), u = S / edZoom(), hair = u * 0.003;
  let s = '';
  // grid
  if (b.lattice === 'tri' || isHexBlock(b)) {
    const dots = latticeDots(b);
    for (const [x, y] of dots) s += `<circle class="dot" cx="${x * k}" cy="${y * k}" r="${u * 0.006}" stroke-width="${hair * .6}" opacity=".55"/>`;
  } else {
    for (let i = 0; i <= b.n; i++) {
      s += `<line class="gridline" x1="${i * k}" y1="0" x2="${i * k}" y2="${S}" stroke-width="${hair * (i === 0 || i === b.n ? 1.4 : .8)}"/>`;
      s += `<line class="gridline" x1="0" y1="${i * k}" x2="${S}" y2="${i * k}" stroke-width="${hair * (i === 0 || i === b.n ? 1.4 : .8)}"/>`;
    }
  }
  // centre lines: straight across and down the middle as you see the block (a pointy-top hexagon is
  // drawn turned, so the lines are turned back to stay upright)
  if (ui.showCentre) {
    const c = S / 2, ink = 'stroke="#d6336c" stroke-linecap="round" pointer-events="none"', back = edAngle(b);
    const hexClip = isHexBlock(b) ? `<clipPath id="ed-hexclip"><path d="${polyToPath(blockOutline(b, S))}"/></clipPath>` : '';
    s += `${hexClip}${hexClip ? '<g clip-path="url(#ed-hexclip)">' : ''}${back ? `<g transform="rotate(${-back} ${c} ${c})">` : ''}<line x1="${c}" y1="0" x2="${c}" y2="${S}" ${ink} stroke-width="${hair * 1.8}" stroke-dasharray="${hair * 10} ${hair * 4}"/>
      <line x1="0" y1="${c}" x2="${S}" y2="${c}" ${ink} stroke-width="${hair * 1.8}" stroke-dasharray="${hair * 10} ${hair * 4}"/>
      <circle cx="${c}" cy="${c}" r="${u * 0.012}" fill="#d6336c" pointer-events="none"/>${back ? '</g>' : ''}${hexClip ? '</g>' : ''}`;
  }
  // seams (always shown while the seam tool is active, so they can be clicked to remove)
  if (ui.showSeamLines !== false || ui.tool === 'seam' || ui.tool === 'erase') [['s', b.seams], ['a', b.appSeams]].forEach(([tag, list]) => (list || []).forEach(([A, B], i) => {
    s += `<line class="seam-line" x1="${A[0] * k}" y1="${A[1] * k}" x2="${B[0] * k}" y2="${B[1] * k}" stroke-width="${hair * 1.6}"/>`;
    if (ui.tool === 'seam' || ui.tool === 'erase') s += `<line data-seam="${tag}:${i}" x1="${A[0] * k}" y1="${A[1] * k}" x2="${B[0] * k}" y2="${B[1] * k}" stroke="transparent" stroke-width="${u * 0.025}" style="cursor:pointer"/>`;
  }));
  if (ui.showPieces) {
    for (const p of blockPieces(b, S, S)) s += `<path d="${polyToPath(p.pts)}" fill="none" stroke="rgba(20,30,40,.75)" stroke-width="${hair * 1.4}" stroke-dasharray="${hair * 5} ${hair * 3}" pointer-events="none"/>`;
  }
  // problem pieces are shown only with the Seam tool, so a block in progress isn't covered in red
  if (ui.tool === 'seam') for (const pr of pieceProblems(b, S)) if (pr.kind !== 'tiny') s += `<path class="problem" d="${polyToPath(pr.piece.pts)}${pr.piece.holes.map(h => polyToPath(h)).join('')}" fill-rule="evenodd" stroke-width="${hair * 1.5}"/>`;
  // selection: outline every selected shape; corner/edge handles when exactly one is selected
  const sel = selList();
  if (ui.tool === 'select') for (const i of sel) s += `<path class="sel-halo" d="${regionPathD(b.regions[i], k)}" stroke-width="${hair * 6}"/><path class="sel-outline" d="${regionPathD(b.regions[i], k)}" stroke-width="${hair * 3}"/>`;
  const r = sel.length === 1 ? b.regions[sel[0]] : null;
  if (r && ui.tool === 'select') {
    r.pts.forEach((q, i) => {
      const nb = r.pts[(i + 1) % r.pts.length];
      const bl = r.b?.[i] || 0;
      const mid = bl ? arcInfo([q[0] * k, q[1] * k], [nb[0] * k, nb[1] * k], bl).apex : [(q[0] + nb[0]) / 2 * k, (q[1] + nb[1]) / 2 * k];
      s += `<rect class="eh${bl ? ' curved' : ''}" data-eh="${i}" x="${mid[0] - u * .011}" y="${mid[1] - u * .011}" width="${u * .022}" height="${u * .022}" rx="${u * .004}" stroke-width="${hair}"><title>Drag to curve this edge · double-click to straighten · Alt-click to add a corner here</title></rect>`;
    });
    r.pts.forEach((q, i) => { s += `<circle class="vh" data-vh="${i}" cx="${q[0] * k}" cy="${q[1] * k}" r="${u * .014}" stroke-width="${hair * 1.2}"><title>Drag to move this corner · double-click to remove it</title></circle>`; });
  }
  return s;
}
function drawOverlay() {
  const ov = $('#ed-ov'), b = activeBlock();
  if (!ov || !b || b.kind !== 'drawn') return;
  const S = blockFrameSize(b), k = gridScale(b), u = S / edZoom(), hair = u * 0.003;
  let s = '';
  if (ui.tool === 'fill' && ed.fillHover) s += `<path d="${[ed.fillHover.pts, ...ed.fillHover.holes].map(r => polyToPath(r.map(([x, y]) => [x * k, y * k]))).join('')}" fill-rule="evenodd" fill="${fabricFill(resolveFab(ui.fabric))}" fill-opacity=".7" stroke="#c98a1f" stroke-width="${hair * 2}" pointer-events="none"/>`;
  // the eraser shows what it would remove (a whole word for lettering)
  const eh = ui.tool === 'erase' && ed.eraseHover != null ? b.regions[ed.eraseHover] : null;
  if (eh) for (const r of eh.txt ? b.regions.filter(x => x.txt === eh.txt) : [eh]) s += `<path class="erase-hover" d="${regionPathD(r, k)}" stroke-width="${hair * 2.5}" stroke-dasharray="${hair * 6} ${hair * 4}"/>`;
  const dr = ui.drawing;
  const h = ed.hover;
  if (ui.tool === 'polygon' && dr.length) {
    const pts = [...dr, ...(h ? [h] : [])].map(([x, y]) => `${x * k},${y * k}`).join(' ');
    s += `<polyline points="${pts}" fill="rgba(242,177,52,.25)" stroke="#c98a1f" stroke-width="${hair * 2.2}" stroke-dasharray="${hair * 5} ${hair * 3}"/>`;
    dr.forEach((q, i) => s += `<circle cx="${q[0] * k}" cy="${q[1] * k}" r="${u * (i === 0 && dr.length >= 3 ? .018 : .011)}" fill="${i === 0 ? '#f2b134' : '#fff'}" stroke="#1f3a5f" stroke-width="${hair}"/>`);
  }
  if (ui.tool === 'rect' && dr.length === 1 && h) {
    const [a, c] = [dr[0], h];
    s += `<rect x="${Math.min(a[0], c[0]) * k}" y="${Math.min(a[1], c[1]) * k}" width="${Math.abs(c[0] - a[0]) * k}" height="${Math.abs(c[1] - a[1]) * k}" fill="${fabricFill(ui.fabric)}" fill-opacity=".75" stroke="#c98a1f" stroke-width="${hair * 2}"/>`;
  }
  // the seam follows the pointer: red where it would land on a line, grey where it can't end
  if (ui.tool === 'seam' && dr.length === 1 && (h || ed.cursor)) {
    const e2 = h || ed.cursor;
    s += `<line x1="${dr[0][0] * k}" y1="${dr[0][1] * k}" x2="${e2[0] * k}" y2="${e2[1] * k}" stroke="${h ? '#b5482f' : '#8a94a0'}" stroke-width="${hair * 2}" stroke-dasharray="${hair * 4} ${hair * 2}"/>`;
  }
  if (ui.tool === 'tri' && ed.triPreview) s += `<path d="${polyToPath(ed.triPreview.map(([x, y]) => [x * k, y * k]))}" fill="${fabricFill(ui.fabric)}" fill-opacity=".75" stroke="#c98a1f" stroke-width="${hair * 2}"/>`;
  if (ui.tool === 'arc' && ed.triPreview?.pts) s += `<path d="${regionPathD(ed.triPreview, k)}" fill="${fabricFill(ui.fabric)}" fill-opacity=".75" stroke="#c98a1f" stroke-width="${hair * 2}"/>`;
  if (ui.tool === 'text' && h) {
    const t = textAtOrigin(b);
    if (t) for (const r of t.regions) s += `<path d="${polyToPath(r.pts.map(([x, y]) => [(x + h[0]) * k, (y + h[1]) * k]), 4)}" fill="${fabricFill(textFabric())}" fill-opacity=".75" stroke="#c98a1f" stroke-width="${hair}"/>`;
  }
  if (h && ['polygon', 'rect', 'seam'].includes(ui.tool)) s += `<circle cx="${h[0] * k}" cy="${h[1] * k}" r="${u * .016}" fill="#f2b134" stroke="#1f3a5f" stroke-width="${hair}"/>`;
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
  const fab = ui.fabric === BG ? 'background' : esc(fabricLabel(ui.fabric));
  switch (ui.tool) {
    case 'paint': return `<b>Paint</b> with ${fab}: click or drag across pieces. Alt-click picks up a fabric.`;
    case 'select': {
      const n = selList().length;
      if (!n) return '<b>Select</b>: click a shape. Shift-click or drag a box for more.';
      return `<b>${plural(n, 'shape')}</b>: drag to move, arrows to nudge, Delete to remove.${n === 1 ? ' Drag the white corners to reshape.' : ''}`;
    }
    case 'polygon': return ui.drawing.length ? `<b>${ui.drawing.length} points</b>: click the first point or press Enter to finish. Esc cancels.` : '<b>Shape</b>: click grid points. Shift for half steps.';
    case 'rect': return '<b>Rectangle</b>: drag from corner to corner.';
    case 'text': return loadedFont(textOpts().font) ? '<b>Text</b>: click where the words go, then type them in Properties.' : 'Loading the font…';
    case 'arc': return isHexBlock(b) || b.lattice === 'tri' ? 'Quarter circles need a square grid.' : '<b>Quarter circle</b>: click a square, or drag from a corner for a bigger one.';
    case 'tri': return b.lattice === 'tri' || isHexBlock(b) ? '<b>Triangle</b>: click inside a lattice triangle. Shift for half size.' : '<b>Triangle</b>: click near a corner of a square. Shift for half size.';
    case 'fill': return `<b>Fill</b> with ${fab}: click empty space to fill it with a new shape, or a shape to repaint it.`;
    case 'hand': return `<b>Hand</b>: drag to move around the block when zoomed in.`;
    case 'zoom': return `<b>Zoom</b>: click to zoom in, Alt-click to zoom out. 0 fits the block.`;
    case 'erase': return '<b>Eraser</b>: click a shape or seam line to remove it, or drag across several.';
    case 'seam': return ui.drawing.length ? 'Now click a point on another line. Esc cancels.' : '<b>Seam line</b>: click a point on any edge, then on another. Through appliqué or lettering it cuts them too. Click a seam to remove it.';
  }
  return '';
}
function refreshEditor(statusToo = true) {
  const b = activeBlock();
  const c = $('#ed-c'), g = $('#ed-g');
  if (c && b) c.innerHTML = editorShapes(b);
  if (g && b) g.innerHTML = editorGuides(b);
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
  if (typeof renderHud === 'function') queueMicrotask(renderHud);
}
function selBounds(b, list = selList()) {
  return bounds(list.flatMap(i => b.regions[i].pts));
}
// Small toolbar floating just above the selection.
// The selection's options sit in the tool row; refresh it when the selection changes.
function positionSelBar() {
  if (ui.view === 'block' && !ed.drag) renderToolbar();
}

/* ---------- pointer interaction ---------- */
function regionAtEvent(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-region]');
  return el ? +el.dataset.region : null;
}
// What the Fill tool would fill at grid point p: empty space (the background showing between
// shapes, bounded by the block edge, shapes and seam lines) or an existing shape.
function fillTarget(b, p) {
  if (b.kind !== 'drawn') return null;
  const inside = q => pointInPoly(p, q.pts) && !q.holes.some(h => pointInPoly(p, h));
  const app = blockPieces(b, b.n, b.n).find(q => q.app && inside(q));
  if (app) return { kind: 'shape' };
  const piece = blockPieces(b, b.n, b.n).find(q => !q.app && inside(q));
  if (!piece) return null;
  const covered = b.regions.some(r => !r.app && r.pts.length > 2 && pointInPoly(p, regionRing(r, 1, 1, new Set())));
  return covered ? { kind: 'shape' } : { kind: 'empty', pts: cleanPoly(piece.pts.map(q => [round(q[0], 4), round(q[1], 4)])), holes: piece.holes };
}
function removeSeam(b, ref) {
  const [list, i] = ref.split(':'), arr = list === 'a' ? b.appSeams : b.seams, [A, B] = arr[+i];
  arr.splice(+i, 1);
  // a seam through appliqué is stored in both lists
  const other = list === 'a' ? b.seams : b.appSeams, j = (other || []).findIndex(([P, Q]) => samePt(P, A) && samePt(Q, B));
  if (j >= 0) other.splice(j, 1);
}
// The eraser removes the seam line or shape under the pointer; lettering goes as a whole word.
function eraseAt(e, b) {
  const el = document.elementFromPoint(e.clientX, e.clientY), sl = el?.closest?.('[data-seam]');
  if (sl) { removeSeam(b, sl.dataset.seam); ed.drag.changed = true; refreshEditor(false); return; }
  const ri = regionAtEvent(e);
  if (ri == null) return;
  const tid = b.regions[ri].txt;
  if (tid) { b.regions = b.regions.filter(r => r.txt !== tid); if (b.texts) delete b.texts[tid]; }
  else b.regions.splice(ri, 1);
  ed.eraseHover = null; setSel([]); ed.drag.changed = true; refreshEditor(false);
}
function edDown(e) {
  const b = activeBlock(); if (!b) return;
  const svg = e.currentTarget;
  const p = evtGrid(e, b), fine = e.shiftKey;
  const tool = ui.tool;
  if (ui.tool === 'zoom' && e.button === 0) { setZoom(edZoom() * (e.altKey ? 1 / 1.5 : 1.5), svgPoint(svg, e)); return; }
  if (e.button === 1 || ((ed.space || ui.tool === 'hand') && e.button === 0)) {
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    ed.drag = { kind: 'pan', x: e.clientX, y: e.clientY, cx: ed.cx, cy: ed.cy, px: 1 / svg.getScreenCTM().a };
    return;
  }
  if (ui.refAdjust && refImgs[b.id] && e.button === 0) {
    const r = refImgs[b.id];
    svg.setPointerCapture(e.pointerId);
    ed.drag = { kind: 'ref', start: evtView(e, b), dx: r.dx || 0, dy: r.dy || 0 };
    return;
  }
  if (tool === 'text') { if (e.button === 0) placeText(b, ui.snapOff ? p : snapDot(b, p, fine)); return; }
  if (tool === 'fill') {
    if (e.button !== 0) return;
    const t = fillTarget(b, p);
    if (t?.kind === 'empty') {
      if (resolveFab(ui.fabric) === doc.layout.background || ui.fabric === BG) { toast('That space already shows the background. Pick another fabric to fill it.', 2200); return; }
      // under everything, so shapes inside it (and lettering on top) stay in front
      b.regions.unshift({ pts: t.pts, fab: ui.fabric });
      ed.fillHover = null; setSel([]); commit();
    } else if (t) { ed.drag = { kind: 'paint', changed: false }; paintAt(e, b); const ch = ed.drag.changed; ed.drag = null; if (ch) commit(); }
    return;
  }
  if (tool === 'erase') {
    if (e.button !== 0) return;
    svg.setPointerCapture(e.pointerId);
    ed.drag = { kind: 'erase', changed: false };
    eraseAt(e, b);
    return;
  }
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
    const fresh = !selList().includes(ri);
    if (fresh) { setSel(textGroup(b, ri)); renderInspector(); }
    svg.setPointerCapture(e.pointerId);
    ed.drag = { kind: 'move', start: p, ri, fresh, orig: new Map(selList().map(i => [i, b.regions[i].pts.map(q => q.slice())])), moved: false };
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
  if (tool === 'arc' && !isHexBlock(b) && b.lattice !== 'tri') {
    // click: a quarter circle filling one grid square; drag from a corner: any radius
    svg.setPointerCapture(e.pointerId);
    ed.drag = { kind: 'arc', start: snapDot(b, p, fine), p0: p };
    ed.triPreview = pieAt(b, p, fine);
    drawOverlay();
    return;
  }
  if (tool === 'seam') {
    const sl = e.target.closest('[data-seam]');
    if (sl && !ui.drawing.length) { removeSeam(b, sl.dataset.seam); commit(); toast('Seam removed', 1200); return; }
    const d = seamSnap(b, p, fine);
    if (!d) { toast(ui.drawing.length ? 'End the seam on a line or the block edge' : 'Start the seam on a line or the block edge', 1600); return; }
    if (!ui.drawing.length) { ui.drawing = [d]; refreshEditor(); return; }
    const a = ui.drawing[0];
    ui.drawing = [];
    if (samePt(a, d) || seamTargets(b).some(([A, B]) => [a, d].every(q => Math.abs((B[0] - A[0]) * (q[1] - A[1]) - (B[1] - A[1]) * (q[0] - A[0])) < 1e-6 * (1 + dist(A, B))))) { refreshEditor(); return; }   // nothing, or along an existing line
    const { inApp, outside } = seamKinds(b, a, d);
    if (outside || !inApp) b.seams = [...(b.seams || []), [a, d]];
    if (inApp) b.appSeams = [...(b.appSeams || []), [a, d]];
    commit();
  }
}
function edMove(e) {
  const b = activeBlock(); if (!b) return;
  const p = evtGrid(e, b), fine = e.shiftKey;
  const dr = ed.drag;
  if (dr?.kind === 'paint') { paintAt(e, b); return; }
  if (dr?.kind === 'erase') { eraseAt(e, b); return; }
  if (dr?.kind === 'pan') {
    if (edZoom() <= 1) return;
    ed.cx = dr.cx - (e.clientX - dr.x) * dr.px; ed.cy = dr.cy - (e.clientY - dr.y) * dr.px;
    applyView();
    return;
  }
  if (dr?.kind === 'ref') {
    const r = refImgs[b.id]; if (!r) return;
    const p = evtView(e, b);
    r.dx = round(dr.dx + (p[0] - dr.start[0]) / b.n, 4); r.dy = round(dr.dy + (p[1] - dr.start[1]) / b.n, 4);
    refreshRef();
    return;
  }
  if (dr?.kind === 'move') {
    const tri = b.lattice === 'tri' || isHexBlock(b);
    const sx = fine || tri ? 0.5 : 1, sy = tri ? TRI_H : (fine ? 0.5 : 1);
    const free = ui.snapOff;
    const dx = free ? round(p[0] - dr.start[0], 4) : Math.round((p[0] - dr.start[0]) / sx) * sx, dy = free ? round(p[1] - dr.start[1], 4) : Math.round((p[1] - dr.start[1]) / sy) * sy;
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
    if (e.shiftKey) bl = ARC_SNAPS.reduce((a, c) => Math.abs(c - bl) < Math.abs(a - bl) ? c : a);   // Shift: common arcs (and straight)
    else for (const snapTo of [0, QUARTER_BULGE, -QUARTER_BULGE, 1, -1]) if (Math.abs(bl - snapTo) < 0.05) bl = snapTo;
    const st = $('#ed-status');
    if (st) st.innerHTML = `${bl ? `<b>${arcLabel(bl)}</b>` : '<b>Straight</b>'}. Hold Shift to snap to common curves.`;
    if (!r.b) r.b = r.pts.map(() => 0);
    while (r.b.length < r.pts.length) r.b.push(0);
    r.b[dr.i] = round(bl, 4);
    dr.moved = true;
    refreshEditor(false);
    return;
  }
  if (dr?.kind === 'arc') {
    const cur = snapDot(b, p, e.shiftKey);
    ed.triPreview = samePt(cur, dr.start) ? pieAt(b, dr.p0, e.shiftKey) : pieFrom(dr.start, cur);
    drawOverlay();
    return;
  }
  // hover feedback
  if (ui.tool === 'text') { ed.hover = ui.snapOff ? p : snapDot(b, p, fine); drawOverlay(); return; }
  if (['polygon', 'rect', 'seam'].includes(ui.tool)) {
    const d = ui.tool === 'seam' ? seamSnap(b, p, fine) : snapDot(b, p, fine);
    if (ui.tool === 'seam' && ui.drawing.length) { ed.hover = d; ed.cursor = p; drawOverlay(); return; }
    if (!samePt(d, ed.hover)) { ed.hover = d; drawOverlay(); }
  } else if (ui.tool === 'tri') {
    ed.triPreview = triangleAt(b, p, fine);
    drawOverlay();
  } else if (ui.tool === 'arc') {
    ed.triPreview = pieAt(b, p, fine);
    drawOverlay();
  } else if (ui.tool === 'fill') {
    const t = fillTarget(b, p), hv = t?.kind === 'empty' ? t : null;
    if (hv?.pts.join() !== ed.fillHover?.pts.join()) { ed.fillHover = hv; drawOverlay(); }
  } else if (ui.tool === 'erase') {
    const ri = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-seam]') ? null : regionAtEvent(e);
    if (ri !== ed.eraseHover) { ed.eraseHover = ri; drawOverlay(); }
  }
}
function edUp(e) {
  const b = activeBlock(); const dr = ed.drag; ed.drag = null;
  if (!b || !dr) return;
  if (dr.kind === 'paint' || dr.kind === 'erase') { if (dr.changed) commit(); return; }
  if (dr.kind === 'ref') { saveRefsSoon(); return; }
  if (dr.kind === 'pan') return;
  if (dr.kind === 'vertex' || dr.kind === 'edge') { if (dr.moved) { cleanupRegion(b.regions[ui.selRegion]); commit(); } else { positionSelBar(); refreshEditor(); } return; }
  if (dr.kind === 'move') {
    if (dr.moved) { commit(); return; }
    // a plain click on one shape of a multi-selection narrows the selection to it
    // (the first click on a placed word selects the whole word; a second picks one letter)
    if (selList().length > 1 && !dr.fresh) { setSel([dr.ri]); refreshEditor(); renderInspector(); return; }
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
  if (dr.kind === 'arc') {
    const pie = ed.triPreview;
    if (pie?.pts) { b.regions.push({ pts: pie.pts, fab: ui.fabric, b: pie.b }); commit(); }
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
function dropFabric(e, fab) {
  const b = activeBlock(); if (b?.kind !== 'drawn') return;
  const prev = ui.fabric;
  ui.fabric = fab; ed.drag = { kind: 'paint', changed: false };
  try { paintAt(e, b); } finally { ui.fabric = prev; }
  const changed = ed.drag.changed; ed.drag = null;
  if (changed) commit();
}
function paintAt(e, b) {
  const ri = regionAtEvent(e);
  // seam lines split shapes into pieces you can paint one by one
  if ((b.seams || []).length && !(ri != null && b.regions[ri].app) && b.kind === 'drawn') {
    const p = evtGrid(e, b), inPiece = q => !q.app && pointInPoly(p, q.pts) && !q.holes.some(h => pointInPoly(p, h));
    const piece = blockPieces(b, b.n, b.n).find(inPiece), whole = blockPieces({ ...b, seams: [] }, b.n, b.n).find(inPiece);
    if (piece && whole && !piece.holes.length && Math.abs(polyArea(piece.pts) - polyArea(whole.pts)) > 1e-3) {
      if (resolveFab(piece.fab) !== resolveFab(ui.fabric)) {
        b.regions.push({ pts: cleanPoly(piece.pts.map(q => [round(q[0], 4), round(q[1], 4)])), fab: ui.fabric });
        ed.drag.changed = true; refreshEditor(false);
      }
      return;
    }
  }
  if (ri == null) {
    // painting the bare background gives this block its own background fabric
    if (!ed.drag.bgDone && ui.fabric !== BG && (e.type === 'pointerdown' || e.type === 'drop')) {
      b.regions.unshift({ pts: blockOutline(b, b.n), fab: ui.fabric });
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
// A quarter circle ("pie") centred on corner o, radius r, opening toward (sx, sy).
function pieShape(o, sx, sy, r) {
  const A = [round(o[0] + sx * r, 6), o[1]], B = [o[0], round(o[1] + sy * r, 6)];
  const nx = -(B[1] - A[1]), ny = B[0] - A[0], mx = (A[0] + B[0]) / 2 - o[0], my = (A[1] + B[1]) / 2 - o[1];
  return { pts: [o, A, B], b: [0, nx * mx + ny * my > 0 ? QUARTER_BULGE : -QUARTER_BULGE, 0] };
}
// The quarter circle filling the grid square under p, centred on the square's nearest corner.
function pieAt(b, p, fine) {
  if (p[0] < 0 || p[1] < 0 || p[0] > b.n || p[1] > b.n || isHexBlock(b) || b.lattice === 'tri') return null;
  const st = fine ? 0.5 : 1;
  const cx = Math.min(Math.floor(p[0] / st) * st, b.n - st), cy = Math.min(Math.floor(p[1] / st) * st, b.n - st);
  const left = p[0] - cx < st / 2, top = p[1] - cy < st / 2;
  return pieShape([left ? cx : cx + st, top ? cy : cy + st], left ? 1 : -1, top ? 1 : -1, st);
}
// Dragged from a corner: the radius is the longer side of the drag.
function pieFrom(o, cur) {
  const dx = cur[0] - o[0], dy = cur[1] - o[1], r = Math.max(Math.abs(dx), Math.abs(dy));
  return r > 0 ? pieShape(o, dx < 0 ? -1 : 1, dy < 0 ? -1 : 1, r) : null;
}
function triangleAt(b, p, fine) {
  if (p[0] < 0 || p[1] < 0 || p[0] > b.n || p[1] > b.n) return null;
  if (isHexBlock(b)) {
    // strip r lies between dot rows r and r+1; dots in row k start at xl(k)
    const st = fine ? 0.5 : 1, rows = Math.round(b.n / st), hx = hexFrame(b.n), y0 = hx[1][1], th = TRI_H * st;
    const r = Math.floor((p[1] - y0) / th);
    if (r < 0 || r >= rows) return null;
    const xl = k => Math.abs(k - rows / 2) * st / 2;
    const yT = y0 + r * th, yB = y0 + (r + 1) * th;
    for (let i = -1; i <= rows + 1; i++) {
      const xb = xl(r + 1) + i * st, xt = xl(r) + i * st;
      const up = [[xb, yB], [xb + st, yB], [xb + st / 2, yT]];
      const down = [[xt, yT], [xt + st, yT], [xt + st / 2, yB]];
      for (const t of [up, down]) if (pointInPoly(p, t) && pointInPoly(centroid(t), hx)) return t.map(q => [round(q[0], 6), round(q[1], 6)]);
    }
    return null;
  }
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
  if (e.key === 'Escape' && ui.refAdjust) { Actions.refAdjustToggle(); return; }
  if (e.key === 'Escape' && ui.tool === 'text') { Actions.blockTool('select'); return; }
  if (e.key === 'Escape') { ui.drawing = []; setSel([]); ed.triPreview = null; refreshEditor(); renderInspector(); return; }
  if (e.key === 'Enter' && ui.tool === 'polygon') { e.preventDefault(); finishPolygon(); return; }
  if (e.key === 'Backspace' && ui.drawing.length) { e.preventDefault(); ui.drawing.pop(); refreshEditor(); return; }
  if (ctrl && k === 'a') { e.preventDefault(); if (ui.tool !== 'select') ui.tool = 'select'; setSel(b.regions.map((_, i) => i)); renderView(); return; }
  if (ctrl && k === 'c' && sel.length) { e.preventDefault(); Actions.selCopy(); return; }
  if (ctrl && k === 'x' && sel.length) { e.preventDefault(); Actions.selCut(); return; }
  if (ctrl && k === 'v') { e.preventDefault(); Actions.selPaste(); return; }
  if (ctrl && k === 'd' && sel.length) { e.preventDefault(); Actions.selDup(); return; }
  if (ctrl) return;
  if (e.key === '+' || e.key === '=') { Actions.edZoomBy('in'); return; }
  if (e.key === '-' || e.key === '_') { Actions.edZoomBy('out'); return; }
  if (e.key === '0') { Actions.edZoomBy('fit'); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); Actions.selDelete(); return; }
  if (sel.length && e.key.startsWith('Arrow')) {
    e.preventDefault();
    // on a 60° lattice, up/down moves two rows so corners stay on lattice points
    const st = e.shiftKey ? 0.5 : 1, vy = b.lattice === 'tri' || isHexBlock(b) ? 2 * TRI_H : 1;
    const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st * vy], ArrowDown: [0, st * vy] }[e.key];
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
  const tool = [...BLOCK_TOOLS, ...NAV_TOOLS].find(t => t.kb.toLowerCase() === k);
  if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); Actions.blockTool(tool.key); }
}

/* ---------- actions ---------- */
Actions.blockMenu = (a, el) => {
  const b = activeBlock(); if (!b) return;
  openMenu(el, [
    ...(b.kind === 'drawn' ? [{ label: `Turn ${isHexBlock(b) ? 60 : 90}°`, act: 'blockRotate' }, { label: 'Mirror', act: 'blockMirror' }] : []),
    { label: 'Duplicate', act: 'blockDuplicate' },
    { label: 'Export…', act: 'exportBlocks', arg: 'one' },
    '-',
    ...(b.kind === 'drawn' ? [{ label: 'Clear all shapes', act: 'blockClear' }] : []),
    { label: 'Delete block', act: 'blockDelete', danger: true },
  ]);
};
Actions.blockViewMenu = (a, el) => {
  const on = v => v ? icon('check', 14) : '<span class="ic-gap"></span>';
  openMenu(el, [
    { label: `${on(ui.showSeamLines !== false)} Seam lines`, act: 'toggleSeamLines' },
    { label: `${on(!!ui.showPieces)} Cut pieces`, act: 'toggleUi', arg: 'showPieces' },
    { label: `${on(!!ui.showCentre)} Centre lines`, act: 'toggleUi', arg: 'showCentre' },
    { label: `${on(!!ui.grayscale)} Value view`, act: 'toggleUi', arg: 'grayscale', kb: 'G' },
  ]);
};
Actions.blockTool = t => { ui.tool = t; ui.drawing = []; ed.triPreview = null; ed.hover = null; ed.eraseHover = null; ed.fillHover = null; if (t !== 'select') ui.selEdge = null; saveUi(); renderView(); };
Actions.toggleSnap = () => { ui.snapOff = !ui.snapOff; saveUi(); renderView(); announce(ui.snapOff ? 'Snap off' : 'Snap on'); };
// Arc snaps for Shift-dragging an edge: bulge = tan(sweep / 4)
const ARC_SNAPS = [0, 30, 45, 60, 90, 120, 180].flatMap(d => d ? [Math.tan(d * Math.PI / 720), -Math.tan(d * Math.PI / 720)] : [0]);
function arcLabel(bl) {
  const deg = Math.round(4 * Math.atan(Math.abs(bl)) * 180 / Math.PI);
  return `${deg}° arc${deg === 90 ? ' (quarter circle)' : deg === 180 ? ' (half circle)' : ''}`;
}
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
// how many pieces the seam suggestion would change, shown on the Seam tool instead of a popup
function seamBadge(b) {
  const sg = _seamState.block === b.id && _seamState.key === blockKey(b) ? _seamState.s : null;
  const n = sg ? sg.reqPieces + sg.optPieces : 0;
  return n ? `<span class="badge${sg.required.length ? '' : ' soft'}">${n}</span>` : '';
}
function seamDismissed(b) { return (ui.seamDismiss || {})[b.id] === blockKey(b); }
function showSeamCard() {
  const card = $('#seam-card'), slot = $('#seam-tool-slot'), b = activeBlock();
  if (!card || !b) return;
  const sg = _seamState.s;
  const has = sg && (sg.required.length || sg.optional.length), seamTool = ui.tool === 'seam';
  const tb = $('#toolstrip [data-arg="seam"]');
  if (tb) {
    tb.querySelector('.badge')?.remove();
    tb.insertAdjacentHTML('beforeend', seamBadge(b));
    const n = has ? sg.reqPieces + sg.optPieces : 0;
    tb.setAttribute('aria-label', n ? `Seam line, ${plural(n, 'piece')} could use seams` : 'Seam line');
  }
  renderHud();   // the seam warning widget
  if (slot) slot.innerHTML = has && seamTool && seamDismissed(b) ? `<button class="tool" data-act="undismissSeams" title="Show the seam suggestion again">Seam suggestion</button>` : '';
  if (!has || !seamTool || seamDismissed(b)) { card.hidden = true; drawOverlay(); return; }
  const lines = [];
  if (sg.required.length) lines.push(`${plural(sg.reqPieces, 'piece')} need${sg.reqPieces === 1 ? 's' : ''} set-in seams as drawn. ${plural(sg.required.length, 'seam line')} fix${sg.required.length === 1 ? 'es' : ''} that.`);
  if (sg.optional.length) lines.push(`${plural(sg.optPieces, 'piece')} need${sg.optPieces === 1 ? 's' : ''} a template. ${plural(sg.optional.length, 'more seam')} make${sg.optional.length === 1 ? 's' : ''} ${sg.optPieces === 1 ? 'it' : 'them'} rotary-cut.`);
  if (sg.setInAfter) lines.push('Some pieces still meet in a set-in (Y) seam.');
  const total = sg.required.length + sg.optional.length;
  card.innerHTML = `<div class="sc-body"><b>Seam suggestion</b><br>${lines.join('<br>')}
    <div class="btn-row"><button class="btn small" data-act="seamPreview">${ui.seamPreview ? 'Hide preview' : 'Preview'}</button>
    <button class="btn small primary" data-act="applySeams" data-arg="all">Add ${total === 1 ? 'seam' : `${total} seams`}</button>
    ${sg.required.length && sg.optional.length ? '<button class="btn small" data-act="applySeams" data-arg="required">Only the required ones</button>' : ''}
    <button class="btn small quiet" data-act="dismissSeams">Dismiss</button></div></div>`;
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
  const an = analyzeBlock(b, blockFrameSize(b));
  toast(an.setIn ? `Added ${plural(add.length, 'seam')}. Some Y-seams remain.` : `Added ${plural(add.length, 'seam')}`);
};
Actions.autoSeams = () => {
  const sg = seamSuggestions(activeBlock());
  if (!sg.required.length && !sg.optional.length) { toast(sg.unresolved ? 'No straight seams found for those pieces' : 'Every piece is already rotary-cut'); return; }
  Actions.applySeams('all');
};
Actions.clearSeams = () => { const b = activeBlock(); b.seams = []; b.appSeams = []; commit(); };
Actions.blockName = v => { const b = activeBlock(); if (b) { b.name = v.trim() || 'Untitled block'; commit(); } };
Actions.blockGrid = v => {
  const b = activeBlock(); let n = clamp(parseInt(v, 10) || b.n, 1, 48);
  if (isHexBlock(b)) n = Math.max(2, Math.round(n / 2) * 2);   // the hexagon lattice needs an even count
  const k = n / b.n;
  // scale geometry exactly so the design keeps its shape
  for (const r of b.regions) r.pts = r.pts.map(([x, y]) => [round(x * k, 6), round(y * k, 6)]);
  b.seams = (b.seams || []).map(s => s.map(([x, y]) => [round(x * k, 6), round(y * k, 6)]));
  if (b.appSeams) b.appSeams = b.appSeams.map(s => s.map(([x, y]) => [round(x * k, 6), round(y * k, 6)]));
  b.n = n; ui.drawing = [];
  commit();
};
Actions.blockLattice = v => { const b = activeBlock(); b.lattice = v; ui.drawing = []; commit(); };
Actions.blockDuplicate = () => { const b = activeBlock(); const c = cloneBlock(b); c.name = b.name + ' copy'; doc.blocks[c.id] = c; if (refImgs[b.id]) { refImgs[c.id] = { ...refImgs[b.id] }; saveRefs(); } doc.blockOrder.splice(doc.blockOrder.indexOf(b.id) + 1, 0, c.id); ui.activeBlock = c.id; commit(); };
Actions.blockDelete = () => {
  const b = activeBlock(); const n = blockUseCount(b.id);
  confirmModal(`Delete “${esc(b.name)}”?`, n ? `It's used ${plural(n, 'time')} in your quilt or other blocks; those places will be emptied.` : 'This block isn’t used anywhere.', 'Delete block', () => {
    const id = b.id;
    delete doc.blocks[id];
    doc.blockOrder = doc.blockOrder.filter(x => x !== id);
    const L = doc.layout;
    L.grid.cells = L.grid.cells.map(c => c?.b === id ? null : c);
    for (const k of Object.keys(L.grid.hidden || {})) if (L.grid.hidden[k]?.b === id) delete L.grid.hidden[k];
    for (const k of Object.keys(L.onpoint.cells)) if (L.onpoint.cells[k]?.b === id) delete L.onpoint.cells[k];
    for (const k of Object.keys(L.tess.blocks || {})) if (L.tess.blocks[k]?.b === id) delete L.tess.blocks[k];
    for (const p of L.panels || []) if (p.b === id) p.b = null;
    for (const o of Object.values(doc.blocks)) if (o.kind === 'compound') o.slots = o.slots.map(s => s?.b === id ? null : s);
    ui.activeBlock = doc.blockOrder[0] || null; ui.selRegion = null;
    commit();
  }, true);
};
function transformBlock(b, fn, mirror) {
  for (const r of b.regions) { r.pts = r.pts.map(fn); if (mirror && r.b) r.b = r.b.map(x => -x); }
  b.seams = (b.seams || []).map(s => s.map(fn));
  if (b.appSeams) b.appSeams = b.appSeams.map(s => s.map(fn));
}
Actions.blockRotate = () => {
  const b = activeBlock(), n = b.n; if (b.kind === 'compound') return;
  if (isHexBlock(b)) transformBlock(b, q => turnPt(q, [n / 2, n / 2], 60));
  else transformBlock(b, ([x, y]) => [round(n - y, 6), round(x, 6)]);
  commit();
};
// Rotate a point about c by deg (clockwise on screen), rounded to the editor's precision.
function turnPt([x, y], [cx, cy], deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [round(cx + (x - cx) * c - (y - cy) * s, 6), round(cy + (x - cx) * s + (y - cy) * c, 6)];
}
Actions.blockMirror = () => { const b = activeBlock(), n = b.n; if (b.kind === 'compound') return; transformBlock(b, ([x, y]) => [round(n - x, 6), y], true); commit(); };
Actions.blockClear = () => confirmModal('Clear this block?', 'Removes every shape and seam (the whole block becomes background).', 'Clear', () => { const b = activeBlock(); b.regions = []; b.seams = []; b.appSeams = []; ui.selRegion = null; commit(); }, true);

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
// The fabric dropdown on the selection bar: pick the fabric for the selected shapes.
Actions.paintFabricMenu = (a, el) => openMenu(el, [
  ...doc.fabrics.map((f, i) => ({ label: `${swatchHtml(f.id, 16)} <b>${letterFor(i)}</b> ${esc(f.name)}`, act: 'pickFabric', arg: f.id, checked: ui.fabric === f.id })),
  '-',
  { label: '<span class="sw bgsw"></span> Background', act: 'pickFabric', arg: BG, checked: ui.fabric === BG },
], { align: 'left' });
Actions.selFabricMenu = (a, el) => {
  const b = activeBlock(), cur = uniq(selList().map(i => b.regions[i].fab));
  openMenu(el, [
    ...doc.fabrics.map((f, i) => ({ label: `${swatchHtml(f.id, 16)} <b>${letterFor(i)}</b> ${esc(f.name)}`, act: 'regionFab', arg: f.id, checked: cur.length === 1 && cur[0] === f.id })),
    '-',
    { label: `<span class="sw bgsw"></span> Background`, act: 'regionFab', arg: BG, checked: cur.length === 1 && cur[0] === BG },
  ], { align: 'left' });
};
Actions.selPick = () => { const b = activeBlock(), sel = selList(); if (!sel.length) return; ui.fabric = b.regions[sel[sel.length - 1]].fab; saveUi(); render(); toast(`Picked ${ui.fabric === BG ? 'quilt background' : fabricLabel(ui.fabric)}`, 1200); };
// How far to shift copies (in grid squares) so they stay on the block: the wanted step if it fits,
// else back toward the top left, else in place.
// The step for a copy, as [dx, dy] in grid units: `want` lattice steps down and right (a square lattice
// moves 1,1; a 60° lattice ½,√3/2), else fewer, else up and left, so the copy stays on the block and
// doesn't sit exactly on what it was copied from; in place only when nothing else fits.
function shapeOffset(b, pts, want, firstPts) {
  if (!pts.length || !want) return [0, 0];
  // a spot where an identical copy already sits doesn't count (it would hide the new one)
  const sig = q => q.map(([x, y]) => `${round(x, 4)},${round(y, 4)}`).join(' '), have = new Set(b.regions.map(r => sig(r.pts)));
  const taken = (dx, dy) => firstPts && have.has(sig(firstPts.map(([x, y]) => [x + dx, y + dy])));
  const tri = b.lattice === 'tri' || isHexBlock(b), st = tri ? [0.5, TRI_H] : [1, 1];
  const fr = isHexBlock(b) ? hexFrame(b.n) : [[0, 0], [b.n, b.n]];
  const fx0 = Math.min(...fr.map(p => p[0])), fx1 = Math.max(...fr.map(p => p[0])), fy0 = Math.min(...fr.map(p => p[1])), fy1 = Math.max(...fr.map(p => p[1]));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // inside the frame: the square, or for a hexagon block the hexagon itself (it's convex: every point on
  // the inner side of every edge)
  const side = (A, B, x, y) => (B[0] - A[0]) * (y - A[1]) - (B[1] - A[1]) * (x - A[0]);
  const cx = fr.reduce((s, p) => s + p[0], 0) / fr.length, cy = fr.reduce((s, p) => s + p[1], 0) / fr.length;
  const hexIn = isHexBlock(b) ? (x, y) => fr.every((A, i) => { const B = fr[(i + 1) % fr.length], inner = Math.sign(side(A, B, cx, cy)); return side(A, B, x, y) * inner >= -1e-6; }) : null;
  const fits = (dx, dy) => x0 + dx >= fx0 - 1e-9 && x1 + dx <= fx1 + 1e-9 && y0 + dy >= fy0 - 1e-9 && y1 + dy <= fy1 + 1e-9 && (!hexIn || pts.every(([x, y]) => hexIn(x + dx, y + dy)));
  // lattice steps: across (1, 0) and down (the square's (0, 1), or the 60° lattice's (½, √3/2)); nearest first, down-right first
  const down = tri ? [0.5, TRI_H] : [0, 1], lim = b.n + 1, spots = [];
  for (let i = -lim; i <= lim; i++) for (let j = -lim; j <= lim; j++) if (i || j) { const dx = i + j * down[0], dy = j * down[1]; spots.push([dx, dy, Math.hypot(dx, dy) - (dx > 0 && dy > 0 ? 0.01 : 0)]); }
  spots.sort((a, c) => a[2] - c[2]);
  const start = Math.max(0, want - 1);   // repeated pastes start further out
  for (let n = 0; n < spots.length; n++) { const [dx, dy] = spots[(n + start) % spots.length]; if (fits(dx, dy) && !taken(dx, dy)) return [round(dx, 6), round(dy, 6)]; }
  return [0, 0];
}
Actions.selDup = () => {
  const b = activeBlock(), sel = selList(); if (!sel.length) return;
  const [dx, dy] = shapeOffset(b, sel.flatMap(i => b.regions[i].pts), 1, b.regions[sel[0]].pts);
  if (!dx && !dy) toast('No room beside it: duplicated in place', 2200);
  const copies = sel.map(i => { const c = JSON.parse(JSON.stringify(b.regions[i])); c.pts = c.pts.map(([x, y]) => [round(x + dx, 6), round(y + dy, 6)]); return c; });
  forkTextIds(b, copies);
  const start = b.regions.length;
  b.regions.push(...copies);
  setSel(copies.map((_, k) => start + k)); ui.tool = 'select'; commit();
};
Actions.selCopy = () => { const b = activeBlock(), sel = selList(); if (!sel.length) return; _edClip = { n: b.n, regions: sel.map(i => JSON.parse(JSON.stringify(b.regions[i]))), texts: JSON.parse(JSON.stringify(b.texts || {})), pastes: 0 }; toast(`Copied ${plural(sel.length, 'shape')}`, 1200); };
Actions.selCut = () => { if (!selList().length) return; const n = selList().length; Actions.selCopy(); _edClip.pastes = -1; nextCommitLabel = 'Cut'; Actions.selDelete(); nextCommitLabel = null; toast(`Cut ${plural(n, 'shape')}`, 1200); };
Actions.selPaste = () => {
  const b = activeBlock(); if (!_edClip || !b || b.kind !== 'drawn') return;
  _edClip.pastes++;
  const k = b.n / _edClip.n, [dx, dy] = shapeOffset(b, _edClip.regions.flatMap(r => r.pts.map(([x, y]) => [x * k, y * k])), _edClip.pastes, _edClip.regions[0].pts.map(([x, y]) => [x * k, y * k]));
  if (!dx && !dy && _edClip.pastes > 0) toast('No room beside it: pasted in place', 2200);
  const start = b.regions.length;
  const pasted = _edClip.regions.map(r => { const c = JSON.parse(JSON.stringify(r)); c.pts = c.pts.map(([x, y]) => [round(x * k + dx, 6), round(y * k + dy, 6)]); return c; });
  forkTextIds(b, pasted, _edClip.texts || {});
  b.regions.push(...pasted);
  setSel(_edClip.regions.map((_, i) => start + i)); ui.tool = 'select'; commit('Paste');
};
Actions.selRotate = dir => {
  const b = activeBlock(), sel = selList(); if (!sel.length) return;
  const [cx, cy] = selCentre(b, sel), s = dir === 'ccw' ? -1 : 1;
  if (isHexBlock(b)) for (const i of sel) b.regions[i].pts = b.regions[i].pts.map(q => turnPt(q, [cx, cy], 60 * s));
  else for (const i of sel) b.regions[i].pts = b.regions[i].pts.map(([x, y]) => [round(cx - s * (y - cy), 6), round(cy + s * (x - cx), 6)]);
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
  toast('Corner added', 1400);
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
      { label: 'Cut', act: 'selCut', kb: 'Ctrl+X' }, { label: 'Copy', act: 'selCopy', kb: 'Ctrl+C' }, { label: 'Paste', act: 'selPaste', kb: 'Ctrl+V', disabled: !_edClip }, { label: 'Duplicate', act: 'selDup', kb: 'Ctrl+D' },
      { label: 'Rotate 90°', act: 'selRotate', arg: 'cw', kb: 'E' }, { label: 'Flip horizontal', act: 'selMirror', arg: 'h', kb: 'X' }, { label: 'Flip vertical', act: 'selMirror', arg: 'v', kb: 'Y' }, '-',
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

/* ---------- text tool ---------- */
const textOpts = () => ({ str: ui.textStr ?? 'Hello', font: TEXT_FONTS.some(f => f.key === ui.textFont) ? ui.textFont : 'archivo', h: ui.textH > 0 ? ui.textH : 2 });
// appliqué in the quilt background colour would be invisible: use the first other fabric instead
const textFabric = () => ui.fabric !== BG && ui.fabric !== doc.layout.background ? ui.fabric : (doc.fabrics.find(f => f.id !== doc.layout.background)?.id || ui.fabric);
let _textCache = { key: null, res: null };
function textAtOrigin(b) {
  const o = textOpts(), font = loadedFont(o.font);
  if (!font || !o.str.trim()) return null;
  const capH = o.h / gridScale(b), ang = -edAngle(b), key = `${o.font}|${o.str}|${capH}|${ang}`;
  if (_textCache.key !== key) {
    const res = textRegions(font, o.str, capH, [0, 0], null);
    if (ang) res.regions = res.regions.map(r => ({ ...r, pts: rotatePoly(r.pts, ang * Math.PI / 180) }));   // level as seen
    _textCache = { key, res };
  }
  return _textCache.res;
}
function ensureFont() {
  const f = textOpts().font;
  if (loadedFont(f)) return;
  loadFont(f).then(() => { if (ui.view === 'block' && ui.tool === 'text') { refreshEditor(); renderInspector(); } }).catch(err => toast(err.message));
}
function placeText(b, at) {
  const t = textAtOrigin(b);
  if (!t) { ensureFont(); toast(loadedFont(textOpts().font) ? 'Type the words in Properties first' : 'The font is still loading'); return; }
  const fab = textFabric(), start = b.regions.length, outline = blockOutline(b, b.n);
  const o = textOpts(), tid = uid('t');
  b.texts = { ...(b.texts || {}), [tid]: { str: o.str, font: o.font, h: o.h, ...(edAngle(b) ? { ang: -edAngle(b) } : {}) } };
  const regs = t.regions.map(r => ({ ...r, fab, txt: tid, pts: r.pts.map(([x, y]) => [round(x + at[0], 4), round(y + at[1], 4)]) }));
  b.regions.push(...regs);
  setSel(regs.map((_, i) => start + i));
  ui.tool = 'select'; ed.hover = null;
  commit();
  const off = regs.some(r => r.pts.some(q => !pointInPoly(q, outline)));
  toast(`Added ${plural(regs.length, 'letter')}${t.lost ? `, ${t.lost} without ${t.lost === 1 ? 'its' : 'their'} holes` : ''}${off ? '. Part runs past the edge and will be trimmed.' : ''}`, 3000);
}
Actions.textStr = v => { ui.textStr = v; saveUi(); drawOverlay(); };
Actions.textFont = v => { ui.textFont = v; saveUi(); ensureFont(); drawOverlay(); };
Actions.textH = (v, el) => { const h = parseLen(v); if (h > 0) { ui.textH = clamp(h, 0.25, 48); saveUi(); } el.value = inputLen(textOpts().h); drawOverlay(); };
function textToolSection() {
  const o = textOpts();
  return section('Text', `<label class="f">Words<textarea rows="2" data-input="textStr" spellcheck="false">${esc(o.str)}</textarea></label>
    <p class="hint">${loadedFont(o.font) ? '' : 'Loading the font… '}Each letter becomes an appliqué shape in the selected fabric. For turned-edge appliqué, keep letters 1½" tall or more.</p>`, { key: 'text' });
}

/* ---------- editing placed text ----------
   Each placed word keeps a record (block.texts[id] = { str, font, h }) and its letters carry
   txt: id, so the words can be retyped, re-fonted or resized later. */
function textGroup(b, ri) {
  const id = b.regions[ri]?.txt;
  return id ? b.regions.map((r, i) => r.txt === id ? i : -1).filter(i => i >= 0) : [ri];
}
// The one placed word the selection belongs to (if it's all letters of a single word).
function selectedText(b, sel = selList()) {
  const ids = uniq(sel.map(i => b.regions[i]?.txt));
  return ids.length === 1 && ids[0] && b.texts?.[ids[0]] ? ids[0] : null;
}
// Rebuild a word's letters in place (centred where they are now, in the first letter's fabric).
function rebuildText(b, tid, changes) {
  const t = b.texts?.[tid]; if (!t) return;
  const next = { ...t, ...changes };
  loadFont(next.font).then(font => {
    if (activeBlock() !== b) return;
    const idx = b.regions.map((r, i) => r.txt === tid ? i : -1).filter(i => i >= 0);
    if (!idx.length) return;
    b.texts[tid] = next;
    const bb = bounds(idx.flatMap(i => b.regions[i].pts)), at = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2];
    const fab = b.regions[idx[0]].fab, first = idx[0];
    const fresh = next.str.trim() ? textRegions(font, next.str, next.h / gridScale(b), at, fab).regions
      .map(r => ({ ...r, txt: tid, ...(next.ang ? { pts: rotatePoly(r.pts, next.ang * Math.PI / 180, ...at).map(q => q.map(v => round(v, 4))) } : {}) })) : [];
    b.regions = b.regions.filter(r => r.txt !== tid);
    b.regions.splice(first, 0, ...fresh);
    if (!fresh.length) delete b.texts[tid];
    setSel(fresh.map((_, k) => first + k));
    commit();
  }).catch(err => toast(err.message));
}
// Copies of letters become a separate word.
function forkTextIds(b, regions, texts = b.texts || {}) {
  const map = new Map();
  for (const r of regions) {
    if (!r.txt || !texts[r.txt]) { delete r.txt; continue; }
    if (!map.has(r.txt)) { const id = uid('t'); map.set(r.txt, id); b.texts = { ...(b.texts || {}), [id]: { ...texts[r.txt] } }; }
    r.txt = map.get(r.txt);
  }
}
Actions.textEditStr = (v, el) => { const b = activeBlock(); if (b) rebuildText(b, el.dataset.arg, { str: v }); };
Actions.textEditFont = (v, el) => { const b = activeBlock(); if (b) rebuildText(b, el.dataset.arg, { font: v }); };
Actions.textEditH = (v, el) => { const b = activeBlock(), h = parseLen(v); if (b && h > 0) rebuildText(b, el.dataset.arg, { h: clamp(h, 0.25, 48) }); };
Actions.textToShapes = tid => { const b = activeBlock(); for (const r of b.regions) if (r.txt === tid) delete r.txt; delete b.texts?.[tid]; commit(); toast('The letters are ordinary shapes now', 1600); };
function textEditSection(b, tid) {
  const t = b.texts[tid];
  return section('Text', `<label class="f">Words<textarea rows="2" data-change="textEditStr" data-arg="${tid}" spellcheck="false">${esc(t.str)}</textarea></label>
    <div class="f-row"><label class="f">Font<select data-change="textEditFont" data-arg="${tid}">${fontOptions(t.font)}</select></label>
      <label class="f">Capital height<input type="text" inputmode="decimal" value="${esc(inputLen(t.h))}" data-change="textEditH" data-arg="${tid}"></label></div>
    <p class="hint">Click a selected word again to pick out one letter.</p>
    <div class="btn-row"><button class="btn small" data-act="textToShapes" data-arg="${tid}" title="Stop treating these letters as editable text">Make plain shapes</button></div>`, { key: 'textedit' });
}

/* ---------- tracing picture ---------- */
Actions.refAdd = () => {
  const b = activeBlock(); if (!b) return;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      // stored downsized as JPEG so it fits in browser storage
      const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      refImgs[b.id] = { src: c.toDataURL('image/jpeg', 0.85), ar: c.width / c.height, op: 0.5, sc: 1, dx: 0, dy: 0, on: true };
      const ok = saveRefs();
      renderView();
      toast(ok ? 'Picture added' : 'Picture added, but storage is full. Save the project file to keep it.', ok ? 2000 : 7000);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("Couldn't read that picture"); };
    img.src = url;
  };
  inp.click();
};
const curRef = () => refImgs[activeBlock()?.id];
Actions.refShow = v => { const r = curRef(); if (r) { r.on = !!v; saveRefs(); refreshRef(); } };
Actions.refOpacityLive = v => { const r = curRef(); if (r) { r.op = clamp(+v / 100, 0.05, 1); refreshRef(); saveRefsSoon(); } };
Actions.refScaleLive = v => { const r = curRef(); if (r) { r.sc = clamp(+v / 100, 0.05, 20); refreshRef(); saveRefsSoon(); } };
Actions.refSliderDone = () => renderInspector();
Actions.refFit = () => { const r = curRef(); if (r) { Object.assign(r, { sc: 1, dx: 0, dy: 0 }); saveRefs(); refreshRef(); renderInspector(); } };
Actions.refAdjustToggle = () => { ui.refAdjust = !ui.refAdjust; saveUi(); renderView(); };
Actions.refRemove = () => { const b = activeBlock(); if (b && refImgs[b.id]) { delete refImgs[b.id]; ui.refAdjust = false; saveRefs(); renderView(); } };
function edWheel(e) {
  const r = curRef(), svg = $('#editor');
  if (ui.refAdjust && r) {
    e.preventDefault();
    r.sc = clamp((r.sc || 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 0.05, 20);
    refreshRef(); saveRefsSoon();
    return;
  }
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(edZoom() * wheelZoomFactor(e), svgPoint(svg, e)); return; }
  if (edZoom() > 1) {
    e.preventDefault();
    const px = 1 / svg.getScreenCTM().a;
    ed.cx += (e.shiftKey ? e.deltaY : e.deltaX) * px; ed.cy += (e.shiftKey ? 0 : e.deltaY) * px;
    applyView();
  }
}

/* ---------- zoom & pan ----------
   The view is the editor's viewBox: zoom 1 shows the whole block and its margin. Handles and
   lines are drawn at a constant on-screen size (see `u` in editorGuides), so zooming in gives
   finer control rather than fatter handles. */
function edZoom() { return ed.zoomBlock === ui.activeBlock ? ed.zoom || 1 : 1; }
function edViewBox(S) {
  const m = S * 0.07, full = S + 2 * m, z = edZoom(), w = full / z;
  if (z <= 1) return [S / 2 - w / 2, S / 2 - w / 2, w, w];   // fitted or zoomed out: centred
  ed.cx = clamp(ed.cx ?? S / 2, -m + w / 2, S + m - w / 2);
  ed.cy = clamp(ed.cy ?? S / 2, -m + w / 2, S + m - w / 2);
  return [ed.cx - w / 2, ed.cy - w / 2, w, w];
}
// Zoom to z, keeping the point `at` (frame units) where it is on screen.
function setZoom(z, at) {
  const b = activeBlock(); if (!b || b.kind !== 'drawn') return;
  const S = blockFrameSize(b), old = edViewBox(S);
  if (ed.zoomBlock !== b.id) { ed.zoomBlock = b.id; ed.cx = ed.cy = null; }
  z = clamp(z, 0.25, 16);
  const w = S * 1.14 / z, p = at || [old[0] + old[2] / 2, old[1] + old[3] / 2];
  const fx = (p[0] - old[0]) / old[2], fy = (p[1] - old[1]) / old[3];
  ed.zoom = z; ed.cx = p[0] - fx * w + w / 2; ed.cy = p[1] - fy * w + w / 2;
  applyView();
}
function applyView() {
  const b = activeBlock(), svg = $('#editor'); if (!svg || !b) return;
  svg.setAttribute('viewBox', edViewBox(blockFrameSize(b)).map(v => round(v, 4)).join(' '));
  refreshEditor(false);
  const z = $('#ed-zoom'); if (z) z.textContent = zoomPctText();
}
Actions.edZoomBy = dir => setZoom(dir === 'fit' ? 1 : edZoom() * (dir === 'in' ? 1.5 : 1 / 1.5));
for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => {
  if (e.key !== ' ' || ui.view !== 'block' || e.target.closest?.('input, textarea, select, button')) return;
  e.preventDefault();
  ed.space = type === 'keydown';
  $('#editor')?.classList.toggle('pan', ed.space);
});
function refSection(b) {
  const r = refImgs[b.id];
  if (!r) return section('Tracing picture', `<p class="hint">Trace over a photo or sketch. Not printed.</p><div class="btn-row"><button class="btn small" data-act="refAdd">Choose picture…</button></div>`, { key: 'ref', closed: true });
  const op = Math.round((r.op ?? 0.5) * 100), sc = Math.round((r.sc || 1) * 100);
  return section('Tracing picture', `<label class="check"><input type="checkbox" data-change="refShow" ${r.on !== false ? 'checked' : ''}> Show picture</label>
    <label class="f">Strength <span class="muted">${op}%</span><input type="range" min="10" max="100" step="5" value="${op}" data-input="refOpacityLive" data-change="refSliderDone"></label>
    <label class="f">Size <span class="muted">${sc}%</span><input type="range" min="20" max="400" step="5" value="${Math.min(400, sc)}" data-input="refScaleLive" data-change="refSliderDone"></label>
    <div class="btn-row"><button class="btn small" data-act="refAdjustToggle" aria-pressed="${!!ui.refAdjust}">${ui.refAdjust ? 'Done moving' : 'Move picture'}</button><button class="btn small" data-act="refFit">Fit to block</button></div>
    <div class="btn-row"><button class="btn small" data-act="refAdd">Replace…</button><button class="btn small quiet danger" data-act="refRemove">Remove</button></div>
    ${ui.refAdjust ? '<p class="hint">Drag to move, scroll to resize. Esc when done.</p>' : '<p class="hint">Not printed.</p>'}`, { key: 'ref' });
}

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
  if (!b) return panelNote('No block is open. Pick one in the Blocks panel, or add one.', ['openPanel', 'blocks'], 'Show the Blocks panel');
  const S = b.kind === 'drawn' ? blockFrameSize(b) : doc.layout.blockSize;
  const hex = isHexBlock(b);
  const hexGrids = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24].concat(b.n).filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
  let h = (b.kind === 'drawn' && ui.tool === 'text') ? textToolSection() : '';
  const more = `<button class="icon-btn sm" data-act="blockMenu" aria-haspopup="menu" aria-label="More block actions" title="More">${icon('more')}</button>`;
  h += section('Block', `
    <label class="f">Name<input type="text" value="${esc(b.name)}" data-change="blockName"></label>
    ${hex ? `${hexOrientField()}<label class="f">Lattice<select data-change="blockGrid">${hexGrids.map(v => `<option value="${v}" ${v === b.n ? 'selected' : ''}>${v} triangles across</option>`).join('')}</select></label>
      <p class="hint">${blockSizeText(b, S)}.</p>` : ''}
    ${b.kind === 'drawn' && !hex ? `<div class="f-row">
      <label class="f">Grid<select data-change="blockGrid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24, 32].concat(b.n).filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y).map(v => `<option value="${v}" ${v === b.n ? 'selected' : ''}>${v} × ${v}</option>`).join('')}</select></label>
      <label class="f">Lattice<select data-change="blockLattice"><option value="square" ${b.lattice !== 'tri' ? 'selected' : ''}>Square</option><option value="tri" ${b.lattice === 'tri' ? 'selected' : ''}>Triangle, 60°</option></select></label></div>
      <p class="hint">${fmtSize(S, S)} finished, ${fmtLen(S / b.n)} squares.</p>` : ''}`, { key: 'block', right: more });

  if (b.kind === 'compound') {
    let slots = `<label class="f">Arrangement<select data-change="compoundSub">${SUB_PRESETS.map(p => `<option value="${p.key}" ${subKey(b.sub) === p.key ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>`;
    b.slots.forEach((s, i) => {
      const opts = ['<option value="">Empty</option>', ...doc.blockOrder.filter(id => id !== b.id && !wouldCycle(b.id, id) && !isHexBlock(doc.blocks[id])).map(id => `<option value="${id}" ${s?.b === id ? 'selected' : ''}>${esc(doc.blocks[id].name)}</option>`)].join('');
      slots += `<div class="list-item"><div class="li-h"><b${ui.activeSlot === i ? ' style="color:var(--sel)"' : ''}>Slot ${i + 1}</b><button class="btn small quiet" data-act="slotPick" data-arg="${i}">Select</button></div>
        <select data-change="slotBlock" data-arg="${i}" style="width:100%;margin-top:4px">${opts}</select>
        ${s ? `<div class="f-row"><label class="f">Turn<select data-change="slotRot" data-arg="${i}">${[0, 1, 2, 3].map(r => `<option value="${r}" ${(s.r || 0) === r ? 'selected' : ''}>${r * 90}°</option>`).join('')}</select></label>
        <label class="check" style="margin-top:24px"><input type="checkbox" data-change="slotFlip" data-arg="${i}" ${s.f ? 'checked' : ''}> Mirror</label></div>` : ''}</div>`;
    });
    h += section('Slots', slots, { key: 'slots' });
    h += constructionSection(b, S);
    return h;
  }

  const sel = selList();
  const tsel = selectedText(b, sel);
  // the selection comes first, so it's always in view; its commands live on the bar beside it
  let selh = '';
  if (tsel) selh += textEditSection(b, tsel);
  if (sel.length) selh += section('Position and size', selGeomFields(b, sel), { key: 'selgeom' });
  if (sel.length > 1) {
    const fabs = uniq(sel.map(i => b.regions[i].fab));
    selh += section(`${sel.length} shapes selected`, `<label class="f">Fabric</label>${fabricPicker(fabs.length === 1 ? fabs[0] : null, 'regionFab', { allowBg: true })}`, { key: 'selshape' });
  }
  const r = sel.length === 1 ? b.regions[sel[0]] : null;
  if (r) {
    selh += section('Selected shape', `<label class="f">Fabric</label>${fabricPicker(r.fab, 'regionFab', { allowBg: true })}
      <label class="check" title="Sewn on top; doesn't cut the pieces underneath"><input type="checkbox" data-change="regionApp" ${r.app ? 'checked' : ''}> Appliqué</label>
      <label class="f">Add copies around the centre</label>
      <div class="btn-row" style="margin-top:3px">${(hex ? [['rot2', '2'], ['rot3', '3'], ['rot6', '6']] : [['rot2', '2'], ['rot4', '4'], ['rot8', '8']]).map(([k, l]) => `<button class="btn small" data-act="regionCopies" data-arg="${k}">${l}</button>`).join('')}<button class="btn small" data-act="regionCopies" data-arg="h">Mirrored copy ↔</button><button class="btn small" data-act="regionCopies" data-arg="v">Mirrored copy ↕</button><button class="btn small" data-act="regionCopies" data-arg="4">4-way</button></div>`, { key: 'selshape' });
  }
  h = selh + h;

  h += refSection(b);
  h += section(`Seams${b.seams?.length ? ` <span class="muted">${b.seams.length}</span>` : ''}`, `<p class="hint">Seam lines split pieces so they sew with straight seams.</p>
    <div class="btn-row"><button class="btn small" data-act="autoSeams">Add suggested seams</button>${b.seams?.length ? '<button class="btn small quiet" data-act="clearSeams">Remove all</button>' : ''}</div>`, { key: 'seams', closed: true });
  h += constructionSection(b, S);
  return h;
}
// The Shapes panel: the block's shapes, front first, like a layers list.
function shapesPanel() {
  const b = activeBlock();
  if (!b) return panelNote('Open a block to see its shapes.');
  if (b.kind !== 'drawn') return panelNote('A combination block is made of other blocks. Its slots are in Properties.');
  const sel = selList();
  let list = '';
  for (let i = b.regions.length - 1; i >= 0; i--) {
    const reg = b.regions[i];
    list += `<div class="region-row" role="button" tabindex="0" aria-pressed="${sel.includes(i)}" data-act="selectRegion" data-arg="${i}">${reg.fab === BG ? '<span class="sw bgsw" style="--sw:16px"></span>' : swatchHtml(reg.fab, 16)}<span class="nm">${esc(regionName(b, reg))} <span class="muted">${esc(reg.fab === BG ? 'background' : fabricLabel(reg.fab))}${reg.app ? ' · appliqué' : ''}</span></span></div>`;
  }
  return `<div class="panel-tools"><span class="pt-note">${plural(b.regions.length, 'shape')}${sel.length ? ` · ${sel.length} selected` : ''}</span><span class="grow"></span>
    ${sel.length ? `<button class="btn small quiet" data-act="selOrder" data-arg="front" title="Bring to front">${icon('front', 14)}</button><button class="btn small quiet" data-act="selOrder" data-arg="back" title="Send to back">${icon('back', 14)}</button>` : ''}
    <button class="btn small" data-act="selAll" title="Select all (Ctrl+A)">Select all</button></div>
    <div class="pad">${list ? list : '<p class="hint">No shapes yet.</p>'}</div>`;
}
// A shape's name in the shapes list, in quilting words.
function regionName(b, reg) {
  if (reg.txt && b.texts?.[reg.txt]) return `Letter of ${b.texts[reg.txt].str.slice(0, 16)}`;
  const curved = reg.b?.some(x => x);
  if (reg.pts.length === 3 && curved && reg.b.filter(x => x).length === 1 && Math.abs(Math.abs(reg.b.find(x => x)) - QUARTER_BULGE) < 1e-3) return 'Quarter circle';
  if (reg.pts.length === 2) return 'Circle';
  const cls = classifyPiece(reg.pts);
  return shapeName(cls) + (curved ? ', curved' : '');
}
function constructionSection(b, S) {
  const pieces = blockPieces(b, S, S);
  const an = analyzeBlock(b, S);
  const counts = {};
  for (const p of pieces) { const k = shapeName(p.cls) + (p.app ? ', appliqué' : ''); counts[k] = (counts[k] || 0) + 1; }
  const units = {};
  for (const u of an.units) if (u.unit.type !== 'piece') units[u.unit.type] = (units[u.unit.type] || 0) + 1;
  const probs = pieceProblems(b, S);
  const how = an.setIn ? 'Has set-in (Y) seams. Add seam lines to avoid them.'
    : pieces.length > 1 ? (an.height ? `Sews in ${plural(an.height, 'step')}${an.units.some(u => u.unit.type === 'curved') ? ', with curved seams' : ''}.` : 'Sews as one unit.') : 'One piece.';
  let body = `<p class="${an.setIn ? 'hint warn' : 'hint'}">${plural(pieces.length, 'piece')} to cut. ${how}</p>
    <dl class="kv">${Object.entries(counts).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}${Object.entries(units).map(([k, v]) => `<dt>${esc(UNIT_NAMES[k] || k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  for (const p of probs) body += `<p class="hint${p.kind === 'tiny' ? '' : ' warn'}">${esc(p.msg)}</p>`;
  return section('Construction', body, { key: 'construct', closed: true });
}

Actions.polyDone = () => finishPolygon();
Actions.polyCancel = () => { ui.drawing = []; ed.triPreview = null; refreshEditor(); renderToolbar(); };

registerPanel('shapes', { title: 'Shapes', short: 'Shapes', icon: 'shapes', ws: ['block'], render: shapesPanel });

// Position and size of the selection, in finished inches (or cm) from the block's top-left corner.
function selGeomFields(b, sel) {
  const bb = selBounds(b, sel), k = blockFrameSize(b) / b.n;
  const f = (key, label, v) => `<label class="f">${label}<input type="text" inputmode="decimal" data-type="len" data-change="selGeom" data-arg="${key}" value="${esc(inputLen(v))}" aria-label="${label}" title="Accepts 4.5, 4 1/2, 4-1/2, +1/4, *2…"></label>`;
  return `<div class="f-row geom">${f('x', 'From left', bb.x * k)}${f('y', 'From top', bb.y * k)}</div><div class="f-row geom">${f('w', 'Width', bb.w * k)}${f('h', 'Height', bb.h * k)}</div>
    <label class="check"><input type="checkbox" data-change="geomLock" ${ui.geomLock ? 'checked' : ''}> Keep proportions</label>`;
}
Actions.selGeom = (v, el) => {
  const b = activeBlock(), sel = selList(); if (!b || !sel.length) return;
  const key = el.dataset.arg, bb = selBounds(b, sel), k = blockFrameSize(b) / b.n;
  const cur = { x: bb.x, y: bb.y, w: bb.w, h: bb.h }[key] * k, n = parseLenExpr(v, cur);
  if (!Number.isFinite(n) || (key === 'w' || key === 'h') && n <= 0) { lenFieldError(el, v); return; }
  const S = blockFrameSize(b), X = Math.max(0, bb.x * k), Y = Math.max(0, bb.y * k), Wd = bb.w * k, Ht = bb.h * k;
  // typed numbers keep the shape wholly on the block (dragging can still take it past the edge)
  let max = key === 'x' ? S - Wd : key === 'y' ? S - Ht : key === 'w' ? S - X : S - Y;
  if (ui.geomLock && key === 'w' && Ht) max = Math.min(max, (S - Y) * Wd / Ht);
  if (ui.geomLock && key === 'h' && Wd) max = Math.min(max, (S - X) * Ht / Wd);
  const val = key === 'x' || key === 'y' ? clamp(n, 0, Math.max(0, max)) : clamp(n, 1 / 16, Math.max(1 / 16, max)), g = val / k;
  if (Math.abs(val - n) > 1e-6) toast(`${key === 'x' || key === 'y' ? 'Position' : 'Size'} kept on the block: ${fmtLen(val)}`, 2200);
  const fx = key === 'w' ? g / (bb.w || 1) : key === 'h' && ui.geomLock ? g / (bb.h || 1) : 1;
  const fy = key === 'h' ? g / (bb.h || 1) : key === 'w' && ui.geomLock ? g / (bb.w || 1) : 1;
  const map = key === 'x' ? ([x, y]) => [x + g - bb.x, y] : key === 'y' ? ([x, y]) => [x, y + g - bb.y]
    : ([x, y]) => [bb.x + (x - bb.x) * fx, bb.y + (y - bb.y) * fy];
  for (const i of sel) b.regions[i].pts = b.regions[i].pts.map(p => map(p).map(c => round(c, 5)));
  commit({ x: 'Move shapes', y: 'Move shapes', w: 'Resize shapes', h: 'Resize shapes' }[key]);
};

// Hexagon orientation: one setting for the whole quilt (all its hexagons point the same way), the same
// one as Layout's Hexagons orientation.
function hexOrientField() {
  const t = doc.layout.tess, flat = t.orient === 1, other = t.shape !== 'hex';
  return `<div class="f"><span class="f-l">Orientation <span class="muted">· whole quilt</span></span><div class="seg" role="group" aria-label="Hexagon orientation">
    <button aria-pressed="${!flat}" data-act="hexOrient" data-arg="0" ${other ? 'disabled' : ''}>Pointy top</button><button aria-pressed="${flat}" data-act="hexOrient" data-arg="1" ${other ? 'disabled' : ''}>Flat top</button></div>
    ${other ? '<p class="hint">Set with a hexagon tessellation (Layout, Tessellation, Hexagons).</p>' : ''}</div>`;
}
Actions.hexOrient = v => {
  const t = doc.layout.tess, o = +v === 1 ? 1 : 0;
  if (t.orient === o || t.shape !== 'hex') return;
  Actions.tessOrient(o);
};
Actions.geomLock = v => { ui.geomLock = !!v; saveUi(); };
