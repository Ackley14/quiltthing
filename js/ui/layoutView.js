/* Layout view: arrange blocks (straight set / on point) or colour a tessellation; sashing,
   borders, binding and background. */

const LAYOUT_TOOLS = [
  { key: 'place', label: 'Place', kb: 'B', icon: 'place' },
  { key: 'paintcell', label: 'Paint', kb: 'V', icon: 'paint' },
  { key: 'select', label: 'Select', kb: 'S', icon: 'select' },
];
const lay = { drag: null };
const hasPanels = () => (doc.layout.panels || []).length > 0;
const tessHasPanels = () => doc.layout.mode === 'tess' && hasPanels();
const tessHexBlocks = () => doc.layout.mode === 'tess' && doc.layout.tess.shape === 'hex';
// Tessellations can take blocks in inset panels, and hexagon blocks in hexagon tiles.
const tessCanPlace = () => tessHasPanels() || tessHexBlocks();
function layoutTool() {
  if (doc.layout.mode === 'tess' && ui.layoutTool === 'place' && !tessCanPlace()) return 'paintcell';
  return ui.layoutTool || (doc.layout.mode === 'tess' ? 'paintcell' : 'place');
}

Views.layout = {
  tools() {
    const hexMode = doc.layout.mode === 'tess';
    return { act: 'layoutTool', active: layoutTool(), list: LAYOUT_TOOLS.filter(t => !(hexMode && t.key === 'place' && !tessCanPlace())) };
  },
  docs() { return [{ label: `${doc.meta.title || 'Quilt'} · layout`, on: true, icon: 'quilt' }]; },
  options() {
    const tool = layoutTool(), L = doc.layout;
    let opts = '';
    if (tool === 'place') {
      const b = placeBlock(), hexB = b && isHexBlock(b), steps = hexB ? 6 : 4;
      const turns = Array.from({ length: steps }, (_, r) => `<button class="tool icon-only rot" data-act="placeRot" data-arg="${r}" aria-pressed="${ui.placeRot % steps === r}" title="Turn new blocks ${r * (hexB ? 60 : 90)}°" aria-label="${r * (hexB ? 60 : 90)}°">${hexB ? `${r * 60}°` : rotIcon(r, ui.placeFlip)}</button>`).join('');
      opts = `<button class="tool fab-drop" data-act="placeBlockMenu" aria-haspopup="menu" title="The block to place">${b ? `${blockThumb(b, 20, 'mini')} ${esc(b.name)}` : 'Choose a block'} ${icon('down', 12)}</button>
        <span class="tb-label">Turn</span>${turns}
        <button class="tool toggle" data-act="placeFlipToggle" aria-pressed="${!!ui.placeFlip}" title="Mirror new blocks (Shift)">Mirror</button>
        <span class="sep"></span><button class="tool" data-act="arrangeMenu" aria-haspopup="menu">Arrange ${icon('down', 12)}</button>`;
    } else if (tool === 'paintcell') {
      opts = `<span class="tb-label">Paint with</span><button class="tool fab-drop" data-act="paintFabricMenu" aria-haspopup="menu">${swatchHtml(ui.fabric === BG ? L.background : ui.fabric, 16)} ${esc(fabricLabel(ui.fabric))} ${icon('down', 12)}</button>`;
    } else if (ui.selCell) {
      const c = cellContent(ui.selCell), pb = placeBlock(), cellOk = Qnow().cells.some(x => x.key === ui.selCell) || ui.selCell[0] === 'p';
      opts = c?.b
        ? `<span class="tb-label"><b>${esc(doc.blocks[c.b].name)}</b> · ${(c.r || 0) * (ui.selCell[0] === 't' ? 60 : 90)}°${c.f ? ' · mirrored' : ''}</span>
          <button class="tool" data-act="cellRotate">Rotate 90°</button><button class="tool" data-act="cellFlip">Flip</button><button class="tool" data-act="cellEdit">Edit block</button>
          ${pb && pb.id !== c.b ? `<button class="tool" data-act="cellReplace">Replace with ${esc(pb.name)}</button>` : ''}<button class="tool danger" data-act="cellClear">Clear</button>`
        : `<span class="tb-label">${c?.fab ? `Plain ${esc(fabricLabel(c.fab))}` : 'Empty position'}</span>${pb && cellOk ? `<button class="tool" data-act="cellReplace">Put ${esc(pb.name)} here</button>` : ''}${c?.fab ? '<button class="tool danger" data-act="cellClear">Clear</button>' : ''}`;
    } else opts = '<span class="tb-label">Click a position to change it</span>';
    return opts;
  },
  main() {
    const Q = Qnow(), tool = layoutTool();
    return `<div class="stage"><div class="canvas-wrap">${layoutCanvasSvg(Q)}</div>
      <div class="status-bar">${(lw => lw.length ? `<span class="sb-warn">${esc(lw.join(' '))}</span>` : '')([...Q.warnings, ...seamWarnings()])}<span class="sb-hint">${layoutHint(tool)}</span></div></div>`;
  },
  afterMain(el) {
    const svg = el.querySelector('svg.quilt-svg');
    if (!svg) return;
    svg.addEventListener('pointerdown', layDown);
    svg.addEventListener('pointermove', layMove);
    svg.addEventListener('pointerup', layUp);
    svg.addEventListener('pointerleave', () => { if (!lay.drag) hoverCell(null); });
    svg.addEventListener('contextmenu', e => e.preventDefault());
    // blocks dragged in from My blocks
    // or a fabric onto a plain square, setting triangle or shape
    const fabTarget = e => { const key = layTarget(e); return dragFabricId && key && !cellContent(key)?.b ? key : null; };
    svg.addEventListener('dragover', e => { const key = fabTarget(e); if (key) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; hoverCell(key); } });
    svg.addEventListener('drop', e => { const key = fabTarget(e); if (key) { e.preventDefault(); setCellContent(key, { fab: resolveFab(dragFabricId) }); commit(); } });
    svg.addEventListener('dragover', e => {
      const key = layTarget(e), b = doc.blocks[dragBlockId];
      if (!b || !key || !isBlockKey(key) || !keyAcceptsBlock(key, b)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; hoverCell(key);
    });
    svg.addEventListener('dragleave', () => hoverCell(null));
    svg.addEventListener('drop', e => {
      const key = layTarget(e), b = doc.blocks[dragBlockId];
      if (!b || !key || !keyAcceptsBlock(key, b)) return;
      e.preventDefault();
      setCellContent(key, { b: b.id, r: 0, f: false });
      ui.placeBlock = b.id;
      commit();
    });
  },
  props() { return layoutProps(); },
  inspector() { return layoutInspector(); },
  key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const t = LAYOUT_TOOLS.find(x => x.kb.toLowerCase() === k);
    if (t && !(k === 'b' && doc.layout.mode === 'tess' && !tessCanPlace())) { Actions.layoutTool(t.key); return; }
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
  svg.innerHTML = n.innerHTML;
  qzRebase(svg, n.getAttribute('viewBox'));
}
function layoutCountText(Q) {
  const blocks = Q.cells.filter(c => c.b).length, plain = Q.cells.filter(c => c.fab).length;
  if (Q.mode === 'tess') {
    const hb = Q.cells.filter(c => c.hex);
    return `${Q.tiles.filter(t => t.whole).length} whole ${tessShape(doc.layout.tess.shape).label.toLowerCase()}${hb.length ? ` + ${plural(hb.length, 'hexagon block')}` : ''}, ${Q.tiles.filter(t => !t.whole).length + hb.filter(c => c.clip).length} edge pieces`;
  }
  return `${plural(blocks, 'block')}${plain ? ` + ${plural(plain, 'plain square')}` : ''}`;
}
function layoutHint(tool) {
  if (tool === 'place' && tessHexBlocks()) return 'Click or drag to place. Click again to turn. Right-click to clear.';
  if (tool === 'place') return 'Click or drag to place. Click again to turn, Shift to mirror. Right-click to clear.';
  if (tool === 'paintcell') return doc.layout.mode === 'tess' ? 'Click or drag to paint shapes. Right-click to reset.' : 'Paint plain squares or setting triangles. Right-click to clear.';
  return 'Click a position to change it.';
}

/* ---------- cell operations ---------- */
function isBlockKey(key) {
  if (key[0] === 'g' || key[0] === 'p') return true;
  if (key[0] === 'o') { const Q = Qnow(); return Q.cells.some(c => c.key === key) || Q.tiles.some(t => t.key === key); }   // setting triangles take (halved) blocks too
  if (key[0] === 't' && tessHexBlocks()) { const Q = Qnow(); return Q.cells.some(c => c.key === key) || Q.tiles.some(t => t.key === key && t.role !== 'fill'); }
  return false;
}
// Hexagon tiles take hexagon blocks; every other position takes square blocks.
const keyAcceptsBlock = (key, b) => !!b && (key[0] === 't') === isHexBlock(b);
const rotSteps = key => key[0] === 't' ? 6 : 4;
function rotateCell(key, by = 1) {
  const c = cellContent(key), n = rotSteps(key);
  if (c?.b) setCellContent(key, { ...c, r: ((c.r || 0) + by + n) % n });
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
  const b = placeBlock();
  if (!b) { if (first) toast('Pick a block in the sidebar first'); return false; }
  if (!keyAcceptsBlock(key, b)) {
    if (first) toast(isHexBlock(b) ? 'Hexagon blocks go in a hexagon tessellation' : 'Hexagons take hexagon blocks');
    return false;
  }
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
  setCellContent(key, { b: b.id, r: ui.placeRot % rotSteps(key), f: flip });
  return true;
}
function layDown(e) {
  const key = layTarget(e);
  if (key?.[0] === 'p' && layoutTool() === 'select' && e.button === 0) {
    const p = doc.layout.panels.find(x => x.id === key.slice(1));
    const svg = e.currentTarget;
    svg.setPointerCapture(e.pointerId);
    lay.drag = { panel: p, start: svgPoint(svg, e), dx: p.dx || 0, dy: p.dy || 0, moved: false, keys: new Set(), changed: false };
    ui.selCell = key;
    return;
  }
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
  if (lay.drag?.panel) {
    const d = lay.drag, [x, y] = svgPoint(e.currentTarget, e);
    const nx = snapPanel(d.panel, Math.round((d.dx + x - d.start[0]) * 2) / 2, 'x'), ny = snapPanel(d.panel, Math.round((d.dy + y - d.start[1]) * 2) / 2, 'y');
    if (nx !== d.panel.dx || ny !== d.panel.dy) { d.panel.dx = nx; d.panel.dy = ny; d.moved = true; refreshLayoutCanvas(); }
    return;
  }
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
  if (d?.panel) { if (d.moved) commit(); else renderView(); return; }
  if (d?.changed) commit();
}
function hoverCell(key) {
  lay.hoverKey = key;
  const layer = $('#main .hover-layer');
  if (!layer) return;
  if (!key) { layer.innerHTML = ''; return; }
  const Q = Qnow();
  let c = Q.cells.find(x => x.key === key) || Q.tiles.find(x => x.key === key);
  if (!c) return;
  const w = Math.max(Q.W, Q.H) * 0.004;
  let ghost = '';
  if (!c.size && key[0] === 't' && tessHexBlocks()) {
    // a plain hexagon: preview the block where it would sit
    const t = doc.layout.tess, [cx, cy] = centroid(c.full || c.pts);
    c = { ...c, cx, cy, angle: t.orient === 1 ? 0 : 30, size: 2 * t.size, rstep: 60 };
  } else if (!c.size && key[0] === 'o' && c.full) {
    // a setting triangle: preview the whole block it would be cut from
    const [cx, cy] = centroid(c.full);
    c = { ...c, cx, cy, angle: 45, size: doc.layout.blockSize };
  }
  if (layoutTool() === 'place' && c.size && keyAcceptsBlock(key, placeBlock()) && isBlockKey(key)) {
    const cur = cellContent(key);
    // preview what a click would do: mirrored with Shift, keeping rotation when flipping in place
    const g = lay.shift && cur?.b === placeBlock().id ? { ...c, rot: cur.r || 0, flip: !cur.f } : { ...c, rot: ui.placeRot % rotSteps(key), flip: lay.shift ? !ui.placeFlip : ui.placeFlip };
    ghost = `<g opacity=".55" transform="${cellTransform(g)}">${blockSvg(placeBlock(), c.size, c.size)}</g>`;
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
Actions.placeFlipToggle = () => { ui.placeFlip = !ui.placeFlip; saveUi(); render(); };
// The block the Place tool puts down
Actions.placeBlockMenu = (a, el) => {
  const hexOnly = doc.layout.mode === 'tess' && !tessHasPanels(), pick = id => hexOnly ? isHexBlock(doc.blocks[id]) : true;
  openMenu(el, [...doc.blockOrder.filter(pick).map(id => ({ label: `${blockThumb(doc.blocks[id], 18, 'mini')} ${esc(doc.blocks[id].name)}`, act: 'placePick', arg: id, checked: placeBlock()?.id === id })),
    '-', { label: 'From the library…', act: 'libraryPicker' }], { align: 'left' });
};
Actions.placePick = id => { ui.placeBlock = id; saveUi(); render(); };
// Whole-layout arranging: fill, alternate, turn patterns, clear
Actions.arrangeMenu = (a, el) => {
  const pb = placeBlock(), tess = doc.layout.mode === 'tess';
  const others = [...doc.blockOrder.filter(id => id !== pb?.id && !isHexBlock(doc.blocks[id])).map(id => ({ label: esc(doc.blocks[id].name), act: 'alternatePick', arg: id })),
    ...doc.fabrics.map(f => ({ label: `${swatchHtml(f.id, 14)} Plain ${esc(f.name)}`, act: 'alternatePick', arg: 'fab:' + f.id }))];
  openMenu(el, [
    { label: tess ? 'Fill plain hexagons' : 'Fill empty positions', act: 'fillLayout', arg: 'empty', disabled: !pb },
    { label: tess ? 'Fill all hexagons' : 'Fill all positions', act: 'fillLayout', arg: 'all', disabled: !pb },
    ...(tess ? [{ label: 'Random turns', act: 'hexTurns', arg: 'random' }, { label: 'All upright', act: 'hexTurns', arg: 'same' }]
      : [{ header: `Alternate ${pb ? esc(pb.name) : 'the block'} with` }, ...others,
        { header: 'Turn the blocks' }, ...[['same', 'All the same'], ['alternate', 'Alternate'], ['pinwheel', 'Pinwheel'], ['quadrants', 'Quadrants'], ['random', 'Random']].map(([k, l]) => ({ label: l, act: 'rotPattern', arg: k }))]),
    '-', { label: 'Clear layout…', act: 'clearLayout', danger: true },
  ], { align: 'left' });
};
Actions.alternatePick = v => { ui.altWith = v; Actions.alternateWith(); };
Actions.placeFlip = v => { ui.placeFlip = !!v; saveUi(); render(); };
Actions.cellRotate = () => { if (ui.selCell) { rotateCell(ui.selCell); commit(); } };
Actions.cellFlip = () => { if (ui.selCell) { flipCell(ui.selCell); commit(); } };
Actions.cellClear = () => { if (ui.selCell) { clearCell(ui.selCell); commit(); } };
Actions.cellEdit = () => { const c = cellContent(ui.selCell); if (c?.b) { ui.activeBlock = ui.placeBlock = c.b; Actions.view('block'); } };
Actions.cellReplace = () => {
  const b = placeBlock();
  if (!ui.selCell || !b || !isBlockKey(ui.selCell)) return;
  if (!keyAcceptsBlock(ui.selCell, b)) { toast(isHexBlock(b) ? 'Hexagon blocks go in the hexagons of a hexagon tessellation' : 'Hexagons take hexagon blocks'); return; }
  setCellContent(ui.selCell, { b: b.id, r: ui.placeRot % rotSteps(ui.selCell), f: ui.placeFlip }); commit();
};

// Regular block positions (inset panels keep their own contents).
function blockCellKeys() {
  const Q = Qnow(), keys = Q.cells.filter(c => c.key[0] !== 'p').map(c => c.key);
  if (tessHexBlocks()) keys.push(...Q.tiles.filter(t => t.key?.[0] === 't' && t.role !== 'fill').map(t => t.key));
  return uniq(keys);
}
Actions.fillLayout = mode => {
  const b = placeBlock();
  if (!b) { toast('Pick a block in the sidebar first'); return; }
  const keys = blockCellKeys().filter(k => keyAcceptsBlock(k, b));
  if (!keys.length) { toast(isHexBlock(b) ? 'Hexagon blocks go in the hexagons of a hexagon tessellation' : 'No square block positions here'); return; }
  for (const k of keys) {
    if (mode === 'empty' && (k[0] === 't' ? cellContent(k)?.b : cellContent(k))) continue;
    setCellContent(k, { b: b.id, r: ui.placeRot % rotSteps(k), f: ui.placeFlip });
  }
  commit();
};
// Hexagon blocks: random turns (in 60° steps) for a scrappy look.
Actions.hexTurns = kind => {
  const R = rng(Date.now() & 0xffff);
  for (const c of Qnow().cells) {
    if (!c.hex) continue;
    const cur = cellContent(c.key);
    if (cur?.b) setCellContent(c.key, { ...cur, r: kind === 'random' ? Math.floor(R() * 6) : 0 });
  }
  commit();
};
Actions.alternateWith = () => {
  const b = placeBlock(), sel = ui.altWith;
  if (!b || !sel) { toast('Pick a block in the sidebar, and something to alternate with'); return; }
  const second = sel.startsWith('fab:') ? { fab: sel.slice(4) } : { b: sel, r: 0, f: false };
  for (const c of Qnow().cells.filter(c => c.key[0] !== 'p')) {
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
    if (!cur?.b || c.key[0] === 'p') return;
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
Actions.clearLayout = () => confirmModal('Clear the layout?', 'Removes every block and painted square from the layout (your blocks stay in Quilt blocks).', 'Clear layout', () => {
  const L = doc.layout;
  L.grid.cells = L.grid.cells.map(() => null); delete L.grid.hidden;
  L.onpoint.cells = {};
  L.tess.colors = {};
  L.tess.blocks = {};
  commit();
}, true);

Actions.tessShape = v => {
  const t = doc.layout.tess, s = tessShape(v);
  t.shape = v; t.ratio = s.ratio; t.lean = s.lean; t.orient = 0; t.colors = {}; t.blocks = {};
  commit();
};
Actions.tessEdge = v => { doc.layout.tess.edge = v; commit(); };
Actions.tessFill = id => { doc.layout.tess.fill = id; commit(); };
Actions.tessBase = id => { doc.layout.tess.base = id; commit(); };
/* 3D cube shading for tumbling blocks */
Actions.cubeFace = arg => {
  const [face, id] = arg.split('|'), t = doc.layout.tess;
  const F = doc.fabrics.map(f => f.id);
  t.faces = t.faces || { top: F[0], left: F[2] || F[1], right: F[1] };
  t.faces[face] = id;
  commit();
};
Actions.cubeShade = () => {
  const t = doc.layout.tess, F = doc.fabrics.slice().sort((a, b) => hexToLab(b.color)[0] - hexToLab(a.color)[0]).map(f => f.id);
  // lightest on top, middle value on the left, darkest on the right — reads as light from the upper left
  t.faces = t.faces || { top: F[0], left: F[Math.floor(F.length / 2)], right: F[F.length - 1] };
  t.colors = {};
  commit();
  toast('Cubes shaded');
};
Actions.cubeOff = () => { doc.layout.tess.faces = null; commit(); };
/* inset panels */
const panelById = id => (doc.layout.panels || []).find(p => p.id === id);
// In a straight set, a dragged panel's edges snap to the block seams when they come close.
function snapPanel(p, off, axis) {
  const L = doc.layout;
  if (L.mode !== 'grid') return off;
  const g = L.grid, BS = L.blockSize, sw = g.sashing.width || 0, o = g.sashing.outer ? sw : 0, pitch = BS + sw;
  const n = axis === 'x' ? g.cols : g.rows, span = axis === 'x' ? Qnow().inner.w : Qnow().inner.h;
  const outer = panelGeom(p, 1, 1).outer;
  let best = off, bestD = 0.75;
  for (let c = 0; c <= n; c++) {
    for (const cand of [o + c * pitch + outer / 2 - span / 2, o + c * pitch - sw - outer / 2 - span / 2]) {
      if (Math.abs(cand - off) < bestD) { bestD = Math.abs(cand - off); best = round(cand, 3); }
    }
  }
  return best;
}
// Slide a tessellation on the quilt by a share of one repeat (0–95%), shown in inches too.
function nudgeField(label, key, period) {
  const v = Math.round(((doc.layout.tess[key] || 0) % 1) * 100);
  return `<label class="f">${label} <span class="muted">${fmtLen(v / 100 * period)}</span><input type="range" min="0" max="95" step="5" value="${v}" data-input="tessNudgeLive" data-change="tessNudge" data-arg="${key}"></label>`;
}
Actions.tessNudgeLive = (v, el) => { doc.layout.tess[el.dataset.arg] = +v / 100; renderMainOnly(); };
Actions.tessNudge = (v, el) => { doc.layout.tess[el.dataset.arg] = +v / 100; commit(); };
// Blocks partly covered by a panel or the edge: cut just what shows, or make them whole and trim.
function partialToggle() {
  return `<label class="check"><input type="checkbox" data-bind="layout.panelExact" data-type="bool" ${doc.layout.panelExact !== false ? 'checked' : ''}> Cut partial blocks to shape</label>`;
}
Actions.addPanel = () => {
  const L = doc.layout;
  L.panels = L.panels || [];
  const I = Qnow().inner;
  let size = Math.max(6, Math.round(Math.min(I.w, I.h) * 0.4 / 2) * 2), dy = L.panels.length * 4;
  if (L.mode === 'grid' && !L.panels.length) {
    // cover whole blocks: k × k positions, centred on block seams so no block is cut into
    const g = L.grid, BS = L.blockSize, sw = g.sashing.width || 0, n = Math.min(g.rows, g.cols);
    let k = Math.max(1, Math.round(n * 0.4));
    if (k % 2 !== g.cols % 2) k = k + 1 <= n ? k + 1 : Math.max(1, k - 1);
    size = Math.max(2, k * BS + (k - 1) * sw - 6);
    dy = k % 2 === g.rows % 2 ? 0 : (BS + sw) / 2;
  }
  const F = doc.fabrics.map(f => f.id);
  const blk = placeBlock() && !isHexBlock(placeBlock()) ? placeBlock().id : null;
  L.panels.push({ id: uid('p'), size, dx: 0, dy, b: blk, fab: blk ? null : F[0],
    frames: [{ width: 1, fabric: F[F.length > 2 ? F.length - 1 : 1] }, { width: 1, fabric: F[3] || F[1] }, { width: 1, fabric: F[F.length > 2 ? F.length - 1 : 1] }] });
  ui.layoutTool = 'select';
  commit();
};
Actions.removePanel = id => { const L = doc.layout; L.panels = L.panels.filter(p => p.id !== id); if (ui.selCell === 'p' + id) ui.selCell = null; commit(); };
Actions.panelCentre = id => { const p = panelById(id); p.dx = 0; p.dy = 0; commit(); };
Actions.panelContent = (v, el) => {
  const p = panelById(el.dataset.arg);
  if (v.startsWith('fab:')) { p.fab = v.slice(4); p.b = null; } else { p.b = v || null; p.fab = null; }
  commit();
};
Actions.panelFrameAdd = id => { const p = panelById(id); p.frames = p.frames || []; p.frames.push({ width: 1, fabric: doc.fabrics[1].id }); commit(); };
Actions.panelFrameRemove = arg => { const [id, k] = arg.split('|'); panelById(id).frames.splice(+k, 1); commit(); };
Actions.panelFrameFab = arg => { const [id, k, fab] = arg.split('|'); panelById(id).frames[+k].fabric = fab; commit(); };
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
  const modeTips = { grid: 'Blocks in rows and columns', onpoint: 'Blocks turned 45° with setting triangles', tess: 'One repeating shape: hexagons, triangles, bolts and more' };
  let h = section('Setting', `<div class="seg" role="group" aria-label="Setting">
      ${[['grid', 'Straight'], ['onpoint', 'On point'], ['tess', 'Tessellation']].map(([k, l]) => `<button aria-pressed="${L.mode === k}" data-act="layoutMode" data-arg="${k}" title="${modeTips[k]}">${l}</button>`).join('')}</div>
    <p class="hint">Finished quilt <b>${fmtSize(Q.W, Q.H)}</b> · ${layoutCountText(Q)}</p>`, { key: 'setting' });

  if (L.mode === 'grid') {
    h += section('Size', `<div class="f-row">
        <label class="f">Rows<input type="number" min="1" max="40" value="${L.grid.rows}" data-change="layoutRows"></label>
        <label class="f">Columns<input type="number" min="1" max="40" value="${L.grid.cols}" data-change="layoutCols"></label></div>
      ${lenField('Block size', 'layout.blockSize', { min: 1, max: 48 })}`, { key: 'size' });
  } else if (L.mode === 'onpoint') {
    h += section('Size', `<div class="f-row">
        ${numField('Blocks down', 'layout.onpoint.rows', { int: true, min: 1, max: 20 })}
        ${numField('Blocks across', 'layout.onpoint.cols', { int: true, min: 1, max: 20 })}</div>
      ${lenField('Block size', 'layout.blockSize', { min: 1, max: 48 })}
      <label class="f">Setting triangles</label>${fabricPicker(L.onpoint.fill, 'onpointFill')}`, { key: 'size' });
  } else {
    const t = L.tess, sh = tessShape(t.shape);
    h += section('Shape', `<label class="f">Shape<select data-change="tessShape">${TESS_SHAPES.map(s => `<option value="${s.key}" ${s.key === t.shape ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      <div class="f-row">${lenField(t.shape === 'hex' || t.shape === 'tumbling' || t.shape === 'triangle' ? 'Side length' : 'Width', 'layout.tess.size', { min: 0.5, max: 40 })}
        <label class="f">Orientation<select data-bind="layout.tess.orient" data-type="int">${sh.orientLabels.map((l, i) => `<option value="${i}" ${t.orient === i ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      ${['zigzag', 'brick', 'diamond'].includes(t.shape) ? `<div class="f-row">${numField('Height ÷ width', 'layout.tess.ratio', { min: 0.2, max: 4, step: 0.05 })}${t.shape === 'zigzag' ? numField('Lean ÷ width', 'layout.tess.lean', { min: 0, max: 2, step: 0.05 }) : ''}</div>` : ''}
      <div class="f-row">${lenField('Centre width', 'layout.tess.width', { min: 2, max: 200 })}${lenField('Centre height', 'layout.tess.height', { min: 2, max: 200 })}</div>
      <div class="f-row">${nudgeField('Nudge across', 'offX', tessPeriod(t)[0])}${nudgeField('Nudge down', 'offY', tessPeriod(t)[1])}</div>
      <label class="check"><input type="checkbox" data-bind="layout.tess.snap" data-type="bool" ${t.snap !== false ? 'checked' : ''}> Fit to whole shapes</label>
      ${t.snap !== false ? `<p class="hint">Fitted size ${fmtSize(...tessSize(t))}.</p>` : ''}
      <label class="f">Edges</label><div class="seg">${[['trim', 'Trim shapes'], ['fill', 'Fill gaps']].map(([k, l]) => `<button aria-pressed="${t.edge === k}" data-act="tessEdge" data-arg="${k}">${l}</button>`).join('')}</div>
      ${t.edge === 'trim' ? `<label class="check"><input type="checkbox" data-bind="layout.tess.cutEdges" data-type="bool" ${t.cutEdges ? 'checked' : ''}> Cut edge pieces to shape</label>` : `<label class="f">Gap fabric</label>${fabricPicker(t.fill, 'tessFill')}`}
      <label class="f">Base fabric</label>${fabricPicker(t.base, 'tessBase')}`, { key: 'shape' });
    const set = paintSet();
    if (t.shape === 'tumbling') {
      const fc = t.faces;
      h += section('3D cubes', fc ? `${[['top', 'Top faces'], ['left', 'Left faces'], ['right', 'Right faces']].map(([k, l]) => `<label class="f">${l}</label>${fabricPicker(fc[k], 'cubeFace').replace(/data-arg="([^"]+)"/g, `data-arg="${k}|$1"`)}`).join('')}
        <div class="btn-row"><button class="btn small" data-act="cubeShade" title="Clear painted diamonds and shade every cube again">Shade again</button><button class="btn small quiet" data-act="cubeOff">Turn off</button></div>`
        : `<p class="hint">Light tops, medium left faces and dark right faces.</p><div class="btn-row"><button class="btn small primary" data-act="cubeShade">Shade as 3D cubes</button></div>`, { key: 'cubes' });
    }
    h += section('Fill patterns', `<label class="f">Fabrics to use</label>
      <div class="fabpick">${doc.fabrics.map(f => `<button aria-pressed="${set.includes(f.id)}" data-act="tessToggleSet" data-arg="${f.id}" title="${esc(f.name)}">${swatchHtml(f.id, 20)}</button>`).join('')}</div>
      <div class="btn-row">${[['random', 'Random'], ['rows', 'Rows'], ['cols', 'Columns'], ['diag', 'Diagonals'], ['rings', 'Rings'], ['gradient', 'Gradient'], ['orient', 'By direction']].map(([k, l]) => `<button class="btn small" data-act="tessPattern" data-arg="${k}">${l}</button>`).join('')}</div>
      <div class="btn-row"><button class="btn small" data-act="tessPattern" data-arg="shuffle">Shuffle</button><button class="btn small" data-act="tessPattern" data-arg="solid" title="Paint every shape with the selected fabric">Paint all</button><button class="btn small quiet danger" data-act="clearLayout">Clear</button></div>`, { key: 'tessfill' });
  }



  let borders = L.borders.map((b, i) => `<div class="list-item"><div class="li-h"><b>Border ${i + 1}</b><button class="icon-btn sm" data-act="removeBorder" data-arg="${i}" aria-label="Remove border ${i + 1}" title="Remove">${icon('x', 14)}</button></div>
      ${lenField('Width', `layout.borders.${i}.width`, { min: 0.25, max: 24 })}
      ${fabricPicker(b.fabric, 'borderFab').replace(/data-arg="([^"]+)"/g, `data-arg="${i}|$1"`)}</div>`).join('');
  h += section('Borders', `${borders}<div class="btn-row"><button class="btn small" data-act="addBorder">${icon('plus', 14)} Add border</button></div>`, { key: 'borders' });

  const bnd = L.binding;
  h += section('Binding', `${fabricPicker(bnd.fabric, 'bindingFab')}
    ${bnd.fabric ? `${lenField('Strip width', 'layout.binding.width', { min: 1, max: 4 })}<div class="btn-row"><button class="btn small quiet" data-act="bindingNone">No binding</button></div>` : '<p class="hint">No binding.</p>'}`, { key: 'binding' });

  if (L.mode === 'grid') {
    const s = L.grid.sashing;
    h += section('Sashing', `${lenField('Width', 'layout.grid.sashing.width', { min: 0, max: 12 })}
      ${s.width > 0 ? `<label class="f">Fabric</label>${fabricPicker(s.fabric, 'sashFab')}
      <label class="check"><input type="checkbox" data-bind="layout.grid.sashing.outer" data-type="bool" ${s.outer ? 'checked' : ''}> Around the outside too</label>
      <label class="check"><input type="checkbox" data-bind="layout.grid.sashing.cornerstones" data-type="bool" ${s.cornerstones ? 'checked' : ''}> Cornerstones</label>
      ${s.cornerstones ? fabricPicker(s.cornerFabric, 'cornerFab') : ''}` : '<p class="hint">0 for none.</p>'}`, { key: 'sashing', closed: !(s.width > 0) });
  }

  {
    const panels = L.panels || [];
    const contentOpts = cur => ['<option value="">Empty</option>', ...doc.blockOrder.filter(id => !isHexBlock(doc.blocks[id])).map(id => `<option value="${id}" ${cur.b === id ? 'selected' : ''}>${esc(doc.blocks[id].name)}</option>`), ...doc.fabrics.map(f => `<option value="fab:${f.id}" ${cur.fab === f.id ? 'selected' : ''}>Plain ${esc(f.name)}</option>`)].join('');
    h += section('Inset panel', `${panels.length ? '' : '<p class="hint">A framed square set into the quilt, for a medallion, label or logo.</p>'}
      ${panels.map((p, i) => {
        const pi = L.panels.indexOf(p);
        return `<div class="list-item"><div class="li-h"><b>Panel ${i + 1}</b><button class="icon-btn sm" data-act="panelCentre" data-arg="${p.id}" title="Centre it" aria-label="Centre panel">${icon('centre', 14)}</button><button class="icon-btn sm" data-act="removePanel" data-arg="${p.id}" title="Remove" aria-label="Remove panel">${icon('x', 14)}</button></div>
        <label class="f">Contents<select data-change="panelContent" data-arg="${p.id}">${contentOpts(p)}</select></label>
        <div class="f-row three">${lenField('Size', `layout.panels.${pi}.size`, { min: 2, max: 120 })}${lenField('Across', `layout.panels.${pi}.dx`, { min: -200, max: 200 })}${lenField('Down', `layout.panels.${pi}.dy`, { min: -200, max: 200 })}</div>
        <label class="f">Frames, inside first</label>
        ${(p.frames || []).map((fr, k) => `<div style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="text" inputmode="decimal" style="width:62px" data-bind="layout.panels.${pi}.frames.${k}.width" data-type="len" data-min="0" data-max="24" value="${esc(inputLen(fr.width))}" aria-label="Frame width">
          ${fabricPicker(fr.fabric, 'panelFrameFab').replace(/data-arg="([^"]+)"/g, `data-arg="${p.id}|${k}|$1"`)}<button class="icon-btn sm" data-act="panelFrameRemove" data-arg="${p.id}|${k}" aria-label="Remove frame" title="Remove frame">${icon('x', 14)}</button></div>`).join('')}
        <div class="btn-row"><button class="btn small" data-act="panelFrameAdd" data-arg="${p.id}">${icon('plus', 14)} Frame</button></div></div>`;
      }).join('')}
      <div class="btn-row"><button class="btn small" data-act="addPanel">${icon('plus', 14)} Add panel</button></div>
      ${panels.length ? '<p class="hint">Drag it with Select. Its edges snap to the block seams.</p>' : ''}
      ${L.mode !== 'tess' && Q.cells.some(c => c.b && c.clip) ? partialToggle() : ''}`, { key: 'panels', closed: !panels.length });
  }

  h += section('Background', `${fabricPicker(L.background, 'bgFab')}<p class="hint">Block pieces painted BG use this fabric.</p>`, { key: 'bgfab', closed: true });
  return h;
}

/* ---------- the Quilt panel: the parts of the quilt; the selected part opens in Properties ---------- */
function quiltParts() {
  const L = doc.layout, Q = Qnow(), t = L.tess;
  const mode = { grid: 'Straight set', onpoint: 'On point', tess: 'Tessellation' }[L.mode];
  const size = L.mode === 'grid' ? `${L.grid.rows} × ${L.grid.cols} blocks of ${fmtLen(L.blockSize)}` : L.mode === 'onpoint' ? `${L.onpoint.rows} × ${L.onpoint.cols} on point, ${fmtLen(L.blockSize)}` : `${tessShape(t.shape).label}, ${fmtLen(t.size)}`;
  const parts = [{ key: 'setting', label: 'Setting & size', note: `${mode} · ${size}`, icon: 'quilt', keys: ['setting', 'size'] }];
  if (L.mode === 'tess') {
    parts.push({ key: 'shape', label: 'Tessellation', note: `${fmtSize(...tessSize(t))} centre · ${t.edge === 'trim' ? 'trimmed edges' : 'filled edges'}`, icon: 'blocks', keys: ['shape', 'cubes'] });
    parts.push({ key: 'tessfill', label: 'Fill patterns', note: `${paintSet().length} fabrics`, icon: 'palette', keys: ['tessfill'] });
  }
  if (L.mode === 'grid') { const s = L.grid.sashing; parts.push({ key: 'sashing', label: 'Sashing', note: s.width > 0 ? `${fmtLen(s.width)} wide${s.cornerstones ? ', cornerstones' : ''}` : 'none', icon: 'quilt', keys: ['sashing'], fab: s.width > 0 ? s.fabric : null }); }
  const pn = (L.panels || []).length;
  parts.push({ key: 'panels', label: 'Inset panels', note: pn ? plural(pn, 'panel') : 'none', icon: 'centre', keys: ['panels'] });
  parts.push({ key: 'borders', label: 'Borders', note: L.borders.length ? L.borders.map(b => fmtLen(b.width)).join(' + ') : 'none', icon: 'panelLeft', keys: ['borders'], fab: L.borders[0]?.fabric });
  parts.push({ key: 'binding', label: 'Binding', note: L.binding.fabric ? `${fmtLen(L.binding.width)} strips` : 'none', icon: 'quilt', keys: ['binding'], fab: L.binding.fabric });
  parts.push({ key: 'bgfab', label: 'Background', note: fabricLabel(L.background), icon: 'swatch', keys: ['bgfab'], fab: L.background });
  return parts;
}
function quiltPanel() {
  const parts = quiltParts(), cur = parts.some(p => p.key === ui.quiltPart) ? ui.quiltPart : 'setting', Q = Qnow();
  return `<div class="panel-tools"><span class="pt-note"><b>${fmtSize(Q.W, Q.H)}</b> finished</span><span class="grow"></span><button class="btn small" data-act="quiltAddMenu" aria-haspopup="menu">${icon('plus', 14)} Add ${icon('down', 12)}</button></div>
    <div class="part-list" role="listbox" aria-label="Parts of the quilt">${parts.map(p => `<div class="part-row" role="option" tabindex="0" aria-selected="${p.key === cur}" data-act="quiltPart" data-arg="${p.key}">
      <span class="part-ic">${p.fab ? swatchHtml(p.fab, 18) : icon(p.icon, 16)}</span><span class="part-t"><b>${esc(p.label)}</b><span class="muted">${esc(p.note)}</span></span></div>`).join('')}</div>`;
}
Actions.quiltPart = k => { ui.quiltPart = k; ui.selCell = null; saveUi(); renderToolbar(); renderInspector(); };
Actions.quiltAddMenu = (a, el) => openMenu(el, [
  { label: 'Border', act: 'addBorder' },
  { label: 'Inset panel', act: 'addPanel' },
  ...(doc.layout.mode === 'grid' && !(doc.layout.grid.sashing.width > 0) ? [{ label: 'Sashing', act: 'addSashing' }] : []),
  ...(doc.layout.binding.fabric ? [] : [{ label: 'Binding', act: 'bindingFab', arg: doc.fabrics[1]?.id || doc.fabrics[0].id }]),
]);
Actions.addSashing = () => { doc.layout.grid.sashing.width = 1.5; ui.quiltPart = 'sashing'; commit(); };
// Properties in Layout: the selected position first, then the part chosen in the Quilt panel.
function layoutProps() {
  const parts = quiltParts(), cur = parts.find(p => p.key === ui.quiltPart) || parts[0];
  const all = openSections(() => sectionsByKey(layoutInspector()));
  let h = '';
  if (ui.selCell && layoutTool() === 'select') h += positionSection();
  h += `<div class="props-head">${icon(cur.icon, 14)}<b>${esc(cur.label)}</b><span class="grow"></span>${!dockFind(wsLayout(), 'quilt') ? '<button class="btn small quiet" data-act="openPanel" data-arg="quilt">All parts…</button>' : ''}</div>`;
  h += cur.keys.map(k => all[k] || '').join('');
  // the extra Layout settings (partial blocks) sit with the panels part today; show them with setting too
  return h;
}
// The position selected with the Select tool: which block, its turn, and its commands.
function positionSection() {
  const key = ui.selCell, c = cellContent(key), pb = placeBlock(), hexStep = key[0] === 't';
  const body = c?.b ? `<div class="pos-row">${blockThumb(doc.blocks[c.b], 48)}<div><b>${esc(doc.blocks[c.b].name)}</b><br><span class="muted">${(c.r || 0) * (hexStep ? 60 : 90)}°${c.f ? ' · mirrored' : ''}</span></div></div>
      <div class="btn-row"><button class="btn small" data-act="cellRotate">Rotate ${hexStep ? 60 : 90}°</button><button class="btn small" data-act="cellFlip">Flip</button><button class="btn small" data-act="cellEdit">Edit block</button>
      ${pb && pb.id !== c.b ? `<button class="btn small" data-act="cellReplace">Replace with ${esc(pb.name)}</button>` : ''}<button class="btn small danger" data-act="cellClear">Clear</button></div>`
    : `<p class="hint">${c?.fab ? `Plain ${esc(fabricLabel(c.fab))}` : 'Empty position'}</p><div class="btn-row">${pb ? `<button class="btn small" data-act="cellReplace">Put ${esc(pb.name)} here</button>` : ''}${c?.fab ? '<button class="btn small danger" data-act="cellClear">Clear</button>' : ''}</div>`;
  return section('Selected position', body, { key: 'position' });
}
registerPanel('quilt', { title: 'Quilt', short: 'Quilt', icon: 'quilt', ws: ['layout'], render: quiltPanel });

// adding a part opens it in Properties
for (const [act, part] of [['addBorder', 'borders'], ['addPanel', 'panels']]) {
  const run = Actions[act];
  Actions[act] = (...a) => { ui.quiltPart = part; return run(...a); };
}
