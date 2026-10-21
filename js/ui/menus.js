/* Menu bar and right-click menus. The bar has File, Edit, View and Options, a menu for the step
   you're on (Block, Layout, Quilting, Fabric or Pattern) and Help; once one is open, pointing at
   another opens it, like a desktop app. Right-click menus give the same actions on things in the
   panels (blocks, fabrics, quilting layers, fabric rows). */

const STEP_MENU = { block: 'Block', layout: 'Layout', quilting: 'Quilting', fabric: 'Fabric', cutting: 'Fabric', pattern: 'Pattern' };
let _barMenu = null;            // which menu-bar menu is open

function menubarHtml() {
  return [['file', 'File'], ['edit', 'Edit'], ['view', 'View'], ['options', 'Options'], ['step', STEP_MENU[ui.view] || 'Block'], ['help', 'Help']]
    .map(([k, l]) => `<button data-act="menubar" data-arg="${k}" aria-haspopup="menu" aria-expanded="${_barMenu === k}">${l}</button>`).join('');
}
Actions.menubar = (k, el) => {
  if (_barMenu === k && _menuEl) { closeMenu(); return; }
  openMenu(el, MENUS[k](), { align: 'bar' });
  _barMenu = k;
  $$('#menubar button').forEach(b => b.setAttribute('aria-expanded', b.dataset.arg === k));
};
// pointing at another menu-bar item while one is open switches to it
document.addEventListener('pointerover', e => {
  const b = e.target.closest?.('#menubar button');
  if (b && _barMenu && _menuEl && b.dataset.arg !== _barMenu) Actions.menubar(b.dataset.arg, b);
});
// forget the bar menu once its menu closes (any way it closes)
new MutationObserver(() => { if (_barMenu && !_menuEl) { _barMenu = null; $$('#menubar button').forEach(b => b.setAttribute('aria-expanded', 'false')); } })
  .observe(document.body, { childList: true });

const tick = (label, act, arg, on, kb) => ({ label, act, arg, checked: !!on, kb });
const MENUS = {
  file: () => [
    { label: 'New project…', act: 'newProject' },
    { label: 'Open project file…', act: 'openProject', kb: 'Ctrl+O' },
    { label: 'Save project file', act: 'saveProject', kb: 'Ctrl+S' },
    '-',
    { header: 'Samples' },
    { label: 'Midnight Bullseye…', act: 'loadSample' },
    { label: 'Hexie Bloom…', act: 'loadTessSample' },
    '-',
    { label: 'Import blocks…', act: 'importBlocks' },
    { label: 'Export all blocks…', act: 'exportBlocks', arg: 'all', disabled: !doc.blockOrder.length },
    { label: 'Export PNG…', act: 'exportPngDialog' },
    { label: 'Export SVG', act: 'exportSvg' },
    '-',
    { label: 'Print pattern', act: 'printPattern', kb: 'Ctrl+P' },
  ],
  edit: () => {
    const items = [
      { label: 'Undo', act: 'undo', kb: 'Ctrl+Z', disabled: !undoStack.past.length },
      { label: 'Redo', act: 'redo', kb: 'Ctrl+Shift+Z', disabled: !undoStack.future.length },
    ];
    if (ui.view === 'block' && activeBlock()?.kind === 'drawn') {
      const n = selList().length;
      items.push('-',
        { label: 'Copy', act: 'selCopy', kb: 'Ctrl+C', disabled: !n },
        { label: 'Paste', act: 'selPaste', kb: 'Ctrl+V', disabled: !_edClip },
        { label: 'Duplicate', act: 'selDup', kb: 'Ctrl+D', disabled: !n },
        { label: 'Delete', act: 'selDelete', kb: 'Del', disabled: !n },
        { label: 'Select all', act: 'selAll', kb: 'Ctrl+A' },
        '-',
        { label: 'Turn left', act: 'selRotate', arg: 'ccw', kb: 'Q', disabled: !n },
        { label: 'Turn right', act: 'selRotate', arg: 'cw', kb: 'E', disabled: !n },
        { label: 'Mirror across', act: 'selMirror', arg: 'h', kb: 'X', disabled: !n },
        { label: 'Mirror down', act: 'selMirror', arg: 'v', kb: 'Y', disabled: !n },
        { label: 'To front', act: 'selOrder', arg: 'front', disabled: !n },
        { label: 'To back', act: 'selOrder', arg: 'back', disabled: !n });
    }
    if (ui.view === 'layout') items.push('-', { label: 'Clear layout…', act: 'clearLayout' });
    return items;
  },
  view: () => {
    const v = ui.view, items = [tick('Value view', 'toggleUi', 'grayscale', ui.grayscale, 'G')];
    if (v === 'block') items.push(
      tick('Seam lines', 'toggleSeamLines', undefined, ui.showSeamLines !== false),
      tick('Cut pieces', 'toggleUi', 'showPieces', ui.showPieces),
      tick('Centre lines', 'toggleUi', 'showCentre', ui.showCentre),
      '-',
      { label: 'Zoom in', act: 'edZoomBy', arg: 'in', kb: '+' },
      { label: 'Zoom out', act: 'edZoomBy', arg: 'out', kb: '−' },
      { label: 'Fit the block', act: 'edZoomBy', arg: 'fit', kb: '0' });
    if (v === 'layout') {
      items.push(tick('Seam lines', 'toggleUi', 'seamLines', ui.seamLines));
      if (doc.quilting.layers.length) items.push(tick('Quilting lines', 'toggleUi', 'showQuilting', ui.showQuilting));
    }
    if (v === 'quilting') items.push('-', tick('Front', 'qSide', 'front', ui.qSide !== 'back'), tick('Back', 'qSide', 'back', ui.qSide === 'back'), '-', tick('Fade quilt', 'toggleUi', 'qFade', ui.qFade));
    if (v === 'fabric' || v === 'cutting') items.push('-', tick('Shopping list', 'fabPane', 'shop', ui.fabPane !== 'cut'), tick('Cutting plan', 'fabPane', 'cut', ui.fabPane === 'cut'), '-', tick('Cutting maps', 'toggleCutMaps', undefined, ui.cutDiagrams !== false));
    if (v === 'pattern') items.push('-', { header: 'Paper' }, tick('US Letter', 'setUi', 'patternPage=letter', ui.patternPage !== 'a4'), tick('A4', 'setUi', 'patternPage=a4', ui.patternPage === 'a4'));
    return items;
  },
  options: () => [
    { header: 'Units' },
    tick('Inches', 'setUnits', 'in', ui.units !== 'cm'),
    tick('Centimetres', 'setUnits', 'cm', ui.units === 'cm'),
    '-',
    tick('Snap to grid', 'toggleSnap', undefined, !ui.snapOff),
    '-',
    { label: 'Cutting settings…', act: 'cuttingSettings' },
  ],
  step: () => (STEP_MENUS[ui.view] || STEP_MENUS.block)(),
  help: () => [
    { label: 'How it works', act: 'help', kb: '?' },
    { label: 'Keyboard shortcuts', act: 'shortcuts' },
    '-',
    { label: 'About', act: 'about' },
  ],
};
Actions.setUnits = u => { ui.units = u === 'cm' ? 'cm' : 'in'; saveUi(); render(); };
Actions.toggleCutMaps = () => Actions.cutDiagrams(ui.cutDiagrams === false);

const STEP_MENUS = {
  block: () => {
    const b = activeBlock(), drawn = b?.kind === 'drawn';
    return [
      { header: 'New' },
      { label: 'From the library…', act: 'libraryPicker' },
      { label: 'Draw a new block', act: 'newBlock' },
      { label: 'Hexagon block', act: 'newHexBlock' },
      { label: 'Combination of blocks', act: 'newCompound' },
      ...(b ? ['-', { header: esc(b.name) },
        ...(drawn ? [{ label: `Turn ${isHexBlock(b) ? 60 : 90}°`, act: 'blockRotate' }, { label: 'Mirror', act: 'blockMirror' }] : []),
        { label: 'Rename…', act: 'blockRename', arg: b.id },
        { label: 'Duplicate', act: 'blockDuplicate' },
        { label: 'Export…', act: 'exportBlocks', arg: 'one' },
        ...(drawn ? ['-', { label: 'Add suggested seams', act: 'autoSeams' }, { label: 'Remove all seams', act: 'clearSeams', disabled: !(b.seams?.length || b.appSeams?.length) },
          { label: refImgs[b.id] ? 'Replace tracing picture…' : 'Tracing picture…', act: 'refAdd' }] : []),
        '-',
        ...(drawn ? [{ label: 'Clear all shapes…', act: 'blockClear' }] : []),
        { label: 'Delete block…', act: 'blockDelete', danger: true }] : []),
    ];
  },
  layout: () => {
    const L = doc.layout, grid = L.mode !== 'tess';
    return [
      { header: 'Setting' },
      tick('Straight', 'layoutMode', 'grid', L.mode === 'grid'),
      tick('On point', 'layoutMode', 'onpoint', L.mode === 'onpoint'),
      tick('Tessellation', 'layoutMode', 'tess', L.mode === 'tess'),
      '-',
      ...(grid ? [{ label: 'Fill empty positions', act: 'fillLayout', arg: 'empty' }, { label: 'Fill all positions', act: 'fillLayout', arg: 'all' },
        { header: 'Turn the blocks' },
        ...[['same', 'All the same'], ['alternate', 'Alternate'], ['pinwheel', 'Pinwheel'], ['quadrants', 'Quadrants'], ['random', 'Random']].map(([k, l]) => ({ label: l, act: 'rotPattern', arg: k })),
        '-'] : []),
      { label: 'Add border', act: 'addBorder' },
      { label: 'Add inset panel', act: 'addPanel' },
      '-',
      { label: 'Clear layout…', act: 'clearLayout', danger: true },
    ];
  },
  quilting: () => [
    { header: 'Add quilting' },
    ...QUILT_TYPES.map(t => ({ label: t.label, act: 'addQuiltType', arg: t.key })),
    ...(doc.quilting.layers.length ? ['-', { label: 'Show all layers', act: 'qShowAll', arg: '1' }, { label: 'Hide all layers', act: 'qShowAll', arg: '' }] : []),
  ],
  fabric: () => [
    { label: 'Add a fabric', act: 'addFabric' },
    { label: 'Add a stash piece…', act: 'stashPicker' },
    '-',
    { label: 'Cutting settings…', act: 'cuttingSettings' },
  ],
  pattern: () => [
    { label: 'Print pattern', act: 'printPattern', kb: 'Ctrl+P' },
    '-',
    { label: 'Quilt name and designer…', act: 'view', arg: 'pattern' },
  ],
};
STEP_MENUS.cutting = STEP_MENUS.fabric;
Actions.addQuiltType = type => Actions.addQuiltLayer(type, { value: '' });
Actions.qShowAll = on => { for (const L of doc.quilting.layers) L.visible = !!on; commit(); };
// A stash piece for any fabric, from the menu bar: pick the fabric first.
Actions.stashPicker = () => openModal(`<h2>Add a stash piece</h2>
  <label class="f">Fabric<select id="stash-pick-fab">${doc.fabrics.map(f => `<option value="${f.id}" ${f.id === stashFabric() ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
  <label class="f">Size<select id="stash-pick-size">${STASH_PRESETS.map(([l, w, h], i) => `<option value="${i}">${l} · ${fmtSize(w, h)}</option>`).join('')}</select></label>
  <div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="stashPickerOk">Add</button></div>`);
Actions.stashPickerOk = () => {
  const [l, w, h] = STASH_PRESETS[+$('#stash-pick-size').value], fab = $('#stash-pick-fab').value;
  closeModal(); Actions.stashAdd(`${l}|${w}|${h}|${fab}`);
};
Actions.cuttingSettings = () => {
  openModal(`<h2>Cutting settings</h2>${cuttingSettingsHtml()}<div class="actions"><button class="btn primary" data-act="closeModal">Done</button></div>`);
};
// Rename a block in a small dialog (the right-click menus and the Block menu use it).
Actions.blockRename = id => {
  const b = doc.blocks[id]; if (!b) return;
  openModal(`<h2>Rename block</h2><label class="f">Name<input type="text" id="rename-input" value="${esc(b.name)}"></label>
    <div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="blockRenameOk" data-arg="${id}">Rename</button></div>`);
  setTimeout(() => { const i = $('#rename-input'); i?.select(); i?.addEventListener('keydown', e => { if (e.key === 'Enter') Actions.blockRenameOk(id); }); }, 40);
};
Actions.blockRenameOk = id => { const b = doc.blocks[id], v = $('#rename-input')?.value.trim(); closeModal(); if (b && v) { b.name = v; commit(); } };

/* ---------- right-click menus ---------- */
// Make `id` the block being edited, then run an action that works on the current block.
const onBlock = (id, act) => { ui.activeBlock = id; Actions[act](); };
Actions.ctxBlock = arg => { const [id, act] = arg.split('|'); onBlock(id, act); };
Actions.blockOpen = id => { ui.view = 'block'; Actions.pickBlock(id); };
Actions.blockPlace = id => { ui.placeBlock = id; ui.layoutTool = 'place'; Actions.view('layout'); };
const CONTEXT_MENUS = [
  ['#sidebar .blk[data-act="pickBlock"]', el => {
    const id = el.dataset.arg, b = doc.blocks[id];
    return [
      { header: esc(b.name) },
      { label: 'Edit', act: 'blockOpen', arg: id },
      { label: 'Place in the layout', act: 'blockPlace', arg: id },
      '-',
      { label: 'Rename…', act: 'blockRename', arg: id },
      { label: 'Duplicate', act: 'ctxBlock', arg: `${id}|blockDuplicate` },
      { label: 'Export…', act: 'ctxBlock', arg: `${id}|exportOne` },
      '-',
      { label: 'Delete…', act: 'ctxBlock', arg: `${id}|blockDelete`, danger: true },
    ];
  }],
  ['#sidebar .fab-chip[data-act="pickFabric"]:not(.bgpaint)', el => {
    const id = el.dataset.arg, isBg = id === doc.layout.background;
    return [
      { header: esc(fabricLabel(id)) },
      { label: 'Edit…', act: 'fabricPopover', arg: id },
      { label: 'Paint with it', act: 'pickFabric', arg: id },
      ...(isBg ? [] : [{ label: 'Use as background', act: 'setBackground', arg: id }]),
      { label: 'Duplicate', act: 'dupFabric', arg: id },
      '-',
      { label: 'Delete…', act: 'deleteFabric', arg: id, danger: true },
    ];
  }],
  ['#modal-root .blk[data-act="useLibrary"]', el => [
    { label: 'Add to My blocks', act: 'useLibrary', arg: el.dataset.arg },
    { label: 'Add and place in the layout', act: 'useLibraryPlace', arg: el.dataset.arg },
  ]],
  ['#inspector .sec.layer .sec-h', el => {
    const i = doc.quilting.layers.findIndex(L => L.id === el.dataset.arg), L = doc.quilting.layers[i];
    if (!L) return null;
    return [
      { label: L.visible ? 'Hide' : 'Show', act: 'qToggleShow', arg: i },
      { label: 'Duplicate', act: 'qDup', arg: i },
      { label: 'Move up', act: 'qMove', arg: `${i}|-1`, disabled: !i },
      { label: 'Move down', act: 'qMove', arg: `${i}|1`, disabled: i === doc.quilting.layers.length - 1 },
      '-',
      { label: 'Remove', act: 'qDel', arg: i, danger: true },
    ];
  }],
  ['#main table.t tr [data-act="fabRowMenu"], #main table.t tr', el => {
    const fab = (el.matches('tr') ? el : el.closest('tr')).querySelector('[data-act="fabRowMenu"]')?.dataset.arg;
    if (!fab) return null;
    return fabRowItems(fab);
  }],
  ['#main .fabcard', el => {
    const fab = el.id.replace(/^cut-/, ''), fb = fabricById(fab);
    return [
      { label: 'Fabric settings…', act: 'fabricPopover', arg: fab },
      ...(hasStashFor(fab) ? [tick('Cut from my stash first', 'ctxStashUse', fab, !fb.skipStash)] : []),
    ];
  }],
];
Actions.exportOne = () => Actions.exportBlocks('one');
Actions.useLibraryPlace = pid => { Actions.useLibrary(pid); const b = doc.blocks[doc.blockOrder[doc.blockOrder.length - 1]]; if (b) Actions.blockPlace(b.id); };
Actions.ctxStashUse = fab => { const fb = doc.fabrics.find(x => x.id === fab); if (fb) { if (fb.skipStash) delete fb.skipStash; else fb.skipStash = true; commit(); } };
document.addEventListener('contextmenu', e => {
  for (const [sel, items] of CONTEXT_MENUS) {
    const el = e.target.closest?.(sel);
    if (!el) continue;
    const list = items(el);
    if (!list) return;
    e.preventDefault();
    openMenu({ x: e.clientX, y: e.clientY }, list);
    return;
  }
});
