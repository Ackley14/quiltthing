/* Layout view: arrange blocks (straight set / on point) or colour a tessellation; sashing,
   borders, binding and background. */

const LAYOUT_TOOLS = [
  { key: 'place', label: 'Place block', kb: 'B', icon: '▦' },
  { key: 'paintcell', label: 'Paint fabric', kb: 'V', icon: '🖌' },
  { key: 'select', label: 'Select', kb: 'S', icon: '⬚' },
];
const lay = { drag: null };
function layoutTool() {
  if (doc.layout.mode === 'tess' && ui.layoutTool === 'place') return 'paintcell';
  return ui.layoutTool || (doc.layout.mode === 'tess' ? 'paintcell' : 'place');
}

Views.layout = {
  main() {
    const Q = Qnow(), tool = layoutTool();
    const tools = LAYOUT_TOOLS.filter(t => !(doc.layout.mode === 'tess' && t.key === 'place'))
      .map(t => `<button class="tool" data-act="layoutTool" data-arg="${t.key}" aria-pressed="${tool === t.key}" title="${t.label} (${t.kb})">${t.icon} ${t.label} <kbd>${t.kb}</kbd></button>`).join('');
    const b = activeBlock();
    const placing = tool === 'place'
      ? (b ? `<span class="muted">Placing</span> ${blockThumb(b, 22, 'mini')} <b>${esc(b.name)}</b> <span class="muted">${ui.placeRot ? `↻${ui.placeRot * 90}°` : ''}${ui.placeFlip ? ' ⇋' : ''}</span>` : '<span class="muted">Pick a block in the sidebar to place it</span>')
      : tool === 'paintcell' ? `<span class="muted">Painting</span> ${swatchHtml(ui.fabric === BG ? doc.layout.background : ui.fabric, 18)} <b>${esc(fabricLabel(ui.fabric))}</b>` : '';
    return `<div class="stage"><div class="toolbar">${tools}<span class="sep"></span>${placing}<div class="spacer"></div>
        <button class="tool" data-act="toggleUi" data-arg="seamLines" aria-pressed="${!!ui.seamLines}" title="Show or hide the seam lines between pieces and blocks">Seam lines</button>
        <button class="tool" data-act="toggleUi" data-arg="grayscale" aria-pressed="${!!ui.grayscale}" title="Check value contrast in grayscale (G)">Value</button>
        ${doc.quilting.layers.length ? `<button class="tool" data-act="toggleUi" data-arg="showQuilting" aria-pressed="${!!ui.showQuilting}">Quilting</button>` : ''}
      </div>
      <div class="canvas-wrap">${layoutCanvasSvg(Q)}</div>
      <div class="status-bar">Finished quilt <b>${fmtSize(Q.W, Q.H)}</b> · ${layoutCountText(Q)}${Q.warnings.length ? ` · <span style="color:var(--danger)">${esc(Q.warnings.join(' '))}</span>` : ''}<br><span class="muted">${layoutHint(tool)}</span></div></div>`;
  },
  afterMain(el) {
    const svg = el.querySelector('svg.quilt-svg');
    if (!svg) return;
    svg.addEventListener('pointerdown', layDown);
    svg.addEventListener('pointermove', layMove);
    svg.addEventListener('pointerup', layUp);
    svg.addEventListener('pointerleave', () => { if (!lay.drag) hoverCell(null); });
    svg.addEventListener('contextmenu', e => e.preventDefault());
  },
  inspector() { return layoutInspector(); },
  key(e) {
    const k = e.key.toLowerCase();
    const t = LAYOUT_TOOLS.find(x => x.kb.toLowerCase() === k);
    if (t && !(k === 'b' && doc.layout.mode === 'tess')) { Actions.layoutTool(t.key); return; }
    if (e.key === 'Escape') { ui.selCell = null; renderView(); return; }
    const key = ui.selCell || lay.hoverKey;
    if (!key) return;
    if (k === 'r') { e.preventDefault(); rotateCell(key, e.shiftKey ? 3 : 1); commit(); }
    else if (k === 'f') { e.preventDefault(); flipCell(key); commit(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clearCell(key); commit(); }
  },
};

function layoutCanvasSvg(Q) {
  const q = ui.showQuilting && doc.quilting.layers.length ? quiltingSvg(Q) : '';
  return quiltSvg(Q, { interactive: true, seams: ui.seamLines, sel: ui.selCell, quilting: q });
}
// Redraw inside the existing <svg> so pointer capture survives during a drag.
function refreshLayoutCanvas() {
  _Q = null;
  const svg = $('#main svg.quilt-svg');
  if (!svg) { renderMainOnly(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = layoutCanvasSvg(Qnow());
  const n = tmp.firstElementChild;
  svg.setAttribute('viewBox', n.getAttribute('viewBox'));
  svg.innerHTML = n.innerHTML;
}
function layoutCountText(Q) {
  const blocks = Q.cells.filter(c => c.b).length, plain = Q.cells.filter(c => c.fab).length;
  if (Q.mode === 'tess') return `${Q.tiles.filter(t => t.whole).length} whole ${tessShape(doc.layout.tess.shape).label.toLowerCase()}, ${Q.tiles.filter(t => !t.whole).length} edge pieces`;
  return `${plural(blocks, 'block')}${plain ? ` + ${plural(plain, 'plain square')}` : ''}`;
}
function layoutHint(tool) {
  if (tool === 'place') return 'Click or drag to place · click the same block again to rotate it · hold Shift to place mirrored (Shift-click a placed block to flip it) · right-click clears · R / F rotate or mirror the block under the pointer';
  if (tool === 'paintcell') return doc.layout.mode === 'tess' ? 'Click or drag across shapes to paint them · right-click resets a shape · use Fill patterns on the right for whole-quilt colourways' : 'Paint plain squares (alternate blocks) or setting triangles with the selected fabric · right-click clears';
  return 'Click a block position to see its options on the right';
}

/* ---------- cell operations ---------- */
function isBlockKey(key) {
  if (key[0] === 'g') return true;
  if (key[0] === 'o') return Qnow().cells.some(c => c.key === key);
  return false;
}
function rotateCell(key, by = 1) {
  const c = cellContent(key);
  if (c?.b) setCellContent(key, { ...c, r: ((c.r || 0) + by) % 4 });
}
function flipCell(key) { const c = cellContent(key); if (c?.b) setCellContent(key, { ...c, f: !c.f }); }
function clearCell(key) { setCellContent(key, null); }

function layTarget(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-cell]');
  return el ? el.dataset.cell : null;
}
function applyTool(key, first, e) {
  const tool = layoutTool();
  if (tool === 'select') { ui.selCell = key; return 'select'; }
  if (tool === 'paintcell') {
    const cur = cellContent(key);
    const fab = ui.fabric === BG ? doc.layout.background : ui.fabric;
    if (cur?.fab === fab && !cur?.b) return false;
    setCellContent(key, { fab });
    return true;
  }
  if (!isBlockKey(key)) return false;
  const b = activeBlock();
  if (!b) { if (first) toast('Pick a block in the sidebar first'); return false; }
  const cur = cellContent(key);
  // Shift = mirrored. A click only rotates when it wouldn't otherwise change the cell.
  const flip = e.shiftKey ? !ui.placeFlip : ui.placeFlip;
  if (e.shiftKey && cur?.b === b.id) {
    if (!first) return false;
    setCellContent(key, { ...cur, f: !cur.f });                 // flip in place, keep rotation
    return true;
  }
  if (cur?.b === b.id && !!cur.f === flip) {
    if (first && !lay.dragMoved) { rotateCell(key); return true; }
    return false;
  }
  setCellContent(key, { b: b.id, r: ui.placeRot, f: flip });
  return true;
}
function layDown(e) {
  const key = layTarget(e);
  if (!key) { if (ui.selCell) { ui.selCell = null; renderView(); } return; }
  if (e.button === 2) { clearCell(key); commit(); return; }
  e.currentTarget.setPointerCapture(e.pointerId);
  lay.drag = { keys: new Set([key]), changed: false };
  lay.dragMoved = false;
  const r = applyTool(key, true, e);
  if (r === 'select') { lay.drag = null; renderView(); return; }
  if (r) { lay.drag.changed = true; refreshLayoutCanvas(); }
}
function layMove(e) {
  const key = layTarget(e);
  lay.shift = e.shiftKey;
  if (lay.drag) {
    if (key && !lay.drag.keys.has(key)) {
      lay.drag.keys.add(key);
      lay.dragMoved = true;
      if (applyTool(key, false, e)) { lay.drag.changed = true; refreshLayoutCanvas(); }
    }
    return;
  }
  hoverCell(key);
}
function layUp() {
  const d = lay.drag; lay.drag = null;
  if (d?.changed) commit();
}
function hoverCell(key) {
  lay.hoverKey = key;
  const layer = $('#main .hover-layer');
  if (!layer) return;
  if (!key) { layer.innerHTML = ''; return; }
  const Q = Qnow();
  const c = Q.cells.find(x => x.key === key) || Q.tiles.find(x => x.key === key);
  if (!c) return;
  const w = Math.max(Q.W, Q.H) * 0.004;
  let ghost = '';
  if (layoutTool() === 'place' && c.size && activeBlock() && isBlockKey(key)) {
    const cur = cellContent(key);
    // preview what a click would do: mirrored with Shift, keeping rotation when flipping in place
    const g = lay.shift && cur?.b === activeBlock().id ? { ...c, rot: cur.r || 0, flip: !cur.f } : { ...c, rot: ui.placeRot, flip: lay.shift ? !ui.placeFlip : ui.placeFlip };
    ghost = `<g opacity=".55" transform="${cellTransform(g)}">${blockSvg(activeBlock(), c.size, c.size)}</g>`;
  }
  layer.innerHTML = `${ghost}<path d="${polyToPath(c.pts)}" fill="none" stroke="#f2b134" stroke-width="${w}"/>`;
}

/* ---------- actions ---------- */
for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => {
  if (e.key === 'Shift' && ui.view === 'layout' && !lay.drag && lay.hoverKey) { lay.shift = type === 'keydown'; hoverCell(lay.hoverKey); }
});
Actions.layoutTool = t => { ui.layoutTool = t; saveUi(); renderView(); };
Actions.layoutMode = m => {
  doc.layout.mode = m; ui.selCell = null;
  if (m === 'tess') ui.layoutTool = 'paintcell';
  else if (ui.layoutTool === 'paintcell') ui.layoutTool = 'place';
  commit();
};
Actions.layoutRows = v => { const g = doc.layout.grid; resizeGrid(clamp(parseInt(v, 10) || 1, 1, 40), g.cols); commit(); };
Actions.layoutCols = v => { const g = doc.layout.grid; resizeGrid(g.rows, clamp(parseInt(v, 10) || 1, 1, 40)); commit(); };
Actions.placeRot = r => { ui.placeRot = +r; saveUi(); render(); };
Actions.placeFlip = v => { ui.placeFlip = !!v; saveUi(); render(); };
Actions.cellRotate = () => { if (ui.selCell) { rotateCell(ui.selCell); commit(); } };
Actions.cellFlip = () => { if (ui.selCell) { flipCell(ui.selCell); commit(); } };
Actions.cellClear = () => { if (ui.selCell) { clearCell(ui.selCell); commit(); } };
Actions.cellEdit = () => { const c = cellContent(ui.selCell); if (c?.b) { ui.activeBlock = c.b; Actions.view('block'); } };
Actions.cellReplace = () => { if (ui.selCell && activeBlock() && isBlockKey(ui.selCell)) { setCellContent(ui.selCell, { b: activeBlock().id, r: ui.placeRot, f: ui.placeFlip }); commit(); } };

function blockCellKeys() { return Qnow().cells.map(c => c.key); }
Actions.fillLayout = mode => {
  const b = activeBlock();
  if (!b) { toast('Pick a block in the sidebar first'); return; }
  for (const k of blockCellKeys()) {
    if (mode === 'empty' && cellContent(k)) continue;
    setCellContent(k, { b: b.id, r: ui.placeRot, f: ui.placeFlip });
  }
  commit();
};
Actions.alternateWith = () => {
  const b = activeBlock(), sel = $('#alt-with')?.value;
  if (!b || !sel) { toast('Pick a block in the sidebar, and something to alternate with'); return; }
  const second = sel.startsWith('fab:') ? { fab: sel.slice(4) } : { b: sel, r: 0, f: false };
  for (const c of Qnow().cells) {
    const odd = doc.layout.mode === 'onpoint' ? c.key[1] === 'B' : (c.row + c.col) % 2 === 1;
    setCellContent(c.key, odd ? second : { b: b.id, r: ui.placeRot, f: ui.placeFlip });
  }
  commit();
};
Actions.rotPattern = kind => {
  const Q = Qnow();
  const rows = uniq(Q.cells.map(c => c.row)).length, cols = uniq(Q.cells.map(c => typeof c.col === 'number' ? c.col : 0)).length;
  const R = rng(Date.now() & 0xffff);
  Q.cells.forEach((c, i) => {
    const cur = cellContent(c.key);
    if (!cur?.b) return;
    const r = c.row, k = typeof c.col === 'number' ? c.col : i;
    let rot = 0;
    if (kind === 'alternate') rot = (r + k) % 2;
    else if (kind === 'pinwheel') rot = [[0, 1], [3, 2]][r % 2][k % 2];
    else if (kind === 'quadrants') rot = r < rows / 2 ? (k < cols / 2 ? 0 : 1) : (k < cols / 2 ? 3 : 2);
    else if (kind === 'random') rot = Math.floor(R() * 4);
    setCellContent(c.key, { ...cur, r: rot });
  });
  commit();
};
Actions.clearLayout = () => confirmModal('Clear the layout?', 'Removes every block and painted square from the layout (your blocks stay in My blocks).', 'Clear layout', () => {
  const L = doc.layout;
  L.grid.cells = L.grid.cells.map(() => null);
  L.onpoint.cells = {};
  L.tess.colors = {};
  commit();
}, true);

Actions.tessShape = v => {
  const t = doc.layout.tess, s = tessShape(v);
  t.shape = v; t.ratio = s.ratio; t.lean = s.lean; t.orient = 0; t.colors = {};
  commit();
};
Actions.tessEdge = v => { doc.layout.tess.edge = v; commit(); };
Actions.tessFill = id => { doc.layout.tess.fill = id; commit(); };
Actions.tessBase = id => { doc.layout.tess.base = id; commit(); };
Actions.onpointFill = id => { const op = doc.layout.onpoint; op.fill = id; for (const k of Object.keys(op.cells)) if (op.cells[k]?.fab && !Qnow().cells.some(c => c.key === 'o' + k)) delete op.cells[k]; commit(); };
Actions.tessToggleSet = id => {
  const set = paintSet();
  ui.tessPaintSet = set.includes(id) ? set.filter(x => x !== id) : [...set, id];
  saveUi(); renderInspector();
};
function paintSet() {
  const ids = doc.fabrics.map(f => f.id);
  const set = (ui.tessPaintSet || ids.filter(id => id !== doc.layout.background)).filter(id => ids.includes(id));
  return set.length ? set : ids.slice(0, 2);
}
Actions.tessPattern = kind => {
  const L = doc.layout, Q = Qnow(), F = paintSet();
  if (kind === 'shuffle') { L.tess.seed = (L.tess.seed || 1) + 1; kind = 'random'; }
  const R = rng(L.tess.seed || 1);
  const tiles = Q.tiles.filter(t => t.tkey);
  const rows = tiles.map(t => t.row), minR = Math.min(...rows), maxR = Math.max(...rows);
  const cx = Q.W / 2, cy = Q.H / 2;
  for (const t of tiles) {
    let i = 0;
    const c = centroid(t.pts);
    if (kind === 'solid') { L.tess.colors[t.tkey] = ui.fabric === BG ? L.background : ui.fabric; continue; }
    if (kind === 'random') i = Math.floor(R() * F.length);
    else if (kind === 'rows') i = t.row - minR;
    else if (kind === 'cols') i = t.col;
    else if (kind === 'diag') i = t.row + t.col;
    else if (kind === 'rings') i = Math.floor(Math.hypot(c[0] - cx, c[1] - cy) / (L.tess.size * 1.5));
    else if (kind === 'orient') i = t.orient;
    else if (kind === 'gradient') i = Math.floor((t.row - minR) / (maxR - minR + 1) * F.length);
    L.tess.colors[t.tkey] = F[((i % F.length) + F.length) % F.length];
  }
  commit();
};
Actions.addBorder = () => {
  const last = doc.layout.borders[doc.layout.borders.length - 1];
  doc.layout.borders.push({ width: last ? last.width + 2 : 2, fabric: doc.fabrics[(fabricIndex(last?.fabric) + 1) % doc.fabrics.length]?.id || doc.fabrics[1].id });
  commit();
};
Actions.removeBorder = i => { doc.layout.borders.splice(+i, 1); commit(); };
Actions.borderFab = (arg) => { const [i, id] = arg.split('|'); doc.layout.borders[+i].fabric = id; commit(); };
Actions.sashFab = id => { doc.layout.grid.sashing.fabric = id; commit(); };
Actions.cornerFab = id => { doc.layout.grid.sashing.cornerFabric = id; commit(); };
Actions.bindingFab = id => { doc.layout.binding.fabric = id || null; commit(); };
Actions.bindingNone = () => { doc.layout.binding.fabric = null; commit(); };
Actions.bgFab = id => { doc.layout.background = id; commit(); };

/* ---------- inspector ---------- */
function rotIcon(r, flip) {
  return `<svg viewBox="0 0 24 24"><g transform="rotate(${r * 90} 12 12) ${flip ? 'translate(24 0) scale(-1 1)' : ''}"><rect x="3" y="3" width="18" height="18" fill="#efe9de" stroke="#8a94a0"/><path d="M3 3h18L3 21z" fill="#1f3a5f"/><circle cx="7" cy="7" r="2" fill="#e0a930"/></g></svg>`;
}
function layoutInspector() {
  const L = doc.layout, Q = Qnow();
  let h = section('Setting', `<div class="seg" role="group" aria-label="Setting">
      ${[['grid', 'Straight'], ['onpoint', 'On point'], ['tess', 'Tessellation']].map(([k, l]) => `<button aria-pressed="${L.mode === k}" data-act="layoutMode" data-arg="${k}">${l}</button>`).join('')}</div>
    <p class="hint">${{ grid: 'Blocks in rows and columns.', onpoint: 'Blocks turned 45°, with setting triangles around the edge.', tess: 'A quilt made from one repeating shape — hexagons, triangles, lightning bolts and more. The shapes are fitted to the size you choose.' }[L.mode]}</p>
    <dl class="kv"><dt>Finished quilt</dt><dd>${fmtSize(Q.W, Q.H)}</dd></dl>`, { key: 'setting' });

  if (L.mode === 'grid') {
    h += section('Size', `<div class="f-row">
        <label class="f">Rows<input type="number" min="1" max="40" value="${L.grid.rows}" data-change="layoutRows"></label>
        <label class="f">Columns<input type="number" min="1" max="40" value="${L.grid.cols}" data-change="layoutCols"></label></div>
      ${lenField('Finished block size', 'layout.blockSize', { min: 1, max: 48 })}`, { key: 'size' });
  } else if (L.mode === 'onpoint') {
    h += section('Size', `<div class="f-row">
        ${numField('Blocks down', 'layout.onpoint.rows', { int: true, min: 1, max: 20 })}
        ${numField('Blocks across', 'layout.onpoint.cols', { int: true, min: 1, max: 20 })}</div>
      ${lenField('Finished block size', 'layout.blockSize', { min: 1, max: 48 })}
      <div class="hint">Setting triangles (default fabric)</div>${fabricPicker(L.onpoint.fill, 'onpointFill')}
      <p class="hint">Use <b>Paint fabric</b> to colour individual triangles or make plain alternate squares.</p>`, { key: 'size' });
  } else {
    const t = L.tess, sh = tessShape(t.shape);
    h += section('Shape', `<label class="f">Shape<select data-change="tessShape">${TESS_SHAPES.map(s => `<option value="${s.key}" ${s.key === t.shape ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      <div class="f-row">${lenField(t.shape === 'hex' || t.shape === 'tumbling' || t.shape === 'triangle' ? 'Side length' : 'Width', 'layout.tess.size', { min: 0.5, max: 40 })}
        <label class="f">Orientation<select data-bind="layout.tess.orient" data-type="int">${sh.orientLabels.map((l, i) => `<option value="${i}" ${t.orient === i ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      ${['zigzag', 'brick', 'diamond'].includes(t.shape) ? `<div class="f-row">${numField('Height ÷ width', 'layout.tess.ratio', { min: 0.2, max: 4, step: 0.05 })}${t.shape === 'zigzag' ? numField('Lean ÷ width', 'layout.tess.lean', { min: 0, max: 2, step: 0.05 }) : ''}</div>` : ''}
      <h4>Quilt centre size</h4><div class="f-row">${lenField('Width', 'layout.tess.width', { min: 2, max: 200 })}${lenField('Height', 'layout.tess.height', { min: 2, max: 200 })}</div>
      <label class="check"><input type="checkbox" data-bind="layout.tess.snap" data-type="bool" ${t.snap !== false ? 'checked' : ''}> Fit to whole shapes</label>
      <p class="hint">${t.snap !== false ? `Adjusted to the shape repeat: <b>${fmtSize(...tessSize(t))}</b>. Untick to use your exact size (edge pieces may get thin).` : 'Using your exact size; very thin edge pieces are merged into their neighbours when filling gaps.'}</p>
      <h4>Edges</h4><div class="seg">${[['trim', 'Trim shapes'], ['fill', 'Fill gaps']].map(([k, l]) => `<button aria-pressed="${t.edge === k}" data-act="tessEdge" data-arg="${k}">${l}</button>`).join('')}</div>
      <p class="hint">${t.edge === 'trim' ? 'Shapes run off the edge and are trimmed straight.' : 'Partial shapes at the edge are cut from a gap-fill fabric instead:'}</p>
      ${t.edge === 'fill' ? fabricPicker(t.fill, 'tessFill') : ''}
      <div class="hint">Base fabric (unpainted shapes)</div>${fabricPicker(t.base, 'tessBase')}`, { key: 'shape' });
    const set = paintSet();
    h += section('Fill patterns', `<p class="hint" style="margin-top:0">Choose the fabrics to use, then a pattern:</p>
      <div class="fabpick">${doc.fabrics.map(f => `<button aria-pressed="${set.includes(f.id)}" data-act="tessToggleSet" data-arg="${f.id}" title="${esc(f.name)}">${swatchHtml(f.id, 20)}</button>`).join('')}</div>
      <div class="btn-row">${[['random', 'Random'], ['rows', 'Rows'], ['cols', 'Columns'], ['diag', 'Diagonals'], ['rings', 'Rings'], ['gradient', 'Gradient'], ['orient', 'By direction']].map(([k, l]) => `<button class="btn small" data-act="tessPattern" data-arg="${k}">${l}</button>`).join('')}</div>
      <div class="btn-row"><button class="btn small" data-act="tessPattern" data-arg="shuffle">🎲 Shuffle random</button><button class="btn small" data-act="tessPattern" data-arg="solid" title="Paint every shape with the selected fabric">Fill all</button><button class="btn small danger" data-act="clearLayout">Clear</button></div>`, { key: 'tessfill' });
  }

  if (L.mode !== 'tess') {
    const rotBtns = [0, 1, 2, 3].map(r => `<button aria-pressed="${ui.placeRot === r}" data-act="placeRot" data-arg="${r}" title="${r * 90}°">${rotIcon(r, ui.placeFlip)}</button>`).join('');
    const altOpts = [...doc.blockOrder.filter(id => id !== ui.activeBlock).map(id => `<option value="${id}">${esc(doc.blocks[id].name)}</option>`), ...doc.fabrics.map(f => `<option value="fab:${f.id}">Plain ${esc(f.name)}</option>`)].join('');
    h += section('Place blocks', `<div class="hint" style="margin-top:0">Rotation for new blocks</div><div class="rot-grid">${rotBtns}</div>
      <label class="check"><input type="checkbox" ${ui.placeFlip ? 'checked' : ''} data-change="placeFlip"> Mirror new blocks</label>
      <div class="btn-row"><button class="btn small" data-act="fillLayout" data-arg="empty">Fill empty</button><button class="btn small" data-act="fillLayout" data-arg="all">Fill all</button><button class="btn small danger" data-act="clearLayout">Clear</button></div>
      <h4>Alternate with</h4><div class="row" style="display:flex;gap:6px"><select id="alt-with" style="flex:1">${altOpts}</select><button class="btn small" data-act="alternateWith">Apply</button></div>
      <h4>Rotation pattern</h4><div class="btn-row">${[['same', 'All same'], ['alternate', 'Alternate'], ['pinwheel', 'Pinwheel'], ['quadrants', 'Quadrants'], ['random', 'Random']].map(([k, l]) => `<button class="btn small" data-act="rotPattern" data-arg="${k}">${l}</button>`).join('')}</div>`, { key: 'place' });
  }

  if (ui.selCell) {
    const c = cellContent(ui.selCell);
    const cell = Q.cells.find(x => x.key === ui.selCell);
    let body;
    if (c?.b) body = `<p class="hint" style="margin-top:0"><b>${esc(doc.blocks[c.b].name)}</b> · ${(c.r || 0) * 90}°${c.f ? ' · mirrored' : ''}</p>
      <div class="btn-row"><button class="btn small" data-act="cellRotate">↻ Rotate</button><button class="btn small" data-act="cellFlip">⇋ Mirror</button><button class="btn small" data-act="cellEdit">Edit block</button></div>
      <div class="btn-row"><button class="btn small" data-act="cellReplace" ${activeBlock() ? '' : 'disabled'}>Replace with ${esc(activeBlock()?.name || 'selected')}</button><button class="btn small danger" data-act="cellClear">Clear</button></div>`;
    else if (c?.fab) body = `<p class="hint" style="margin-top:0">Plain ${esc(fabricLabel(c.fab))}</p><div class="btn-row"><button class="btn small" data-act="cellReplace" ${cell && activeBlock() ? '' : 'disabled'}>Put ${esc(activeBlock()?.name || 'block')} here</button><button class="btn small danger" data-act="cellClear">Clear</button></div>`;
    else body = `<p class="hint" style="margin-top:0">Empty position.</p><div class="btn-row"><button class="btn small" data-act="cellReplace" ${cell && activeBlock() ? '' : 'disabled'}>Put ${esc(activeBlock()?.name || 'block')} here</button></div>`;
    h += section('Selected position', body, { key: 'selcell' });
  }

  if (L.mode === 'grid') {
    const s = L.grid.sashing;
    h += section('Sashing', `${lenField('Width (0 = none)', 'layout.grid.sashing.width', { min: 0, max: 12 })}
      ${s.width > 0 ? `<div class="hint">Fabric</div>${fabricPicker(s.fabric, 'sashFab')}
      <label class="check"><input type="checkbox" data-bind="layout.grid.sashing.outer" data-type="bool" ${s.outer ? 'checked' : ''}> Sashing around the outside too</label>
      <label class="check"><input type="checkbox" data-bind="layout.grid.sashing.cornerstones" data-type="bool" ${s.cornerstones ? 'checked' : ''}> Cornerstones</label>
      ${s.cornerstones ? fabricPicker(s.cornerFabric, 'cornerFab') : ''}` : ''}`, { key: 'sashing' });
  }

  let borders = L.borders.map((b, i) => `<div class="list-item"><div class="li-h"><b>Border ${i + 1}</b><button class="btn small ghost" data-act="removeBorder" data-arg="${i}" aria-label="Remove border ${i + 1}">✕</button></div>
      ${lenField('Width', `layout.borders.${i}.width`, { min: 0.25, max: 24 })}
      ${fabricPicker(b.fabric, 'borderFab').replace(/data-arg="([^"]+)"/g, `data-arg="${i}|$1"`)}</div>`).join('');
  h += section('Borders', `${borders || '<p class="hint" style="margin-top:0">No borders.</p>'}<div class="btn-row"><button class="btn small" data-act="addBorder">+ Add border</button></div>`, { key: 'borders' });

  const bnd = L.binding;
  h += section('Binding & background', `<div class="hint" style="margin-top:0">Binding fabric</div>${fabricPicker(bnd.fabric, 'bindingFab')}
    <div class="btn-row"><button class="btn small" data-act="bindingNone" ${bnd.fabric ? '' : 'disabled'}>No binding</button></div>
    ${bnd.fabric ? lenField('Binding strip width (cut)', 'layout.binding.width', { min: 1, max: 4 }) : ''}
    <div class="hint" style="margin-top:12px">Quilt background — used by every block piece set to “Quilt BG”</div>${fabricPicker(L.background, 'bgFab')}`, { key: 'binding' });
  return h;
}
