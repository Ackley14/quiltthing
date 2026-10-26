/* Menu bar and right-click menus. The bar has File, Edit, View, Select, Insert, Window and Help.
   Edit is in sections: history, the workspace you're in, the quilt's defaults, and your
   preferences. Window lists every panel. Once one menu is open, pointing at another opens it, like
   a desktop app. Right-click menus give the same actions on things in the panels. */

let _barMenu = null;            // which menu-bar menu is open

// The menus never change name or position; Edit, View and Insert offer what applies to the step you're on.
const BAR_MENUS = [['file', 'File'], ['edit', 'Edit'], ['view', 'View'], ['select', 'Select'], ['insert', 'Insert'], ['window', 'Window'], ['help', 'Help']];
function menubarHtml() {
  return BAR_MENUS.map(([k, l]) => `<button data-act="menubar" data-arg="${k}" aria-haspopup="menu" aria-expanded="${_barMenu === k}">${l}</button>`).join('');
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
    // every quilt saves itself into My quilts, so there's no Save here (Ctrl+S still saves at once)
    { label: 'New quilt', act: 'newProject' },
    { label: 'My quilts…', act: 'openBrowser', kb: 'Ctrl+O' },
    { label: 'Make a copy…', act: 'makeCopy', kb: 'Ctrl+Shift+S' },
    '-',
    { label: 'Download project file', act: 'saveProject' },
    { label: 'Open project file…', act: 'openProject' },
    '-',
    { header: 'Samples' },
    { label: 'Midnight Bullseye', act: 'loadSample' },
    { label: 'Hexie Bloom', act: 'loadTessSample' },
    '-',
    { label: 'Import blocks…', act: 'importBlocks' },
    { label: 'Export all blocks…', act: 'exportBlocks', arg: 'all', disabled: !doc.blockOrder.length },
    { label: 'Export PNG…', act: 'exportPngDialog' },
    { label: 'Export SVG', act: 'exportSvg' },
    '-',
    { label: 'Print pattern', act: 'printPattern', kb: 'Ctrl+P' },
  ],
  edit: () => {
    // History, then what the current step works on, then the quilt's defaults and your preferences
    const items = [
      { header: 'History' },
      { label: undoStack.past.length && histLabels.past.length ? `Undo ${histLabels.past[histLabels.past.length - 1]}` : 'Undo', text: true, act: 'undo', kb: 'Ctrl+Z', disabled: !undoStack.past.length },
      { label: undoStack.future.length && histLabels.future.length ? `Redo ${histLabels.future[histLabels.future.length - 1]}` : 'Redo', text: true, act: 'redo', kb: 'Ctrl+Shift+Z', disabled: !undoStack.future.length },
    ];
    const b = activeBlock();
    // the shape commands only while shapes are selected, so the menu stays short
    const n = ui.view === 'block' && b?.kind === 'drawn' ? selList().length : 0;
    if (n) {
      items.push('-', { header: plural(n, 'shape') },
        { label: 'Cut', act: 'selCut', kb: 'Ctrl+X' },
        { label: 'Copy', act: 'selCopy', kb: 'Ctrl+C' },
        { label: 'Paste', act: 'selPaste', kb: 'Ctrl+V', disabled: !_edClip },
        { label: 'Duplicate', act: 'selDup', kb: 'Ctrl+D' },
        { label: 'Rotate 90°', act: 'selRotate', arg: 'cw', kb: 'E' },
        { label: 'Flip horizontal', act: 'selMirror', arg: 'h', kb: 'X' },
        { label: 'Flip vertical', act: 'selMirror', arg: 'v', kb: 'Y' },
        { label: 'Bring to front', act: 'selOrder', arg: 'front', kb: 'Ctrl+Shift+]' },
        { label: 'Bring forward', act: 'selOrder', arg: 'forward', kb: 'Ctrl+]' },
        { label: 'Send backward', act: 'selOrder', arg: 'backward', kb: 'Ctrl+[' },
        { label: 'Send to back', act: 'selOrder', arg: 'back', kb: 'Ctrl+Shift+[' },
        { label: 'Delete', act: 'selDelete', kb: 'Del' });
    }
    if (ui.view === 'block' && b) {
      items.push('-', { header: esc(b.name) },
        ...(b.kind === 'drawn' ? [{ label: 'Select all shapes', act: 'selAll', kb: 'Ctrl+A' }, ...(n ? [] : [{ label: 'Paste', act: 'selPaste', kb: 'Ctrl+V', disabled: !_edClip }]), '-'] : []),
        ...(b.kind === 'drawn' ? [{ label: `Rotate block ${isHexBlock(b) ? 60 : 90}°`, act: 'blockRotate' }, { label: 'Flip block', act: 'blockMirror' }] : []),
        { label: 'Duplicate block', act: 'blockDuplicate' },
        ...(b.kind === 'drawn' ? [{ label: 'Add suggested seams', act: 'autoSeams' }, { label: 'Remove all seams', act: 'clearSeams', disabled: !(b.seams?.length || b.appSeams?.length) }, { label: 'Clear all shapes…', act: 'blockClear', danger: true }] : []),
        { label: 'Delete block…', act: 'blockDelete', danger: true });
    }
    if (ui.view === 'layout') items.push('-', { header: 'Layout' }, { label: 'Clear layout…', act: 'clearLayout', danger: true });
    if (ui.view === 'quilting' && doc.quilting.layers.length) items.push('-', { header: 'Quilting layers' }, { label: 'Show all layers', act: 'qShowAll', arg: '1' }, { label: 'Hide all layers', act: 'qShowAll', arg: '' });
    items.push('-', { header: 'Quilt defaults' },
      { label: 'Default fabric…', act: 'fabricDefaults' },
      { label: 'Seams and appliqué…', act: 'seamSettings' },
      '-', { header: 'Preferences' },
      tick('Inches', 'setUnits', 'in', ui.units !== 'cm'),
      tick('Centimetres', 'setUnits', 'cm', ui.units === 'cm'),
      tick('Snap to grid', 'toggleSnap', undefined, !ui.snapOff));
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
      { label: 'Fit the block', act: 'edZoomBy', arg: 'fit', kb: '0' }, { label: 'Actual size', act: 'zoomActual', kb: 'Shift+0' });
    if (v === 'layout') items.push(tick('Piece outlines', 'toggleUi', 'seamLines', ui.seamLines), { ...tick('Quilting lines', 'toggleUi', 'showQuilting', ui.showQuilting), disabled: !doc.quilting.layers.length });
    const qzItems = ['-', { label: 'Zoom in', act: 'qZoomBy', arg: 'in', kb: '+' }, { label: 'Zoom out', act: 'qZoomBy', arg: 'out', kb: '−' }, { label: 'Fit the quilt', act: 'qZoomBy', arg: 'fit', kb: '0' }, { label: 'Actual size', act: 'zoomActual', kb: 'Shift+0' }];
    if (v === 'quilting') items.push('-', tick('Front', 'qSide', 'front', ui.qSide !== 'back'), tick('Back', 'qSide', 'back', ui.qSide === 'back'), tick('Fade quilt', 'toggleUi', 'qFade', ui.qFade));
    if (v === 'layout' || v === 'quilting') items.push(...qzItems);
    if (v === 'fabric' || v === 'cutting' || v === 'pattern') items.push('-', { label: 'Zoom in', act: 'docZoomBy', arg: 'in', kb: '+' }, { label: 'Zoom out', act: 'docZoomBy', arg: 'out', kb: '−' }, { label: v === 'pattern' ? 'Fit the page' : 'Actual size', act: 'docZoomBy', arg: 'fit', kb: '0' });
    if (v === 'fabric' || v === 'cutting') items.push('-', tick('Shopping list', 'fabPane', 'shop', ui.fabPane !== 'cut'), tick('Cutting plan', 'fabPane', 'cut', ui.fabPane === 'cut'), tick('Cutting maps', 'toggleCutMaps', undefined, ui.cutDiagrams !== false));
    // how the app looks (yours, not the quilt's)
    items.push('-', { header: 'Theme' }, tick('Dark', 'setTheme', 'dark', prefs.theme !== 'light'), tick('Light', 'setTheme', 'light', prefs.theme === 'light'),
      '-', { header: 'Canvas colour' }, ...Object.entries(SURROUNDS).map(([k, [l]]) => tick(l, 'setSurround', k, prefs.surround === k)),
      '-', { header: 'Text size' }, tick('Standard', 'setDensity', 'standard', prefs.density !== 'large'), tick('Large', 'setDensity', 'large', prefs.density === 'large'),
      '-', tick('Rulers', 'toggleRulers', undefined, prefs.rulers),
      tick('Tool names in the tool strip', 'toggleToolLabels', undefined, prefs.toolLabels),
      { label: 'Customise the canvas HUD…', act: 'hudCustomise' },
      tick('Hide panels', 'toggleHidePanels', undefined, dockSession.hidden, 'Ctrl+.'));
    return items;
  },
  select: () => {
    const b = activeBlock(), drawn = ui.view === 'block' && b?.kind === 'drawn', n = drawn ? selList().length : 0;
    if (!drawn) return [{ label: 'Selecting shapes works in the Blocks workspace on a drawn block.', act: 'view', arg: 'block', disabled: ui.view === 'block' }];
    return [
      { label: 'All shapes', act: 'selAll', kb: 'Ctrl+A' },
      { label: 'None', act: 'selNone', kb: 'Esc', disabled: !n },
      { label: 'Invert', act: 'selInvert' },
      '-',
      { label: 'Same fabric as the selection', act: 'selSameFabric', disabled: !n },
      { header: 'By fabric' },
      ...uniq(b.regions.map(r => r.fab)).map(f => ({ label: `${swatchHtml(f === BG ? doc.layout.background : f, 14)} ${esc(f === BG ? 'Background' : fabricLabel(f))}`, act: 'selByFabric', arg: f })),
    ];
  },
  window: () => {
    const ws = curWs(), open = new Set(dockOpenIds(wsLayout()));
    const ids = Object.keys(Panels).sort((a, b) => Panels[a].title.localeCompare(Panels[b].title));
    const mine = ids.filter(id => panelBelongs(id, ws)), other = ids.filter(id => !panelBelongs(id, ws));
    return [
      { header: `Panels for ${wsLabel(ws)}` },
      ...mine.map(id => tick(esc(Panels[id].title), 'togglePanel', id, open.has(id))),
      ...(other.length ? [{ header: 'From other workspaces' }, ...other.map(id => tick(esc(Panels[id].title), 'togglePanel', id, open.has(id)))] : []),
      '-',
      { label: dockSession.reopen && dockSession.reopenWs === ws ? `Reopen ${dockSession.reopenName}` : 'Reopen closed panel', text: true, act: 'reopenPanel', disabled: !dockSession.reopen || dockSession.reopenWs !== ws },
      tick('Hide panels', 'toggleHidePanels', undefined, dockSession.hidden, 'Ctrl+.'),
      tick('Lock layout', 'toggleLockLayout', undefined, prefs.lockLayout),
      '-',
      { label: `Reset panels in ${wsLabel(ws)}`, act: 'resetLayout', arg: 'ws' },
      { label: 'Reset all layouts', act: 'resetLayout', arg: 'all' },
    ];
  },
  insert: () => [
    { header: 'Blocks' },
    { label: 'From the library…', act: 'libraryPicker' },
    { label: 'New block', act: 'newBlock' },
    { label: 'Hexagon block', act: 'newHexBlock' },
    { label: 'Combination of blocks', act: 'newCompound' },
    ...(ui.view === 'block' && activeBlock()?.kind === 'drawn' ? [{ label: 'Tracing picture…', act: 'refAdd' }] : []),
    '-',
    { header: 'Quilt' },
    { label: 'Border', act: 'insertBorder' },
    { label: 'Inset panel', act: 'insertPanel' },
    { label: 'Quilting layer…', act: 'insertQuilting' },
    '-',
    { header: 'Fabric' },
    { label: 'Fabric', act: 'addFabric' },
    { label: 'Stash piece…', act: 'stashPicker' },
  ],
  help: () => [
    { label: 'How it works', act: 'help', kb: '?' },
    { label: 'Keyboard shortcuts', act: 'shortcuts' },
    { label: 'Take the tour', act: 'startTour' },
    { label: "What's new and where things moved", act: 'whatsNew' },
    '-',
    { label: 'About', act: 'about' },
  ],
};
Actions.setUnits = u => { ui.units = u === 'cm' ? 'cm' : 'in'; saveUi(); render(); };
Actions.toggleCutMaps = () => Actions.cutDiagrams(ui.cutDiagrams === false);
// Insert commands land you where the new thing is
Actions.insertBorder = () => { Actions.addBorder(); if (ui.view !== 'layout') Actions.view('layout'); };
Actions.insertPanel = () => { Actions.addPanel(); if (ui.view !== 'layout') Actions.view('layout'); };
Actions.insertQuilting = () => { if (ui.view !== 'quilting') Actions.view('quilting'); setTimeout(() => { const b = $('#ctxbar [data-act="addLayerMenu"]'); if (b) Actions.addLayerMenu(null, b); }, 30); };
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
Actions.fabricDefaults = () => openModal(`<h2>Default fabric</h2>${fabricDefaultsHtml()}<div class="actions"><button class="btn primary" data-act="closeModal">Done</button></div>`);
Actions.seamSettings = () => openModal(`<h2>Seams and appliqué</h2>${seamSettingsHtml()}<div class="actions"><button class="btn primary" data-act="closeModal">Done</button></div>`);
// Rename a block: open it and put the cursor in its name field.
Actions.blockRename = id => {
  if (!doc.blocks[id]) return;
  Actions.blockOpen(id);
  Actions.openPanel('props');
  setTimeout(() => { const f = $('[data-panel="props"] [data-change="blockName"]'); f?.focus(); f?.select(); }, 30);
};

/* ---------- right-click menus ---------- */
// Make `id` the block being edited, then run an action that works on the current block.
const onBlock = (id, act) => { ui.activeBlock = id; Actions[act](); };
Actions.ctxBlock = arg => { const [id, act] = arg.split('|'); onBlock(id, act); };
Actions.blockOpen = id => { ui.view = 'block'; Actions.pickBlock(id); };
Actions.blockPlace = id => { ui.placeBlock = id; ui.layoutTool = 'place'; Actions.view('layout'); };
const CONTEXT_MENUS = [
  ['[data-panel="blocks"] .blk[data-act="pickBlock"]', el => {
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
  ['[data-panel="fabrics"] .fab-chip[data-act="pickFabric"]:not(.bgpaint)', el => {
    const id = el.dataset.arg, isBg = id === doc.layout.background;
    return [
      { header: esc(fabricLabel(id)) },
      { label: 'Edit…', act: 'fabricPopover', arg: id },
      { label: 'Paint with it', act: 'pickFabric', arg: id },
      ...(isBg ? [] : [{ label: 'Use as background', act: 'setBackground', arg: id }]),
      { label: 'Duplicate', act: 'dupFabric', arg: id },
      { label: 'Swap with…', act: 'swapFabricMenu', arg: id },
      '-',
      { label: 'Delete…', act: 'deleteFabric', arg: id, danger: true },
    ];
  }],
  ['#modal-root .blk[data-act="useLibrary"], [data-panel="library"] .blk[data-act="useLibrary"]', el => [
    { label: 'Add to this quilt', act: 'useLibrary', arg: el.dataset.arg },
    { label: 'Add and place in the layout', act: 'useLibraryPlace', arg: el.dataset.arg },
  ]],
  ['.zoom-pct', () => ['fabric', 'pattern'].includes(ui.view) ? [{ label: ui.view === 'pattern' ? 'Fit the page' : '100%', act: 'docZoomBy', arg: 'fit', kb: '0' }, '-', { label: 'Zoom in', act: 'docZoomBy', arg: 'in', kb: '+' }, { label: 'Zoom out', act: 'docZoomBy', arg: 'out', kb: '−' }] : zoomMenuItems()],
  ['[data-panel] .part-row.layer', el => {
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
  if (!e.target.closest?.('input, textarea, [contenteditable="true"], .docview, .paper, .page, a[href]')) e.preventDefault();
});

/* ---------- keyboard: arrows move through an open menu, left/right switch menu-bar menus,
   Alt + the first letter opens a menu-bar menu ---------- */
document.addEventListener('keydown', e => {
  if (e.altKey && !e.ctrlKey && /^[a-z]$/i.test(e.key)) {
    const b = $$('#menubar button').find(x => x.textContent.trim()[0].toLowerCase() === e.key.toLowerCase());
    if (b) { e.preventDefault(); Actions.menubar(b.dataset.arg, b); return; }
  }
  if (!_menuEl) return;
  const items = [...(_menuEl.querySelectorAll('button:not([disabled])'))];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); e.stopPropagation();
    const n = items.length, j = i < 0 ? 0 : (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    items[j]?.focus();
  } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && _barMenu) {
    e.preventDefault(); e.stopPropagation();
    const bar = $$('#menubar button'), k = bar.findIndex(b => b.dataset.arg === _barMenu);
    const next = bar[(k + (e.key === 'ArrowRight' ? 1 : -1) + bar.length) % bar.length];
    Actions.menubar(next.dataset.arg, next);
  }
}, true);

// Select menu (Blocks)
Actions.selNone = () => { setSel([]); refreshEditor(); renderView(); };
Actions.selInvert = () => { const b = activeBlock(), s = new Set(selList()); if (ui.tool !== 'select') ui.tool = 'select'; setSel(b.regions.map((_, i) => i).filter(i => !s.has(i))); renderView(); };
Actions.selSameFabric = () => { const b = activeBlock(), fabs = new Set(selList().map(i => resolveFab(b.regions[i].fab))); setSel(b.regions.map((r, i) => fabs.has(resolveFab(r.fab)) ? i : -1).filter(i => i >= 0)); renderView(); };
Actions.selByFabric = f => { const b = activeBlock(); if (ui.tool !== 'select') ui.tool = 'select'; setSel(b.regions.map((r, i) => r.fab === f ? i : -1).filter(i => i >= 0)); renderView(); };

// Small screens: every menu in one list (the menu bar doesn't fit)
Actions.allMenus = (a, el) => openMenu(el, [{ label: 'Quilt name…', act: 'focusTitle' }, '-', ...BAR_MENUS.map(([k, name]) => ({ label: `${name} ›`, act: 'openNamedMenu', arg: k }))], { align: 'left' });
Actions.openNamedMenu = k => { const el = $('#appbar [data-act="allMenus"]'); setTimeout(() => openMenu(el, [{ label: '‹ Menus', act: 'allMenus' }, '-', ...MENUS[k]()], { align: 'left' }), 20); };
